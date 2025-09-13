# Bus Schedule Connection Optimization System

## Overview

The Connection Optimization System is a sophisticated algorithm designed to optimize bus schedules for better connections with other transit services, schools, and important destinations. It implements a Recovery Bank System that allows borrowing and lending of recovery time between stops to improve connection opportunities while maintaining schedule reliability.

## Architecture

### Core Components

1. **Recovery Bank System** (`RecoveryBankService`)
   - Manages borrowing and lending of recovery time between stops
   - Calculates flexibility scores based on stop types
   - Tracks transactions and maintains balance

2. **Connection Window Service** (`ConnectionWindowService`)
   - Calculates connection opportunities for different service types
   - Handles Georgian College, GO Train, and High School connections
   - Determines ideal, partial, and missed connection windows

3. **Optimization Engine** (`OptimizationEngine`)
   - Core algorithm for finding optimal schedule adjustments
   - Uses priority-based search with constraint solving
   - Implements backtracking for complex optimization scenarios

4. **Headway Correction Service** (`HeadwayCorrectionService`)
   - Applies self-correction to maintain headway regularity
   - Implements multiple correction strategies (exponential smoothing, linear interpolation, etc.)
   - Ensures schedule stability over time

5. **Connection Optimization Service** (`ConnectionOptimizationService`)
   - Main orchestration service
   - Handles performance monitoring and caching
   - Provides comprehensive error handling and validation

### Algorithm Flow

```
Input Schedule → Opportunity Analysis → Recovery Bank Setup
     ↓                 ↓                      ↓
Connection Windows → Optimization Engine → Constraint Validation
     ↓                 ↓                      ↓  
Score Calculation → Apply Moves → Headway Correction → Optimized Schedule
```

## Key Features

### Recovery Bank System
- **Flexibility-Based Lending**: Terminals and malls can lend more recovery time than schools or hospitals
- **Transaction Tracking**: All recovery transfers are logged and can be rolled back
- **Balance Management**: Prevents over-borrowing and maintains minimum recovery times
- **Smart Allocation**: Finds optimal recovery distribution using flow network algorithms

### Connection Window Types
- **Georgian College**: Classes on hour, end at :50 (10-15 min ideal connection window)
- **GO Trains**: 10-15 min ideal, 5-10 min partial, >15 min missed
- **High Schools**: 10-15 min before bell (morning arrival priority)

### Optimization Scoring
```typescript
Score = Priority (1-10) × Window Multiplier × Route Frequency Factor
```
- **Window Multipliers**: Ideal=1.0, Partial=0.5, Missed=0.0
- **Priority**: User-defined importance (1=low, 10=critical)
- **Frequency Factor**: Higher frequency routes get slightly lower priority

### Headway Self-Correction
- **Exponential Smoothing**: Gradual correction over 2-3 trips
- **Correction Formula**: `new_time = current_time + α × (target_time - current_time)`
- **Default α = 0.5**: 50% correction per trip
- **Constraint Respect**: Never exceeds maximum deviation limits

## Usage Examples

### Basic Optimization

