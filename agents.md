# agents.md - Scheduler2 Application Guide

> **For AI Assistants**
> - Scope: Use this document as the canonical reference for Scheduler2 architecture, workflows, datasets, and guardrails.
> - Tone: Keep updates concise, partner-style, and surface blockers or risks immediately.
> - Escalation: Confirm before running destructive commands, touching production Firebase data, or altering security-sensitive settings.
> - Language: When helping this user, explain everything in plain, everyday wording with no technical jargon.
- Firestore Rules: Whenever rules change, immediately run `firebase deploy --only firestore:rules` yourself via the CLI—never leave this step for the user.

## Quick Start

### Setup & Test (5 minutes)
1. `npm install` → Copy `.env.example` to `.env` → `npm start`
2. Upload `example_schedule/Raw_Data.csv` to test
3. Verify: TimePoints charts → Block Configuration → Summary Schedule → Export

## Project Overview
**Scheduler2** is a production-ready bus route scheduling application that processes CSV files to generate professional transit schedules. Built with React 19, TypeScript 5.9, Material-UI v7, and Firebase integration.

**Purpose**: Automate conversion of raw schedule data into formatted schedules for weekday/Saturday/Sunday service patterns.

## Tech Stack & Commands
- **Frontend**: React 19 + TypeScript 5.9 + Material-UI v7 + React Router DOM v7
- **Processing**: xlsx library for Excel/CSV handling
- **Testing**: Jest + React Testing Library v16, Vitest v3
- **Storage**: localStorage + Firebase Cloud Firestore
- **Target Platform**: Web-based only (desktop browsers, no mobile support required)

```bash
npm start          # Development server (localhost:3000)
npm run build      # Production build
npm test           # Jest tests
npx tsc --noEmit   # TypeScript check
```

## Core Features
1. **File Upload & Processing** - Drag/drop with validation, smart format detection
2. **Schedule Generation** - Travel time calculations, multi-day support, service band integration
3. **Security Hardened** - XSS prevention, file validation, memory protection (5MB max, magic byte verification)
4. **Professional Export** - CSV/Excel export matching transit industry standards
5. **Draft Management** - Auto-save with localStorage + Firebase cloud backup
6. **Inline Editing** - Real-time cascading updates, click-to-edit recovery times
7. **Advanced UI** - Duolingo-style Block Configuration, professional transit display
8. **Connection Optimization** - Recovery Bank System with borrowing/lending, connection window analysis
9. **Visual Dashboard** - Interactive optimization timeline with before/after comparisons
10. **Workspace Context** - Event-driven architecture with discriminated union types
11. **Keyboard Shortcuts** - Full application keyboard navigation and shortcuts system

## Project Structure
```
src/
├── components/     # Layout, Navigation, FileUpload, ConnectionLibrary, SaveToDraft, etc.
├── pages/         # Dashboard, UploadSchedule, TimePoints, BlockConfiguration, ConnectionOptimization, VisualDashboard, etc.
├── services/      # draftService, connectionOptimizationService, recoveryBankService, optimizationEngine, etc.
├── contexts/      # WorkspaceContext, FeatureFlagContext
├── hooks/         # useWorkflowDraft, useKeyboardShortcuts, useFileUpload, etc.
├── utils/         # calculator, csvParser, formatDetector, inputSanitizer, timeUtils, routeDetector, etc.
├── types/         # schedule.ts, workflow.ts, connectionOptimization.ts, workspaceEvents.ts
├── constants/     # Application constants and configuration
├── docs/          # Documentation and guides
```

## Key Types & File Formats

### Core Types
- **Schedule Types** (`src/types/schedule.ts`): `TimePoint`, `Trip`, `ProcessedSchedule`, `ValidationResult`
- **Workflow Types** (`src/types/workflow.ts`): `WorkflowDraft`, `BlockConfiguration`, `ServiceBand`, `DayType`
- **Connection Types** (`src/types/connectionOptimization.ts`): `ConnectionPoint`, `RecoveryBankResult`, `OptimizationConstraints`
- **Event Types** (`src/types/workspaceEvents.ts`): `WorkspaceEvent`, `WorkspaceEventInput` (discriminated unions)

### Input: Raw Data CSV
- **Structure**: Route segments with travel time percentiles by 30-minute periods
- **Data Rows**: 25%/50%/80%/90% observed runtimes + scheduled targets
- **Example**: `101 CCW Observed Runtime-50%` for median travel times

### Output: Summary Schedule Excel
- **Professional Layout**: Timepoint columns, departure/arrival times, block organization
- **Industry Standard**: GTFS-compatible format for transit operators
- **Operational Data**: Recovery times, cycle times, service bands

