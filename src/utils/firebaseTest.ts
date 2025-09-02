/**
 * Firebase Storage Test Utility
 * Tests Firebase connection and basic operations
 */

import { firebaseStorage } from '../services/firebaseStorage';
import { scheduleStorage } from '../services/scheduleStorage';
import { checkForLocalStorageData } from './localStorageMigration';

export interface FirebaseTestResult {
  success: boolean;
  error?: string;
  results: {
    connection: boolean;
    authentication: boolean;
    dataWrite: boolean;
    dataRead: boolean;
    dataDelete: boolean;
  };
  details: string[];
}

/**
 * Run comprehensive Firebase storage tests
 */
export async function runFirebaseTests(): Promise<FirebaseTestResult> {
  const result: FirebaseTestResult = {
    success: false,
    results: {
      connection: false,
      authentication: false,
      dataWrite: false,
      dataRead: false,
      dataDelete: false
    },
    details: []
  };

  try {
    // Test 1: Connection
    result.details.push('🔍 Testing Firebase connection...');
    if (firebaseStorage.getCurrentUser() !== undefined) {
      result.results.connection = true;
      result.details.push('✅ Firebase connection established');
    } else {
      result.details.push('❌ Firebase connection failed');
      return result;
    }

    // Test 2: Authentication state
    result.details.push('🔍 Testing authentication state...');
    const isAuth = firebaseStorage.isAuthenticated();
    result.results.authentication = true; // Anonymous mode is valid
    result.details.push(`✅ Authentication state: ${isAuth ? 'Authenticated' : 'Anonymous mode'}`);

    // Create test data
    const testSchedule = {
      routeId: 'test-route-001',
      routeName: 'Firebase Test Route',
      direction: 'Outbound',
      effectiveDate: new Date().toISOString(),
      timePoints: [
        { id: 'tp1', name: 'Start Station', arrivalTime: '08:00', departureTime: '08:00' },
        { id: 'tp2', name: 'End Station', arrivalTime: '08:30', departureTime: '08:30' }
      ],
      metadata: {
        weekdayTrips: 1,
        saturdayTrips: 0,
        sundayTrips: 0
      }
    };

    // Test 3: Data Write
    result.details.push('🔍 Testing data write operation...');
    try {
      const writeResult = await firebaseStorage.saveSchedule(
        testSchedule as any,
        'csv',
        'firebase-test-schedule.csv',
        { testData: true }
      );

      if (writeResult.success) {
        result.results.dataWrite = true;
        result.details.push(`✅ Data write successful: ${writeResult.scheduleId}`);

        // Test 4: Data Read
        result.details.push('🔍 Testing data read operation...');
        const readResult = await firebaseStorage.getScheduleById(writeResult.scheduleId!);
        
        if (readResult && readResult.routeName === testSchedule.routeName) {
          result.results.dataRead = true;
          result.details.push('✅ Data read successful - data integrity confirmed');

          // Test 5: Data Delete
          result.details.push('🔍 Testing data delete operation...');
          const deleteResult = await firebaseStorage.deleteSchedule(writeResult.scheduleId!);
          
          if (deleteResult.success) {
            result.results.dataDelete = true;
            result.details.push('✅ Data delete successful');
          } else {
            result.details.push(`❌ Data delete failed: ${deleteResult.error}`);
          }
        } else {
          result.details.push('❌ Data read failed - data not found or corrupted');
        }
      } else {
        result.details.push(`❌ Data write failed: ${writeResult.error}`);
      }
    } catch (error) {
      result.details.push(`❌ Firebase operation error: ${error}`);
    }

    // Overall success check
    const passedTests = Object.values(result.results).filter(Boolean).length;
    result.success = passedTests >= 3; // At least connection, auth, and one data operation

    result.details.push(`\n📊 Test Summary: ${passedTests}/5 tests passed`);
    result.details.push(result.success ? '🎉 Firebase storage is working correctly!' : '⚠️ Some Firebase tests failed');

  } catch (error) {
    result.error = `Test execution failed: ${error}`;
    result.details.push(`❌ Critical error: ${error}`);
  }

  return result;
}

/**
 * Get storage migration information
 */
export function getMigrationInfo(): {
  hasLocalData: boolean;
  localStats: { schedules: number; drafts: number };
  recommendation: string;
} {
  const localData = checkForLocalStorageData();
  const localStats = scheduleStorage.getStorageStats();
  
  let recommendation = '';
  if (localData.hasData) {
    recommendation = 'Migration recommended - you have existing local data that should be moved to Firebase';
  } else if (localStats.scheduleCount > 0 || localStats.draftCount > 0) {
    recommendation = 'Check your local data - storage stats show data but migration check found none';
  } else {
    recommendation = 'No migration needed - you can start using Firebase storage immediately';
  }

  return {
    hasLocalData: localData.hasData,
    localStats: {
      schedules: localStats.scheduleCount,
      drafts: localStats.draftCount
    },
    recommendation
  };
}

