import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyTurnstileToken } from './turnstile';

describe('Turnstile Verification', () => {
  const originalEnv = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;

  afterEach(() => {
    process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY = originalEnv;
    vi.restoreAllMocks();
  });

  it('bypasses verification when CLOUDFLARE_TURNSTILE_SECRET_KEY is not set', async () => {
    delete process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;
    const result = await verifyTurnstileToken();
    expect(result.success).toBe(true);
  });

  it('fails if secret key is configured but no token is passed', async () => {
    process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY = '1x0000000000000000000000000000000AA';
    const result = await verifyTurnstileToken(null);
    expect(result.success).toBe(false);
    expect(result.error).toContain('token is required');
  });

  it('succeeds when Cloudflare siteverify returns success', async () => {
    process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY = '1x0000000000000000000000000000000AA';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const result = await verifyTurnstileToken('valid-token', '1.2.3.4');
    expect(result.success).toBe(true);
  });

  it('fails when Cloudflare siteverify returns success: false', async () => {
    process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY = '1x0000000000000000000000000000000AA';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: false,
        'error-codes': ['invalid-input-response'],
      }),
    });

    const result = await verifyTurnstileToken('bad-token');
    expect(result.success).toBe(false);
    expect(result.error).toContain('invalid-input-response');
  });
});

