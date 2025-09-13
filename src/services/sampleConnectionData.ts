/**
 * Sample Connection Data Service
 * 
 * ⚠️ IMPORTANT: This file contains SAMPLE DATA ONLY
 * This is temporary data for development and testing purposes.
 * When real connection data integration is implemented, this entire file should be removed.
 * 
 * DO NOT use this service in production - it's for prototyping the UI only.
 */

import { ConnectionPoint, ConnectionType } from '../types/connectionOptimization';

/**
 * Sample connection templates based on realistic Barrie transit scenarios
 * These align with the actual timepoints from the example schedule:
 * - Downtown Barrie Terminal
 * - Johnson at Napier  
 * - RVH Atrium Entrance
 * - Georgian College
 */
export class SampleConnectionDataService {
  
  /**
   * Get all sample connection templates
   * ⚠️ SAMPLE DATA - Replace with real data source when ready
   */
  static getAllSampleConnections(): ConnectionPoint[] {
    return [
      ...this.getGOTrainConnections(),
      ...this.getHighSchoolConnections(),
      ...this.getCollegeConnections(),
      ...this.getBusTransferConnections()
    ];
  }

  /**
   * Get connections by type
   */
  static getConnectionsByType(type: ConnectionPoint['type']): ConnectionPoint[] {
    return this.getAllSampleConnections().filter(conn => conn.type === type);
  }

  /**
   * GO Train connection templates (High Priority - Critical)
   */
  private static getGOTrainConnections(): ConnectionPoint[] {
    return [
      {
        id: 'go-train-morning-southbound-717',
        name: 'GO Train 7:17 AM - Southbound to Toronto',
        type: 'go-train',
        timepointId: 'downtown-barrie-terminal',
        timepointName: 'Downtown Barrie Terminal',
        priority: 9,
        scheduleTimes: {
          departureTime: '07:17',
          tolerance: 5
        },
        dayTypes: ['weekday'],
        connectionWindows: {
          ideal: { min: 5, max: 12 },
          partial: { min: 3, max: 15 },
          missed: { threshold: 20 }
        },
        metadata: {
          serviceName: 'GO Transit Barrie Line',
          locationDetails: 'Platform access via tunnel from bus terminal',
          notes: 'Critical connection - limited frequency service',
          seasonalSchedule: false
        }
      },
      {
        id: 'go-train-morning-southbound-747',
        name: 'GO Train 7:47 AM - Southbound to Toronto',
        type: 'go-train',
        timepointId: 'downtown-barrie-terminal',
        timepointName: 'Downtown Barrie Terminal',
        priority: 9,
        scheduleTimes: {
          departureTime: '07:47',
          tolerance: 5
        },
        dayTypes: ['weekday'],
        connectionWindows: {
          ideal: { min: 5, max: 12 },
          partial: { min: 3, max: 15 },
          missed: { threshold: 20 }
        },
        metadata: {
          serviceName: 'GO Transit Barrie Line',
          locationDetails: 'Platform access via tunnel from bus terminal',
          notes: 'Peak morning commuter service'
        }
      },
      {
        id: 'go-train-evening-northbound-517',
        name: 'GO Train 5:17 PM - Northbound from Toronto',
        type: 'go-train',
        timepointId: 'downtown-barrie-terminal',
        timepointName: 'Downtown Barrie Terminal',
        priority: 9,
        scheduleTimes: {
          arrivalTime: '17:17',
          tolerance: 3
        },
        dayTypes: ['weekday'],
        connectionWindows: {
          ideal: { min: 3, max: 8 },
          partial: { min: 2, max: 12 },
          missed: { threshold: 15 }
        },
        metadata: {
          serviceName: 'GO Transit Barrie Line',
          locationDetails: 'Platform access via tunnel to bus terminal',
          notes: 'Peak evening commuter connection'
        }
      }
    ];
  }