```typescript
import { connectionOptimizationService } from '../services/connectionOptimizationService';
import { ConnectionType } from '../types/schedule';

// Configure service for Georgian College
connectionOptimizationService.configureGeorgianCollege({
  classStartTimes: ['08:00', '09:00', '10:00', '11:00'],
  classEndTimes: ['08:50', '09:50', '10:50', '11:50'],
  campusStops: ['georgian_main', 'georgian_north'],
  semesterSchedule: {
    startDate: new Date('2024-09-01'),
    endDate: new Date('2024-12-20'),
    operatingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    specialDates: []
  },
  classPriorities: new Map([
    ['08:00', 9], // High priority for 8 AM classes
    ['09:00', 8],
    ['10:00', 6],
    ['11:00', 5]
  ])
});

// Create optimization request
const optimizationRequest = {
  schedule: mySchedule,
  connectionOpportunities: [
    {
      id: 'georgian_morning',
      type: ConnectionType.SCHOOL_BELL,
      locationId: 'georgian_main',
      targetTime: '08:00',
      priority: 9,
      windowType: 'missed', // Current connection status
      affectedTrips: ['101', '102', '103'],
      operatingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      metadata: {
        serviceName: 'Georgian College',
        description: 'Morning class arrival at 8:00 AM'
      }
    }
  ],
  connectionWindows: new Map([
    [ConnectionType.SCHOOL_BELL, {
      type: ConnectionType.SCHOOL_BELL,
      ideal: { min: 10, max: 15 },
      partial: { min: 5, max: 20 },
      multipliers: { ideal: 1.0, partial: 0.5, missed: 0.0 }
    }]
  ]),
  constraints: {
    maxTripDeviation: 10, // Maximum 10 minutes adjustment
    maxScheduleShift: 30,
    minRecoveryTime: 1,
    maxRecoveryTime: 15,
    enforceHeadwayRegularity: true,
    headwayTolerance: 3,
    connectionPriorities: {
      [ConnectionType.BUS_ROUTE]: 0.7,
      [ConnectionType.GO_TRAIN]: 1.0,
      [ConnectionType.SCHOOL_BELL]: 0.9
    },
    allowCrossRouteBorrowing: false,
    performance: {
      maxOptimizationTimeMs: 60000, // 1 minute
      maxMemoryUsageMB: 256,
      earlyTerminationThreshold: 0.01
    }
  },
  recoveryBankConfig: {
    stopConfigurations: [
      {
        stopId: 'downtown_terminal',
        stopType: 'terminal',
        flexibilityScore: 0.9,
        maxCredit: 8
      },
      {
        stopId: 'georgian_main',
        stopType: 'school',
        flexibilityScore: 0.2,
        maxCredit: 1
      }
    ],
    allowBorrowing: true,
    maxBorrowingRatio: 0.8
  },
  headwayCorrection: {
    strategyId: 'exponential_smoothing',
    targetHeadway: 30, // 30 minute headway
    maxDeviationThreshold: 5,
    correctionHorizon: 3,
    correctionStrength: 0.5,
    correctionDirection: 'forward'
  },
  options: {
    maxIterations: 1000,
    convergenceThreshold: 0.001,
    enableProgressiveOptimization: true,
    enableParallelProcessing: false
  }
};

// Run optimization with progress callback
const result = await connectionOptimizationService.optimizeScheduleConnections(
  optimizationRequest,
  (progress) => {
    console.log(`${progress.phase}: ${progress.progress.toFixed(1)}% complete`);
    console.log(`Score: ${progress.currentScore}, Connections: ${progress.connectionsMade}`);
  }
);

if (result.success) {
  console.log(`Optimization completed successfully!`);
  console.log(`Final score: ${result.finalScore}`);
  console.log(`Connections made: ${result.successfulConnections.length}`);
  console.log(`Score improvement: ${result.scoreImprovement}`);
  
  // Apply optimized schedule
  mySchedule = result.optimizedSchedule;
} else {
  console.error(`Optimization failed: ${result.error}`);
  console.log(`Recommendations: ${result.recommendations.join(', ')}`);
}
```

### GO Train Integration

```typescript
// Configure GO Train connections
connectionOptimizationService.configureGOTrain({
  trainSchedules: [
    {
      direction: 'northbound',
      stationId: 'barrie_south',
      departureTimes: ['07:15', '08:45', '12:15', '17:30'],
      arrivalTimes: ['07:13', '08:43', '12:13', '17:28'],
      serviceType: 'local',
      operatingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
    }
  ],
  stationStops: [
    {
      stationId: 'barrie_south',
      busStopId: 'go_station_platform',
      walkingTime: 5, // 5 minutes from bus stop to platform
      platformCapacity: 200
    }
  ],
  seasonalSchedules: []
});

// Create GO Train connection opportunities
const goTrainOpportunities = [
  {
    id: 'go_train_morning',
    type: ConnectionType.GO_TRAIN,
    locationId: 'go_station_platform',
    targetTime: '07:15', // Train departure
    priority: 8,
    windowType: 'missed',
    affectedTrips: ['201', '202'],
    operatingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    metadata: {
      serviceName: 'GO Train Northbound',
      description: 'Board train at 7:15 AM'
    }
  }
];
```

### High School Connections

