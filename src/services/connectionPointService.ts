/**
 * Connection Point Service
 * Service layer for managing connection points in the bus schedule optimizer
 * Handles CRUD operations for connection points with hybrid localStorage + Firebase persistence
 * 
 * ## Hybrid Architecture
 * - **Primary Storage**: localStorage (for immediate reads/writes)
 * - **Cloud Sync**: Firebase Firestore (for cross-device sync and backup)
 * - **Offline Support**: Queued operations sync when connectivity is restored
 * - **Real-time Updates**: Optional Firebase subscriptions for live data
 * 
 * ## Usage
 * The service automatically syncs to Firebase in the background. Use the regular
 * CRUD methods (saveConnectionPoint, updateConnectionPoint, etc.) for normal operations.
 * Use the Firebase-specific methods (subscribeToConnectionPoints, syncOfflineChanges)
 * for advanced cloud sync features.
 * 
 * @example
 * ```typescript
 * // Normal usage - automatically syncs to Firebase
 * const result = await connectionPointService.saveConnectionPoint('route_123', {
 *   type: ConnectionType.GO_TRAIN,
 *   locationId: 'union_station',
 *   locationName: 'Union Station',
 *   targetTime: '08:30',
 *   priority: 8,
 *   operatingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
 *   idealWindow: { min: 2, max: 8 },
 *   partialWindow: { min: 1, max: 12 },
 *   metadata: {
 *     serviceName: 'GO Lakeshore West',
 *     description: 'Morning peak connection',
 *     isActive: true
 *   }
 * });
 * 
 * // Subscribe to real-time updates
 * const unsubscribe = connectionPointService.subscribeToConnectionPoints('route_123', 
 *   (connections) => console.log('Updated:', connections.length)
 * );
 * ```
 */

import { ConnectionType, TimePoint } from '../types/schedule';
import { sanitizeText, sanitizeErrorMessage } from '../utils/inputSanitizer';
import { firebaseConnectionService } from './firebaseConnectionService';

/**
 * Connection Point interface
 */
export interface ConnectionPoint {
  /** Unique connection point identifier */
  id: string;
  /** Route identifier this connection belongs to */
  routeId: string;
  /** Type of connection */
  type: ConnectionType;
  /** TimePoint/stop ID where connection occurs */
  locationId: string;
  /** Display name of connection location */
  locationName: string;
  /** Target service schedule (train time, class time, etc.) */
  targetTime: string;
  /** Priority level (1-10, 10 being highest) */
  priority: number;
  /** Days of operation (e.g., ['monday', 'tuesday', 'wednesday']) */
  operatingDays: string[];
  /** Connection window in minutes - ideal range */
  idealWindow: { min: number; max: number };
  /** Connection window in minutes - partial range */
  partialWindow: { min: number; max: number };
  /** Additional metadata */
  metadata: {
    serviceName: string;
    description: string;
    frequency?: number; // for recurring connections
    isActive: boolean;
    createdAt: string;
    lastModified: string;
  };
}

/**
 * Connection Point Template for common configurations
 */
export interface ConnectionPointTemplate {
  /** Template identifier */
  id: string;
  /** Template name */
  name: string;
  /** Template description */
  description: string;
  /** Connection type this template applies to */
  type: ConnectionType;
  /** Default priority */
  defaultPriority: number;
  /** Default connection windows */
  defaultWindows: {
    ideal: { min: number; max: number };
    partial: { min: number; max: number };
  };
  /** Default operating days */
  defaultOperatingDays: string[];
  /** Template category */
  category: 'transit' | 'education' | 'healthcare' | 'commercial' | 'custom';
  /** Whether this is a system template */
  isSystemTemplate: boolean;
}

/**
 * Operation result interface
 */
export interface ConnectionPointResult {
  success: boolean;
  error?: string;
  connectionPoint?: ConnectionPoint;
}

/**
 * Bulk operation result
 */
export interface BulkConnectionPointResult {
  success: boolean;
  error?: string;
  connectionPoints?: ConnectionPoint[];
  successCount: number;
  failureCount: number;
  errors: string[];
}

/**
 * Connection Point Service class
 */
export class ConnectionPointService {
  private readonly STORAGE_KEY = 'scheduler2_connection_points_v1';
  private readonly TEMPLATES_KEY = 'scheduler2_connection_point_templates_v1';
  private readonly MAX_CONNECTIONS_PER_ROUTE = 50;
  private readonly MAX_TOTAL_CONNECTIONS = 500;

