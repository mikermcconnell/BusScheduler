/**
 * Workspace Event Types
 * Type-safe event definitions for the workspace event bus
 * Ensures cross-panel communication is predictable and debuggable
 */

import { ServiceBand, TimePoint, Trip, Schedule } from './schedule';
import { WorkflowDraftState } from './workflow';
import { BlockConfiguration } from './workflow';

/**
 * Base event interface that all workspace events must implement
 */
export interface BaseWorkspaceEvent {
  /** Unique event identifier */
  id: string;
  /** Event type for discrimination */
  type: string;
  /** Timestamp when event was emitted */
  timestamp: number;
  /** Source component/panel that emitted the event */
  source: string;
  /** Optional target component/panel */
  target?: string;
  /** Event priority (higher numbers = higher priority) */
  priority: number;
}

/**
 * Data validation events
 */
export interface DataValidationEvent extends BaseWorkspaceEvent {
  type: 'data-validation';
  payload: {
    validationId: string;
    status: 'validating' | 'valid' | 'invalid' | 'warning';
    errors: string[];
    warnings: string[];
    affectedData?: 'upload' | 'timepoints' | 'blocks' | 'summary';
  };
}

/**
 * Panel state change events
 */
export interface PanelStateEvent extends BaseWorkspaceEvent {
  type: 'panel-state';
  payload: {
    panelId: string;
    action: 'open' | 'close' | 'minimize' | 'maximize' | 'dock' | 'undock';
    position?: { x: number; y: number; width: number; height: number };
    dockZone?: 'left' | 'right' | 'bottom' | 'center';
  };
}

/**
 * Schedule data update events
 */
export interface ScheduleDataEvent extends BaseWorkspaceEvent {
  type: 'schedule-data';
  payload: {
    dataType: 'upload' | 'timepoints' | 'service-bands' | 'blocks' | 'trips' | 'recovery-times' | 'summary-schedule';
    action: 'create' | 'update' | 'delete' | 'bulk-update';
    entityId?: string;
    data: any;
    previousData?: any;
    affectedEntities?: string[];
  };
}

/**
 * Workflow progress events
 */
export interface WorkflowProgressEvent extends BaseWorkspaceEvent {
  type: 'workflow-progress';
  payload: {
    currentStep: 'upload' | 'timepoints' | 'blocks' | 'summary' | 'ready-to-publish';
    progress: number; // 0-100
    stepData?: WorkflowDraftState;
    nextStep?: string;
    canProceed: boolean;
  };
}

/**
 * User interaction events
 */
export interface UserInteractionEvent extends BaseWorkspaceEvent {
  type: 'user-interaction';
  payload: {
    action: 'click' | 'hover' | 'focus' | 'blur' | 'scroll' | 'resize';
    element: string;
    elementType: 'panel' | 'button' | 'input' | 'table' | 'chart' | 'dialog';
    metadata?: Record<string, any>;
  };
}

/**
 * Auto-save events
 */
export interface AutoSaveEvent extends BaseWorkspaceEvent {
  type: 'auto-save';
  payload: {
    draftId: string;
    status: 'saving' | 'saved' | 'failed' | 'conflict';
    lastSaved?: string;
    error?: string;
    conflictData?: any;
  };
}

/**
 * Collaboration events
 */
export interface CollaborationEvent extends BaseWorkspaceEvent {
  type: 'collaboration';
  payload: {
    action: 'user-joined' | 'user-left' | 'user-editing' | 'concurrent-edit' | 'conflict-resolved';
    userId: string;
    userName?: string;
    editingEntity?: string;
    conflictDetails?: {
      entityId: string;
      localChanges: any;
      remoteChanges: any;
    };
  };
}

/**
 * Performance monitoring events
 */
export interface PerformanceEvent extends BaseWorkspaceEvent {
  type: 'performance';
  payload: {
    metric: 'render-time' | 'memory-usage' | 'cpu-usage' | 'network-latency' | 'bundle-size';
    value: number;
    threshold?: number;
    warningLevel?: 'low' | 'medium' | 'high' | 'critical';
    componentId?: string;
  };
}

/**
 * Notification events
 */
export interface NotificationEvent extends BaseWorkspaceEvent {
  type: 'notification';
  payload: {
    level: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    autoHide?: boolean;
    hideAfter?: number; // milliseconds
    actionText?: string;
    actionCallback?: () => void;
  };
}

