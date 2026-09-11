import { v4 as uuidv4 } from 'uuid';
import { countDocs, findMany, insertDoc } from './documents';
import type { CallLogDoc } from './types';
import type { Where } from '../arcade/sql';

export type LogQuery = {
  endpointId?: string;
  apiTokenId?: string;
  status?: number;
  method?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
};

export const Logs = {
  async insert(input: Omit<CallLogDoc, 'id' | 'createdAt'> & { id?: string }): Promise<void> {
    await insertDoc('CallLog', {
      id: input.id || uuidv4(),
      ...input,
      createdAt: new Date().toISOString(),
    });
  },
  async list(q: LogQuery): Promise<{ logs: CallLogDoc[]; total: number }> {
    const page = q.page || 1;
    const limit = Math.min(q.limit || 50, 500);
    const offset = (page - 1) * limit;
    const where: Where = {};
    if (q.endpointId) where.endpointId = q.endpointId;
    if (q.apiTokenId) where.apiTokenId = q.apiTokenId;
    if (q.status != null) where.status = q.status;
    if (q.method) where.method = q.method;
    if (q.startDate || q.endDate) {
      where.createdAt = { gte: q.startDate, lte: q.endDate };
    }
    const sortBy = ['responseTime', 'status', 'createdAt'].includes(q.sortBy || '')
      ? q.sortBy!
      : 'createdAt';
    const logs = await findMany<CallLogDoc>('CallLog', where, {
      orderBy: sortBy,
      desc: q.sortOrder !== 'asc',
      limit,
      offset,
    });
    const total = await countDocs('CallLog', where);
    return { logs, total };
  },
  async countSince(endpointIds: string[], iso: string): Promise<number> {
    if (endpointIds.length === 0) return 0;
    return countDocs('CallLog', { endpointId: { in: endpointIds }, createdAt: { gte: iso } });
  },
};
