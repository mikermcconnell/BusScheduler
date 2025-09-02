/**
 * LocalStorage to Firebase Migration Utility
 * Helps users migrate their existing localStorage data to Firebase Firestore
 */

import { firebaseStorage } from '../services/firebaseStorage';
import { scheduleStorage } from '../services/scheduleStorage';
import { SavedSchedule, DraftSchedule } from '../services/scheduleStorage';

export interface MigrationResult {
  success: boolean;
  error?: string;
  migrated: {
    schedules: number;
    drafts: number;
  };
  failed: {
    schedules: number;
    drafts: number;
  };
  details: string[];
}

/**
 * Check if localStorage contains any data to migrate
 */
export function checkForLocalStorageData(): {
  hasData: boolean;
  scheduleCount: number;
  draftCount: number;
} {
  try {
    const localSchedules = scheduleStorage.getAllSchedules();
    const localDrafts = scheduleStorage.getAllDraftSchedules();
    
    return {
      hasData: localSchedules.length > 0 || localDrafts.length > 0,
      scheduleCount: localSchedules.length,
      draftCount: localDrafts.length
    };
  } catch (error) {
    console.error('Error checking localStorage data:', error);
    return {
      hasData: false,
      scheduleCount: 0,
      draftCount: 0
    };
  }
}

/**
 * Migrate all localStorage data to Firebase
 */
