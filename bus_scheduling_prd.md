# Bus Route Scheduling System - Product Requirements Document

## 1. Elevator Pitch

The Bus Route Scheduling System is an internal web application that modernizes transit route planning by replacing complex Excel-based processes with a standardized, user-friendly interface. Route planners input real-time travel data and time points to automatically generate optimized bus schedules, summary reports, and connection assessments, reducing setup time from hours to minutes while ensuring consistency across all routes and enabling scenario comparison for better decision-making.

## 2. Who is this app for

**Primary Users:** Transit Route Planners
- Internal staff responsible for creating and updating bus route schedules
- Users who currently work with Excel-based scheduling templates
- Planners who need to create schedules quarterly (every 4 months)
- Staff who require extensive editing capabilities and scenario comparison tools

## 3. Functional Requirements

### Core Scheduling Features

#### Data Input Management
- **Time Point Configuration:**
  - Create sequential stops along a route (up to 15 time points maximum)
  - Define time point names, locations, and sequence order
  - Validate logical sequence and prevent duplicate entries
  
- **Travel Time Input:**
  - Input 50th and 80th percentile real travel times between consecutive time points (Point A to Point B)
  - Support time entry in minutes and seconds format
  - Store multiple travel time sets for different time bands
  
- **Time Band Management:**
  - Create custom time bands (e.g., early morning, morning, midday, peak, evening, night)
  - Define time ranges for each band (user-configurable start/end times)
  - Assign different travel times to each time band based on real-time data
  - Example: 6-8 AM band = 60 minutes total trip time, 8-10 AM band = 65 minutes total trip time
  
- **Trip Configuration:**
  - Set fixed departure times for each trip (user-provided)
  - Configure frequency requirements per time band
  - Support up to 40 trips per day per route
  - Define number of trips per time band

#### Schedule Generation Engine
- **Automatic Schedule Creation:**
  - Generate trip schedules based on departure times and time band travel times
  - Calculate arrival times at each time point using sequential travel times
  - Apply time band travel times based on departure time (not arrival time)
  - Create both directions of route if bidirectional
  - Handle trips spanning multiple time bands using departure time band rules
  
- **Schedule Outputs:**
  - **Summary Schedule:** Complete timetable for single route showing all trips and time points
  - **Master Schedule:** Combined Excel document containing all route summaries
  - Display format: Time points as columns, trips as rows, with calculated arrival/departure times
  
- **Real-time Calculation:**
  - Automatically recalculate schedules when travel times or frequencies change
  - Update dependent trips when modifications are made
  - Maintain schedule integrity across all time bands

#### Data Validation & Quality Control
- **Travel Time Validation:**
  - Check for realistic travel times between consecutive points
  - Flag unusually long or short travel times for review
  - Validate that total trip times are reasonable
  
- **Frequency Validation:**
  - Ensure minimum and maximum frequency limits are respected
  - Check for scheduling conflicts or impossible turnaround times
  - Validate that trip spacing meets operational requirements
  
- **Error Highlighting:**
  - Real-time error detection with specific error descriptions
  - Visual highlighting of problematic cells or inputs
  - Suggestion system for common fixes

### Advanced Features

#### Bus Blocking (Nice-to-Have)
- **Specific Vehicle Tracking:**
  - Assign specific vehicle numbers/IDs to trip sequences (Block 1, Block 2, etc.)
  - Allow users to select individual blocks and view complete vehicle schedule
  - Display vehicle start time, end time, and all assigned trips
  - Track vehicle location and timing throughout operational day
  
- **Vehicle Assignment:**
  - Assign specific buses to trip sequences
  - Optimize vehicle utilization across daily operations
  - Track vehicle availability and scheduling conflicts
  - Generate vehicle rotation schedules with specific vehicle identifiers
  
- **Resource Management:**
  - Calculate total vehicles needed per route
  - Identify vehicle idle times and potential optimization opportunities
  - Support vehicle maintenance windows and availability constraints
  - Generate block-specific reports showing individual vehicle duties

#### Connection Assessment
- **Transfer Analysis:**
  - Identify potential transfer points between routes
  - Calculate transfer times with 5-minute default minimum (user-editable)
  - Track timed connections between specific trips
  - Generate connection matrices showing transfer opportunities
  - **Connection Quality Indicators:**
    - **Good Connections:** 5-8 minute transfer windows (highlighted in green)
    - **Tight Connections:** Less than 5 minutes (highlighted in yellow/warning)
    - **Long Connections:** More than 8 minutes (highlighted in gray/suboptimal)
  
