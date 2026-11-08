import { describe, it, expect } from 'vitest';
import { TotpService } from './totp';

describe('TotpService', () => {
  it('generates a 32-character base32 secret', () => {
    const secret = TotpService.generateSecret();
    expect(secret).toHaveLength(32);
    expect(/^[A-Z2-7]+$/.test(secret)).toBe(true);
  });

  it('generates and verifies valid TOTP tokens', () => {
    const secret = TotpService.generateSecret();
    const token = TotpService.generateToken(secret);
    expect(token).toHaveLength(6);
    expect(TotpService.verifyToken(token, secret)).toBe(true);
  });

  it('rejects invalid or wrong tokens', () => {
    const secret = TotpService.generateSecret();
    expect(TotpService.verifyToken('000000', secret)).toBe(false);
    expect(TotpService.verifyToken('123', secret)).toBe(false);
    expect(TotpService.verifyToken('abcdef', secret)).toBe(false);
  });

  it('generates otpauth URL correctly', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const url = TotpService.generateOtpAuthUrl('EKLab VectorClient', 'testuser', secret);
    expect(url).toContain('otpauth://totp/');
    expect(url).toContain('testuser');
    expect(url).toContain(secret);
  });

  it('generates and verifies backup codes', () => {
    const { plainCodes, hashedCodes } = TotpService.generateBackupCodes(8);
    expect(plainCodes).toHaveLength(8);
    expect(hashedCodes).toHaveLength(8);

    const first = plainCodes[0];
    const result1 = TotpService.verifyBackupCode(first, hashedCodes);
    expect(result1.valid).toBe(true);
    expect(result1.remainingHashedCodes).toHaveLength(7);

    // Cannot reuse the same code
    const result2 = TotpService.verifyBackupCode(first, result1.remainingHashedCodes);
    expect(result2.valid).toBe(false);
  });

  it('generates QR code data URL', async () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const url = TotpService.generateOtpAuthUrl('EKLab VectorClient', 'testuser', secret);
    const dataUrl = await TotpService.generateQrCodeDataUrl(url);
    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);
  });
});

