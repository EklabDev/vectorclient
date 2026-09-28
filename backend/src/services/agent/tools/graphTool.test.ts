import { describe, it, expect, vi, beforeEach } from 'vitest';

const getEntity = vi.fn();
const findRelated = vi.fn();

vi.mock('../../arcadeGraphService', () => ({
  ArcadeGraphService: {
    isEnabled: () => true,
    getEntity: (...args: unknown[]) => getEntity(...args),
    findRelated: (...args: unknown[]) => findRelated(...args),
  },
}));

describe('graph tools', () => {
  beforeEach(() => {
    getEntity.mockReset();
    findRelated.mockReset();
  });

  it('looks up entities scoped to userId', async () => {
    getEntity.mockResolvedValue({ name: 'EKLAB', type: 'Organization' });
    findRelated.mockResolvedValue([
      { type: 'Program', name: 'AI & automation', relationship: 'OFFERS' },
    ]);
    const { graphGetEntityTool } = await import('./graphTool');
    const result = await graphGetEntityTool.execute(
      { type: 'Organization', name: 'eklab' },
      { userId: 'user-1', endpointId: 'ep', conversationId: 'c', collections: [] }
    );
    expect(getEntity).toHaveBeenCalledWith('user-1', 'Organization', 'eklab');
    expect(findRelated).toHaveBeenCalledWith('user-1', 'Organization', 'eklab');
    expect(result).toEqual({
      entity: { name: 'EKLAB', type: 'Organization' },
      related: [{ type: 'Program', name: 'AI & automation', relationship: 'OFFERS' }],
    });
  });

  it('rejects invalid entity types', async () => {
    const { graphGetEntityTool } = await import('./graphTool');
    await expect(
      graphGetEntityTool.execute(
        { type: 'Hacker', name: 'x' },
        { userId: 'user-1', endpointId: 'ep', conversationId: 'c', collections: [] }
      )
    ).rejects.toThrow(/Invalid entity type/);
  });
});
