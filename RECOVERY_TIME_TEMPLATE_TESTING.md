# Recovery Time Template Testing Guide

## Overview
The Recovery Time Template functionality allows users to standardize recovery times across different service bands and apply them to all trips in the summary schedule. This feature provides efficient bulk editing capabilities for schedule optimization.

## Features Implemented

### 1. Recovery Time Templates by Service Band
- **Location**: Bottom section of Summary Schedule page (`/summary-schedule`)
- **Purpose**: Define standard recovery times for each service band across all timepoints
- **Service Bands**: Fastest, Fast, Standard, Slow, Slowest Service
- **Default Templates**:
  - Fastest Service: [0, 1, 1, 2, 3]
  - Fast Service: [0, 1, 2, 2, 4] 
  - Standard Service: [0, 2, 2, 3, 5]
  - Slow Service: [0, 2, 3, 3, 6]
  - Slowest Service: [0, 3, 3, 4, 7]

### 2. Target Recovery Percentage Tool
- **Input Field**: Accepts 5-50% range
- **Default**: 15%
- **Function**: Calculates recovery times as percentage of travel times
- **Algorithm**: 
  - Calculates based on segment travel times
  - Final stop gets 1.5x multiplier (layover time)
  - Enforces 1-10 minute range per stop

### 3. Individual Template Application
- **"Apply" Button**: Per service band application
- **Scope**: Updates all trips matching that service band
- **Cascading**: Automatically updates subsequent trips in same bus blocks

### 4. Bulk Template Application
- **"Apply All Templates" Button**: Applies all templates simultaneously
- **Efficiency**: Single-operation update for entire schedule

## Manual Testing Instructions

### Prerequisites
1. Start the development server: `npm start` (runs on port 3050)
2. Navigate to http://localhost:3050
3. Have a schedule with generated trips available
4. Go to Dashboard → Draft Schedules → Summary Schedule

### Test Case 1: Target Recovery Percentage
**Objective**: Verify the percentage-based recovery calculation works correctly

**Steps**:
1. Locate "Recovery Time Templates by Service Band" section
2. Find "Target Recovery Percentage" input field (should show 15% by default)
3. Change the value to 20%
4. Click "Apply to All Bands" button
5. **Expected**: All templates should update with new recovery times
6. **Screenshot**: Capture template table before and after

**What to Verify**:
- Input accepts values 5-50%
- Recovery times change proportionally
- Total recovery column updates
- Templates persist after page refresh

### Test Case 2: Individual Service Band Template Application
**Objective**: Test applying a single service band template

**Steps**:
1. In the templates table, find "Fastest Service" row
2. Modify one of the recovery time values (e.g., change 2nd timepoint from 1 to 3)
3. Click the "Apply" button for that row
4. **Expected**: All trips with "Fastest Service" band should update
5. **Screenshot**: Capture schedule before and after changes

**What to Verify**:
- Only "Fastest Service" trips update
- Recovery times match template values
- Subsequent trips in same blocks shift appropriately
- Trip times, travel times, and percentages recalculate

### Test Case 3: Bulk Template Application
**Objective**: Test applying all templates at once

**Steps**:
1. Modify recovery times in multiple service band templates
2. Click "Apply All Templates" button
3. **Expected**: All trips update according to their service bands
4. **Screenshot**: Capture full schedule before and after

**What to Verify**:
- All service bands update simultaneously
- No conflicts or errors occur
- Schedule maintains proper block cycling
- All percentages and times recalculate correctly

### Test Case 4: Recovery Percentage Color Coding
**Objective**: Verify the recovery percentage status indicators work

**Steps**:
1. Apply templates to create various recovery percentages
2. Look at the "Recovery %" column in the schedule
3. **Expected Color Coding**:
   - Red: < 10% (not enough) or > 15% (too much)
   - Yellow: 10-15% (okay)
   - Green: exactly 15% (great)
4. **Screenshot**: Capture different percentage colors

### Test Case 5: Inline Recovery Time Editing
**Objective**: Test individual recovery time editing still works

**Steps**:
1. Click on any "Xmin recovery" value in the schedule
2. Edit the value and press Enter
3. **Expected**: Cascading updates occur for that trip and block
4. Verify templates don't override manual edits
5. **Screenshot**: Capture inline editing interface

### Test Case 6: Template Persistence
**Objective**: Verify templates save and restore

**Steps**:
1. Modify all recovery templates
2. Refresh the page
3. **Expected**: Templates retain custom values
4. Apply target percentage
5. Refresh again
6. **Expected**: New calculated templates persist

## Expected Behavior Documentation

### Recovery Time Logic
- **First Timepoint**: Always 0 minutes (departure only)
- **Middle Timepoints**: 1-10 minutes based on template/percentage
- **Final Timepoint**: Higher recovery (layover time)
- **Minimum**: 1 minute recovery at stops
- **Maximum**: 10 minutes per stop

### Cascading Update Logic
```
When recovery template applied:
1. Update recovery times for matching service band trips
2. Recalculate departure times within each trip
3. Update subsequent trips in same bus blocks
4. Maintain block cycling constraints
5. Recalculate all performance metrics
```

### Service Band Assignment
- Based on departure time and TimePoints analysis data
- Automatically assigned during schedule generation
- Used to determine which template applies

### Performance Metrics
- **Trip Time**: First departure to final arrival
- **Recovery Time**: Sum of all recovery minutes in trip
- **Travel Time**: Trip time minus recovery time
- **Recovery %**: (Recovery ÷ Travel) × 100

## Troubleshooting

### Common Issues
1. **Templates not applying**: Check that trips have correct service bands
2. **Percentage calculations wrong**: Verify travel times are calculated correctly
3. **Cascading not working**: Ensure block configurations are valid
4. **Templates not persisting**: Check localStorage isn't disabled

### Debug Information
- Open browser console (F12) for detailed logs
- Look for "🔄 Updated trip" and "🎯 Service band" messages
- Template save/load messages: "✅ Schedule updated and persisted"

## Screenshots to Capture

1. **Recovery Templates Section**: Full template table with default values
2. **Target Percentage Tool**: Input field and "Apply to All Bands" button
3. **Before Template Application**: Schedule showing original recovery times
4. **After Template Application**: Schedule showing updated times
5. **Recovery Percentage Colors**: Different color-coded percentage statuses
6. **Inline Editing**: Recovery time being edited in schedule
7. **Template Persistence**: Templates after page refresh

## Success Criteria

### ✅ All tests pass if:
- Target percentage calculation works (5-50% range)
- Individual template application updates correct trips
- Bulk application works without errors
- Recovery percentages show correct colors
- Templates persist across page refreshes
- Cascading updates maintain schedule integrity
- All performance metrics recalculate correctly

### ❌ Issues to report:
- Templates don't apply to schedule
- Percentage calculations are incorrect
- Cascading breaks block cycling
- Templates reset on page refresh
- Color coding doesn't match percentages
- Console shows errors during application

## Performance Notes
- Large schedules (500+ trips) may take 2-3 seconds to update
- Virtualization maintains smooth scrolling during updates
- All calculations happen client-side (no server requests)
- localStorage used for template persistence