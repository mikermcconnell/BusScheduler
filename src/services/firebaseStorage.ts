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
  FieldValue
} from 'firebase/firestore';

import { User, onAuthStateChanged } from 'firebase/auth';
import { db, auth, getFirebaseErrorMessage } from '../config/firebase';
import { SummarySchedule } from '../types/schedule';
import { sanitizeText, sanitizeFileName } from '../utils/inputSanitizer';
import { TimeBand, DayType } from '../utils/calculator';
import { ParsedExcelData } from '../utils/excelParser';
import { ParsedCsvData } from '../utils/csvParser';
import { ValidationResult } from '../utils/validator';

// Re-use existing interfaces from localStorage service
import {
  SavedSchedule,
  DraftSchedule,
  ScheduleListItem
} from './scheduleStorage';

// Firebase-specific extensions
export interface FirebaseSchedule extends Omit<SavedSchedule, 'createdAt' | 'updatedAt'> {
  userId: string;
  createdAt: Timestamp | FieldValue;
  updatedAt: Timestamp | FieldValue;
}

export interface FirebaseDraftSchedule extends Omit<DraftSchedule, 'createdAt' | 'updatedAt'> {
  userId: string;
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
  private currentUser: User | null = null;
  private authUnsubscribe: Unsubscribe | null = null;
  private schedulesListener: Unsubscribe | null = null;
  private draftsListener: Unsubscribe | null = null;
  
  // Event callbacks for real-time updates
  private onSchedulesChange: ((schedules: SavedSchedule[]) => void) | null = null;
  private onDraftsChange: ((drafts: DraftSchedule[]) => void) | null = null;

  constructor() {
    this.initializeAuth();
  }

  /**
   * Initialize authentication listener
   */
  private initializeAuth(): void {
    this.authUnsubscribe = onAuthStateChanged(auth, (user) => {
      this.currentUser = user;
      
      if (user) {
        console.log('🔥 Firebase user authenticated:', user.uid);
        this.setupRealtimeListeners();
      } else {
        console.log('🔥 Firebase user signed out');
        this.cleanupListeners();
      }
    });
  }

  /**
   * Setup real-time listeners for schedules and drafts
   */
  private setupRealtimeListeners(): void {
    if (!this.currentUser) return;

    // Listen to schedules
    const schedulesQuery = query(
      collection(db, COLLECTIONS.SCHEDULES),
      where('userId', '==', this.currentUser.uid),
      orderBy('updatedAt', 'desc')
    );

    this.schedulesListener = onSnapshot(schedulesQuery, (snapshot) => {
      const schedules = this.parseSchedulesSnapshot(snapshot);
      if (this.onSchedulesChange) {
        this.onSchedulesChange(schedules);
      }
    }, (error) => {
      console.error('Schedules listener error:', error);
    });

    // Listen to drafts
    const draftsQuery = query(
      collection(db, COLLECTIONS.DRAFTS),
      where('userId', '==', this.currentUser.uid),
      orderBy('updatedAt', 'desc')
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
  private requireAuth(): boolean {
    if (!this.currentUser) {
      throw new Error('User must be authenticated to perform this operation');
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
      this.requireAuth();

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

      // Create schedule document
      const scheduleId = this.generateScheduleId();
      const now = serverTimestamp();
      
      const firebaseSchedule: Omit<FirebaseSchedule, 'id'> = {
        userId: this.currentUser!.uid,
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
      const docRef = doc(db, COLLECTIONS.SCHEDULES, scheduleId);
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
      this.requireAuth();

      const q = query(
        collection(db, COLLECTIONS.SCHEDULES),
        where('userId', '==', this.currentUser!.uid),
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
      this.requireAuth();

      const docRef = doc(db, COLLECTIONS.SCHEDULES, id);
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
      this.requireAuth();

      const docRef = doc(db, COLLECTIONS.SCHEDULES, id);
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
      this.requireAuth();

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

      const docRef = doc(db, COLLECTIONS.SCHEDULES, id);
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
      this.requireAuth();

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

      const draftId = options.existingId || this.generateDraftId();
      const now = serverTimestamp();
      
      // Get existing draft for created timestamp
      let existingDraft: DraftSchedule | null = null;
      if (options.existingId) {
        existingDraft = await this.getDraftScheduleById(draftId);
      }

      const firebaseDraft: Omit<FirebaseDraftSchedule, 'id'> = {
        userId: this.currentUser!.uid,
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

      const docRef = doc(db, COLLECTIONS.DRAFTS, draftId);
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
      this.requireAuth();

      const q = query(
        collection(db, COLLECTIONS.DRAFTS),
        where('userId', '==', this.currentUser!.uid),
        orderBy('updatedAt', 'desc')
      );

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
      this.requireAuth();

      const docRef = doc(db, COLLECTIONS.DRAFTS, id);
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
      this.requireAuth();

      const docRef = doc(db, COLLECTIONS.DRAFTS, id);
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
    if (this.authUnsubscribe) {
      this.authUnsubscribe();
    }
  }

  /**
   * Get current user information
   */
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }
}

// Export singleton instance
export const firebaseStorage = new FirebaseStorageService();
export default firebaseStorage;