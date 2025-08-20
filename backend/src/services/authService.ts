import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../config/database';
import { logger } from '../utils/logger';

export interface User {
  id: string;
  email: string;
  username: string;
  full_name?: string;
  role: 'admin' | 'scheduler' | 'operator' | 'viewer';
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

class AuthService {
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'default_secret';
  private readonly JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'default_refresh_secret';
  private readonly JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';
  private readonly JWT_REFRESH_EXPIRE = process.env.JWT_REFRESH_EXPIRE || '30d';

  constructor() {
    if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
      logger.warn('JWT secrets not properly configured. Using default values (NOT SAFE FOR PRODUCTION)');
    }
  }

  /**
   * Hash password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate JWT access token
   */
  generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRE,
    });
  }

  /**
   * Generate JWT refresh token
   */
  generateRefreshToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.JWT_REFRESH_SECRET, {
      expiresIn: this.JWT_REFRESH_EXPIRE,
    });
  }

  /**
   * Verify JWT token
   */
  verifyAccessToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as any;
      return {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
      };
    } catch (error) {
      logger.error('Token verification failed:', error);
      return null;
    }
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, this.JWT_REFRESH_SECRET) as any;
      return {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
      };
    } catch (error) {
      logger.error('Refresh token verification failed:', error);
      return null;
    }
  }

  /**
   * Register new user
   */
  async register(
    email: string,
    username: string,
    password: string,
    fullName?: string,
    role: User['role'] = 'viewer'
  ): Promise<User> {
    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      throw new Error('User with this email or username already exists');
    }

    // Hash password
    const passwordHash = await this.hashPassword(password);

    // Create user
    const result = await query(
      `INSERT INTO users (email, username, password_hash, full_name, role) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, email, username, full_name, role, is_active, created_at, updated_at`,
      [email, username, passwordHash, fullName, role]
    );

    const user = result.rows[0];
    logger.info('New user registered:', { userId: user.id, email: user.email });

    return user;
  }

  /**
   * Login user
   */
  async login(emailOrUsername: string, password: string): Promise<{ user: User; tokens: AuthTokens }> {
    // Find user by email or username
    const result = await query(
      `SELECT id, email, username, password_hash, full_name, role, is_active, created_at, updated_at 
       FROM users 
       WHERE (email = $1 OR username = $1) AND is_active = true`,
      [emailOrUsername]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid credentials');
    }

    const user = result.rows[0];

    // Verify password
    const isValid = await this.verifyPassword(password, user.password_hash);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    // Update last login
    await query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    // Generate tokens
    const tokenPayload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.generateAccessToken(tokenPayload);
    const refreshToken = this.generateRefreshToken(tokenPayload);

    // Store refresh token in database
    await this.storeRefreshToken(user.id, refreshToken);

    // Remove password hash from user object
    delete user.password_hash;

    logger.info('User logged in:', { userId: user.id, email: user.email });

    return {
      user,
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
      },
    };
  }

  /**
   * Store refresh token in database
   */
  async storeRefreshToken(userId: string, token: string): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    await query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [userId, token, expiresAt]
    );
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
    // Verify refresh token
    const payload = this.verifyRefreshToken(refreshToken);
    if (!payload) {
      throw new Error('Invalid refresh token');
    }

    // Check if refresh token exists in database and is not revoked
    const result = await query(
      `SELECT id, user_id, expires_at, revoked_at 
       FROM refresh_tokens 
       WHERE token = $1 AND revoked_at IS NULL`,
      [refreshToken]
    );

    if (result.rows.length === 0) {
      throw new Error('Refresh token not found or revoked');
    }

    const tokenRecord = result.rows[0];

    // Check if token is expired
    if (new Date(tokenRecord.expires_at) < new Date()) {
      throw new Error('Refresh token expired');
    }

    // Generate new tokens
    const newAccessToken = this.generateAccessToken(payload);
    const newRefreshToken = this.generateRefreshToken(payload);

    // Update refresh token in database (rotate tokens)
    await withTransaction(async (client) => {
      // Revoke old token
      await client.query(
        'UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP, replaced_by = $1 WHERE token = $2',
        [newRefreshToken, refreshToken]
      );

      // Store new token
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      await client.query(
        'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
        [tokenRecord.user_id, newRefreshToken, expiresAt]
      );
    });

    logger.info('Access token refreshed for user:', payload.userId);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 7 * 24 * 60 * 60,
    };
  }

  /**
   * Logout user (revoke refresh tokens)
   */
  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      // Revoke specific refresh token
      await query(
        'UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND token = $2',
        [userId, refreshToken]
      );
    } else {
      // Revoke all refresh tokens for user
      await query(
        'UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND revoked_at IS NULL',
        [userId]
      );
    }

    logger.info('User logged out:', userId);
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    const result = await query(
      `SELECT id, email, username, full_name, role, is_active, created_at, updated_at 
       FROM users 
       WHERE id = $1`,
      [userId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Update user password
   */
  async updatePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    // Get current password hash
    const result = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    // Verify old password
    const isValid = await this.verifyPassword(oldPassword, result.rows[0].password_hash);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await this.hashPassword(newPassword);

    // Update password
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newPasswordHash, userId]);

    // Revoke all refresh tokens (force re-login)
    await this.logout(userId);

    logger.info('Password updated for user:', userId);
  }

  /**
   * Clean up expired tokens (should be run periodically)
   */
  async cleanupExpiredTokens(): Promise<void> {
    const result = await query(
      'DELETE FROM refresh_tokens WHERE expires_at < CURRENT_TIMESTAMP OR revoked_at IS NOT NULL'
    );

    logger.info(`Cleaned up ${result.rowCount} expired/revoked tokens`);
  }
}

export const authService = new AuthService();