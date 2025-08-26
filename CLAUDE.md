# CLAUDE.md - Scheduler2 Application Guide

## Project Overview
**Scheduler2** is a bus route scheduling application that processes Excel files to generate formatted bus schedules. The app has reached **MVP status** with comprehensive security mitigations implemented.

**Purpose**: Eliminate manual Excel formatting pain points by automating the conversion of raw schedule data into professional, formatted schedules for weekday, Saturday, and Sunday service patterns.

## Tech Stack
- **Frontend**: React 19 + TypeScript 5.9
- **UI Framework**: Material-UI v7 (@mui/material)
- **Routing**: React Router DOM v7
- **Excel Processing**: xlsx library
- **Testing**: Jest + React Testing Library v16, Vitest v3
- **Build**: Create React App (react-scripts 5.0.1)
- **Styling**: CSS with Material-UI theming

## Key Commands
```bash
npm start          # Development server
npm run build      # Production build
npm test           # Jest tests
npm run test:vitest # Vitest tests
npx tsc --noEmit   # TypeScript compilation check
```

## Application Architecture

### Core Features
1. **Excel File Upload & Processing** - Drag/drop or browse upload with validation
2. **Smart Format Detection** - Automatic detection of time points, travel times, day types
3. **Schedule Generation** - Travel time calculations with missing data interpolation
4. **Multi-Day Support** - Separate processing for weekday/Saturday/Sunday schedules
5. **Professional Export** - CSV and Excel export with metadata and formatting
6. **Security Hardened** - XSS prevention, file validation, memory protection
7. **Draft Management** - Save and manage draft schedules with local storage
8. **Timepoint Analysis** - Interactive travel time analysis with outlier detection
9. **Service Band Visualization** - Data-driven service bands with interactive charts
10. **Bus Block Configuration** - Advanced Duolingo-style interface for bus schedule management
11. **Tod Shifts Management** - Bus operator shift scheduling with union rule compliance (Pending Feature)

### Project Structure
```
src/
├── components/           # React UI components
│   ├── FileUpload.tsx   # Material-UI file upload with drag/drop
│   ├── SummaryDisplay.tsx # Professional data display with tabs
│   ├── Layout.tsx       # Main app layout wrapper
│   ├── Navigation.tsx   # Navigation bar component
│   ├── DraftScheduleList.tsx # Draft schedule listing and management
│   ├── TripDurationChart.tsx # Travel time visualization charts
│   ├── TripDurationTable.tsx # Travel time data tables
│   └── ScheduleEditDialog.tsx # Schedule editing modal dialogs
├── hooks/               # Custom React hooks
│   └── useFileUpload.ts # File processing with security validation
├── pages/              # Page-level components (React Router)
│   ├── Dashboard.tsx
│   ├── UploadSchedule.tsx # Main upload and processing page
│   ├── TimePoints.tsx   # Interactive timepoint analysis with charts
│   ├── GenerateSummarySchedule.tsx # Summary schedule generation
│   ├── DraftSchedules.tsx # Draft schedule management
│   ├── TodShifts.tsx    # Tod Shifts management placeholder page
│   ├── ViewSchedules.tsx
│   ├── ManageRoutes.tsx
│   ├── GenerateSchedules.tsx # Schedule generation workflow
│   ├── SummarySchedule.tsx # Professional schedule display
│   ├── EditCSVSchedule.tsx # CSV schedule editing
│   ├── BlockConfiguration.tsx # Bus block configuration with Duolingo-style UI
│   └── NotFound.tsx
├── services/           # Business logic services
│   ├── scheduleService.ts # Service layer orchestrating processing
│   └── scheduleStorage.ts # Local storage management for drafts
├── TodShifts/          # Tod Shifts management module (Pending Feature)
│   ├── types/
│   │   └── shift.types.ts # Shift and union rule type definitions
│   ├── store/
│   │   └── shiftManagementSlice.ts # Redux state management
│   ├── utils/
│   │   ├── unionRulesValidator.ts # Union compliance validation
│   │   └── scheduleParser.ts # Master schedule file parsing
│   ├── ManualShiftCreator.tsx # Manual shift creation form
│   ├── ShiftManagementPage.tsx # Main shift management interface
│   ├── MasterScheduleImport.tsx # Master schedule import component
│   ├── UnionRulesConfiguration.tsx # Union rules configuration
│   ├── ShiftGanttChart.tsx # Visual shift timeline
│   ├── ShiftSummaryTable.tsx # Shift data table
│   └── ShiftExport.tsx # Export functionality
├── store/              # Global Redux store
│   └── store.ts        # Store configuration with Tod Shifts
├── types/              # TypeScript type definitions
│   ├── schedule.ts     # Core schedule types
│   ├── excel.ts        # Excel-specific types
│   └── index.ts        # Re-exports
├── utils/              # Utility functions
│   ├── calculator.ts   # Core travel time calculations
│   ├── csvParser.ts    # CSV file parsing and validation
│   ├── formatDetector.ts # Smart format detection algorithms
│   ├── inputSanitizer.ts # XSS prevention and input sanitization
│   ├── dateHelpers.ts  # Date and time manipulation utilities
│   ├── tripDurationAnalyzer.ts # Travel time analysis and outlier detection
│   └── summaryExcelExporter.ts # Professional Excel export functionality
└── integration/        # Integration tests and examples
    └── exampleWorkflow.ts
```

