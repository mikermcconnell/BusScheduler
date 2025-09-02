# Recovery Time Template Testing Checklist

## Quick Navigation Steps
1. Open http://localhost:3050
2. Go to Dashboard
3. Click "Draft Schedules" 
4. Select a schedule with generated trips
5. Navigate to "Summary Schedule" page
6. Scroll to "Recovery Time Templates by Service Band" section

## Test Checklist

### ✅ Target Recovery Percentage (Test 1)
- [ ] Find "Target Recovery Percentage" input field
- [ ] Current value shows 15% by default
- [ ] Change to 20% and click "Apply to All Bands"
- [ ] All template values update proportionally
- [ ] Take screenshot: Before/after template table
- [ ] Templates persist after page refresh

### ✅ Individual Template Application (Test 2)
- [ ] Locate "Fastest Service" row in templates table
- [ ] Edit one recovery time value (change 1 to 3)
- [ ] Click "Apply" button for that row
- [ ] Only "Fastest Service" trips update in schedule
- [ ] Take screenshot: Schedule before/after changes
- [ ] Verify cascading updates to subsequent trips

### ✅ Bulk Template Application (Test 3)
- [ ] Modify multiple service band templates
- [ ] Click "Apply All Templates" button
- [ ] All service bands update simultaneously
- [ ] Take screenshot: Full schedule transformation
- [ ] No errors in browser console

### ✅ Recovery Percentage Colors (Test 4)
- [ ] Look at "Recovery %" column in schedule table
- [ ] Red: < 10% or > 15%
- [ ] Yellow/Amber: 10-15%
- [ ] Green: exactly 15%
- [ ] Take screenshot: Different colored percentages

### ✅ Inline Editing Still Works (Test 5)
- [ ] Click any "Xmin recovery" in schedule table
- [ ] Input appears with value selected
- [ ] Change value and press Enter
- [ ] Cascading updates occur
- [ ] Take screenshot: Inline editing interface

### ✅ Template Persistence (Test 6)
- [ ] Modify all recovery templates
- [ ] Refresh page (F5)
- [ ] Templates retain custom values
- [ ] Apply target percentage (e.g., 25%)
- [ ] Refresh page again
- [ ] New calculated templates persist

## Screenshots Required
1. **Recovery Templates Section**: Default template table
2. **Target Percentage Tool**: Input field and button
3. **Before Application**: Original schedule recovery times  
4. **After Application**: Updated schedule with new times
5. **Color-Coded Percentages**: Different status colors
6. **Inline Editing**: Recovery time edit interface

## What to Document

### ✅ Working Features
- Target percentage calculation (5-50% range)
- Individual "Apply" buttons work
- "Apply All Templates" works
- Recovery times update in schedule
- Cascading updates to subsequent trips
- Percentage color coding
- Template persistence across refreshes

### ❌ Issues Found
- Templates not applying to schedule
- Incorrect percentage calculations
- Missing cascading updates
- Templates reset on refresh
- Wrong colors for percentages
- Console errors during updates
- Performance issues with large schedules

## Browser Console Verification
**Look for these messages:**
- ✅ "🔄 Updated trip X in block Y"
- ✅ "🎯 Service band updated for trip X"
- ✅ "✅ Schedule updated and persisted"
- ❌ Any red error messages

## Performance Check
- [ ] Updates complete within 3 seconds
- [ ] No browser freezing during updates
- [ ] Smooth scrolling maintained
- [ ] Memory usage stays reasonable

## Final Validation
- [ ] All trip times recalculated correctly
- [ ] Block cycling constraints maintained
- [ ] No broken trips or invalid times
- [ ] All performance metrics consistent
- [ ] Feature works with large schedules (100+ trips)