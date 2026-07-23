# @vectorclient/channel-svelte

Svelte context + stores for the VectorClient public gateway.

## Setup

```bash
cd channel/shared && npm install && npm run build
cd ../svelte && npm install
```

```svelte
<script>
  import { setVectorClient, getVectorClient, createInvokeStore } from '@vectorclient/channel-svelte';

  setVectorClient({
    baseUrl: 'https://your-api-gateway-domain.com',
    apiKey: 'sk_…',
    endpointId: '…',
    userId: '…',
  }, { primaryColor: '#0f766e' });

  const store = createInvokeStore(getVectorClient());
</script>
```

## API

- `setVectorClient(config, theme?)` — set Svelte context
- `getVectorClient()` / `getVectorThemeVars()`
- `createInvokeStore(client)` — `{ data, error, loading, invoke, reset }` writable stores

See `examples/VectorPanel.svelte`.