## Canonical Data Sources
- `example_schedule/Raw_Data.csv` – Sanitized raw input used in Quick Start flows and regression tests; keep its columns stable for automated parsing.
- `example_schedule/2_08.2025.xlsx` – Reference export illustrating the expected column order and formatting; update it whenever export schemas change.
- `src/integration/testUtils/fixtures.ts` – Centralized generator for schedule, connection, and workflow fixtures; extend it before creating ad-hoc mock data.
- Firebase Firestore collections: `workflow_progress`, `schedules`, `draft_schedules`; prefer the local emulator for testing and obtain approval before touching production data.

## Guardrails & Safe Operations
- Preserve upload validation limits (5MB max file size, magic-byte checks) enforced in `src/hooks/useFileUpload.ts`; security review required before relaxing them.
- Keep sanitization logic in `src/utils/inputSanitizer.ts` and related validators intact; changes must include threat modeling and regression tests.
- Coordinate any changes to recovery and optimization rules in `src/services/recoveryBankService.ts` and `src/services/connectionOptimizationService.ts` with product owners to avoid operational regressions.
- `.env` files hold environment secrets; never commit live credentials and refresh sample values if contract changes.

## Security Features ⚠️ CRITICAL
- **File Validation**: MIME type + magic byte verification, size limits (5MB max, 1KB min)
- **XSS Prevention**: HTML entity encoding, attack pattern detection
- **Memory Protection**: 50MB limit, processing timeouts (30s), circuit breaker pattern
- **Input Sanitization**: Length limits, character filtering, secure error handling

## Navigation & Workflow
**Main Flow**: Dashboard → Upload Schedule → TimePoints Analysis → Block Configuration → Summary Schedule → Export

### Key Pages
- **Dashboard** (`/`) - Main landing page with recent drafts and quick actions
- **Upload** (`/upload`) - File processing with drag/drop
- **TimePoints** (`/timepoints`) - Interactive travel time analysis, service bands, outlier detection
- **Block Configuration** (`/block-configuration`) - Duolingo-style UI for bus block management
- **Block Summary Schedule** (`/block-summary-schedule`) - Professional display with inline editing
- **Connection Optimization** (`/connection-optimization`) - Recovery time optimization configuration
- **Visual Dashboard** (`/visual-dashboard`) - Optimization results and timeline visualization
- **Draft Library** (`/draft-library`) - Manage saved drafts and workflows
- **Settings** (`/settings`) - Application settings and preferences

## Bus Block Configuration System
### Duolingo-Style UI Features
- **Pill-shaped cards** with colorful gradients and 3D shadows
- **Smart automation**: Block 1 manual, Blocks 2+ auto-calculated (frequency intervals)
- **Safety limits**: Max 50 trips/block, 500 total trips, 1000 iterations

### Configuration Options
- **Number of Buses** (1-10) - Dynamic block creation
- **Cycle Time** (minutes) - User-configurable, unrestricted
- **Service Frequency** - Auto-calculated (Cycle Time ÷ Buses)
- **Automated Start Times** - Toggle control (default ON)

## Summary Schedule System
### Professional Transit Display
- **Industry Layout**: Timepoint columns matching professional schedules
- **Service Bands**: Color-coded (Fastest=Green, Standard=Orange, Slowest=Red)
- **Time Logic**: Origin=departure, Intermediate=arrival+departure, Destination=arrival

### ⚠️ CRITICAL: Full Screen Synchronization
**IMPORTANT**: The `BlockSummarySchedule.tsx` component has TWO display modes:
1. **Normal View**: Standard table display
2. **Full Screen View**: Same table in full screen overlay (`isFullscreen` state)

**Both modes use the same `TripRow` component**, so changes automatically sync. However, always verify both views when making UI/UX modifications to time cells, click targets, or table styling.

- When touching the schedule table markup in `src/pages/BlockSummarySchedule.tsx`, edit **both** `<TableContainer>` blocks (normal view around the first occurrence and the full-screen overlay near the bottom of the file). They intentionally mirror each other—keep hover states, virtualization settings, and helper rows identical.

### Inline Editing & Cascading Updates
- **Click-to-Edit**: Recovery times with auto-select input
- **Real-time Cascading**: Changes propagate within trip, then to subsequent trips in block
- **Persistence**: localStorage + Firebase sync
- **Recovery Templates**: Service band templates with bulk application

## Service Band Logic
### Trip-Specific Assignment
```typescript
const tripServiceBand = getServiceBandForTime(departureTime, timePeriodBands);
const segmentTime = tripServiceBand.segmentTimes[segmentIndex];
```

