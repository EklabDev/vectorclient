import { v4 as uuidv4 } from 'uuid';
import { deleteById, findMany, findOne, insertDoc, updateById } from './documents';
import type { SchemaDoc } from './types';

export const Schemas = {
  async listByUser(userId: string): Promise<SchemaDoc[]> {
    return findMany<SchemaDoc>('SchemaDoc', { userId });
  },
  async findById(id: string): Promise<SchemaDoc | null> {
    return findOne<SchemaDoc>('SchemaDoc', { id });
  },
  async findByIdAndUser(id: string, userId: string): Promise<SchemaDoc | null> {
    return findOne<SchemaDoc>('SchemaDoc', { id, userId });
  },
  async findByIds(userId: string, ids: string[]): Promise<SchemaDoc[]> {
    if (ids.length === 0) return [];
    return findMany<SchemaDoc>('SchemaDoc', { userId, id: { in: ids } });
  },
  async create(input: {
    userId: string;
    name: string;
    description: string | null;
    content: string;
    systemPrompt: string | null;
    isPublished: boolean;
  }): Promise<SchemaDoc> {
    const now = new Date().toISOString();
    return insertDoc<SchemaDoc>('SchemaDoc', {
      id: uuidv4(),
      userId: input.userId,
      name: input.name,
      description: input.description,
      content: input.content,
      systemPrompt: input.systemPrompt,
      version: 1,
      isPublished: input.isPublished,
      createdAt: now,
      updatedAt: now,
    });
  },
  async update(id: string, fields: Partial<SchemaDoc>): Promise<SchemaDoc | null> {
    return updateById<SchemaDoc>('SchemaDoc', id, { ...fields, updatedAt: new Date().toISOString() });
  },
  async remove(id: string): Promise<void> {
    await deleteById('SchemaDoc', id);
  },
};
