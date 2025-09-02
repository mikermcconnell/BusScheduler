# CLAUDE.md - Scheduler2 Application Guide

## Quick Start

### Setup & Test (5 minutes)
1. `npm install` → Copy `.env.example` to `.env` → `npm start`
2. Upload `example_schedule/Raw_Data.csv` to test
3. Verify: TimePoints charts → Block Configuration → Summary Schedule → Export

## Project Overview
**Scheduler2** is a production-ready bus route scheduling application that processes CSV files to generate professional transit schedules. Built with React 19, TypeScript 5.9, Material-UI v7, and Firebase integration.

**Purpose**: Automate conversion of raw schedule data into formatted schedules for weekday/Saturday/Sunday service patterns.

## Tech Stack & Commands
- **Frontend**: React 19 + TypeScript 5.9 + Material-UI v7 + React Router DOM v7
- **Processing**: xlsx library for Excel/CSV handling
- **Testing**: Jest + React Testing Library v16, Vitest v3
- **Storage**: localStorage + Firebase Cloud Firestore

```bash
npm start          # Development server (localhost:3000)
npm run build      # Production build
npm test           # Jest tests
npx tsc --noEmit   # TypeScript check
```

## Core Features
1. **File Upload & Processing** - Drag/drop with validation, smart format detection
2. **Schedule Generation** - Travel time calculations, multi-day support, service band integration
3. **Security Hardened** - XSS prevention, file validation, memory protection (5MB max, magic byte verification)
4. **Professional Export** - CSV/Excel export matching transit industry standards
5. **Draft Management** - Auto-save with localStorage + Firebase cloud backup
6. **Inline Editing** - Real-time cascading updates, click-to-edit recovery times
7. **Advanced UI** - Duolingo-style Block Configuration, professional transit display

## Project Structure
```
src/
├── components/     # FileUpload, SummaryDisplay, Layout, Navigation, etc.
├── pages/         # Dashboard, UploadSchedule, TimePoints, BlockConfiguration, etc.
├── services/      # scheduleService, firebaseStorage, workflowDraftService, etc.
├── utils/         # calculator, csvParser, formatDetector, inputSanitizer, etc.
├── types/         # schedule.ts, excel.ts (TypeScript definitions)
├── hooks/         # useFileUpload, useFirebaseAuth
```

## Key Types & File Formats

### Core Types (src/types/schedule.ts)
- `TimePoint`, `Trip`, `ProcessedSchedule`, `ValidationResult`
- `BlockConfiguration`, `ServiceBand`, `DayType`

### Input: Raw Data CSV
- **Structure**: Route segments with travel time percentiles by 30-minute periods
- **Data Rows**: 25%/50%/80%/90% observed runtimes + scheduled targets
- **Example**: `101 CCW Observed Runtime-50%` for median travel times

### Output: Summary Schedule Excel
- **Professional Layout**: Timepoint columns, departure/arrival times, block organization
- **Industry Standard**: GTFS-compatible format for transit operators
- **Operational Data**: Recovery times, cycle times, service bands

## Security Features ⚠️ CRITICAL
- **File Validation**: MIME type + magic byte verification, size limits (5MB max, 1KB min)
- **XSS Prevention**: HTML entity encoding, attack pattern detection
- **Memory Protection**: 50MB limit, processing timeouts (30s), circuit breaker pattern
- **Input Sanitization**: Length limits, character filtering, secure error handling

## Navigation & Workflow
**Main Flow**: Dashboard → Upload Schedule → TimePoints Analysis → Block Configuration → Summary Schedule → Export

### Key Pages
- **Upload** (`/upload`) - File processing with drag/drop
- **TimePoints** (`/timepoints`) - Interactive travel time analysis, service bands, outlier detection
- **Block Configuration** (`/block-configuration`) - Duolingo-style UI for bus block management
- **Summary Schedule** (`/summary-schedule`) - Professional display with inline editing

## Bus Block Configuration System
### Duolingo-Style UI Features
- **Pill-shaped cards** with colorful gradients and 3D shadows
- **Smart automation**: Block 1 manual, Blocks 2+ auto-calculated (frequency intervals)
- **Safety limits**: Max 50 trips/block, 500 total trips, 1000 iterations

### Configuration Options
- **Number of Buses** (1-10) - Dynamic block creation
- **Cycle Time** (minutes) - User-configurable, unrestricted
- **Service Frequency** - Auto-calculated (Cycle Time ÷ Buses)
- **Automated Start Times** - Toggle control (default ON)

## Summary Schedule System
### Professional Transit Display
- **Industry Layout**: Timepoint columns matching professional schedules
- **Service Bands**: Color-coded (Fastest=Green, Standard=Orange, Slowest=Red)
- **Time Logic**: Origin=departure, Intermediate=arrival+departure, Destination=arrival

### Inline Editing & Cascading Updates
- **Click-to-Edit**: Recovery times with auto-select input
- **Real-time Cascading**: Changes propagate within trip, then to subsequent trips in block
- **Persistence**: localStorage + Firebase sync
- **Recovery Templates**: Service band templates with bulk application

