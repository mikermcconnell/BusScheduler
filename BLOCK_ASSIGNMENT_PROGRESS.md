## Block Assignment Rewrite – Phased Implementation Plan

### Trip Ordering Fix – Live Task
**Progress:** ✅ 67%
- ✅ Sync trip-level departure times with per-stop data and cascade through schedule mutations.
- ✅ Update sorting and normalization paths to lean on the synchronized start time with resilient fallbacks.
- ⏳ Backfill tests and record outcomes for the trip ordering fix.

### Phase 0 – Baseline & Preparation
**Objective:** Capture the current behaviour of block assignment and ensure the workspace is ready for iteration.
**Prerequisites:** Local environment set up with Node, Firebase emulators configured, Route 100 sample data available.
**Key Steps:**
1. [ ] Pull latest `main`, install dependencies, and run `npm run lint && npm run test` to confirm a clean starting point.
2. [ ] Snapshot current Route 100 quick-adjust export (CSV and Excel) to use as the regression baseline.
3. [ ] Document existing block assignment flow (importer → summary → export) so data hand-offs are explicit before refactors.
**Exit Criteria:** Baseline exports saved, workflow map captured, and project health checks passing.

### Phase 1 – Shared Helper Foundation *(completed)*
**Objective:** Centralize block-assignment logic in shared utilities and wire core consumers.
**Key Steps:**
1. [x] Create `src/utils/blockAssignment.ts` with `computeBlocksForTrips`, `computeBlocksFromMatrix`, and `needsBlockRecompute` helpers.
2. [x] Add `src/utils/blockAssignment.test.ts` with Vitest coverage for primary success and edge paths.
3. [x] Update the Quick Adjust importer to call `computeBlocksForTrips` and persist `tripDetails` on `SummarySchedule` responses.
4. [x] Ensure `BlockSummarySchedule` uses `reassignBlocksIfNeeded` to preserve alternating blocks on load.
5. [x] Extend `ExportDataBundle` with `tripsByDay` payloads and update export panel wiring to capture them.
6. [x] Replace legacy `Math.ceil((index+1)/3)` block derivation with helper-driven reads inside `exportService` and `exportTemplates`.
**Exit Criteria:** All block computations route through the shared helper with unit coverage and the UI/export layer consuming new metadata.

### Phase 2 – Persistence & Draft Compatibility
**Objective:** Guarantee `tripDetails` flows through all persistence layers and legacy drafts degrade gracefully.
**Key Steps:**
1. [x] Audit `draftService.updateDraftWithSummarySchedule`, draft serialization, and rehydration paths for `SummarySchedule.tripDetails` coverage.
2. [x] Add missing fields or migrations so drafts created before the rewrite populate `tripDetails` during load without wiping existing data.
3. [x] Update Firestore converters, validation schemas, and TypeScript types to persist the richer schedule payload.
4. [x] Backfill automated tests (unit/integration) that open a draft, modify data, save, and reload to confirm block metadata survives round-trips (`src/services/draftService.tripDetails.test.ts`).
**Exit Criteria:** All draft flows emit and consume `tripDetails`, with tests demonstrating persistence for both new and legacy drafts.

### Phase 3 – Workflow & Event Propagation
**Objective:** Ensure every UI workflow that touches block data transmits `tripsByDay` and `tripDetails` correctly.
**Key Steps:**
1. [x] Inventory components and services (e.g., `UploadPanel`, `useFileUpload`, `ExportPanel`, `BlockSummarySchedule`) that listen or emit schedule updates.
2. [x] Update event payloads so `tripsByDay` travels end-to-end without being stripped or re-derived (`schedule-data` events now persist `tripDetails` and `tripsByDay`).
3. [x] Add guard rails (TypeScript interfaces, runtime assertions) to catch missing block metadata during development via `normalizeSummaryScheduleTrips`.
4. [ ] Create exploratory manual scripts covering block edits, time adjustments, and quick adjust re-imports to verify stable alternation.
**Exit Criteria:** No consumer drops block metadata; safeguards fail fast when payloads are incomplete; manual smoke tests succeed.

### Phase 4 – QA & Export Validation
**Objective:** Validate alternating blocks across UI and export channels and prevent regressions.
**Key Steps:**
1. [x] Run `npm run test -- blockAssignment.test.ts`, `npm run test -- quickAdjustImporter.test.ts`, and `npm run test -- draftService.tripDetails.test.ts` to cover helpers, importer, and persistence.
2. [ ] Perform the Route 100 quick-adjust upload, confirm alternating blocks (1,2,1,2,…) in the Summary page, then export CSV and Excel artifacts.
3. [ ] Compare exported files against the Phase 0 baseline and log any intentional deltas.
4. [ ] Capture screenshots or recordings demonstrating correct alternation and attach them to QA notes.
**Exit Criteria:** Automated tests are green, manual verification matches expectations, and QA evidence is stored in the shared log.

### Phase 5 – Documentation & UX Polish
**Objective:** Record the new workflow for engineering/support and tighten UI feedback when block reconstruction fails.
**Key Steps:**
1. [ ] Update `docs/quick-adjust-workflow.md` (and related guides) to describe helper usage, required payloads, and draft schema notes.
2. [ ] Define user-facing copy for cases where block reconstruction falls back to matrix heuristics or fails; review with UX.
3. [ ] Wire the new messaging into the summary/export surfaces, ensuring analytics capture failure frequency.
4. [ ] Notify support/training teams of the new workflow and provide the QA evidence gathered in Phase 4.
**Exit Criteria:** Documentation published, UI messaging merged, and support enablement completed.

### Phase 6 – Release & Monitoring
**Objective:** Deploy the rewrite with confidence and observe production behaviour.
**Key Steps:**
1. [ ] Bundle changes behind a feature flag or staged rollout plan aligned with release management practices.
2. [ ] Verify CI/CD pipelines include the new tests and that build artifacts contain helper modules.
3. [ ] Monitor production logs/telemetry for block reconstruction errors and compare against pre-release baselines.
4. [ ] Schedule a post-release review to catalogue learnings and feed them into future scheduling enhancements.
**Exit Criteria:** Feature deployed, monitoring shows stable behaviour, and post-release actions are captured with follow-up owners.
