# VectorClient Channels

Native integrations for calling the VectorClient public API gateway from common client platforms.

All channels share the same contract:

```
POST {baseUrl}/api/v1/endpoints/{endpointId}/{userId}
Headers:
  Content-Type: application/json
  x-api-key: sk_…
Body: JSON only
```

See the root [User Guide](../README.md) for full gateway behaviour.

## Channels

| Channel | Path | How credentials are stored |
|---------|------|----------------------------|
| Shared SDK | [`shared/`](./shared) | Config object / env |
| React | [`react/`](./react) | Provider `config` prop (prefer proxy in production) |
| Vue | [`vue/`](./vue) | Plugin options |
| Svelte | [`svelte/`](./svelte) | `setVectorClient(config)` |
| WordPress | [`wordpress/`](./wordpress) | WP Admin settings + server-side REST proxy |
| Shopify | [`shopify/`](./shopify) | App env + App Proxy; theme only has proxy path + theme |

## Quick start (shared SDK)

```bash
cd channel/shared
npm install
npm test
npm run build
```

```ts
import { createClient, mergeTheme } from '@vectorclient/channel-shared';

const client = createClient({
  baseUrl: 'https://your-api-gateway-domain.com',
  apiKey: 'sk_xxxxxxxx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  endpointId: '660e8400-e29b-41d4-a716-446655440001',
  userId: '550e8400-e29b-41d4-a716-446655440000',
});

await client.invoke({ customer_id: '12345', message: 'Hello' });

const theme = mergeTheme({ primaryColor: '#0f766e', fontFamily: '"Source Sans 3", sans-serif' });
```

## Configuration reference

| Key | Required | Description |
|-----|----------|-------------|
| `baseUrl` | yes | Gateway origin without trailing slash |
| `apiKey` | yes | Token from dashboard (`sk_…`), linked to the endpoint |
| `endpointId` | yes | Endpoint UUID |
| `userId` | yes | Account owner UUID |
| `timeoutMs` | no | Default `30000` |
| `theme.*` | no | Widget colors, font, radius (`--vc-*` CSS variables) |

### Theme tokens

| Token | CSS variable | Default |
|-------|--------------|---------|
| primaryColor | `--vc-primary` | `#0f766e` |
| secondaryColor | `--vc-secondary` | `#134e4a` |
| backgroundColor | `--vc-bg` | `#f8fafc` |
| surfaceColor | `--vc-surface` | `#ffffff` |
| textColor | `--vc-text` | `#0f172a` |
| mutedTextColor | `--vc-muted` | `#64748b` |
| borderColor | `--vc-border` | `#e2e8f0` |
| borderRadius | `--vc-radius` | `8px` |
| fontFamily | `--vc-font` | Source Sans 3 |
| fontSize | `--vc-font-size` | `16px` |

## Framework guides

### React

```tsx
import { VectorClientProvider, VectorPanel, useInvoke } from '@vectorclient/channel-react';
```

Guide: [`react/README.md`](./react/README.md) · Example: [`react/examples/App.tsx`](./react/examples/App.tsx)

### Vue

```ts
import { createVectorClient, useInvoke } from '@vectorclient/channel-vue';
app.use(createVectorClient({ config, theme }));
```

Guide: [`vue/README.md`](./vue/README.md) · Example: [`vue/examples/App.vue`](./vue/examples/App.vue)

### Svelte

```ts
import { setVectorClient, createInvokeStore, getVectorClient } from '@vectorclient/channel-svelte';
```

Guide: [`svelte/README.md`](./svelte/README.md) · Example: [`svelte/examples/VectorPanel.svelte`](./svelte/examples/VectorPanel.svelte)

### WordPress

1. Install plugin from `wordpress/vectorclient`
2. **Settings → VectorClient** — set URL, API key, endpoint ID, user ID, theme
3. Embed: `[vectorclient title="Ask us"]`

Guide: [`wordpress/README.md`](./wordpress/README.md)

### Shopify

1. Deploy App Proxy that uses `handleAppProxyInvoke`
2. Add Liquid snippet + assets from `shopify/theme`
3. Set theme `vectorclient_proxy_path` and colors — **not** the API key

Guide: [`shopify/README.md`](./shopify/README.md)

## Examples

| Example | Path |
|---------|------|
| Node invoke | [`examples/node-invoke.ts`](./examples/node-invoke.ts) |
| Browser panel | [`examples/browser-panel.ts`](./examples/browser-panel.ts) |
| React app | [`react/examples/App.tsx`](./react/examples/App.tsx) |
| Vue app | [`vue/examples/App.vue`](./vue/examples/App.vue) |
| Svelte panel | [`svelte/examples/VectorPanel.svelte`](./svelte/examples/VectorPanel.svelte) |
| Shopify app proxy | [`shopify/examples/app-proxy-invoke.ts`](./shopify/examples/app-proxy-invoke.ts) |

## Run all tests

```bash
cd channel
npm run install:all
npm test
```

This runs Vitest suites for shared / React / Vue / Svelte / Shopify and the WordPress PHP test runner.

## Security

- **WordPress & Shopify**: keep `sk_…` on the server (WP options / app env) and expose only a proxy to the storefront.
- **React / Vue / Svelte**: for public sites, call your own backend that holds the API key, or use the shared client only in trusted environments.
- Never commit real API keys. Use env vars (`VECTORCLIENT_*` / `VITE_VC_*`).

## Account owner checklist

1. Create endpoint + associate API token in the VectorClient dashboard
2. Give the client: `baseUrl`, `apiKey`, `endpointId`, `userId`
3. Point them at the matching channel folder guide above
4. Optionally share theme tokens so the widget matches their brand
