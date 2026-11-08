import * as jsonwebtoken from 'jsonwebtoken';
import { EncryptionService } from '../utils/encryption';
import { TotpService } from '../utils/totp';
import { Users } from '../store/users';
import { bootstrapKnowledgeDb } from '../arcade/bootstrap';
import type { UserDoc } from '../store/types';

interface AuthPayload {
  userId: string;
  username: string;
  tokenVersion?: number;
}

export interface LoginResult {
  requires2FA: boolean;
  userId: string;
  username: string;
  token?: string;
  preAuthToken?: string;
}

export class AuthService {
  private static getJwtSecret(): string {
    return process.env.JWT_SECRET || 'change-me';
  }

  static async register(
    username: string,
    password: string,
    email: string,
    displayName: string
  ): Promise<{ userId: string; username: string; token: string }> {
    const existing = await Users.findByUsername(username);
    if (existing) throw new Error('Username already exists');

    // Use memory-hard OWASP scrypt password hashing
    const hashedPassword = EncryptionService.hashPassword(password);

    const user = await Users.create({
      username,
      password: hashedPassword,
      email,
      displayName,
    });

    await bootstrapKnowledgeDb(user.id);
    return {
      userId: user.id,
      username: user.username,
      token: this.generateToken({ userId: user.id, username: user.username, tokenVersion: 1 }),
    };
  }

  static async login(username: string, password: string): Promise<LoginResult> {
    const user = await Users.findByUsername(username);
    if (!user) throw new Error('Invalid credentials');

    // 1. Check Account Lockout
    if (user.lockoutUntil && new Date(user.lockoutUntil) > new Date()) {
      const remainingMs = new Date(user.lockoutUntil).getTime() - Date.now();
      const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
      throw new Error(
        `Account is temporarily locked due to too many failed attempts. Please try again after ${remainingMinutes} minute(s).`
      );
    }

    // 2. Verify Password (supports modern scrypt hash & legacy AES-256 for smooth migration)
    const isPasswordValid = EncryptionService.verifyPassword(password, user.password);

    if (!isPasswordValid) {
      const failedAttempts = (user.failedLoginAttempts || 0) + 1;
      let lockoutUntil: string | null = user.lockoutUntil || null;

      if (failedAttempts >= 5) {
        lockoutUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      }

      await Users.update(user.id, {
        failedLoginAttempts: failedAttempts,
        lockoutUntil,
      });

      if (failedAttempts >= 5) {
        throw new Error('Account has been temporarily locked for 15 minutes due to 5 consecutive failed login attempts.');
      }

      const remaining = 5 - failedAttempts;
      throw new Error(`Invalid credentials. ${remaining} attempt(s) remaining before account lockout.`);
    }

    // 3. Password is valid: Reset failed attempts & upgrade legacy AES passwords to scrypt
    const updates: Partial<UserDoc> = {};
    if ((user.failedLoginAttempts || 0) > 0 || user.lockoutUntil) {
      updates.failedLoginAttempts = 0;
      updates.lockoutUntil = null;
    }
    if (!user.password.startsWith('scrypt:')) {
      updates.password = EncryptionService.hashPassword(password);
    }
    if (Object.keys(updates).length > 0) {
      await Users.update(user.id, updates);
    }

    // 4. Check if Two-Factor Authentication is enabled
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      // Issue a short-lived 5-minute pre-auth token for 2FA challenge
      const preAuthToken = jsonwebtoken.sign(
        { userId: user.id, username: user.username, purpose: '2fa_challenge' },
        this.getJwtSecret(),
        { expiresIn: '5m' }
      );

      return {
        requires2FA: true,
        userId: user.id,
        username: user.username,
        preAuthToken,
      };
    }

