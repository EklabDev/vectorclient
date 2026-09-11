import { v4 as uuidv4 } from 'uuid';
import { command, query, withTransaction } from '../arcade/client';
import { knowledgeDbName } from '../arcade/config';
import { bootstrapKnowledgeDb } from '../arcade/bootstrap';
import { embedText, embedTexts } from './embeddingService';
import { ChunkingService, Chunk } from './chunkingService';
import { GraphExtractService, type ExtractedGraph } from './graphExtractService';
import type { KnowledgeChunk } from '../store/types';

export const KNOWLEDGE_LIST_MAX = 500;
export const KNOWLEDGE_SEARCH_MAX = 10;
export const KNOWLEDGE_SEARCH_QUERY_MAX = 4096;

function db(userId: string): string {
  return knowledgeDbName(userId);
}

function truncate(value: string | undefined | null, max = 50): string | undefined {
  if (value == null) return undefined;
  const t = value.trim();
  if (!t) return undefined;
  return t.length <= max ? t : t.slice(0, max);
}

export class ArcadeKnowledgeService {
  static async ensureDb(userId: string): Promise<string> {
    return bootstrapKnowledgeDb(userId);
  }

  static async replaceSchemaChunks(
    userId: string,
    schemaId: string,
    schemaName: string,
    content: string,
    version: number
  ): Promise<number> {
    await this.ensureDb(userId);
    const chunks = await ChunkingService.chunkContent(content);
    return this.replaceChunks(userId, { schemaId, schemaName, version, sourceType: 'schema' }, chunks);
  }

  static async replaceSourceChunks(
    userId: string,
    sourceId: string,
    sourceName: string,
    pages: Array<{ url: string; text: string }>
  ): Promise<number> {
    await this.ensureDb(userId);
    const all: Chunk[] = [];
    for (const page of pages) {
      const chunks = await ChunkingService.chunkContent(page.text || '');
      for (const c of chunks) {
        all.push({
          ...c,
          chunkIndex: all.length,
          originalReference: c.originalReference || page.url,
        });
      }
    }
    return this.replaceChunks(
      userId,
      { sourceId, schemaName: sourceName, sourceType: 'scrape', version: 1 },
      all
    );
  }