export async function migrateToFirebase(options: {
  skipExisting?: boolean;
  dryRun?: boolean;
} = {}): Promise<MigrationResult> {
  const { skipExisting = true, dryRun = false } = options;
  
  const result: MigrationResult = {
    success: false,
    migrated: { schedules: 0, drafts: 0 },
    failed: { schedules: 0, drafts: 0 },
    details: []
  };

  try {
    // Check if user is authenticated
    if (!firebaseStorage.isAuthenticated()) {
      return {
        ...result,
        error: 'User must be signed in to Firebase to migrate data'
      };
    }

    // Get localStorage data
    const localSchedules = scheduleStorage.getAllSchedules();
    const localDrafts = scheduleStorage.getAllDraftSchedules();
    
    result.details.push(`Found ${localSchedules.length} schedules and ${localDrafts.length} drafts in localStorage`);

    if (dryRun) {
      result.details.push('DRY RUN - No data will be migrated');
      result.success = true;
      return result;
    }

    // Get existing Firebase data if checking for conflicts
    let existingSchedules: SavedSchedule[] = [];
    let existingDrafts: DraftSchedule[] = [];
    
    if (skipExisting) {
      existingSchedules = await firebaseStorage.getAllSchedules();
      existingDrafts = await firebaseStorage.getAllDraftSchedules();
      result.details.push(`Found ${existingSchedules.length} schedules and ${existingDrafts.length} drafts in Firebase`);
    }

    // Migrate schedules
    for (const schedule of localSchedules) {
      try {
        // Check if schedule already exists in Firebase
        if (skipExisting && existingSchedules.some(existing => 
          existing.routeName === schedule.routeName && 
          existing.direction === schedule.direction &&
          existing.effectiveDate === schedule.effectiveDate
        )) {
          result.details.push(`Skipped existing schedule: ${schedule.routeName} ${schedule.direction}`);
          continue;
        }

        if (schedule.summarySchedule) {
          const migrateResult = await firebaseStorage.saveSchedule(
            schedule.summarySchedule,
            schedule.fileType,
            schedule.fileName,
            schedule.data
          );

          if (migrateResult.success) {
            result.migrated.schedules++;
            result.details.push(`✅ Migrated schedule: ${schedule.routeName} ${schedule.direction}`);
          } else {
            result.failed.schedules++;
            result.details.push(`❌ Failed to migrate schedule: ${schedule.routeName} - ${migrateResult.error}`);
          }
        } else {
          result.failed.schedules++;
          result.details.push(`❌ Skipped schedule without summary data: ${schedule.routeName}`);
        }
      } catch (error) {
        result.failed.schedules++;
        result.details.push(`❌ Error migrating schedule ${schedule.routeName}: ${error}`);
      }

      // Add small delay to prevent overwhelming Firebase
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Migrate drafts
    for (const draft of localDrafts) {
      try {
        // Check if draft already exists in Firebase
        if (skipExisting && existingDrafts.some(existing => 
          existing.fileName === draft.fileName &&
          Math.abs(new Date(existing.createdAt).getTime() - new Date(draft.createdAt).getTime()) < 60000 // Within 1 minute
        )) {
          result.details.push(`Skipped existing draft: ${draft.fileName}`);
          continue;
        }

        const migrateResult = await firebaseStorage.saveDraftSchedule(
          draft.fileName,
          draft.fileType,
          draft.uploadedData,
          {
            validation: draft.validation,
            summarySchedule: draft.summarySchedule,
            processingStep: draft.processingStep,
            autoSaved: draft.autoSaved
          }
        );

        if (migrateResult.success) {
          result.migrated.drafts++;
          result.details.push(`✅ Migrated draft: ${draft.fileName}`);
        } else {
          result.failed.drafts++;
          result.details.push(`❌ Failed to migrate draft: ${draft.fileName} - ${migrateResult.error}`);
        }
      } catch (error) {
        result.failed.drafts++;
        result.details.push(`❌ Error migrating draft ${draft.fileName}: ${error}`);
      }

      // Add small delay to prevent overwhelming Firebase
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Success if we migrated at least some data and didn't have critical failures
    result.success = (result.migrated.schedules > 0 || result.migrated.drafts > 0) || 
                    (localSchedules.length === 0 && localDrafts.length === 0);

    result.details.push(`Migration complete: ${result.migrated.schedules + result.migrated.drafts} items migrated, ${result.failed.schedules + result.failed.drafts} failed`);

  } catch (error) {
    result.error = `Migration failed: ${error}`;
    result.details.push(`❌ Critical error: ${error}`);
  }

  return result;
}

/**
 * Create a backup of localStorage data before migration
 */
export function createLocalStorageBackup(): { success: boolean; error?: string; backup?: string } {
  try {
    const schedules = scheduleStorage.getAllSchedules();
    const drafts = scheduleStorage.getAllDraftSchedules();
    const stats = scheduleStorage.getStorageStats();
    
    const backup = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      data: {
        schedules,
        drafts,
        stats
      }
    };

    const backupString = JSON.stringify(backup, null, 2);
    
    return {
      success: true,
      backup: backupString
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to create backup: ${error}`
    };
  }
}

/**
 * Download localStorage backup as JSON file
 */
export function downloadBackup(): void {
  const backupResult = createLocalStorageBackup();
  
  if (!backupResult.success || !backupResult.backup) {
    alert('Failed to create backup: ' + (backupResult.error || 'Unknown error'));
    return;
  }

  const blob = new Blob([backupResult.backup], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `scheduler2-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  URL.revokeObjectURL(url);
}

/**
 * Clear localStorage data after successful migration (with confirmation)
 */
export function clearLocalStorageData(options: {
  force?: boolean;
  confirmedByUser?: boolean;
} = {}): { success: boolean; error?: string } {
  const { force = false, confirmedByUser = false } = options;

  if (!force && !confirmedByUser) {
    return {
      success: false,
      error: 'User confirmation required to clear localStorage data'
    };
  }

  try {
    scheduleStorage.clearAllSchedules();
    scheduleStorage.clearAllDraftSchedules();
    scheduleStorage.clearCurrentSession();
    
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to clear localStorage: ${error}`
    };
  }
}

/**
 * Estimate migration time based on data size
 */
export function estimateMigrationTime(): {
  estimatedMinutes: number;
  itemCount: number;
  details: string;
} {
  const data = checkForLocalStorageData();
  const totalItems = data.scheduleCount + data.draftCount;
  
  // Estimate based on 1 item per 2 seconds (including Firebase write time + delays)
  const estimatedSeconds = totalItems * 2;
  const estimatedMinutes = Math.max(1, Math.ceil(estimatedSeconds / 60));
  
  return {
    estimatedMinutes,
    itemCount: totalItems,
    details: `Migrating ${data.scheduleCount} schedules and ${data.draftCount} drafts. Estimated time: ${estimatedMinutes} minute${estimatedMinutes === 1 ? '' : 's'}.`
  };
}

/**
 * Verify migration completeness by comparing counts
 */
export async function verifyMigration(): Promise<{
  success: boolean;
  details: {
    localStorage: { schedules: number; drafts: number };
    firebase: { schedules: number; drafts: number };
    matched: boolean;
  };
}> {
  try {
    const localData = checkForLocalStorageData();
    const firebaseSchedules = await firebaseStorage.getAllSchedules();
    const firebaseDrafts = await firebaseStorage.getAllDraftSchedules();
    
    const matched = localData.scheduleCount <= firebaseSchedules.length &&
                   localData.draftCount <= firebaseDrafts.length;
    
    return {
      success: true,
      details: {
        localStorage: {
          schedules: localData.scheduleCount,
          drafts: localData.draftCount
        },
        firebase: {
          schedules: firebaseSchedules.length,
          drafts: firebaseDrafts.length
        },
        matched
      }
    };
  } catch (error) {
    return {
      success: false,
      details: {
        localStorage: { schedules: 0, drafts: 0 },
        firebase: { schedules: 0, drafts: 0 },
        matched: false
      }
    };
  }
}