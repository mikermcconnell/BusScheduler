# Solver Requirements

## Constraints Overview

- **Coverage**: For every 15-minute interval per zone, scheduled vehicles must meet or exceed `cityTimeline` requirements.
- **Union rules**:
  - Minimum shift length: 5 hours.
  - Maximum shift length: 9.75 hours.
  - Meal break threshold: shift longer than configured threshold must include a break meeting duration/placement rules.
  - Break duration: respect minimum duration and keep within shift window.
- **Operational**:
  - Preserve zone assignments (North, South, Floater).
  - Respect schedule type (weekday, saturday, sunday).
  - Limit number of new shifts introduced vs existing shifts extended.

## Solver Approach

- **Strategy**: Custom greedy covering solver implemented in-project.
- **Rationale**:
  - Guarantees browser compatibility without native bindings or heavyweight dependencies.
  - Prioritises reuse of existing shifts while signalling overtime cost.
  - Keeps optimisation logic maintainable and easy to iterate on.

## Data Model

| Entity | Description |
| --- | --- |
| Decision Variables | Binary selection state stored per candidate shift. |
| Coverage Constraints | Residual demand reduced greedily for each interval-zone pair covered by a selected shift. |
| Extension Variables | Existing shifts that can be extended represented as optional binary vars with adjusted coverage. |
| Objective | Maximise demand reduction per cost unit (existing shifts preferred, overtime penalised). |

## Outputs

- Selected shift instances annotated with compliance metadata.
- Summary metrics: total vehicles, overtime contribution (via objective tally), unmet coverage (if any).
