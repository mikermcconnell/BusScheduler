# Technical Decision Log

This document tracks significant technical decisions made during the development of Scheduler2. Each entry includes the decision, rationale, and impact.

## 2025-08-26: Schedule Summary Calculations
- **Decision**: Use column-based summation instead of recalculating from timepoints
- **Rationale**: Ensures displayed totals match visible values in the table, preventing confusion and maintaining consistency
- **Impact**: More accurate reporting, simpler mental model for users and developers
- **Implementation**: `calculateSummaryStats()` in BlockSummarySchedule.tsx

## 2025-08-26: Recovery Percentage Formula
- **Decision**: Calculate as (Total Recovery Time ÷ Total Travel Time) × 100
- **Rationale**: Shows recovery as a percentage of base travel time, matching transit industry standards
- **Impact**: Clear metric for operators to understand schedule efficiency
- **Example**: 25% = 15 minutes recovery per 60 minutes of travel

## 2025-08-22: Service Band Logic
- **Decision**: Trip-specific service bands based on departure time
- **Rationale**: Reflects real-world traffic patterns throughout the day
- **Impact**: More accurate scheduling that adapts to time-of-day conditions
- **Implementation**: Each trip independently determines its service band

## 2025-08-20: Cascading Updates Architecture
- **Decision**: Implement real-time cascading updates for recovery time changes
- **Rationale**: Maintains schedule integrity when operators adjust dwell times
- **Impact**: 
  - Updates propagate within trip first (downstream stops)
  - Then cascade to subsequent trips in the same block
  - Never cascade across blocks (maintains block independence)

## 2025-08-15: Inline Editing Pattern
- **Decision**: Click-to-edit for recovery times with auto-select
- **Rationale**: Reduces clicks and provides immediate feedback
- **Impact**: Faster schedule adjustments, better user experience
- **Implementation**: Input appears on click, auto-selects value, saves on Enter/Tab/blur

## 2025-08-10: Material-UI v7 Migration
- **Decision**: Upgrade from MUI v5 to v7
- **Rationale**: Access to latest components, better performance, improved TypeScript support
- **Impact**: Breaking changes handled, theme system updated
- **Migration Notes**: Updated all imports, adjusted theme configuration

## 2025-08-05: TypeScript Strict Mode
- **Decision**: Enable strict TypeScript checking
- **Rationale**: Catch more bugs at compile time, improve code quality
- **Impact**: Required fixing null checks throughout codebase
- **Configuration**: `"strict": true` in tsconfig.json

## 2025-08-01: Local Storage Strategy
- **Decision**: Use localStorage for draft persistence with automatic saves
- **Rationale**: Provides offline capability and prevents data loss
- **Impact**: Schedules persist across browser sessions
- **Limitations**: 5-10MB storage limit per domain

## 2025-07-25: Security Mitigations
- **Decision**: Comprehensive security hardening for file uploads
- **Rationale**: Protect against malicious file uploads and XSS attacks
- **Impact**: 
  - MIME type validation
  - Magic byte verification
  - File size limits (5MB max)
  - Input sanitization throughout

## 2025-07-20: Performance Boundaries
- **Decision**: Implement virtualization for schedules > 500 trips
- **Rationale**: Maintain 60fps scrolling performance with large datasets
- **Impact**: 
  - < 100 trips: No virtualization
  - 100-500 trips: Optional virtualization
  - > 500 trips: Required virtualization
  - > 1000 trips: Consider pagination

## 2025-07-15: Block-Based Trip Generation
- **Decision**: Generate trips using block cycling logic
- **Rationale**: Matches real-world bus operations where vehicles cycle continuously
- **Impact**: Accurate turnaround times, proper block management
- **Formula**: Next trip starts when previous trip completes

## 2025-07-10: Component Architecture
- **Decision**: Page-based routing with shared components
- **Rationale**: Clear separation of concerns, easier navigation
- **Impact**: 
  - Pages in `src/pages/`
  - Shared components in `src/components/`
  - Services in `src/services/`
  - Utils in `src/utils/`

## 2025-07-05: Excel Processing Strategy
- **Decision**: Use xlsx library for Excel file processing
- **Rationale**: Robust parsing, wide format support, client-side processing
- **Impact**: Can handle .xlsx, .xls, .csv formats
- **Limitations**: Memory constraints for very large files

## 2025-07-01: React 19 Adoption
- **Decision**: Use React 19 despite being in RC
- **Rationale**: Access to latest features, better performance
- **Impact**: Some libraries required overrides
- **Risk Mitigation**: Extensive testing, version pinning

## Decision Template
```markdown
## YYYY-MM-DD: [Decision Title]
- **Decision**: [What was decided]
- **Rationale**: [Why this decision was made]
- **Impact**: [How it affects the system]
- **Trade-offs**: [What alternatives were considered]
- **Implementation**: [Key implementation details]
```