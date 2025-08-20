import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authService } from '../services/authService';
import { asyncHandler } from '../middleware/errorHandler';
import { ValidationError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

// Validation rules
export const registerValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
  body('username')
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username must be 3-30 characters and contain only letters, numbers, underscore, and hyphen'),
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must be at least 8 characters with uppercase, lowercase, and number'),
  body('fullName')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be 2-100 characters'),
  body('role')
    .optional()
    .isIn(['admin', 'scheduler', 'operator', 'viewer'])
    .withMessage('Invalid role'),
];

export const loginValidation = [
  body('emailOrUsername').notEmpty().withMessage('Email or username is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

export const changePasswordValidation = [
  body('oldPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must be at least 8 characters with uppercase, lowercase, and number'),
];

// Controller methods
export const register = asyncHandler(async (req: Request, res: Response) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { email, username, password, fullName, role } = req.body;

  // Register user
  const user = await authService.register(email, username, password, fullName, role);

  // Auto-login after registration
  const loginResult = await authService.login(email, password);

  logger.info(`New user registered and logged in: ${email}`);

  res.status(201).json({
    message: 'Registration successful',
    user: loginResult.user,
    tokens: loginResult.tokens,
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { emailOrUsername, password } = req.body;

  // Login user
  const result = await authService.login(emailOrUsername, password);

  res.json({
    message: 'Login successful',
    user: result.user,
    tokens: result.tokens,
  });
});

export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    res.status(400).json({ error: 'Refresh token is required' });
    return;
  }

  // Refresh tokens
  const tokens = await authService.refreshAccessToken(refreshToken);

  res.json({
    message: 'Token refreshed successfully',
    tokens,
  });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  const userId = req.user?.userId;

  if (!userId) {
    res.status(401).json({ error: 'User not authenticated' });
    return;
  }

  // Logout user
  await authService.logout(userId, refreshToken);

  res.json({
    message: 'Logout successful',
  });
});

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    res.status(401).json({ error: 'User not authenticated' });
    return;
  }

  // Get user profile
  const user = await authService.getUserById(userId);

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({
    user,
  });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: 'User not authenticated' });
    return;
  }

  const { oldPassword, newPassword } = req.body;

  // Update password
  await authService.updatePassword(userId, oldPassword, newPassword);

  res.json({
    message: 'Password changed successfully. Please login again.',
  });
});