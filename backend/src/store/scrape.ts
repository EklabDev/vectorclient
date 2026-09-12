import { v4 as uuidv4 } from 'uuid';
import { parseMaybeJson } from '../arcade/sql';
import { deleteById, findMany, findOne, insertDoc, updateById } from './documents';
import type { ScrapeJobDoc, ScrapeSourceDoc } from './types';

function normalizeSource(row: ScrapeSourceDoc): ScrapeSourceDoc {
  const domains = Array.isArray(row.allowedDomains)
    ? row.allowedDomains
    : parseMaybeJson<string[]>(row.allowedDomains as unknown as string, []);
  return { ...row, allowedDomains: domains };
}

export const Scrape = {
  async listByUser(userId: string): Promise<ScrapeSourceDoc[]> {
    const rows = await findMany<ScrapeSourceDoc>('ScrapeSource', { userId }, { orderBy: 'createdAt', desc: true });
    return rows.map(normalizeSource);
  },
  async findById(id: string): Promise<ScrapeSourceDoc | null> {
    const row = await findOne<ScrapeSourceDoc>('ScrapeSource', { id });
    return row ? normalizeSource(row) : null;
  },
  async findByIdAndUser(id: string, userId: string): Promise<ScrapeSourceDoc | null> {
    const row = await findOne<ScrapeSourceDoc>('ScrapeSource', { id, userId });
    return row ? normalizeSource(row) : null;
  },
  async listActiveByUser(userId: string): Promise<ScrapeSourceDoc[]> {
    const rows = await findMany<ScrapeSourceDoc>('ScrapeSource', { userId, isActive: true });
    return rows.map(normalizeSource);
  },
  async create(input: Omit<ScrapeSourceDoc, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'lastCrawledAt' | 'lastError'>): Promise<ScrapeSourceDoc> {
    const now = new Date().toISOString();
    const row = await insertDoc<ScrapeSourceDoc>('ScrapeSource', {
      ...input,
      id: uuidv4(),
      status: 'idle',
      lastCrawledAt: null,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    });
    return normalizeSource(row);
  },
  async update(id: string, fields: Partial<ScrapeSourceDoc>): Promise<ScrapeSourceDoc | null> {
    const row = await updateById<ScrapeSourceDoc>('ScrapeSource', id, {
      ...fields,
      updatedAt: new Date().toISOString(),
    });
    return row ? normalizeSource(row) : null;
  },
  async remove(id: string): Promise<void> {
    await deleteById('ScrapeSource', id);
  },
  async createJob(sourceId: string): Promise<ScrapeJobDoc> {
    const now = new Date().toISOString();
    return insertDoc<ScrapeJobDoc>('ScrapeJob', {
      id: uuidv4(),
      sourceId,
      status: 'queued',
      pagesCrawled: 0,
      error: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    });
  },
  async updateJob(id: string, fields: Partial<ScrapeJobDoc>): Promise<void> {
    await updateById('ScrapeJob', id, fields);
  },
  async jobsForSource(sourceId: string): Promise<ScrapeJobDoc[]> {
    return findMany<ScrapeJobDoc>('ScrapeJob', { sourceId }, { orderBy: 'createdAt', desc: true, limit: 50 });
  },
};
