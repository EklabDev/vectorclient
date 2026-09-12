import { describe, it, expect, vi, beforeEach } from 'vitest';

const searchChunks = vi.fn();

vi.mock('../../arcadeKnowledgeService', () => ({
  KNOWLEDGE_SEARCH_MAX: 10,
  ArcadeKnowledgeService: {
    searchChunks: (...args: unknown[]) => searchChunks(...args),
  },
}));

describe('searchKnowledgeTool', () => {
  beforeEach(() => {
    searchChunks.mockReset();
  });

  it('searches only allowlisted collections', async () => {
    const { searchKnowledgeTool } = await import('./knowledgeTool');
    searchChunks.mockResolvedValue([{ id: '1', content: 'Robotics on Saturday', category: 'Program', score: 0.9 }]);

    const result = (await searchKnowledgeTool.execute(
      { query: 'robotics schedule', mode: 'hybrid' },
      {
        userId: 'user-1',
        endpointId: 'ep-1',
        conversationId: 'conv-1',
        collections: [
          {
            schemaId: 'schema-a',
            schemaName: 'Main',
            className: 'schema-a',
            systemPrompt: null,
            sourceType: 'schema',
          },
        ],
      }
    )) as { results: Array<{ schema_id: string }> };

    expect(searchChunks).toHaveBeenCalledWith('user-1', 'robotics schedule', 'hybrid', 10, {
      schemaId: 'schema-a',
      sourceId: undefined,
      category: undefined,
    });
    expect(result.results).toHaveLength(1);
    expect(result.results[0].schema_id).toBe('schema-a');
  });

  it('rejects schema_id outside the allowlist', async () => {
    const { searchKnowledgeTool } = await import('./knowledgeTool');
    await expect(
      searchKnowledgeTool.execute(
        { query: 'x', schema_id: 'other-schema' },
        {
          userId: 'user-1',
          endpointId: 'ep-1',
          conversationId: 'conv-1',
          collections: [
            {
              schemaId: 'schema-a',
              schemaName: 'Main',
              className: 'schema-a',
              systemPrompt: null,
              sourceType: 'schema',
            },
          ],
        }
      )
    ).rejects.toThrow(/not linked/);
    expect(searchChunks).not.toHaveBeenCalled();
  });
});