  static async replaceChunks(
    userId: string,
    meta: {
      schemaId?: string;
      sourceId?: string;
      schemaName: string;
      version: number;
      sourceType: 'schema' | 'scrape';
    },
    chunks: Chunk[]
  ): Promise<number> {
    const database = db(userId);
    const embeddings = chunks.length ? await embedTexts(chunks.map((c) => c.content)) : [];
    const sourceMeta = { sourceId: meta.schemaId || meta.sourceId };
    let extracted: ExtractedGraph = { entities: [], relationships: [] };
    try {
      extracted = await GraphExtractService.extractFromChunks(
        chunks.map((c) => ({ content: c.content })),
        sourceMeta
      );
    } catch (err) {
      console.error('Graph extract failed during ingest:', err);
    }

    await withTransaction(database, async () => {
      if (meta.schemaId) {
        await command(database, 'DELETE FROM Chunk WHERE schemaId = :schemaId', { schemaId: meta.schemaId });
      } else if (meta.sourceId) {
        await command(database, 'DELETE FROM Chunk WHERE sourceId = :sourceId', { sourceId: meta.sourceId });
      }
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        await command(
          database,
          `INSERT INTO Chunk SET id = :id, content = :content, originalReference = :originalReference,
           category = :category, subcategory = :subcategory, schemaId = :schemaId, sourceId = :sourceId,
           sourceType = :sourceType, chunkIndex = :chunkIndex, schemaName = :schemaName, version = :version,
           embedding = :embedding`,
          {
            id: uuidv4(),
            content: chunk.content,
            originalReference: chunk.originalReference,
            category: truncate(chunk.category) || null,
            subcategory: truncate(chunk.subcategory) || null,
            schemaId: meta.schemaId || null,
            sourceId: meta.sourceId || null,
            sourceType: meta.sourceType,
            chunkIndex: chunk.chunkIndex ?? i,
            schemaName: meta.schemaName,
            version: meta.version,
            embedding: embeddings[i],
          }
        );
      }
      await GraphExtractService.upsertExtracted(userId, extracted, sourceMeta);
    });
    return chunks.length;
  }

  static async deleteSchemaChunks(userId: string, schemaId: string): Promise<void> {
    await command(db(userId), 'DELETE FROM Chunk WHERE schemaId = :schemaId', { schemaId });
  }

  static async deleteSourceChunks(userId: string, sourceId: string): Promise<void> {
    await command(db(userId), 'DELETE FROM Chunk WHERE sourceId = :sourceId', { sourceId });
  }

  static async listChunks(userId: string, schemaId: string): Promise<{ objects: KnowledgeChunk[]; truncated: boolean }> {
    const rows = await query<KnowledgeChunk>(
      db(userId),
      'SELECT id, content, originalReference, schemaId, schemaName, version, chunkIndex, category, subcategory FROM Chunk WHERE schemaId = :schemaId ORDER BY chunkIndex ASC LIMIT :lim',
      { schemaId, lim: KNOWLEDGE_LIST_MAX + 1 }
    );
    const truncated = rows.length > KNOWLEDGE_LIST_MAX;
    return { objects: rows.slice(0, KNOWLEDGE_LIST_MAX), truncated };
  }

  static async countChunks(userId: string, schemaId?: string, sourceId?: string): Promise<number> {
    let sql = 'SELECT count(*) as count FROM Chunk WHERE 1 = 1';
    const params: Record<string, unknown> = {};
    if (schemaId) {
      sql += ' AND schemaId = :schemaId';
      params.schemaId = schemaId;
    }
    if (sourceId) {
      sql += ' AND sourceId = :sourceId';
      params.sourceId = sourceId;
    }
    const rows = await query<{ count?: number }>(db(userId), sql, params);
    return Number(rows[0]?.count ?? 0);
  }

  static async searchChunks(
    userId: string,
    queryText: string,
    mode: 'bm25' | 'vector' | 'hybrid',
    limit = KNOWLEDGE_SEARCH_MAX,
    opts: { schemaId?: string; sourceId?: string; category?: string } = {}
  ): Promise<KnowledgeChunk[]> {
    const database = db(userId);
    const filters: string[] = [];
    const params: Record<string, unknown> = { lim: limit };
    if (opts.schemaId) {
      filters.push('schemaId = :schemaId');
      params.schemaId = opts.schemaId;
    }
    if (opts.sourceId) {
      filters.push('sourceId = :sourceId');
      params.sourceId = opts.sourceId;
    }
    if (opts.category) {
      filters.push('category = :category');
      params.category = opts.category;
    }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    if (mode === 'bm25') {
      params.q = queryText;
      return query<KnowledgeChunk>(
        database,
        `SELECT id, content, originalReference, schemaId, schemaName, version, chunkIndex, category, subcategory FROM Chunk ${where ? where + ' AND' : 'WHERE'} content CONTAINS TEXT :q LIMIT :lim`,
        params
      );
    }

    const embedding = await embedText(queryText);
    params.vec = embedding;
    const vectorSql = `SELECT id, content, originalReference, schemaId, schemaName, version, chunkIndex, category, subcategory, vector.cosineSimilarity(embedding, :vec) as score FROM Chunk ${where} ORDER BY score DESC LIMIT :lim`;
    const vectorHits = await query<KnowledgeChunk>(database, vectorSql, params);
    if (mode === 'vector') return vectorHits;

    params.q = queryText;
    const textHits = await query<KnowledgeChunk>(
      database,
      `SELECT id, content, originalReference, schemaId, schemaName, version, chunkIndex, category, subcategory FROM Chunk ${where ? where + ' AND' : 'WHERE'} content CONTAINS TEXT :q LIMIT :lim`,
      params
    );
    const seen = new Set<string>();
    const merged: KnowledgeChunk[] = [];
    for (const hit of [...vectorHits, ...textHits]) {
      if (!hit.id || seen.has(hit.id)) continue;
      seen.add(hit.id);
      merged.push(hit);
      if (merged.length >= limit) break;
    }
    return merged;
  }

  static async maxSimilarity(userId: string, queryText: string, schemaIds: string[]): Promise<number> {
    if (schemaIds.length === 0) return 0;
    const embedding = await embedText(queryText);
    const rows = await query<{ score?: number }>(
      db(userId),
      `SELECT vector.cosineSimilarity(embedding, :vec) as score FROM Chunk WHERE schemaId IN [${schemaIds.map((_, i) => `:s${i}`).join(', ')}] ORDER BY score DESC LIMIT 1`,
      Object.fromEntries([['vec', embedding], ...schemaIds.map((id, i) => [`s${i}`, id])])
    );
    return Number(rows[0]?.score ?? 0);
  }

  static async createChunk(
    userId: string,
    schemaId: string,
    schemaName: string,
    version: number,
    input: { content: string; originalReference?: string; category?: string; subcategory?: string }
  ): Promise<{ id: string; chunkIndex: number }> {
    const next = await this.getNextChunkIndex(userId, schemaId);
    const id = uuidv4();
    const embedding = await embedText(input.content);
    await command(
      db(userId),
      `INSERT INTO Chunk SET id = :id, content = :content, originalReference = :originalReference,
       category = :category, subcategory = :subcategory, schemaId = :schemaId, sourceType = :sourceType,
       chunkIndex = :chunkIndex, schemaName = :schemaName, version = :version, embedding = :embedding`,
      {
        id,
        content: input.content,
        originalReference: input.originalReference || input.content,
        category: truncate(input.category) || null,
        subcategory: truncate(input.subcategory) || null,
        schemaId,
        sourceType: 'schema',
        chunkIndex: next,
        schemaName,
        version,
        embedding,
      }
    );
    return { id, chunkIndex: next };
  }

  static async patchChunk(
    userId: string,
    objectId: string,
    fields: { content?: string; category?: string; subcategory?: string }
  ): Promise<void> {
    const sets: string[] = [];
    const params: Record<string, unknown> = { id: objectId };
    if (fields.content !== undefined) {
      sets.push('content = :content');
      params.content = fields.content;
      params.embedding = await embedText(fields.content);
      sets.push('embedding = :embedding');
    }
    if (fields.category !== undefined) {
      sets.push('category = :category');
      params.category = truncate(fields.category) || null;
    }
    if (fields.subcategory !== undefined) {
      sets.push('subcategory = :subcategory');
      params.subcategory = truncate(fields.subcategory) || null;
    }
    if (sets.length === 0) return;
    await command(db(userId), `UPDATE Chunk SET ${sets.join(', ')} WHERE id = :id`, params);
  }

  static async deleteChunk(userId: string, objectId: string): Promise<void> {
    await command(db(userId), 'DELETE FROM Chunk WHERE id = :id', { id: objectId });
  }

  static async getNextChunkIndex(userId: string, schemaId: string): Promise<number> {
    const rows = await query<{ max?: number }>(
      db(userId),
      'SELECT max(chunkIndex) as max FROM Chunk WHERE schemaId = :schemaId',
      { schemaId }
    );
    return Number(rows[0]?.max ?? -1) + 1;
  }
}
