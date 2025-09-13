/**
 * Connection Templates for Bus Schedule Optimization
 * Predefined templates for common connection types in the region
 */

import { ConnectionPoint, ConnectionPointType, DayType } from '../types/connectionOptimization';

/**
 * Georgian College connection templates
 * Classes typically start on the hour and end at :50
 */
export const GEORGIAN_COLLEGE_TEMPLATES: ConnectionPoint[] = [
  {
    id: 'georgian-arrival-08',
    name: 'Georgian College - 8:00 AM Classes',
    type: 'college-arrival',
    timepointId: 'georgian-college-main',
    timepointName: 'Georgian College Main Campus',
    priority: 9,
    scheduleTimes: {
      arrivalTime: '07:50',
      tolerance: 5
    },
    dayTypes: ['weekday'],
    connectionWindows: {
      ideal: { min: 10, max: 15 },
      partial: { min: 5, max: 20 },
      missed: { threshold: 20 }
    },
    metadata: {
      serviceName: 'Georgian College',
      locationDetails: 'Main Campus Building',
      notes: 'Peak morning class arrival - high priority'
    }
  },
  {
    id: 'georgian-arrival-09',
    name: 'Georgian College - 9:00 AM Classes',
    type: 'college-arrival',
    timepointId: 'georgian-college-main',
    timepointName: 'Georgian College Main Campus',
    priority: 8,
    scheduleTimes: {
      arrivalTime: '08:50',
      tolerance: 5
    },
    dayTypes: ['weekday'],
    connectionWindows: {
      ideal: { min: 10, max: 15 },
      partial: { min: 5, max: 20 },
      missed: { threshold: 20 }
    },
    metadata: {
      serviceName: 'Georgian College',
      locationDetails: 'Main Campus Building',
      notes: 'Second morning class period'
    }
  },
  {
    id: 'georgian-arrival-10',
    name: 'Georgian College - 10:00 AM Classes',
    type: 'college-arrival',
    timepointId: 'georgian-college-main',
    timepointName: 'Georgian College Main Campus',
    priority: 7,
    scheduleTimes: {
      arrivalTime: '09:50',
      tolerance: 5
    },
    dayTypes: ['weekday'],
    connectionWindows: {
      ideal: { min: 10, max: 15 },
      partial: { min: 5, max: 20 },
      missed: { threshold: 20 }
    },
    metadata: {
      serviceName: 'Georgian College',
      locationDetails: 'Main Campus Building'
    }
  },
  {
    id: 'georgian-departure-1150',
    name: 'Georgian College - 11:50 AM Class End',
    type: 'college-departure',
    timepointId: 'georgian-college-main',
    timepointName: 'Georgian College Main Campus',
    priority: 8,
    scheduleTimes: {
      departureTime: '12:00',
      tolerance: 5
    },
    dayTypes: ['weekday'],
    connectionWindows: {
      ideal: { min: 5, max: 10 },
      partial: { min: 3, max: 15 },
      missed: { threshold: 15 }
    },
    metadata: {
      serviceName: 'Georgian College',
      locationDetails: 'Main Campus Building',
      notes: 'Pre-lunch departure - students going to work/home'
    }
  },
  {
    id: 'georgian-departure-1550',
    name: 'Georgian College - 3:50 PM Class End',
    type: 'college-departure',
    timepointId: 'georgian-college-main',
    timepointName: 'Georgian College Main Campus',
    priority: 9,
    scheduleTimes: {
      departureTime: '16:00',
      tolerance: 5
    },
    dayTypes: ['weekday'],
    connectionWindows: {
      ideal: { min: 5, max: 10 },
      partial: { min: 3, max: 15 },
      missed: { threshold: 15 }
    },
    metadata: {
      serviceName: 'Georgian College',
      locationDetails: 'Main Campus Building',
      notes: 'Peak afternoon departure - highest priority'
    }
  }
];

/**
 * GO Train connection templates
 * Based on typical GO Transit schedules for Barrie line
 */