### Categories & Examples
- **Fastest** (Green): 35min travel + 9min recovery = 44min total
- **Fast** (Light Green): 37-38min total
- **Standard** (Orange): 39min total  
- **Slow** (Orange): 40min total
- **Slowest** (Red): 41min+ total

## Schedule Statistics
### Display Order & Calculations
1. **Total Trip Time** - Complete journey time (sum of Trip Time column)
2. **Total Travel Time** - Pure movement time (sum of Travel Time column)
3. **Total Recovery Time** - Cumulative dwell time (sum of Recovery Time column)
4. **Average Recovery %** - `(Recovery ÷ Travel) × 100`
5. **Total Trips** - Active trip count


## Firebase Integration
### Setup & Data Structure

#### Service Account Storage
- Firebase Admin service account JSON lives at backend/credentials/firebase-service-account.json; keep permissions limited to backend processes only.
- Directory is git-ignored (backend/credentials/), so share the file via secure secret management rather than commits.

```
/schedules/{id}: userId, routeName, status, tripCount, summarySchedule, timestamps
/draft_schedules/{id}: userId, fileName, uploadedData, processingStep, timestamps
```

### Features
- **Cloud backup**, **cross-device sync**, **offline support**
- **User authentication** (email/password, Google, anonymous)
- **Seamless migration** from localStorage

### Magic Link Authentication Setup
**Note**: Firebase Dynamic Links deprecated August 2025 - use direct email links instead

#### Configuration Steps:
1. **Firebase Console Settings**:
   - Enable Email/Password authentication in Sign-in methods
   - Toggle ON "Email link (passwordless sign-in)" option
   - Add authorized domains: `localhost`, your production domain

2. **Environment Variables**:
   ```bash
   REACT_APP_MAGIC_LINK_DOMAIN=http://localhost:3000  # For development
   ```

3. **Authentication Flow**:
   - User enters email → Firebase sends magic link
   - Link directs to `/auth/email-link` on your domain
   - `EmailLinkHandler` component processes authentication
   - No Dynamic Links required - works with direct domain URLs

## Technical Implementation

### Key Functions
```typescript
// Core Services
processSchedule(file: File): Promise<ProcessedSchedule>
generateTrips(config: BlockConfiguration[]): Trip[]
calculateTravelTimes(timePoints: TimePoint[]): TravelMatrix

// Draft Management
draftService.saveWorkflow(workflow: WorkflowDraft): void
draftService.loadWorkflow(draftId: string): WorkflowDraft | null
draftService.getActiveDraft(): string | null

// Connection Optimization
optimizeConnections(schedule: Schedule, constraints: OptimizationConstraints): OptimizedSchedule
calculateRecoveryBank(trips: Trip[]): RecoveryBankResult
evaluateConnectionWindows(trips: Trip[], connections: ConnectionPoint[]): WindowAnalysis

// Time Utilities
timeToMinutes(timeStr: string): number
minutesToTime(minutes: number): string
addMinutes(timeStr: string, minutes: number): string
detectRoutePattern(schedule: Schedule): RoutePattern

// Security
sanitizeString(input: string): string
validateFileUpload(file: File): ValidationResult
detectAttackPatterns(input: string): boolean
```

### Cascading Update Logic
```typescript
// Core algorithm
nextTrip.startTime = previousTrip.departureTime;
departureTime = arrivalTime + recoveryTime;

if (recoveryTimeChanged) {
  updateCurrentTripSubsequentStops();
  updateAllSubsequentTripsInBlock();
  refreshScheduleDisplay();
}
```

## Development Guidelines

### Performance Boundaries
- **< 100 trips**: Standard rendering
- **100-500 trips**: Optional virtualization
- **500+ trips**: Required virtualization
- **Memory limits**: 4MB localStorage, 50MB processing

### Security Checklist
- Always validate file uploads with existing functions
- Sanitize inputs before processing/display
- Monitor memory usage during operations
- Use secure error handling

### Common Gotchas
1. **Recovery vs Travel Time**: Recovery = dwell time, Travel = movement time
2. **Cascading Logic**: Update current trip first, then cascade if last stop changed
3. **Time Format**: Use "07:00" (24-hour), not "7:00 AM"
4. **Block Boundaries**: Only cascade within same block number

## Testing Strategy
### Test Data Location: `test-data/`
- `small-schedule.csv` (10 trips), `medium-schedule.csv` (100 trips)
- `large-schedule.csv` (1000 trips), `edge-cases.csv`, `malformed.csv`

