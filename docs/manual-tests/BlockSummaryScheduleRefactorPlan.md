# BlockSummarySchedule Refactor Plan (2025-09-23)

## Goals
- Fix recovery-time editing bug caused by hyphenated IDs.
- Replace manual virtualization with `react-window` to eliminate flicker and support consistent behavior across base/full-screen views.
- Improve keyboard/accessibility compliance for interactive schedule cells.
- Keep feature parity: recovery editing, add-trip flows, service band adjustments, trip end/restore dialogs, auto-save wiring.

## Component Strategy
1. Extract a reusable `TripGrid` component under `src/components/schedule/`.
   - Accepts the processed trip list, time point metadata, and callbacks.
   - Houses virtualization logic implemented with `VariableSizeList` + `react-virtualized-auto-sizer`.
   - Emits render items for: early-add row, each trip row, between-trip add buttons, tail add row.
2. Keep `TripRow` as a memoized subcomponent, but convert interactive controls (timepoint cells, add trip buttons) to keyboard-friendly `ButtonBase` or `IconButton` wrappers.
3. Provide shared measurement constants so both containers know row sizing; list `getItemSize` returns dynamic heights (48px trip rows, 24px mid add, 48px add rows).

## State/Data Considerations
- Replace `editingRecovery` string id with structured `{ tripNumber: number; timePointId: string }`.
- Store current scroll offset in `useRef`; when toggling full screen, apply saved scrollTop and re-sync `VariableSizeList` via `scrollTo`.
- Synchronize virtual list state by passing `initialScrollOffset` and listening to `onScroll` events.

## Accessibility Checklist
- Ensure every action is focusable and supports `Enter`/`Space`.
- Provide `aria-label`/`title` for add/restore/end buttons.
- Preserve table semantics by rendering the virtualization body as `<tbody>`.

## Testing / Verification
- Manual: edit recovery at `rvh-entrance`, add/remove trips, toggle full screen around 20:00, verify scroll alignment.
- Automated: run targeted Jest workflow tests if relevant (no new tests planned due to virtualization complexity, but consider follow-up component tests).

## Implementation Notes
- Extracted `TripRow` into `src/components/schedule/TripRow.tsx` and enhanced existing table virtualization with precise spacer math instead of introducing `react-window` to preserve Material-UI table semantics.
- Scroll synchronisation and accessibility changes were prioritised per plan; a full virtualization library migration remains a potential future follow-up.
