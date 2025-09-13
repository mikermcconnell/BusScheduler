/**
 * Offline Queue System
 * Manages failed Firebase operations and automatically retries when connection returns
 */

import { sanitizeText } from '../utils/inputSanitizer';

export interface QueuedOperation {
  id: string;
  type: 'save' | 'update' | 'delete';
  collection: string;
  documentId: string;
  data?: any;
  timestamp: number;
  retryCount: number;
  lastError?: string;
}

export interface QueueStatus {
  isOnline: boolean;
  queueSize: number;
  processing: boolean;
  lastSyncTime?: number;
  lastError?: string;
}

class OfflineQueue {
  private readonly QUEUE_KEY = 'scheduler2_offline_queue';
  private readonly MAX_QUEUE_SIZE = 100;
  private readonly MAX_RETRY_COUNT = 3;
  private readonly STORAGE_WARNING_THRESHOLD = 3.5 * 1024 * 1024; // 3.5MB (leave room for other data)
  
  private isOnline: boolean = navigator.onLine;
  private isProcessing: boolean = false;
  private listeners: Set<(status: QueueStatus) => void> = new Set();
  private retryTimeouts: Map<string, NodeJS.Timeout> = new Map();
  
  constructor() {
    this.initializeEventListeners();
    // Check initial online status
    if (this.isOnline) {
      // Process queue after a short delay to let the app initialize
      setTimeout(() => this.flush(), 2000);
    }
  }
  
