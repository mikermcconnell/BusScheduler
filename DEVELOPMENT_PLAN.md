# Scheduler2 MVP Development Plan

## Project Overview
**Goal**: Eliminate Excel formatting pain points and automate repetitive data processing tasks for bus route scheduling.

**Core Workflow**: Excel Upload → Automatic Processing → Formatted Summary Schedule → Export

**Timeline**: 8 weeks (80 hours development + 40 hours testing)

---

## Phase 1: Foundation & Setup (Weeks 1-2)

### Task 1.1: Project Setup
- [ ] **Duration**: 6 hours
- [ ] **Files**: `package.json`, `src/App.tsx`, `src/index.tsx`
- [ ] **Commands**:
  ```bash
  npx create-react-app scheduler2 --template typescript
  npm install xlsx react-router-dom @mui/material @emotion/react
  npm install -D @testing-library/jest-dom @testing-library/react vitest
  ```
- [ ] **Tests**: Basic app rendering, component mounting
- [ ] **Deliverable**: Running React app with TypeScript
- [ ] **Status**: ⏳ Not Started

### Task 1.2: Data Models & Types
- [ ] **Duration**: 4 hours
- [ ] **Files**: `src/types/schedule.ts`, `src/types/excel.ts`
- [ ] **Implementation**:
  ```typescript
  interface TimePoint {
    id: string;
    name: string;
    sequence: number;
  }

  interface TravelTime {
    fromTimePoint: string;
    toTimePoint: string;
    weekday: number;
    saturday: number;
    sunday: number;
  }

  interface SummarySchedule {
    weekday: TravelTimeMatrix;
    saturday: TravelTimeMatrix;
    sunday: TravelTimeMatrix;
    metadata: {
      created: Date;
      timePoints: TimePoint[];
      timeBands: string[];
    };
  }
  ```
- [ ] **Tests**: Type validation, interface compliance
- [ ] **Deliverable**: Complete TypeScript interfaces
- [ ] **Status**: ⏳ Not Started

### Task 1.3: Core Components Structure
- [ ] **Duration**: 4 hours
- [ ] **Files**: `src/components/Layout.tsx`, `src/components/Navigation.tsx`
- [ ] **Tests**: Component rendering, navigation functionality
- [ ] **Deliverable**: Basic app layout with navigation
- [ ] **Status**: ⏳ Not Started

**Phase 1 Completion**: ⏳ 0/3 tasks complete

---

## Phase 2: Excel Import Engine (Weeks 3-4)

### Task 2.1: File Upload Handler
- [ ] **Duration**: 6 hours
- [ ] **Files**: `src/components/FileUpload.tsx`, `src/hooks/useFileUpload.ts`
- [ ] **Implementation**:
  ```typescript
  const handleFileUpload = async (file: File) => {
    const workbook = XLSX.read(await file.arrayBuffer());
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(worksheet);
  };
  ```
- [ ] **Tests**: 
  - [ ] Valid Excel file processing
  - [ ] Invalid file rejection
  - [ ] Large file handling (>10MB)
  - [ ] Corrupted file error handling
- [ ] **Deliverable**: Robust file upload with validation
- [ ] **Status**: ⏳ Not Started

### Task 2.2: Excel Format Detection
- [ ] **Duration**: 8 hours
- [ ] **Files**: `src/utils/excelParser.ts`, `src/utils/formatDetector.ts`
- [ ] **Implementation**: Auto-detect timepoints, travel times, day types
- [ ] **Tests**:
  - [ ] Multiple Excel format variations
  - [ ] Edge cases (empty cells, merged cells)
  - [ ] Data type validation
  - [ ] Format mismatch handling
- [ ] **Deliverable**: Smart format detection system
- [ ] **Status**: ⏳ Not Started

### Task 2.3: Data Extraction & Validation
- [ ] **Duration**: 6 hours
- [ ] **Files**: `src/utils/dataExtractor.ts`, `src/utils/validator.ts`
- [ ] **Tests**:
  - [ ] Travel time reasonableness (0-120 minutes)
  - [ ] Timepoint sequence validation
  - [ ] Missing data handling
  - [ ] Duplicate detection
- [ ] **Deliverable**: Clean, validated data extraction
- [ ] **Status**: ⏳ Not Started

