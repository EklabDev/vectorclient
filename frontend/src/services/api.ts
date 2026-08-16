import { useAuthStore } from '../store/authStore';

export interface WeaviateChunkObject {
  id: string;
  content?: string;
  originalReference?: string;
  schemaId?: string;
  schemaName?: string;
  version?: number;
  chunkIndex?: number;
  category?: string;
  subcategory?: string;
  score?: number;
}

const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Ensure API URL is absolute (has protocol) so fetch() doesn't treat it as relative to current origin
function getApiBaseUrl(): string {
  const url = rawApiUrl.trim();
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url.replace(/\/$/, ''); // strip trailing slash
  }
  return `https://${url}`.replace(/\/$/, '');
}

export class ApiClient {
  static async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${getApiBaseUrl()}${endpoint}`;

    // For DELETE requests without a body, don't set Content-Type header
    const method = options.method || 'GET';
    const hasBody = options.body !== undefined && options.body !== null;
    const shouldSetContentType = method !== 'DELETE' || hasBody;

    const headers: Record<string, string> = {
      ...(useAuthStore.getState().token && { Authorization: `Bearer ${useAuthStore.getState().token}` }),
      ...(shouldSetContentType && { 'Content-Type': 'application/json' }),
      ...(options.headers as Record<string, string>),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      if (response.status === 401) {
        useAuthStore.getState().logout();
      }
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || 'Request failed');
    }

    return response.json();
  }

  // Auth
  static login(username: string, password: string) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  static register(username: string, password: string, email: string, displayName: string) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, email, displayName }),
    });
  }

  // Endpoints
  static getEndpoints() {
    return this.request('/api/endpoints');
  }

  static getEndpoint(id: string) {
    return this.request(`/api/endpoints/${id}`);
  }

  static createEndpoint(data: any) {
    return this.request('/api/endpoints', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static updateEndpoint(id: string, data: any) {
    return this.request(`/api/endpoints/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  static deleteEndpoint(id: string) {
    return this.request(`/api/endpoints/${id}`, { method: 'DELETE' });
  }

  // Schemas
  static getSchemas() {
    return this.request('/api/schemas');
  }

  static getSchema(id: string) {
    return this.request(`/api/schemas/${id}`);
  }

  static createSchema(data: any) {
    return this.request('/api/schemas', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static updateSchema(id: string, data: any) {
    return this.request(`/api/schemas/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  static deleteSchema(id: string) {
    return this.request(`/api/schemas/${id}`, { method: 'DELETE' });
  }

  /** Batch Weaviate object counts for schema cards (published only). */
  static postWeaviateBatchCounts(ids: string[]) {
    return this.request<{ counts: Record<string, number> }>('/api/schemas/weaviate/batch-counts', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  }

  static getWeaviateObjects(schemaId: string) {
    return this.request<{ objects: WeaviateChunkObject[]; truncated: boolean }>(
      `/api/schemas/${schemaId}/weaviate/objects`
    );
  }

  static getWeaviateCount(schemaId: string) {
    return this.request<{ count: number }>(`/api/schemas/${schemaId}/weaviate/count`);
  }

  static searchWeaviateObjects(schemaId: string, body: { query: string; mode: 'bm25' | 'vector' }) {
    return this.request<{ objects: WeaviateChunkObject[] }>(`/api/schemas/${schemaId}/weaviate/search`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  static createWeaviateObject(
    schemaId: string,
    body: {
      content: string;
      originalReference?: string;
      category?: string;
      subcategory?: string;
    }
  ) {
    return this.request<{ id: string; chunkIndex: number }>(`/api/schemas/${schemaId}/weaviate/objects`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /** Merge-update chunk fields (omit a key to leave that field unchanged in Weaviate). */
  static patchWeaviateChunk(
    schemaId: string,
    objectId: string,
    body: { content?: string; category?: string; subcategory?: string }
  ) {
    return this.request<{ ok: boolean }>(`/api/schemas/${schemaId}/weaviate/objects/${objectId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  static deleteWeaviateObject(schemaId: string, objectId: string) {
    return this.request<{ ok: boolean }>(`/api/schemas/${schemaId}/weaviate/objects/${objectId}`, {
      method: 'DELETE',
    });
  }

  // Tokens
  static getTokens() {
    return this.request('/api/tokens');
  }

  static createToken(tokenName: string, expiresIn?: number) {
    return this.request('/api/tokens', {
      method: 'POST',
      body: JSON.stringify({ tokenName, expiresIn }),
    });
  }

  static revokeToken(id: string) {
    return this.request(`/api/tokens/${id}`, {
      method: 'DELETE',
    });
  }

  // Endpoint Associations
  static addTokensToEndpoint(endpointId: string, tokenIds: string[]) {
    return this.request(`/api/endpoints/${endpointId}/tokens`, {
      method: 'POST',
      body: JSON.stringify({ tokenIds }),
    });
  }

  static removeTokenFromEndpoint(endpointId: string, tokenId: string) {
    return this.request(`/api/endpoints/${endpointId}/tokens/${tokenId}`, {
      method: 'DELETE',
    });
  }

  static addSchemasToEndpoint(endpointId: string, schemaIds: string[]) {
    return this.request(`/api/endpoints/${endpointId}/schemas`, {
      method: 'POST',
      body: JSON.stringify({ schemaIds }),
    });
  }

  static removeSchemaFromEndpoint(endpointId: string, schemaId: string) {
    return this.request(`/api/endpoints/${endpointId}/schemas/${schemaId}`, {
      method: 'DELETE',
    });
  }

  // Logs
  static getLogs(endpointId: string, query: any = {}) {
    const params = new URLSearchParams();
    Object.keys(query).forEach(key => {
      if (query[key] !== undefined && query[key] !== null) {
        params.append(key, String(query[key]));
      }
    });
    const queryString = params.toString();
    return this.request(`/api/endpoints/${endpointId}/logs${queryString ? `?${queryString}` : ''}`);
  }

  static getLogStats(endpointId: string) {
    return this.request(`/api/endpoints/${endpointId}/logs/stats`);
  }

  // Token Usage Logs
  static getTokenLogs(tokenId: string, query: any = {}) {
    const params = new URLSearchParams();
    Object.keys(query).forEach(key => {
      if (query[key] !== undefined && query[key] !== null) {
        params.append(key, String(query[key]));
      }
    });
    const queryString = params.toString();
    return this.request(`/api/tokens/${tokenId}/logs${queryString ? `?${queryString}` : ''}`);
  }

  // Dashboard Stats
  static getRequests24h() {
    return this.request('/api/logs/stats/24h');
  }

  // Scrape sources
  static getScrapeSources() {
    return this.request('/api/scrape-sources');
  }

  static createScrapeSource(data: {
    name: string;
    seedUrl: string;
    schemaId?: string | null;
    allowedDomains?: string[];
    maxDepth?: number;
    maxPages?: number;
    isActive?: boolean;
  }) {
    return this.request('/api/scrape-sources', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static updateScrapeSource(id: string, data: Record<string, unknown>) {
    return this.request(`/api/scrape-sources/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  static deleteScrapeSource(id: string) {
    return this.request(`/api/scrape-sources/${id}`, { method: 'DELETE' });
  }

  static triggerScrapeCrawl(id: string) {
    return this.request(`/api/scrape-sources/${id}/crawl`, { method: 'POST' });
  }

  static getScrapeJobs(id: string) {
    return this.request(`/api/scrape-sources/${id}/jobs`);
  }
}