### Edge Cases
- Empty/malformed CSV, files > 5MB, negative travel times
- 24-hour wraparound, circular routes, express services
- XSS payloads, path traversal, buffer overflow attempts

## Troubleshooting

### File Upload Issues
- "Format not supported" → Check extension + MIME type
- "File too large" → 5MB limit enforced
- "Processing timeout" → 30-second limit

### Performance Issues
- Browser freezing → Enable virtualization
- Slow rendering → Check memoization
- Export failures → Browser memory limits

### Debug Commands
```javascript
console.log(scheduleStorage.getAllSchedules()); // Check data
localStorage.clear(); // Reset storage
console.log(performance.memory); // Monitor memory
```

## Architecture Diagrams

### Schedule Generation Flow
```
CSV Upload → Format Detection → TimePoint Analysis → Service Bands
    ↓             ↓                    ↓                 ↓
Validation → Auto-detect Headers → Block Config → Summary Schedule → Export
```

### Cascading Updates
```
User edits recovery → Update stop departure → Cascade within trip
                                ↓
                        Is last stop changed?
                           ↓         ↓
                         No        Yes → Update next trip → Cascade to block
```

## Production Status: ✅ COMPLETE+

### MVP+ Features ✅
- Core features, security mitigations, professional UI
- Type-safe TypeScript, export functionality, error handling
- Statistics, cascading updates, block configuration
- Recovery templates, Firebase integration, virtualization

### Performance Benchmarks
- **Initial Load**: < 3s, **Generation**: < 5s (500 trips)
- **Cascading Updates**: < 100ms, **Export**: < 2s
- **Quality**: 85%+ coverage, WCAG AA, 90+ Lighthouse

---

## Agentic Coding Best Practices

### Recommended Approach (Auto-Selection)
**Trigger**: "Recommended approach: [task description]"
**Purpose**: Automatically analyzes task and applies the most suitable methodology

```bash
# Examples
"Recommended approach: Add user profile editing"     # Will likely use TDD
"Recommended approach: Optimize dashboard loading"   # Will use performance-optimizer
"Recommended approach: Refactor payment system"      # Will use Task Think
"Recommended approach: Build chat with encryption"   # Will use Router + Security
```

**How it works**: Analyzes task complexity, scope, and requirements to select:
- TDD for new features with clear requirements
- Task Think for complex refactoring or multi-file changes
- Task Router for uncertain scope or multi-domain tasks
- Combined approaches for critical or complex features

### Test-Driven Development (TDD)
**Trigger**: "Test-Driven Development: [feature]" or "TDD: [feature]"
**Pattern**: Tests First → Red → Green → Refactor → Review

```bash
# Example commands
"TDD: Add user authentication"           # Writes tests first, then implementation
"Run tests to confirm failures"          # Verify red state
"Implement to pass tests"                # Minimal code to green
"Review TDD implementation"              # Quality check
```

### Task Think Workflow
**Trigger**: "Task Think: [complex task]" or when dealing with multi-file changes
**Pattern**: Explore → Plan → Implement → Integrate

```bash
# Example commands
"Task Think: Refactor authentication"    # Deep analysis before coding
"Task Think harder: [complex task]"      # Extra depth for complex features
```

**Key Rules**:
- Always explore codebase first (Read, Glob, Grep)
- Use sequential-thinking for planning
- Track with TodoWrite throughout
- No premature coding

### Task Router Agent
**Trigger**: "Route this task: [description]" or when unsure which agent to use
**Purpose**: Automatically assigns specialized agents

| Task Type | Primary Agent | Use Case |
|-----------|--------------|----------|
| Frontend | ui-engineer | React components, UI/UX |
| Backend | backend-implementer | APIs, services, logic |
| Database | firebase-specialist | Firestore, queries |
| Testing | test-engineer | Test suites, coverage |
| Performance | performance-optimizer | Speed, memory, rendering |
| Security | security-specialist | Validation, XSS, auth |
| Planning | planner-agent | Feature breakdown |
| Review | code-reviewer | Quality assurance |

### Combined Methodologies
```bash
"Task Think with TDD: OAuth implementation"        # Analysis + test-first
"Route this TDD task: Payment processing"         # Auto-assign + test-first
"Task Think with routing: Dashboard redesign"     # Full systematic approach
```

### Quick Decision Guide
- **New features**: Use TDD
- **Complex refactoring**: Use Task Think
- **Uncertain scope**: Use Task Router
- **Critical changes**: Task Think + TDD
- **Multi-domain**: Router + TDD

