import { useState, useEffect } from 'react';
import { ApiClient } from '../services/api';

interface Token {
  id: string;
  tokenName: string;
  tokenPrefix: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  expiresAt: string | null;
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

export function TokensPage() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [newTokenExpiresIn, setNewTokenExpiresIn] = useState<number | undefined>(undefined);
  const [createdToken, setCreatedToken] = useState<{ token: string; tokenId: string } | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [viewingUsageFor, setViewingUsageFor] = useState<string | null>(null);
  const [tokenLogs, setTokenLogs] = useState<CallLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState('');
  const [selectedLog, setSelectedLog] = useState<CallLog | null>(null);

  useEffect(() => {
    loadTokens();
  }, []);

  const loadTokens = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await ApiClient.getTokens();
      setTokens(data as Token[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      const result = await ApiClient.createToken(newTokenName, newTokenExpiresIn) as { token: string; tokenId: string };
      setCreatedToken({ token: result.token, tokenId: result.tokenId });
      setNewTokenName('');
      setNewTokenExpiresIn(undefined);
      await loadTokens();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleRevokeToken = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this token? This action cannot be undone.')) {
      return;
    }
    try {
      setRevokingId(id);
      setError('');
      await ApiClient.revokeToken(id);
      await loadTokens();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRevokingId(null);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const loadTokenLogs = async (tokenId: string) => {
    try {
      setLogsLoading(true);
      setLogsError('');
      const response = await ApiClient.getTokenLogs(tokenId, { limit: 100, sortOrder: 'desc' }) as { logs?: CallLog[] };
      if (response && response.logs) {
        setTokenLogs(response.logs);
      } else {
        setTokenLogs([]);
      }
    } catch (err) {
      setLogsError((err as Error).message);
      setTokenLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleViewUsage = (tokenId: string) => {
    setViewingUsageFor(tokenId);
    loadTokenLogs(tokenId);
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
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#fff' }}>API Tokens</h1>
        <button
          onClick={() => {
            setShowCreateModal(true);
            setCreatedToken(null);
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
          Generate Token
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
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#27272a',
            padding: '24px',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '500px',
            border: '1px solid #3f3f46'
          }}>
            {createdToken ? (
              <div>
                <h2 style={{ marginTop: 0, color: '#fff' }}>Token Created</h2>
                <p style={{ color: '#a1a1aa', marginBottom: '12px' }}>
                  <strong style={{ color: '#fbbf24' }}>Important:</strong> Copy this token now. You won't be able to see it again!
                </p>
                <div style={{
                  padding: '12px',
                  backgroundColor: '#18181b',
                  borderRadius: '6px',
                  marginBottom: '16px',
                  border: '1px solid #3f3f46',
                  wordBreak: 'break-all',
                  fontFamily: 'monospace',
                  color: '#10b981'
                }}>
                  {createdToken.token}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(createdToken.token);
                    alert('Token copied to clipboard!');
                  }}
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    marginBottom: '12px'
                  }}
                >
                  Copy Token
                </button>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreatedToken(null);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px',
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
            ) : (
              <form onSubmit={handleCreateToken}>
                <h2 style={{ marginTop: 0, color: '#fff' }}>Create New Token</h2>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#a1a1aa' }}>
                    Token Name
                  </label>
                  <input
                    type="text"
                    value={newTokenName}
                    onChange={(e) => setNewTokenName(e.target.value)}
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
                    placeholder="e.g., Production API Key"
                  />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#a1a1aa' }}>
                    Expires In (days, optional)
                  </label>
                  <input
                    type="number"
                    value={newTokenExpiresIn || ''}
                    onChange={(e) => setNewTokenExpiresIn(e.target.value ? parseInt(e.target.value) : undefined)}
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
                    placeholder="Leave empty for no expiration"
                  />
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
                    Create Token
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
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
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#a1a1aa' }}>Loading tokens...</div>
      ) : tokens.length === 0 ? (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          color: '#a1a1aa',
          backgroundColor: '#27272a',
          borderRadius: '8px',
          border: '1px solid #3f3f46'
        }}>
          No active tokens. Generate one to access your endpoints securely.
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
                <th style={{ padding: '12px', textAlign: 'left', color: '#fff', fontWeight: '600' }}>Prefix</th>
                <th style={{ padding: '12px', textAlign: 'left', color: '#fff', fontWeight: '600' }}>Status</th>
                <th style={{ padding: '12px', textAlign: 'left', color: '#fff', fontWeight: '600' }}>Last Used</th>
                <th style={{ padding: '12px', textAlign: 'left', color: '#fff', fontWeight: '600' }}>Expires</th>
                <th style={{ padding: '12px', textAlign: 'left', color: '#fff', fontWeight: '600' }}>Created</th>
                <th style={{ padding: '12px', textAlign: 'right', color: '#fff', fontWeight: '600' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((token) => (
                <tr key={token.id} style={{ borderBottom: '1px solid #3f3f46' }}>
                  <td style={{ padding: '12px', color: '#fff' }}>{token.tokenName}</td>
                  <td style={{ padding: '12px', color: '#a1a1aa', fontFamily: 'monospace' }}>{token.tokenPrefix}...</td>
                  <td style={{ padding: '12px' }}>
                    {!token.isActive ? (
                      <span style={{ color: '#ef4444' }}>Revoked</span>
                    ) : isExpired(token.expiresAt) ? (
                      <span style={{ color: '#f59e0b' }}>Expired</span>
                    ) : (
                      <span style={{ color: '#10b981' }}>Active</span>
                    )}
                  </td>
                  <td style={{ padding: '12px', color: '#a1a1aa' }}>{formatDate(token.lastUsedAt)}</td>
                  <td style={{ padding: '12px', color: '#a1a1aa' }}>
                    {token.expiresAt ? formatDate(token.expiresAt) : 'Never'}
                  </td>
                  <td style={{ padding: '12px', color: '#a1a1aa' }}>{formatDate(token.createdAt)}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => handleViewUsage(token.id)}
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
                        View Usage
                      </button>
                      {token.isActive && (
                        <button
                          onClick={() => handleRevokeToken(token.id)}
                          disabled={revokingId === token.id}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: revokingId === token.id ? '#3f3f46' : '#7f1d1d',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: revokingId === token.id ? 'not-allowed' : 'pointer',
                            fontSize: '14px'
                          }}
                        >
                          {revokingId === token.id ? 'Revoking...' : 'Revoke'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Token Usage Modal */}
      {viewingUsageFor && (
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
              <h2 style={{ margin: 0, color: '#fff' }}>Token Usage History</h2>
              <button
                onClick={() => {
                  setViewingUsageFor(null);
                  setTokenLogs([]);
                  setLogsError('');
                  setSelectedLog(null);
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
              <div style={{ padding: '40px', textAlign: 'center', color: '#a1a1aa' }}>Loading usage history...</div>
            ) : tokenLogs.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#a1a1aa' }}>
                No usage history found for this token.
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
                    {tokenLogs.map((log) => (
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
