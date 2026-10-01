import { useState, useEffect } from 'react';
import { ApiClient } from '../../services/api';
import { Autocomplete } from '../../components/Common/Autocomplete';
import { CrmPanel } from '../../components/CrmPanel';

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
  topicFilter?: { enabled: boolean; offTopicReply: string };
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

const DEFAULT_OFF_TOPIC =
  'I can only help with questions about this organization and its programs. Please ask about schedules, offerings, enrollment, or contact information.';

export function EndpointsPage() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState<Endpoint | null>(null);
  const [formData, setFormData] = useState({
    routeName: '',
    rateLimit: 100,
    rateLimitWindowMs: 60000,
    allowedOrigins: '',
    description: '',
    isActive: true,
    filterEnabled: true,
    offTopicReply: DEFAULT_OFF_TOPIC,
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
  const [crmEndpointId, setCrmEndpointId] = useState<string | null>(null);

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
        rateLimit: formData.rateLimit,
        rateLimitWindowMs: formData.rateLimitWindowMs,
        allowedOrigins: allowedOriginsArray,
        description: formData.description || null,
        isActive: formData.isActive,
        apiTokenIds: selectedTokens.map((t) => t.id),
        schemaIds: selectedSchemas.map((s) => s.id),
        topicFilter: {
          enabled: formData.filterEnabled,
          offTopicReply: formData.offTopicReply.trim() || DEFAULT_OFF_TOPIC,
        },
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
      rateLimit: endpoint.rateLimit,
      rateLimitWindowMs: endpoint.rateLimitWindowMs,
      allowedOrigins: endpoint.allowedOrigins.join(', '),
      description: endpoint.description || '',
      isActive: endpoint.isActive,
      filterEnabled: endpoint.topicFilter?.enabled ?? true,
      offTopicReply: endpoint.topicFilter?.offTopicReply || DEFAULT_OFF_TOPIC,
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
      rateLimit: 100,
      rateLimitWindowMs: 60000,
      allowedOrigins: '',
      description: '',
      isActive: true,
      filterEnabled: true,
      offTopicReply: DEFAULT_OFF_TOPIC,
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
      const response = await ApiClient.getLogs(endpointId, { limit: 100, sortOrder: 'desc' }) as { logs?: CallLog[] };
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
    return '#111827'; // gray
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#111827' }}>Endpoints</h1>
        <button
          onClick={() => {
            setShowCreateModal(true);
            setEditingEndpoint(null);
            resetForm();
          }}
          style={{
            padding: '8px 16px',
            backgroundColor: '#0d9488',
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
          backgroundColor: '#fef2f2',
          color: '#b91c1c',
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
            backgroundColor: '#ffffff',
            padding: '24px',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '600px',
            border: '1px solid #e5e7eb',
            margin: 'auto'
          }}>
            <h2 style={{ marginTop: 0, color: '#111827' }}>
              {editingEndpoint ? 'Edit Endpoint' : 'Create New Endpoint'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#111827' }}>
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
                    backgroundColor: '#f9fafb',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    color: '#111827',
                    fontSize: '14px'
                  }}
                  placeholder="e.g., Payment Webhook"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#111827' }}>
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
                      backgroundColor: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      color: '#111827',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#111827' }}>
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
                      backgroundColor: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      color: '#111827',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#111827' }}>
                  Allowed Origins (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.allowedOrigins}
                  onChange={(e) => setFormData({ ...formData, allowedOrigins: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#f9fafb',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    color: '#111827',
                    fontSize: '14px'
                  }}
                  placeholder="e.g., https://example.com, https://app.example.com"
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#111827' }}>
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#f9fafb',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    color: '#111827',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                  placeholder="Optional description"
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#111827' }}>
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
                <label style={{ display: 'block', marginBottom: '8px', color: '#111827' }}>
                  Schemas (Knowledge Base)
                </label>
                <Autocomplete
                  options={availableSchemas}
                  selected={selectedSchemas}
                  onChange={setSelectedSchemas}
                  placeholder="Select schemas..."
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#111827', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.filterEnabled}
                    onChange={(e) => setFormData({ ...formData, filterEnabled: e.target.checked })}
                  />
                  Restrict replies to attached knowledge
                </label>
                <textarea
                  value={formData.offTopicReply}
                  onChange={(e) => setFormData({ ...formData, offTopicReply: e.target.value })}
                  disabled={!formData.filterEnabled}
                  rows={3}
                  style={{
                    width: '100%',
                    marginTop: 8,
                    padding: 8,
                    backgroundColor: '#f9fafb',
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    color: formData.filterEnabled ? '#111827' : '#111827',
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  style={{ cursor: 'pointer' }}
                />
                <label style={{ color: '#111827', cursor: 'pointer' }}>Active</label>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '8px',
                    backgroundColor: '#0d9488',
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
                    backgroundColor: '#e5e7eb',
                    color: '#111827',
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
        <div style={{ padding: '40px', textAlign: 'center', color: '#111827' }}>Loading endpoints...</div>
      ) : endpoints.length === 0 ? (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          color: '#111827',
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}>
          No endpoints found. Create your first one!
        </div>
      ) : (
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          overflow: 'hidden'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '12px', textAlign: 'left', color: '#111827', fontWeight: '600' }}>Name</th>
                <th style={{ padding: '12px', textAlign: 'left', color: '#111827', fontWeight: '600' }}>User ID</th>
                <th style={{ padding: '12px', textAlign: 'left', color: '#111827', fontWeight: '600' }}>Endpoint ID</th>
                <th style={{ padding: '12px', textAlign: 'left', color: '#111827', fontWeight: '600' }}>Native Agent URL</th>
                <th style={{ padding: '12px', textAlign: 'left', color: '#111827', fontWeight: '600' }}>Rate Limit</th>
                <th style={{ padding: '12px', textAlign: 'left', color: '#111827', fontWeight: '600' }}>Tokens</th>
                <th style={{ padding: '12px', textAlign: 'left', color: '#111827', fontWeight: '600' }}>Schemas</th>
                <th style={{ padding: '12px', textAlign: 'left', color: '#111827', fontWeight: '600' }}>Topic filter</th>
                <th style={{ padding: '12px', textAlign: 'left', color: '#111827', fontWeight: '600' }}>Status</th>
                <th style={{ padding: '12px', textAlign: 'left', color: '#111827', fontWeight: '600' }}>Created</th>
                <th style={{ padding: '12px', textAlign: 'right', color: '#111827', fontWeight: '600' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map((endpoint) => (
                <tr key={endpoint.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '12px', color: '#111827' }}>{endpoint.routeName}</td>
                  <td style={{ padding: '12px', color: '#111827', fontFamily: 'monospace', fontSize: '12px' }}>{endpoint.userId}</td>
                  <td style={{ padding: '12px', color: '#111827', fontFamily: 'monospace', fontSize: '12px' }}>{endpoint.id}</td>
                  <td style={{ padding: '12px', color: '#0f766e', fontFamily: 'monospace', fontSize: '11px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span title="POST this path with x-api-key (same auth as n8n proxy)">
                        /api/v1/agents/{endpoint.id}/{endpoint.userId}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const path = `/api/v1/agents/${endpoint.id}/${endpoint.userId}`;
                          navigator.clipboard?.writeText(path);
                        }}
                        style={{
                          padding: '2px 6px',
                          fontSize: 11,
                          backgroundColor: '#e5e7eb',
                          color: '#111827',
                          border: 'none',
                          borderRadius: 4,
                          cursor: 'pointer',
                        }}
                      >
                        Copy
                      </button>
                    </div>
                  </td>
                  <td style={{ padding: '12px', color: '#111827' }}>
                    {endpoint.rateLimit} / {endpoint.rateLimitWindowMs / 1000}s
                  </td>
                  <td style={{ padding: '12px', color: '#111827', fontSize: '12px' }}>
                    {endpoint.apiTokens && endpoint.apiTokens.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {endpoint.apiTokens.map((token) => (
                          <span
                            key={token.id}
                            style={{
                              padding: '2px 6px',
                              backgroundColor: '#0d9488',
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
                      <span style={{ color: '#111827' }}>None</span>
                    )}
                  </td>
                  <td style={{ padding: '12px', color: '#111827', fontSize: '12px' }}>
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
                      <span style={{ color: '#111827' }}>None</span>
                    )}
                  </td>
                  <td style={{ padding: '12px', color: '#111827' }}>
                    {endpoint.topicFilter?.enabled === false ? 'Off' : 'On'}
                  </td>
                  <td style={{ padding: '12px' }}>
                    {endpoint.isActive ? (
                      <span style={{ color: '#10b981' }}>Active</span>
                    ) : (
                      <span style={{ color: '#ef4444' }}>Inactive</span>
                    )}
                  </td>
                  <td style={{ padding: '12px', color: '#111827' }}>{formatDate(endpoint.createdAt)}</td>
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
                        onClick={() => setCrmEndpointId(endpoint.id)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#0f766e',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        CRM
                      </button>
                      <button
                        onClick={() => handleEdit(endpoint)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#0d9488',
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
                          backgroundColor: deletingId === endpoint.id ? '#e5e7eb' : '#7f1d1d',
                          color: '#111827',
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
            backgroundColor: '#ffffff',
            padding: '24px',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '1200px',
            maxHeight: '90vh',
            border: '1px solid #e5e7eb',
            margin: 'auto',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#111827' }}>Call History</h2>
              <button
                onClick={() => {
                  setViewingLogsFor(null);
                  setCallLogs([]);
                  setLogsError('');
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#e5e7eb',
                  color: '#111827',
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
                backgroundColor: '#fef2f2',
                color: '#b91c1c',
                borderRadius: '6px',
                marginBottom: '20px'
              }}>
                {logsError}
              </div>
            )}

            {logsLoading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#111827' }}>Loading logs...</div>
            ) : callLogs.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#111827' }}>
                No call logs found for this endpoint.
              </div>
            ) : (
              <div style={{ overflowX: 'auto', flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#111827', fontWeight: '600' }}>Time</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#111827', fontWeight: '600' }}>Method</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#111827', fontWeight: '600' }}>Status</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#111827', fontWeight: '600' }}>Response Time</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#111827', fontWeight: '600' }}>IP Address</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#111827', fontWeight: '600' }}>Error</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#111827', fontWeight: '600' }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {callLogs.map((log) => (
                      <tr key={log.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '12px', color: '#111827', fontSize: '12px' }}>
                          {formatDate(log.createdAt)}
                        </td>
                        <td style={{ padding: '12px', color: '#111827', fontFamily: 'monospace', fontSize: '12px' }}>
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
                        <td style={{ padding: '12px', color: '#111827', fontSize: '12px' }}>
                          {log.responseTime}ms
                        </td>
                        <td style={{ padding: '12px', color: '#111827', fontSize: '12px', fontFamily: 'monospace' }}>
                          {log.ipAddress || 'N/A'}
                        </td>
                        <td style={{ padding: '12px', color: log.errorMessage ? '#ef4444' : '#111827', fontSize: '12px' }}>
                          {log.errorMessage ? 'Yes' : 'No'}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <button
                            onClick={() => setSelectedLog(log)}
                            style={{
                              padding: '4px 8px',
                              backgroundColor: '#0d9488',
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
            backgroundColor: '#ffffff',
            padding: '24px',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '800px',
            maxHeight: '90vh',
            border: '1px solid #e5e7eb',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#111827' }}>Log Details</h3>
              <button
                onClick={() => setSelectedLog(null)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#e5e7eb',
                  color: '#111827',
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
                <label style={{ color: '#111827', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Path</label>
                <div style={{ color: '#111827', fontFamily: 'monospace', fontSize: '14px', padding: '8px', backgroundColor: '#f9fafb', borderRadius: '4px' }}>
                  {selectedLog.path}
                </div>
              </div>

              <div>
                <label style={{ color: '#111827', fontSize: '12px', display: 'block', marginBottom: '4px' }}>User Agent</label>
                <div style={{ color: '#111827', fontSize: '14px', padding: '8px', backgroundColor: '#f9fafb', borderRadius: '4px' }}>
                  {selectedLog.userAgent || 'N/A'}
                </div>
              </div>

              {selectedLog.errorMessage && (
                <div>
                  <label style={{ color: '#ef4444', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Error Message</label>
                  <div style={{ color: '#b91c1c', fontSize: '14px', padding: '8px', backgroundColor: '#f9fafb', borderRadius: '4px' }}>
                    {selectedLog.errorMessage}
                  </div>
                </div>
              )}

              {selectedLog.requestBody && (
                <div>
                  <label style={{ color: '#111827', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Request Body</label>
                  <pre style={{
                    color: '#111827',
                    fontSize: '12px',
                    padding: '12px',
                    backgroundColor: '#f9fafb',
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
                  <label style={{ color: '#111827', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Response Body</label>
                  <pre style={{
                    color: '#111827',
                    fontSize: '12px',
                    padding: '12px',
                    backgroundColor: '#f9fafb',
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
      {crmEndpointId && (
        <CrmPanel endpointId={crmEndpointId} onClose={() => setCrmEndpointId(null)} />
      )}
    </div>
  );
}
