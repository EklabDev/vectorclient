import { describe, it, expect, vi, beforeEach } from 'vitest';

const searchChunkObjects = vi.fn();

vi.mock('../../weaviateService', () => ({
  WEAVIATE_SEARCH_MAX: 10,
  WeaviateService: {
    searchChunkObjects: (...args: unknown[]) => searchChunkObjects(...args),
  },
}));

describe('searchKnowledgeTool', () => {
  beforeEach(() => {
    searchChunkObjects.mockReset();
  });

  it('searches only allowlisted collections', async () => {
    const { searchKnowledgeTool } = await import('./weaviateTool');
    searchChunkObjects.mockResolvedValue([
      {
        id: '1',
        content: 'Robotics on Saturday',
        category: 'Program',
        score: 0.9,
      },
    ]);

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
            className: 'Schema_a',
            systemPrompt: null,
            sourceType: 'schema',
          },
        ],
      }
    )) as { results: Array<{ schema_id: string }> };

    expect(searchChunkObjects).toHaveBeenCalledWith(
      'Schema_a',
      'robotics schedule',
      'hybrid',
      10,
      undefined
    );
    expect(result.results).toHaveLength(1);
    expect(result.results[0].schema_id).toBe('schema-a');
  });

  it('rejects schema_id outside the allowlist', async () => {
    const { searchKnowledgeTool } = await import('./weaviateTool');

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
              className: 'Schema_a',
              systemPrompt: null,
              sourceType: 'schema',
            },
          ],
        }
      )
    ).rejects.toThrow(/not linked/);

    expect(searchChunkObjects).not.toHaveBeenCalled();
  });
});