## Key Types & Interfaces

### Core Schedule Types (src/types/schedule.ts)
- `TimePoint`: Stop locations with travel time data
- `Trip`: Individual bus trip with times and metadata
- `DayType`: 'weekday' | 'saturday' | 'sunday'
- `ProcessedSchedule`: Final schedule data structure
- `ValidationResult`: Validation feedback and quality metrics

### Excel Processing Types (src/types/excel.ts)
- `ExcelData`: Raw Excel file data structure
- `FormatDetectionResult`: Detected format information
- `DataExtractionResult`: Extracted and validated data

### Tod Shifts Types (src/TodShifts/types/shift.types.ts)
- `Shift`: Bus operator shift with times, zones, and compliance status
- `MasterScheduleRequirement`: Required bus coverage by time slot and zone
- `UnionRule`: Configurable union compliance rules (shift length, breaks, rest periods)
- `UnionViolation`: Rule violation details with severity levels
- `ShiftCoverage`: Coverage analysis comparing actual vs required staffing

## File Format Specifications

### Input Format: Raw Data CSV
**File**: `example_schedule/Raw_Data.csv`
**Structure**: Travel time data organized by route segments and time periods

**Format Details**:
- **Title Rows**: Route segment descriptions (e.g., "Downtown Barrie Terminal to Johnson at Napier")
- **Half-Hour Rows**: Time period headers (e.g., "07:00 - 07:29", "07:30 - 07:59")
- **Data Rows**: Travel time statistics by percentile:
  - `101 CCW Observed Runtime-25%`: 25th percentile travel times
  - `101 CCW Observed Runtime-50%`: Median travel times  
  - `101 CCW Observed Runtime-80%`: 80th percentile travel times
  - `101 CCW Observed Runtime-90%`: 90th percentile travel times
  - `101 CCW Scheduled Runtime-10/50/90%`: Scheduled runtime targets
- **Route Segments**: Multiple segments per route (Downtown → Johnson → RVH → Georgian College → Georgian Mall → Bayfield Mall → Downtown)
- **Time Periods**: 30-minute blocks covering service hours (07:00-22:29)

### Output Format: Summary Schedule
**File**: `example_schedule/2_08.2025.xlsx` - Sheet "Summary"
**Structure**: Professional transit schedule with trip times and operational data

**Format Details**:
- **Header Structure**:
  - Row 1: Day type indicator ("Weekday")
  - Row 2: Route identifiers ("Route 2A", "Route 2B")
  - Row 3: Direction indicators ("DEPART", "ARRIVE") 
  - Row 4: Time point names (stop locations)
  - Row 5: Stop IDs and metadata columns
- **Trip Data** (Rows 6+):
  - Block numbers and service periods
  - Actual departure/arrival times for each time point
  - Travel time calculations between stops
  - Cycle times and operational metrics
  - Connection information and notes
- **Time Points**: Sequential stops with calculated travel times
- **Operational Data**: Recovery time, cycle time, frequency, headway management
- **Service Periods**: Early Morning, Morning, Midday with different operating parameters