  /**
   * Initialize online/offline event listeners
   */
  private initializeEventListeners(): void {
    window.addEventListener('online', () => {
      console.log('🌐 Connection restored - processing offline queue');
      this.isOnline = true;
      this.notifyListeners();
      this.flush();
    });
    
    window.addEventListener('offline', () => {
      console.log('📵 Connection lost - queuing operations');
      this.isOnline = false;
      this.notifyListeners();
    });
    
    // Also listen for visibility changes to retry when tab becomes active
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.isOnline && this.getQueueSize() > 0) {
        console.log('👁️ Tab active with pending operations - processing queue');
        this.flush();
      }
    });
  }
  
  /**
   * Add operation to queue
   */
  enqueue(operation: Omit<QueuedOperation, 'id' | 'timestamp' | 'retryCount'>): boolean {
    try {
      const queue = this.getQueue();
      
      // Check queue size limit
      if (queue.length >= this.MAX_QUEUE_SIZE) {
        console.error('❌ Offline queue is full');
        return false;
      }
      
      // Check localStorage size
      if (!this.hasStorageSpace()) {
        console.error('❌ Insufficient localStorage space');
        return false;
      }
      
      // Check for duplicate operations
      const isDuplicate = queue.some(
        op => op.type === operation.type && 
              op.collection === operation.collection && 
              op.documentId === operation.documentId &&
              op.retryCount < this.MAX_RETRY_COUNT
      );
      
      if (isDuplicate) {
        console.log('⚠️ Duplicate operation already queued:', operation.type, operation.documentId);
        return true; // Consider it successful since operation is already queued
      }
      
      const queuedOp: QueuedOperation = {
        ...operation,
        id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        retryCount: 0
      };
      
      // Sanitize data if present
      if (queuedOp.data) {
        queuedOp.data = this.sanitizeOperationData(queuedOp.data);
      }
      
      queue.push(queuedOp);
      this.saveQueue(queue);
      
      console.log(`📦 Queued ${operation.type} operation for ${operation.documentId}`);
      this.notifyListeners();
      
      // Try to process immediately if online
      if (this.isOnline) {
        this.flush();
      }
      
      return true;
    } catch (error) {
      console.error('Failed to enqueue operation:', error);
      return false;
    }
  }
  
  /**
   * Process all queued operations
   */
  async flush(): Promise<void> {
    if (!this.isOnline || this.isProcessing) {
      return;
    }
    
    this.isProcessing = true;
    this.notifyListeners();
    
    try {
      const queue = this.getQueue();
      if (queue.length === 0) {
        return;
      }
      
      console.log(`🔄 Processing ${queue.length} queued operations`);
      
      const processedIds: string[] = [];
      const failedOps: QueuedOperation[] = [];
      
      for (const operation of queue) {
        try {
          await this.processOperation(operation);
          processedIds.push(operation.id);
          console.log(`✅ Processed ${operation.type} for ${operation.documentId}`);
        } catch (error: any) {
          console.error(`❌ Failed to process ${operation.type} for ${operation.documentId}:`, error);
          
          operation.retryCount++;
          operation.lastError = error.message || 'Unknown error';
          
          if (operation.retryCount < this.MAX_RETRY_COUNT) {
            failedOps.push(operation);
            // Schedule exponential backoff retry
            this.scheduleRetry(operation);
          } else {
            console.error(`🗑️ Dropping operation after ${this.MAX_RETRY_COUNT} retries:`, operation.documentId);
          }
        }
      }
      
      // Update queue with only failed operations that haven't exceeded retry limit
      this.saveQueue(failedOps);
      
      if (processedIds.length > 0) {
        console.log(`✅ Successfully processed ${processedIds.length} operations`);
        localStorage.setItem('scheduler2_last_sync_time', Date.now().toString());
      }
      
      if (failedOps.length > 0) {
        console.warn(`⚠️ ${failedOps.length} operations failed and will be retried`);
      }
      
    } finally {
      this.isProcessing = false;
      this.notifyListeners();
    }
  }
  
  /**
   * Process a single operation
   */
  private async processOperation(operation: QueuedOperation): Promise<void> {
    // Dynamic import to avoid circular dependencies
    const { db } = await import('../config/firebase');
    const { doc, setDoc, deleteDoc, serverTimestamp } = await import('firebase/firestore');
    
    const docRef = doc(db, operation.collection, operation.documentId);
    
    switch (operation.type) {
      case 'save':
      case 'update':
        if (!operation.data) {
          throw new Error('No data provided for save/update operation');
        }
        await setDoc(docRef, {
          ...operation.data,
          serverTimestamp: serverTimestamp(),
          _offlineQueueProcessed: true,
          _offlineQueueTimestamp: operation.timestamp
        }, { merge: operation.type === 'update' });
        break;
        
      case 'delete':
        await deleteDoc(docRef);
        break;
        
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }
  
  /**
   * Schedule retry with exponential backoff
   */
  private scheduleRetry(operation: QueuedOperation): void {
    const backoffMs = Math.min(Math.pow(2, operation.retryCount) * 1000, 30000); // Max 30 seconds
    
    console.log(`⏰ Scheduling retry for ${operation.documentId} in ${backoffMs}ms`);
    
    // Clear any existing timeout for this operation
    const existingTimeout = this.retryTimeouts.get(operation.id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    const timeout = setTimeout(() => {
      this.retryTimeouts.delete(operation.id);
      if (this.isOnline) {
        this.flush();
      }
    }, backoffMs);
    
    this.retryTimeouts.set(operation.id, timeout);
  }
  
  /**
   * Get queue from localStorage
   */
  private getQueue(): QueuedOperation[] {
    try {
      const data = localStorage.getItem(this.QUEUE_KEY);
      if (!data) return [];
      
      const queue = JSON.parse(data) as QueuedOperation[];
      // Filter out expired operations (older than 24 hours)
      const cutoffTime = Date.now() - (24 * 60 * 60 * 1000);
      return queue.filter(op => op.timestamp > cutoffTime);
    } catch (error) {
      console.error('Failed to load offline queue:', error);
      return [];
    }
  }
  
  /**
   * Save queue to localStorage
   */
  private saveQueue(queue: QueuedOperation[]): void {
    try {
      if (queue.length === 0) {
        localStorage.removeItem(this.QUEUE_KEY);
      } else {
        localStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
      }
    } catch (error) {
      console.error('Failed to save offline queue:', error);
      // If localStorage is full, try to clear old data
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        this.clearOldData();
      }
    }
  }
  
  /**
   * Check if there's enough localStorage space
   */
  private hasStorageSpace(): boolean {
    try {
      const testKey = 'scheduler2_storage_test';
      const testData = new Array(1024).join('x'); // 1KB test
      localStorage.setItem(testKey, testData);
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Clear old data to make space
   */
  private clearOldData(): void {
    console.log('🧹 Clearing old data to make space');
    
    // Clear old migration markers
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.includes('migration_completed') ||
        key.includes('cleanup_done') ||
        key.startsWith('scheduler2_draft_workflow_') && key.includes('_old')
      )) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }
  
  /**
   * Sanitize operation data
   */
  private sanitizeOperationData(data: any): any {
    if (typeof data === 'string') {
      return sanitizeText(data);
    }
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeOperationData(item));
    }
    if (data && typeof data === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitizeOperationData(value);
      }
      return sanitized;
    }
    return data;
  }
  
  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.getQueue().length;
  }
  
  /**
   * Get current status
   */
  getStatus(): QueueStatus {
    const lastSync = localStorage.getItem('scheduler2_last_sync_time');
    return {
      isOnline: this.isOnline,
      queueSize: this.getQueueSize(),
      processing: this.isProcessing,
      lastSyncTime: lastSync ? parseInt(lastSync, 10) : undefined
    };
  }
  
  /**
   * Subscribe to status changes
   */
  subscribe(listener: (status: QueueStatus) => void): () => void {
    this.listeners.add(listener);
    // Send initial status
    listener(this.getStatus());
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }
  
  /**
   * Notify all listeners of status change
   */
  private notifyListeners(): void {
    const status = this.getStatus();
    this.listeners.forEach(listener => listener(status));
  }
  
  /**
   * Clear all queued operations (use with caution)
   */
  clearQueue(): void {
    this.saveQueue([]);
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    this.retryTimeouts.clear();
    this.notifyListeners();
    console.log('🗑️ Offline queue cleared');
  }
  
  /**
   * Force retry all operations (useful for debugging)
   */
  forceRetry(): void {
    if (this.isOnline && !this.isProcessing) {
      console.log('🔄 Force retrying all queued operations');
      this.flush();
    }
  }
}

// Create singleton instance
export const offlineQueue = new OfflineQueue();

// Export for debugging
if (process.env.NODE_ENV === 'development') {
  (window as any).offlineQueue = offlineQueue;
}