  // In-memory cache for performance
  private connectionPointsCache: Map<string, ConnectionPoint[]> = new Map();
  private templatesCache: ConnectionPointTemplate[] | null = null;
  private lastCacheUpdate = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Initialize default templates
   */
  private initializeDefaultTemplates(): ConnectionPointTemplate[] {
    return [
      {
        id: 'go-train-default',
        name: 'GO Train Connection',
        description: 'Standard GO Train station connection',
        type: ConnectionType.GO_TRAIN,
        defaultPriority: 8,
        defaultWindows: {
          ideal: { min: 2, max: 8 },
          partial: { min: 1, max: 12 }
        },
        defaultOperatingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        category: 'transit',
        isSystemTemplate: true
      },
      {
        id: 'school-bell-high-priority',
        name: 'High School Bell Schedule',
        description: 'High priority school bell connection',
        type: ConnectionType.SCHOOL_BELL,
        defaultPriority: 9,
        defaultWindows: {
          ideal: { min: 0, max: 5 },
          partial: { min: 0, max: 10 }
        },
        defaultOperatingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        category: 'education',
        isSystemTemplate: true
      },
      {
        id: 'school-bell-college',
        name: 'College Class Schedule',
        description: 'College class connection with flexible timing',
        type: ConnectionType.SCHOOL_BELL,
        defaultPriority: 7,
        defaultWindows: {
          ideal: { min: 0, max: 10 },
          partial: { min: 0, max: 15 }
        },
        defaultOperatingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        category: 'education',
        isSystemTemplate: true
      },
      {
        id: 'bus-route-transfer',
        name: 'Bus Route Transfer',
        description: 'Standard bus route to bus route transfer',
        type: ConnectionType.BUS_ROUTE,
        defaultPriority: 6,
        defaultWindows: {
          ideal: { min: 3, max: 10 },
          partial: { min: 1, max: 15 }
        },
        defaultOperatingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        category: 'transit',
        isSystemTemplate: true
      }
    ];
  }

