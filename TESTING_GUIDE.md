# Testing Guide for Scheduler2

This guide documents critical test scenarios, edge cases, and performance boundaries for the Scheduler2 application.

## Critical User Flows

### 1. Schedule Generation Flow
**Path**: Upload CSV → TimePoints Analysis → Block Configuration → Summary Schedule

**Test Scenarios**:
- ✅ Small dataset: 50 trips (baseline performance)
- ✅ Medium dataset: 500 trips (virtualization boundary)
- ✅ Large dataset: 1000 trips (performance boundary)
- ✅ Edge case: Single trip
- ✅ Edge case: Empty schedule

**What to verify**:
- File upload completes without timeout
- TimePoints analysis identifies all time periods
- Service bands calculate correctly
- Block configuration maintains cycle times
- Summary schedule displays all trips

### 2. Recovery Time Cascading
**Path**: Edit recovery time → Verify cascading updates

**Test Scenarios**:
```
Scenario A: Mid-trip edit
1. Edit recovery at stop 3 (middle of trip)
2. Verify stops 4-5 update with new times
3. Verify stop 1-2 remain unchanged
4. Verify next trip in block shifts accordingly

Scenario B: Last stop edit  
1. Edit recovery at final stop
2. Verify next trip in block shifts
3. Verify subsequent trips cascade
4. Verify other blocks remain unchanged

Scenario C: First trip edit
1. Edit recovery in first trip of block
2. Verify all trips in block cascade
3. Verify schedule integrity maintained
```

### 3. Service Band Assignment
**Test different time periods**:
- Early morning (07:00): Should get "Fastest Service"
- Rush hour (08:30): Should get "Standard Service"
- Afternoon (16:00): Should get "Slow Service"
- Evening (20:00): Should get "Fast Service"

## Performance Testing

### Load Testing Boundaries
```javascript
// Test with these trip counts
const testScenarios = [
  { trips: 10, expected: "instant", virtualization: false },
  { trips: 50, expected: "<1s", virtualization: false },
  { trips: 100, expected: "<2s", virtualization: optional },
  { trips: 500, expected: "<5s", virtualization: true },
  { trips: 1000, expected: "<10s", virtualization: required },
  { trips: 2000, expected: "consider pagination", virtualization: required }
];
```

### Memory Usage Monitoring
```javascript
// Monitor memory during operations
console.log('Memory before:', performance.memory.usedJSHeapSize / 1048576, 'MB');
// Perform operation
console.log('Memory after:', performance.memory.usedJSHeapSize / 1048576, 'MB');
```

## Edge Cases to Test

### File Upload Edge Cases
- [ ] Empty CSV file
- [ ] Malformed CSV (missing columns)
- [ ] Excel file with multiple sheets
- [ ] File exceeding 5MB limit
- [ ] Non-spreadsheet file (.pdf, .doc)
- [ ] File with special characters in name
- [ ] Corrupted file

### Schedule Generation Edge Cases
- [ ] All trips in single block
- [ ] Each trip in separate block
- [ ] Negative travel times (data error)
- [ ] Recovery time > travel time
- [ ] Overlapping trips
- [ ] Gaps in service
- [ ] 24-hour wraparound (11:59 PM → 12:00 AM)

### Data Validation Edge Cases
- [ ] Missing timepoints
- [ ] Duplicate trip numbers
- [ ] Invalid time formats
- [ ] Out-of-order timepoints
- [ ] Circular routes
- [ ] Express services (skipped stops)

## Manual Testing Checklist

### Pre-Release Testing
- [ ] **Upload Flow**
  - [ ] Drag and drop works
  - [ ] Browse button works
  - [ ] Progress indicator displays
  - [ ] Error messages are clear
  
- [ ] **TimePoints Analysis**
  - [ ] Charts render correctly
  - [ ] Outliers are detected
  - [ ] Service bands calculate
  - [ ] Tables are collapsible
  
- [ ] **Block Configuration**
  - [ ] Automation toggle works
  - [ ] Manual overrides persist
  - [ ] Cycle time calculations correct
  - [ ] Block colors display
  
