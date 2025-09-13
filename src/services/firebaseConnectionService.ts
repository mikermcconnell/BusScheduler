/**
 * Firebase Connection Point Service
 * Firebase/Firestore-based persistence for connection points with offline queue support
 * Follows existing Firebase patterns from firebaseStorage.ts
 * 
 * Data Structure: connection_points/{routeId}/points/{connectionId}
 * 
 * @example
 * ```typescript
 * // Save a connection point
 * const result = await firebaseConnectionService.saveConnectionPointToFirebase('route_123', {
 *   routeId: 'route_123',
 *   type: ConnectionType.GO_TRAIN,
 *   locationId: 'stop_456',
 *   locationName: 'Union Station',
 *   targetTime: '08:30',
 *   priority: 8,
 *   operatingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
 *   idealWindow: { min: 2, max: 8 },
 *   partialWindow: { min: 1, max: 12 },
 *   metadata: {
 *     serviceName: 'GO Lakeshore West',
 *     description: 'Morning peak connection',
 *     isActive: true,
 *     createdAt: new Date().toISOString(),
 *     lastModified: new Date().toISOString()
 *   }
 * });
 * 
 * // Subscribe to real-time updates
 * const unsubscribe = firebaseConnectionService.subscribeToConnectionPoints('route_123', 
 *   (connections) => {
 *     console.log('Connection points updated:', connections.length);
 *   }
 * );
 * 
 * // Cleanup
 * unsubscribe();
 * ```
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  Timestamp,
  DocumentData,
  QuerySnapshot,
  Unsubscribe,
  FieldValue
} from 'firebase/firestore';

import { db, getFirebaseErrorMessage } from '../config/firebase';
import { sanitizeText, sanitizeErrorMessage } from '../utils/inputSanitizer';
import { ConnectionType } from '../types/schedule';
import {
  ConnectionPoint,
  ConnectionPointResult,
  BulkConnectionPointResult
} from './connectionPointService';

// Firebase-specific extensions
export interface FirebaseConnectionPoint extends Omit<ConnectionPoint, 'metadata'> {
  userId?: string; // Optional now that auth is removed
  createdAt: Timestamp | FieldValue;
  updatedAt: Timestamp | FieldValue;
  metadata: {
    serviceName: string;
    description: string;
    frequency?: number;
    isActive: boolean;
    createdAt: Timestamp | FieldValue;
    lastModified: Timestamp | FieldValue;
  };
}

// Offline queue item interface
interface OfflineQueueItem {
  id: string;
  operation: 'create' | 'update' | 'delete';
  routeId: string;
  connectionId?: string;
  data?: Partial<ConnectionPoint>;
  timestamp: number;
  retryCount: number;
}

// Constants
const COLLECTIONS = {
  CONNECTION_POINTS: 'connection_points',
  OFFLINE_QUEUE: 'connection_offline_queue'
} as const;

const MAX_CONNECTIONS_PER_ROUTE = 50;
const MAX_TOTAL_CONNECTIONS = 500;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

class FirebaseConnectionService {
  private listeners: Map<string, Unsubscribe> = new Map();
  private offlineQueue: OfflineQueueItem[] = [];
  private isProcessingQueue = false;
  
  // Event callbacks for real-time updates
  private connectionChangeCallbacks: Map<string, (connections: ConnectionPoint[]) => void> = new Map();

  constructor() {
    // Load offline queue from localStorage
    this.loadOfflineQueue();
    // Start processing queue
    this.processOfflineQueue();
  }

  /**
   * Load offline queue from localStorage
   */
  private loadOfflineQueue(): void {
    try {
      const stored = localStorage.getItem('connection_offline_queue');
      if (stored) {
        this.offlineQueue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading offline queue:', error);
      this.offlineQueue = [];
    }
  }

  /**
   * Save offline queue to localStorage
   */
  private saveOfflineQueue(): void {
    try {
      localStorage.setItem('connection_offline_queue', JSON.stringify(this.offlineQueue));
    } catch (error) {
      console.error('Error saving offline queue:', error);
    }
  }

  /**
   * Add operation to offline queue
   */
  private addToOfflineQueue(
    operation: 'create' | 'update' | 'delete',
    routeId: string,
    connectionId?: string,
    data?: Partial<ConnectionPoint>
  ): void {
    const queueItem: OfflineQueueItem = {
      id: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      operation,
      routeId,
      connectionId,
      data,
      timestamp: Date.now(),
      retryCount: 0
    };

    this.offlineQueue.push(queueItem);
    this.saveOfflineQueue();
  }

  /**
   * Process offline queue when connectivity is restored
   */
  private async processOfflineQueue(): Promise<void> {
    if (this.isProcessingQueue || this.offlineQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      // Process items in order
      while (this.offlineQueue.length > 0) {
        const item = this.offlineQueue[0];
        let success = false;

        try {
          switch (item.operation) {
            case 'create':
              if (item.data) {
                const result = await this.saveConnectionPointToFirebase(item.routeId, item.data as Omit<ConnectionPoint, 'id'>);
                success = result.success;
              }
              break;
            case 'update':
              if (item.connectionId && item.data) {
                const result = await this.updateConnectionPointInFirebase(item.routeId, item.connectionId, item.data);
                success = result.success;
              }
              break;
            case 'delete':
              if (item.connectionId) {
                const result = await this.deleteConnectionPointFromFirebase(item.routeId, item.connectionId);
                success = result.success;
              }
              break;
          }

          if (success) {
            // Remove from queue on success
            this.offlineQueue.shift();
          } else {
            // Increment retry count
            item.retryCount++;
            if (item.retryCount >= MAX_RETRY_ATTEMPTS) {
              console.warn('Max retry attempts reached for queue item:', item);
              this.offlineQueue.shift(); // Remove failed item
            } else {
              // Move to end of queue for retry
              this.offlineQueue.push(this.offlineQueue.shift()!);
              await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * item.retryCount));
            }
          }

        } catch (error) {
          console.error('Error processing queue item:', error);
          item.retryCount++;
          if (item.retryCount >= MAX_RETRY_ATTEMPTS) {
            this.offlineQueue.shift(); // Remove failed item
          } else {
            // Move to end for retry
            this.offlineQueue.push(this.offlineQueue.shift()!);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * item.retryCount));
          }
        }
      }

      this.saveOfflineQueue();

    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Check if Firebase is available
   */
  private requireFirebase(): boolean {
    if (!db) {
      console.warn('🔥 Firebase Connection Service: Database not initialized');
      return false;
    }
    return true;
  }

  /**
   * Generate unique ID for connection point
   */
  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Parse Firestore snapshot to connection points array
   */
  private parseConnectionPointsSnapshot(snapshot: QuerySnapshot<DocumentData>): ConnectionPoint[] {
    return snapshot.docs.map(doc => {
      const data = doc.data() as FirebaseConnectionPoint;
      const createdAt = data.createdAt as Timestamp;
      const updatedAt = data.updatedAt as Timestamp;
      const metadataCreatedAt = data.metadata.createdAt as Timestamp;
      const metadataLastModified = data.metadata.lastModified as Timestamp;
      
      return {
        ...data,
        id: doc.id,
        metadata: {
          ...data.metadata,
          createdAt: metadataCreatedAt.toDate().toISOString(),
          lastModified: metadataLastModified.toDate().toISOString()
        }
      };
    });
  }

  /**
   * Validate connection point data
   */
  private validateConnectionPoint(connectionPoint: any): connectionPoint is ConnectionPoint {
    if (!connectionPoint || typeof connectionPoint !== 'object') return false;
    
    const required = ['routeId', 'type', 'locationId', 'locationName', 'targetTime', 'priority'];
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
    const now = serverTimestamp();
    
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
        createdAt: connectionPoint.metadata?.createdAt || new Date().toISOString(),
        lastModified: new Date().toISOString()
      }
    };
  }

  // ===== PUBLIC API METHODS =====

  /**
   * Save connection point to Firebase
   */
  async saveConnectionPointToFirebase(
    routeId: string, 
    connectionPoint: Omit<ConnectionPoint, 'id'>
  ): Promise<ConnectionPointResult> {
    try {
      const sanitizedRouteId = sanitizeText(routeId);
      if (!sanitizedRouteId) {
        return { success: false, error: 'Invalid route ID' };
      }

      if (!this.requireFirebase()) {
        // Add to offline queue
        this.addToOfflineQueue('create', sanitizedRouteId, undefined, connectionPoint);
        return { success: false, error: 'Firebase unavailable - operation queued for sync' };
      }

      // Check route connection limit
      const existingConnections = await this.getConnectionPointsFromFirebase(sanitizedRouteId);
      if (existingConnections.length >= MAX_CONNECTIONS_PER_ROUTE) {
        return { success: false, error: `Maximum ${MAX_CONNECTIONS_PER_ROUTE} connection points per route exceeded` };
      }

      // Create new connection point with generated ID
      const connectionId = this.generateConnectionId();
      const newConnectionPoint: ConnectionPoint = {
        ...connectionPoint,
        id: connectionId,
        routeId: sanitizedRouteId
      };

      // Validate and sanitize
      if (!this.validateConnectionPoint(newConnectionPoint)) {
        return { success: false, error: 'Invalid connection point data' };
      }

      const sanitizedConnectionPoint = this.sanitizeConnectionPoint(newConnectionPoint);

      // Convert to Firebase format
      const now = serverTimestamp();
      const firebaseConnectionPoint: Omit<FirebaseConnectionPoint, 'id'> = {
        ...sanitizedConnectionPoint,
        userId: 'anonymous', // No auth required
        createdAt: now,
        updatedAt: now,
        metadata: {
          ...sanitizedConnectionPoint.metadata,
          createdAt: now,
          lastModified: now
        }
      };

      // Save to Firestore using hierarchical structure: connection_points/{routeId}/points/{connectionId}
      const routeDocRef = doc(db, COLLECTIONS.CONNECTION_POINTS, sanitizedRouteId);
      const connectionDocRef = doc(collection(routeDocRef, 'points'), connectionId);
      
      await setDoc(connectionDocRef, firebaseConnectionPoint);

      return { success: true, connectionPoint: sanitizedConnectionPoint };

    } catch (error: any) {
      console.error('Error saving connection point to Firebase:', error);
      
      // Add to offline queue on failure
      this.addToOfflineQueue('create', routeId, undefined, connectionPoint);
      
      return { 
        success: false, 
        error: `Firebase error: ${getFirebaseErrorMessage(error)} - operation queued for sync` 
      };
    }
  }

  /**
   * Get connection points from Firebase for a specific route
   */
  async getConnectionPointsFromFirebase(routeId: string): Promise<ConnectionPoint[]> {
    try {
      const sanitizedRouteId = sanitizeText(routeId);
      if (!sanitizedRouteId) return [];

      if (!this.requireFirebase()) {
        console.warn('🔥 Firebase Connection Service: Not available, returning empty list');
        return [];
      }

      const routeDocRef = doc(db, COLLECTIONS.CONNECTION_POINTS, sanitizedRouteId);
      const connectionPointsRef = collection(routeDocRef, 'points');
      const q = query(
        connectionPointsRef,
        orderBy('priority', 'desc'),
        orderBy('metadata.createdAt', 'asc'),
        limit(MAX_CONNECTIONS_PER_ROUTE)
      );

      const snapshot = await getDocs(q);
      return this.parseConnectionPointsSnapshot(snapshot);

    } catch (error: any) {
      console.error('Error getting connection points from Firebase:', error);
      return [];
    }
  }

  /**
   * Delete connection point from Firebase
   */
  async deleteConnectionPointFromFirebase(routeId: string, connectionId: string): Promise<ConnectionPointResult> {
    try {
      const sanitizedRouteId = sanitizeText(routeId);
      const sanitizedConnectionId = sanitizeText(connectionId);
      
      if (!sanitizedRouteId || !sanitizedConnectionId) {
        return { success: false, error: 'Invalid route ID or connection ID' };
      }

      if (!this.requireFirebase()) {
        // Add to offline queue
        this.addToOfflineQueue('delete', sanitizedRouteId, sanitizedConnectionId);
        return { success: false, error: 'Firebase unavailable - operation queued for sync' };
      }

      // Get connection before deleting for return value
      const routeDocRef = doc(db, COLLECTIONS.CONNECTION_POINTS, sanitizedRouteId);
      const connectionDocRef = doc(collection(routeDocRef, 'points'), sanitizedConnectionId);
      const docSnap = await getDoc(connectionDocRef);

      if (!docSnap.exists()) {
        return { success: false, error: 'Connection point not found' };
      }

      const deletedConnection = this.parseConnectionPointsSnapshot({ docs: [docSnap] } as QuerySnapshot<DocumentData>)[0];

      // Delete from Firestore
      await deleteDoc(connectionDocRef);

      return { success: true, connectionPoint: deletedConnection };

    } catch (error: any) {
      console.error('Error deleting connection point from Firebase:', error);
      
      // Add to offline queue on failure
      this.addToOfflineQueue('delete', routeId, connectionId);
      
      return { 
        success: false, 
        error: `Firebase error: ${getFirebaseErrorMessage(error)} - operation queued for sync` 
      };
    }
  }

  /**
   * Update connection point in Firebase
   */
  async updateConnectionPointInFirebase(
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

      if (!this.requireFirebase()) {
        // Add to offline queue
        this.addToOfflineQueue('update', sanitizedRouteId, sanitizedConnectionId, updates);
        return { success: false, error: 'Firebase unavailable - operation queued for sync' };
      }

      // Get existing connection
      const routeDocRef = doc(db, COLLECTIONS.CONNECTION_POINTS, sanitizedRouteId);
      const connectionDocRef = doc(collection(routeDocRef, 'points'), sanitizedConnectionId);
      const docSnap = await getDoc(connectionDocRef);

      if (!docSnap.exists()) {
        return { success: false, error: 'Connection point not found' };
      }

      const existingConnection = this.parseConnectionPointsSnapshot({ docs: [docSnap] } as QuerySnapshot<DocumentData>)[0];

      // Update connection point
      const updatedConnectionPoint: ConnectionPoint = {
        ...existingConnection,
        ...updates,
        id: sanitizedConnectionId, // Prevent ID changes
        routeId: sanitizedRouteId, // Prevent route changes
        metadata: {
          ...existingConnection.metadata,
          ...updates.metadata,
          lastModified: new Date().toISOString()
        }
      };

      // Validate and sanitize
      if (!this.validateConnectionPoint(updatedConnectionPoint)) {
        return { success: false, error: 'Invalid connection point data' };
      }

      const sanitizedConnectionPoint = this.sanitizeConnectionPoint(updatedConnectionPoint);

      // Convert to Firebase format
      const now = serverTimestamp();
      const firebaseConnectionPoint: Partial<FirebaseConnectionPoint> = {
        ...sanitizedConnectionPoint,
        updatedAt: now,
        metadata: {
          serviceName: sanitizedConnectionPoint.metadata.serviceName,
          description: sanitizedConnectionPoint.metadata.description,
          frequency: sanitizedConnectionPoint.metadata.frequency,
          isActive: sanitizedConnectionPoint.metadata.isActive,
          createdAt: Timestamp.fromDate(new Date(sanitizedConnectionPoint.metadata.createdAt)),
          lastModified: now
        }
      };

      // Update in Firestore
      await setDoc(connectionDocRef, firebaseConnectionPoint, { merge: true });

      return { success: true, connectionPoint: sanitizedConnectionPoint };

    } catch (error: any) {
      console.error('Error updating connection point in Firebase:', error);
      
      // Add to offline queue on failure
      this.addToOfflineQueue('update', routeId, connectionId, updates);
      
      return { 
        success: false, 
        error: `Firebase error: ${getFirebaseErrorMessage(error)} - operation queued for sync` 
      };
    }
  }

  /**
   * Subscribe to real-time connection point updates for a route
   */
  subscribeToConnectionPoints(
    routeId: string, 
    callback: (connectionPoints: ConnectionPoint[]) => void
  ): Unsubscribe {
    const sanitizedRouteId = sanitizeText(routeId);
    if (!sanitizedRouteId) {
      console.error('Invalid route ID for subscription');
      return () => {}; // Return no-op unsubscribe function
    }

    if (!this.requireFirebase()) {
      console.warn('🔥 Firebase Connection Service: Not available, cannot subscribe');
      return () => {}; // Return no-op unsubscribe function
    }

    try {
      // Clean up existing listener for this route
      const existingListener = this.listeners.get(sanitizedRouteId);
      if (existingListener) {
        existingListener();
      }

      const routeDocRef = doc(db, COLLECTIONS.CONNECTION_POINTS, sanitizedRouteId);
      const connectionPointsRef = collection(routeDocRef, 'points');
      const q = query(
        connectionPointsRef,
        orderBy('priority', 'desc'),
        orderBy('metadata.createdAt', 'asc'),
        limit(MAX_CONNECTIONS_PER_ROUTE)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const connectionPoints = this.parseConnectionPointsSnapshot(snapshot);
        callback(connectionPoints);
      }, (error) => {
        console.error('Connection points subscription error:', error);
        callback([]); // Return empty array on error
      });

      // Store listener and callback
      this.listeners.set(sanitizedRouteId, unsubscribe);
      this.connectionChangeCallbacks.set(sanitizedRouteId, callback);

      return unsubscribe;

    } catch (error: any) {
      console.error('Error setting up connection points subscription:', error);
      return () => {}; // Return no-op unsubscribe function
    }
  }

  /**
   * Manually trigger offline queue processing
   */
  async syncOfflineChanges(): Promise<{ success: boolean; processed: number; failed: number }> {
    const initialQueueSize = this.offlineQueue.length;
    await this.processOfflineQueue();
    const remainingQueueSize = this.offlineQueue.length;
    
    return {
      success: remainingQueueSize === 0,
      processed: initialQueueSize - remainingQueueSize,
      failed: remainingQueueSize
    };
  }

  /**
   * Get offline queue status
   */
  getOfflineQueueStatus(): {
    queueSize: number;
    isProcessing: boolean;
    items: Array<{ operation: string; routeId: string; timestamp: number; retryCount: number }>;
  } {
    return {
      queueSize: this.offlineQueue.length,
      isProcessing: this.isProcessingQueue,
      items: this.offlineQueue.map(item => ({
        operation: item.operation,
        routeId: item.routeId,
        timestamp: item.timestamp,
        retryCount: item.retryCount
      }))
    };
  }

  /**
   * Clear offline queue (for testing or emergency cleanup)
   */
  clearOfflineQueue(): void {
    this.offlineQueue = [];
    this.saveOfflineQueue();
  }

  /**
   * Cleanup method to call on component unmount
   */
  destroy(): void {
    // Clean up all listeners
    this.listeners.forEach(unsubscribe => unsubscribe());
    this.listeners.clear();
    this.connectionChangeCallbacks.clear();
    
    // Save offline queue before destroying
    this.saveOfflineQueue();
  }
}

// Export singleton instance
export const firebaseConnectionService = new FirebaseConnectionService();
export default firebaseConnectionService;