### Quality Gates
Always include:
- test-engineer for coverage
- code-reviewer for final check
- security-specialist for sensitive ops
- performance-optimizer for data-heavy features

---

## Clarification Protocol - No Assumptions Policy

### Core Principle: **ASK DON'T ASSUME**

When any agent or Claude encounters ambiguity, uncertainty, or missing information, **ALWAYS clarify with the user** instead of making assumptions.

### When to Request Clarification

#### 1. **Technical Ambiguity**
```bash
❌ BAD: "I'll assume you want the latest version"
✅ GOOD: "Which version would you like me to install - latest stable (7.3.2) or keep current (7.3.1)?"

❌ BAD: "I'll use the default configuration"  
✅ GOOD: "Should I use the existing configuration or would you prefer different settings?"
```

#### 2. **Scope Uncertainty** 
```bash
❌ BAD: "I'll update all related files"
✅ GOOD: "I found 5 related files. Should I update all of them or specific ones?"

❌ BAD: "I'll implement this feature completely"
✅ GOOD: "This feature has multiple parts (UI, API, tests). Which parts should I focus on?"
```

#### 3. **User Intent**
```bash
❌ BAD: "I'll fix this the standard way"
✅ GOOD: "I see two approaches: quick fix vs comprehensive refactor. Which do you prefer?"

❌ BAD: "I'll add the typical security measures"
✅ GOOD: "What level of security should I implement - basic validation or comprehensive hardening?"
```

#### 4. **Breaking Changes**
```bash
❌ BAD: "This might break compatibility but I'll proceed"
✅ GOOD: "This change could affect X, Y, Z. Should I proceed or use a safer approach?"

❌ BAD: "I'll migrate to the new API"
✅ GOOD: "Migrating to the new API will change how authentication works. Is this the right time?"
```

### Clarification Templates

#### For Technical Decisions:
```
"I need to clarify: [specific technical choice]. 
Options: 
A) [Option 1 with pros/cons]
B) [Option 2 with pros/cons]
Which would you prefer?"
```

#### For Scope Questions:
```
"I found [number] of [items] that could be affected:
- [List items]
Should I update all of these or just specific ones?"
```

#### For Risk Assessment:
```
"This change could impact:
- [Impact 1]
- [Impact 2]
Risk level: [High/Medium/Low]
Should I proceed or explore alternatives?"
```

### Implementation Rules

#### For All Agents:
1. **Pause before assumptions** - If uncertain, stop and ask
2. **Be specific** - Ask about exact requirements, not general intent
3. **Provide context** - Explain why the clarification is needed
4. **Offer options** - Give 2-3 clear alternatives when possible
5. **Acknowledge uncertainty** - It's better to be honest about limits

#### For Complex Tasks:
1. **Break down ambiguity** - Identify each unclear aspect
2. **Prioritize questions** - Ask most critical clarifications first
3. **Suggest defaults** - "If no preference, I recommend X because..."
4. **Confirm understanding** - Repeat back what you understood

### Examples in Practice

#### Dependency Updates:
```
❌ "I'll update all your dependencies to the latest versions"
✅ "I found 15 packages that can be updated. Should I:
   A) Update only patch versions (safer)
   B) Update minor versions (new features)
   C) Let you review each one individually?"
```

#### Code Changes:
```
❌ "I'll refactor this to use modern patterns"
✅ "I can refactor this using:
   A) React hooks (requires testing changes)
   B) Keep class components (minimal changes)
   Which fits your timeline better?"
```

#### File Operations:
```
❌ "I'll create the necessary files"
✅ "I need to create files for this feature. Should I:
   - Create in src/components/ (standard location)
   - Create in src/features/newFeature/ (organized approach)
   - Check with you on the structure first?"
```

### Override Conditions

**Only make assumptions when:**
1. **Explicitly documented** - agents.md has clear guidance
2. **Industry standard** - Universally accepted best practice
3. **No risk** - Cannot break anything or cause issues
4. **Time critical** - User indicated urgency and provided constraints

**Always clarify when:**
- User requirements are ambiguous
- Multiple valid approaches exist
- Changes could affect other parts of the system
- Breaking changes are involved
- Security implications exist
- Performance trade-offs are required

---

## TypeScript Architecture & Agent Guidelines

### Type Architecture Overview
The codebase uses sophisticated TypeScript patterns that require careful handling:

**Core Type System:**
- **Discriminated Unions**: `WorkspaceEvent` (11 event types) with strict type-payload relationships
- **Complex Interfaces**: Schedule, Trip, TimePoint hierarchies with cross-references
- **Union Input Types**: `WorkspaceEventInput` preserves type safety for event emission
- **Service Integration**: Firebase, React Context, and testing utilities all typed

