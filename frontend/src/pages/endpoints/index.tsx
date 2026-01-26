import { useState, useEffect } from 'react';
import { ApiClient } from '../../services/api';
import { Autocomplete } from '../../components/Common/Autocomplete';

interface Token {
  id: string;
  tokenName: string;
  tokenPrefix: string;
}

interface Schema {
  id: string;
  name: string;
  order?: number;
}

interface Endpoint {
  id: string;
  userId: string;
  routeName: string;
  route: string;
  rateLimit: number;
  rateLimitWindowMs: number;
  allowedOrigins: string[];
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  apiTokens?: Token[];
  schemas?: Schema[];
}

interface CallLog {
  id: string;
  endpointId: string;
  apiTokenId: string | null;
  method: string;
  path: string;
  status: number;
  requestBody: string | null;
  responseBody: string | null;
  responseTime: number;
  ipAddress: string | null;
  userAgent: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export function EndpointsPage() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState<Endpoint | null>(null);
  const [formData, setFormData] = useState({
    routeName: '',
    route: '',
    rateLimit: 100,
    rateLimitWindowMs: 60000,
    allowedOrigins: '',
    description: '',
    isActive: true,
  });
  const [selectedTokens, setSelectedTokens] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedSchemas, setSelectedSchemas] = useState<Array<{ id: string; label: string }>>([]);
  const [availableTokens, setAvailableTokens] = useState<Array<{ id: string; label: string }>>([]);
  const [availableSchemas, setAvailableSchemas] = useState<Array<{ id: string; label: string }>>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewingLogsFor, setViewingLogsFor] = useState<string | null>(null);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState('');
  const [selectedLog, setSelectedLog] = useState<CallLog | null>(null);

  const loadTokens = async () => {
    try {
      const tokens = await ApiClient.getTokens();
      if (Array.isArray(tokens)) {
        setAvailableTokens(
          tokens
            .filter((t: any) => t.isActive)
            .map((t: any) => ({
              id: t.id,
              label: `${t.tokenName} (${t.tokenPrefix}...)`,
            }))
        );
      }
    } catch (err) {
      // Ignore errors, tokens might not be available
    }
  };

  const loadSchemas = async () => {
    try {
      const schemas = await ApiClient.getSchemas();
      if (Array.isArray(schemas)) {
        setAvailableSchemas(
          schemas.map((s: any) => ({
            id: s.id,
            label: s.name,
          }))
        );
      }
    } catch (err) {
      // Ignore errors, schemas might not be available
    }
  };

  useEffect(() => {
    loadEndpoints();
    loadTokens();
    loadSchemas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadEndpoints = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await ApiClient.getEndpoints();
      // Handle both array and object with message property
      if (Array.isArray(data)) {
        setEndpoints(data);
      } else if (data && typeof data === 'object' && 'message' in data) {
        setEndpoints([]);
      } else {
        setEndpoints([]);
      }
    } catch (err) {
      setError((err as Error).message);
      setEndpoints([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      const allowedOriginsArray = formData.allowedOrigins
        ? formData.allowedOrigins.split(',').map((o) => o.trim()).filter(Boolean)
        : [];

      const payload = {
        routeName: formData.routeName,
        route: formData.route,
        rateLimit: formData.rateLimit,
        rateLimitWindowMs: formData.rateLimitWindowMs,
        allowedOrigins: allowedOriginsArray,
        description: formData.description || null,
        isActive: formData.isActive,
        apiTokenIds: selectedTokens.map((t) => t.id),
        schemaIds: selectedSchemas.map((s) => s.id),
      };

      if (editingEndpoint) {
        await ApiClient.updateEndpoint(editingEndpoint.id, payload);
      } else {
        await ApiClient.createEndpoint(payload);
      }

      setShowCreateModal(false);
      setEditingEndpoint(null);
      resetForm();
      await loadEndpoints();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleEdit = (endpoint: Endpoint) => {
    setEditingEndpoint(endpoint);
    setFormData({
      routeName: endpoint.routeName,
      route: endpoint.route,
      rateLimit: endpoint.rateLimit,
      rateLimitWindowMs: endpoint.rateLimitWindowMs,
      allowedOrigins: endpoint.allowedOrigins.join(', '),
      description: endpoint.description || '',
      isActive: endpoint.isActive,
    });
    setSelectedTokens(
      (endpoint.apiTokens || []).map((t) => ({
        id: t.id,
        label: `${t.tokenName} (${t.tokenPrefix}...)`,
      }))
    );
    setSelectedSchemas(
      (endpoint.schemas || []).map((s) => ({
        id: s.id,
        label: s.name,
      }))
    );
    setShowCreateModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this endpoint? This action cannot be undone.')) {
      return;
    }
    try {
      setDeletingId(id);
      setError('');
      await ApiClient.deleteEndpoint(id);
      await loadEndpoints();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  const resetForm = () => {
    setFormData({
      routeName: '',
      route: '',
      rateLimit: 100,
      rateLimitWindowMs: 60000,
      allowedOrigins: '',
      description: '',
      isActive: true,
    });
    setSelectedTokens([]);
    setSelectedSchemas([]);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const loadCallLogs = async (endpointId: string) => {
    try {
      setLogsLoading(true);
      setLogsError('');
      const response = await ApiClient.getLogs(endpointId, { limit: 100, sortOrder: 'desc' });
      if (response && response.logs) {
        setCallLogs(response.logs);
      } else {
        setCallLogs([]);
      }
    } catch (err) {
      setLogsError((err as Error).message);
      setCallLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleViewLogs = (endpointId: string) => {
    setViewingLogsFor(endpointId);
    loadCallLogs(endpointId);
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return '#10b981'; // green
    if (status >= 300 && status < 400) return '#3b82f6'; // blue
    if (status >= 400 && status < 500) return '#f59e0b'; // yellow
    if (status >= 500) return '#ef4444'; // red
    return '#a1a1aa'; // gray
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#fff' }}>Endpoints</h1>
        <button
          onClick={() => {
            setShowCreateModal(true);
            setEditingEndpoint(null);
            resetForm();
          }}
          style={{
            padding: '8px 16px',
            backgroundColor: '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '500'
          }}
        >
          Create Endpoint
        </button>
      </div>

      {error && (
        <div style={{
          padding: '12px',
          backgroundColor: '#7f1d1d',
          color: '#fca5a5',
          borderRadius: '6px',
          marginBottom: '20px'
        }}>
          {error}
        </div>
      )}

      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          overflowY: 'auto',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#27272a',
            padding: '24px',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '600px',
            border: '1px solid #3f3f46',
            margin: 'auto'
          }}>
            <h2 style={{ marginTop: 0, color: '#fff' }}>
              {editingEndpoint ? 'Edit Endpoint' : 'Create New Endpoint'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#a1a1aa' }}>
                  Route Name *
                </label>
                <input
                  type="text"
                  value={formData.routeName}
                  onChange={(e) => setFormData({ ...formData, routeName: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '14px'
                  }}
                  placeholder="e.g., Payment Webhook"
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#a1a1aa' }}>
                  Route Path *
                </label>
                <input
                  type="text"
                  value={formData.route}
                  onChange={(e) => setFormData({ ...formData, route: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '14px'
                  }}
                  placeholder="e.g., /webhook/payment"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#a1a1aa' }}>
                    Rate Limit
                  </label>
                  <input
                    type="number"
                    value={formData.rateLimit}
                    onChange={(e) => setFormData({ ...formData, rateLimit: parseInt(e.target.value) || 100 })}
                    min="1"
                    style={{
                      width: '100%',
                      padding: '8px',
                      backgroundColor: '#18181b',
                      border: '1px solid #3f3f46',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#a1a1aa' }}>
                    Window (ms)
                  </label>
                  <input
                    type="number"
                    value={formData.rateLimitWindowMs}
                    onChange={(e) => setFormData({ ...formData, rateLimitWindowMs: parseInt(e.target.value) || 60000 })}
                    min="1000"
                    style={{
                      width: '100%',
                      padding: '8px',
                      backgroundColor: '#18181b',
                      border: '1px solid #3f3f46',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#a1a1aa' }}>
                  Allowed Origins (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.allowedOrigins}
                  onChange={(e) => setFormData({ ...formData, allowedOrigins: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '14px'
                  }}
                  placeholder="e.g., https://example.com, https://app.example.com"
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#a1a1aa' }}>
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                  placeholder="Optional description"
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#a1a1aa' }}>
                  API Tokens
                </label>
                <Autocomplete
                  options={availableTokens}
                  selected={selectedTokens}
                  onChange={setSelectedTokens}
                  placeholder="Select API tokens..."
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#a1a1aa' }}>
                  Schemas (Knowledge Base)
                </label>
                <Autocomplete
                  options={availableSchemas}
                  selected={selectedSchemas}
                  onChange={setSelectedSchemas}
                  placeholder="Select schemas..."
                />
              </div>

              <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  style={{ cursor: 'pointer' }}
                />
                <label style={{ color: '#a1a1aa', cursor: 'pointer' }}>Active</label>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '8px',
                    backgroundColor: '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  {editingEndpoint ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingEndpoint(null);
                    resetForm();
                  }}
                  style={{
                    flex: 1,
                    padding: '8px',
                    backgroundColor: '#3f3f46',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#a1a1aa' }}>Loading endpoints...</div>
      ) : endpoints.length === 0 ? (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          color: '#a1a1aa',
          backgroundColor: '#27272a',
          borderRadius: '8px',
          border: '1px solid #3f3f46'
        }}>
          No endpoints found. Create your first one!
        </div>
      ) : (
        <div style={{
          backgroundColor: '#27272a',
          borderRadius: '8px',
          border: '1px solid #3f3f46',
          overflow: 'hidden'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#18181b', borderBottom: '1px solid #3f3f46' }}>
                <th style={{ padding: '12px', textAlign: 'left', color: '#fff', fontWeight: '600' }}>Name</th>
                <th style={{ padding: '12px', textAlign: 'left', color: '#fff', fontWeight: '600' }}>User ID</th>
                <th style={{ padding: '12px', textAlign: 'left', color: '#fff', fontWeight: '600' }}>Endpoint ID</th>
                <th style={{ padding: '12px', textAlign: 'left', color: '#fff', fontWeight: '600' }}>Route</th>
                <th style={{ padding: '12px', textAlign: 'left', color: '#fff', fontWeight: '600' }}>Rate Limit</th>
                <th style={{ padding: '12px', textAlign: 'left', color: '#fff', fontWeight: '600' }}>Tokens</th>
                <th style={{ padding: '12px', textAlign: 'left', color: '#fff', fontWeight: '600' }}>Schemas</th>
                <th style={{ padding: '12px', textAlign: 'left', color: '#fff', fontWeight: '600' }}>Status</th>
                <th style={{ padding: '12px', textAlign: 'left', color: '#fff', fontWeight: '600' }}>Created</th>
                <th style={{ padding: '12px', textAlign: 'right', color: '#fff', fontWeight: '600' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map((endpoint) => (
                <tr key={endpoint.id} style={{ borderBottom: '1px solid #3f3f46' }}>
                  <td style={{ padding: '12px', color: '#fff' }}>{endpoint.routeName}</td>
                  <td style={{ padding: '12px', color: '#a1a1aa', fontFamily: 'monospace', fontSize: '12px' }}>{endpoint.userId}</td>
                  <td style={{ padding: '12px', color: '#a1a1aa', fontFamily: 'monospace', fontSize: '12px' }}>{endpoint.id}</td>
                  <td style={{ padding: '12px', color: '#a1a1aa', fontFamily: 'monospace' }}>{endpoint.route}</td>
                  <td style={{ padding: '12px', color: '#a1a1aa' }}>
                    {endpoint.rateLimit} / {endpoint.rateLimitWindowMs / 1000}s
                  </td>
                  <td style={{ padding: '12px', color: '#a1a1aa', fontSize: '12px' }}>
                    {endpoint.apiTokens && endpoint.apiTokens.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {endpoint.apiTokens.map((token) => (
                          <span
                            key={token.id}
                            style={{
                              padding: '2px 6px',
                              backgroundColor: '#3b82f6',
                              borderRadius: '4px',
                              fontSize: '11px',
                            }}
                            title={token.tokenName}
                          >
                            {token.tokenPrefix}...
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: '#71717a' }}>None</span>
                    )}
                  </td>
                  <td style={{ padding: '12px', color: '#a1a1aa', fontSize: '12px' }}>
                    {endpoint.schemas && endpoint.schemas.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {endpoint.schemas.map((schema) => (
                          <span
                            key={schema.id}
                            style={{
                              padding: '2px 6px',
                              backgroundColor: '#10b981',
                              borderRadius: '4px',
                              fontSize: '11px',
                            }}
                            title={schema.name}
                          >
                            {schema.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: '#71717a' }}>None</span>
                    )}
                  </td>
                  <td style={{ padding: '12px' }}>
                    {endpoint.isActive ? (
                      <span style={{ color: '#10b981' }}>Active</span>
                    ) : (
                      <span style={{ color: '#ef4444' }}>Inactive</span>
                    )}
                  </td>
                  <td style={{ padding: '12px', color: '#a1a1aa' }}>{formatDate(endpoint.createdAt)}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => handleViewLogs(endpoint.id)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#10b981',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        View Logs
                      </button>
                      <button
                        onClick={() => handleEdit(endpoint)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#3b82f6',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(endpoint.id)}
                        disabled={deletingId === endpoint.id}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: deletingId === endpoint.id ? '#3f3f46' : '#7f1d1d',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: deletingId === endpoint.id ? 'not-allowed' : 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        {deletingId === endpoint.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Call Logs Modal */}
      {viewingLogsFor && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          overflowY: 'auto',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#27272a',
            padding: '24px',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '1200px',
            maxHeight: '90vh',
            border: '1px solid #3f3f46',
            margin: 'auto',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#fff' }}>Call History</h2>
              <button
                onClick={() => {
                  setViewingLogsFor(null);
                  setCallLogs([]);
                  setLogsError('');
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#3f3f46',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>

            {logsError && (
              <div style={{
                padding: '12px',
                backgroundColor: '#7f1d1d',
                color: '#fca5a5',
                borderRadius: '6px',
                marginBottom: '20px'
              }}>
                {logsError}
              </div>
            )}

            {logsLoading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#a1a1aa' }}>Loading logs...</div>
            ) : callLogs.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#a1a1aa' }}>
                No call logs found for this endpoint.
              </div>
            ) : (
              <div style={{ overflowX: 'auto', flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#18181b', borderBottom: '1px solid #3f3f46' }}>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#fff', fontWeight: '600' }}>Time</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#fff', fontWeight: '600' }}>Method</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#fff', fontWeight: '600' }}>Status</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#fff', fontWeight: '600' }}>Response Time</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#fff', fontWeight: '600' }}>IP Address</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#fff', fontWeight: '600' }}>Error</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#fff', fontWeight: '600' }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {callLogs.map((log) => (
                      <tr key={log.id} style={{ borderBottom: '1px solid #3f3f46' }}>
                        <td style={{ padding: '12px', color: '#a1a1aa', fontSize: '12px' }}>
                          {formatDate(log.createdAt)}
                        </td>
                        <td style={{ padding: '12px', color: '#a1a1aa', fontFamily: 'monospace', fontSize: '12px' }}>
                          {log.method}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{
                            color: getStatusColor(log.status),
                            fontWeight: '600'
                          }}>
                            {log.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px', color: '#a1a1aa', fontSize: '12px' }}>
                          {log.responseTime}ms
                        </td>
                        <td style={{ padding: '12px', color: '#a1a1aa', fontSize: '12px', fontFamily: 'monospace' }}>
                          {log.ipAddress || 'N/A'}
                        </td>
                        <td style={{ padding: '12px', color: log.errorMessage ? '#ef4444' : '#71717a', fontSize: '12px' }}>
                          {log.errorMessage ? 'Yes' : 'No'}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <button
                            onClick={() => setSelectedLog(log)}
                            style={{
                              padding: '4px 8px',
                              backgroundColor: '#3b82f6',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Log Details Modal */}
      {selectedLog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#27272a',
            padding: '24px',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '800px',
            maxHeight: '90vh',
            border: '1px solid #3f3f46',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#fff' }}>Log Details</h3>
              <button
                onClick={() => setSelectedLog(null)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#3f3f46',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ color: '#a1a1aa', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Path</label>
                <div style={{ color: '#fff', fontFamily: 'monospace', fontSize: '14px', padding: '8px', backgroundColor: '#18181b', borderRadius: '4px' }}>
                  {selectedLog.path}
                </div>
              </div>

              <div>
                <label style={{ color: '#a1a1aa', fontSize: '12px', display: 'block', marginBottom: '4px' }}>User Agent</label>
                <div style={{ color: '#fff', fontSize: '14px', padding: '8px', backgroundColor: '#18181b', borderRadius: '4px' }}>
                  {selectedLog.userAgent || 'N/A'}
                </div>
              </div>

              {selectedLog.errorMessage && (
                <div>
                  <label style={{ color: '#ef4444', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Error Message</label>
                  <div style={{ color: '#fca5a5', fontSize: '14px', padding: '8px', backgroundColor: '#18181b', borderRadius: '4px' }}>
                    {selectedLog.errorMessage}
                  </div>
                </div>
              )}

              {selectedLog.requestBody && (
                <div>
                  <label style={{ color: '#a1a1aa', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Request Body</label>
                  <pre style={{
                    color: '#fff',
                    fontSize: '12px',
                    padding: '12px',
                    backgroundColor: '#18181b',
                    borderRadius: '4px',
                    overflow: 'auto',
                    maxHeight: '200px',
                    margin: 0,
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {selectedLog.requestBody}
                  </pre>
                </div>
              )}

              {selectedLog.responseBody && (
                <div>
                  <label style={{ color: '#a1a1aa', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Response Body</label>
                  <pre style={{
                    color: '#fff',
                    fontSize: '12px',
                    padding: '12px',
                    backgroundColor: '#18181b',
                    borderRadius: '4px',
                    overflow: 'auto',
                    maxHeight: '200px',
                    margin: 0,
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {selectedLog.responseBody}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