export const GO_TRAIN_TEMPLATES: ConnectionPoint[] = [
  {
    id: 'go-train-nb-0645',
    name: 'GO Train Northbound - 6:45 AM',
    type: 'go-train',
    timepointId: 'go-station-barrie',
    timepointName: 'Barrie GO Station',
    priority: 10,
    scheduleTimes: {
      arrivalTime: '06:35',
      departureTime: '06:45',
      tolerance: 3
    },
    dayTypes: ['weekday'],
    connectionWindows: {
      ideal: { min: 8, max: 12 },
      partial: { min: 5, max: 15 },
      missed: { threshold: 15 }
    },
    metadata: {
      serviceName: 'GO Transit',
      locationDetails: 'Platform 1',
      notes: 'Early morning commuter train to Toronto'
    }
  },
  {
    id: 'go-train-nb-0745',
    name: 'GO Train Northbound - 7:45 AM',
    type: 'go-train',
    timepointId: 'go-station-barrie',
    timepointName: 'Barrie GO Station',
    priority: 10,
    scheduleTimes: {
      arrivalTime: '07:35',
      departureTime: '07:45',
      tolerance: 3
    },
    dayTypes: ['weekday'],
    connectionWindows: {
      ideal: { min: 8, max: 12 },
      partial: { min: 5, max: 15 },
      missed: { threshold: 15 }
    },
    metadata: {
      serviceName: 'GO Transit',
      locationDetails: 'Platform 1',
      notes: 'Peak morning commuter train'
    }
  },
  {
    id: 'go-train-sb-1715',
    name: 'GO Train Southbound - 5:15 PM',
    type: 'go-train',
    timepointId: 'go-station-barrie',
    timepointName: 'Barrie GO Station',
    priority: 10,
    scheduleTimes: {
      arrivalTime: '17:15',
      departureTime: '17:25',
      tolerance: 3
    },
    dayTypes: ['weekday'],
    connectionWindows: {
      ideal: { min: 5, max: 10 },
      partial: { min: 3, max: 12 },
      missed: { threshold: 12 }
    },
    metadata: {
      serviceName: 'GO Transit',
      locationDetails: 'Platform 2',
      notes: 'Evening commuter train from Toronto'
    }
  },
  {
    id: 'go-train-sb-1815',
    name: 'GO Train Southbound - 6:15 PM',
    type: 'go-train',
    timepointId: 'go-station-barrie',
    timepointName: 'Barrie GO Station',
    priority: 9,
    scheduleTimes: {
      arrivalTime: '18:15',
      departureTime: '18:25',
      tolerance: 3
    },
    dayTypes: ['weekday'],
    connectionWindows: {
      ideal: { min: 5, max: 10 },
      partial: { min: 3, max: 12 },
      missed: { threshold: 12 }
    },
    metadata: {
      serviceName: 'GO Transit',
      locationDetails: 'Platform 2',
      notes: 'Late evening commuter train'
    }
  }
];

/**
 * High School connection templates
 * Standard bell times for local high schools
 */
export const HIGH_SCHOOL_TEMPLATES: ConnectionPoint[] = [
  {
    id: 'bci-arrival-morning',
    name: 'Barrie Central CI - Morning Bell',
    type: 'high-school',
    timepointId: 'barrie-central-ci',
    timepointName: 'Barrie Central Collegiate',
    priority: 8,
    scheduleTimes: {
      arrivalTime: '08:20',
      tolerance: 5
    },
    dayTypes: ['weekday'],
    connectionWindows: {
      ideal: { min: 8, max: 12 },
      partial: { min: 5, max: 15 },
      missed: { threshold: 15 }
    },
    metadata: {
      serviceName: 'Simcoe County DSB',
      locationDetails: 'Main entrance',
      notes: 'School start time: 8:30 AM'
    }
  },
  {
    id: 'bci-departure-afternoon',
    name: 'Barrie Central CI - Afternoon Dismissal',
    type: 'high-school',
    timepointId: 'barrie-central-ci',
    timepointName: 'Barrie Central Collegiate',
    priority: 9,
    scheduleTimes: {
      departureTime: '15:10',
      tolerance: 5
    },
    dayTypes: ['weekday'],
    connectionWindows: {
      ideal: { min: 5, max: 8 },
      partial: { min: 3, max: 12 },
      missed: { threshold: 12 }
    },
    metadata: {
      serviceName: 'Simcoe County DSB',
      locationDetails: 'Main entrance',
      notes: 'School end time: 3:00 PM'
    }
  },
  {
    id: 'bss-arrival-morning',
    name: 'Barrie South Secondary - Morning Bell',
    type: 'high-school',
    timepointId: 'barrie-south-secondary',
    timepointName: 'Barrie South Secondary',
    priority: 8,
    scheduleTimes: {
      arrivalTime: '08:20',
      tolerance: 5
    },
    dayTypes: ['weekday'],
    connectionWindows: {
      ideal: { min: 8, max: 12 },
      partial: { min: 5, max: 15 },
      missed: { threshold: 15 }
    },
    metadata: {
      serviceName: 'Simcoe County DSB',
      locationDetails: 'Bus loop',
      notes: 'School start time: 8:30 AM'
    }
  },
  {
    id: 'bss-departure-afternoon',
    name: 'Barrie South Secondary - Afternoon Dismissal',
    type: 'high-school',
    timepointId: 'barrie-south-secondary',
    timepointName: 'Barrie South Secondary',
    priority: 9,
    scheduleTimes: {
      departureTime: '15:10',
      tolerance: 5
    },
    dayTypes: ['weekday'],
    connectionWindows: {
      ideal: { min: 5, max: 8 },
      partial: { min: 3, max: 12 },
      missed: { threshold: 12 }
    },
    metadata: {
      serviceName: 'Simcoe County DSB',
      locationDetails: 'Bus loop',
      notes: 'School end time: 3:00 PM'
    }
  }
];

