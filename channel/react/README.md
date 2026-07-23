# @vectorclient/channel-react

Native React integration for the VectorClient public gateway (`x-api-key`).

## Setup

```bash
cd channel/shared && npm install && npm run build
cd ../react && npm install
```

```tsx
import {
  VectorClientProvider,
  VectorPanel,
  useInvoke,
} from '@vectorclient/channel-react';

const config = {
  baseUrl: 'https://your-api-gateway-domain.com',
  apiKey: 'sk_…',
  endpointId: '…',
  userId: '…',
};

export function App() {
  return (
    <VectorClientProvider config={config} theme={{ primaryColor: '#0f766e' }}>
      <VectorPanel title="Support" />
    </VectorClientProvider>
  );
}
```

## Hooks

- `useVectorClient()` — shared `VectorClient` instance
- `useInvoke()` — `{ data, error, loading, invoke, reset }`
- `useVectorThemeStyle()` — CSS variables as a React style object

## Theme

Pass `theme` to `VectorClientProvider` to override `--vc-*` tokens (primary, surface, font, radius, …).

## Example

See `examples/App.tsx`. Prefer server-side or proxy usage for production so the API key is not shipped to the browser when possible.
