/**
 * Optimization Engine Usage Example
 * 
 * This file demonstrates how to use the enhanced optimization engine
 * for bus schedule connection optimization.
 */

import { OptimizationEngine, optimizationEngine } from './optimizationEngine';
import { 
  ConnectionOpportunity,
  OptimizationConstraints,
  ConnectionOptimizationResult,
  OptimizationProgress
} from '../types/connectionOptimization';
import { Schedule, ConnectionType } from '../types/schedule';

// Example usage of the optimization engine
export async function exampleOptimization() {
  // Example schedule (would come from your schedule service)
  const schedule: Schedule = {
    id: 'route-101',
    name: 'Route 101',
    routeId: '101',
    routeName: 'Main Street',
    direction: 'Outbound',
    dayType: 'weekday',
    timePoints: [
      { id: 'stop1', name: 'Terminal', sequence: 1 },
      { id: 'stop2', name: 'College', sequence: 2 },
      { id: 'stop3', name: 'Downtown', sequence: 3 }
    ],
    serviceBands: [],
    trips: [], // Would contain actual trip data
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Example connection opportunities (priority 10 = highest, 1 = lowest)
  const connections: ConnectionOpportunity[] = [
    {
      id: 'college-morning',
      type: ConnectionType.SCHOOL_BELL,
      locationId: 'stop2',
      targetTime: '08:30',
      priority: 10, // Highest priority
      windowType: 'partial',
      currentConnectionTime: 12,
      affectedTrips: ['1', '2'],
      operatingDays: ['weekday'],
      metadata: {
        serviceName: 'Georgian College',
        description: 'Morning class arrival'
      }
    },
    {
      id: 'go-train-connection',
      type: ConnectionType.GO_TRAIN,
      locationId: 'stop3',
      targetTime: '09:15',
      priority: 8, // High priority
      windowType: 'missed',
      currentConnectionTime: 25,
      affectedTrips: ['2', '3'],
      operatingDays: ['weekday'],
      metadata: {
        serviceName: 'GO Train',
        description: 'Northbound train connection'
      }
    }
  ];

  // Optimization constraints
  const constraints: OptimizationConstraints = {
    maxTripDeviation: 10, // Max 10 minutes deviation from baseline
    maxScheduleShift: 15,
    minRecoveryTime: 1,
    maxRecoveryTime: 30,
    enforceHeadwayRegularity: true,
    headwayTolerance: 3,
    connectionPriorities: {
      [ConnectionType.SCHOOL_BELL]: 3,
      [ConnectionType.GO_TRAIN]: 2,
      [ConnectionType.BUS_ROUTE]: 1
    },
    allowCrossRouteBorrowing: false,
    performance: {
      maxOptimizationTimeMs: 30000, // 30 seconds max
      maxMemoryUsageMB: 50,
      earlyTerminationThreshold: 0.1 // Stop when improvement rate drops below 10%
    }
  };

  // Progress callback for monitoring
  const progressCallback = (progress: OptimizationProgress) => {
    console.log(`Optimization Progress: ${progress.progress}% - ${progress.phase}`);
    console.log(`Score: ${progress.currentScore} | Connections: ${progress.connectionsMade}`);
  };

  try {
    // Run the optimization
    console.log('Starting optimization...');
    const result: ConnectionOptimizationResult = await optimizationEngine.optimize(
      schedule,
      connections,
      constraints,
      progressCallback
    );

    // Display results
    console.log('\n=== Optimization Results ===');
    console.log(`Success: ${result.success}`);
    console.log(`Final Score: ${result.finalScore}`);
    console.log(`Score Improvement: ${result.scoreImprovement}`);
    console.log(`Connections Made: ${result.successfulConnections.length}/${connections.length}`);
    console.log(`Processing Time: ${result.statistics.optimizationTimeMs}ms`);
    console.log(`Moves Applied: ${result.statistics.totalMovesApplied}`);
    
    // Connection success rate
    console.log(`\nConnection Success Rate: ${(result.performance.connectionSuccessRate * 100).toFixed(1)}%`);
    console.log(`Average Connection Time: ${result.performance.averageConnectionTime.toFixed(1)} minutes`);
    console.log(`Headway Regularity Score: ${(result.performance.headwayRegularityScore * 100).toFixed(1)}%`);

    // Recommendations and warnings
    if (result.recommendations.length > 0) {
      console.log('\n=== Recommendations ===');
      result.recommendations.forEach(rec => console.log(`- ${rec}`));
    }

    if (result.warnings.length > 0) {
      console.log('\n=== Warnings ===');
      result.warnings.forEach(warning => console.log(`- ${warning}`));
    }

    // Failed connections
    if (result.failedConnections.length > 0) {
      console.log('\n=== Failed Connections ===');
      result.failedConnections.forEach(failed => {
        console.log(`- ${failed.opportunity.metadata.serviceName}: ${failed.reason}`);
      });
    }

    return result;

  } catch (error) {
    console.error('Optimization failed:', error);
    throw error;
  }
}

// Example of using individual methods
export function exampleIndividualMethods() {
  const schedule: Schedule = {} as Schedule; // Placeholder
  const connections: ConnectionOpportunity[] = []; // Placeholder

  // Calculate score without optimization
  const currentScore = optimizationEngine.calculateScore(schedule, connections);
  console.log(`Current schedule score: ${currentScore}`);

  // Validate constraints
  const isValid = optimizationEngine.validateConstraints(schedule);
  console.log(`Schedule meets constraints: ${isValid}`);

  // Get debug information
  const debugInfo = optimizationEngine.getDebugInfo();
  console.log('Debug Info:', debugInfo);

  // Reset engine state
  optimizationEngine.reset();
}

// Performance targets demonstration
export function performanceTargetsExample() {
  console.log('\n=== Performance Targets ===');
  console.log('< 5 seconds: Schedules under 100 trips');
  console.log('< 30 seconds: Schedules with 100-500 trips');
  console.log('Early termination: When 85% optimal score achieved');
  console.log('Constraints: Max 10 minute deviation from baseline');
  console.log('Recovery Bank: Primary mechanism (not skip stops)');
  console.log('Headway Correction: Self-correct within 2-3 trips');
}

// Functions are already exported above