/**
 * Context menu events
 */
export interface ContextMenuEvent extends BaseWorkspaceEvent {
  type: 'context-menu';
  payload: {
    action: 'open' | 'close' | 'item-selected';
    position?: { x: number; y: number };
    contextId?: string;
    selectedItem?: string;
    availableActions?: string[];
  };
}

/**
 * Keyboard shortcut events
 */
export interface KeyboardShortcutEvent extends BaseWorkspaceEvent {
  type: 'keyboard-shortcut';
  payload: {
    shortcut: string;
    action: string;
    context?: string;
    preventDefault?: boolean;
  };
}

/**
 * Draft update events - when draft names or metadata change
 */
export interface DraftUpdateEvent extends BaseWorkspaceEvent {
  type: 'draft-update';
  payload: {
    draftId: string;
    draftName: string;
    previousName?: string;
    updateType: 'name' | 'content' | 'metadata';
    metadata?: {
      lastModified: string;
      modifiedBy?: string;
    };
  };
}

/**
 * Union type of all workspace events
 */
export type WorkspaceEvent = 
  | DataValidationEvent
  | PanelStateEvent
  | ScheduleDataEvent
  | WorkflowProgressEvent
  | UserInteractionEvent
  | AutoSaveEvent
  | CollaborationEvent
  | PerformanceEvent
  | NotificationEvent
  | ContextMenuEvent
  | KeyboardShortcutEvent
  | DraftUpdateEvent;

/**
 * Event input type for emit function - preserves discriminated union
 * Each event type without id/timestamp while maintaining type-payload relationship
 */
export type WorkspaceEventInput = 
  | Omit<DataValidationEvent, 'id' | 'timestamp'>
  | Omit<PanelStateEvent, 'id' | 'timestamp'>
  | Omit<ScheduleDataEvent, 'id' | 'timestamp'>
  | Omit<WorkflowProgressEvent, 'id' | 'timestamp'>
  | Omit<UserInteractionEvent, 'id' | 'timestamp'>
  | Omit<AutoSaveEvent, 'id' | 'timestamp'>
  | Omit<CollaborationEvent, 'id' | 'timestamp'>
  | Omit<PerformanceEvent, 'id' | 'timestamp'>
  | Omit<NotificationEvent, 'id' | 'timestamp'>
  | Omit<ContextMenuEvent, 'id' | 'timestamp'>
  | Omit<KeyboardShortcutEvent, 'id' | 'timestamp'>
  | Omit<DraftUpdateEvent, 'id' | 'timestamp'>;

/**
 * Event handler type
 */
export type EventHandler<T extends WorkspaceEvent = WorkspaceEvent> = (event: T) => void | Promise<void>;

/**
 * Event listener options
 */
export interface EventListenerOptions {
  /** Execute once then remove */
  once?: boolean;
  /** Priority for execution order (higher = earlier) */
  priority?: number;
  /** Debounce delay in milliseconds */
  debounce?: number;
  /** Throttle delay in milliseconds */
  throttle?: number;
  /** Filter function to conditionally handle events */
  filter?: (event: WorkspaceEvent) => boolean;
}

/**
 * Event subscription interface
 */
export interface EventSubscription {
  /** Unique subscription ID */
  id: string;
  /** Event type being subscribed to */
  eventType: string;
  /** Handler function */
  handler: EventHandler;
  /** Options for this subscription */
  options: EventListenerOptions;
  /** Subscription timestamp */
  created: number;
  /** Last execution timestamp */
  lastExecuted?: number;
  /** Execution count */
  executionCount: number;
}

/**
 * Event bus statistics
 */
export interface EventBusStats {
  totalEvents: number;
  totalSubscriptions: number;
  eventsByType: Record<string, number>;
  subscribersByType: Record<string, number>;
  averageProcessingTime: number;
  lastReset: number;
}

/**
 * Event bus configuration
 */
export interface EventBusConfig {
  /** Maximum number of events to keep in history */
  maxHistorySize: number;
  /** Enable debug logging */
  debug: boolean;
  /** Enable performance monitoring */
  enableMetrics: boolean;
  /** Maximum processing time before warning (ms) */
  maxProcessingTime: number;
  /** Enable event replay functionality */
  enableReplay: boolean;
}