```typescript
// Configure high school connections
connectionOptimizationService.configureHighSchool({
  schools: [
    {
      schoolId: 'barrie_north_collegiate',
      schoolName: 'Barrie North Collegiate',
      busStopIds: ['school_main_entrance', 'school_back_lot'],
      bellSchedule: {
        startTime: '08:15',
        endTime: '14:45',
        lunchStart: '12:00',
        lunchEnd: '12:45'
      },
      studentCapacity: 1200,
      priorityLevel: 7
    }
  ],
  specialSchedules: [
    {
      date: new Date('2024-12-20'),
      scheduleType: 'early_dismissal',
      alternateSchedule: {
        startTime: '08:15',
        endTime: '11:30'
      }
    }
  ],
  transportationRequirements: {
    maxWaitTime: 15,
    minConnectionTime: 5,
    capacityConstraints: true
  }
});
```

### Advanced Recovery Bank Configuration

```typescript
// Custom recovery bank setup for complex route
const recoveryBankConfig = {
  stopConfigurations: [
    {
      stopId: 'downtown_terminal',
      stopName: 'Downtown Terminal',
      stopType: 'terminal' as const,
      maxCredit: 12, // Can lend up to 12 minutes
      minRecoveryTime: 3, // Must maintain at least 3 minutes
      maxRecoveryTime: 20, // Cannot exceed 20 minutes total
      flexibilityScore: 0.95 // Very flexible
    },
    {
      stopId: 'hospital_main',
      stopName: 'Royal Victoria Hospital',
      stopType: 'hospital' as const,
      maxCredit: 2, // Limited lending capacity
      minRecoveryTime: 2,
      maxRecoveryTime: 6,
      flexibilityScore: 0.3 // Low flexibility - time-sensitive
    },
    {
      stopId: 'bayfield_mall',
      stopName: 'Bayfield Mall',
      stopType: 'mall' as const,
      maxCredit: 8,
      minRecoveryTime: 1,
      maxRecoveryTime: 12,
      flexibilityScore: 0.8 // High commercial flexibility
    }
  ],
  allowBorrowing: true,
  maxBorrowingRatio: 0.75 // Conservative borrowing limit
};

// Request specific recovery allocation
const recoveryRequests = [
  {
    toStopId: 'georgian_main',
    amount: 5, // Need 5 minutes extra recovery
    priority: 9,
    affectedTrips: ['101', '102']
  },
  {
    fromStopId: 'downtown_terminal', // Specific lender
    toStopId: 'go_station_platform',
    amount: 3,
    priority: 8,
    affectedTrips: ['201']
  }
];

// Find optimal allocation
const allocation = recoveryBankService.findOptimalAllocation(recoveryRequests);
console.log(`Allocation success: ${allocation.success}`);
console.log(`Total score: ${allocation.totalScore}`);
allocation.allocations.forEach(txn => {
  console.log(`${txn.lenderStopId} → ${txn.borrowerStopId}: ${txn.amount}min (score: ${txn.score})`);
});
```

### Performance Monitoring

```typescript
// Monitor optimization performance
const result = await connectionOptimizationService.optimizeScheduleConnections(
  optimizationRequest,
  (progress) => {
    // Real-time progress monitoring
    console.log({
      phase: progress.phase,
      progress: `${progress.progress.toFixed(1)}%`,
      memory: `${progress.memoryUsageMB.toFixed(1)}MB`,
      timeRemaining: `${Math.round(progress.estimatedTimeRemainingMs / 1000)}s`,
      currentScore: progress.currentScore,
      bestScore: progress.bestScore,
      connectionsMade: progress.connectionsMade
    });
    
    // Performance warning
    if (progress.memoryUsageMB > 200) {
      console.warn('High memory usage detected');
    }
  }
);

// Generate comprehensive report
const report = connectionOptimizationService.generateOptimizationReport(
  result.optimizationId,
  originalSchedule
);

console.log('Optimization Report:', {
  summary: report.requestSummary,
  improvement: report.comparison.improvement,
  recommendations: report.recommendations
});
```

### Error Handling and Validation