  /**
   * High School connection templates (Important - Time Sensitive)
   */
  private static getHighSchoolConnections(): ConnectionPoint[] {
    return [
      {
        id: 'barrie-central-morning',
        name: 'Barrie Central CI - Morning Bell',
        type: 'high-school',
        timepointId: 'downtown-barrie-terminal',
        timepointName: 'Downtown Barrie Terminal',
        priority: 9,
        scheduleTimes: {
          arrivalTime: '08:10',
          tolerance: 10
        },
        dayTypes: ['weekday'],
        connectionWindows: {
          ideal: { min: 8, max: 15 },
          partial: { min: 5, max: 20 },
          missed: { threshold: 25 }
        },
        metadata: {
          serviceName: 'Barrie Central Collegiate Institute',
          locationDetails: 'Short walk from downtown terminal',
          notes: 'Large enrollment - critical morning connection',
          seasonalSchedule: true
        }
      },
      {
        id: 'barrie-central-afternoon',
        name: 'Barrie Central CI - Afternoon Dismissal',
        type: 'high-school',
        timepointId: 'downtown-barrie-terminal',
        timepointName: 'Downtown Barrie Terminal',
        priority: 8,
        scheduleTimes: {
          departureTime: '14:40',
          tolerance: 15
        },
        dayTypes: ['weekday'],
        connectionWindows: {
          ideal: { min: 5, max: 20 },
          partial: { min: 3, max: 25 },
          missed: { threshold: 30 }
        },
        metadata: {
          serviceName: 'Barrie Central Collegiate Institute',
          locationDetails: 'Students walk to terminal after dismissal'
        }
      },
      {
        id: 'eastview-secondary-morning',
        name: 'Eastview Secondary School - Morning Bell',
        type: 'high-school',
        timepointId: 'johnson-at-napier',
        timepointName: 'Johnson at Napier',
        priority: 8,
        scheduleTimes: {
          arrivalTime: '08:15',
          tolerance: 10
        },
        dayTypes: ['weekday'],
        connectionWindows: {
          ideal: { min: 8, max: 15 },
          partial: { min: 5, max: 20 },
          missed: { threshold: 25 }
        },
        metadata: {
          serviceName: 'Eastview Secondary School',
          locationDetails: 'Located on Johnson Street',
          notes: 'Serves east Barrie students'
        }
      },
      {
        id: 'innisdale-secondary-morning',
        name: 'Innisdale Secondary School - Morning Bell',
        type: 'high-school',
        timepointId: 'rvh-atrium-entrance',
        timepointName: 'RVH Atrium Entrance',
        priority: 7,
        scheduleTimes: {
          arrivalTime: '08:20',
          tolerance: 12
        },
        dayTypes: ['weekday'],
        connectionWindows: {
          ideal: { min: 8, max: 15 },
          partial: { min: 5, max: 20 },
          missed: { threshold: 25 }
        },
        metadata: {
          serviceName: 'Innisdale Secondary School',
          locationDetails: 'Near hospital district',
          notes: 'Medium enrollment school'
        }
      }
    ];
  }

  /**
   * Georgian College connection templates (Standard - Flexible)
   */
  private static getCollegeConnections(): ConnectionPoint[] {
    return [
      {
        id: 'georgian-college-morning-classes',
        name: 'Georgian College - 9:00 AM Classes',
        type: 'college-arrival',
        timepointId: 'georgian-college',
        timepointName: 'Georgian College',
        priority: 7,
        scheduleTimes: {
          arrivalTime: '08:50',
          frequency: 60,
          tolerance: 15
        },
        dayTypes: ['weekday'],
        connectionWindows: {
          ideal: { min: 10, max: 20 },
          partial: { min: 5, max: 25 },
          missed: { threshold: 30 }
        },
        metadata: {
          serviceName: 'Georgian College - Morning Classes',
          locationDetails: 'Main campus entrance',
          notes: 'Peak morning class period'
        }
      },
      {
        id: 'georgian-college-afternoon-classes',
        name: 'Georgian College - 1:00 PM Classes',
        type: 'college-arrival',
        timepointId: 'georgian-college',
        timepointName: 'Georgian College',
        priority: 6,
        scheduleTimes: {
          arrivalTime: '12:50',
          frequency: 60,
          tolerance: 15
        },
        dayTypes: ['weekday'],
        connectionWindows: {
          ideal: { min: 10, max: 20 },
          partial: { min: 5, max: 25 },
          missed: { threshold: 30 }
        },
        metadata: {
          serviceName: 'Georgian College - Afternoon Classes',
          locationDetails: 'Main campus entrance',
          notes: 'Post-lunch class period'
        }
      },
      {
        id: 'georgian-college-evening-classes',
        name: 'Georgian College - 6:00 PM Classes',
        type: 'college-arrival',
        timepointId: 'georgian-college',
        timepointName: 'Georgian College',
        priority: 5,
        scheduleTimes: {
          arrivalTime: '17:50',
          frequency: 120,
          tolerance: 20
        },
        dayTypes: ['weekday'],
        connectionWindows: {
          ideal: { min: 10, max: 25 },
          partial: { min: 5, max: 30 },
          missed: { threshold: 35 }
        },
        metadata: {
          serviceName: 'Georgian College - Evening Classes',
          locationDetails: 'Main campus entrance',
          notes: 'Continuing education and night programs'
        }
      },
      {
        id: 'georgian-college-departure-330',
        name: 'Georgian College - 3:30 PM Departure',
        type: 'college-departure',
        timepointId: 'georgian-college',
        timepointName: 'Georgian College',
        priority: 6,
        scheduleTimes: {
          departureTime: '15:35',
          tolerance: 10
        },
        dayTypes: ['weekday'],
        connectionWindows: {
          ideal: { min: 5, max: 15 },
          partial: { min: 3, max: 20 },
          missed: { threshold: 25 }
        },
        metadata: {
          serviceName: 'Georgian College - Afternoon Departure',
          locationDetails: 'Main campus pickup point',
          notes: 'Major class dismissal wave'
        }
      }
    ];
  }

