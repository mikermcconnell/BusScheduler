# Manual Shift Tweaks Plan

**Overall Progress:** `100%`

## Tasks:

- [x] 🟩 **Step 1: Define editing workflows and validation UX**
  - [x] 🟩 Identify shift fields editable via sliders (start/end, breaks, zone, metadata) in 15-minute increments
  - [x] 🟩 Specify union-rule validation feedback (inline warnings + confirmation for violations)
  - [x] 🟩 Document update events that trigger coverage recompute (after add/edit/delete)

- [x] 🟩 **Step 2: Implement bounded shift editing controls**
  - [x] 🟩 Add slider-based UI for editing existing shifts with snapping to the 15-minute grid
  - [x] 🟩 Enable add/remove actions respecting union rules and existing persistence flows
  - [x] 🟩 Wire edits to dispatch updates via new thunks

- [x] 🟩 **Step 3: Refresh analytics and views after manual tweaks**
  - [x] 🟩 Recompute coverage/operational timelines after each edit and update Redux state
  - [x] 🟩 Ensure Shift View, Optimization View, and floater/break graphs reflect manual changes instantly
  - [x] 🟩 Add regression checks (manual validation) verifying graph sync after edits

- [x] 🟩 **Step 4: Introduce dedicated Manual Adjustments page**
  - [x] 🟩 Add new tab adjacent to Shift Optimization for manual tweaking workflow
  - [x] 🟩 Move interactive `ShiftSummaryTable` with actions to the new page and keep Configure tab view-only
  - [x] 🟩 Verify navigation + coverage graphs reflect edits when using the new page
