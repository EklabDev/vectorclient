import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_TOPIC_FILTER, type EndpointDoc, type TopicFilter } from './types';
import { parseMaybeJson } from '../arcade/sql';
import { countDocs, deleteById, deleteWhere, findMany, findOne, insertDoc, updateById } from './documents';

export type EndpointSchemaLink = { id: string; endpointId: string; schemaId: string; order: number };
export type EndpointTokenLink = { id: string; endpointId: string; apiTokenId: string };

export function parseTopicFilter(json: string | null | undefined): TopicFilter {
  const parsed = parseMaybeJson<Partial<TopicFilter>>(json, {});
  return {
    enabled: parsed.enabled ?? DEFAULT_TOPIC_FILTER.enabled,
    minSimilarity: parsed.minSimilarity ?? DEFAULT_TOPIC_FILTER.minSimilarity,
    offTopicReply: parsed.offTopicReply ?? DEFAULT_TOPIC_FILTER.offTopicReply,
  };
}

export const Endpoints = {
  async listByUser(userId: string): Promise<EndpointDoc[]> {
    const rows = await findMany<EndpointDoc>('Endpoint', { userId });
    return rows.map(normalizeEndpoint);
  },
  async findById(id: string): Promise<EndpointDoc | null> {
    const row = await findOne<EndpointDoc>('Endpoint', { id });
    return row ? normalizeEndpoint(row) : null;
  },
  async findByIdAndUser(id: string, userId: string): Promise<EndpointDoc | null> {
    const row = await findOne<EndpointDoc>('Endpoint', { id, userId });
    return row ? normalizeEndpoint(row) : null;
  },
  async findActive(id: string, userId: string): Promise<EndpointDoc | null> {
    const row = await findOne<EndpointDoc>('Endpoint', { id, userId, isActive: true });
    return row ? normalizeEndpoint(row) : null;
  },
  async findByRoute(userId: string, route: string): Promise<EndpointDoc | null> {
    const row = await findOne<EndpointDoc>('Endpoint', { userId, route });
    return row ? normalizeEndpoint(row) : null;
  },
  async findByRouteOnly(route: string): Promise<EndpointDoc | null> {
    const row = await findOne<EndpointDoc>('Endpoint', { route });
    return row ? normalizeEndpoint(row) : null;
  },
  async create(input: Omit<EndpointDoc, 'id' | 'createdAt' | 'updatedAt' | 'topicFilterJson' | 'route'> & {
    topicFilter?: TopicFilter;
    id?: string;
    route?: string;
  }): Promise<EndpointDoc> {
    const now = new Date().toISOString();
    const id = input.id || uuidv4();
    const { topicFilter, id: _id, ...rest } = input;
    const row = await insertDoc<EndpointDoc>('Endpoint', {
      ...rest,
      id,
      route: (typeof input.route === 'string' && input.route.trim()) || `internal://${id}`,
      allowedOrigins: input.allowedOrigins || [],
      topicFilterJson: JSON.stringify(topicFilter || DEFAULT_TOPIC_FILTER),
      createdAt: now,
      updatedAt: now,
    });
    return normalizeEndpoint(row);
  },
  async update(id: string, fields: Partial<EndpointDoc> & { topicFilter?: TopicFilter }): Promise<EndpointDoc | null> {
    const patch: Record<string, unknown> = { ...fields, updatedAt: new Date().toISOString() };
    if (fields.topicFilter) patch.topicFilterJson = JSON.stringify(fields.topicFilter);
    delete patch.topicFilter;
    const row = await updateById<EndpointDoc>('Endpoint', id, patch);
    return row ? normalizeEndpoint(row) : null;
  },
  async remove(id: string): Promise<void> {
    await deleteWhere('EndpointApiToken', { endpointId: id });
    await deleteWhere('EndpointSchema', { endpointId: id });
    await deleteById('Endpoint', id);
  },
  async tokenLinks(endpointId: string): Promise<EndpointTokenLink[]> {
    return findMany<EndpointTokenLink>('EndpointApiToken', { endpointId });
  },
  async schemaLinks(endpointId: string): Promise<EndpointSchemaLink[]> {
    return findMany<EndpointSchemaLink>('EndpointSchema', { endpointId }, { orderBy: 'order' });
  },
  async setTokenLinks(endpointId: string, tokenIds: string[]): Promise<void> {
    await deleteWhere('EndpointApiToken', { endpointId });
    for (const apiTokenId of tokenIds) {
      await insertDoc('EndpointApiToken', { id: uuidv4(), endpointId, apiTokenId });
    }
  },
  async addTokenLinks(endpointId: string, tokenIds: string[]): Promise<void> {
    const existing = await this.tokenLinks(endpointId);
    const have = new Set(existing.map((e) => e.apiTokenId));
    for (const apiTokenId of tokenIds) {
      if (have.has(apiTokenId)) continue;
      await insertDoc('EndpointApiToken', { id: uuidv4(), endpointId, apiTokenId });
    }
  },
  async removeTokenLink(endpointId: string, apiTokenId: string): Promise<void> {
    await deleteWhere('EndpointApiToken', { endpointId, apiTokenId });
  },
  async hasTokenLink(endpointId: string, apiTokenId: string): Promise<boolean> {
    const row = await findOne('EndpointApiToken', { endpointId, apiTokenId });
    return !!row;
  },
  async setSchemaLinks(endpointId: string, schemaIds: string[]): Promise<void> {
    await deleteWhere('EndpointSchema', { endpointId });
    for (let order = 0; order < schemaIds.length; order++) {
      await insertDoc('EndpointSchema', {
        id: uuidv4(),
        endpointId,
        schemaId: schemaIds[order],
        order,
      });
    }
  },
  async addSchemaLinks(endpointId: string, schemaIds: string[]): Promise<void> {
    const existing = await this.schemaLinks(endpointId);
    const have = new Set(existing.map((e) => e.schemaId));
    const maxOrder = existing.reduce((m, e) => Math.max(m, e.order ?? 0), -1);
    let order = maxOrder;
    for (const schemaId of schemaIds) {
      if (have.has(schemaId)) continue;
      order += 1;
      await insertDoc('EndpointSchema', { id: uuidv4(), endpointId, schemaId, order });
    }
  },
  async removeSchemaLink(endpointId: string, schemaId: string): Promise<void> {
    await deleteWhere('EndpointSchema', { endpointId, schemaId });
  },
  async count(): Promise<number> {
    return countDocs('Endpoint');
  },
};

function normalizeEndpoint(row: EndpointDoc): EndpointDoc {
  const origins = Array.isArray(row.allowedOrigins)
    ? row.allowedOrigins
    : parseMaybeJson<string[]>(row.allowedOrigins as unknown as string, []);
  return { ...row, allowedOrigins: origins };
}