- [ ] **Summary Schedule**
  - [ ] All trips display
  - [ ] Statistics are accurate
  - [ ] Export functions work
  - [ ] Print layout is clean

### Cross-Browser Testing
Test in:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

### Accessibility Testing
- [ ] Keyboard navigation works
- [ ] Screen reader compatible
- [ ] Color contrast sufficient
- [ ] Focus indicators visible
- [ ] Alt text present

## Automated Testing

### Unit Test Coverage Goals
```
src/
├── utils/ (90% coverage)
│   ├── calculator.ts ✅
│   ├── dateHelpers.ts ✅
│   ├── formatDetector.ts ✅
│   └── inputSanitizer.ts ✅
├── services/ (80% coverage)
│   ├── scheduleService.ts ⚠️
│   └── scheduleStorage.ts ⚠️
└── components/ (70% coverage)
    ├── FileUpload.tsx ⚠️
    └── SummaryDisplay.tsx ⚠️
```

### Integration Test Scenarios
```typescript
describe('Schedule Generation E2E', () => {
  it('should generate schedule from CSV upload', async () => {
    // Upload file
    // Wait for processing
    // Navigate to timepoints
    // Configure service bands
    // Generate summary
    // Verify output
  });
});
```

### Performance Benchmarks
```typescript
describe('Performance', () => {
  it('should handle 500 trips in < 5 seconds', async () => {
    const start = performance.now();
    await generateSchedule(create500Trips());
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(5000);
  });
});
```

## Regression Testing

### After Each Feature Addition
1. Run full test suite
2. Check memory leaks
3. Verify no performance degradation
4. Test cascading effects
5. Validate data integrity

### Known Issues to Monitor
- Recovery time cascading with > 1000 trips
- Memory usage with multiple large files
- localStorage limits with many drafts
- Print layout with > 50 timepoints

## Security Testing

### File Upload Security
- [ ] Test with malicious file names
- [ ] Test with executable extensions
- [ ] Test with zip bombs
- [ ] Test with oversized files
- [ ] Test MIME type spoofing

### Input Validation
- [ ] SQL injection attempts
- [ ] XSS payload injection
- [ ] Command injection
- [ ] Path traversal attempts
- [ ] Buffer overflow attempts

## Test Data Generation

### Creating Test Schedules
```javascript
// Generate test data
function generateTestSchedule(tripCount = 50) {
  return {
    trips: Array.from({ length: tripCount }, (_, i) => ({
      tripNumber: i + 1,
      blockNumber: Math.floor(i / 10) + 1,
      departureTime: addMinutes('07:00', i * 15),
      serviceBand: getServiceBandForTime(/* time */),
      // ... other fields
    })),
    timePoints: generateTimePoints(),
    serviceBands: generateServiceBands()
  };
}
```

### CSV Test Files
Located in `test-data/`:
- `small-schedule.csv` - 10 trips, 5 timepoints
- `medium-schedule.csv` - 100 trips, 10 timepoints
- `large-schedule.csv` - 1000 trips, 20 timepoints
- `edge-cases.csv` - Various edge cases
- `malformed.csv` - Invalid format for error testing

## Debugging Tips

### Console Commands
```javascript
// Check current schedule
scheduleStorage.getAllSchedules()

// Clear all data
localStorage.clear()

// Monitor memory
performance.memory

// Check React performance
React.Profiler
```

### Common Issues and Solutions
1. **Cascading updates not working**
   - Check `updateSubsequentTripTimes()` logic
   - Verify trip ordering
   - Check block boundaries

2. **Statistics incorrect**
   - Verify column summation logic
   - Check trip filtering (active vs ended)
   - Validate recovery time calculations

3. **Performance degradation**
   - Check for unnecessary re-renders
   - Verify memoization working
   - Look for infinite loops

## Continuous Improvement

### Metrics to Track
- Page load time
- Time to first interaction
- Schedule generation time
- Memory usage peak
- Error rate
- User completion rate

### Performance Budget
- Initial load: < 3s
- Schedule generation: < 5s for 500 trips
- Cascading update: < 100ms
- Export generation: < 2s

---

**Remember**: Always test with real-world data in addition to synthetic test data. User patterns often reveal edge cases not covered in controlled tests.