  /**
   * Bus route transfer connection templates (Standard - Transfer Hubs)
   */
  private static getBusTransferConnections(): ConnectionPoint[] {
    return [
      {
        id: 'downtown-hub-transfers',
        name: 'Downtown Transit Hub - Route Transfers',
        type: 'college-arrival', // Using existing type as placeholder
        timepointId: 'downtown-barrie-terminal',
        timepointName: 'Downtown Barrie Terminal',
        priority: 6,
        scheduleTimes: {
          frequency: 30,
          tolerance: 5
        },
        dayTypes: ['weekday', 'saturday'],
        connectionWindows: {
          ideal: { min: 3, max: 8 },
          partial: { min: 2, max: 12 },
          missed: { threshold: 15 }
        },
        metadata: {
          serviceName: 'Multi-Route Transit Hub',
          locationDetails: 'Central transfer point for all routes',
          notes: 'Standard bus-to-bus transfers'
        }
      },
      {
        id: 'hospital-medical-shuttle',
        name: 'RVH Medical Appointments',
        type: 'college-arrival', // Using existing type as placeholder
        timepointId: 'rvh-atrium-entrance',
        timepointName: 'RVH Atrium Entrance',
        priority: 7,
        scheduleTimes: {
          frequency: 60,
          tolerance: 20
        },
        dayTypes: ['weekday', 'saturday'],
        connectionWindows: {
          ideal: { min: 10, max: 25 },
          partial: { min: 5, max: 30 },
          missed: { threshold: 35 }
        },
        metadata: {
          serviceName: 'Royal Victoria Hospital',
          locationDetails: 'Main atrium entrance',
          notes: 'Medical appointment connections - longer wait times acceptable'
        }
      }
    ];
  }

  /**
   * Get connections by priority level
   */
  static getConnectionsByPriority(priority: number): ConnectionPoint[] {
    return this.getAllSampleConnections().filter(conn => conn.priority === priority);
  }

  /**
   * Get high priority connections (8-10)
   */
  static getHighPriorityConnections(): ConnectionPoint[] {
    return this.getAllSampleConnections().filter(conn => conn.priority >= 8);
  }

  /**
   * Search connections by name or service
   */
  static searchConnections(query: string): ConnectionPoint[] {
    const lowercaseQuery = query.toLowerCase();
    return this.getAllSampleConnections().filter(conn => 
      conn.name.toLowerCase().includes(lowercaseQuery) ||
      conn.metadata?.serviceName?.toLowerCase().includes(lowercaseQuery) ||
      conn.timepointName.toLowerCase().includes(lowercaseQuery)
    );
  }

  /**
   * Get sample connection statistics
   */
  static getConnectionStats() {
    const all = this.getAllSampleConnections();
    return {
      total: all.length,
      byType: {
        'go-train': all.filter(c => c.type === 'go-train').length,
        'high-school': all.filter(c => c.type === 'high-school').length,
        'college-arrival': all.filter(c => c.type === 'college-arrival').length,
        'college-departure': all.filter(c => c.type === 'college-departure').length,
      },
      byPriority: {
        critical: all.filter(c => c.priority >= 9).length,
        important: all.filter(c => c.priority >= 7 && c.priority < 9).length,
        standard: all.filter(c => c.priority < 7).length,
      },
      timeSpan: {
        earliest: '07:17',
        latest: '17:50'
      }
    };
  }
}

/**
 * ⚠️ DEVELOPMENT ONLY - Sample data warning
 */
export const SAMPLE_DATA_WARNING = `
🚧 USING SAMPLE CONNECTION DATA 🚧

This component is currently displaying sample/mock data for development purposes.
The connections shown are realistic examples based on Barrie transit, but they are NOT real operational data.

When real connection data integration is implemented:
1. Remove the 'sampleConnectionData.ts' file
2. Replace SampleConnectionDataService calls with real data service
3. Update ConnectionLibrary component to use actual connection sources

Sample data includes:
- 3 GO Train connections (high priority)
- 4 High School connections (time-sensitive)  
- 4 Georgian College connections (flexible)
- 2 Bus transfer connections (standard)

Total: 12 sample connection templates
`;