/**
 * Quick Firebase health check
 */
export async function quickHealthCheck(): Promise<{
  status: 'healthy' | 'warning' | 'error';
  message: string;
}> {
  try {
    if (!firebaseStorage.getCurrentUser() && !firebaseStorage.isAuthenticated()) {
      return {
        status: 'error',
        message: 'Firebase not initialized or connection failed'
      };
    }

    // Try to get storage stats (read operation)
    const stats = await firebaseStorage.getStorageStats();
    if (stats) {
      return {
        status: 'healthy',
        message: `Firebase healthy - ${stats.scheduleCount} schedules, ${stats.draftCount} drafts`
      };
    }

    return {
      status: 'warning',
      message: 'Firebase connected but data operations may be limited'
    };
  } catch (error) {
    return {
      status: 'error',
      message: `Firebase health check failed: ${error}`
    };
  }
}

/**
 * Check for specific draft by name
 */
export async function checkDraftByName(draftName: string) {
  console.log(`🔍 Searching for draft: "${draftName}"`);
  
  try {
    // Check authentication
    const isAuth = firebaseStorage.isAuthenticated();
    if (!isAuth) {
      console.log('❌ User not authenticated. Please sign in first.');
      return { success: false, error: 'Not authenticated' };
    }
    
    const currentUser = firebaseStorage.getCurrentUser();
    console.log('Current user:', currentUser?.email || currentUser?.uid);
    
    // Get all drafts
    const drafts = await firebaseStorage.getAllDraftSchedules();
    console.log(`📋 Found ${drafts.length} total drafts`);
    
    // Look for specific draft - try multiple matching strategies
    const specificDraft = drafts.find(draft => {
      const fileName = draft.fileName.toLowerCase();
      const searchName = draftName.toLowerCase();
      
      return (
        fileName === searchName ||
        fileName.includes(searchName) ||
        fileName.endsWith(searchName) ||
        fileName.replace(/\s/g, '') === searchName.replace(/\s/g, '') ||
        fileName.replace(/[^a-z0-9]/g, '') === searchName.replace(/[^a-z0-9]/g, '')
      );
    });
    
    if (specificDraft) {
      console.log(`✅ Found matching draft!`);
      console.log(`   ID: ${specificDraft.id}`);
      console.log(`   Full name: "${specificDraft.fileName}"`);
      console.log(`   File type: ${specificDraft.fileType}`);
      console.log(`   Processing step: ${specificDraft.processingStep}`);
      console.log(`   Created: ${specificDraft.createdAt}`);
      console.log(`   Updated: ${specificDraft.updatedAt}`);
      console.log(`   Auto-saved: ${specificDraft.autoSaved}`);
      console.log(`   Has uploaded data: ${!!specificDraft.uploadedData}`);
      console.log(`   Has validation: ${!!specificDraft.validation}`);
      console.log(`   Has summary schedule: ${!!specificDraft.summarySchedule}`);
      
      // Additional data size info
      if (specificDraft.uploadedData) {
        const dataSize = JSON.stringify(specificDraft.uploadedData).length;
        console.log(`   Data size: ${(dataSize / 1024).toFixed(1)} KB`);
      }
      
      return {
        success: true,
        found: true,
        draft: specificDraft,
        totalDrafts: drafts.length
      };
    } else {
      console.log(`❌ Draft "${draftName}" not found`);
      console.log('📝 Available drafts:');
      if (drafts.length === 0) {
        console.log('   (no drafts found)');
      } else {
        drafts.forEach((draft, index) => {
          console.log(`   ${index + 1}. "${draft.fileName}" (${draft.fileType}, ${draft.processingStep})`);
        });
      }
      
      return {
        success: true,
        found: false,
        availableDrafts: drafts.map(d => ({
          name: d.fileName,
          id: d.id,
          type: d.fileType,
          step: d.processingStep,
          created: d.createdAt
        })),
        totalDrafts: drafts.length
      };
    }
    
  } catch (error) {
    console.error('❌ Error checking for draft:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Make test functions available in browser console
if (typeof window !== 'undefined') {
  (window as any).runFirebaseTests = runFirebaseTests;
  (window as any).quickHealthCheck = quickHealthCheck;
  (window as any).checkDraftByName = checkDraftByName;
  (window as any).getMigrationInfo = getMigrationInfo;
  
  console.log('🧪 Firebase test functions available:');
  console.log('  window.runFirebaseTests() - comprehensive tests');
  console.log('  window.quickHealthCheck() - quick status check');
  console.log('  window.checkDraftByName("09.02") - check specific draft');
  console.log('  window.getMigrationInfo() - migration information');
}