<script setup lang="ts">
import { createApp } from 'vue';
import { createVectorClient, useInvoke } from '@vectorclient/channel-vue';

const plugin = createVectorClient({
  config: {
    baseUrl: import.meta.env.VITE_VC_BASE_URL ?? 'https://your-api-gateway-domain.com',
    apiKey: import.meta.env.VITE_VC_API_KEY ?? 'sk_xxxxxxxx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    endpointId: import.meta.env.VITE_VC_ENDPOINT_ID ?? '660e8400-e29b-41d4-a716-446655440001',
    userId: import.meta.env.VITE_VC_USER_ID ?? '550e8400-e29b-41d4-a716-446655440000',
  },
  theme: { primaryColor: '#0f766e' },
});

const App = {
  setup() {
    const { invoke, data, error, loading, panelStyle } = useInvoke();
    const raw = '{"customer_id":"12345","message":"Need help"}';

    async function onSubmit() {
      await invoke(JSON.parse(raw));
    }

    return { raw, onSubmit, data, error, loading, panelStyle };
  },
  template: `
    <div :style="panelStyle" class="vc-panel">
      <h2 style="color: var(--vc-primary); margin: 0">VectorClient (Vue)</h2>
      <button :disabled="loading" @click="onSubmit">{{ loading ? 'Sending…' : 'Send' }}</button>
      <p v-if="error" role="alert">{{ error }}</p>
      <pre v-if="data">{{ data }}</pre>
    </div>
  `,
};

createApp(App).use(plugin).mount('#app');
</script>
