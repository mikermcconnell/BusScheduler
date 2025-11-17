# TOD Draft Persistence Plan

**Overall Progress:** `100%`

## Tasks:

- [x] 🟩 **Step 1: Extend persistence models & storage**
  - [x] 🟩 Update `TodShiftRunPayload` + Firestore schema for draft name, status, union-rule snapshot, raw file refs, autosave metadata
  - [x] 🟩 Add Firebase Storage helpers to upload city/contractor files under consistent paths and link them to runs
  - [x] 🟩 Enhance `todShiftRepository` with load list, save/overwrite, revert-source utilities, and removal of localStorage fallback

- [x] 🟩 **Step 2: Enrich Redux slice with draft lifecycle**
  - [x] 🟩 Add draft name, dirty flags, lastSaved timestamps, autosave interval handling, and union-rule snapshot persistence in `shiftManagementSlice`
  - [x] 🟩 Implement thunks for manual save, autosave, load draft list, load draft, revert to source files, and draft renaming
  - [x] 🟩 Ensure trimming/export/optimization flows respect the new draft metadata and file references

- [x] 🟩 **Step 3: Build Save/autosave UX across TOD management**
  - [x] 🟩 Add Save buttons (header + Manual Adjustments) with disabled/dirty states, last-saved indicator, and conflict handling with autosave
  - [x] 🟩 Surface autosave status (countdown / “last autosaved” message) and warn on unload when unsaved changes remain
  - [x] 🟩 Provide naming UI for drafts (initial prompt + rename affordance) tied to Redux state

- [x] 🟩 **Step 4: Implement draft loading & revert flows**
  - [x] 🟩 Create Import & Setup “Load Draft” experience listing TOD drafts with metadata and selection handling
  - [x] 🟩 Wire selection to thunk that swaps Redux state to chosen draft and manages unsaved-change confirmation
  - [x] 🟩 Add “Revert to Source Files” action that re-runs parsers on stored uploads, replaces state, and reflects in UI

- [x] 🟩 **Step 5: Validation & polish**
  - [x] 🟩 Add error handling/toasts for upload failures, save conflicts, revert/import errors
  - [x] 🟩 Document new workflow + update any relevant README/agent guides; manually verify autosave + load/revert scenarios

## Follow-up To-Do

- [ ] Surface master schedule vs. MVT shift summary hours (with net difference) beneath each Manual Adjustments chart.
- [ ] Ensure Manual Adjustments and Schedule View charts have clearly labeled time axes for future QA.
