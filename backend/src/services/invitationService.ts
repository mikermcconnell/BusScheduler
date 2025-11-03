import crypto from 'crypto';
import { query } from '../config/database';
import { logger } from '../utils/logger';
import { User } from './authService';

export interface InvitationRecord {
  id: string;
  code: string;
  email: string | null;
  role: User['role'];
  created_by: string | null;
  created_at: Date;
  expires_at: Date | null;
  consumed_at: Date | null;
  consumed_by: string | null;
}

interface CreateInvitationOptions {
  email?: string;
  role?: User['role'];
  expiresInHours?: number;
  code?: string;
}

class InvitationService {
  private generateCode(provided?: string): string {
    if (provided) {
      return provided.trim();
    }
    return crypto.randomBytes(24).toString('hex');
  }

  async createInvitation(options: CreateInvitationOptions = {}, createdBy?: string): Promise<InvitationRecord> {
    const code = this.generateCode(options.code);
    const role = options.role ?? 'viewer';
    const expiresInHours = options.expiresInHours ?? 72;
    const expiresAt = expiresInHours > 0 ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000) : null;

    const result = await query(
      INSERT INTO user_invitations (code, email, role, created_by, expires_at)
       VALUES (, , , , )
       RETURNING id, code, email, role, created_by, created_at, expires_at, consumed_at, consumed_by,
      [code, options.email ?? null, role, createdBy ?? null, expiresAt]
    );

    const invitation = result.rows[0];
    logger.info('Invitation created', { code: invitation.code, role: invitation.role, email: invitation.email });
    return this.mapRecord(invitation);
  }

  async validateInvitation(code: string): Promise<InvitationRecord> {
    const result = await query(
      SELECT id, code, email, role, created_by, created_at, expires_at, consumed_at, consumed_by
         FROM user_invitations
         WHERE code = ,
      [code]
    );

    if (result.rows.length === 0) {
      throw new Error('Invitation code is invalid');
    }

    const record = this.mapRecord(result.rows[0]);

    if (record.consumed_at) {
      throw new Error('Invitation code has already been used');
    }

    if (record.expires_at && record.expires_at.getTime() < Date.now()) {
      throw new Error('Invitation code has expired');
    }

    return record;
  }

  async consumeInvitation(code: string, userId: string): Promise<void> {
    await query(
      UPDATE user_invitations
         SET consumed_at = CURRENT_TIMESTAMP,
             consumed_by = 
       WHERE code = ,
      [userId, code]
    );
  }

  async listActiveInvitations(): Promise<InvitationRecord[]> {
    const result = await query(
      SELECT id, code, email, role, created_by, created_at, expires_at, consumed_at, consumed_by
         FROM user_invitations
         WHERE consumed_at IS NULL
         ORDER BY created_at DESC
    );

    return result.rows.map((row) => this.mapRecord(row));
  }

  private mapRecord(row: any): InvitationRecord {
    return {
      id: row.id,
      code: row.code,
      email: row.email,
      role: row.role,
      created_by: row.created_by,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
      expires_at: row.expires_at ? new Date(row.expires_at) : null,
      consumed_at: row.consumed_at ? new Date(row.consumed_at) : null,
      consumed_by: row.consumed_by,
    };
  }
}

export const invitationService = new InvitationService();
