# @vectorclient/channel-shared

Core TypeScript SDK used by all VectorClient channel integrations (React, Vue, Svelte, Shopify storefront JS, and WordPress assets).

## Install

```bash
cd channel/shared
npm install
npm test
npm run build
```

## Configuration

| Option | Required | Description |
|--------|----------|-------------|
| `baseUrl` | yes | Gateway origin (`https://your-api-gateway-domain.com`) |
| `apiKey` | yes | Token `sk_…` associated with the endpoint |
| `endpointId` | yes | Endpoint UUID |
| `userId` | yes | Owner UUID |
| `timeoutMs` | no | Default `30000` |
| `userAgent` | no | Forwarded by the gateway |
| `authorization` | no | Forwarded to the target webhook |

## Usage

```ts
import { createClient, mergeTheme } from '@vectorclient/channel-shared';

const client = createClient({
  baseUrl: 'https://your-api-gateway-domain.com',
  apiKey: 'sk_xxxxxxxx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  endpointId: '660e8400-e29b-41d4-a716-446655440001',
  userId: '550e8400-e29b-41d4-a716-446655440000',
});

const { data } = await client.invoke({
  customer_id: '12345',
  order_amount: 99.99,
});

const theme = mergeTheme({ primaryColor: '#0f766e' });
```

## Theme CSS variables

`themeToCssVariables` / `themeToInlineStyle` emit `--vc-*` tokens for widgets (`--vc-primary`, `--vc-surface`, `--vc-font`, …).
