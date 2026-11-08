import crypto from 'crypto';

export class EncryptionService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 16;
  private static readonly AUTH_TAG_LENGTH = 16;
  private static readonly SALT_LENGTH = 32;

  private static getKey(): Buffer {
    const secret = process.env.AES_SECRET || 'default-32-character-secret-key-123456';
    if (!secret || secret.length < 32) {
      throw new Error('AES_SECRET must be at least 32 characters');
    }
    return crypto.scryptSync(secret, 'salt', 32);
  }

  static encrypt(text: string): string {
    const key = this.getKey();
    const iv = crypto.randomBytes(this.IV_LENGTH);
    const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();
    const result = iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;

    return result;
  }

  static decrypt(encrypted: string): string {
    try {
      const key = this.getKey();
      const parts = encrypted.split(':');

      if (parts.length !== 3) {
        throw new Error('Invalid encrypted text format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encryptedText = parts[2];

      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error('Decryption failed: ' + (error as Error).message);
    }
  }

  static hash(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  static verify(plaintext: string, hash: string): boolean {
    return this.hash(plaintext) === hash;
  }

  /**
   * Hashes a password using OWASP-compliant memory-hard scrypt KDF with random salt.
   */
  static hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `scrypt:${salt}:${hash}`;
  }

  /**
   * Verifies password against stored hash using constant-time comparison.
   * Seamlessly supports legacy AES-256-GCM encrypted passwords for migration.
   */
  static verifyPassword(password: string, stored: string): boolean {
    if (stored.startsWith('scrypt:')) {
      const parts = stored.split(':');
      if (parts.length !== 3) return false;
      const salt = parts[1];
      const expectedHash = Buffer.from(parts[2], 'hex');
      const actualHash = crypto.scryptSync(password, salt, 64);
      if (expectedHash.length !== actualHash.length) return false;
      return crypto.timingSafeEqual(expectedHash, actualHash);
    }

    // Backward compatibility for legacy AES-256-GCM passwords
    try {
      const decrypted = this.decrypt(stored);
      const decBuf = Buffer.from(decrypted);
      const passBuf = Buffer.from(password);
      if (decBuf.length !== passBuf.length) return false;
      return crypto.timingSafeEqual(decBuf, passBuf);
    } catch {
      return false;
    }
  }
}
