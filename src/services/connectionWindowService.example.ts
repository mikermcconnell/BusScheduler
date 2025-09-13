/**
 * Connection Window Service Usage Examples
 * Demonstrates how to use the enhanced ConnectionWindowService
 */

import { ConnectionType } from '../types/schedule';
import { connectionWindowService } from './connectionWindowService';

/**
 * Example: Calculate connection window for Georgian College
 */
export function exampleGeorgianCollegeConnection() {
  console.log('=== Georgian College Connection Example ===');
  
  // Scenario: Bus arrives at 8:47 AM, class starts at 9:00 AM
  const result = connectionWindowService.calculateConnectionWindow(
    '08:47', // Bus arrival time
    '09:00', // Class start time  
    ConnectionType.SCHOOL_BELL,
    'arrival',
    8 // High priority
  );
  
  console.log('Bus Time:', result.details.busTime);
  console.log('Class Time:', result.details.connectionTime);
  console.log('Time Gap:', result.timeGapMinutes, 'minutes');
  console.log('Classification:', result.classification);
  console.log('Score:', result.score.toFixed(2));
  console.log('Satisfied:', result.isSatisfied);
  
  if (result.recommendedAdjustment) {
    console.log('Recommended Adjustment:', result.recommendedAdjustment, 'minutes');
  }
  
  return result;
}

/**
 * Example: Calculate connection window for GO Train
 */
export function exampleGOTrainConnection() {
  console.log('\n=== GO Train Connection Example ===');
  
  // Scenario: Bus arrives at 7:05 AM, GO Train departs at 7:20 AM  
  const result = connectionWindowService.calculateConnectionWindow(
    '07:05', // Bus arrival time
    '07:20', // Train departure time
    ConnectionType.GO_TRAIN,
    'arrival',
    9 // Very high priority
  );
  
  console.log('Bus Time:', result.details.busTime);
  console.log('Train Time:', result.details.connectionTime);
  console.log('Time Gap:', result.timeGapMinutes, 'minutes');
  console.log('Classification:', result.classification);
  console.log('Score:', result.score.toFixed(2));
  console.log('Satisfied:', result.isSatisfied);
  
  if (result.recommendedAdjustment) {
    console.log('Recommended Adjustment:', result.recommendedAdjustment, 'minutes');
  }
  
  return result;
}

/**
 * Example: High School departure connection
 */
export function exampleHighSchoolConnection() {
  console.log('\n=== High School Connection Example ===');
  
  // Scenario: School ends at 3:15 PM, bus departs at 3:25 PM
  const result = connectionWindowService.calculateConnectionWindow(
    '15:25', // Bus departure time
    '15:15', // School end time
    ConnectionType.SCHOOL_BELL,
    'departure',
    7 // High priority
  );
  
  console.log('School End:', result.details.connectionTime);
  console.log('Bus Departure:', result.details.busTime);
  console.log('Time Gap:', result.timeGapMinutes, 'minutes');
  console.log('Classification:', result.classification);
  console.log('Score:', result.score.toFixed(2));
  console.log('Satisfied:', result.isSatisfied);
  
  if (result.recommendedAdjustment) {
    console.log('Recommended Adjustment:', result.recommendedAdjustment, 'minutes');
  }
  
  return result;
}

/**
 * Example: Edge case with midnight wraparound
 */
export function exampleMidnightWraparound() {
  console.log('\n=== Midnight Wraparound Example ===');
  
  // Scenario: Late bus at 23:50, early connection at 00:10 (next day)
  const result = connectionWindowService.calculateConnectionWindow(
    '23:50', // Bus time (late night)
    '00:10', // Connection time (next day)
    ConnectionType.BUS_ROUTE,
    'arrival',
    5 // Medium priority
  );
  
  console.log('Bus Time:', result.details.busTime);
  console.log('Connection Time:', result.details.connectionTime);
  console.log('Time Gap:', result.timeGapMinutes, 'minutes');
  console.log('Classification:', result.classification);
  console.log('Score:', result.score.toFixed(2));
  console.log('Satisfied:', result.isSatisfied);
  
  return result;
}

/**
 * Example: Bulk analysis of multiple connections
 */
export function exampleBulkAnalysis() {
  console.log('\n=== Bulk Connection Analysis Example ===');
  
  // Mock schedule with some trips
  const mockSchedule = {
    id: 'test-schedule',
    name: 'Test Route',
    routeId: 'TR-101',
    routeName: 'Test Route 101',
    direction: 'Inbound',
    dayType: 'weekday',
    timePoints: [
      { id: 'stop1', name: 'Downtown Terminal', sequence: 1 },
      { id: 'stop2', name: 'Georgian College', sequence: 2 },
      { id: 'stop3', name: 'GO Station', sequence: 3 }
    ],
    serviceBands: [],
    trips: [
      {
        tripNumber: 1,
        blockNumber: 1,
        departureTime: '08:00',
        serviceBand: 'Standard',
        arrivalTimes: {
          'stop1': '08:00',
          'stop2': '08:45',
          'stop3': '09:10'
        },
        departureTimes: {
          'stop1': '08:00',
          'stop2': '08:47',
          'stop3': '09:12'
        },
        recoveryTimes: {
          'stop1': 0,
          'stop2': 2,
          'stop3': 2
        },
        recoveryMinutes: 4
      },
      {
        tripNumber: 2,
        blockNumber: 1,
        departureTime: '09:30',
        serviceBand: 'Standard',
        arrivalTimes: {
          'stop1': '09:30',
          'stop2': '10:15',
          'stop3': '10:40'
        },
        departureTimes: {
          'stop1': '09:30',
          'stop2': '10:17',
          'stop3': '10:42'
        },
        recoveryTimes: {
          'stop1': 0,
          'stop2': 2,
          'stop3': 2
        },
        recoveryMinutes: 4
      }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  // Define connection requirements
  const connections = [
    {
      locationId: 'stop2',
      connectionTime: '09:00',
      connectionType: ConnectionType.SCHOOL_BELL,
      scenario: 'arrival' as const,
      priority: 8
    },
    {
      locationId: 'stop3',
      connectionTime: '09:25',
      connectionType: ConnectionType.GO_TRAIN,
      scenario: 'arrival' as const,
      priority: 9
    },
    {
      locationId: 'stop2',
      connectionTime: '10:30',
      connectionType: ConnectionType.SCHOOL_BELL,
      scenario: 'arrival' as const,
      priority: 7
    }
  ];
  
  // Perform bulk analysis
  const analysis = connectionWindowService.analyzeAllConnections(mockSchedule, connections);
  
  console.log('Success Rate:', (analysis.successRate * 100).toFixed(1) + '%');
  console.log('Average Score:', analysis.averageScore.toFixed(2));
  console.log('Total Connections Analyzed:', analysis.connections.length);
  
  console.log('\nConnection Results:');
  analysis.connections.forEach((conn, index) => {
    console.log(`  ${index + 1}. ${conn.details.busTime} → ${conn.details.connectionTime} (${conn.classification}, score: ${conn.score.toFixed(2)})`);
  });
  
  console.log('\nRecommendations:');
  analysis.recommendations.forEach((rec, index) => {
    console.log(`  ${index + 1}. ${rec}`);
  });
  
  return analysis;
}

/**
 * Run all examples
 */
export function runAllExamples() {
  console.log('🚌 Connection Window Service Examples\n');
  
  exampleGeorgianCollegeConnection();
  exampleGOTrainConnection();
  exampleHighSchoolConnection();
  exampleMidnightWraparound();
  exampleBulkAnalysis();
  
  console.log('\n✅ All examples completed successfully!');
}