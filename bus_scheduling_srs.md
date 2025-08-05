# Bus Route Scheduling System - Software Requirements Specification

## System Design

- **Application Type**: Desktop web application using Electron framework
- **Target Platform**: Windows 10/11 with dual monitor support
- **User Interface**: Single-page application (SPA) with multiple panels and tabs
- **Data Processing**: Client-side calculations with local data storage
- **Performance Requirements**: Handle 40+ trips with 15 time points, real-time updates
- **Integration**: Excel file import/export, Windows file system access

## Architecture Pattern

- **Pattern**: Model-View-Controller (MVC) with Component-Based Architecture
- **Frontend Structure**: React components organized by feature modules
- **State Management**: Centralized state with Redux for complex data flows
- **Event-Driven**: User interactions trigger state updates and recalculations
- **Modular Design**: Separate modules for scheduling logic, validation, export, and UI components

## State Management

- **Primary Store**: Redux Toolkit for application state management
- **State Structure**:
  - `routes`: Current route data, time points, travel times
  - `scenarios`: Multiple scheduling scenarios with comparison data
  - `ui`: Panel visibility, active tabs, validation states
  - `calculations`: Generated schedules, validation results
  - `preferences`: User settings, window positions, saved layouts
- **Local Storage**: Persist user preferences and recent work
- **Session Management**: Auto-save functionality with recovery on restart

## Data Flow

- **User Input**: Form inputs → State validation → Store updates → UI re-render
- **Calculations**: Travel time changes → Background calculations → Schedule updates → Validation checks
- **File Operations**: Excel import → Data parsing → State population → Validation → UI update
- **Export Process**: Current state → Data formatting → Excel generation → File system write
- **Real-time Updates**: State changes → Derived data recalculation → Component re-rendering

## Technical Stack

- **Frontend Framework**: React 18 with TypeScript
- **Desktop Framework**: Electron (for native desktop features)
- **State Management**: Redux Toolkit with React-Redux
- **UI Library**: Material-UI (MUI) for consistent design system
- **Table Component**: React-Data-Grid for high-performance tables
- **File Processing**: SheetJS for Excel import/export
- **Build Tool**: Vite for fast development and building
- **Package Manager**: npm
- **Code Quality**: ESLint + Prettier for code formatting

## Authentication Process

- **Authentication Type**: Local application (no server authentication required)
- **User Session**: Local session management with auto-timeout
- **Data Security**: Local file encryption for sensitive route data
- **Access Control**: Optional password protection for saved scenarios
- **Backup Integration**: Optional cloud backup (OneDrive/Google Drive) with user consent

## Route Design

- **Main Navigation**: Tab-based workflow (Data Input | Schedule Generation | Scenarios | Export)
- **Primary Routes**:
  - `/` - Dashboard with recent routes
  - `/route/:id/input` - Time points and travel time configuration
  - `/route/:id/schedule` - Generated schedule editing
  - `/route/:id/scenarios` - Scenario management and comparison
  - `/route/:id/export` - Export options and file generation
- **Secondary Panels**: Context-sensitive panels on second monitor
- **State Routing**: URL reflects current route and active scenario

## API Design

- **Architecture**: Client-side only (no server API required)
- **File System API**: Electron's native file system access
- **Data Processing API**:
  - `calculateSchedule(timePoints, travelTimes, timeBands)` - Generate trip schedules
  - `validateSchedule(schedule)` - Check for conflicts and errors
  - `exportExcel(schedule, format)` - Generate Excel files
  - `importExcel(filePath)` - Parse Excel data
  - `compareScenarios(scenario1, scenario2)` - Generate comparison data

## Database Design ERD

```
Routes
├── id (Primary Key)
├── name
├── description
├── created_date
├── modified_date
└── active_scenario_id

TimePoints
├── id (Primary Key)
├── route_id (Foreign Key)
├── sequence_order
├── name
├── location
└── description

TravelTimes
├── id (Primary Key)
├── route_id (Foreign Key)
├── from_timepoint_id (Foreign Key)
├── to_timepoint_id (Foreign Key)
├── time_band_id (Foreign Key)
├── percentile_50th
└── percentile_80th

TimeBands
├── id (Primary Key)
├── route_id (Foreign Key)
├── name
├── start_time
├── end_time
└── color_code

Scenarios
├── id (Primary Key)
├── route_id (Foreign Key)
├── name
├── description
├── created_date
├── is_active
└── scenario_data (JSON)

Trips
├── id (Primary Key)
├── scenario_id (Foreign Key)
├── departure_time
├── time_band_id (Foreign Key)
└── calculated_times (JSON)

UserPreferences
├── id (Primary Key)
├── window_positions (JSON)
├── panel_layout (JSON)
├── export_settings (JSON)
└── auto_save_interval
```

**Key Relationships**:
- Routes → TimePoints (One-to-Many)
- Routes → TimeBands (One-to-Many) 
- Routes → Scenarios (One-to-Many)
- TimePoints → TravelTimes (Many-to-Many through junction)
- Scenarios → Trips (One-to-Many)
- TimeBands → TravelTimes (One-to-Many)

This architecture uses SQLite as an embedded database for local data storage, requiring no server setup while providing full relational database capabilities for the complex scheduling data relationships.