import { Router } from 'express';
import {
  createSchedule,
  getSchedule,
  listSchedules,
  updateSchedule,
  deleteSchedule,
  publishSchedule,
  createScheduleValidation,
  updateScheduleValidation,
  getScheduleValidation,
  listSchedulesValidation,
} from '../controllers/scheduleController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// List and get schedules (all authenticated users)
router.get('/', listSchedulesValidation, listSchedules);
router.get('/:id', getScheduleValidation, getSchedule);

// Create, update, delete schedules (scheduler and admin only)
router.post('/', authorize('scheduler', 'admin'), createScheduleValidation, createSchedule);
router.put('/:id', authorize('scheduler', 'admin'), updateScheduleValidation, updateSchedule);
router.delete('/:id', authorize('admin'), deleteSchedule);

// Publish schedule (admin only)
router.post('/:id/publish', authorize('admin'), publishSchedule);

export default router;