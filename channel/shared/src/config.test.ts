import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildGatewayUrl,
  ConfigError,
  createClient,
  createConfig,
  DEFAULT_THEME,
  mergeTheme,
  themeToCssVariables,
  VectorClientError,
} from './index.js';

describe('createConfig', () => {
  const valid = {
    baseUrl: 'https://api.example.com/',
    apiKey: 'sk_test_abc123',
    endpointId: 'ep-1',
    userId: 'user-1',
  };

  it('normalizes baseUrl and sets default timeout', () => {
    const config = createConfig(valid);
    expect(config.baseUrl).toBe('https://api.example.com');
    expect(config.timeoutMs).toBe(30_000);
  });

  it('rejects missing fields', () => {
    expect(() => createConfig({ ...valid, apiKey: '' })).toThrow(ConfigError);
  });

  it('rejects non-http baseUrl', () => {
    expect(() => createConfig({ ...valid, baseUrl: 'ftp://x' })).toThrow(/http/);
  });

  it('rejects api keys without sk_ prefix', () => {
    expect(() => createConfig({ ...valid, apiKey: 'bad' })).toThrow(/sk_/);
  });
});

describe('buildGatewayUrl', () => {
  it('builds the public dynamic route', () => {
    expect(buildGatewayUrl('https://gw.test', 'ep', 'uid')).toBe(
      'https://gw.test/api/v1/endpoints/ep/uid'
    );
  });

  it('encodes path segments', () => {
    expect(buildGatewayUrl('https://gw.test', 'a/b', 'c d')).toContain(
      '/api/v1/endpoints/a%2Fb/c%20d'
    );
  });
});

describe('theme helpers', () => {
  it('merges overrides onto defaults', () => {
    const theme = mergeTheme({ primaryColor: '#111' });
    expect(theme.primaryColor).toBe('#111');
    expect(theme.fontFamily).toBe(DEFAULT_THEME.fontFamily);
  });

  it('exports CSS variables', () => {
    const vars = themeToCssVariables(DEFAULT_THEME);
    expect(vars['--vc-primary']).toBe(DEFAULT_THEME.primaryColor);
    expect(vars['--vc-font']).toBe(DEFAULT_THEME.fontFamily);
  });
});

describe('VectorClient.invoke', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const config = {
    baseUrl: 'https://gw.test',
    apiKey: 'sk_live_secret',
    endpointId: '660e8400-e29b-41d4-a716-446655440001',
    userId: '550e8400-e29b-41d4-a716-446655440000',
  };

  it('POSTs JSON with x-api-key and returns parsed data', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ result: 'ok' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createClient(config);
    const result = await client.invoke({ customer_id: '12345' });

    expect(result).toEqual({ ok: true, status: 200, data: { result: 'ok' } });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://gw.test/api/v1/endpoints/660e8400-e29b-41d4-a716-446655440001/550e8400-e29b-41d4-a716-446655440000'
    );
    expect(init.method).toBe('POST');
    expect(init.headers['x-api-key']).toBe('sk_live_secret');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ customer_id: '12345' });
  });

  it('throws VectorClientError on gateway failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => JSON.stringify({ message: 'Invalid API token' }),
      })
    );

    const client = createClient(config);
    await expect(client.invoke({})).rejects.toMatchObject({
      name: 'VectorClientError',
      status: 403,
      message: 'Invalid API token',
    } satisfies Partial<VectorClientError>);
  });

  it('maps abort to 408', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
      })
    );

    const client = createClient({ ...config, timeoutMs: 5 });
    await expect(client.invoke({})).rejects.toMatchObject({ status: 408 });
  });
});