- **External Schedule Integration:**
  - Import GO train schedules (updated couple times per year)
  - Import Georgian College class schedules
  - Identify optimal connections to external services within 5-8 minute windows
  - Track connection success rates and timing windows
  
- **Connection Optimization:**
  - Suggest schedule adjustments to achieve 5-8 minute connection windows
  - Highlight missed connection opportunities
  - Generate reports on transfer passenger convenience with quality scoring

#### Scenario Management
- **Scenario Creation:**
  - Create multiple scheduling scenarios with different parameters
  - Modify frequencies, number of trips, and travel times between points
  - Save scenarios permanently with descriptive names and dates
  - Clone existing scenarios for comparison testing
  
- **Scenario Comparison:**
  - Side-by-side comparison of up to 3 scenarios
  - Highlight differences in trip times, frequencies, and resource requirements
  - Generate comparison reports showing operational and performance metrics
  - Cost-benefit analysis between scenarios (vehicle hours, passenger convenience)

### System Features

#### Extensive Editing Capabilities
- **Manual Override System:**
  - Edit any generated schedule element (departure times, arrival times, frequencies)
  - Override automatic calculations while maintaining data integrity
  - Track manual changes with visual indicators
  - Undo/redo functionality for all modifications
  
- **Bulk Editing:**
  - Apply changes to multiple trips simultaneously
  - Shift entire time bands forward/backward
  - Proportional adjustments to travel times across all time points

#### Data Export & Integration
- **Excel Export:**
  - Export individual route summary schedules
  - Generate master schedule documents with all routes (active scenarios only)
  - Maintain formatting consistency with current Excel templates
  - Include metadata (creation date, scenario name, assumptions)
  
- **Export Options:**
  - Summary schedules by route
  - Master schedules combining all routes (active scenarios only)
  - Connection analysis reports
  - Vehicle assignment schedules with specific block details
  - Scenario comparison reports

#### Performance & Scalability
- **System Limits:**
  - Support up to 15 time points per route
  - Handle up to 40 trips per day per route
  - Process multiple routes simultaneously (one active for editing)
  - Maintain responsive performance with large datasets
  
- **Data Management:**
  - Permanent storage of all scenarios and historical data
  - Version control for schedule changes
  - Backup and recovery capabilities
  - Search and filter functionality for historical schedules

## 4. User Stories

### As a Route Planner, I want to:

#### Data Input & Setup
- **Define time points sequentially** so that I can create logical route structures with up to 15 stops
- **Input real-time travel data by time band** so that I can accurately reflect different traffic conditions (e.g., 60 min trip during 6-8 AM, 65 min during 8-10 AM)
- **Set custom time bands** so that I can define service periods that match actual operational patterns (early morning, peak, etc.)
- **Enter fixed departure times** so that I can maintain control over service timing based on operational needs
- **Configure frequency requirements** so that the system generates appropriate service levels for each time period

#### Schedule Generation & Editing
- **Generate schedules automatically** so that arrival times are calculated using sequential travel times without manual formula management
- **Override any calculated value** so that I can make operational adjustments while maintaining schedule integrity
- **See real-time updates** so that schedule changes are immediately reflected when I modify travel times or frequencies
- **Track my manual changes** so that I can see which values I've overridden versus system-generated ones
- **Use bulk editing features** so that I can adjust multiple trips simultaneously when needed

#### Validation & Quality Control
- **Receive immediate error feedback** so that I can identify and fix unrealistic travel times or scheduling conflicts
- **See highlighted validation issues** so that I know exactly what needs attention with specific error descriptions
- **Validate frequency requirements** so that I can ensure service levels meet operational standards

#### Scenario Management
- **Create multiple scenarios** so that I can test different frequencies, trip counts, and travel times
- **Compare scenarios side-by-side** so that I can evaluate trade-offs between different scheduling approaches
- **Save scenarios permanently** so that I can reference historical decisions and planning rationale
- **Clone existing scenarios** so that I can build variations efficiently