**Key Transformation**: Raw travel time statistics → Scheduled trip times with operational planning data

## Security Features ⚠️ CRITICAL
The application includes comprehensive security mitigations:

### File Upload Security (src/hooks/useFileUpload.ts)
- MIME type validation beyond file extensions
- Magic byte verification (ZIP/PK for .xlsx, OLE2 for .xls)
- File size limits (5MB max, 1KB min)
- Filename validation with suspicious pattern detection
- Directory traversal attack prevention
- Processing timeout protection (30 seconds)

### Input Sanitization (src/utils/inputSanitizer.ts)
- XSS prevention with HTML entity encoding
- Attack pattern detection (SQL injection, XSS, command injection)
- Length limits and character filtering
- Rate limiting capabilities

### Memory Protection (src/utils/excelParser.ts)
- Circuit breaker pattern for repeated failures
- Memory usage monitoring (50MB limit)
- Processing limits: 500 rows, 10,000 cells maximum
- Streaming-like processing with periodic security checks

### Error Handling Security (src/services/scheduleService.ts)
- Sanitized error messages preventing information disclosure
- Stack trace cleaning removing sensitive paths
- Secure error logging with contextual information

## Material-UI Theme Configuration
```typescript
// Primary color: rgb(0, 75, 128) - Professional blue
// Secondary color: #dc004e - Accent red
// Background: #f5f5f5 - Light gray
// Custom button styling: no text transform, medium font weight
// Custom card styling: subtle shadow
```

## Development Workflow

### Making Changes
1. **File Processing**: Modify utils/ for core logic changes
2. **UI Components**: Update components/ for visual changes
3. **Page Layout**: Edit pages/ for routing and page structure
4. **Type Safety**: Update types/ when adding new data structures
5. **Security**: Always validate inputs, sanitize outputs

### Testing Strategy
- Unit tests for utilities and business logic
- Component tests for UI functionality
- Integration tests for end-to-end workflows
- Security tests for input validation

### Build Process
- TypeScript compilation with strict settings
- React Scripts build system
- Material-UI component optimization
- CSS processing and minification

## Navigation Flow and Page Structure

### Key Pages and Routes
- **Dashboard** (`/`) - Main landing page with overview
- **Upload Schedule** (`/upload`) - Primary file upload and processing
- **TimePoints Page** (`/timepoints`) - Interactive travel time analysis
  - Access via: Dashboard > Draft Schedules > Timepoint Page
  - Features: Collapsible detailed travel times table (default collapsed)
  - Travel time visualization with service bands
  - Outlier detection and management
  - Generate Summary Schedule navigation button
- **Generate Summary Schedule** (`/generate-summary`) - Summary schedule creation
- **Block Configuration** (`/block-configuration`) - Advanced bus block scheduling with Duolingo-style interface
- **Tod Shifts** (`/tod-shifts`) - Bus operator shift management (Pending Feature)
  - Features: Master schedule import, union rules configuration
  - Manual shift creation with compliance validation
  - Visual shift timeline and coverage analysis
  - Export capabilities for shift data
- **Draft Schedules** (`/drafts`) - Draft schedule management and storage
- **View Schedules** (`/schedules`) - Saved schedule viewing
- **Manage Routes** (`/routes`) - Route configuration

### TimePoints Page Features
- **Interactive Charts**: Travel time visualization by time period
- **Service Bands**: Data-driven service bands based on travel time percentiles
- **Outlier Management**: Detect and handle travel time outliers (10%+ deviation)
- **Collapsible Tables**: Detailed travel times hidden by default, expandable on demand
- **Navigation Integration**: Seamless flow from Draft Schedules to TimePoints to Summary Generation

### Draft Schedule Workflow
1. Upload CSV data via Upload Schedule page
2. Process and validate data with automatic format detection
3. Save as draft in Draft Schedules section
4. Navigate to TimePoints page for analysis
5. Review travel time data, manage outliers, configure service bands
6. Generate summary schedule from processed data

### Tod Shifts Features (Pending Implementation)
The Tod Shifts management system provides comprehensive bus operator scheduling:

