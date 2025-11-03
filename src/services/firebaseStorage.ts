/**
 * Firebase Storage Service
 * Firebase/Firestore-based replacement for localStorage with real-time updates
 * Maintains the same interface as ScheduleStorageService for easy migration
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  Timestamp,
  DocumentData,
  QuerySnapshot,
  Unsubscribe,
  FieldValue,
  QueryConstraint
} from 'firebase/firestore';

import { db, getFirebaseErrorMessage } from '../config/firebase';
import { SummarySchedule } from '../types/schedule';
import { sanitizeText, sanitizeFileName } from '../utils/inputSanitizer';
import { TimeBand, DayType } from '../utils/calculator';
import { ParsedExcelData } from '../utils/excelParser';
import { ParsedCsvData } from '../utils/csvParser';
import { ValidationResult } from '../utils/validator';

// Re-use existing interfaces from localStorage service
import scheduleStorage, {
  SavedSchedule,
  DraftSchedule,
  ScheduleListItem
} from './scheduleStorage';

// Firebase-specific extensions
export interface FirebaseSchedule extends Omit<SavedSchedule, 'createdAt' | 'updatedAt'> {
  userId?: string; // Optional now that auth is removed
  createdAt: Timestamp | FieldValue;
  updatedAt: Timestamp | FieldValue;
}

export interface FirebaseDraftSchedule extends Omit<DraftSchedule, 'createdAt' | 'updatedAt'> {
  userId?: string; // Optional now that auth is removed
  createdAt: Timestamp | FieldValue;
  updatedAt: Timestamp | FieldValue;
}

// Constants
const COLLECTIONS = {
  SCHEDULES: 'schedules',
  DRAFTS: 'draft_schedules',
  USER_PROFILES: 'user_profiles'
} as const;

const MAX_SCHEDULES = 100; // Increased for cloud storage
const MAX_DRAFTS = 50; // Increased for cloud storage
const MAX_SCHEDULE_SIZE = 10 * 1024 * 1024; // 10MB for cloud storage

class FirebaseStorageService {
  private schedulesListener: Unsubscribe | null = null;
  private draftsListener: Unsubscribe | null = null;
  private currentUserId: string | null = null;
  private readonly firebaseEnabled = process.env.REACT_APP_ENABLE_FIREBASE === 'true';
  private readonly useSharedDrafts = process.env.REACT_APP_FIREBASE_SHARED_DRAFTS === 'true';
  private readonly localFallback = scheduleStorage;

  private getCollectionUserId(): string | undefined {
    if (this.useSharedDrafts) {
      return undefined;
    }
    return this.currentUserId || undefined;
  }

  private getDocumentUserId(): string {
    if (!this.currentUserId) {
      throw new Error('Firebase Storage: User context not set');
    }
    return this.currentUserId;
  }

  // Event callbacks for real-time updates
  private onSchedulesChange: ((schedules: SavedSchedule[]) => void) | null = null;
  private onDraftsChange: ((drafts: DraftSchedule[]) => void) | null = null;

  constructor() {
    if (!this.firebaseEnabled) {
      console.info('Firebase storage disabled; using local storage fallback');
      return;
    }

    const initialUserId = this.getCollectionUserId();
    if (initialUserId) {
      this.setupRealtimeListeners(initialUserId);
    }
  }

  /**
   * Configure service for the authenticated Firebase user
   */
  setUserContext(userId: string | null): void {
    if (!this.firebaseEnabled) {
      return;
    }

    if (this.currentUserId === userId) {
      return;
    }

    this.cleanupListeners();
    this.currentUserId = userId;

    const shouldListen = Boolean(userId);

    if (shouldListen && userId) {
      this.setupRealtimeListeners(userId);
    } else {
      console.info('Firebase Storage: user context cleared - realtime listeners paused');
    }
  }

  clearUserContext(): void {
    this.setUserContext(null);
  }

  private getSchedulesCollection(userId?: string) {
    return userId
      ? collection(db, 'users', userId, COLLECTIONS.SCHEDULES)
      : collection(db, COLLECTIONS.SCHEDULES);
  }

  private getDraftsCollection(userId?: string) {
    return userId
      ? collection(db, 'users', userId, COLLECTIONS.DRAFTS)
      : collection(db, COLLECTIONS.DRAFTS);
  }

  private getScheduleDoc(userId: string | undefined, scheduleId: string) {
    return doc(this.getSchedulesCollection(userId), scheduleId);
  }

  private getDraftDoc(userId: string | undefined, draftId: string) {
    return doc(this.getDraftsCollection(userId), draftId);
  }

  private isFirebaseReady(): boolean {
    if (!this.firebaseEnabled) {
      return false;
    }

    if (!db) {
      console.warn('Firebase Storage: Firestore not initialized');
      return false;
    }

    if (!this.currentUserId) {
      // Allow anonymous storage operations when no auth context is available
      return true;
    }

    return true;
  }

  /**
   * Setup real-time listeners for schedules and drafts
   */
  private setupRealtimeListeners(userId?: string): void {
    const activeUserId = userId ?? this.currentUserId;

    if (!activeUserId) {
      console.info('Firebase Storage: realtime listeners waiting for authenticated user context');
      return;
    }

    const draftCollectionUserId = this.useSharedDrafts ? undefined : activeUserId;

    // Listen to schedules for the active user (only when not using shared drafts)
    if (!this.useSharedDrafts) {
      const schedulesQuery = query(
        this.getSchedulesCollection(activeUserId),
        orderBy('updatedAt', 'desc'),
        limit(MAX_SCHEDULES)
      );
  
      this.schedulesListener = onSnapshot(schedulesQuery, (snapshot) => {
        const schedules = this.parseSchedulesSnapshot(snapshot);
        if (this.onSchedulesChange) {
          this.onSchedulesChange(schedules);
        }
      }, (error) => {
        console.error('Schedules listener error:', error);
      });
    }

    const draftConstraints: QueryConstraint[] = [];

    if (this.useSharedDrafts) {
      draftConstraints.push(where('userId', '==', activeUserId));
    }

    draftConstraints.push(orderBy('updatedAt', 'desc'), limit(MAX_DRAFTS));

    const draftsQuery = query(
      this.getDraftsCollection(draftCollectionUserId),
      ...draftConstraints
    );

    this.draftsListener = onSnapshot(draftsQuery, (snapshot) => {
      const drafts = this.parseDraftsSnapshot(snapshot);
      if (this.onDraftsChange) {
        this.onDraftsChange(drafts);
      }
    }, (error) => {
      console.error('Drafts listener error:', error);
    });
  }

  /**
   * Set callback for real-time schedule updates
   */
  onSchedulesUpdate(callback: (schedules: SavedSchedule[]) => void): void {
    this.onSchedulesChange = callback;
  }

  /**
   * Set callback for real-time draft updates
   */
  onDraftsUpdate(callback: (drafts: DraftSchedule[]) => void): void {
    this.onDraftsChange = callback;
  }

  /**
   * Cleanup listeners
   */
  private cleanupListeners(): void {
    if (this.schedulesListener) {
      this.schedulesListener();
      this.schedulesListener = null;
    }
    if (this.draftsListener) {
      this.draftsListener();
      this.draftsListener = null;
    }
  }

  /**
   * Parse Firestore snapshot to schedules array
   */
  private parseSchedulesSnapshot(snapshot: QuerySnapshot<DocumentData>): SavedSchedule[] {
    return snapshot.docs.map(doc => {
      const data = doc.data() as FirebaseSchedule;
      // When reading from Firestore, timestamps are always Timestamp objects
      const createdAt = data.createdAt as Timestamp;
      const updatedAt = data.updatedAt as Timestamp;
      return {
        ...data,
        id: doc.id,
        createdAt: createdAt.toDate().toISOString(),
        updatedAt: updatedAt.toDate().toISOString()
      };
    });
  }

  /**
   * Parse Firestore snapshot to drafts array
   */
  private parseDraftsSnapshot(snapshot: QuerySnapshot<DocumentData>): DraftSchedule[] {
    return snapshot.docs.map(doc => {
      const data = doc.data() as FirebaseDraftSchedule;
      // When reading from Firestore, timestamps are always Timestamp objects
      const createdAt = data.createdAt as Timestamp;
      const updatedAt = data.updatedAt as Timestamp;
      return {
        ...data,
        id: doc.id,
        createdAt: createdAt.toDate().toISOString(),
        updatedAt: updatedAt.toDate().toISOString()
      };
    });
  }

  /**
   * Check if user is authenticated
   */
  private requireFirebase(): boolean {
    if (!this.firebaseEnabled) {
      console.warn('🔥 Firebase Storage: Firebase features are disabled');
      return false;
    }

    if (!db) {
      console.warn('🔥 Firebase Storage: Database not initialized');
      return false;
    }

    if (!this.currentUserId) {
      console.warn('🔥 Firebase Storage: User context not set - authentication required');
      return false;
    }

    return true;
  }

  /**
   * Generate unique ID
   */
  private generateScheduleId(): string {
    return `sched_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique draft ID
   */
  private generateDraftId(): string {
    return `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validates schedule data before saving
   */
  private validateScheduleData(schedule: SummarySchedule): string | null {
    if (!schedule.routeId || !schedule.routeName) {
      return 'Schedule must have a route ID and name';
    }

    if (!schedule.timePoints || schedule.timePoints.length === 0) {
      return 'Schedule must have at least one time point';
    }

    if (!schedule.effectiveDate) {
      return 'Schedule must have an effective date';
    }

    // Check schedule size
    const scheduleSize = JSON.stringify(schedule).length;
    if (scheduleSize > MAX_SCHEDULE_SIZE) {
      return `Schedule size (${(scheduleSize / (1024 * 1024)).toFixed(1)}MB) exceeds maximum allowed size (10MB)`;
    }

    return null;
  }

  /**
   * Determines schedule status based on dates
   */
  private getScheduleStatus(effectiveDate: Date, expirationDate?: Date): 'Active' | 'Draft' | 'Expired' {
    const now = new Date();
    const effective = new Date(effectiveDate);
    
    if (effective > now) {
      return 'Draft';
    }
    
    if (expirationDate) {
      const expiry = new Date(expirationDate);
      if (expiry < now) {
        return 'Expired';
      }
    }
    
    return 'Active';
  }

  // ===== SCHEDULE METHODS =====

  /**
   * Saves a schedule to Firestore
   */
  async saveSchedule(
    summarySchedule: SummarySchedule, 
    fileType: 'excel' | 'csv' = 'excel',
    fileName?: string,
    rawData?: any
  ): Promise<{ success: boolean; error?: string; scheduleId?: string }> {
    try {
      if (!this.requireFirebase()) {
        return { success: false, error: 'Authentication required for saving schedules' };
      }

      // Validate input
      const validationError = this.validateScheduleData(summarySchedule);
      if (validationError) {
        return { success: false, error: validationError };
      }

      // Check schedule limit
      const existingSchedules = await this.getAllSchedules();
      if (existingSchedules.length >= MAX_SCHEDULES) {
        return { 
          success: false, 
          error: `Cannot save more than ${MAX_SCHEDULES} schedules. Please delete some old schedules first.` 
        };
      }

      const userId = this.getDocumentUserId();

      // Create schedule document
      const scheduleId = this.generateScheduleId();
      const now = serverTimestamp();
      
      const firebaseSchedule: Omit<FirebaseSchedule, 'id'> = {
        userId,
        routeName: sanitizeText(summarySchedule.routeName),
        direction: sanitizeText(summarySchedule.direction),
        effectiveDate: summarySchedule.effectiveDate instanceof Date
          ? summarySchedule.effectiveDate.toISOString()
          : summarySchedule.effectiveDate,
        expirationDate: summarySchedule.expirationDate instanceof Date
          ? summarySchedule.expirationDate.toISOString()
          : summarySchedule.expirationDate,
        status: this.getScheduleStatus(
          summarySchedule.effectiveDate instanceof Date
            ? summarySchedule.effectiveDate
            : new Date(summarySchedule.effectiveDate),
          summarySchedule.expirationDate instanceof Date
            ? summarySchedule.expirationDate
            : summarySchedule.expirationDate ? new Date(summarySchedule.expirationDate) : undefined
        ),
        tripCount: {
          weekday: summarySchedule.metadata?.weekdayTrips || 0,
          saturday: summarySchedule.metadata?.saturdayTrips || 0,
          sunday: summarySchedule.metadata?.sundayTrips || 0
        },
        fileType,
        createdAt: now,
        updatedAt: now,
        summarySchedule,
        isDraft: false,
        fileName: fileName ? sanitizeText(fileName) : undefined,
        data: rawData
      };

      // Save to Firestore
      const docRef = this.getScheduleDoc(this.getCollectionUserId(), scheduleId);
      await setDoc(docRef, firebaseSchedule);

      return { success: true, scheduleId };

    } catch (error: any) {
      console.error('Error saving schedule:', error);
      return { 
        success: false, 
        error: getFirebaseErrorMessage(error)
      };
    }
  }

  /**
   * Retrieves all saved schedules for current user
   */
  async getAllSchedules(): Promise<SavedSchedule[]> {
    try {
      if (!this.requireFirebase()) {
        console.warn('🔥 Firebase Storage: Not authenticated, returning empty schedule list');
        return [];
      }

      const collectionRef = this.getSchedulesCollection(this.getCollectionUserId());
      const q = query(
        collectionRef,
        // No user filtering needed
        orderBy('updatedAt', 'desc')
      );

      const snapshot = await getDocs(q);
      return this.parseSchedulesSnapshot(snapshot);

    } catch (error: any) {
      console.error('Error loading schedules:', error);
      return [];
    }
  }

  /**
   * Gets schedule list items (without full schedule data for performance)
   */
  async getScheduleListItems(): Promise<ScheduleListItem[]> {
    const schedules = await this.getAllSchedules();
    return schedules.map(schedule => ({
      id: schedule.id,
      routeName: schedule.routeName,
      direction: schedule.direction,
      effectiveDate: schedule.effectiveDate,
      expirationDate: schedule.expirationDate,
      status: schedule.status,
      tripCount: schedule.tripCount.weekday + schedule.tripCount.saturday + schedule.tripCount.sunday,
      fileType: schedule.fileType,
      createdAt: schedule.createdAt,
      updatedAt: schedule.updatedAt
    }));
  }

  /**
   * Retrieves a specific schedule by ID
   */
  async getScheduleById(id: string): Promise<SavedSchedule | null> {
    try {
      if (!this.requireFirebase()) {
        console.warn('🔥 Firebase Storage: Not authenticated, cannot get schedule by ID');
        return null;
      }

      const docRef = this.getScheduleDoc(this.getCollectionUserId(), id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as FirebaseSchedule;
        // When reading from Firestore, timestamps are always Timestamp objects
        const createdAt = data.createdAt as Timestamp;
        const updatedAt = data.updatedAt as Timestamp;
        return {
          ...data,
          id: docSnap.id,
          createdAt: createdAt.toDate().toISOString(),
          updatedAt: updatedAt.toDate().toISOString()
        };
      }

      return null;
    } catch (error: any) {
      console.error('Error loading schedule:', error);
      return null;
    }
  }

  /**
   * Deletes a schedule by ID
   */
  async deleteSchedule(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.requireFirebase()) {
        return { success: false, error: 'Authentication required for deleting schedules' };
      }

      const docRef = this.getScheduleDoc(this.getCollectionUserId(), id);
      await deleteDoc(docRef);

      return { success: true };

    } catch (error: any) {
      console.error('Error deleting schedule:', error);
      return { 
        success: false, 
        error: getFirebaseErrorMessage(error)
      };
    }
  }

  /**
   * Updates an existing schedule
   */
  async updateSchedule(
    id: string, 
    summarySchedule: SummarySchedule,
    fileType?: 'excel' | 'csv',
    fileName?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.requireFirebase()) {
        return { success: false, error: 'Authentication required for updating schedules' };
      }

      // Validate input
      const validationError = this.validateScheduleData(summarySchedule);
      if (validationError) {
        return { success: false, error: validationError };
      }

      // Get existing schedule
      const existingSchedule = await this.getScheduleById(id);
      if (!existingSchedule) {
        return { success: false, error: 'Schedule not found' };
      }

      // Update the schedule
      const updatedData: Partial<FirebaseSchedule> = {
        routeName: sanitizeText(summarySchedule.routeName),
        direction: sanitizeText(summarySchedule.direction),
        effectiveDate: summarySchedule.effectiveDate instanceof Date 
          ? summarySchedule.effectiveDate.toISOString() 
          : summarySchedule.effectiveDate,
        expirationDate: summarySchedule.expirationDate instanceof Date 
          ? summarySchedule.expirationDate.toISOString() 
          : summarySchedule.expirationDate,
        status: this.getScheduleStatus(
          summarySchedule.effectiveDate instanceof Date 
            ? summarySchedule.effectiveDate 
            : new Date(summarySchedule.effectiveDate),
          summarySchedule.expirationDate instanceof Date 
            ? summarySchedule.expirationDate 
            : summarySchedule.expirationDate ? new Date(summarySchedule.expirationDate) : undefined
        ),
        tripCount: {
          weekday: summarySchedule.metadata?.weekdayTrips || 0,
          saturday: summarySchedule.metadata?.saturdayTrips || 0,
          sunday: summarySchedule.metadata?.sundayTrips || 0
        },
        fileType: fileType || existingSchedule.fileType,
        fileName: fileName ? sanitizeText(fileName) : existingSchedule.fileName,
        updatedAt: serverTimestamp(),
        summarySchedule,
        isDraft: false
      };

      const docRef = this.getScheduleDoc(this.getCollectionUserId(), id);
      await setDoc(docRef, updatedData, { merge: true });

      return { success: true };

    } catch (error: any) {
      console.error('Error updating schedule:', error);
      return { 
        success: false, 
        error: getFirebaseErrorMessage(error)
      };
    }
  }

  // ===== DRAFT SCHEDULE METHODS =====

  /**
   * Saves or updates a draft schedule
   */
  async saveDraftSchedule(
    fileName: string,
    fileType: 'excel' | 'csv',
    uploadedData: ParsedExcelData | ParsedCsvData,
    options: {
      validation?: ValidationResult;
      summarySchedule?: SummarySchedule;
      processingStep?: 'uploaded' | 'validated' | 'processed' | 'completed';
      autoSaved?: boolean;
      existingId?: string;
    } = {}
  ): Promise<{ success: boolean; error?: string; draftId?: string }> {
    try {
      if (!this.requireFirebase()) {
        return { success: false, error: 'Authentication required for saving drafts' };
      }

      // Check data size
      const dataSize = JSON.stringify(uploadedData).length;
      if (dataSize > MAX_SCHEDULE_SIZE) {
        return { 
          success: false, 
          error: `Draft size (${(dataSize / (1024 * 1024)).toFixed(1)}MB) exceeds maximum allowed size (10MB)` 
        };
      }

      // Check draft limit if creating new
      if (!options.existingId) {
        const existingDrafts = await this.getAllDraftSchedules();
        if (existingDrafts.length >= MAX_DRAFTS) {
          return { 
            success: false, 
            error: `Cannot save more than ${MAX_DRAFTS} draft schedules. Please delete some old drafts first.` 
          };
        }
      }

      const userId = this.getDocumentUserId();

      const draftId = options.existingId || this.generateDraftId();
      const now = serverTimestamp();
      
      // Get existing draft for created timestamp
      let existingDraft: DraftSchedule | null = null;
      if (options.existingId) {
        existingDraft = await this.getDraftScheduleById(draftId);
      }

      const firebaseDraft: Omit<FirebaseDraftSchedule, 'id'> = {
        userId, // Required for Firestore security rules
        fileName: sanitizeText(fileName),
        fileType,
        uploadedData,
        validation: options.validation,
        summarySchedule: options.summarySchedule,
        processingStep: options.processingStep || 'uploaded',
        createdAt: existingDraft ? Timestamp.fromDate(new Date(existingDraft.createdAt)) : now,
        updatedAt: now,
        autoSaved: options.autoSaved || false
      };

      const docRef = this.getDraftDoc(this.getCollectionUserId(), draftId);
      await setDoc(docRef, firebaseDraft);

      return { success: true, draftId };

    } catch (error: any) {
      console.error('Error saving draft schedule:', error);
      return { 
        success: false, 
        error: getFirebaseErrorMessage(error)
      };
    }
  }

  /**
   * Retrieves all draft schedules for current user
   */
  async getAllDraftSchedules(): Promise<DraftSchedule[]> {
    try {
      if (!this.requireFirebase()) {
        console.warn('🔥 Firebase Storage: Not authenticated, returning empty draft list');
        return [];
      }

      const collectionRef = this.getDraftsCollection(this.getCollectionUserId());
      const constraints: QueryConstraint[] = [];

      if (this.useSharedDrafts) {
        constraints.push(where('userId', '==', this.getDocumentUserId()));
      }

      constraints.push(orderBy('updatedAt', 'desc'));

      const q = query(collectionRef, ...constraints);

      const snapshot = await getDocs(q);
      return this.parseDraftsSnapshot(snapshot);

    } catch (error: any) {
      console.error('Error loading draft schedules:', error);
      return [];
    }
  }

  /**
   * Retrieves a specific draft schedule by ID
   */
  async getDraftScheduleById(id: string): Promise<DraftSchedule | null> {
    try {
      if (!this.requireFirebase()) {
        console.warn('🔥 Firebase Storage: Not authenticated, cannot get draft by ID');
        return null;
      }

      const docRef = this.getDraftDoc(this.getCollectionUserId(), id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as FirebaseDraftSchedule;
        // When reading from Firestore, timestamps are always Timestamp objects
        const createdAt = data.createdAt as Timestamp;
        const updatedAt = data.updatedAt as Timestamp;
        return {
          ...data,
          id: docSnap.id,
          createdAt: createdAt.toDate().toISOString(),
          updatedAt: updatedAt.toDate().toISOString()
        };
      }

      return null;
    } catch (error: any) {
      console.error('Error loading draft schedule:', error);
      return null;
    }
  }

  /**
   * Deletes a draft schedule by ID
   */
  async deleteDraftSchedule(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.requireFirebase()) {
        return { success: false, error: 'Authentication required for deleting drafts' };
      }

      const docRef = this.getDraftDoc(this.getCollectionUserId(), id);
      await deleteDoc(docRef);

      return { success: true };

    } catch (error: any) {
      console.error('Error deleting draft schedule:', error);
      return { 
        success: false, 
        error: getFirebaseErrorMessage(error)
      };
    }
  }

  /**
   * Converts a draft to a completed schedule
   */
  async promoteDraftToSchedule(draftId: string): Promise<{ success: boolean; error?: string; scheduleId?: string }> {
    try {
      const draft = await this.getDraftScheduleById(draftId);
      if (!draft) {
        return { success: false, error: 'Draft schedule not found' };
      }

      if (!draft.summarySchedule) {
        return { success: false, error: 'Draft must be fully processed before converting to schedule' };
      }

      // Save as completed schedule
      const result = await this.saveSchedule(
        draft.summarySchedule,
        draft.fileType,
        draft.fileName,
        draft.uploadedData
      );

      if (result.success) {
        // Delete the draft
        await this.deleteDraftSchedule(draftId);
      }

      return result;

    } catch (error: any) {
      console.error('Error promoting draft to schedule:', error);
      return { 
        success: false, 
        error: getFirebaseErrorMessage(error)
      };
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Gets storage usage statistics
   */
  async getStorageStats(): Promise<{
    scheduleCount: number;
    draftCount: number;
    remainingCapacity: number;
    remainingDraftCapacity: number;
  }> {
    try {
      const [schedules, drafts] = await Promise.all([
        this.getAllSchedules(),
        this.getAllDraftSchedules()
      ]);
      
      return {
        scheduleCount: schedules.length,
        draftCount: drafts.length,
        remainingCapacity: Math.max(0, (MAX_SCHEDULES - schedules.length)),
        remainingDraftCapacity: Math.max(0, (MAX_DRAFTS - drafts.length))
      };

    } catch (error: any) {
      console.error('Error calculating storage stats:', error);
      return {
        scheduleCount: 0,
        draftCount: 0,
        remainingCapacity: MAX_SCHEDULES,
        remainingDraftCapacity: MAX_DRAFTS
      };
    }
  }

  /**
   * Cleanup method to call on component unmount
   */
  destroy(): void {
    this.cleanupListeners();
  }

  /**
   * Get current user information (returns null - no auth)
   */
  getCurrentUser(): null {
    return null;
  }

  /**
   * Check if user is authenticated (always false - no auth)
   */
  isAuthenticated(): boolean {
    return false;
  }
}

// Export singleton instance
export const firebaseStorage = new FirebaseStorageService();
export default firebaseStorage;
