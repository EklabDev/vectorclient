import * as jsonwebtoken from 'jsonwebtoken';
import { EncryptionService } from '../utils/encryption';
import { Users } from '../store/users';
import { bootstrapKnowledgeDb } from '../arcade/bootstrap';

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
    const existing = await Users.findByUsername(username);
    if (existing) throw new Error('Username already exists');

    const user = await Users.create({
      username,
      password: EncryptionService.encrypt(password),
      email,
      displayName,
    });
    await bootstrapKnowledgeDb(user.id);
    return { userId: user.id, token: this.generateToken({ userId: user.id, username }) };
  }

  static async login(username: string, password: string): Promise<{ userId: string; token: string }> {
    const user = await Users.findByUsername(username);
    if (!user) throw new Error('Invalid credentials');
    try {
      if (EncryptionService.decrypt(user.password) !== password) {
        throw new Error('Invalid credentials');
      }
    } catch {
      throw new Error('Invalid credentials');
    }
    return {
      userId: user.id,
      token: this.generateToken({ userId: user.id, username: user.username }),
    };
  }

  static generateToken(payload: AuthPayload): string {
    return jsonwebtoken.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: '24h' });
  }

  static verifyToken(token: string): AuthPayload | null {
    try {
      return jsonwebtoken.verify(token, process.env.JWT_SECRET || 'secret') as AuthPayload;
    } catch {
      return null;
    }
  }
}
