/**
 * Schedule Storage Service
 * Manages persistence of schedule data using localStorage with security features
 */

import { SummarySchedule } from '../types/schedule';
import { sanitizeText, sanitizeFileName } from '../utils/inputSanitizer';
import { TimeBand, DayType } from '../utils/calculator';
import { ParsedExcelData } from '../utils/excelParser';
import { ParsedCsvData } from '../utils/csvParser';
import { ValidationResult } from '../utils/validator';

export interface SavedSchedule {
  id: string;
  routeName: string;
  direction: string;
  effectiveDate: string;
  expirationDate?: string;
  status: 'Active' | 'Draft' | 'Expired';
  tripCount: {
    weekday: number;
    saturday: number;
    sunday: number;
  };
  fileType: 'excel' | 'csv';
  createdAt: string;
  updatedAt: string;
  summarySchedule?: SummarySchedule; // Optional for drafts
  fileName?: string;
  data?: any; // Raw data (ParsedExcelData | ParsedCsvData)
  operationalServiceBands?: { // Operational service bands from timepoints page
    weekday: TimeBand[];
    saturday: TimeBand[];
    sunday: TimeBand[];
  };
  isDraft: boolean;
}

export interface DraftSchedule {
  id: string;
  fileName: string;
  fileType: 'excel' | 'csv';
  uploadedData: ParsedExcelData | ParsedCsvData;
  validation?: ValidationResult;
  summarySchedule?: SummarySchedule;
  processingStep: 'uploaded' | 'validated' | 'processed' | 'completed';
  createdAt: string;
  updatedAt: string;
  autoSaved: boolean;
}

export interface ScheduleListItem {
  id: string;
  routeName: string;
  direction: string;
  effectiveDate: string;
  expirationDate?: string;
  status: 'Active' | 'Draft' | 'Expired';
  tripCount: number; // Total trips across all day types
  fileType: 'excel' | 'csv';
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'scheduler2_saved_schedules';
const DRAFT_STORAGE_KEY = 'scheduler2_draft_schedules';
const SESSION_STORAGE_KEY = 'scheduler2_current_session';
const MAX_SCHEDULES = 50; // Limit number of saved schedules
const MAX_DRAFTS = 20; // Limit number of draft schedules
const MAX_SCHEDULE_SIZE = 5 * 1024 * 1024; // 5MB limit per schedule
const DRAFT_AUTO_SAVE_INTERVAL = 30000; // Auto-save drafts every 30 seconds

class ScheduleStorageService {
  /**
   * Generates a unique ID for a schedule
   */
  private generateScheduleId(): string {
    return `sched_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
      return `Schedule size (${(scheduleSize / (1024 * 1024)).toFixed(1)}MB) exceeds maximum allowed size (5MB)`;
    }

    return null;
  }

  /**
   * Generates a unique ID for drafts
   */
  private generateDraftId(): string {
    return `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validates draft data before saving
   */
  private validateDraftData(data: ParsedExcelData | ParsedCsvData): string | null {
    if (!data || (Array.isArray(data) && data.length === 0)) {
      return 'Draft must contain uploaded data';
    }

    // Check data size
    const dataSize = JSON.stringify(data).length;
    if (dataSize > MAX_SCHEDULE_SIZE) {
      return `Draft size (${(dataSize / (1024 * 1024)).toFixed(1)}MB) exceeds maximum allowed size (5MB)`;
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

  /**
   * Saves a schedule to localStorage
   */
  saveSchedule(
    summarySchedule: SummarySchedule, 
    fileType: 'excel' | 'csv' = 'excel',
    fileName?: string,
    rawData?: any
  ): { success: boolean; error?: string; scheduleId?: string } {
    try {
      // Validate input
      const validationError = this.validateScheduleData(summarySchedule);
      if (validationError) {
        return { success: false, error: validationError };
      }

      // Get existing schedules
      const existingSchedules = this.getAllSchedules();
      
      // Check schedule limit
      if (existingSchedules.length >= MAX_SCHEDULES) {
        return { 
          success: false, 
          error: `Cannot save more than ${MAX_SCHEDULES} schedules. Please delete some old schedules first.` 
        };
      }

      // Create saved schedule object
      const scheduleId = this.generateScheduleId();
      const now = new Date().toISOString();
      
      const savedSchedule: SavedSchedule = {
        id: scheduleId,
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

      // Save to localStorage
      const updatedSchedules = [...existingSchedules, savedSchedule];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSchedules));

      return { success: true, scheduleId };

    } catch (error) {
      console.error('Error saving schedule:', error);
      return { 
        success: false, 
        error: 'Failed to save schedule. Please check if you have enough storage space.' 
      };
    }
  }

  /**
   * Retrieves all saved schedules
   */
  getAllSchedules(): SavedSchedule[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) {
        return [];
      }

      const schedules = JSON.parse(data) as SavedSchedule[];
      
      // Update status for all schedules based on current date
      return schedules.map(schedule => ({
        ...schedule,
        status: this.getScheduleStatus(
          new Date(schedule.effectiveDate),
          schedule.expirationDate ? new Date(schedule.expirationDate) : undefined
        )
      }));

    } catch (error) {
      console.error('Error loading schedules:', error);
      return [];
    }
  }

