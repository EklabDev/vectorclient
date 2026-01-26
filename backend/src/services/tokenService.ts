import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { db, pool } from '../config/database';
import { apiTokens } from '../database/schema';
import { eq, and, sql } from 'drizzle-orm';
import { EncryptionService } from '../utils/encryption';

export class TokenService {
  static generateToken(): { prefix: string; full: string } {
    const prefix = 'sk_' + crypto.randomBytes(4).toString('hex');
    const secret = crypto.randomBytes(32).toString('hex');
    const full = prefix + '_' + secret;

    return { prefix, full };
  }

  static async createToken(
    userId: string,
    tokenName: string,
    expiresIn?: number
  ): Promise<{ token: string; tokenId: string; prefix: string }> {
    const { prefix, full } = this.generateToken();
    const hashedToken = EncryptionService.hash(full);

    const tokenId = uuidv4();
    
    // Calculate expiresAt if expiresIn is provided
    const expiresAtValue = (expiresIn && expiresIn > 0)
      ? new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000)
      : null;

    // Use raw SQL to handle nullable expires_at field correctly
    // Use parameterized query for security
    const query = `
      INSERT INTO api_tokens (
        id, user_id, token_name, token_value, token_prefix, expires_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6
      ) RETURNING id
    `;

    const result = await pool.query(query, [
      tokenId,
      userId,
      tokenName,
      hashedToken,
      prefix,
      expiresAtValue, // This will be NULL if not provided, which PostgreSQL handles correctly
    ]);
    
    return {
      token: full, // Only shown once
      tokenId: result.rows[0].id,
      prefix,
    };
  }

  static async validateToken(token: string): Promise<string | null> {
    const hashedToken = EncryptionService.hash(token);

    const [result] = await db
      .select()
      .from(apiTokens)
      .where(
        and(
          eq(apiTokens.tokenValue, hashedToken),
          eq(apiTokens.isActive, true)
        )
      )
      .limit(1);

    if (!result) return null;

    // Check expiration
    if (result.expiresAt && new Date(result.expiresAt) < new Date()) {
      return null;
    }

    // Update last used
    await db
      .update(apiTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiTokens.id, result.id));

    return result.userId;
  }

  static async revokeToken(tokenId: string): Promise<void> {
    await db
      .update(apiTokens)
      .set({ isActive: false })
      .where(eq(apiTokens.id, tokenId));
  }
}
