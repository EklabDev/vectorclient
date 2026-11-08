import crypto from 'crypto';
import QRCode from 'qrcode';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function base32Decode(input: string): Buffer {
  const cleanInput = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < cleanInput.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleanInput[i]);
    if (idx === -1) continue;

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

export class TotpService {
  /**
   * Generates a 20-byte cryptographically secure random base32 secret (32 chars)
   */
  static generateSecret(): string {
    const bytes = crypto.randomBytes(20);
    return base32Encode(bytes);
  }

  /**
   * Generates a single TOTP code for a specific window
   */
  static generateToken(secret: string, windowOffset = 0): string {
    const key = base32Decode(secret);
    const epoch = Math.floor(Date.now() / 1000);
    const counter = Math.floor(epoch / 30) + windowOffset;

    const buffer = Buffer.alloc(8);
    buffer.writeBigInt64BE(BigInt(counter));

    const hmac = crypto.createHmac('sha1', key).update(buffer).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);

    const otp = binary % 1000000;
    return otp.toString().padStart(6, '0');
  }

  /**
   * Verifies a 6-digit TOTP code allowing +/- 1 window (30 seconds clock drift)
   */
  static verifyToken(token: string, secret: string): boolean {
    if (!token || !secret) return false;
    const cleanToken = token.trim();
    if (cleanToken.length !== 6 || !/^\d{6}$/.test(cleanToken)) return false;

    // Check current, previous, and next 30-second windows
    for (let offset = -1; offset <= 1; offset++) {
      const generated = this.generateToken(secret, offset);
      if (crypto.timingSafeEqual(Buffer.from(generated), Buffer.from(cleanToken))) {
        return true;
      }
    }
    return false;
  }

  /**
   * Generates an otpauth:// URL for authenticator apps
   */
  static generateOtpAuthUrl(issuer: string, accountName: string, secret: string): string {
    const encIssuer = encodeURIComponent(issuer);
    const encAccount = encodeURIComponent(accountName);
    return `otpauth://totp/${encIssuer}:${encAccount}?secret=${secret}&issuer=${encIssuer}&algorithm=SHA1&digits=6&period=30`;
  }

  /**
   * Generates a base64 Data URL for the QR code
   */
  static async generateQrCodeDataUrl(otpauthUrl: string): Promise<string> {
    return QRCode.toDataURL(otpauthUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 250,
      color: {
        dark: '#111827',
        light: '#ffffff',
      },
    });
  }

  /**
   * Generates 8 random single-use backup recovery codes
   */
  static generateBackupCodes(count = 8): { plainCodes: string[]; hashedCodes: string[] } {
    const plainCodes: string[] = [];
    const hashedCodes: string[] = [];

    for (let i = 0; i < count; i++) {
      const p1 = crypto.randomBytes(2).toString('hex');
      const p2 = crypto.randomBytes(2).toString('hex');
      const code = `${p1}-${p2}`;
      plainCodes.push(code);
      hashedCodes.push(crypto.createHash('sha256').update(code.toLowerCase().trim()).digest('hex'));
    }

    return { plainCodes, hashedCodes };
  }

  /**
   * Verifies and burns a backup code
   */
  static verifyBackupCode(
    inputCode: string,
    storedHashedCodes: string[]
  ): { valid: boolean; remainingHashedCodes: string[] } {
    const inputHash = crypto.createHash('sha256').update(inputCode.toLowerCase().trim()).digest('hex');
    const index = storedHashedCodes.indexOf(inputHash);

    if (index === -1) {
      return { valid: false, remainingHashedCodes: storedHashedCodes };
    }

    const remainingHashedCodes = [...storedHashedCodes];
    remainingHashedCodes.splice(index, 1);
    return { valid: true, remainingHashedCodes };
  }
}