/**
 * Default connection windows by connection type
 */
export const DEFAULT_CONNECTION_WINDOWS = {
  'college-arrival': {
    ideal: { min: 10, max: 15 },
    partial: { min: 5, max: 20 },
    missed: { threshold: 20 }
  },
  'college-departure': {
    ideal: { min: 5, max: 10 },
    partial: { min: 3, max: 15 },
    missed: { threshold: 15 }
  },
  'go-train': {
    ideal: { min: 8, max: 12 },
    partial: { min: 5, max: 15 },
    missed: { threshold: 15 }
  },
  'high-school': {
    ideal: { min: 8, max: 12 },
    partial: { min: 5, max: 15 },
    missed: { threshold: 15 }
  }
} as const;

/**
 * Priority levels by connection type
 */
export const DEFAULT_PRIORITIES = {
  'go-train': 10,           // Highest - trains run on fixed schedule
  'college-departure': 9,    // High - students need to get to work
  'high-school': 8,         // High - mandatory attendance
  'college-arrival': 7      // Medium-high - some flexibility
} as const;

/**
 * Get all connection templates organized by type
 */
export function getAllConnectionTemplates(): Record<ConnectionPointType, ConnectionPoint[]> {
  return {
    'college-arrival': GEORGIAN_COLLEGE_TEMPLATES.filter(t => t.type === 'college-arrival'),
    'college-departure': GEORGIAN_COLLEGE_TEMPLATES.filter(t => t.type === 'college-departure'),
    'go-train': GO_TRAIN_TEMPLATES,
    'high-school': HIGH_SCHOOL_TEMPLATES
  };
}

/**
 * Get connection templates by type
 */
export function getConnectionTemplatesByType(type: ConnectionPointType): ConnectionPoint[] {
  const allTemplates = getAllConnectionTemplates();
  return allTemplates[type] || [];
}

/**
 * Create a custom connection point with default settings
 */
export function createCustomConnectionPoint(
  overrides: Partial<ConnectionPoint> & { 
    id: string; 
    name: string; 
    type: ConnectionPointType;
    timepointId: string;
    timepointName: string;
  }
): ConnectionPoint {
  const defaultWindows = DEFAULT_CONNECTION_WINDOWS[overrides.type];
  const defaultPriority = DEFAULT_PRIORITIES[overrides.type];

  return {
    priority: defaultPriority,
    scheduleTimes: {},
    dayTypes: ['weekday'],
    connectionWindows: defaultWindows,
    ...overrides
  };
}

/**
 * Update connection template with seasonal schedule
 */
export function createSeasonalConnectionTemplate(
  baseTemplate: ConnectionPoint,
  seasonalOverrides: Partial<ConnectionPoint>
): ConnectionPoint {
  return {
    ...baseTemplate,
    ...seasonalOverrides,
    id: `${baseTemplate.id}-seasonal`,
    metadata: {
      ...baseTemplate.metadata,
      ...seasonalOverrides.metadata,
      seasonalSchedule: true
    }
  };
}

/**
 * Validate connection template
 */
export function validateConnectionTemplate(template: ConnectionPoint): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!template.id) errors.push('ID is required');
  if (!template.name) errors.push('Name is required');
  if (!template.timepointId) errors.push('Timepoint ID is required');
  if (!template.timepointName) errors.push('Timepoint name is required');
  if (template.priority < 1 || template.priority > 10) errors.push('Priority must be between 1 and 10');
  if (template.dayTypes.length === 0) errors.push('At least one day type must be specified');
  
  if (template.connectionWindows) {
    const { ideal, partial, missed } = template.connectionWindows;
    if (ideal.min >= ideal.max) errors.push('Ideal window min must be less than max');
    if (partial.min >= partial.max) errors.push('Partial window min must be less than max');
    if (missed.threshold <= 0) errors.push('Missed threshold must be positive');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}