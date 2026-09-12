import crypto from 'crypto';
import { EncryptionService } from '../utils/encryption';
import { Tokens } from '../store/tokens';

export class TokenService {
  static generateToken(): { prefix: string; full: string } {
    const prefix = 'sk_' + crypto.randomBytes(4).toString('hex');
    const secret = crypto.randomBytes(32).toString('hex');
    return { prefix, full: prefix + '_' + secret };
  }

  static async createToken(
    userId: string,
    tokenName: string,
    expiresIn?: number
  ): Promise<{ token: string; tokenId: string; prefix: string }> {
    const { prefix, full } = this.generateToken();
    const expiresAt =
      expiresIn && expiresIn > 0
        ? new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000).toISOString()
        : null;
    const row = await Tokens.create({
      userId,
      tokenName,
      tokenValue: EncryptionService.hash(full),
      tokenPrefix: prefix,
      expiresAt,
    });
    return { token: full, tokenId: row.id, prefix };
  }

  static async validateToken(token: string): Promise<string | null> {
    const result = await Tokens.findByHash(EncryptionService.hash(token));
    if (!result) return null;
    if (result.expiresAt && new Date(result.expiresAt) < new Date()) return null;
    await Tokens.touchLastUsed(result.id);
    return result.userId;
  }

  static async revokeToken(tokenId: string): Promise<void> {
    await Tokens.revoke(tokenId);
  }
}