```typescript
import { optimizationValidator, optimizationSanitizer } from '../utils/optimizationValidation';

// Validate request before optimization
const validation = optimizationValidator.validateOptimizationRequest(optimizationRequest);

if (!validation.isValid) {
  console.error('Validation failed:');
  validation.errors.forEach(error => console.error(`  Error: ${error}`));
  validation.criticalIssues.forEach(issue => console.error(`  Critical: ${issue}`));
  return;
}

// Display warnings and suggestions
validation.warnings.forEach(warning => console.warn(`  Warning: ${warning}`));
validation.suggestions.forEach(suggestion => console.info(`  Suggestion: ${suggestion}`));

// Security validation
const security = optimizationValidator.validateSecurity(optimizationRequest);
if (!security.isSafe) {
  console.error('Security issues detected:');
  security.securityIssues.forEach(issue => console.error(`  Security: ${issue}`));
  return;
}

// Performance validation
const performance = optimizationValidator.validatePerformance(optimizationRequest);
console.log(`Estimated complexity: ${performance.estimatedComplexity}`);

if (!performance.isOptimal) {
  console.warn('Performance issues detected:');
  performance.performanceIssues.forEach(issue => console.warn(`  Performance: ${issue}`));
  performance.recommendations.forEach(rec => console.info(`  Recommendation: ${rec}`));
}

// Sanitize input if needed
const sanitizedRequest = optimizationSanitizer.sanitizeRequest(optimizationRequest);
```

## Best Practices

### 1. Connection Prioritization
- Use priority 9-10 for critical connections (GO Trains, major classes)
- Use priority 6-8 for important connections (regular classes, popular destinations)
- Use priority 1-5 for convenience connections (malls, optional services)

### 2. Recovery Bank Management
- Set terminals and major stops as primary lenders
- Limit borrowing for time-sensitive stops (hospitals, schools)
- Monitor utilization rates to prevent over-borrowing

### 3. Performance Optimization
- Filter connections to most important ones for large schedules
- Enable progressive optimization for complex scenarios
- Use caching for repeated optimizations of similar schedules

### 4. Constraint Configuration
- Start with conservative constraints and gradually relax
- Monitor headway regularity impact when allowing larger deviations
- Balance connection success rate with schedule reliability

### 5. Error Handling
- Always validate inputs before optimization
- Implement progress monitoring for user feedback
- Plan for graceful degradation when optimization fails

## Troubleshooting

### Common Issues

**Low Connection Success Rate**
- Check if constraints are too restrictive
- Verify recovery time availability
- Consider increasing maximum trip deviation

**High Memory Usage**
- Reduce number of connection opportunities
- Enable early termination
- Split large schedules into smaller batches

**Poor Headway Regularity**
- Adjust correction strength parameters
- Increase correction horizon
- Review base schedule timing patterns

**Optimization Timeout**
- Increase time limits or enable early termination
- Reduce complexity by filtering connections
- Use progressive optimization for large datasets

### Performance Benchmarks
- **Small schedules** (<100 trips): <5 seconds
- **Medium schedules** (100-500 trips): <30 seconds
- **Large schedules** (500+ trips): <2 minutes
- **Memory usage**: <256MB for typical optimizations

## API Reference

### Main Service Methods

```typescript
class ConnectionOptimizationService {
  // Configuration
  configureGeorgianCollege(config: GeorgianCollegeConfig): void
  configureGOTrain(config: GOTrainConfig): void
  configureHighSchool(config: HighSchoolConfig): void
  setConnectionWindows(windows: Map<ConnectionType, ConnectionWindow>): void
  
  // Core optimization
  optimizeScheduleConnections(
    request: ConnectionOptimizationRequest,
    progressCallback?: (progress: OptimizationProgress) => void
  ): Promise<ConnectionOptimizationResult>
  
  // Reporting and management
  generateOptimizationReport(optimizationId: string, originalSchedule: Schedule): OptimizationReport | null
  getOptimizationHistory(): Map<string, ConnectionOptimizationResult>
  cancelOptimization(): boolean
  clearHistory(): void
  
  // Status
  isOptimizationInProgress(): boolean
  getCurrentOptimizationId(): string | null
}
```

### Key Interfaces

See `src/types/connectionOptimization.ts` for complete type definitions including:
- `ConnectionOptimizationRequest`
- `ConnectionOptimizationResult`
- `ConnectionOpportunity`
- `OptimizationConstraints`
- `RecoveryBankState`
- `HeadwayCorrection`

## Integration with Scheduler2

This optimization system is designed to integrate seamlessly with the existing Scheduler2 application:

1. **Schedule Service Integration**: Uses existing `Schedule` and `Trip` types
2. **Error Handling**: Follows established patterns with `SecureErrorHandler`
3. **Performance**: Optimized for the same 500+ trip performance requirements
4. **UI Integration**: Progress callbacks support real-time UI updates
5. **Firebase Storage**: Results can be stored using existing storage services

The system extends the current workflow: Upload → TimePoints → Block Configuration → **Connection Optimization** → Summary Schedule → Export