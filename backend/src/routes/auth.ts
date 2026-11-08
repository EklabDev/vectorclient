import { FastifyInstance } from 'fastify';
import { AuthService } from '../services/authService';
import { authenticate } from '../middleware/auth';
import { authRateLimitMiddleware } from '../middleware/rateLimit';
import { verifyTurnstileToken } from '../utils/turnstile';
import { z } from 'zod';

const registerSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(8),
  email: z.string().email(),
  displayName: z.string().min(2),
  turnstileToken: z.string().optional().nullable(),
});

const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
  turnstileToken: z.string().optional().nullable(),
});

const verify2FASchema = z.object({
  preAuthToken: z.string().min(1),
  code: z.string().min(4).max(12),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

const confirm2FASchema = z.object({
  secret: z.string().min(16),
  code: z.string().length(6),
  backupCodes: z.array(z.string()).min(1),
});

const disable2FASchema = z.object({
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance) {
  // Public runtime auth configuration (e.g. Turnstile public site key)
  app.get('/config', async () => {
    const siteKey =
      process.env.CLOUDFLARE_TURNSTILE_SITE_KEY?.trim() ||
      '1x00000000000000000000AA';
    const isConfigured = Boolean(
      process.env.CLOUDFLARE_TURNSTILE_SITE_KEY?.trim() &&
        process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY?.trim()
    );

    return {
      turnstileSiteKey: siteKey,
      turnstileConfigured: isConfigured,
    };
  });

  // Register with rate limiting and optional Cloudflare Turnstile
  app.post('/register', { preHandler: authRateLimitMiddleware }, async (request, reply) => {
    try {
      const body = registerSchema.parse(request.body);

      // Verify Turnstile if token is provided or required
      const turnstile = await verifyTurnstileToken(body.turnstileToken, request.ip);
      if (!turnstile.success) {
        reply.code(400).send({ message: turnstile.error || 'Captcha verification failed' });
        return;
      }

      const result = await AuthService.register(
        body.username,
        body.password,
        body.email,
        body.displayName
      );
      return result;
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.code(400).send({ message: 'Validation error', errors: error.flatten().fieldErrors });
        return;
      }
      reply.code(400).send({ message: (error as Error).message });
    }
  });

  // Login with rate limiting, lockout check, and Turnstile
  app.post('/login', { preHandler: authRateLimitMiddleware }, async (request, reply) => {
    try {
      const body = loginSchema.parse(request.body);

      // Verify Turnstile if token is provided or required
      const turnstile = await verifyTurnstileToken(body.turnstileToken, request.ip);
      if (!turnstile.success) {
        reply.code(400).send({ message: turnstile.error || 'Captcha verification failed' });
        return;
      }

      // Secure: Plaintext passwords are NEVER printed to stdout or logs
      const result = await AuthService.login(body.username, body.password);
      return result;
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.code(400).send({ message: 'Validation error', errors: error.flatten().fieldErrors });
        return;
      }
      const message = (error as Error).message;
      const status = message.includes('locked') ? 423 : 401;
      reply.code(status).send({ message });
    }
  });

  // Complete 2FA login challenge with TOTP code or backup recovery code
  app.post('/2fa/verify', { preHandler: authRateLimitMiddleware }, async (request, reply) => {
    try {
      const body = verify2FASchema.parse(request.body);
      const result = await AuthService.verify2FALogin(body.preAuthToken, body.code);
      return result;
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.code(400).send({ message: 'Validation error', errors: error.flatten().fieldErrors });
        return;
      }
      const message = (error as Error).message;
      const status = message.includes('locked') ? 423 : 401;
      reply.code(status).send({ message });
    }
  });

  // Authenticated Profile Endpoint
  app.get('/profile', { preHandler: authenticate }, async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const profile = await AuthService.getProfile(userId);
      return profile;
    } catch (error) {
      reply.code(500).send({ message: (error as Error).message });
    }
  });

  // Change Password
  app.post(
    '/change-password',
    { preHandler: [authenticate, authRateLimitMiddleware] },
    async (request, reply) => {
      try {
        const { userId } = request.user as { userId: string };
        const body = changePasswordSchema.parse(request.body);
        const result = await AuthService.changePassword(
          userId,
          body.currentPassword,
          body.newPassword
        );
        return result;
      } catch (error) {
        if (error instanceof z.ZodError) {
          reply.code(400).send({ message: 'Validation error', errors: error.flatten().fieldErrors });
          return;
        }
        reply.code(400).send({ message: (error as Error).message });
      }
    }
  );

  // 2FA Setup / Regenerate: generates secret, QR code data URL, and backup codes
  app.post('/2fa/setup', { preHandler: authenticate }, async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const setup = await AuthService.setup2FA(userId);
      return setup;
    } catch (error) {
      reply.code(500).send({ message: (error as Error).message });
    }
  });

  // Confirm and activate 2FA
  app.post('/2fa/confirm', { preHandler: authenticate }, async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const body = confirm2FASchema.parse(request.body);
      const result = await AuthService.confirm2FA(
        userId,
        body.secret,
        body.code,
        body.backupCodes
      );
      return result;
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.code(400).send({ message: 'Validation error', errors: error.flatten().fieldErrors });
        return;
      }
      reply.code(400).send({ message: (error as Error).message });
    }
  });

  // Disable 2FA with current password confirmation
  app.post('/2fa/disable', { preHandler: authenticate }, async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const body = disable2FASchema.parse(request.body);
      const result = await AuthService.disable2FA(userId, body.password);
      return result;
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.code(400).send({ message: 'Validation error', errors: error.flatten().fieldErrors });
        return;
      }
      reply.code(400).send({ message: (error as Error).message });
    }
  });
}
