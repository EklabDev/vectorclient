import { describe, expect, it, vi, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { createClient, createInvokeStore } from './index.js';

describe('Svelte createInvokeStore', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('updates stores after a successful invoke', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ value: 42 }),
      })
    );

    const client = createClient({
      baseUrl: 'https://gw.test',
      apiKey: 'sk_test_key',
      endpointId: 'ep-1',
      userId: 'user-1',
    });
    const store = createInvokeStore<{ value: number }>(client);
    const result = await store.invoke({ q: 1 });

    expect(result).toEqual({ value: 42 });
    expect(get(store.data)).toEqual({ value: 42 });
    expect(get(store.error)).toBeNull();
    expect(get(store.loading)).toBe(false);
  });

  it('stores error messages on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => JSON.stringify({ message: 'Endpoint not found or inactive' }),
      })
    );

    const client = createClient({
      baseUrl: 'https://gw.test',
      apiKey: 'sk_test_key',
      endpointId: 'ep-1',
      userId: 'user-1',
    });
    const store = createInvokeStore(client);
    await store.invoke({});

    expect(get(store.data)).toBeNull();
    expect(get(store.error)).toBe('Endpoint not found or inactive');
  });
});