**Core Functionality:**
- **Master Schedule Import**: Upload CSV files defining required bus coverage by time slots and zones
- **Union Rules Configuration**: Define and manage compliance rules for shift length, breaks, and rest periods
- **Manual Shift Creation**: Create individual shifts with real-time union rule validation
- **Visual Timeline**: Gantt chart visualization of all shifts across different time periods
- **Coverage Analysis**: Compare actual shift coverage against master schedule requirements
- **Compliance Monitoring**: Track union rule violations with warnings and error reporting
- **Multi-Format Export**: Export shift data to CSV, Excel, and formatted reports

**Data Structure:**
- **Zones**: North, South, Floater coverage areas
- **Schedule Types**: Weekday, Saturday, Sunday shift patterns  
- **Shift Components**: Start/end times, breaks, meal periods, split shift support
- **Validation**: Real-time compliance checking against configurable union rules
- **State Management**: Redux-based state management with async operations

**Current Status**: All backend models, Redux store, and component structure implemented. UI integration pending.

## Bus Block Configuration System

### Overview
The Bus Block Configuration system provides an advanced, Duolingo-style interface for managing bus schedule generation with sophisticated automation features. Located at `/block-configuration`, it offers comprehensive control over bus blocks, cycle times, and frequency management.

### Key Features

#### 🎨 **Duolingo-Style UI Design**
- **Rounded pill-shaped cards** with colorful gradients (green, orange, purple, blue, red)
- **3D shadow effects** with interactive hover animations
- **Modern typography** with bold, engaging fonts
- **Smooth transitions** and scale animations throughout
- **Playful color rotation** for visual engagement
- **Responsive design** that adapts to all screen sizes

#### ⚙️ **Advanced Configuration Options**
- **Number of Buses**: Dynamic input (1-10) that creates/removes bus blocks automatically
- **Cycle Time**: User-configurable cycle time in minutes (no restrictions)
- **Service Frequency**: Auto-calculated display (Cycle Time ÷ Number of Buses)
- **Automated Block Start Times**: Toggle-controlled automation system

#### 🤖 **Intelligent Automation System**
- **Toggle Control**: Default ON, easily switchable
- **Block 1**: Always user-configurable (manual input)
- **Blocks 2+**: Automatically calculated based on frequency intervals
  - Block 2 = Block 1 start time + frequency
  - Block 3 = Block 2 start time + frequency
  - And so on...
- **Visual Indicators**: Shows "(Auto)" for automated blocks
- **Disabled State**: Automated blocks are grayed out and non-editable

#### 📊 **Smart Schedule Generation**
- **Block-Based Cycling**: Generates trips using proper cycle time logic
- **Service Band Integration**: Applies appropriate service bands based on time periods
- **Performance Protection**: Built-in safety limits prevent infinite loops
  - Max 50 trips per block
  - Max 500 total trips
  - Max 1000 loop iterations
- **Error Handling**: Comprehensive validation and user feedback

### Technical Implementation

#### **Core Types & Interfaces**
```typescript
interface BlockConfiguration {
  blockNumber: number;
  startTime: string;
  endTime: string;
}

interface Schedule {
  cycleTimeMinutes: number;
  automateBlockStartTimes: boolean;
  blockConfigurations: BlockConfiguration[];
  // ... other properties
}
```

#### **Key Functions**
- `calculateAutomatedStartTime()`: Computes automated block start times
- `generateTrips()`: Creates comprehensive trip schedules with safety limits
- `timeToMinutes()` / `minutesToTime()`: Enhanced time utilities with bounds checking

#### **Performance & Safety**
- **Input Validation**: Comprehensive checks for all user inputs
- **Circuit Breakers**: Prevents infinite loops and browser freezing
- **Memory Protection**: Limits on trip generation and processing
- **Error Recovery**: Graceful degradation with clear error messages

### User Experience Flow

1. **Configuration Setup**
   - Set number of buses (creates dynamic block cards)
   - Configure cycle time (unrestricted user input)
   - View auto-calculated frequency display
   - Toggle automation (default ON)

2. **Block Management**
   - Edit Block 1 start/end times (always manual)
   - Automated blocks show calculated start times
   - Visual feedback for automated vs manual blocks
   - Real-time frequency updates

3. **Schedule Generation**
   - Click "Generate Schedule with Block-Based Cycling"
   - System generates trips with proper spacing
   - Switch to Schedule tab to view results
   - Export capabilities available

