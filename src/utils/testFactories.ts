/**
 * Type-safe test factory utilities
 * Provides proper typed mock objects for tests to prevent TypeScript errors
 */

import {
  WorkspaceEvent,
  WorkspaceEventInput,
  DataValidationEvent,
  ScheduleDataEvent,
  WorkflowProgressEvent,
  UserInteractionEvent,
  KeyboardShortcutEvent,
  AutoSaveEvent,
  PanelStateEvent,
  ContextMenuEvent,
  NotificationEvent,
  PerformanceEvent,
  CollaborationEvent
} from '../types/workspaceEvents';
import { TimePoint, Schedule, Trip, TimePointData } from '../types/schedule';
import { WorkflowDraftState, BlockConfiguration } from '../types/workflow';

/**
 * Base event factory with common properties
 */
const createBaseEvent = (overrides: Partial<WorkspaceEvent> = {}) => ({
  id: `test-${Date.now()}-${Math.random()}`,
  timestamp: Date.now(),
  source: 'test-factory',
  priority: 1,
  ...overrides
});

/**
 * Data validation event factory
 */
export const createDataValidationEvent = (
  overrides: Partial<DataValidationEvent> = {}
): DataValidationEvent => ({
  ...createBaseEvent(overrides),
  type: 'data-validation' as const,
  payload: {
    validationId: 'test-validation',
    status: 'valid' as const,
    errors: [],
    warnings: [],
    affectedData: 'upload' as const,
    ...overrides.payload
  },
  ...overrides
});

/**
 * Schedule data event factory
 */
export const createScheduleDataEvent = (
  overrides: Partial<ScheduleDataEvent> = {}
): ScheduleDataEvent => ({
  ...createBaseEvent(overrides),
  type: 'schedule-data' as const,
  payload: {
    dataType: 'trips' as const,
    action: 'update' as const,
    data: {},
    ...overrides.payload
  },
  ...overrides
});

/**
 * Workflow progress event factory
 */
export const createWorkflowProgressEvent = (
  overrides: Partial<WorkflowProgressEvent> = {}
): WorkflowProgressEvent => ({
  ...createBaseEvent(overrides),
  type: 'workflow-progress' as const,
  payload: {
    currentStep: 'upload' as const,
    progress: 50,
    canProceed: true,
    ...overrides.payload
  },
  ...overrides
});

/**
 * User interaction event factory
 */
export const createUserInteractionEvent = (
  overrides: Partial<UserInteractionEvent> = {}
): UserInteractionEvent => ({
  ...createBaseEvent(overrides),
  type: 'user-interaction' as const,
  payload: {
    action: 'click' as const,
    element: 'test-element',
    elementType: 'button' as const,
    ...overrides.payload
  },
  ...overrides
});

/**
 * Keyboard shortcut event factory
 */
export const createKeyboardShortcutEvent = (
  overrides: Partial<KeyboardShortcutEvent> = {}
): KeyboardShortcutEvent => ({
  ...createBaseEvent(overrides),
  type: 'keyboard-shortcut' as const,
  payload: {
    shortcut: 'Ctrl+S',
    action: 'save',
    ...overrides.payload
  },
  ...overrides
});

/**
 * Auto-save event factory
 */
export const createAutoSaveEvent = (
  overrides: Partial<AutoSaveEvent> = {}
): AutoSaveEvent => ({
  ...createBaseEvent(overrides),
  type: 'auto-save' as const,
  payload: {
    draftId: 'test-draft',
    status: 'saved' as const,
    ...overrides.payload
  },
  ...overrides
});

/**
 * Panel state event factory
 */
export const createPanelStateEvent = (
  overrides: Partial<PanelStateEvent> = {}
): PanelStateEvent => ({
  ...createBaseEvent(overrides),
  type: 'panel-state' as const,
  payload: {
    panelId: 'test-panel',
    action: 'open' as const,
    ...overrides.payload
  },
  ...overrides
});

/**
 * Context menu event factory
 */
export const createContextMenuEvent = (
  overrides: Partial<ContextMenuEvent> = {}
): ContextMenuEvent => ({
  ...createBaseEvent(overrides),
  type: 'context-menu' as const,
  payload: {
    action: 'open' as const,
    ...overrides.payload
  },
  ...overrides
});

