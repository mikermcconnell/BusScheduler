# TOD Shifts Feature Implementation Plan

**Overall Progress:** `100%`

## Tasks:

- [x] 🟩 **Step 1: Replace placeholder route with functional page**
  - [x] 🟩 Mount `ShiftManagementPage` at `/tod-shifts`
  - [x] 🟩 Ensure navigation, breadcrumbs, and header use updated title/state

- [x] 🟩 **Step 2: Build CSV import + normalization pipeline**
  - [x] 🟩 Parse City requirements CSV into unified 15-minute timeline (04:00–01:00) per day type
  - [x] 🟩 Parse contractor shifts CSV, handle cross-midnight/one-break constraints, and align to intervals
  - [x] 🟩 Persist parsed datasets to Firebase for re-runs and multi-import support

- [x] 🟩 **Step 3: Implement coverage computation with floater allocation**
  - [x] 🟩 Generate per-interval operational counts by zone and apply floater redistribution (North priority then South)
  - [x] 🟩 Calculate excess/deficit metrics and derive color-scale thresholds from min/max values
  - [x] 🟩 Store coverage snapshots in Redux + Firebase for UI and exports

- [x] 🟩 **Step 4: Deliver Excel export aligned with color logic**
  - [x] 🟩 Create .xlsx generator (min one sheet per day type) with conditional formatting matching app palette
  - [x] 🟩 Insert summary rows (vehicle hours required vs. supplied, deficit/excess totals)
  - [x] 🟩 Hook export action into UI and Firebase persistence flow

- [x] 🟩 **Step 5: Implement Gantt visualization + UI polish**
  - [x] 🟩 Render per-day-type heatmap/Gantt using chosen library (Recharts) with shared color scale
  - [x] 🟩 Add tooltips showing zone-level surplus/deficit details
  - [x] 🟩 Wire success/error states, loaders, and recent-import indicators across tabs
