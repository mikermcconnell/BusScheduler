/**
 * Test utility to verify unified storage system
 * Run in browser console to test migration and draft loading
 */

import { unifiedDraftService } from '../services/unifiedDraftService';

export async function testUnifiedStorage() {
  console.log('🧪 Testing Unified Draft Storage System...');
  
  try {
    // Test migration
    console.log('🔄 Running migration from old storage systems...');
    const migrationResult = await unifiedDraftService.migrateFromOldSystems();
    
    console.log('📊 Migration Results:');
    console.log(`  ✅ Successfully migrated: ${migrationResult.migrated} drafts`);
    console.log(`  ❌ Failed migrations: ${migrationResult.failed} drafts`);
    console.log('  📝 Details:', migrationResult.details);
    
    // Test loading all drafts
    console.log('📂 Loading all drafts...');
    const allDrafts = unifiedDraftService.getAllDrafts();
    
    console.log(`📋 Found ${allDrafts.length} drafts in unified storage:`);
    allDrafts.forEach((draft, index) => {
      console.log(`  ${index + 1}. "${draft.draftName}" (${draft.draftId})`);
      console.log(`     Step: ${draft.currentStep} | Progress: ${draft.progress}%`);
      console.log(`     Created: ${draft.metadata.createdAt}`);
    });
    
    // Look for "test 12" specifically
    const test12 = allDrafts.find(d => d.draftName.toLowerCase().includes('test 12') || d.draftName === 'test 12');
    
    if (test12) {
      console.log('🎯 Found "test 12" draft!');
      console.log('   Draft Details:', test12);
    } else {
      console.log('❌ "test 12" draft not found in unified storage');
      console.log('   Available draft names:', allDrafts.map(d => d.draftName));
    }
    
    // Test cleanup
    console.log('🧹 Cleaning up old storage systems...');
    unifiedDraftService.cleanupOldStorage();
    
    console.log('✅ Unified storage test completed successfully!');
    
    return {
      migrationResult,
      totalDrafts: allDrafts.length,
      test12Found: !!test12,
      drafts: allDrafts.map(d => ({ name: d.draftName, id: d.draftId, step: d.currentStep }))
    };
    
  } catch (error) {
    console.error('❌ Unified storage test failed:', error);
    throw error;
  }
}

// Make available in browser console during development
if (process.env.NODE_ENV === 'development') {
  (window as any).testUnifiedStorage = testUnifiedStorage;
  console.log('🔧 Test function available: window.testUnifiedStorage()');
}