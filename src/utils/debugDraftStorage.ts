/**
 * Debug utility to inspect and fix draft storage issues
 */

export function debugDraftStorage() {
  console.log('🔍 Debugging Draft Storage...\n');
  
  // Check all storage keys
  console.log('📦 All localStorage keys:');
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.includes('draft') || key.includes('schedule'))) {
      const value = localStorage.getItem(key);
      console.log(`  ${key}: ${value?.substring(0, 100)}...`);
    }
  }
  
  // Check unified drafts
  const unifiedKey = 'scheduler2_unified_drafts_v2';
  const unifiedDrafts = localStorage.getItem(unifiedKey);
  
  if (unifiedDrafts) {
    try {
      const drafts = JSON.parse(unifiedDrafts);
      console.log(`\n✅ Found ${drafts.length} drafts in unified storage:`);
      drafts.forEach((draft: any, i: number) => {
        console.log(`  ${i + 1}. "${draft.draftName}" (ID: ${draft.draftId})`);
      });
    } catch (error) {
      console.error('❌ Error parsing unified drafts:', error);
    }
  } else {
    console.log('\n❌ No unified drafts found!');
  }
  
  // Check old draft storage
  const oldDraftKey = 'scheduler2_draft_schedules';
  const oldDrafts = localStorage.getItem(oldDraftKey);
  
  if (oldDrafts) {
    try {
      const drafts = JSON.parse(oldDrafts);
      console.log(`\n📚 Found ${drafts.length} drafts in OLD storage:`);
      drafts.forEach((draft: any, i: number) => {
        console.log(`  ${i + 1}. "${draft.fileName}" (ID: ${draft.id})`);
      });
    } catch (error) {
      console.error('❌ Error parsing old drafts:', error);
    }
  }
  
  return {
    unifiedDrafts: unifiedDrafts ? JSON.parse(unifiedDrafts) : [],
    oldDrafts: oldDrafts ? JSON.parse(oldDrafts) : [],
    allKeys: Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
  };
}

export function forceCreateTestDraft(name: string = 'Test 12') {
  console.log(`\n💪 Force creating draft: "${name}"`);
  
  const now = new Date().toISOString();
  const draftId = `draft_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  
  const testDraft = {
    draftId,
    draftName: name,
    originalData: {
      fileName: `${name}.csv`,
      fileType: 'csv' as const,
      uploadedData: {
        headers: ['Trip', 'Block', 'Time', 'Stop1', 'Stop2', 'Stop3'],
        rows: [
          [1, 1, '07:00', '07:05', '07:10', '07:15'],
          [2, 1, '07:30', '07:35', '07:40', '07:45'],
          [3, 2, '08:00', '08:05', '08:10', '08:15']
        ],
        rawData: []
      },
      validation: {
        isValid: true,
        errors: [],
        warnings: [],
        suggestions: []
      },
      uploadTimestamp: now
    },
    currentStep: 'timepoints' as const,
    progress: 30,
    stepData: {},
    ui: {
      celebrationsShown: [],
      lastViewedStep: 'timepoints'
    },
    metadata: {
      createdAt: now,
      lastModifiedAt: now,
      version: 1,
      isPublished: false
    }
  };
  
  // Get existing drafts or create new array
  const unifiedKey = 'scheduler2_unified_drafts_v2';
  let existingDrafts = [];
  
  try {
    const stored = localStorage.getItem(unifiedKey);
    if (stored) {
      existingDrafts = JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error reading existing drafts:', error);
  }
  
  // Add new draft
  existingDrafts.push(testDraft);
  
  // Save back to storage
  try {
    localStorage.setItem(unifiedKey, JSON.stringify(existingDrafts));
    console.log(`✅ Draft "${name}" created successfully!`);
    console.log(`   Draft ID: ${draftId}`);
    console.log(`   Total drafts now: ${existingDrafts.length}`);
    console.log(`\n🔄 Refresh the page to see the new draft!`);
    
    return testDraft;
  } catch (error) {
    console.error('❌ Error saving draft:', error);
    return null;
  }
}

export function clearAllDrafts() {
  const confirmed = window.confirm('Are you sure you want to clear ALL drafts?');
  if (!confirmed) return;
  
  localStorage.removeItem('scheduler2_unified_drafts_v2');
  localStorage.removeItem('scheduler2_draft_schedules');
  localStorage.removeItem('workflow_drafts');
  
  console.log('🗑️ All drafts cleared!');
}

// Make available in browser console
if (process.env.NODE_ENV === 'development') {
  (window as any).debugDraftStorage = debugDraftStorage;
  (window as any).forceCreateTestDraft = forceCreateTestDraft;
  (window as any).clearAllDrafts = clearAllDrafts;
  
  console.log('🐛 Debug functions available:');
  console.log('  window.debugDraftStorage() - Inspect storage');
  console.log('  window.forceCreateTestDraft("Test 12") - Force create draft');
  console.log('  window.clearAllDrafts() - Clear all drafts');
}