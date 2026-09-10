import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../redisService', () => ({
  RedisService: {
    get: vi.fn(async () => null),
    set: vi.fn(async () => true),
  },
}));

describe('cache tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefixes keys under the user namespace via RedisService', async () => {
    const { cacheSetTool, cacheGetTool } = await import('./cacheTool');
    const { RedisService } = await import('../../redisService');

    await cacheSetTool.execute(
      { key: 'faq:pricing', value: '100 HKD', ttl_seconds: 60 },
      { userId: 'user-1', endpointId: 'ep', conversationId: 'c', collections: [] }
    );

    expect(RedisService.set).toHaveBeenCalledWith('user-1', 'agent:faq:pricing', '100 HKD', 60);

    await cacheGetTool.execute(
      { key: 'faq:pricing' },
      { userId: 'user-1', endpointId: 'ep', conversationId: 'c', collections: [] }
    );
    expect(RedisService.get).toHaveBeenCalledWith('user-1', 'agent:faq:pricing');
  });

  it('rejects absolute vc: keys', async () => {
    const { cacheGetTool } = await import('./cacheTool');
    await expect(
      cacheGetTool.execute(
        { key: 'vc:other:secret' },
        { userId: 'user-1', endpointId: 'ep', conversationId: 'c', collections: [] }
      )
    ).rejects.toThrow(/Absolute Redis keys/);
  });
});
