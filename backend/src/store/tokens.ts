import { v4 as uuidv4 } from 'uuid';
import { findMany, findOne, insertDoc, updateById } from './documents';
import type { ApiTokenDoc } from './types';

export const Tokens = {
  async create(input: {
    userId: string;
    tokenName: string;
    tokenValue: string;
    tokenPrefix: string;
    expiresAt: string | null;
  }): Promise<ApiTokenDoc> {
    const now = new Date().toISOString();
    return insertDoc<ApiTokenDoc>('ApiToken', {
      id: uuidv4(),
      userId: input.userId,
      tokenName: input.tokenName,
      tokenValue: input.tokenValue,
      tokenPrefix: input.tokenPrefix,
      isActive: true,
      lastUsedAt: null,
      createdAt: now,
      expiresAt: input.expiresAt,
    });
  },
  async listByUser(userId: string): Promise<ApiTokenDoc[]> {
    return findMany<ApiTokenDoc>('ApiToken', { userId });
  },
  async findById(id: string): Promise<ApiTokenDoc | null> {
    return findOne<ApiTokenDoc>('ApiToken', { id });
  },
  async findByIdAndUser(id: string, userId: string): Promise<ApiTokenDoc | null> {
    return findOne<ApiTokenDoc>('ApiToken', { id, userId });
  },
  async findByHash(tokenValue: string): Promise<ApiTokenDoc | null> {
    return findOne<ApiTokenDoc>('ApiToken', { tokenValue, isActive: true });
  },
  async findByIds(userId: string, ids: string[]): Promise<ApiTokenDoc[]> {
    if (ids.length === 0) return [];
    return findMany<ApiTokenDoc>('ApiToken', { userId, id: { in: ids } });
  },
  async touchLastUsed(id: string): Promise<void> {
    await updateById('ApiToken', id, { lastUsedAt: new Date().toISOString() });
  },
  async revoke(id: string): Promise<void> {
    await updateById('ApiToken', id, { isActive: false });
  },
};
