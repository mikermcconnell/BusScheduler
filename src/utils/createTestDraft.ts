/**
 * Test utility to create a draft schedule programmatically
 * This simulates the full upload flow and saves to Draft Schedules
 */

import { draftService } from '../services/draftService';
import { generateTestSchedule } from '../dev/seeds';
import { ParsedCsvData } from './csvParser';
import { ValidationResult } from './validator';

export async function createTestDraft(draftName: string = 'Test Draft Schedule') {
  console.log('🚀 Creating test draft schedule:', draftName);
  
  try {
    // Generate test schedule data
    const testSchedule = generateTestSchedule(20, 5, 3); // 20 trips, 5 timepoints, 3 blocks
    
    // Convert to CSV-like format for upload simulation
    // Create time segments based on test schedule data
    const timeSegments = testSchedule.timePoints.slice(0, -1).map((tp, index) => {
      const nextTp = testSchedule.timePoints[index + 1];
      return {
        fromLocation: tp.name,
        toLocation: nextTp.name,
        timeSlot: '07:00 - 07:29', // Default time slot for test data
        percentile25: 8,
        percentile50: 10,
        percentile80: 12,
        percentile90: 15
      };
    });

    const csvData: ParsedCsvData = {
      segments: timeSegments,
      timePoints: testSchedule.timePoints.map(tp => tp.name),
      validationSummary: {
        totalSegments: timeSegments.length,
        validSegments: timeSegments.length,
        invalidSegments: 0,
        timeSlots: 1
      }
    };
    
    // Create validation result (simulating successful validation)
    const validation: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      statistics: {
        totalTimePoints: testSchedule.timePoints.length,
        totalTravelTimes: timeSegments.length,
        averageTravelTime: 10,
        minTravelTime: 8,
        maxTravelTime: 15,
        missingConnections: 0,
        duplicateConnections: 0,
        dayTypeCoverage: {
          weekday: 100,
          saturday: 0,
          sunday: 0
        }
      }
    };
    
    // Create the draft using unified service
    const result = await draftService.createDraft(
      draftName,
      `${draftName}.csv`,
      'csv',
      csvData,
      validation
    );
    
    if (result.success) {
      console.log('✅ Draft created successfully!');
      console.log('   Draft ID:', result.draftId);
      console.log('   Draft Name:', draftName);
      
      // Update the draft to show some progress
      if (result.draftId) {
        await draftService.updateDraftStep(
          result.draftId,
          'timepoints',
          30,
          {
            timepoints: {
              serviceBands: testSchedule.serviceBands,
              travelTimeData: [],
              outliers: []
            }
          }
        );
        console.log('   Progress updated to: TimePoints step (30%)');
      }
      
      // Get and display the created draft
      const createdDraft = await draftService.getDraft(result.draftId!);
      if (createdDraft) {
        console.log('📋 Draft Details:');
        console.log('   Current Step:', createdDraft.currentStep);
        console.log('   Progress:', createdDraft.progress + '%');
        console.log('   Created At:', createdDraft.metadata.createdAt);
        console.log('');
        console.log('🎯 To view this draft:');
        console.log('   1. Navigate to Draft Schedules page');
        console.log('   2. Look for "' + draftName + '" in the list');
        console.log('   3. Click on it to continue working');
      }
      
      return createdDraft;
    } else {
      console.error('❌ Failed to create draft:', result.error);
      return null;
    }
    
  } catch (error) {
    console.error('❌ Error creating test draft:', error);
    throw error;
  }
}

// Create multiple test drafts with different names
export async function createMultipleTestDrafts() {
  const testNames = [
    'Morning Route Schedule',
    'Test Route 12',
    'Weekend Service Plan',
    'Express Route Draft',
    'Holiday Schedule WIP'
  ];
  
  console.log('📦 Creating multiple test drafts...\n');
  
  for (const name of testNames) {
    await createTestDraft(name);
    console.log('-------------------\n');
    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('✨ All test drafts created!');
  console.log('🔄 Refresh the Draft Schedules page to see them');
}

// Make available in browser console
if (process.env.NODE_ENV === 'development') {
  (window as any).createTestDraft = createTestDraft;
  (window as any).createMultipleTestDrafts = createMultipleTestDrafts;
  console.log('🧪 Test functions available:');
  console.log('  window.createTestDraft("My Test Draft")');
  console.log('  window.createMultipleTestDrafts()');
}