### Navigation Integration
- **Access**: Dashboard → Draft Schedules → Timepoint Page → Block Configuration
- **Breadcrumb Navigation**: Clear path showing current location
- **Back Navigation**: Easy return to previous screens
- **Context Preservation**: Maintains schedule data across navigation

### Migration & Compatibility
- **Backward Compatibility**: Existing schedules automatically upgraded
- **Default Values**: New properties default to optimal settings
- **localStorage Integration**: Preserves user preferences
- **Type Safety**: Full TypeScript coverage with proper migrations

## Common Tasks

### Adding New Excel Format Support
1. Update `src/utils/formatDetector.ts` with detection logic
2. Extend `src/utils/excelParser.ts` parsing logic
3. Add validation rules in `src/utils/validator.ts`
4. Update types in `src/types/excel.ts`

### Adding New Export Formats
1. Create new utility in `src/utils/` (e.g., `pdfExporter.ts`)
2. Update `src/components/SummaryDisplay.tsx` with export button
3. Extend `src/types/schedule.ts` if needed

### Security Considerations
- **Always validate file uploads** using existing security functions
- **Sanitize all user inputs** before processing or display
- **Monitor memory usage** during processing operations
- **Use secure error handling** to prevent information disclosure

## Performance Notes
- Batch processing for large datasets (50 trip chunks)
- Memoized calculations in React components
- Efficient matrix algorithms for travel time calculations
- Circuit breaker prevents cascade failures
- Memory monitoring with automatic limits

## Troubleshooting

### Common Issues
1. **TypeScript compilation errors**: Run `npx tsc --noEmit` to check
2. **File upload failures**: Check security validation logs
3. **Memory issues**: Review circuit breaker status and file size
4. **Export problems**: Verify data format and browser compatibility
5. **Block Configuration issues**: Check automation toggle state and cycle time values
6. **Schedule generation problems**: Review console logs for safety limit warnings
7. **Page unresponsive errors**: Indicate infinite loops - check trip generation safety limits

### Debug Information
- Console logs include security validation details
- Error messages are sanitized but include error codes
- Memory usage is monitored and logged
- File processing includes detailed validation feedback

## Summary Schedule System

### Overview
The Summary Schedule (src/pages/BlockSummarySchedule.tsx) provides a professional, transit-industry-standard display of generated bus schedules with advanced editing capabilities and real-time cascading updates.

### Key Features

#### **Professional Transit Display**
- **Industry-Standard Layout**: Timepoint columns with departure/arrival times matching professional transit schedules
- **Service Band Integration**: Color-coded service bands (Fastest, Fast, Standard, Slow, Slowest) with visual chips
- **Block-Based Organization**: Trips organized by bus blocks with proper cycling logic
- **Performance Metrics**: Trip time, recovery time, travel time, and recovery percentage calculations

#### **Advanced Time Display Logic**
- **Origin Timepoint**: Shows "dep:" (departure) for first timepoint - where trips begin
- **Intermediate Timepoints**: Shows "arr:" (arrival) + optional "dep:" if recovery time > 0
- **Destination Timepoint**: Shows "arr:" (arrival) - where trips end
- **Smart Recovery Display**: Only shows separate departure time when there's actual dwell time

#### **Inline Dwell Time Editing**
- **Click-to-Edit**: Click any dwell time ("Xmin dwell") to instantly edit
- **Auto-Select**: Input value is automatically selected for immediate replacement
- **Keyboard Navigation**: Enter/Tab saves, Escape cancels, seamless editing flow
- **Visual Feedback**: Enhanced styling with hover effects and edit state indicators
- **Real-Time Validation**: Only accepts numeric input (0-99 minutes)

#### **Intelligent Cascading Updates**
- **Trip-Level Cascading**: When recovery time changes, all subsequent stops in that trip update
- **Block-Level Cascading**: When final stop recovery changes, all subsequent trips in the block shift
- **Simplified Start Logic**: Next trip starts when previous trip departs (departure time already includes recovery)
- **Automatic Refresh**: Schedule display updates immediately with all cascading changes
- **Persistence**: Changes save to localStorage and maintain state across sessions

### Technical Implementation

