import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setArcadeFetch } from '../arcade/client';
import { ArcadeKnowledgeService } from './arcadeKnowledgeService';

vi.mock('../arcade/bootstrap', () => ({
  bootstrapKnowledgeDb: vi.fn(async () => 'kbtest'),
}));

vi.mock('./chunkingService', () => ({
  ChunkingService: {
    chunkContent: vi.fn(async () => [
      { content: 'Robotics on Saturday', originalReference: 'Robotics on Saturday', chunkIndex: 0, category: 'Program' },
    ]),
  },
}));

vi.mock('./embeddingService', () => ({
  embedTexts: vi.fn(async (texts: string[]) => texts.map(() => [0.1, 0.2, 0.3])),
  embedText: vi.fn(async () => [0.1, 0.2, 0.3]),
}));

vi.mock('./graphExtractService', () => ({
  GraphExtractService: {
    extractFromChunks: vi.fn(async () => ({
      entities: [{ type: 'Program', name: 'Robotics', props: {} }],
      relationships: [],
    })),
    upsertExtracted: vi.fn(async () => ({ entities: 1, relationships: 0 })),
  },
}));

describe('ArcadeKnowledgeService.replaceChunks', () => {
  const inserted: Record<string, unknown>[] = [];
  const urls: string[] = [];

  beforeEach(() => {
    inserted.length = 0;
    urls.length = 0;
    setArcadeFetch(async (url, init) => {
      urls.push(String(url));
      if (String(url).includes('/begin/')) {
        return new Response('{}', { status: 200, headers: { 'arcadedb-session-id': 'sess-1' } });
      }
      if (String(url).includes('/commit/') || String(url).includes('/rollback/')) {
        return new Response('{}', { status: 200 });
      }
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      const command: string = body.command || '';
      if (command.startsWith('DELETE') || command.startsWith('CREATE') || command.startsWith('SELECT')) {
        return new Response(JSON.stringify({ result: [] }), { status: 200 });
      }
      if (command.startsWith('INSERT')) {
        inserted.push(body.params || {});
        return new Response(JSON.stringify({ result: [] }), { status: 200 });
      }
      return new Response(JSON.stringify({ result: [] }), { status: 200 });
    });
  });

  it('writes chunk vertices with embeddings inside a transaction', async () => {
    const { GraphExtractService } = await import('./graphExtractService');
    const count = await ArcadeKnowledgeService.replaceSchemaChunks(
      '11111111-1111-1111-1111-111111111111',
      'schema-1',
      'Main',
      'Robotics on Saturday',
      1
    );
    expect(count).toBe(1);
    expect(inserted[0].content).toBe('Robotics on Saturday');
    expect(inserted[0].schemaId).toBe('schema-1');
    expect(Array.isArray(inserted[0].embedding)).toBe(true);
    expect(urls.some((u) => u.includes('/begin/'))).toBe(true);
    expect(urls.some((u) => u.includes('/commit/'))).toBe(true);
    expect(GraphExtractService.upsertExtracted).toHaveBeenCalled();
  });
});
