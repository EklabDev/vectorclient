<script lang="ts">
  import { onMount } from 'svelte';
  import {
    setVectorClient,
    getVectorClient,
    getVectorThemeVars,
    createInvokeStore,
  } from '@vectorclient/channel-svelte';

  const ctx = setVectorClient(
    {
      baseUrl: import.meta.env.VITE_VC_BASE_URL ?? 'https://your-api-gateway-domain.com',
      apiKey: import.meta.env.VITE_VC_API_KEY ?? 'sk_xxxxxxxx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      endpointId: import.meta.env.VITE_VC_ENDPOINT_ID ?? '660e8400-e29b-41d4-a716-446655440001',
      userId: import.meta.env.VITE_VC_USER_ID ?? '550e8400-e29b-41d4-a716-446655440000',
    },
    { primaryColor: '#0f766e' }
  );

  const { data, error, loading, invoke } = createInvokeStore(getVectorClient());
  const theme = getVectorThemeVars();
  const themeStyle = Object.entries(theme)
    .map(([k, v]) => `${k}:${v}`)
    .join(';');

  let raw = '{"customer_id":"12345","message":"Need help"}';

  async function onSubmit() {
    await invoke(JSON.parse(raw));
  }

  onMount(() => {
    console.log('VectorClient ready', ctx.client.getGatewayUrl());
  });
</script>

<div class="vc-panel" style={themeStyle}>
  <h2>VectorClient (Svelte)</h2>
  <textarea bind:value={raw} rows="6"></textarea>
  <button on:click={onSubmit} disabled={$loading}>
    {$loading ? 'Sending…' : 'Send'}
  </button>
  {#if $error}
    <p role="alert">{$error}</p>
  {/if}
  {#if $data}
    <pre>{JSON.stringify($data, null, 2)}</pre>
  {/if}
</div>

<style>
  .vc-panel {
    background: var(--vc-surface, #fff);
    color: var(--vc-text, #0f172a);
    font-family: var(--vc-font, sans-serif);
    border: 1px solid var(--vc-border, #e2e8f0);
    border-radius: var(--vc-radius, 8px);
    box-shadow: var(--vc-shadow);
    padding: var(--vc-spacing, 12px);
    display: grid;
    gap: 12px;
    max-width: 560px;
  }
  h2 {
    margin: 0;
    color: var(--vc-primary, #0f766e);
  }
</style>