#### **Core Logic**
```typescript
// Trip start time calculation
nextTrip.startTime = previousTrip.departureTime;

// Departure time calculation at each stop
departureTime = arrivalTime + recoveryTime;

// Cascading update logic
if (recoveryTimeChanged) {
  updateCurrentTripSubsequentStops();
  updateAllSubsequentTripsInBlock();
  refreshScheduleDisplay();
}
```

#### **Key Functions**
- `handleRecoverySubmit()`: Processes dwell time edits with full cascading
- `updateSubsequentTripTimes()`: Updates times within current trip
- `updateSubsequentTripsInBlock()`: Updates all later trips in same block
- `timeStringToMinutes()` / `minutesToTime()`: Time conversion utilities

#### **State Management**
- **React State**: Schedule state with real-time updates
- **localStorage**: Persistent schedule storage across sessions
- **Optimistic Updates**: UI updates immediately, saves asynchronously
- **Conflict Resolution**: Last write wins with visual feedback

### User Experience Flow

1. **Schedule Display**
   - Professional tabular layout with timepoint columns
   - Color-coded service bands and block organization
   - Clear arrival/departure time distinctions
   - Editable dwell times with visual indicators

2. **Inline Editing**
   - Click any dwell time → input appears with value selected
   - Type new number → immediately replaces selected value
   - Save via Enter/Tab/click-outside → triggers cascading updates
   - Escape → cancels edit and reverts to original value

3. **Cascading Updates**
   - Immediate visual feedback as changes propagate
   - All affected trips update their times automatically
   - Schedule maintains transit operational constraints
   - Changes persist and survive page refreshes

### Performance & Accuracy

#### **Virtualization Support**
- **Large Schedule Handling**: Supports 500+ trips with virtual scrolling
- **Memory Efficiency**: Only renders visible rows for performance
- **Smooth Scrolling**: Maintains 60fps even with large datasets

#### **Real-Time Calculations**
- **Instant Updates**: No loading states for cascading changes
- **Accurate Timing**: Maintains proper block cycling constraints
- **Consistent Logic**: Same calculation engine used throughout

### Transit Industry Compliance

#### **Professional Standards**
- **GTFS-Compatible**: Time formats match transit industry standards
- **Operator-Friendly**: Layout familiar to transit schedulers
- **Block Cycling**: Proper bus turnaround time calculations
- **Recovery Time Management**: Industry-standard dwell time handling

#### **Operational Accuracy**
- **Trip Chaining**: Buses can only start next trip after completing previous
- **Schedule Constraints**: Maintains feasible operating scenarios
- **Time Precision**: Minute-level accuracy for operational planning

## Service Band Logic Implementation

### Service Band Assignment Process
The service band system uses a **trip-specific lookup approach** based on TimePoints analysis data:

1. **Individual Trip Assessment**: Each trip gets its own service band based on its specific departure time
2. **Time Period Matching**: Match departure time to corresponding time period ("16:00 - 16:29")
3. **Service Band Lookup**: Retrieve pre-assigned service band from TimePoints data for that time period
4. **Dynamic Travel Time Calculation**: Use trip-specific service band data for actual travel time calculations

### Service Band Categories
- **Fastest Service** (Green): Shortest travel times (e.g., 35min travel + 9min recovery = 44min total)
- **Fast Service** (Light Green): Short travel times (e.g., 37-38min total)  
- **Standard Service** (Orange): Average travel times (e.g., 39min total)
- **Slow Service** (Orange): Longer travel times (e.g., 40min total)
- **Slowest Service** (Red): Longest travel times (e.g., 41min+ total)

### Advanced Implementation Details

#### **Trip-Specific Service Band Assignment**
```typescript
// Each trip gets its own service band based on departure time
const tripServiceBandName = getServiceBandForTime(currentDepartureTime, timePeriodServiceBands);
const tripServiceBand = findServiceBand(schedule.serviceBands, tripServiceBandName);

// Use trip-specific service band for travel time calculations
const segmentTime = tripServiceBand.segmentTimes[index - 1];
```