### Critical Type Files (READ FIRST)
```
src/types/workspaceEvents.ts      # Event system discriminated unions
src/types/schedule.ts             # Core domain types
src/types/workflow.ts             # Draft and block configuration
src/types/connectionOptimization.ts # Connection optimization types
src/types/export.ts               # Export format definitions
```

### Agent Type-First Protocols

#### 1. Pre-Change Type Analysis
**ALWAYS do this before any code changes:**
```bash
# Read related type definitions
# Understand discriminated union structure
# Check existing component prop interfaces
# Validate context provider patterns
```

#### 2. Domain-Specific Guidelines

**Event System Changes:**
- Read `workspaceEvents.ts` first to understand union structure
- Use proper discriminated union patterns: `event.type === 'data-validation'`
- Never mix payload types between different event variants
- Event emission must match `WorkspaceEventInput` constraints

**React Components:**
- Check component prop interfaces in same directory
- Validate context provider typing (AuthContext, FeatureFlagContext)
- Ensure children and render props are properly typed
- Use generic constraints for reusable components

**Test Files:**
- Create typed mock factories instead of inline objects
- Use proper test utilities that respect runtime types
- Validate test data matches actual interfaces
- Don't bypass types with `any` - fix the underlying issue

**Service Layer:**
- Check existing service interfaces before adding methods
- Maintain Firebase typing patterns
- Use proper async/await return types
- Validate error handling maintains type safety

#### 3. TypeScript Error Prevention Checklist

**Before Making Changes:**
- [ ] Read all related type definition files
- [ ] Understand discriminated union constraints
- [ ] Check component prop interface requirements
- [ ] Validate context provider patterns

**During Implementation:**
- [ ] Use type guards for union type narrowing
- [ ] Maintain strict null checking
- [ ] Preserve generic type constraints
- [ ] Follow existing error handling patterns

**After Changes:**
- [ ] Run `npx tsc --noEmit` immediately
- [ ] Fix any type errors before continuing
- [ ] Validate tests still compile and pass
- [ ] Check type coverage hasn't decreased

### Common Type Error Patterns

**1. Union Type Mismatches**
```typescript
// WRONG: Mixing event types
const event: WorkspaceEventInput = {
  type: 'data-validation',
  payload: { shortcut: 'Ctrl+S' } // This is KeyboardShortcutEvent payload!
}

// RIGHT: Match payload to event type
const event: WorkspaceEventInput = {
  type: 'data-validation',
  payload: { validationId: 'v1', status: 'valid', errors: [], warnings: [] }
}
```

**2. Context Provider Props**
```typescript
// WRONG: Passing value prop to providers
<AuthProvider value={mockAuth}>

// RIGHT: Use proper provider pattern
<AuthProvider>{children}</AuthProvider>
```

**3. Test Mock Factories**
```typescript
// WRONG: Inline test objects with missing properties
const testEvent = { type: 'schedule-data', action: 'update' };

// RIGHT: Complete typed test factory
const createScheduleDataEvent = (overrides: Partial<ScheduleDataEvent> = {}): ScheduleDataEvent => ({
  id: 'test-id',
  type: 'schedule-data',
  timestamp: Date.now(),
  source: 'test',
  priority: 1,
  payload: {
    dataType: 'trips',
    action: 'update',
    data: {},
    ...overrides.payload
  },
  ...overrides
});
```

### Automated Prevention Setup

Add these to package.json:
```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "precommit": "npm run typecheck && npm run lint",
    "ci-check": "tsc --noEmit --strict"
  }
}
```

### Type Coverage Strategy

**Current Issues to Address:**
- Event system union type mismatches in `WorkspaceContext.tsx:532`
- Test file type debt in `integration/*.test.ts` files
- Provider prop type inconsistencies
- Mock factory type safety gaps

**Gradual Migration Plan:**
1. Fix critical union type errors first
2. Create typed test factories
3. Update context provider patterns  
4. Establish type coverage baseline
5. Prevent regression with CI checks

---

## Learn-While-Building System 🎓

### The "Code Whisper" Learning Mode

**Trigger**: Say "enable learning mode" to activate seamless education without interrupting flow.

**Core Concept**: After every completed task, get a 2-3 sentence explanation of what just happened - like having a coding mentor whispering insights without slowing you down.

#### Format Structure
```
🔧 **What We Just Did**: [Brief action]
💡 **Why It Matters**: [Core concept]  
⚡ **Level Up**: [Next skill to notice]
```

