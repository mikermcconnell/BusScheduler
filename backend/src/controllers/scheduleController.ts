import { Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { query as dbQuery, withTransaction } from '../config/database';
import { asyncHandler, ValidationError, AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

// Validation rules
export const createScheduleValidation = [
  body('routeId').isUUID().withMessage('Invalid route ID'),
  body('name').notEmpty().isLength({ max: 255 }).withMessage('Schedule name is required'),
  body('effectiveDate').isISO8601().toDate().withMessage('Invalid effective date'),
  body('expirationDate').optional().isISO8601().toDate().withMessage('Invalid expiration date'),
  body('cycleTimeMinutes').optional().isInt({ min: 1, max: 480 }).withMessage('Invalid cycle time'),
  body('numberOfBuses').optional().isInt({ min: 1, max: 50 }).withMessage('Invalid number of buses'),
  body('automateBlockStartTimes').optional().isBoolean(),
  body('notes').optional().isLength({ max: 1000 }),
];

export const updateScheduleValidation = [
  param('id').isUUID().withMessage('Invalid schedule ID'),
  ...createScheduleValidation.map(validation => validation.optional()),
];

export const getScheduleValidation = [
  param('id').isUUID().withMessage('Invalid schedule ID'),
];

export const listSchedulesValidation = [
  query('routeId').optional().isUUID().withMessage('Invalid route ID'),
  query('status').optional().isIn(['draft', 'active', 'archived', 'expired']),
  query('dayType').optional().isIn(['weekday', 'saturday', 'sunday']),
  query('page').optional().isInt({ min: 1 }).withMessage('Invalid page number'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Invalid limit'),
];

// Controller methods
export const createSchedule = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const userId = req.user?.userId;
  const {
    routeId,
    name,
    effectiveDate,
    expirationDate,
    cycleTimeMinutes,
    numberOfBuses,
    automateBlockStartTimes = true,
    notes,
  } = req.body;

  // Check if route exists
  const routeResult = await dbQuery('SELECT id FROM routes WHERE id = $1', [routeId]);
  if (routeResult.rows.length === 0) {
    throw new AppError('Route not found', 404);
  }

  // Create schedule
  const result = await dbQuery(
    `INSERT INTO schedules (
      route_id, name, effective_date, expiration_date, 
      cycle_time_minutes, number_of_buses, automate_block_start_times, 
      notes, created_by, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft')
    RETURNING *`,
    [
      routeId, name, effectiveDate, expirationDate,
      cycleTimeMinutes, numberOfBuses, automateBlockStartTimes,
      notes, userId,
    ]
  );

  const schedule = result.rows[0];
  logger.info(`Schedule created: ${schedule.id} by user ${userId}`);

  res.status(201).json({
    message: 'Schedule created successfully',
    schedule,
  });
});

export const getSchedule = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { id } = req.params;

  // Get schedule with route info
  const result = await dbQuery(
    `SELECT 
      s.*,
      r.route_number,
      r.route_name,
      r.direction,
      u.username as created_by_username,
      a.username as approved_by_username
    FROM schedules s
    JOIN routes r ON s.route_id = r.id
    LEFT JOIN users u ON s.created_by = u.id
    LEFT JOIN users a ON s.approved_by = a.id
    WHERE s.id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    throw new AppError('Schedule not found', 404);
  }

  const schedule = result.rows[0];

  // Get time points
  const timePointsResult = await dbQuery(
    'SELECT * FROM time_points WHERE schedule_id = $1 ORDER BY sequence_number',
    [id]
  );

  // Get trips
  const tripsResult = await dbQuery(
    `SELECT 
      t.*,
      b.block_number,
      sb.name as service_band_name
    FROM trips t
    LEFT JOIN blocks b ON t.block_id = b.id
    LEFT JOIN service_bands sb ON t.service_band_id = sb.id
    WHERE t.schedule_id = $1
    ORDER BY t.day_type, t.departure_time`,
    [id]
  );

  // Get blocks
  const blocksResult = await dbQuery(
    'SELECT * FROM blocks WHERE schedule_id = $1 ORDER BY day_type, block_number',
    [id]
  );

  // Get service bands
  const serviceBandsResult = await dbQuery(
    'SELECT * FROM service_bands WHERE schedule_id = $1 ORDER BY day_type, start_time',
    [id]
  );

  res.json({
    schedule: {
      ...schedule,
      timePoints: timePointsResult.rows,
      trips: tripsResult.rows,
      blocks: blocksResult.rows,
      serviceBands: serviceBandsResult.rows,
    },
  });
});

export const listSchedules = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const {
    routeId,
    status,
    dayType,
    page = 1,
    limit = 20,
  } = req.query;

  // Build query
  let queryText = `
    SELECT 
      s.*,
      r.route_number,
      r.route_name,
      r.direction,
      COUNT(DISTINCT t.id) as trip_count
    FROM schedules s
    JOIN routes r ON s.route_id = r.id
    LEFT JOIN trips t ON s.id = t.schedule_id
    WHERE 1=1
  `;
  const params: any[] = [];
  let paramCount = 0;

  if (routeId) {
    queryText += ` AND s.route_id = $${++paramCount}`;
    params.push(routeId);
  }

  if (status) {
    queryText += ` AND s.status = $${++paramCount}`;
    params.push(status);
  }

  if (dayType) {
    queryText += ` AND EXISTS (SELECT 1 FROM trips WHERE schedule_id = s.id AND day_type = $${++paramCount})`;
    params.push(dayType);
  }

  queryText += ' GROUP BY s.id, r.route_number, r.route_name, r.direction';
  queryText += ' ORDER BY s.created_at DESC';

  // Add pagination
  const offset = (Number(page) - 1) * Number(limit);
  queryText += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
  params.push(limit, offset);

  // Execute query
  const result = await dbQuery(queryText, params);

  // Get total count
  let countQuery = 'SELECT COUNT(DISTINCT s.id) FROM schedules s WHERE 1=1';
  const countParams: any[] = [];
  paramCount = 0;

  if (routeId) {
    countQuery += ` AND s.route_id = $${++paramCount}`;
    countParams.push(routeId);
  }

  if (status) {
    countQuery += ` AND s.status = $${++paramCount}`;
    countParams.push(status);
  }

  const countResult = await dbQuery(countQuery, countParams);
  const totalCount = parseInt(countResult.rows[0].count, 10);

  res.json({
    schedules: result.rows,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: totalCount,
      pages: Math.ceil(totalCount / Number(limit)),
    },
  });
});

export const updateSchedule = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { id } = req.params;
  const userId = req.user?.userId;
  const updateData = req.body;

  // Check if schedule exists
  const existingResult = await dbQuery('SELECT * FROM schedules WHERE id = $1', [id]);
  if (existingResult.rows.length === 0) {
    throw new AppError('Schedule not found', 404);
  }

  const existing = existingResult.rows[0];

  // Build update query dynamically
  const updates: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  Object.keys(updateData).forEach(key => {
    if (key !== 'id' && updateData[key] !== undefined) {
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
    UPDATE schedules 
    SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = $${paramCount}
    RETURNING *
  `;

  // Update schedule and create version history
  const result = await withTransaction(async (client) => {
    // Update schedule
    const updateResult = await client.query(updateQuery, values);

    // Create version history
    await client.query(
      `INSERT INTO schedule_versions (schedule_id, version_number, data, changed_by, change_description)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        id,
        (existing.version || 1) + 1,
        JSON.stringify(existing),
        userId,
        `Updated: ${updates.join(', ')}`,
      ]
    );

    // Increment version
    await client.query(
      'UPDATE schedules SET version = version + 1 WHERE id = $1',
      [id]
    );

    return updateResult;
  });

  logger.info(`Schedule updated: ${id} by user ${userId}`);

  res.json({
    message: 'Schedule updated successfully',
    schedule: result.rows[0],
  });
});

export const deleteSchedule = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;

  // Check if schedule exists
  const result = await dbQuery('SELECT * FROM schedules WHERE id = $1', [id]);
  if (result.rows.length === 0) {
    throw new AppError('Schedule not found', 404);
  }

  // Soft delete by setting status to archived
  await dbQuery(
    `UPDATE schedules 
     SET status = 'archived', updated_at = CURRENT_TIMESTAMP 
     WHERE id = $1`,
    [id]
  );

  logger.info(`Schedule archived: ${id} by user ${userId}`);

  res.json({
    message: 'Schedule archived successfully',
  });
});

export const publishSchedule = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;

  // Update schedule status to active
  const result = await dbQuery(
    `UPDATE schedules 
     SET status = 'active', approved_by = $1, approved_at = CURRENT_TIMESTAMP 
     WHERE id = $2 AND status = 'draft'
     RETURNING *`,
    [userId, id]
  );

  if (result.rows.length === 0) {
    throw new AppError('Schedule not found or already published', 404);
  }

  logger.info(`Schedule published: ${id} by user ${userId}`);

  res.json({
    message: 'Schedule published successfully',
    schedule: result.rows[0],
  });
});