/**
 * Notification event factory
 */
export const createNotificationEvent = (
  overrides: Partial<NotificationEvent> = {}
): NotificationEvent => ({
  ...createBaseEvent(overrides),
  type: 'notification' as const,
  payload: {
    level: 'info' as const,
    title: 'Test Notification',
    message: 'Test message',
    ...overrides.payload
  },
  ...overrides
});

/**
 * Performance event factory
 */
export const createPerformanceEvent = (
  overrides: Partial<PerformanceEvent> = {}
): PerformanceEvent => ({
  ...createBaseEvent(overrides),
  type: 'performance' as const,
  payload: {
    metric: 'render-time' as const,
    value: 100,
    ...overrides.payload
  },
  ...overrides
});

/**
 * Collaboration event factory
 */
export const createCollaborationEvent = (
  overrides: Partial<CollaborationEvent> = {}
): CollaborationEvent => ({
  ...createBaseEvent(overrides),
  type: 'collaboration' as const,
  payload: {
    action: 'user-joined' as const,
    userId: 'test-user',
    ...overrides.payload
  },
  ...overrides
});

/**
 * TimePoint factory
 */
export const createTimePoint = (overrides: Partial<TimePoint> = {}): TimePoint => ({
  id: `tp-${Date.now()}`,
  name: 'Test Time Point',
  sequence: 1,
  ...overrides
});

/**
 * TimePointData factory for CSV parsing tests
 */
export const createTimePointData = (overrides: Partial<TimePointData> = {}): TimePointData => ({
  fromTimePoint: 'Test Origin',
  toTimePoint: 'Test Destination', 
  timePeriod: '06:00-06:30',
  percentile50: 15,
  percentile80: 18,
  ...overrides
});

/**
 * Trip factory
 */
export const createTrip = (overrides: Partial<Trip> = {}): Trip => ({
  tripNumber: Date.now(),
  blockNumber: 1,
  departureTime: '07:00',
  serviceBand: 'standard',
  arrivalTimes: {},
  departureTimes: {},
  recoveryTimes: {},
  recoveryMinutes: 0,
  ...overrides
});

/**
 * Block configuration factory
 */
export const createBlockConfiguration = (overrides: Partial<BlockConfiguration> = {}): BlockConfiguration => ({
  blockNumber: 1,
  startTime: '07:00',
  endTime: '22:00',
  ...overrides
});

/**
 * Workflow draft state factory
 */
export const createWorkflowDraftState = (overrides: Partial<WorkflowDraftState> = {}): WorkflowDraftState => ({
  draftId: 'test-draft-id',
  currentStep: 'upload' as const,
  originalData: {
    fileName: 'test.csv',
    fileType: 'csv' as const,
    uploadedData: {
      segments: [],
      timePoints: ['Test Point A', 'Test Point B'],
      validationSummary: {
        totalSegments: 1,
        validSegments: 1,
        invalidSegments: 0,
        timeSlots: 1
      }
    },
    uploadTimestamp: new Date().toISOString()
  },
  metadata: {
    createdAt: new Date().toISOString(),
    lastModifiedAt: new Date().toISOString(),
    lastModifiedStep: 'upload',
    version: 1,
    isPublished: false
  },
  ...overrides
});

/**
 * Generic event input factory - removes id and timestamp for event emission
 */
export const createEventInput = <T extends WorkspaceEvent>(
  eventFactory: () => T
): Omit<T, 'id' | 'timestamp'> => {
  const event = eventFactory();
  const { id, timestamp, ...eventInput } = event;
  return eventInput as Omit<T, 'id' | 'timestamp'>;
};

/**
 * Mock auth context value
 */
export const createMockAuthContext = () => ({
  user: { id: 'test-user', email: 'test@example.com' },
  loading: false,
  signInWithEmail: jest.fn(),
  signInWithGoogle: jest.fn(), 
  signInAnonymously: jest.fn(),
  signOut: jest.fn()
});

/**
 * Mock feature flag context value
 */
export const createMockFeatureFlagContext = () => ({
  isCommandCenter: false,
  isDuolingoBlocks: false,
  isVirtualization: false,
  toggleCommandCenter: jest.fn(),
  toggleDuolingoBlocks: jest.fn(),
  toggleVirtualization: jest.fn()
});