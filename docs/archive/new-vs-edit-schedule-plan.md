# New vs Edit Schedule Split Plan *(Completed)*

**Overall Progress:** `100%`

## Tasks

- 🟩 **Step 1: Establish dedicated entry routes/pages**
  - 🟩 Update `Layout` routing to use `/new-schedule` and `/edit-schedule`
  - 🟩 Create page shells with confirmed copy and CTA wiring for each flow
  - 🟩 Implement redirect handling from legacy `/upload` if needed

- 🟩 **Step 2: Context-enable shared upload components**
  - 🟩 Thread workflow context props through `UploadSchedule` equivalents, `FileUpload`, and `DraftNamingDialog`
  - 🟩 Remove “replace draft” option when in edit-existing context
  - 🟩 Preserve quick-adjust CSV persistence and draft creation behavior

- 🟩 **Step 3: Refresh navigation and dashboard affordances**
  - 🟩 Rename sidebar items and descriptions to “New Schedule” / “Edit Existing Schedule”
  - 🟩 Split dashboard quick actions to mirror the two flows
  - 🟩 Verify icons/tooltips remain consistent with new wording

- 🟩 **Step 4: Streamline breadcrumbs/workflow state**
  - 🟩 Detect `/edit-schedule` in `WorkflowBreadcrumbs` and render two-step flow (“Draft Schedule” → “Base Schedule”)
  - 🟩 Ensure `/new-schedule` continues to show the full five-step path
  - 🟩 Confirm workflow progress calculations align with the shortened edit flow

- 🟩 **Step 5: Harmonize copy & workspace integration**
  - 🟩 Apply new titles/subtitles/buttons across entry pages and modals
  - 🟩 Keep `UploadPanel` combined, driven by the new context prop
  - 🟩 Validate quick-adjust CSV-only guardrails and post-upload navigation paths

