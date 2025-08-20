import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { query as dbQuery } from '../config/database';
import { asyncHandler, ValidationError, AppError } from '../middleware/errorHandler';
import { authenticate, authorize } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// Validation rules
const createRouteValidation = [
  body('routeNumber').notEmpty().isLength({ max: 50 }).withMessage('Route number is required'),
  body('routeName').notEmpty().isLength({ max: 255 }).withMessage('Route name is required'),
  body('direction').optional().isLength({ max: 100 }),
  body('description').optional().isLength({ max: 1000 }),
  body('color').optional().matches(/^#[0-9A-F]{6}$/i).withMessage('Invalid color format'),
];

const updateRouteValidation = [
  param('id').isUUID().withMessage('Invalid route ID'),
  ...createRouteValidation.map(validation => validation.optional()),
];

// Get all routes
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const result = await dbQuery(
    `SELECT * FROM routes WHERE is_active = true ORDER BY route_number`
  );

  res.json({
    routes: result.rows,
  });
}));

// Get single route
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await dbQuery('SELECT * FROM routes WHERE id = $1', [id]);

  if (result.rows.length === 0) {
    throw new AppError('Route not found', 404);
  }

  res.json({
    route: result.rows[0],
  });
}));

// Create route
router.post('/', authenticate, authorize('scheduler', 'admin'), createRouteValidation,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const userId = req.user?.userId;
    const { routeNumber, routeName, direction, description, color } = req.body;

    // Check if route already exists
    const existing = await dbQuery(
      'SELECT id FROM routes WHERE route_number = $1 AND direction = $2',
      [routeNumber, direction || null]
    );

    if (existing.rows.length > 0) {
      throw new AppError('Route with this number and direction already exists', 409);
    }

    // Create route
    const result = await dbQuery(
      `INSERT INTO routes (route_number, route_name, direction, description, color, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [routeNumber, routeName, direction, description, color, userId]
    );

    logger.info(`Route created: ${result.rows[0].id} by user ${userId}`);

    res.status(201).json({
      message: 'Route created successfully',
      route: result.rows[0],
    });
  })
);

// Update route
router.put('/:id', authenticate, authorize('scheduler', 'admin'), updateRouteValidation,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const { id } = req.params;
    const updateData = req.body;

    // Build update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        updates.push(`${key} = $${paramCount++}`);
        values.push(updateData[key]);
      }
    });

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    values.push(id);
    const updateQuery = `
      UPDATE routes 
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await dbQuery(updateQuery, values);

    if (result.rows.length === 0) {
      throw new AppError('Route not found', 404);
    }

    logger.info(`Route updated: ${id}`);

    res.json({
      message: 'Route updated successfully',
      route: result.rows[0],
    });
  })
);

// Delete route (soft delete)
router.delete('/:id', authenticate, authorize('admin'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await dbQuery(
      'UPDATE routes SET is_active = false WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Route not found', 404);
    }

    logger.info(`Route deactivated: ${id}`);

    res.json({
      message: 'Route deactivated successfully',
    });
  })
);

export default router;