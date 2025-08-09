/**
 * Example Workflow Integration
 * Demonstrates how to use the Scheduler2 system end-to-end
 */

import { scheduleService } from '../services/scheduleService';
import { TimePoint, TravelTime } from '../types/schedule';
import { TimeBand } from '../utils/calculator';

/**
 * Example function showing complete workflow from data to schedule
 */
export const demonstrateCompleteWorkflow = async () => {
  // Example time points for a simple route
  const timePoints: TimePoint[] = [
    { id: 'tp_1', name: 'Downtown Terminal', sequence: 1 },
    { id: 'tp_2', name: 'Main Street & 5th', sequence: 2 },
    { id: 'tp_3', name: 'Shopping Plaza', sequence: 3 },
    { id: 'tp_4', name: 'University Campus', sequence: 4 },
    { id: 'tp_5', name: 'Hospital Complex', sequence: 5 }
  ];

  // Example travel times between consecutive stops
  const travelTimes: TravelTime[] = [
    { fromTimePoint: 'tp_1', toTimePoint: 'tp_2', weekday: 8, saturday: 8, sunday: 10 },
    { fromTimePoint: 'tp_2', toTimePoint: 'tp_3', weekday: 12, saturday: 12, sunday: 15 },
    { fromTimePoint: 'tp_3', toTimePoint: 'tp_4', weekday: 15, saturday: 15, sunday: 18 },
    { fromTimePoint: 'tp_4', toTimePoint: 'tp_5', weekday: 10, saturday: 10, sunday: 12 }
  ];

  // Example time bands defining service frequency
  const timeBands = {
    weekday: [
      { startTime: '06:00', endTime: '09:00', frequency: 15 }, // Peak morning
      { startTime: '09:00', endTime: '15:00', frequency: 30 }, // Mid-day
      { startTime: '15:00', endTime: '18:00', frequency: 15 }, // Peak evening
      { startTime: '18:00', endTime: '22:00', frequency: 30 }  // Evening
    ] as TimeBand[],
    saturday: [
      { startTime: '07:00', endTime: '22:00', frequency: 30 }
    ] as TimeBand[],
    sunday: [
      { startTime: '08:00', endTime: '21:00', frequency: 45 }
    ] as TimeBand[]
  };

  try {
    console.log('🚌 Starting schedule generation workflow...');
    
    // Generate complete summary schedule
    const summarySchedule = await scheduleService.generateSummarySchedule(
      timePoints,
      travelTimes,
      {
        routeId: 'DEMO_ROUTE_001',
        routeName: 'Downtown University Express',
        direction: 'Outbound',
        effectiveDate: new Date(),
        timeBands
      }
    );

    console.log('✅ Schedule generation completed successfully!');
    console.log(`📊 Generated ${summarySchedule.metadata.weekdayTrips} weekday trips`);
    console.log(`📊 Generated ${summarySchedule.metadata.saturdayTrips} Saturday trips`);
    console.log(`📊 Generated ${summarySchedule.metadata.sundayTrips} Sunday trips`);

    // Get calculation results for detailed analysis
    const calculationResults = scheduleService.getLastCalculationResults();
    if (calculationResults) {
      console.log(`⏱️  Processing time: ${calculationResults.metadata.calculationTime}ms`);
      console.log(`🎯 Total trips generated: ${calculationResults.metadata.totalTrips}`);
    }

    return {
      success: true,
      summarySchedule,
      calculationResults
    };

  } catch (error) {
    console.error('❌ Workflow failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Example function to validate data before processing
 */
export const validateExampleData = () => {
  const timePoints: TimePoint[] = [
    { id: 'tp_1', name: 'Start Point', sequence: 1 },
    { id: 'tp_2', name: 'End Point', sequence: 2 }
  ];

  const travelTimes: TravelTime[] = [
    { fromTimePoint: 'tp_1', toTimePoint: 'tp_2', weekday: 10, saturday: 12, sunday: 15 }
  ];

  const validation = scheduleService.validateScheduleData(timePoints, travelTimes);
  
  console.log(`✅ Validation result: ${validation.isValid ? 'PASSED' : 'FAILED'}`);
  if (validation.errors.length > 0) {
    console.log('❌ Errors:', validation.errors);
  }
  if (validation.warnings.length > 0) {
    console.log('⚠️  Warnings:', validation.warnings);
  }

  return validation;
};