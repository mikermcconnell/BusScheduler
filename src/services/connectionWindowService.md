# Connection Window Calculator Service

## Overview

The `ConnectionWindowService` provides core functionality for calculating connection satisfaction between bus arrivals/departures and target connection times. It determines whether connections meet ideal, partial, or missed thresholds and provides scoring and optimization recommendations.

## Key Features

1. **Core Connection Calculation** - Calculate time gaps and classify connection satisfaction
2. **Multiple Connection Types** - Support for Georgian College, GO Trains, and High Schools
3. **Edge Case Handling** - Handles midnight wraparound and morning vs afternoon scenarios  
4. **Bulk Analysis** - Analyze entire schedules against multiple connection requirements
5. **Optimization Recommendations** - Suggests adjustments to improve connection satisfaction

## Connection Windows by Type

### Georgian College
- **Ideal**: 10-15 minutes before class
- **Partial**: 5-20 minutes range  
- **Missed**: >20 minutes gap

### GO Trains
- **Ideal**: 10-15 minutes connection window
- **Partial**: 5-10 minutes range
- **Missed**: >15 minutes gap

### High Schools  
- **Ideal**: 10-15 minutes before bell
- **Partial**: 5-10 minutes range
- **Missed**: Outside acceptable range

## Core Methods

### `calculateConnectionWindow(tripTime, connectionTime, connectionType, scenario, priority)`

Main calculation method that determines connection satisfaction.

**Parameters:**
- `tripTime`: Bus time at connection point (HH:MM format)
- `connectionTime`: Target connection time (HH:MM format)
- `connectionType`: Type of connection (`ConnectionType.SCHOOL_BELL`, `ConnectionType.GO_TRAIN`, etc.)
- `scenario`: `'arrival'` or `'departure'` connection
- `priority`: Priority level (1-10, affects scoring)

**Returns:** `ConnectionWindowResult` with:
- `timeGapMinutes`: Gap between bus and connection
- `classification`: `'ideal'`, `'partial'`, or `'missed'`
- `score`: Connection score (0-1)
- `isSatisfied`: Whether connection requirements are met
- `recommendedAdjustment`: Suggested time adjustment
- `details`: Additional calculation information

### `getWindowClassification(gapMinutes, windows)`

Classify connection satisfaction based on time gap and connection windows.

### `getConnectionScore(classification, priority, windows)`

Calculate connection score based on classification and priority level.

### `analyzeAllConnections(schedule, connections)`

Analyze all connections in a schedule against connection requirements.

**Returns:** `BulkConnectionAnalysis` with:
- `successRate`: Overall connection success rate (0-1)
- `averageScore`: Average connection score
- `connections`: Individual connection results
- `summaryByType`: Statistics by connection type
- `recommendations`: Optimization suggestions

## Usage Examples

### Basic Georgian College Connection

```typescript
import { connectionWindowService } from './connectionWindowService';
import { ConnectionType } from '../types/schedule';

// Calculate if 8:47 AM bus arrival satisfies 9:00 AM class
const result = connectionWindowService.calculateConnectionWindow(
  '08:47', // Bus arrival
  '09:00', // Class start
  ConnectionType.SCHOOL_BELL,
  'arrival',
  8 // High priority
);

console.log('Classification:', result.classification); // 'ideal'
console.log('Score:', result.score); // 0.8
console.log('Time Gap:', result.timeGapMinutes); // 13 minutes
```

### GO Train Connection Analysis

```typescript
// Check if 7:05 AM bus arrival works for 7:20 AM train departure
const goResult = connectionWindowService.calculateConnectionWindow(
  '07:05',
  '07:20', 
  ConnectionType.GO_TRAIN,
  'arrival',
  9
);

if (goResult.recommendedAdjustment) {
  console.log(`Adjust bus by ${goResult.recommendedAdjustment} minutes`);
}
```

### Bulk Schedule Analysis

```typescript
const connections = [
  {
    locationId: 'georgian-college',
    connectionTime: '09:00',
    connectionType: ConnectionType.SCHOOL_BELL,
    scenario: 'arrival',
    priority: 8
  },
  {
    locationId: 'go-station',
    connectionTime: '07:30',
    connectionType: ConnectionType.GO_TRAIN, 
    scenario: 'arrival',
    priority: 9
  }
];

const analysis = connectionWindowService.analyzeAllConnections(schedule, connections);

console.log(`Success Rate: ${(analysis.successRate * 100).toFixed(1)}%`);
console.log('Recommendations:', analysis.recommendations);
```

## Edge Cases Handled

1. **Midnight Wraparound**: Correctly handles connections that cross midnight (e.g., 23:50 bus to 00:10 connection)
2. **Morning vs Afternoon**: Different logic for arrival vs departure scenarios
3. **Bi-directional Connections**: Supports both buses arriving before connections and departing after
4. **Priority Weighting**: Higher priority connections get better scores even with same time gaps

## Integration

The service integrates with:
- **Schedule Types** (`src/types/schedule.ts`) - Core schedule data structures
- **Connection Optimization Types** (`src/types/connectionOptimization.ts`) - Advanced optimization interfaces  
- **Time Utils** (`src/utils/timeUtils.ts`) - Time calculation utilities

## Error Handling

- Throws errors for unsupported connection types
- Gracefully handles missing data in bulk analysis
- Provides detailed error context in calculation results
- Validates time formats and ranges

## Performance

- Optimized for analyzing hundreds of connections per schedule
- Efficient time gap calculations with wraparound handling
- Minimal memory footprint with streaming analysis
- Suitable for real-time connection optimization