  /**
   * Gets schedule list items (without full schedule data for performance)
   */
  getScheduleListItems(): ScheduleListItem[] {
    return this.getAllSchedules().map(schedule => ({
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
  getScheduleById(id: string): SavedSchedule | null {
    try {
      const schedules = this.getAllSchedules();
      return schedules.find(schedule => schedule.id === id) || null;
    } catch (error) {
      console.error('Error loading schedule:', error);
      return null;
    }
  }

  /**
   * Deletes a schedule by ID
   */
  deleteSchedule(id: string): { success: boolean; error?: string } {
    try {
      const schedules = this.getAllSchedules();
      const filteredSchedules = schedules.filter(schedule => schedule.id !== id);
      
      if (schedules.length === filteredSchedules.length) {
        return { success: false, error: 'Schedule not found' };
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredSchedules));
      return { success: true };

    } catch (error) {
      console.error('Error deleting schedule:', error);
      return { success: false, error: 'Failed to delete schedule' };
    }
  }

  /**
   * Updates an existing schedule
   */
  updateSchedule(
    id: string, 
    summarySchedule: SummarySchedule,
    fileType?: 'excel' | 'csv',
    fileName?: string
  ): { success: boolean; error?: string } {
    try {
      // Validate input
      const validationError = this.validateScheduleData(summarySchedule);
      if (validationError) {
        return { success: false, error: validationError };
      }

      const schedules = this.getAllSchedules();
      const scheduleIndex = schedules.findIndex(schedule => schedule.id === id);
      
      if (scheduleIndex === -1) {
        return { success: false, error: 'Schedule not found' };
      }

      // Update the schedule
      const existingSchedule = schedules[scheduleIndex];
      const updatedSchedule: SavedSchedule = {
        ...existingSchedule,
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
        updatedAt: new Date().toISOString(),
        summarySchedule,
        isDraft: false
      };

      schedules[scheduleIndex] = updatedSchedule;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules));

      return { success: true };

    } catch (error) {
      console.error('Error updating schedule:', error);
      return { success: false, error: 'Failed to update schedule' };
    }
  }

  /**
   * Clears all saved schedules (for testing/reset purposes)
   */
  clearAllSchedules(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing schedules:', error);
    }
  }

  /**
   * Gets storage usage statistics
   */
  getStorageStats(): {
    scheduleCount: number;
    draftCount: number;
    totalSize: number;
    remainingCapacity: number;
    remainingDraftCapacity: number;
  } {
    try {
      const schedules = this.getAllSchedules();
      const drafts = this.getAllDraftSchedules();
      const schedulesData = JSON.stringify(schedules);
      const draftsData = JSON.stringify(drafts);
      const totalSize = new Blob([schedulesData]).size + new Blob([draftsData]).size;
      
      return {
        scheduleCount: schedules.length,
        draftCount: drafts.length,
        totalSize,
        remainingCapacity: Math.max(0, (MAX_SCHEDULES - schedules.length)),
        remainingDraftCapacity: Math.max(0, (MAX_DRAFTS - drafts.length))
      };

    } catch (error) {
      console.error('Error calculating storage stats:', error);
      return {
        scheduleCount: 0,
        draftCount: 0,
        totalSize: 0,
        remainingCapacity: MAX_SCHEDULES,
        remainingDraftCapacity: MAX_DRAFTS
      };
    }
  }

  // ===== DRAFT SCHEDULE METHODS =====