#### Progressive Learning Levels

**Level 1: Visual Patterns (Weeks 1-2)**
- Spot file structures and naming conventions
- Recognize component layouts and UI patterns
- Notice data flow patterns between components

**Level 2: Logic Connections (Weeks 3-4)**
- Understand cause-and-effect in code changes
- See how user actions trigger state changes
- Grasp React hooks and state management basics

**Level 3: Architecture Thinking (Weeks 5-6)**
- Connect multiple files working together
- Understand service layers and separation of concerns
- Recognize design patterns (CRUD, Observer, etc.)

**Level 4: System Design (Weeks 7+)**
- See full application data flow
- Understand performance implications and optimization
- Grasp security considerations and best practices

#### Smart Context System
- **Task-specific**: Explanations match what we just built
- **Skill-aware**: Adjusts to your growing knowledge level
- **Pattern-focused**: Highlights reusable concepts you'll see again  
- **Flow-preserving**: Never interrupts active building sessions

#### Example Learning Whisper
```
🔧 **What We Just Did**: Added navigation buttons to TimePoints page with workflow state management
💡 **Why It Matters**: This demonstrates React's unidirectional data flow - user clicks trigger functions that update state and navigate with preserved context
⚡ **Level Up**: Next time, notice how navigate() accepts state objects that persist data across page transitions
```

**Status**: Ready to activate on-demand | **Learning Style**: Vibe Coding Education

---

## Connection Point Optimization - Production Ready ✅

**Status**: Complete and production-ready transit schedule optimization system

**Core Features**:
- **Smart Recovery Time Optimizer**: Adjusts recovery times strategically to hit connection windows
- **Recovery Bank System**: Borrows/lends recovery time across stops with flexibility scoring  
- **Connection Window Calculator**: Evaluates ideal/partial/missed connection opportunities
- **Visual Optimization Dashboard**: Interactive timeline with before/after comparisons
- **Performance Optimized**: <5s for <100 trips, <30s for 500+ trips

**Key Components**:
- **ConnectionOptimization** (`/connection-optimization`) - Main configuration interface
- **Visual Dashboard** (`/visual-dashboard`) - Optimization results visualization  
- **Recovery Bank Service** - Time redistribution engine with borrowing/lending
- **Optimization Engine** - Constraint solver with memoization and caching
- **Headway Correction Service** - Self-correcting schedule adjustments

**Navigation**: Accessible from Summary Schedule page → "Optimize Connections" button

### New Components (Recently Added)
- **SaveToDraft** - Manual save functionality with status feedback
- **ConnectionLibrary** - Connection point management and templates
- **ConnectionPriorityList** - Priority-based connection ordering
- **KeyboardShortcutsHelp** - Comprehensive keyboard navigation system
- **WorkflowBreadcrumbs** - Enhanced navigation with workflow awareness
- **AppHeader** - Unified application header with branding
- **ErrorBoundary** - Application-wide error handling
- **AutoSaveIndicator** - Real-time draft save status display

### New Services (Recently Added)
- **connectionOptimizationService** - Main optimization engine
- **recoveryBankService** - Time borrowing/lending logic
- **connectionWindowService** - Connection window calculations
- **firebaseConnectionService** - Cloud sync for connection data
- **headwayCorrectionService** - Schedule self-correction algorithms
- **optimizationEngine** - Constraint solving with memoization
- **workspaceEventBus** - Event-driven architecture implementation
- **dashboardMetrics** - Performance and usage analytics

### New Utilities (Recently Added)
- **routeDetector** - Automatic route pattern detection
- **timeUtils** - Enhanced time manipulation functions
- **optimizationValidation** - Constraint and result validation

---

## Workflow Progress Persistence Fix (ALL PHASES COMPLETE ✅)

### Problem Solved
Workflow progress and data weren't persisting across browser sessions. Users couldn't save work on one computer and continue on another.

### Implementation Status
**✅ Week 1 Complete** (Phase 1-2): Core Firebase sync + Automatic progress tracking
**✅ Week 2 Complete** (Phase 3): Full state restoration implemented
**✅ Week 3 Complete** (Phase 4-5): Resilience, testing, and optimization done

#### ✅ Phase 1: Core Firebase Integration
- Modified `draftService.saveWorkflow()` to sync with Firebase `workflow_progress` collection
- Added `loadWorkflowFromCloud()` for Firebase-first loading with localStorage fallback
- Fixed WorkflowBreadcrumbs loading logic to use cloud sync
- Ensured proper async/await handling throughout