    // 5. Standard login without 2FA
    return {
      requires2FA: false,
      userId: user.id,
      username: user.username,
      token: this.generateToken({
        userId: user.id,
        username: user.username,
        tokenVersion: user.tokenVersion || 1,
      }),
    };
  }

  static async verify2FALogin(
    preAuthToken: string,
    code: string
  ): Promise<{ userId: string; username: string; token: string }> {
    let payload: { userId: string; username: string; purpose: string };
    try {
      payload = jsonwebtoken.verify(preAuthToken, this.getJwtSecret()) as {
        userId: string;
        username: string;
        purpose: string;
      };
    } catch {
      throw new Error('2FA session has expired or is invalid. Please log in again.');
    }

    if (payload.purpose !== '2fa_challenge') {
      throw new Error('Invalid authentication token');
    }

    const user = await Users.findById(payload.userId);
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new Error('Two-factor authentication is not configured for this user.');
    }

    // Check account lockout
    if (user.lockoutUntil && new Date(user.lockoutUntil) > new Date()) {
      const remainingMs = new Date(user.lockoutUntil).getTime() - Date.now();
      const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
      throw new Error(`Account is locked. Please try again after ${remainingMinutes} minute(s).`);
    }

    // Decrypt TOTP secret
    const secret = EncryptionService.decrypt(user.twoFactorSecret);
    const isTotpValid = TotpService.verifyToken(code, secret);

    if (!isTotpValid) {
      // Check backup codes
      let backupCodeValid = false;
      let remainingHashedCodes: string[] = [];

      if (user.twoFactorBackupCodes) {
        try {
          const storedHashes = JSON.parse(user.twoFactorBackupCodes) as string[];
          const check = TotpService.verifyBackupCode(code, storedHashes);
          if (check.valid) {
            backupCodeValid = true;
            remainingHashedCodes = check.remainingHashedCodes;
          }
        } catch {
          // parse error
        }
      }

      if (backupCodeValid) {
        // Burn used backup code and reset failed attempts
        await Users.update(user.id, {
          twoFactorBackupCodes: JSON.stringify(remainingHashedCodes),
          failedLoginAttempts: 0,
          lockoutUntil: null,
        });

        return {
          userId: user.id,
          username: user.username,
          token: this.generateToken({
            userId: user.id,
            username: user.username,
            tokenVersion: user.tokenVersion || 1,
          }),
        };
      }

      // Invalid 2FA code - count toward lockout
      const failed = (user.failedLoginAttempts || 0) + 1;
      let lockoutUntil: string | null = null;
      if (failed >= 5) {
        lockoutUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      }
      await Users.update(user.id, { failedLoginAttempts: failed, lockoutUntil });

      throw new Error('Invalid authentication code or backup recovery code.');
    }

    // Successfully verified TOTP code
    await Users.update(user.id, { failedLoginAttempts: 0, lockoutUntil: null });

    return {
      userId: user.id,
      username: user.username,
      token: this.generateToken({
        userId: user.id,
        username: user.username,
        tokenVersion: user.tokenVersion || 1,
      }),
    };
  }

  static async setup2FA(userId: string): Promise<{
    secret: string;
    qrCodeDataUrl: string;
    backupCodes: string[];
    otpauthUrl: string;
  }> {
    const user = await Users.findById(userId);
    if (!user) throw new Error('User not found');

    const secret = TotpService.generateSecret();
    const otpauthUrl = TotpService.generateOtpAuthUrl('EKLab VectorClient', user.username, secret);
    const qrCodeDataUrl = await TotpService.generateQrCodeDataUrl(otpauthUrl);
    const { plainCodes } = TotpService.generateBackupCodes(8);

    return {
      secret,
      qrCodeDataUrl,
      backupCodes: plainCodes,
      otpauthUrl,
    };
  }

  static async confirm2FA(
    userId: string,
    secret: string,
    code: string,
    backupCodes: string[]
  ): Promise<{ success: boolean; message: string }> {
    const user = await Users.findById(userId);
    if (!user) throw new Error('User not found');

    const isValid = TotpService.verifyToken(code, secret);
    if (!isValid) {
      throw new Error('Verification code is invalid. Please check your authenticator app and try again.');
    }

    const encryptedSecret = EncryptionService.encrypt(secret);
    const hashedBackupCodes = backupCodes.map((c) =>
      EncryptionService.hash(c.toLowerCase().trim())
    );

    await Users.update(user.id, {
      twoFactorEnabled: true,
      twoFactorSecret: encryptedSecret,
      twoFactorBackupCodes: JSON.stringify(hashedBackupCodes),
    });

    return {
      success: true,
      message: 'Two-factor authentication enabled successfully.',
    };
  }

  static async disable2FA(
    userId: string,
    currentPassword: string
  ): Promise<{ success: boolean; message: string }> {
    const user = await Users.findById(userId);
    if (!user) throw new Error('User not found');

    if (!EncryptionService.verifyPassword(currentPassword, user.password)) {
      throw new Error('Current password is incorrect.');
    }

    await Users.update(user.id, {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: null,
    });

    return {
      success: true,
      message: 'Two-factor authentication disabled successfully.',
    };
  }

  static async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    const user = await Users.findById(userId);
    if (!user) throw new Error('User not found');

    if (!EncryptionService.verifyPassword(currentPassword, user.password)) {
      throw new Error('Current password is incorrect.');
    }

    if (!newPassword || newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters long.');
    }

    const hashedPassword = EncryptionService.hashPassword(newPassword);
    const tokenVersion = (user.tokenVersion || 1) + 1;

    await Users.update(user.id, {
      password: hashedPassword,
      passwordChangedAt: new Date().toISOString(),
      tokenVersion,
    });

    return {
      success: true,
      message: 'Password changed successfully. All other sessions have been invalidated.',
    };
  }

  static async getProfile(userId: string): Promise<{
    id: string;
    username: string;
    email: string;
    displayName: string;
    twoFactorEnabled: boolean;
    createdAt: string;
  }> {
    const user = await Users.findById(userId);
    if (!user) throw new Error('User not found');

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      twoFactorEnabled: Boolean(user.twoFactorEnabled),
      createdAt: user.createdAt,
    };
  }

  static generateToken(payload: AuthPayload): string {
    return jsonwebtoken.sign(payload, this.getJwtSecret(), { expiresIn: '24h' });
  }

  static verifyToken(token: string): AuthPayload | null {
    try {
      return jsonwebtoken.verify(token, this.getJwtSecret()) as AuthPayload;
    } catch {
      return null;
    }
  }
}