#### **Key Implementation Points**
- **Per-Trip Calculation**: Service bands determined individually for each trip, not per block
- **Dynamic Travel Times**: Each trip uses its own service band's travel time data
- **Time-Based Accuracy**: Reflects actual traffic conditions at trip departure time
- **Recovery Time Integration**: Includes stop-specific recovery times in schedule display

#### **Real-World Examples**
- **Early Morning Trip (07:00)**: "Fastest Service" - minimal traffic, fastest travel times
- **Rush Hour Trip (08:30)**: "Standard Service" - moderate traffic conditions  
- **Afternoon Trip (16:00)**: "Slow Service" - heavy traffic, longer travel times
- **Evening Trip (20:00)**: "Fast Service" - lighter evening traffic

### Recovery Time Display
- **Timepoint Columns**: Show departure time + recovery time (e.g., "07:44 +2min")
- **Recovery Logic**: 
  - First timepoint: 0 minutes (departure only)
  - Middle timepoints: 1-2 minutes 
  - Last timepoint: 3 minutes (end-of-route recovery)
- **Visual Format**: Main time in bold, recovery time in smaller gray text below

### Performance & Accuracy
- **Data-Driven**: Service bands based on actual TimePoints analysis data
- **Time-Sensitive**: Reflects real traffic patterns throughout the day
- **Consistent Calculation**: Same logic used for both trip generation and display

## Schedule Summary Statistics

### Overview
The Schedule Summary displays comprehensive statistics about the generated bus schedule, providing transit operators with key performance metrics at a glance.

### Statistics Display Order
1. **Total Trip Time** - Complete journey time including all recovery/dwell time at stops
2. **Total Travel Time** - Pure movement time excluding recovery periods  
3. **Total Recovery Time** - Cumulative dwell time at all stops
4. **Average Recovery Percent** - Recovery time as percentage of travel time
5. **Total Trips** - Number of active trips in the schedule

### Calculation Methods

#### Column-Based Summation
All totals are calculated by summing the actual displayed column values from the schedule table:
- **Total Trip Time** = Sum of all Trip Time column values (first departure to last departure)
- **Total Travel Time** = Sum of all Travel Time column values (trip time minus recovery)
- **Total Recovery Time** = Sum of all Recovery Time column values

#### Average Recovery Percent Formula
```
Average Recovery % = (Total Recovery Time ÷ Total Travel Time) × 100
```
This metric shows what percentage of recovery time is added on top of base travel time. For example:
- 25% means 15 minutes of recovery for every 60 minutes of travel
- 50% means 30 minutes of recovery for every 60 minutes of travel

### Visual Design
- **Color-coded cards** with distinct backgrounds for easy identification
- **Monospace fonts** for time values ensuring proper alignment
- **Descriptive captions** explaining each metric's meaning
- **Professional Material-UI styling** matching transit industry standards

## System Architecture Diagrams

### Schedule Generation Flow
```
CSV Upload → Format Detection → TimePoint Analysis
     ↓              ↓                    ↓
  Validation   Auto-detect      Service Band Creation
     ↓          Headers                  ↓
  Storage   →   Draft Save   →   Block Configuration
                                        ↓
                              Summary Schedule Generation
                                        ↓
                                  Export (CSV/Excel)
```

### Cascading Update Flow
```
User edits recovery time at Stop 3
            ↓
Update Stop 3 departure time
            ↓
Cascade within trip (Stops 4-5)
            ↓
Is last stop changed?
     ↓          ↓
    No         Yes
     ↓          ↓
   Done    Update next trip start
                ↓
          Cascade to all subsequent
           trips in same block
```

### Data Flow Architecture
```
┌─────────────┐     ┌──────────────┐     ┌────────────┐
│   Pages/    │────▶│   Hooks/     │────▶│  Domain/   │
│ Components  │     │  Services    │     │   Logic    │
└─────────────┘     └──────────────┘     └────────────┘
       ↑                    │                    │
       │                    ↓                    │
       │            ┌──────────────┐            │
       └────────────│    State     │◀───────────┘
                    │  Management  │
                    └──────────────┘
```

## Common Development Gotchas

### 1. Recovery Time vs Travel Time
- **Recovery Time**: Dwell time at stops (waiting/loading passengers)
- **Travel Time**: Pure movement time between stops
- **Trip Time**: Total time = Travel Time + Recovery Time
- **Common Mistake**: Confusing recovery (dwell) with travel (movement)