## Service Band Logic
### Trip-Specific Assignment
```typescript
const tripServiceBand = getServiceBandForTime(departureTime, timePeriodBands);
const segmentTime = tripServiceBand.segmentTimes[segmentIndex];
```

### Categories & Examples
- **Fastest** (Green): 35min travel + 9min recovery = 44min total
- **Fast** (Light Green): 37-38min total
- **Standard** (Orange): 39min total  
- **Slow** (Orange): 40min total
- **Slowest** (Red): 41min+ total

## Schedule Statistics
### Display Order & Calculations
1. **Total Trip Time** - Complete journey time (sum of Trip Time column)
2. **Total Travel Time** - Pure movement time (sum of Travel Time column)
3. **Total Recovery Time** - Cumulative dwell time (sum of Recovery Time column)
4. **Average Recovery %** - `(Recovery ÷ Travel) × 100`
5. **Total Trips** - Active trip count

## Firebase Integration
### Setup & Data Structure
```
/schedules/{id}: userId, routeName, status, tripCount, summarySchedule, timestamps
/draft_schedules/{id}: userId, fileName, uploadedData, processingStep, timestamps
```

### Features
- **Cloud backup**, **cross-device sync**, **offline support**
- **User authentication** (email/password, Google, anonymous)
- **Seamless migration** from localStorage

## Technical Implementation

### Key Functions
```typescript
// Core Services
processSchedule(file: File): Promise<ProcessedSchedule>
generateTrips(config: BlockConfiguration[]): Trip[]
calculateTravelTimes(timePoints: TimePoint[]): TravelMatrix

// Time Utilities
timeToMinutes(timeStr: string): number
minutesToTime(minutes: number): string
addMinutes(timeStr: string, minutes: number): string

// Security
sanitizeString(input: string): string
validateFileUpload(file: File): ValidationResult
detectAttackPatterns(input: string): boolean
```

### Cascading Update Logic
```typescript
// Core algorithm
nextTrip.startTime = previousTrip.departureTime;
departureTime = arrivalTime + recoveryTime;

if (recoveryTimeChanged) {
  updateCurrentTripSubsequentStops();
  updateAllSubsequentTripsInBlock();
  refreshScheduleDisplay();
}
```

## Development Guidelines

### Performance Boundaries
- **< 100 trips**: Standard rendering
- **100-500 trips**: Optional virtualization
- **500+ trips**: Required virtualization
- **Memory limits**: 4MB localStorage, 50MB processing

### Security Checklist
- Always validate file uploads with existing functions
- Sanitize inputs before processing/display
- Monitor memory usage during operations
- Use secure error handling

### Common Gotchas
1. **Recovery vs Travel Time**: Recovery = dwell time, Travel = movement time
2. **Cascading Logic**: Update current trip first, then cascade if last stop changed
3. **Time Format**: Use "07:00" (24-hour), not "7:00 AM"
4. **Block Boundaries**: Only cascade within same block number

## Testing Strategy
### Test Data Location: `test-data/`
- `small-schedule.csv` (10 trips), `medium-schedule.csv` (100 trips)
- `large-schedule.csv` (1000 trips), `edge-cases.csv`, `malformed.csv`

### Edge Cases
- Empty/malformed CSV, files > 5MB, negative travel times
- 24-hour wraparound, circular routes, express services
- XSS payloads, path traversal, buffer overflow attempts

## Troubleshooting

### File Upload Issues
- "Format not supported" → Check extension + MIME type
- "File too large" → 5MB limit enforced
- "Processing timeout" → 30-second limit

### Performance Issues
- Browser freezing → Enable virtualization
- Slow rendering → Check memoization
- Export failures → Browser memory limits

### Debug Commands
```javascript
console.log(scheduleStorage.getAllSchedules()); // Check data
localStorage.clear(); // Reset storage
console.log(performance.memory); // Monitor memory
```

## Architecture Diagrams

### Schedule Generation Flow
```
CSV Upload → Format Detection → TimePoint Analysis → Service Bands
    ↓             ↓                    ↓                 ↓
Validation → Auto-detect Headers → Block Config → Summary Schedule → Export
```

### Cascading Updates
```
User edits recovery → Update stop departure → Cascade within trip
                                ↓
                        Is last stop changed?
                           ↓         ↓
                         No        Yes → Update next trip → Cascade to block
```

## Production Status: ✅ COMPLETE+

### MVP+ Features ✅
- Core features, security mitigations, professional UI
- Type-safe TypeScript, export functionality, error handling
- Statistics, cascading updates, block configuration
- Recovery templates, Firebase integration, virtualization

### Performance Benchmarks
- **Initial Load**: < 3s, **Generation**: < 5s (500 trips)
- **Cascading Updates**: < 100ms, **Export**: < 2s
- **Quality**: 85%+ coverage, WCAG AA, 90+ Lighthouse

---
**Version**: 2.1.0 | **Status**: Production Ready | **Updated**: January 2025
**Stack**: React 19, Material-UI v7, TypeScript 5.9, Router v7, Firebase