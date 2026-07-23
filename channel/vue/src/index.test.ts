import { describe, expect, it, vi, afterEach } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { createVectorClient, useInvoke, useVectorClient } from './index.js';

const config = {
  baseUrl: 'https://gw.test',
  apiKey: 'sk_test_key',
  endpointId: 'ep-1',
  userId: 'user-1',
};

describe('Vue VectorClient plugin', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('injects the client via plugin', () => {
    const plugin = createVectorClient({ config });
    const Comp = defineComponent({
      setup() {
        const client = useVectorClient();
        return () => h('span', client.getGatewayUrl());
      },
    });
    const wrapper = mount(Comp, { global: { plugins: [plugin] } });
    expect(wrapper.text()).toContain('/api/v1/endpoints/ep-1/user-1');
  });

  it('useInvoke calls the gateway', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true }),
      })
    );

    const plugin = createVectorClient({ config });
    const Comp = defineComponent({
      setup() {
        const { invoke, data } = useInvoke<{ ok: boolean }>();
        return { invoke, data };
      },
      template: `<button @click="invoke({ a: 1 })">Go</button><span v-if="data">{{ data.ok }}</span>`,
    });

    const wrapper = mount(Comp, { global: { plugins: [plugin] } });
    await wrapper.find('button').trigger('click');
    await nextTick();
    await vi.waitFor(() => expect(wrapper.text()).toContain('true'));
  });
});
