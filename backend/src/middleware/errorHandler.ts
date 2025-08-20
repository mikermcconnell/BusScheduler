import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Custom error class
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Validation error class
export class ValidationError extends AppError {
  errors: any[];

  constructor(message: string, errors: any[] = []) {
    super(message, 400);
    this.errors = errors;
  }
}

// Not found error handler
export const notFound = (req: Request, res: Response, next: NextFunction) => {
  const error = new AppError(`Not found - ${req.originalUrl}`, 404);
  next(error);
};

// Global error handler middleware
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let error = err;

  // If not operational error, log it
  if (!(error instanceof AppError) || !((error as AppError).isOperational)) {
    logger.error('Unexpected error:', {
      error: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      user: req.user?.userId,
    });
  }

  // Handle specific error types
  if (error.name === 'ValidationError' || error.name === 'ValidatorError') {
    error = new ValidationError('Validation failed', (error as any).errors);
  } else if (error.name === 'CastError') {
    error = new AppError('Invalid data format', 400);
  } else if (error.name === 'JsonWebTokenError') {
    error = new AppError('Invalid token', 401);
  } else if (error.name === 'TokenExpiredError') {
    error = new AppError('Token expired', 401);
  }

  // Default to 500 server error
  const statusCode = (error as AppError).statusCode || 500;
  const message = error.message || 'Internal server error';

  // Send error response
  const response: any = {
    error: {
      message,
      status: statusCode,
    },
  };

  // Add validation errors if present
  if (error instanceof ValidationError && error.errors) {
    response.error.errors = error.errors;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.error.stack = error.stack;
  }

  res.status(statusCode).json(response);
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};