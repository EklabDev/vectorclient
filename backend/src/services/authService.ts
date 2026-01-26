import jwt from '@fastify/jwt';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { users } from '../database/schema';
import { eq } from 'drizzle-orm';
import { EncryptionService } from '../utils/encryption';
// @ts-ignore - Importing just for type usage or assuming global jwt for now, but will fix in real implementation
// Actually, I need to use the fastify-jwt instance or a standalone jwt library if I want to sign manually outside a request context easily,
// but the guide uses `jwt.sign` which implies `jsonwebtoken` library or usage of fastify-jwt's decoration.
// The guide shows `import jwt from '@fastify/jwt';` but `@fastify/jwt` exports a plugin function, not a `sign` method directly on default export.
// It seems the guide example might be slightly pseudo-code or expecting `jsonwebtoken`.
// I'll stick to `jsonwebtoken` for the service to avoid fastify dependency here if possible, or correct the usage.
// Let's use `jsonwebtoken` for simplicity in service if `@fastify/jwt` is only for route decoration.
// Wait, `backend/package.json` only has `@fastify/jwt`.
// If I use `@fastify/jwt`, I usually access it via `fastify.jwt.sign`.
// The guide says:
// static generateToken(payload: AuthPayload): string {
//   // This should be called by Fastify's sign method
//   // But for demo purposes:
//   return jwt.sign(payload, process.env.JWT_SECRET || 'secret', {
//     expiresIn: '24h',
//   });
// }
// This definitely looks like `jsonwebtoken` syntax. I will install `jsonwebtoken` to match the guide's logic or adapt it.
// I'll adapt it to use `fastify.jwt.sign` if I pass the fastify instance, BUT `AuthService` is a static class.
// I will install `jsonwebtoken` to make this service independent.

import * as jsonwebtoken from 'jsonwebtoken';

interface AuthPayload {
  userId: string;
  username: string;
}

export class AuthService {
  static async register(
    username: string,
    password: string,
    email: string,
    displayName: string
  ): Promise<{ userId: string; token: string }> {
    // Check if user exists
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (existing.length > 0) {
      throw new Error('Username already exists');
    }

    // Encrypt password
    const encryptedPassword = EncryptionService.encrypt(password);

    const userId = uuidv4();

    // Insert user
    await db.insert(users).values({
      id: userId,
      username,
      password: encryptedPassword,
      email,
      displayName,
    });

    const token = this.generateToken({ userId, username });

    return { userId, token };
  }

  static async login(username: string, password: string): Promise<{ userId: string; token: string }> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (!user) {
      throw new Error('Invalid credentials');
    }
    // Decrypt and verify password
    try {
      const decryptedPassword = EncryptionService.decrypt(user.password);
      if (decryptedPassword !== password) {
        throw new Error('Invalid credentials');
      }
    } catch (error) {
      throw new Error('Invalid credentials');
    }

    const token = this.generateToken({ userId: user.id, username: user.username });

    return { userId: user.id, token };
  }

  static generateToken(payload: AuthPayload): string {
    return jsonwebtoken.sign(payload, process.env.JWT_SECRET || 'secret', {
      expiresIn: '24h',
    });
  }

  static verifyToken(token: string): AuthPayload | null {
    try {
      return jsonwebtoken.verify(token, process.env.JWT_SECRET || 'secret') as AuthPayload;
    } catch {
      return null;
    }
  }
}
