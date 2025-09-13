/**
 * Async utility functions for preventing long-running operations from hanging
 */

/**
 * Timeout error for operations that exceed time limit
 */
export class TimeoutError extends Error {
  constructor(message: string = 'Operation timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Wraps a promise with a timeout
 * @param promise The promise to wrap
 * @param timeoutMs Timeout in milliseconds
 * @param errorMessage Optional custom error message
 * @returns Promise that rejects if timeout is exceeded
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage?: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(errorMessage || `Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * Retry an async operation with exponential backoff
 * @param operation The async operation to retry
 * @param options Retry options
 * @returns Promise with the operation result
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
    onRetry?: (attempt: number, error: any) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    onRetry
  } = options;

  let lastError: any;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        throw error;
      }

      if (onRetry) {
        onRetry(attempt, error);
      }

      console.warn(`Retry attempt ${attempt}/${maxRetries} failed:`, error);

      // Wait with exponential backoff
      await sleep(Math.min(delay, maxDelay));
      delay *= backoffFactor;
    }
  }

  throw lastError;
}

/**
 * Sleep for a specified duration
 * @param ms Duration in milliseconds
 * @returns Promise that resolves after the duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a debounced async function
 * @param fn The async function to debounce
 * @param wait Wait time in milliseconds
 * @returns Debounced function
 */
export function debounceAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timeoutId: NodeJS.Timeout | null = null;
  let pendingPromise: Promise<ReturnType<T>> | null = null;

  return (...args: Parameters<T>): Promise<ReturnType<T>> => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    if (!pendingPromise) {
      pendingPromise = new Promise((resolve, reject) => {
        timeoutId = setTimeout(async () => {
          try {
            const result = await fn(...args);
            resolve(result);
          } catch (error) {
            reject(error);
          } finally {
            timeoutId = null;
            pendingPromise = null;
          }
        }, wait);
      });
    }

    return pendingPromise;
  };
}

/**
 * Create a throttled async function
 * @param fn The async function to throttle
 * @param limit Minimum time between calls in milliseconds
 * @returns Throttled function
 */
export function throttleAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => Promise<ReturnType<T> | void> {
  let inThrottle = false;
  let lastResult: ReturnType<T> | void;

  return async (...args: Parameters<T>): Promise<ReturnType<T> | void> => {
    if (!inThrottle) {
      inThrottle = true;
      lastResult = await fn(...args);

      setTimeout(() => {
        inThrottle = false;
      }, limit);

      return lastResult;
    }

    return lastResult;
  };
}

/**
 * Run multiple async operations in parallel with a concurrency limit
 * @param tasks Array of async tasks
 * @param concurrency Maximum number of concurrent operations
 * @returns Promise with all results
 */
export async function parallelLimit<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (let index = 0; index < tasks.length; index++) {
    const task = tasks[index];
    const promise = task().then((result: T) => {
      results[index] = result;
    });

    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      executing.splice(executing.findIndex(p => p === promise), 1);
    }
  }

  await Promise.all(executing);
  return results;
}

/**
 * Create an abort controller with automatic cleanup
 * @param timeoutMs Optional timeout in milliseconds
 * @returns AbortController instance
 */
export function createAbortController(timeoutMs?: number): AbortController {
  const controller = new AbortController();

  if (timeoutMs) {
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    // Monkey-patch to clear timeout on manual abort
    const originalAbort = controller.abort.bind(controller);
    controller.abort = () => {
      clearTimeout(timeoutId);
      originalAbort();
    };
  }

  return controller;
}

/**
 * Queue for sequential async operations
 */
export class AsyncQueue<T = void> {
  private queue: (() => Promise<T>)[] = [];
  private running = false;

  /**
   * Add an operation to the queue
   * @param operation The async operation to queue
   * @returns Promise that resolves when the operation completes
   */
  async add(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await operation();
          resolve(result);
          return result;
        } catch (error) {
          reject(error);
          throw error;
        }
      });

      if (!this.running) {
        this.process();
      }
    });
  }

  /**
   * Process the queue
   */
  private async process(): Promise<void> {
    if (this.running || this.queue.length === 0) {
      return;
    }

    this.running = true;

    while (this.queue.length > 0) {
      const operation = this.queue.shift()!;
      try {
        await operation();
      } catch (error) {
        console.error('Queue operation failed:', error);
      }
    }

    this.running = false;
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.queue = [];
  }

  /**
   * Get the current queue size
   */
  get size(): number {
    return this.queue.length;
  }

  /**
   * Check if the queue is running
   */
  get isRunning(): boolean {
    return this.running;
  }
}