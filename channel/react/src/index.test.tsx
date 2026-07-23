import { describe, expect, it, vi, afterEach } from 'vitest';
import { createElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { VectorClientProvider, useVectorClient, useInvoke } from './index.js';

const config = {
  baseUrl: 'https://gw.test',
  apiKey: 'sk_test_key',
  endpointId: 'ep-1',
  userId: 'user-1',
};

function Probe() {
  const client = useVectorClient();
  return createElement('span', null, client.getGatewayUrl());
}

function InvokeProbe() {
  const { invoke, data, error, loading } = useInvoke<{ echo: string }>();
  return createElement(
    'div',
    null,
    createElement(
      'button',
      {
        type: 'button',
        onClick: () => {
          void invoke({ echo: 'hi' });
        },
      },
      'Go'
    ),
    loading ? createElement('span', null, 'loading') : null,
    error ? createElement('span', null, error) : null,
    data ? createElement('span', null, data.echo) : null
  );
}

describe('VectorClientProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('provides a configured client', () => {
    render(
      createElement(VectorClientProvider, { config }, createElement(Probe))
    );
    expect(screen.getByText(/\/api\/v1\/endpoints\/ep-1\/user-1/)).toBeTruthy();
  });

  it('useInvoke posts through the shared client', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ echo: 'hi' }),
      })
    );

    render(
      createElement(VectorClientProvider, { config }, createElement(InvokeProbe))
    );
    screen.getByText('Go').click();
    await waitFor(() => expect(screen.getByText('hi')).toBeTruthy());
  });
});