**Phase 2 Completion**: ⏳ 0/3 tasks complete

---

## Phase 3: Processing Engine (Weeks 5-6)

### Task 3.1: Travel Time Calculator
- [ ] **Duration**: 8 hours
- [ ] **Files**: `src/utils/calculator.ts`, `src/services/scheduleService.ts`
- [ ] **Implementation**:
  ```typescript
  const calculateTravelTimes = (timePoints: TimePoint[], travelTimes: TravelTime[]) => {
    // Matrix calculations for weekday/saturday/sunday
    return {
      weekday: buildTravelMatrix(travelTimes, 'weekday'),
      saturday: buildTravelMatrix(travelTimes, 'saturday'),
      sunday: buildTravelMatrix(travelTimes, 'sunday')
    };
  };
  ```
- [ ] **Tests**:
  - [ ] Matrix calculation accuracy
  - [ ] Time band processing
  - [ ] Edge cases (missing connections)
  - [ ] Performance with max data (15x15 matrix)
- [ ] **Deliverable**: Accurate travel time processing
- [ ] **Status**: ⏳ Not Started

### Task 3.2: Summary Schedule Generator
- [ ] **Duration**: 6 hours
- [ ] **Files**: `src/components/SummaryDisplay.tsx`, `src/utils/summaryGenerator.ts`
- [ ] **Tests**:
  - [ ] Summary format correctness
  - [ ] Data aggregation accuracy
  - [ ] Multiple day type handling
  - [ ] Display formatting
- [ ] **Deliverable**: Formatted summary schedules
- [ ] **Status**: ⏳ Not Started

**Phase 3 Completion**: ⏳ 0/2 tasks complete

---

## Phase 4: User Interface & Export (Weeks 7-8)

### Task 4.1: Data Display Components
- [ ] **Duration**: 8 hours
- [ ] **Files**: `src/components/DataTable.tsx`, `src/components/TravelTimeMatrix.tsx`
- [ ] **Tests**:
  - [ ] Table rendering with large datasets
  - [ ] Sorting and filtering functionality
  - [ ] Responsive design
  - [ ] Accessibility compliance
- [ ] **Deliverable**: Interactive data display
- [ ] **Status**: ⏳ Not Started

### Task 4.2: Excel Export
- [ ] **Duration**: 6 hours
- [ ] **Files**: `src/utils/excelExporter.ts`, `src/components/ExportButton.tsx`
- [ ] **Implementation**:
  ```typescript
  const exportToExcel = (summaryData: SummarySchedule) => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(summaryData.weekday);
    XLSX.utils.book_append_sheet(wb, ws, "Weekday");
    XLSX.writeFile(wb, "schedule-summary.xlsx");
  };
  ```
- [ ] **Tests**:
  - [ ] Export format validation
  - [ ] File generation accuracy
  - [ ] Large dataset export performance
  - [ ] Cross-platform compatibility
- [ ] **Deliverable**: Professional Excel exports
- [ ] **Status**: ⏳ Not Started

**Phase 4 Completion**: ⏳ 0/2 tasks complete

---

## Testing Strategy

### Unit Tests (Jest + React Testing Library)
- [ ] **Travel Time Calculator Tests**
  ```typescript
  describe('TravelTimeCalculator', () => {
    test('calculates correct travel times between timepoints', () => {
      const result = calculateTravelTimes(mockTimePoints, mockTravelTimes);
      expect(result.weekday[0][1]).toBe(expectedTime);
    });

    test('handles missing travel time data gracefully', () => {
      const result = calculateTravelTimes(mockTimePoints, incompleteTravelTimes);
      expect(result.errors).toHaveLength(expectedErrorCount);
    });
  });
  ```

- [ ] **Excel Parser Tests**
  - [ ] Valid file format detection
  - [ ] Invalid file rejection
  - [ ] Data extraction accuracy
  - [ ] Error handling scenarios

- [ ] **Data Validation Tests**
  - [ ] Travel time bounds checking
  - [ ] Timepoint sequence validation
  - [ ] Missing data detection
  - [ ] Duplicate handling

### Integration Tests
- [ ] **Complete Workflow Tests**
  - [ ] Excel import → processing → export pipeline
  - [ ] File upload → validation → display workflow
  - [ ] Error handling across components
  - [ ] State management throughout process

