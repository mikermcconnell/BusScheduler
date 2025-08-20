import { Router } from 'express';
import {
  register,
  login,
  refreshToken,
  logout,
  getProfile,
  changePassword,
  registerValidation,
  loginValidation,
  changePasswordValidation,
} from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Public routes
router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.post('/refresh-token', refreshToken);

// Protected routes
router.use(authenticate); // All routes below require authentication
router.post('/logout', logout);
router.get('/profile', getProfile);
router.post('/change-password', changePasswordValidation, changePassword);

export default router;