#### Advanced Analysis (Nice-to-Have)
- **Analyze bus assignments** so that I can optimize vehicle utilization across daily operations
- **View transfer connections** so that I can identify 5-minute (or custom) transfer opportunities between routes
- **Check GO train connections** so that I can align schedules with regional transit services
- **Review Georgian College connections** so that I can serve student travel patterns effectively

#### Export & Sharing
- **Export individual route schedules** so that I can share specific route information in familiar Excel format
- **Generate master schedule documents** so that I can create comprehensive timetables combining all routes
- **Export scenario comparisons** so that I can document decision-making processes
- **Maintain consistent formatting** so that exported schedules match current operational standards

### As a Route Planner doing Quarterly Updates, I want to:
- **Access all my saved work** so that I can continue planning across multiple sessions during the 4-month update cycle
- **Reference previous quarter's schedules** so that I can understand seasonal or operational changes
- **Track changes between quarters** so that I can document service evolution and improvements
- **Handle up to 40 trips per route** so that the system can manage complex high-frequency services

### As a Transit Operations Team Member, I want to:
- **Review generated schedules** so that I can ensure they meet operational requirements and driver needs
- **Access historical scenarios** so that I can understand the rationale behind schedule changes and decisions
- **Export comprehensive reports** so that I can share schedule information with drivers, dispatchers, and management
- **View connection analyses** so that I can understand system-wide transfer patterns and passenger convenience

## 5. User Interface

### Layout & Navigation
- **Single Route Focus:** Clean interface dedicated to one route at a time with tabbed workflow
- **Main Navigation Tabs:** Data Input | Schedule Generation | Scenario Management | Connections | Export
- **Left Sidebar:** Route selector, saved scenarios list, recent routes, and quick actions
- **Top Header:** Current route name, active scenario indicator, save status, and user actions

### Detailed Interface Specifications

#### Data Input Screen
**Time Points Configuration Panel:**
- **Sequential List View:** Drag-and-drop reorderable list of up to 15 time points
- **Time Point Details:** Name field, location description, sequence number (auto-calculated)
- **Add/Remove Controls:** Plus/minus buttons with confirmation dialogs
- **Validation Indicators:** Red highlights for missing or invalid time point names

**Travel Times Matrix:**
- **Grid Layout:** Time points as rows and columns showing Point A → Point B relationships
- **Dual Input Fields:** Separate columns for 50th and 80th percentile times (MM:SS format)
- **Time Band Tabs:** Switch between different time bands to enter varying travel times
- **Cell Validation:** Real-time validation with red borders for unrealistic times
- **Bulk Actions:** Select multiple cells for proportional adjustments

**Time Band Configuration:**
- **Time Band Creator:** Add/edit custom time bands with start/end time pickers
- **Visual Timeline:** Horizontal timeline showing time band coverage across 24 hours
- **Travel Time Summary:** Display total trip time for each time band
- **Conflict Detection:** Highlight overlapping time bands with warning indicators

**Trip Configuration Panel:**
- **Departure Times Table:** Editable list of fixed departure times per time band
- **Frequency Controls:** Spinners and sliders for trips per time band (max 40 total)
- **Service Pattern:** Visual representation of trip distribution across time bands

#### Schedule Generation Screen
**Live Preview Panel:**
- **Schedule Table:** Real-time generated schedule with time points as columns, trips as rows
- **Time Band Color Coding:** Different background colors for trips in different time bands
- **Manual Override Indicators:** Bold text and icons for user-modified values
- **Calculation Status:** Loading indicators during schedule regeneration

**Editing Interface:**
- **Inline Editing:** Click any cell to edit departure/arrival times directly
- **Bulk Edit Tools:** Select multiple trips or time points for mass adjustments
- **Undo/Redo Stack:** Ctrl+Z/Ctrl+Y support with action history sidebar
- **Change Tracking:** Visual diff indicators showing original vs modified values

**Split View Options:**
- **Summary Schedule:** Single route detailed timetable view
- **Master Schedule Preview:** How this route appears in combined master document
- **Side-by-Side Comparison:** Current schedule vs previous version

**Validation Panel:**
- **Error List:** Expandable panel showing all current validation issues
- **Error Highlighting:** Click error to highlight affected schedule cells
- **Quick Fixes:** Suggested solutions for common validation problems
- **Warning Indicators:** Yellow highlights for suboptimal but valid schedules

