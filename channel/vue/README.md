# @vectorclient/channel-vue

Vue 3 plugin + composables for the VectorClient public gateway.

## Setup

```bash
cd channel/shared && npm install && npm run build
cd ../vue && npm install
```

```ts
import { createApp } from 'vue';
import { createVectorClient } from '@vectorclient/channel-vue';
import App from './App.vue';

const vector = createVectorClient({
  config: {
    baseUrl: 'https://your-api-gateway-domain.com',
    apiKey: 'sk_…',
    endpointId: '…',
    userId: '…',
  },
  theme: { primaryColor: '#0f766e' },
});

createApp(App).use(vector).mount('#app');
```

## Composables

- `useVectorClient()`
- `useInvoke()` — reactive `data` / `error` / `loading` plus `invoke()`
- `useVectorThemeVars()` — `--vc-*` CSS variables
- `provideVectorClient()` — for composition API without the plugin

See `examples/App.vue`.
