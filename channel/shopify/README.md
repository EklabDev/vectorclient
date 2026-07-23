# VectorClient Shopify Channel

Native Shopify integration: theme snippet + server-side App Proxy helpers.

## Architecture

```
Storefront Liquid/JS  →  App Proxy (adds x-api-key)  →  VectorClient Gateway
```

Never put `sk_…` API keys in theme settings or Liquid. Keep them in app env / secrets.

## Theme setup

1. Copy `theme/snippets/vectorclient-panel.liquid` into your theme `snippets/`
2. Copy `theme/assets/vectorclient-panel.css` and `vectorclient-panel.js` into `assets/`
3. Add theme settings (or app metafields) for:
   - `vectorclient_proxy_path` (e.g. `/apps/vectorclient/invoke`)
   - `vectorclient_primary_color`, `vectorclient_surface_color`, …
4. Render on a product/page template:

```liquid
{% render 'vectorclient-panel', title: 'Need help?', submit_label: 'Ask' %}
```

## App Proxy (server)

```bash
cd channel/shared && npm install && npm run build
cd ../shopify && npm install
```

```ts
import { handleAppProxyInvoke } from '@vectorclient/channel-shopify';

await handleAppProxyInvoke(
  {
    baseUrl: process.env.VECTORCLIENT_BASE_URL!,
    apiKey: process.env.VECTORCLIENT_API_KEY!,
    endpointId: process.env.VECTORCLIENT_ENDPOINT_ID!,
    userId: process.env.VECTORCLIENT_USER_ID!,
  },
  { message: 'Hello' },
  { shop: 'acme.myshopify.com' }
);
```

See `examples/app-proxy-invoke.ts` for a full Request/Response handler.

## Configuration checklist

| Setting | Where | Notes |
|---------|-------|-------|
| Base URL | App env | `https://your-api-gateway-domain.com` |
| API key | App env / secret | `sk_…` — server only |
| Endpoint ID | App env | UUID from dashboard |
| User ID | App env | Owner UUID |
| Proxy path | Theme setting | Points at App Proxy |
| Theme colors | Theme setting | CSS variables `--vc-*` |

## Tests

```bash
cd channel/shopify && npm test
```