#### Scenario Management Screen
**Scenario Library:**
- **Scenario Cards:** Grid view of saved scenarios with thumbnails and metadata
- **Quick Actions:** Clone, rename, delete, and compare buttons per scenario
- **Search/Filter:** Find scenarios by name, date, or characteristics
- **Scenario Metadata:** Creation date, last modified, description, and tags

**Scenario Comparison View:**
- **Multi-column Layout:** Up to 3 scenarios displayed simultaneously
- **Difference Highlighting:** Color-coded cells showing variations between scenarios
- **Metrics Dashboard:** Key performance indicators (total trips, vehicle hours, coverage)
- **Export Comparison:** Generate side-by-side comparison reports

**Scenario Creation Wizard:**
- **Clone vs New:** Choose to start from existing scenario or blank template
- **Parameter Selection:** Checkboxes for which elements to modify (frequencies, times, trips)
- **Bulk Modification Tools:** Apply percentage changes to travel times or frequencies
- **Preview Mode:** See changes before committing to new scenario

#### Connection Assessment Screen (Nice-to-Have)
**Transfer Analysis Panel:**
- **Route Connection Matrix:** Grid showing transfer opportunities between all routes
- **Transfer Time Editor:** Editable fields for minimum transfer times (default 5 minutes)
- **Connection Quality Indicators:** 
  - Green for good connections (5-8 minutes)
  - Yellow for tight connections (<5 minutes)
  - Gray for long connections (>8 minutes)
- **Passenger Flow Simulation:** Estimated transfer volumes and success rates

**Vehicle Block Management Panel (Nice-to-Have):**
- **Block Selector:** Dropdown or list to select specific vehicle blocks (Block 1, Block 2, etc.)
- **Block Schedule View:** Complete daily schedule for selected vehicle showing start/end times and all trips
- **Block Assignment Editor:** Drag-and-drop interface to reassign trips between blocks
- **Vehicle Utilization Charts:** Visual representation of vehicle usage throughout the day

**External Integration Panel:**
- **GO Train Schedule Import:** Upload and sync with regional train timetables
- **Georgian College Integration:** Import class schedules and optimize connections
- **Connection Timeline:** Visual timeline showing optimal transfer windows
- **Missed Connections Report:** Identify near-misses and improvement opportunities

**Network Visualization:**
- **Route Map View:** Graphical representation of route connections and transfer points
- **Time-based Animation:** Play through typical day showing connection patterns
- **Connection Statistics:** Success rates, average transfer times, peak transfer periods

#### Export & Reporting Screen
**Export Configuration:**
- **Format Selection:** Choose between summary schedule, master schedule, or custom reports
- **Route Selection:** Multi-select for master schedule exports
- **Template Options:** Match existing Excel formatting or use new standardized layouts
- **Metadata Inclusion:** Option to include scenario details, assumptions, and change logs

**Preview Panel:**
- **Excel Preview:** WYSIWYG view of exported document before download
- **Print Layout:** Page break indicators and print formatting options
- **Quality Check:** Final validation before export with error prevention

**Export History:**
- **Download History:** List of recent exports with re-download capability
- **Version Tracking:** Track exports by scenario and modification date
- **Sharing Options:** Generate shareable links for internal distribution

### Responsive Design & Accessibility
**Screen Adaptation:**
- **Minimum Resolution:** Optimized for 1280x720 displays and larger
- **Table Scrolling:** Horizontal scroll for wide schedule tables with sticky headers
- **Collapsible Panels:** Accordion-style panels for smaller screens
- **Zoom Support:** Interface scales appropriately with browser zoom

**User Experience Features:**
- **Auto-save:** Continuous saving with visual save status indicators
- **Keyboard Shortcuts:** Full keyboard navigation and common action shortcuts
- **Loading States:** Progress indicators for long calculations or data processing
- **Error Recovery:** Graceful handling of network issues with retry mechanisms
- **Help Integration:** Contextual help tooltips and integrated documentation

### Performance Considerations
**Data Handling:**
- **Real-time Updates:** Sub-second response time for schedule recalculation
- **Large Dataset Support:** Smooth performance with 40 trips and 15 time points
- **Memory Management:** Efficient handling of multiple scenarios and historical data
- **Offline Capability:** Limited offline functionality for viewing saved schedules