### Performance Tests
- [ ] **Load Testing**
  - [ ] Large file processing (1000+ rows)
  - [ ] Memory usage monitoring
  - [ ] Response time benchmarks
  - [ ] Concurrent user simulation

### User Acceptance Tests
- [ ] **End-to-End Scenarios**
  - [ ] Complete workflow simulation with real data
  - [ ] Excel file format compatibility
  - [ ] Export format verification
  - [ ] Error recovery testing

---

## Progress Tracking

### Overall Progress
- **Phase 1**: ⏳ 0/3 tasks (0%)
- **Phase 2**: ⏳ 0/3 tasks (0%)
- **Phase 3**: ⏳ 0/2 tasks (0%)
- **Phase 4**: ⏳ 0/2 tasks (0%)
- **Testing**: ⏳ 0/4 categories (0%)

**Total Progress**: 0/10 major tasks complete (0%)

### Key Milestones
- [ ] **Week 2**: Foundation complete, can run basic React app
- [ ] **Week 4**: Excel import working, can process files
- [ ] **Week 6**: Processing engine complete, generates summaries
- [ ] **Week 8**: MVP complete with export functionality

---

## Development Environment Setup

### Prerequisites
- [ ] Node.js 18+ installed
- [ ] npm or yarn package manager
- [ ] Code editor with TypeScript support
- [ ] Git for version control

### Initial Setup Commands
```bash
# Create React app with TypeScript
npx create-react-app scheduler2 --template typescript
cd scheduler2

# Install core dependencies
npm install xlsx react-router-dom @mui/material @emotion/react @emotion/styled

# Install development dependencies
npm install -D @testing-library/jest-dom @testing-library/react @testing-library/user-event
npm install -D @types/node vitest @vitejs/plugin-react

# Start development server
npm start
```

### Project Structure
```
scheduler2/
├── public/
├── src/
│   ├── components/
│   │   ├── FileUpload.tsx
│   │   ├── DataTable.tsx
│   │   ├── SummaryDisplay.tsx
│   │   └── Layout.tsx
│   ├── hooks/
│   │   └── useFileUpload.ts
│   ├── types/
│   │   ├── schedule.ts
│   │   └── excel.ts
│   ├── utils/
│   │   ├── excelParser.ts
│   │   ├── calculator.ts
│   │   ├── validator.ts
│   │   └── excelExporter.ts
│   ├── services/
│   │   └── scheduleService.ts
│   └── App.tsx
├── tests/
└── package.json
```

---

## Success Criteria

### MVP Success Metrics
1. **Pain Point Elimination**:
   - [ ] Reduces Excel formatting time from hours to minutes
   - [ ] Eliminates manual data entry errors
   - [ ] Automates repetitive calculation tasks

2. **Functional Requirements**:
   - [ ] Successfully imports Excel files with travel time data
   - [ ] Generates accurate summary schedules for weekday/Saturday/Sunday
   - [ ] Exports professionally formatted Excel reports
   - [ ] Handles edge cases and provides clear error messages

3. **Quality Requirements**:
   - [ ] 90%+ test coverage
   - [ ] Loads files under 5 seconds
   - [ ] Processes data without errors
   - [ ] Intuitive user interface requiring minimal training

4. **User Acceptance**:
   - [ ] Route planners can complete full workflow independently
   - [ ] Output matches or exceeds current Excel format quality
   - [ ] Reduces overall scheduling preparation time by 50%+

---

## Risk Mitigation

### Technical Risks
- [ ] **Excel Format Variations**: Implement comprehensive format detection
- [ ] **Performance Issues**: Use virtualization and optimization techniques
- [ ] **Data Integrity**: Implement robust validation and error handling
- [ ] **Browser Compatibility**: Test across major browsers

### User Adoption Risks
- [ ] **Learning Curve**: Design familiar interface similar to Excel
- [ ] **Data Trust**: Provide transparent processing and validation feedback
- [ ] **Workflow Integration**: Ensure output formats match existing processes

---

## Notes & Updates

### Development Log
*Updates will be added here as tasks are completed*

### Issues & Resolutions
*Technical challenges and solutions will be documented here*

### Feature Requests
*Additional features discovered during development*

---

**Last Updated**: 2025-08-05
**Next Review**: After Phase 1 completion