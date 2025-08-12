# CLAUDE.md - Scheduler2 Application Guide

## Project Overview
**Scheduler2** is a bus route scheduling application that processes Excel files to generate formatted bus schedules. The app has reached **MVP status** with comprehensive security mitigations implemented.

**Purpose**: Eliminate manual Excel formatting pain points by automating the conversion of raw schedule data into professional, formatted schedules for weekday, Saturday, and Sunday service patterns.

## Tech Stack
- **Frontend**: React 18 + TypeScript
- **UI Framework**: Material-UI v5 (@mui/material)
- **Routing**: React Router DOM v6
- **Excel Processing**: xlsx library
- **Testing**: Jest + React Testing Library, Vitest
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

### Project Structure
```
src/
├── components/           # React UI components
│   ├── FileUpload.tsx   # Material-UI file upload with drag/drop
│   ├── SummaryDisplay.tsx # Professional data display with tabs
│   ├── Layout.tsx       # Main app layout wrapper
│   └── Navigation.tsx   # Navigation bar component
├── hooks/               # Custom React hooks
│   └── useFileUpload.ts # File processing with security validation
├── pages/              # Page-level components (React Router)
│   ├── Dashboard.tsx
│   ├── UploadSchedule.tsx # Main upload and processing page
│   ├── ViewSchedules.tsx
│   ├── ManageRoutes.tsx
│   └── NotFound.tsx
├── services/           # Business logic services
│   └── scheduleService.ts # Service layer orchestrating processing
├── types/              # TypeScript type definitions
│   ├── schedule.ts     # Core schedule types
│   ├── excel.ts        # Excel-specific types
│   └── index.ts        # Re-exports
├── utils/              # Utility functions
│   ├── calculator.ts   # Core travel time calculations
│   ├── excelParser.ts  # Excel file parsing with security
│   ├── formatDetector.ts # Smart format detection algorithms
│   ├── validator.ts    # Data validation engine
│   ├── dataExtractor.ts # High-level extraction orchestration
│   ├── summaryGenerator.ts # Data formatting for export/display
│   ├── excelExporter.ts # Professional Excel export
│   └── inputSanitizer.ts # XSS prevention and input sanitization
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

### Debug Information
- Console logs include security validation details
- Error messages are sanitized but include error codes
- Memory usage is monitored and logged
- File processing includes detailed validation feedback

## Production Readiness Status: ✅ COMPLETE
- All core features implemented and tested
- Security vulnerabilities addressed with comprehensive mitigations
- Professional UI with Material-UI components
- Type-safe TypeScript throughout
- Export functionality matching Excel format standards
- Error handling and validation comprehensive

**Last Updated**: August 11, 2025  
**Security Level**: Production Ready with comprehensive protections  
**MVP Status**: Complete and ready for deployment