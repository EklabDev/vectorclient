import { v4 as uuidv4 } from 'uuid';
import { findMany, findOne, insertDoc, updateById } from './documents';
import type { UserDoc } from './types';

export const Users = {
  async findByUsername(username: string): Promise<UserDoc | null> {
    return findOne<UserDoc>('User', { username });
  },
  async findById(id: string): Promise<UserDoc | null> {
    return findOne<UserDoc>('User', { id });
  },
  async create(input: {
    username: string;
    password: string;
    email: string;
    displayName: string;
  }): Promise<UserDoc> {
    const now = new Date().toISOString();
    return insertDoc<UserDoc>('User', {
      id: uuidv4(),
      username: input.username,
      password: input.password,
      email: input.email,
      displayName: input.displayName,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
  async list(): Promise<UserDoc[]> {
    return findMany<UserDoc>('User');
  },
  async update(id: string, fields: Partial<UserDoc>): Promise<UserDoc | null> {
    return updateById<UserDoc>('User', id, fields);
  },
};
