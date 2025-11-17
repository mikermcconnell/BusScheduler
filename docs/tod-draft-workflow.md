# TOD Draft Persistence Workflow

This workflow explains how TOD shift management data is now persisted directly to Firebase and how to work with drafts.

## Creating or importing a draft
- Import the city + contractor CSVs in **Import & Setup**.
- Provide a draft name before processing; a Firestore document is created immediately with uploaded raw files stored in Firebase Storage.

## Saving changes
- Drafts now show Save buttons in the global header and inside Manual Adjustments.
- Click **Save draft** whenever the "Unsaved changes" chip is visible.
- Autosave runs every 2 minutes when changes exist; the header shows both last manual save and last autosave timestamps.

## Loading drafts
- Use the **Load draft** button in the header to open the draft library.
- The dialog lists TOD drafts with latest update timestamps; selecting one replaces the active schedule (confirmation is shown when you have unsaved edits).

## Reverting to source files
- The **Revert to source** button reloads the cursor from the originally uploaded CSVs (stored in Firebase Storage) and re-runs the parsers.
- Use this when manual edits have gone off track and you want to restart from the baseline import.

## Metadata that is persisted
- Draft name + status (draft/final in the future)
- Shift/coverage/operational timelines and solver reports
- Union rules snapshot and undo history for manual edits
- references to the uploaded city/contractor CSVs for future reimports

## Error handling
- Save/import/load/revert errors surface as both inline alerts and snackbars so operators know when persistence failed and can retry.