  /**
   * Load connection points from localStorage with caching
   */
  private loadConnectionPoints(): Map<string, ConnectionPoint[]> {
    const now = Date.now();
    if (this.connectionPointsCache.size > 0 && (now - this.lastCacheUpdate) < this.CACHE_TTL) {
      return this.connectionPointsCache;
    }

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as { [routeId: string]: ConnectionPoint[] };
        
        // Validate and sanitize loaded data
        const connectionPointsMap = new Map<string, ConnectionPoint[]>();
        for (const [routeId, connections] of Object.entries(parsed)) {
          const validConnections = connections
            .filter(cp => this.validateConnectionPoint(cp))
            .map(cp => this.sanitizeConnectionPoint(cp));
          
          if (validConnections.length > 0) {
            connectionPointsMap.set(sanitizeText(routeId), validConnections);
          }
        }

        this.connectionPointsCache = connectionPointsMap;
        this.lastCacheUpdate = now;
        return connectionPointsMap;
      }
    } catch (error) {
      console.error('Error loading connection points:', error);
    }

    // Return empty map if load fails
    this.connectionPointsCache = new Map();
    this.lastCacheUpdate = now;
    return this.connectionPointsCache;
  }

  /**
   * Save connection points to localStorage
   */
  private saveConnectionPoints(connectionPointsMap: Map<string, ConnectionPoint[]>): boolean {
    try {
      // Convert Map to plain object for JSON serialization
      const objectToSave: { [routeId: string]: ConnectionPoint[] } = {};
      connectionPointsMap.forEach((connections, routeId) => {
        objectToSave[routeId] = connections;
      });

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(objectToSave));
      
      // Update cache
      this.connectionPointsCache = new Map(connectionPointsMap);
      this.lastCacheUpdate = Date.now();
      
      return true;
    } catch (error) {
      console.error('Error saving connection points:', error);
      return false;
    }
  }

  /**
   * Validate connection point data
   */
  private validateConnectionPoint(connectionPoint: any): connectionPoint is ConnectionPoint {
    if (!connectionPoint || typeof connectionPoint !== 'object') return false;
    
    const required = ['id', 'routeId', 'type', 'locationId', 'locationName', 'targetTime', 'priority'];
    for (const field of required) {
      if (!connectionPoint[field]) return false;
    }

    // Validate enums and ranges
    if (!Object.values(ConnectionType).includes(connectionPoint.type)) return false;
    if (connectionPoint.priority < 1 || connectionPoint.priority > 10) return false;
    
    // Validate time format (HH:MM)
    if (!/^\d{2}:\d{2}$/.test(connectionPoint.targetTime)) return false;

    return true;
  }

  /**
   * Sanitize connection point for security
   */
  private sanitizeConnectionPoint(connectionPoint: ConnectionPoint): ConnectionPoint {
    const now = new Date().toISOString();
    
    return {
      id: sanitizeText(connectionPoint.id),
      routeId: sanitizeText(connectionPoint.routeId),
      type: connectionPoint.type, // Enum, already validated
      locationId: sanitizeText(connectionPoint.locationId),
      locationName: sanitizeText(connectionPoint.locationName),
      targetTime: connectionPoint.targetTime, // Time format, already validated
      priority: Math.max(1, Math.min(10, Math.floor(connectionPoint.priority))),
      operatingDays: (connectionPoint.operatingDays || []).map(day => sanitizeText(day)),
      idealWindow: {
        min: Math.max(0, Math.floor(connectionPoint.idealWindow?.min || 0)),
        max: Math.max(0, Math.floor(connectionPoint.idealWindow?.max || 10))
      },
      partialWindow: {
        min: Math.max(0, Math.floor(connectionPoint.partialWindow?.min || 0)),
        max: Math.max(0, Math.floor(connectionPoint.partialWindow?.max || 15))
      },
      metadata: {
        serviceName: sanitizeText(connectionPoint.metadata?.serviceName || 'Unknown Service'),
        description: sanitizeText(connectionPoint.metadata?.description || ''),
        frequency: connectionPoint.metadata?.frequency ? Math.max(1, Math.floor(connectionPoint.metadata.frequency)) : undefined,
        isActive: connectionPoint.metadata?.isActive !== false, // Default to true
        createdAt: connectionPoint.metadata?.createdAt || now,
        lastModified: now
      }
    };
  }

  /**
   * Generate unique ID for connection point
   */
  private generateId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Save connection point (hybrid: localStorage + Firebase)
   */
  async saveConnectionPoint(routeId: string, connectionPoint: Omit<ConnectionPoint, 'id'>): Promise<ConnectionPointResult> {
    try {
      const sanitizedRouteId = sanitizeText(routeId);
      if (!sanitizedRouteId) {
        return { success: false, error: 'Invalid route ID' };
      }

      const connectionPointsMap = this.loadConnectionPoints();
      const existingConnections = connectionPointsMap.get(sanitizedRouteId) || [];

      // Check limits
      if (existingConnections.length >= this.MAX_CONNECTIONS_PER_ROUTE) {
        return { success: false, error: `Maximum ${this.MAX_CONNECTIONS_PER_ROUTE} connection points per route exceeded` };
      }

      const totalConnections = Array.from(connectionPointsMap.values()).reduce((sum, conns) => sum + conns.length, 0);
      if (totalConnections >= this.MAX_TOTAL_CONNECTIONS) {
        return { success: false, error: `Maximum ${this.MAX_TOTAL_CONNECTIONS} total connection points exceeded` };
      }

      // Create new connection point with generated ID
      const newConnectionPoint: ConnectionPoint = {
        ...connectionPoint,
        id: this.generateId(),
        routeId: sanitizedRouteId
      };

      // Validate and sanitize
      if (!this.validateConnectionPoint(newConnectionPoint)) {
        return { success: false, error: 'Invalid connection point data' };
      }

      const sanitizedConnectionPoint = this.sanitizeConnectionPoint(newConnectionPoint);

      // Add to connections
      const updatedConnections = [...existingConnections, sanitizedConnectionPoint];
      connectionPointsMap.set(sanitizedRouteId, updatedConnections);

      // Save to localStorage first (primary storage)
      if (!this.saveConnectionPoints(connectionPointsMap)) {
        return { success: false, error: 'Failed to save connection point' };
      }

      // Also save to Firebase for cloud sync (don't block on this)
      firebaseConnectionService.saveConnectionPointToFirebase(sanitizedRouteId, connectionPoint)
        .catch(error => console.warn('Firebase sync failed for connection point save:', error));

      return { success: true, connectionPoint: sanitizedConnectionPoint };

    } catch (error: any) {
      return { success: false, error: sanitizeErrorMessage(error) };
    }
  }

  /**
   * Get connection points for a route
   */
  async getConnectionPoints(routeId: string): Promise<ConnectionPoint[]> {
    try {
      const sanitizedRouteId = sanitizeText(routeId);
      if (!sanitizedRouteId) return [];

      const connectionPointsMap = this.loadConnectionPoints();
      return connectionPointsMap.get(sanitizedRouteId) || [];

    } catch (error) {
      console.error('Error getting connection points:', error);
      return [];
    }
  }

  /**
   * Update connection point
   */
  async updateConnectionPoint(
    routeId: string, 
    connectionId: string, 
    updates: Partial<Omit<ConnectionPoint, 'id' | 'routeId'>>
  ): Promise<ConnectionPointResult> {
    try {
      const sanitizedRouteId = sanitizeText(routeId);
      const sanitizedConnectionId = sanitizeText(connectionId);
      
      if (!sanitizedRouteId || !sanitizedConnectionId) {
        return { success: false, error: 'Invalid route ID or connection ID' };
      }

      const connectionPointsMap = this.loadConnectionPoints();
      const connections = connectionPointsMap.get(sanitizedRouteId) || [];
      const connectionIndex = connections.findIndex(cp => cp.id === sanitizedConnectionId);

      if (connectionIndex === -1) {
        return { success: false, error: 'Connection point not found' };
      }

      // Update connection point
      const updatedConnectionPoint: ConnectionPoint = {
        ...connections[connectionIndex],
        ...updates,
        id: sanitizedConnectionId, // Prevent ID changes
        routeId: sanitizedRouteId, // Prevent route changes
        metadata: {
          ...connections[connectionIndex].metadata,
          ...updates.metadata,
          lastModified: new Date().toISOString()
        }
      };

      // Validate and sanitize
      if (!this.validateConnectionPoint(updatedConnectionPoint)) {
        return { success: false, error: 'Invalid connection point data' };
      }

      const sanitizedConnectionPoint = this.sanitizeConnectionPoint(updatedConnectionPoint);

      // Update in array
      connections[connectionIndex] = sanitizedConnectionPoint;
      connectionPointsMap.set(sanitizedRouteId, connections);

      // Save to localStorage first (primary storage)
      if (!this.saveConnectionPoints(connectionPointsMap)) {
        return { success: false, error: 'Failed to update connection point' };
      }

      // Also update in Firebase for cloud sync (don't block on this)
      firebaseConnectionService.updateConnectionPointInFirebase(sanitizedRouteId, sanitizedConnectionId, updates)
        .catch(error => console.warn('Firebase sync failed for connection point update:', error));

      return { success: true, connectionPoint: sanitizedConnectionPoint };

    } catch (error: any) {
      return { success: false, error: sanitizeErrorMessage(error) };
    }
  }

  /**
   * Delete connection point
   */
  async deleteConnectionPoint(routeId: string, connectionId: string): Promise<ConnectionPointResult> {
    try {
      const sanitizedRouteId = sanitizeText(routeId);
      const sanitizedConnectionId = sanitizeText(connectionId);
      
      if (!sanitizedRouteId || !sanitizedConnectionId) {
        return { success: false, error: 'Invalid route ID or connection ID' };
      }

      const connectionPointsMap = this.loadConnectionPoints();
      const connections = connectionPointsMap.get(sanitizedRouteId) || [];
      const connectionIndex = connections.findIndex(cp => cp.id === sanitizedConnectionId);

      if (connectionIndex === -1) {
        return { success: false, error: 'Connection point not found' };
      }

      // Remove connection point
      const deletedConnectionPoint = connections[connectionIndex];
      connections.splice(connectionIndex, 1);

      // Update map
      if (connections.length === 0) {
        connectionPointsMap.delete(sanitizedRouteId);
      } else {
        connectionPointsMap.set(sanitizedRouteId, connections);
      }

      // Save to localStorage first (primary storage)
      if (!this.saveConnectionPoints(connectionPointsMap)) {
        return { success: false, error: 'Failed to delete connection point' };
      }

      // Also delete from Firebase for cloud sync (don't block on this)
      firebaseConnectionService.deleteConnectionPointFromFirebase(sanitizedRouteId, sanitizedConnectionId)
        .catch(error => console.warn('Firebase sync failed for connection point delete:', error));

      return { success: true, connectionPoint: deletedConnectionPoint };

    } catch (error: any) {
      return { success: false, error: sanitizeErrorMessage(error) };
    }
  }

  /**
   * Get connection points sorted by priority
   */
  async getConnectionPointsByPriority(routeId: string): Promise<ConnectionPoint[]> {
    try {
      const connections = await this.getConnectionPoints(routeId);
      return connections.sort((a, b) => b.priority - a.priority);
    } catch (error) {
      console.error('Error getting connection points by priority:', error);
      return [];
    }
  }

  /**
   * Get all connection points across all routes
   */
  async getAllConnectionPoints(): Promise<Map<string, ConnectionPoint[]>> {
    return this.loadConnectionPoints();
  }

  /**
   * Delete all connection points for a route
   */
  async deleteAllConnectionPoints(routeId: string): Promise<ConnectionPointResult> {
    try {
      const sanitizedRouteId = sanitizeText(routeId);
      if (!sanitizedRouteId) {
        return { success: false, error: 'Invalid route ID' };
      }

      const connectionPointsMap = this.loadConnectionPoints();
      const hadConnections = connectionPointsMap.has(sanitizedRouteId);
      
      connectionPointsMap.delete(sanitizedRouteId);

      if (!this.saveConnectionPoints(connectionPointsMap)) {
        return { success: false, error: 'Failed to delete connection points' };
      }

      return { 
        success: true, 
        error: hadConnections ? undefined : 'No connection points found for route'
      };

    } catch (error: any) {
      return { success: false, error: sanitizeErrorMessage(error) };
    }
  }

  /**
   * Bulk save connection points
   */
  async bulkSaveConnectionPoints(
    routeId: string, 
    connectionPoints: Omit<ConnectionPoint, 'id'>[]
  ): Promise<BulkConnectionPointResult> {
    const result: BulkConnectionPointResult = {
      success: false,
      connectionPoints: [],
      successCount: 0,
      failureCount: 0,
      errors: []
    };

    try {
      const sanitizedRouteId = sanitizeText(routeId);
      if (!sanitizedRouteId) {
        return { ...result, error: 'Invalid route ID' };
      }

      const connectionPointsMap = this.loadConnectionPoints();
      const existingConnections = connectionPointsMap.get(sanitizedRouteId) || [];

      // Check limits
      if (existingConnections.length + connectionPoints.length > this.MAX_CONNECTIONS_PER_ROUTE) {
        return { 
          ...result, 
          error: `Would exceed maximum ${this.MAX_CONNECTIONS_PER_ROUTE} connection points per route` 
        };
      }

      const newConnections: ConnectionPoint[] = [];

      for (let index = 0; index < connectionPoints.length; index++) {
        const connectionPoint = connectionPoints[index];
        try {
          const newConnectionPoint: ConnectionPoint = {
            ...connectionPoint,
            id: this.generateId(),
            routeId: sanitizedRouteId
          };

          if (!this.validateConnectionPoint(newConnectionPoint)) {
            result.failureCount++;
            result.errors.push(`Connection point ${index + 1}: Invalid data`);
            continue;
          }

          const sanitized = this.sanitizeConnectionPoint(newConnectionPoint);
          newConnections.push(sanitized);
          result.successCount++;

        } catch (error: any) {
          result.failureCount++;
          result.errors.push(`Connection point ${index + 1}: ${sanitizeErrorMessage(error)}`);
        }
      }

      if (newConnections.length === 0) {
        return { ...result, error: 'No valid connection points to save' };
      }

      // Save all new connections
      const updatedConnections = [...existingConnections, ...newConnections];
      connectionPointsMap.set(sanitizedRouteId, updatedConnections);

      if (!this.saveConnectionPoints(connectionPointsMap)) {
        return { ...result, error: 'Failed to save connection points' };
      }

      result.success = true;
      result.connectionPoints = newConnections;
      return result;

    } catch (error: any) {
      return { ...result, error: sanitizeErrorMessage(error) };
    }
  }

  // ===== FIREBASE CLOUD SYNC METHODS =====

  /**
   * Subscribe to real-time connection point updates for a route
   * Provides Firebase real-time synchronization
   */
  subscribeToConnectionPoints(
    routeId: string, 
    callback: (connectionPoints: ConnectionPoint[]) => void
  ) {
    return firebaseConnectionService.subscribeToConnectionPoints(routeId, callback);
  }

  /**
   * Manually sync offline changes to Firebase
   * Useful for explicit sync triggers (e.g., when coming back online)
   */
  async syncOfflineChanges(): Promise<{ success: boolean; processed: number; failed: number }> {
    return await firebaseConnectionService.syncOfflineChanges();
  }

  /**
   * Get offline queue status
   * Shows pending operations that haven't synced to Firebase yet
   */
  getOfflineQueueStatus(): {
    queueSize: number;
    isProcessing: boolean;
    items: Array<{ operation: string; routeId: string; timestamp: number; retryCount: number }>;
  } {
    return firebaseConnectionService.getOfflineQueueStatus();
  }

  /**
   * Import connection points from Firebase for a route
   * Useful for initial data load or cross-device sync
   */
  async importFromFirebase(routeId: string): Promise<{ success: boolean; imported: number; error?: string }> {
    try {
      const firebaseConnections = await firebaseConnectionService.getConnectionPointsFromFirebase(routeId);
      
      if (firebaseConnections.length === 0) {
        return { success: true, imported: 0 };
      }

      const sanitizedRouteId = sanitizeText(routeId);
      const connectionPointsMap = this.loadConnectionPoints();
      const existingConnections = connectionPointsMap.get(sanitizedRouteId) || [];

      // Merge Firebase data with existing localStorage data
      // Firebase data takes precedence for newer timestamps
      const mergedConnections = new Map<string, ConnectionPoint>();

      // Add existing connections
      existingConnections.forEach(conn => {
        mergedConnections.set(conn.id, conn);
      });

      // Add/override with Firebase connections (newer data wins)
      let importedCount = 0;
      firebaseConnections.forEach(fbConn => {
        const existing = mergedConnections.get(fbConn.id);
        if (!existing || new Date(fbConn.metadata.lastModified) > new Date(existing.metadata.lastModified)) {
          mergedConnections.set(fbConn.id, fbConn);
          if (!existing) importedCount++;
        }
      });

      // Update localStorage with merged data
      const finalConnections = Array.from(mergedConnections.values());
      connectionPointsMap.set(sanitizedRouteId, finalConnections);
      
      if (!this.saveConnectionPoints(connectionPointsMap)) {
        return { success: false, imported: 0, error: 'Failed to save imported connections' };
      }

      return { success: true, imported: importedCount };

    } catch (error: any) {
      return { success: false, imported: 0, error: sanitizeErrorMessage(error) };
    }
  }

  /**
   * Export connection points to Firebase for a route
   * Useful for pushing local changes to cloud
   */
  async exportToFirebase(routeId: string): Promise<{ success: boolean; exported: number; error?: string }> {
    try {
      const localConnections = await this.getConnectionPoints(routeId);
      
      if (localConnections.length === 0) {
        return { success: true, exported: 0 };
      }

      let exportedCount = 0;
      const errors: string[] = [];

      for (const connection of localConnections) {
        try {
          // Remove id from connection for Firebase save
          const { id, ...connectionData } = connection;
          const result = await firebaseConnectionService.saveConnectionPointToFirebase(routeId, connectionData);
          
          if (result.success) {
            exportedCount++;
          } else {
            errors.push(`Failed to export ${connection.id}: ${result.error}`);
          }
        } catch (error: any) {
          errors.push(`Error exporting ${connection.id}: ${sanitizeErrorMessage(error)}`);
        }
      }

      if (errors.length > 0) {
        console.warn('Some connections failed to export:', errors);
      }

      return { 
        success: exportedCount > 0, 
        exported: exportedCount,
        error: errors.length > 0 ? `${errors.length} items failed to export` : undefined
      };

    } catch (error: any) {
      return { success: false, exported: 0, error: sanitizeErrorMessage(error) };
    }
  }

  /**
   * Clear Firebase offline queue
   * Use with caution - removes pending sync operations
   */
  clearOfflineQueue(): void {
    firebaseConnectionService.clearOfflineQueue();
  }

  // ===== TEMPLATE MANAGEMENT =====

  /**
   * Load templates from localStorage
   */
  private loadTemplates(): ConnectionPointTemplate[] {
    if (this.templatesCache !== null) {
      return this.templatesCache;
    }

    try {
      const stored = localStorage.getItem(this.TEMPLATES_KEY);
      if (stored) {
        const templates = JSON.parse(stored) as ConnectionPointTemplate[];
        this.templatesCache = templates;
        return templates;
      }
    } catch (error) {
      console.error('Error loading connection point templates:', error);
    }

    // Initialize with default templates
    const defaultTemplates = this.initializeDefaultTemplates();
    this.saveTemplates(defaultTemplates);
    return defaultTemplates;
  }

  /**
   * Save templates to localStorage
   */
  private saveTemplates(templates: ConnectionPointTemplate[]): boolean {
    try {
      localStorage.setItem(this.TEMPLATES_KEY, JSON.stringify(templates));
      this.templatesCache = templates;
      return true;
    } catch (error) {
      console.error('Error saving connection point templates:', error);
      return false;
    }
  }

  /**
   * Get all connection point templates
   */
  async getConnectionPointTemplates(): Promise<ConnectionPointTemplate[]> {
    return this.loadTemplates();
  }

  /**
   * Get templates by category
   */
  async getTemplatesByCategory(category: ConnectionPointTemplate['category']): Promise<ConnectionPointTemplate[]> {
    const templates = this.loadTemplates();
    return templates.filter(template => template.category === category);
  }

  /**
   * Get templates by connection type
   */
  async getTemplatesByType(type: ConnectionType): Promise<ConnectionPointTemplate[]> {
    const templates = this.loadTemplates();
    return templates.filter(template => template.type === type);
  }

  /**
   * Create connection point from template
   */
  async createFromTemplate(
    templateId: string,
    routeId: string,
    overrides: {
      locationId: string;
      locationName: string;
      targetTime: string;
      serviceName: string;
      description?: string;
    }
  ): Promise<ConnectionPointResult> {
    try {
      const templates = this.loadTemplates();
      const template = templates.find(t => t.id === templateId);

      if (!template) {
        return { success: false, error: 'Template not found' };
      }

      const connectionPoint: Omit<ConnectionPoint, 'id'> = {
        routeId: sanitizeText(routeId),
        type: template.type,
        locationId: sanitizeText(overrides.locationId),
        locationName: sanitizeText(overrides.locationName),
        targetTime: overrides.targetTime,
        priority: template.defaultPriority,
        operatingDays: [...template.defaultOperatingDays],
        idealWindow: { ...template.defaultWindows.ideal },
        partialWindow: { ...template.defaultWindows.partial },
        metadata: {
          serviceName: sanitizeText(overrides.serviceName),
          description: sanitizeText(overrides.description || template.description),
          isActive: true,
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString()
        }
      };

      return this.saveConnectionPoint(routeId, connectionPoint);

    } catch (error: any) {
      return { success: false, error: sanitizeErrorMessage(error) };
    }
  }

  /**
   * Clear cache (useful for testing or when external changes occur)
   */
  clearCache(): void {
    this.connectionPointsCache.clear();
    this.templatesCache = null;
    this.lastCacheUpdate = 0;
  }

  /**
   * Get service statistics
   */
  getStatistics(): {
    totalRoutes: number;
    totalConnectionPoints: number;
    connectionsByType: Record<ConnectionType, number>;
    connectionsByPriority: Record<number, number>;
  } {
    const connectionPointsMap = this.loadConnectionPoints();
    const stats = {
      totalRoutes: connectionPointsMap.size,
      totalConnectionPoints: 0,
      connectionsByType: {
        [ConnectionType.BUS_ROUTE]: 0,
        [ConnectionType.GO_TRAIN]: 0,
        [ConnectionType.SCHOOL_BELL]: 0
      },
      connectionsByPriority: {} as Record<number, number>
    };

    connectionPointsMap.forEach((connections) => {
      stats.totalConnectionPoints += connections.length;
      
      for (const connection of connections) {
        const connectionType = connection.type as keyof typeof stats.connectionsByType;
        stats.connectionsByType[connectionType]++;
        
        const priority = connection.priority;
        stats.connectionsByPriority[priority] = (stats.connectionsByPriority[priority] || 0) + 1;
      }
    });

    return stats;
  }

  /**
   * Cleanup method to call on component unmount
   * Cleans up Firebase listeners and saves offline queue
   */
  destroy(): void {
    firebaseConnectionService.destroy();
  }
}

// Export singleton instance
export const connectionPointService = new ConnectionPointService();