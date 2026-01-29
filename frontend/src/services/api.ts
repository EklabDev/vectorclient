import { useAuthStore } from '../store/authStore';

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
}
