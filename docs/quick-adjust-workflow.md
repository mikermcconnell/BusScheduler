# Quick Adjust Workflow – Task Summary and Progress

## Goal
Provide a streamlined branch of the Scheduler2 workflow that lets schedulers import an already finished timetable, make minute-level tweaks, and re-export without running the full optimization pipeline. The flow should feel intentional (user-opt in), preserve professional export fidelity, and leave a clean audit trail inside the existing draft/workflow system.

## Current Implementation
- ✅ **CSV importer** (`src/utils/quickAdjustImporter.ts`) parses multi-day tables, extracts stop metadata, and returns a full `SummarySchedule`. Regression coverage added in `src/utils/quickAdjustImporter.test.ts` using the Route 100 sample.
- ✅ **Draft metadata & workflow bridge** (`src/types/workflow.ts`, `src/services/draftService.ts`) now understands quick-adjust runs, marking skipped steps and persisting imported schedules through a new `applyQuickAdjustImport` helper.
- ✅ **Upload experience** (`src/components/FileUpload.tsx`, `src/components/DraftNamingDialog.tsx`, `src/pages/UploadSchedule.tsx`) prompts users to choose between the full builder and quick adjust, captures the raw CSV, and routes quick-adjust drafts straight to the summary view.
- ✅ **Panel parity** (`src/components/panels/UploadPanel.tsx`, `src/components/WorkflowBreadcrumbs.tsx`) mirrors the fast path so breadcrumbs, workspace events, and panel state stay in sync with the new branch.
- ✅ **Summary page awareness** (`src/pages/BlockSummarySchedule.tsx`) restores imported trips/timepoints, keeps weekend matrices intact during auto-save, and avoids regenerating block data unless the user exits quick-adjust mode.

## Remaining Follow-Ups
1. **UI affordances**: surface an inline banner on the summary page clarifying “Quick Adjust mode” with an easy escape hatch back to the full workflow.
2. **Validation feedback**: surface importer warnings (e.g., missing stops, malformed times) in the UI rather than console logs.
3. **Analytics/telemetry**: ensure quick-adjust sessions are logged distinctly for product insight.
4. **Exporter guardrails**: confirm every export template handles the quick-adjust summary payload (weekday-only vs. multi-day data).
5. **Workflow persistence testing**: add E2E coverage for resuming a quick-adjust draft after reload to ensure skipped steps remain consistent.

## Notes & Best Practices
- Always store the raw CSV contents or metadata on the draft so exports remain traceable to their source.
- When extending this branch, keep `DraftWorkflowState.workflowMode` aligned with UI conditionals; breadcrumbs and auto-save rely on it.
- Watch for schedule pages assuming `timepointsAnalysis` exists; quick-adjust drafts intentionally skip those datasets.