#### ✅ Phase 2: Automatic Progress Tracking  
- Fixed TimePoints.tsx to await updateStepStatus and save all analysis data
- Added updateStepStatus to BlockConfiguration.tsx with full block data
- Added updateStepStatus to BlockSummarySchedule.tsx with schedule data
- Implemented simple 25% progress increments (Upload→25%, TimePoints→50%, Blocks→75%, Summary→100%)

#### ✅ Phase 3: State Restoration
- Added `loadDraftWithFullState()` method for complete draft + workflow + stepData loading
- Enhanced DraftLibrary to navigate with full state restoration
- Added state restoration hooks to TimePoints, BlockConfiguration, and BlockSummarySchedule
- Updated WorkflowBreadcrumbs navigation to preserve state between steps
- Created `resumeWorkflow()` for automatic last-step navigation

#### ✅ Phase 4: Resilience & Conflict Resolution
- Implemented offline queue with automatic sync on reconnection
- Added version-based conflict detection and resolution
- Created retry logic with exponential backoff (2s, 4s, 8s)
- Built SyncStatusIndicator component for real-time feedback
- Added browser online/offline event handling

#### ✅ Phase 5: Testing & Optimization
- Created comprehensive test suite (unit, integration, E2E, performance)
- Achieved < 2s save latency for small drafts, < 10s for large
- Implemented memory management and cleanup
- Added test commands: `npm run test:workflow-persistence`
- Reached 90%+ code coverage on critical paths

### Key Technical Achievements
- **Firebase Collection**: `workflow_progress` stores all workflow state
- **Dual Storage**: Firebase primary with localStorage cache/fallback
- **Atomic Operations**: All saves are transactional with proper error handling
- **Type Safety**: Full TypeScript coverage with strict type checking
- **Backward Compatible**: Works with existing drafts seamlessly

### User Experience Now
- ✅ Progress persists across sessions and devices
- ✅ Automatic saving to Firebase on each step completion
- ✅ Works offline with sync when reconnected
- ✅ Simple 25% progress increments per major step
- ✅ Check marks stay checked when reloading drafts
- ✅ **Full state restoration** - Resume exactly where you left off with all data
- ✅ **Draft loading** navigates to last active step automatically
- ✅ **Complete data preservation** - Service bands, block configs, schedules all restored
- ✅ **Resilient to network issues** - Offline queue ensures no data loss
- ✅ **Conflict resolution** - Handles concurrent edits gracefully
- ✅ **Visual sync status** - Real-time feedback on save status
- ✅ **Thoroughly tested** - Comprehensive test suite with 90%+ coverage

## Task Triage Guide
- **Bugfix or Regression**: Reproduce with Quick Start data, inspect recent changes in affected modules, and run `npm test` plus targeted suites before and after fixes.
- **New Feature or UX Update**: Align with active specs in `docs/` and update both desktop and fullscreen states; capture screenshots or notes in `DECISIONS.md` when workflows change.
- **Data Processing or Import Work**: Validate transformations against `example_schedule/Raw_Data.csv` and extend `src/integration/testUtils/fixtures.ts` instead of creating bespoke mock data.
- **Performance or Scaling**: Profiling starts in `src/components/workspace/` virtualization toggles; test with large schedules (1000 trips) and monitor memory logs.
- **Security or Compliance**: Coordinate with guardrails above, keep validation hooks intact, and run `npm run test:workflow-persistence` plus security smoke tests before shipping.

### Testing Instructions
To verify the workflow persistence is working:
1. Create a new draft and upload schedule data
2. Complete TimePoints analysis with service bands
3. Configure blocks and generate schedule
4. Close browser completely (or switch to different computer)
5. Open application and load the draft from library
6. Verify: Progress bar shows correct status, all data is restored, you're on the last active step

### Test Commands
```bash
npm run test:workflow-persistence        # Complete test suite
npm run test:workflow-persistence:fast   # Skip performance tests
npm run test:workflow-units             # Unit tests only
npm run test:workflow-integration       # Integration tests only
```

## Svelte MCP Server 🎯

You have access to the Svelte MCP server, providing comprehensive Svelte 5 and SvelteKit documentation. Use these tools effectively when working with Svelte projects:

### Available MCP Tools:

#### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

#### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

#### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

#### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.

---
**Version**: 2.4.0 | **Status**: Production Ready | **Updated**: January 2025
**Last Major Update**: 2025-08-11 – Added assistant onboarding guidance, guardrails, and operational playbooks
**Stack**: React 19, Material-UI v7, TypeScript 5.9, Router v7, Firebase
**Latest Enhancement**: Complete workflow persistence with resilience, offline support, and comprehensive testing




