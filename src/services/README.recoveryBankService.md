# Recovery Bank Service

## Overview

The Recovery Bank Service is a sophisticated system for managing and redistributing recovery time across bus stops in the Scheduler2 application. It enables bus schedule connection optimization by allowing stops to "borrow" and "lend" recovery time from each other while respecting operational constraints.

## Key Features

- **Smart Stop Classification**: Automatically infers stop types (terminal, school, hospital, etc.) based on naming patterns
- **Flexible Recovery Allocation**: Redistributes recovery time based on stop flexibility and operational requirements
- **Constraint Validation**: Enforces minimum recovery times, maximum deviations, and operational limits
- **Transaction Management**: Complete audit trail with rollback capabilities
- **Optimization Scoring**: Intelligent scoring system for optimal recovery time allocation

## Core Concepts

### Stop Types and Flexibility

| Stop Type | Base Flexibility | Description | Use Case |
|-----------|-----------------|-------------|-----------|
| Terminal | 0.9 | Very flexible | Major recovery points |
| Mall | 0.8 | High flexibility | Commercial areas with passenger tolerance |
| Major Stop | 0.7 | Moderate flexibility | Important stops (colleges, transit hubs) |
| Regular | 0.6 | Standard flexibility | Typical bus stops |
| Hospital | 0.4 | Lower flexibility | Time-sensitive medical appointments |
| School | 0.2 | Very low flexibility | Strict bell schedules |

### Recovery Limits by Stop Type

```typescript
// Example recovery limits
{
  terminal: { min: 2min, max: 15min, maxCredit: 8min },
  school: { min: 1min, max: 4min, maxCredit: 1min },
  hospital: { min: 2min, max: 6min, maxCredit: 2min }
}
```

## Basic Usage

### 1. Initialize Recovery Bank

```typescript
import { recoveryBankService } from './services/recoveryBankService';
import { Schedule, OptimizationConstraints } from './types';

// Define constraints
const constraints: OptimizationConstraints = {
  maxTripDeviation: 10,        // Max 10 minutes adjustment per trip
  maxScheduleShift: 30,        // Max 30 minutes total schedule shift
  minRecoveryTime: 1,          // Min 1 minute recovery at any stop
  maxRecoveryTime: 15,         // Max 15 minutes recovery at any stop
  // ... other constraint properties
};

// Initialize bank with schedule
const bankState = recoveryBankService.initializeBank(
  schedule,
  [], // Custom stop configurations (optional)
  constraints
);
```

### 2. Request Recovery Time Transfer

```typescript
// Transfer 3 minutes from terminal to college for connection optimization
const result = recoveryBankService.requestRecoveryTransfer(
  'terminal_downtown',    // Lender stop ID
  'georgian_college',     // Borrower stop ID
  3,                      // Amount in minutes
  ['trip_123'],           // Affected trip IDs
  'GO Train connection'   // Reason (optional)
);

if (result.success) {
  console.log('Transfer successful:', result.transaction);
} else {
  console.error('Transfer failed:', result.error);
}
```

### 3. Find Optimal Allocation for Multiple Requests

```typescript
const requests = [
  {
    toStopId: 'georgian_college',
    amount: 2,
    priority: 8,
    affectedTrips: ['trip_123']
  },
  {
    toStopId: 'hospital_main',
    amount: 1,
    priority: 10, // Higher priority
    affectedTrips: ['trip_124']
  }
];

const allocation = recoveryBankService.findOptimalAllocation(requests);

console.log('Successful allocations:', allocation.allocations.length);
console.log('Unmet requests:', allocation.unmetRequests.length);
console.log('Total optimization score:', allocation.totalScore);
```

### 4. Transaction Management

```typescript
// Get current bank state
const bankState = recoveryBankService.getBankState();
console.log('Total borrowed recovery:', bankState?.totalBorrowedRecovery);
console.log('Utilization rate:', bankState?.utilizationRate);

// Rollback a transaction
const rollbackResult = recoveryBankService.rollbackTransaction(transactionId);

// Reset entire bank
recoveryBankService.resetBank();

// View transaction history
const history = recoveryBankService.getTransactionHistory();
```

### 5. Generate Utilization Report

