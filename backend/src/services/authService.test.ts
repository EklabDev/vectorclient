import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from './authService';
import { Users } from '../store/users';
import { EncryptionService } from '../utils/encryption';
import { TotpService } from '../utils/totp';
import type { UserDoc } from '../store/types';

vi.mock('../arcade/bootstrap', () => ({
  bootstrapKnowledgeDb: vi.fn().mockResolvedValue(undefined),
}));

describe('AuthService Security Hardening', () => {
  const mockUsers: Record<string, UserDoc> = {};

  beforeEach(() => {
    for (const k of Object.keys(mockUsers)) delete mockUsers[k];

    vi.spyOn(Users, 'findByUsername').mockImplementation(async (username: string) => {
      return Object.values(mockUsers).find((u) => u.username === username) || null;
    });

    vi.spyOn(Users, 'findById').mockImplementation(async (id: string) => {
      return mockUsers[id] || null;
    });

    vi.spyOn(Users, 'create').mockImplementation(async (input: any) => {
      const doc: UserDoc = {
        id: `user-${Date.now()}`,
        username: input.username,
        password: input.password,
        email: input.email,
        displayName: input.displayName,
        isActive: true,
        failedLoginAttempts: 0,
        lockoutUntil: null,
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: null,
        tokenVersion: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockUsers[doc.id] = doc;
      return doc;
    });

    vi.spyOn(Users, 'update').mockImplementation(async (id: string, fields: any) => {
      if (!mockUsers[id]) return null;
      mockUsers[id] = { ...mockUsers[id], ...fields, updatedAt: new Date().toISOString() };
      return mockUsers[id];
    });
  });

  it('hashes password with scrypt on registration', async () => {
    const res = await AuthService.register('alice', 'supersecret123', 'alice@example.com', 'Alice');
    expect(res.userId).toBeDefined();
    const stored = mockUsers[res.userId];
    expect(stored.password.startsWith('scrypt:')).toBe(true);
    expect(EncryptionService.verifyPassword('supersecret123', stored.password)).toBe(true);
  });

  it('locks out account after 5 failed login attempts for 15 minutes', async () => {
    const reg = await AuthService.register('bob', 'correctpass123', 'bob@example.com', 'Bob');

    // 4 failed attempts
    for (let i = 1; i <= 4; i++) {
      await expect(AuthService.login('bob', 'wrongpass')).rejects.toThrow(/remaining before account lockout/);
      expect(mockUsers[reg.userId].failedLoginAttempts).toBe(i);
      expect(mockUsers[reg.userId].lockoutUntil).toBeNull();
    }

    // 5th failed attempt triggers lockout
    await expect(AuthService.login('bob', 'wrongpass')).rejects.toThrow(/temporarily locked for 15 minutes/);
    expect(mockUsers[reg.userId].failedLoginAttempts).toBe(5);
    expect(mockUsers[reg.userId].lockoutUntil).not.toBeNull();

    // Subsequent attempt even with correct password is rejected while locked
    await expect(AuthService.login('bob', 'correctpass123')).rejects.toThrow(/temporarily locked due to too many failed attempts/);
  });

  it('resets failed login attempts on successful login', async () => {
    const reg = await AuthService.register('charlie', 'mypassword123', 'charlie@example.com', 'Charlie');

    // 2 failed attempts
    await expect(AuthService.login('charlie', 'wrong')).rejects.toThrow();
    await expect(AuthService.login('charlie', 'wrong')).rejects.toThrow();
    expect(mockUsers[reg.userId].failedLoginAttempts).toBe(2);

    // 1 successful attempt resets counter
    const loginRes = await AuthService.login('charlie', 'mypassword123');
    expect(loginRes.token).toBeDefined();
    expect(mockUsers[reg.userId].failedLoginAttempts).toBe(0);
  });

  it('migrates legacy AES password to scrypt hash on successful login', async () => {
    const legacyEncrypted = EncryptionService.encrypt('legacyPass123');
    const legacyUser: UserDoc = {
      id: 'legacy-1',
      username: 'legacyuser',
      password: legacyEncrypted,
      email: 'legacy@example.com',
      displayName: 'Legacy',
      isActive: true,
      failedLoginAttempts: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockUsers['legacy-1'] = legacyUser;

    const res = await AuthService.login('legacyuser', 'legacyPass123');
    expect(res.token).toBeDefined();
    expect(mockUsers['legacy-1'].password.startsWith('scrypt:')).toBe(true);
  });

  it('enforces 2FA challenge flow when 2FA is enabled', async () => {
    const reg = await AuthService.register('dan', 'securepass123', 'dan@example.com', 'Dan');
    const setup = await AuthService.setup2FA(reg.userId);
    const validCode = TotpService.generateToken(setup.secret);

    // Confirm 2FA
    await AuthService.confirm2FA(reg.userId, setup.secret, validCode, setup.backupCodes);
    expect(mockUsers[reg.userId].twoFactorEnabled).toBe(true);

    // Login should return 2FA challenge instead of full token
    const loginRes = await AuthService.login('dan', 'securepass123');
    expect(loginRes.requires2FA).toBe(true);
    expect(loginRes.token).toBeUndefined();
    expect(loginRes.preAuthToken).toBeDefined();

    // Verify 2FA challenge
    const challengeCode = TotpService.generateToken(setup.secret);
    const verifyRes = await AuthService.verify2FALogin(loginRes.preAuthToken!, challengeCode);
    expect(verifyRes.token).toBeDefined();
    expect(verifyRes.userId).toBe(reg.userId);
  });

  it('allows login using 2FA backup recovery codes and burns them single-use', async () => {
    const reg = await AuthService.register('elena', 'securepass123', 'elena@example.com', 'Elena');
    const setup = await AuthService.setup2FA(reg.userId);
    const code = TotpService.generateToken(setup.secret);
    await AuthService.confirm2FA(reg.userId, setup.secret, code, setup.backupCodes);

    const loginRes = await AuthService.login('elena', 'securepass123');
    const backupCodeToUse = setup.backupCodes[0];

    // Login with backup recovery code
    const verifyRes = await AuthService.verify2FALogin(loginRes.preAuthToken!, backupCodeToUse);
    expect(verifyRes.token).toBeDefined();

    // Verify backup code was burned
    const storedBackupCodes = JSON.parse(mockUsers[reg.userId].twoFactorBackupCodes || '[]');
    expect(storedBackupCodes).toHaveLength(7);

    // Trying to reuse the same backup code fails
    const secondLogin = await AuthService.login('elena', 'securepass123');
    await expect(
      AuthService.verify2FALogin(secondLogin.preAuthToken!, backupCodeToUse)
    ).rejects.toThrow(/Invalid authentication code or backup recovery code/);
  });

  it('allows user to change password and updates tokenVersion', async () => {
    const reg = await AuthService.register('frank', 'oldpassword123', 'frank@example.com', 'Frank');

    // Wrong current password fails
    await expect(
      AuthService.changePassword(reg.userId, 'wrongpass', 'newpassword456')
    ).rejects.toThrow(/Current password is incorrect/);

    // Correct password succeeds and bumps tokenVersion
    const result = await AuthService.changePassword(reg.userId, 'oldpassword123', 'newpassword456');
    expect(result.success).toBe(true);
    expect(mockUsers[reg.userId].tokenVersion).toBe(2);

    // Can now log in with new password
    const loginRes = await AuthService.login('frank', 'newpassword456');
    expect(loginRes.token).toBeDefined();
  });
});