### 2. Cascading Updates
**Gotcha**: Changes cascade within trip first, then to subsequent trips
```javascript
// WRONG - Cascading to all trips immediately
trips.forEach(trip => updateAllStops(trip));

// RIGHT - Update current trip, then cascade if needed
const updatedTrip = updateCurrentTrip(trip);
if (isLastStop) cascadeToSubsequentTrips(updatedTrip);
```

### 3. Block Boundaries
**Gotcha**: Cascading NEVER crosses block boundaries
```javascript
// WRONG - Updating all trips regardless of block
const nextTrip = trips.find(t => t.tripNumber === currentTrip.tripNumber + 1);

// RIGHT - Only update within same block
const nextTrip = trips.find(t => 
  t.blockNumber === currentTrip.blockNumber && 
  t.tripNumber === currentTrip.tripNumber + 1
);
```

### 4. Time String Format
**Gotcha**: Always use HH:MM format (24-hour)
```javascript
// WRONG
"7:00"    // Missing leading zero
"07:00 AM" // 12-hour format

// RIGHT
"07:00"   // Correct format
"19:00"   // 7 PM in 24-hour
```

### 5. localStorage Limits
**Gotcha**: Browser localStorage has 5-10MB limit
```javascript
// WRONG - Storing large datasets without checking
localStorage.setItem('bigData', JSON.stringify(hugeArray));

// RIGHT - Check size and handle errors
try {
  const data = JSON.stringify(scheduleData);
  if (data.length > 4 * 1024 * 1024) { // 4MB safety limit
    console.warn('Data too large for localStorage');
  }
  localStorage.setItem('schedule', data);
} catch (e) {
  console.error('Storage quota exceeded');
}
```

### 6. React Re-render Performance
**Gotcha**: Large schedule tables can cause performance issues
```javascript
// WRONG - Re-calculating on every render
const stats = calculateExpensiveStats(schedule);

// RIGHT - Memoize expensive calculations
const stats = useMemo(() => 
  calculateExpensiveStats(schedule),
  [schedule.trips] // Only recalculate when trips change
);
```

### 7. Service Band Assignment
**Gotcha**: Service bands are trip-specific, not block-specific
```javascript
// WRONG - Assigning service band to entire block
block.serviceBand = 'Standard Service';

// RIGHT - Each trip gets its own service band
trip.serviceBand = getServiceBandForTime(trip.departureTime);
```

### 8. File Upload Security
**Gotcha**: Never trust file extensions alone
```javascript
// WRONG - Only checking extension
if (file.name.endsWith('.xlsx')) processExcel(file);

// RIGHT - Check MIME type AND magic bytes
if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' &&
    await verifyMagicBytes(file)) {
  processExcel(file);
}
```

## Performance Optimization Tips

### Virtualization Thresholds
```javascript
const getVirtualizationStrategy = (tripCount: number) => {
  if (tripCount < 100) return 'none';
  if (tripCount < 500) return 'optional';
  if (tripCount < 1000) return 'required';
  return 'pagination'; // > 1000 trips
};
```

### Memoization Patterns
```javascript
// Memoize with multiple dependencies
const memoizedValue = useMemo(() => 
  expensiveCalculation(a, b, c),
  [a, b, c] // Only recalculate when these change
);

// Memoize callbacks to prevent re-renders
const handleClick = useCallback((id) => {
  doSomething(id);
}, []); // Empty deps if function doesn't use external values
```

## Production Readiness Status: ✅ COMPLETE
- All core features implemented and tested
- Security vulnerabilities addressed with comprehensive mitigations
- Professional UI with Material-UI components
- Type-safe TypeScript throughout
- Export functionality matching Excel format standards
- Error handling and validation comprehensive
- Schedule summary statistics with accurate column-based calculations

**Last Updated**: August 26, 2025  
**Security Level**: Production Ready with comprehensive protections  
**MVP Status**: Complete and ready for deployment with advanced Bus Block Configuration system and trip-specific service band logic  
**Migration Status**: Fully migrated to React 19, Material-UI v7, TypeScript 5.9, and React Router v7  
**Recent Enhancements**: Schedule summary statistics with proper column summation and recovery percentage calculations