```typescript
const report = recoveryBankService.generateUtilizationReport();

console.log('Bank Statistics:');
console.log('- Total accounts:', report.totalAccounts);
console.log('- Total available credit:', report.totalAvailableCredit);
console.log('- Utilization rate:', report.utilizationRate.toFixed(2));

console.log('Top lenders:', report.topLenders);
console.log('Top borrowers:', report.topBorrowers);
```

## Advanced Configuration

### Custom Stop Configurations

```typescript
const customConfigs = [
  {
    stopId: 'georgian_college',
    stopType: 'major_stop',
    maxCredit: 5,
    minRecoveryTime: 2,
    flexibilityScore: 0.8
  },
  {
    stopId: 'hospital_emergency',
    stopType: 'hospital',
    maxCredit: 1,
    minRecoveryTime: 3,
    flexibilityScore: 0.2
  }
];

recoveryBankService.initializeBank(schedule, customConfigs, constraints);
```

### Constraint Configuration

```typescript
const constraints: OptimizationConstraints = {
  maxTripDeviation: 8,              // Tighter trip deviation limit
  maxScheduleShift: 20,             // Tighter schedule shift limit
  minRecoveryTime: 2,               // Higher minimum recovery
  maxRecoveryTime: 12,              // Lower maximum recovery
  enforceHeadwayRegularity: true,   // Maintain regular headways
  headwayTolerance: 1,              // ±1 minute headway tolerance
  connectionPriorities: {
    BUS_ROUTE: 5,
    GO_TRAIN: 9,                    // Prioritize GO Train connections
    SCHOOL_BELL: 10                 // Highest priority for school connections
  },
  allowCrossRouteBorrowing: false,  // Keep borrowing within route
  performance: {
    maxOptimizationTimeMs: 15000,   // 15 second time limit
    maxMemoryUsageMB: 32,           // 32MB memory limit
    earlyTerminationThreshold: 0.005 // Stop when improvement < 0.5%
  }
};
```

## Integration Examples

### With Connection Optimization

```typescript
// 1. Initialize recovery bank
const bankState = recoveryBankService.initializeBank(schedule, [], constraints);

// 2. Identify connection opportunities requiring time adjustments
const connectionRequests = identifyConnectionOpportunities(schedule, connectionPoints);

// 3. Find optimal recovery allocation
const allocation = recoveryBankService.findOptimalAllocation(connectionRequests);

// 4. Apply successful allocations to schedule
allocation.allocations.forEach(transaction => {
  applyRecoveryAdjustment(schedule, transaction);
});

// 5. Handle unmet requests
if (allocation.unmetRequests.length > 0) {
  console.warn('Could not meet all connection requirements:', allocation.unmetRequests);
}
```

### With Headway Correction

```typescript
// Use recovery bank to maintain regular headways while optimizing connections
const headwayDeviations = calculateHeadwayDeviations(schedule);
const correctionRequests = headwayDeviations.map(deviation => ({
  toStopId: deviation.correctionStopId,
  amount: deviation.correctionAmount,
  priority: 7, // Medium priority for headway regularity
  affectedTrips: [deviation.tripId]
}));

const allocation = recoveryBankService.findOptimalAllocation([
  ...connectionRequests, // High priority
  ...correctionRequests  // Medium priority
]);
```

## Error Handling

The service provides comprehensive error handling with specific error codes:

```typescript
const result = recoveryBankService.requestRecoveryTransfer(...);

if (!result.success) {
  switch (true) {
    case result.error?.includes('Insufficient credit'):
      // Handle insufficient lending capacity
      break;
    case result.error?.includes('exceed max recovery'):
      // Handle borrower capacity exceeded
      break;
    case result.error?.includes('exceeds max deviation'):
      // Handle constraint violation
      break;
    case result.error?.includes('high debt ratio'):
      // Handle over-leveraged lender
      break;
    default:
      // Handle other errors
  }
}
```

## Performance Considerations

- **Memory Usage**: Service maintains in-memory state for fast access
- **Transaction Limits**: Designed to handle hundreds of transactions efficiently
- **Optimization**: Transaction scoring is optimized for real-time usage
- **Cleanup**: Use `resetBank()` to clear state when starting new optimization cycles

## Testing

Comprehensive test suite covers:
- Bank initialization and configuration
- Transaction validation and execution
- Optimal allocation algorithms
- Error handling and edge cases
- Performance under load
- Transaction history integrity

Run tests: `npm test -- --testPathPattern=recoveryBankService.test.ts`