  /**
   * Saves or updates a draft schedule
   */
  saveDraftSchedule(
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
  ): { success: boolean; error?: string; draftId?: string } {
    try {
      // Validate input
      const validationError = this.validateDraftData(uploadedData);
      if (validationError) {
        return { success: false, error: validationError };
      }

      const drafts = this.getAllDraftSchedules();
      const now = new Date().toISOString();
      
      let draftId = options.existingId;
      let existingDraftIndex = -1;
      
      if (draftId) {
        existingDraftIndex = drafts.findIndex(d => d.id === draftId);
      } else {
        // Check if draft with same filename exists
        existingDraftIndex = drafts.findIndex(d => d.fileName === fileName);
        if (existingDraftIndex >= 0) {
          draftId = drafts[existingDraftIndex].id;
        }
      }

      if (!draftId) {
        // Create new draft
        if (drafts.length >= MAX_DRAFTS) {
          return { 
            success: false, 
            error: `Cannot save more than ${MAX_DRAFTS} draft schedules. Please delete some old drafts first.` 
          };
        }
        draftId = this.generateDraftId();
      }

      const draftSchedule: DraftSchedule = {
        id: draftId,
        fileName: sanitizeText(fileName),
        fileType,
        uploadedData,
        validation: options.validation,
        summarySchedule: options.summarySchedule,
        processingStep: options.processingStep || 'uploaded',
        createdAt: existingDraftIndex >= 0 ? drafts[existingDraftIndex].createdAt : now,
        updatedAt: now,
        autoSaved: options.autoSaved || false
      };

      if (existingDraftIndex >= 0) {
        drafts[existingDraftIndex] = draftSchedule;
      } else {
        drafts.push(draftSchedule);
      }

      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
      return { success: true, draftId };

    } catch (error) {
      console.error('Error saving draft schedule:', error);
      return { 
        success: false, 
        error: 'Failed to save draft schedule. Please check if you have enough storage space.' 
      };
    }
  }

  /**
   * Retrieves all draft schedules
   */
  getAllDraftSchedules(): DraftSchedule[] {
    try {
      const data = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!data) {
        return [];
      }

      return JSON.parse(data) as DraftSchedule[];

    } catch (error) {
      console.error('Error loading draft schedules:', error);
      return [];
    }
  }

  /**
   * Retrieves a specific draft schedule by ID
   */
  getDraftScheduleById(id: string): DraftSchedule | null {
    try {
      const drafts = this.getAllDraftSchedules();
      return drafts.find(draft => draft.id === id) || null;
    } catch (error) {
      console.error('Error loading draft schedule:', error);
      return null;
    }
  }

  /**
   * Deletes a draft schedule by ID
   */
  deleteDraftSchedule(id: string): { success: boolean; error?: string } {
    try {
      const drafts = this.getAllDraftSchedules();
      const filteredDrafts = drafts.filter(draft => draft.id !== id);
      
      if (drafts.length === filteredDrafts.length) {
        return { success: false, error: 'Draft schedule not found' };
      }

      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(filteredDrafts));
      
      // Also clear session storage if this was the current draft
      this.clearCurrentSession();
      
      return { success: true };

    } catch (error) {
      console.error('Error deleting draft schedule:', error);
      return { success: false, error: 'Failed to delete draft schedule' };
    }
  }

  /**
   * Converts a draft to a completed schedule
   */
  promoteDraftToSchedule(draftId: string): { success: boolean; error?: string; scheduleId?: string } {
    try {
      const draft = this.getDraftScheduleById(draftId);
      if (!draft) {
        return { success: false, error: 'Draft schedule not found' };
      }

      if (!draft.summarySchedule) {
        return { success: false, error: 'Draft must be fully processed before converting to schedule' };
      }

      // Save as completed schedule
      const result = this.saveSchedule(
        draft.summarySchedule,
        draft.fileType,
        draft.fileName,
        draft.uploadedData
      );

      if (result.success) {
        // Delete the draft
        this.deleteDraftSchedule(draftId);
      }

      return result;

    } catch (error) {
      console.error('Error promoting draft to schedule:', error);
      return { success: false, error: 'Failed to convert draft to schedule' };
    }
  }

  /**
   * Clears all draft schedules
   */
  clearAllDraftSchedules(): void {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing draft schedules:', error);
    }
  }

  // ===== SESSION STORAGE METHODS =====

  /**
   * Saves current session data for recovery
   */
  saveCurrentSession(sessionData: {
    fileName?: string;
    fileType?: 'excel' | 'csv';
    step: number;
    uploadedData?: ParsedExcelData | ParsedCsvData;
    validation?: ValidationResult;
    summarySchedule?: SummarySchedule;
    draftId?: string;
  }): void {
    try {
      const session = {
        ...sessionData,
        timestamp: new Date().toISOString()
      };
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch (error) {
      console.error('Error saving session:', error);
    }
  }

  /**
   * Retrieves current session data
   */
  getCurrentSession(): any | null {
    try {
      const data = sessionStorage.getItem(SESSION_STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error loading session:', error);
      return null;
    }
  }

  /**
   * Clears current session data
   */
  clearCurrentSession(): void {
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  }
}

// Auto-save functionality
let autoSaveInterval: NodeJS.Timeout | null = null;

export const startAutoSave = (callback: () => void) => {
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
  }
  autoSaveInterval = setInterval(callback, DRAFT_AUTO_SAVE_INTERVAL);
};

export const stopAutoSave = () => {
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
    autoSaveInterval = null;
  }
};

// Export singleton instance
export const scheduleStorage = new ScheduleStorageService();
export default scheduleStorage;