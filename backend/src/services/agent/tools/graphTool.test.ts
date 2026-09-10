import { describe, it, expect, vi, beforeEach } from 'vitest';

const getEntity = vi.fn();
const findRelated = vi.fn();

vi.mock('../../neo4jService', () => ({
  Neo4jService: {
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
    getEntity.mockResolvedValue({ name: 'Robotics', type: 'Program' });
    const { graphGetEntityTool } = await import('./graphTool');
    const result = await graphGetEntityTool.execute(
      { type: 'Program', name: 'Robotics' },
      { userId: 'user-1', endpointId: 'ep', conversationId: 'c', collections: [] }
    );
    expect(getEntity).toHaveBeenCalledWith('user-1', 'Program', 'Robotics');
    expect(result).toEqual({ entity: { name: 'Robotics', type: 'Program' } });
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
