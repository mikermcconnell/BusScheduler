# TOD Shift Autogeneration Plan

**Overall Progress:** `100%`

## Tasks:

- [ ] 🟩 **Step 1: Gate optimize action**
  - [ ] 🟩 Disable `Optimize Shifts` until a master schedule import exists
  - [ ] 🟩 Add confirmation modal warning that optimization replaces all current shifts

- [ ] 🟩 **Step 2: Generate shifts for all day types**
  - [ ] 🟩 Build service to convert coverage deficits into weekday/Saturday/Sunday shift drafts using union rules
  - [ ] 🟩 Attach placeholder warnings whenever compliance cannot be fully satisfied

- [ ] 🟩 **Step 3: Persist and version runs**
  - [ ] 🟩 Snapshot the existing TOD run before overwrite (Firestore/local fallback)
  - [ ] 🟩 Save generated shifts, operational timeline, and coverage back through `todShiftRepository`

- [ ] 🟩 **Step 4: Surface post-run status**
  - [ ] 🟩 Present summary of remaining gaps/compliance warnings after optimization
  - [ ] 🟩 Keep contractor import path available for comparisons after auto-generation
