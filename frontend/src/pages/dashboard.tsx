import { useState, useEffect } from 'react';
import { ApiClient } from '../services/api';

export function DashboardPage() {
  const [stats, setStats] = useState({
    totalEndpoints: 0,
    activeTokens: 0,
    requests24h: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch endpoints
      let endpoints = [];
      try {
        const endpointsData = await ApiClient.getEndpoints();
        endpoints = Array.isArray(endpointsData) ? endpointsData : [];
      } catch (err) {
        // If endpoints endpoint is not implemented, just use empty array
        endpoints = [];
      }

      // Fetch tokens
      let tokens = [];
      try {
        const tokensData = await ApiClient.getTokens();
        tokens = Array.isArray(tokensData) ? tokensData : [];
      } catch (err) {
        tokens = [];
      }

      // Count active tokens
      const activeTokens = tokens.filter((token: any) => token.isActive && (!token.expiresAt || new Date(token.expiresAt) > new Date())).length;

      // Fetch requests count for last 24 hours
      let requests24h = 0;
      try {
        const statsData = await ApiClient.getRequests24h() as { count?: number };
        requests24h = statsData.count || 0;
      } catch (err) {
        // If stats endpoint fails, just use 0
        requests24h = 0;
      }

      setStats({
        totalEndpoints: endpoints.length,
        activeTokens,
        requests24h,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px', color: '#fff' }}>Dashboard</h1>

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

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#a1a1aa' }}>Loading dashboard...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          <div style={{
            padding: '20px',
            backgroundColor: '#27272a',
            borderRadius: '8px',
            border: '1px solid #3f3f46'
          }}>
            <h3 style={{ marginTop: 0, color: '#a1a1aa', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
              Total Endpoints
            </h3>
            <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0', color: '#fff' }}>
              {stats.totalEndpoints}
            </p>
          </div>
          <div style={{
            padding: '20px',
            backgroundColor: '#27272a',
            borderRadius: '8px',
            border: '1px solid #3f3f46'
          }}>
            <h3 style={{ marginTop: 0, color: '#a1a1aa', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
              Active Tokens
            </h3>
            <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0', color: '#fff' }}>
              {stats.activeTokens}
            </p>
          </div>
          <div style={{
            padding: '20px',
            backgroundColor: '#27272a',
            borderRadius: '8px',
            border: '1px solid #3f3f46'
          }}>
            <h3 style={{ marginTop: 0, color: '#a1a1aa', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
              Requests (24h)
            </h3>
            <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0', color: '#fff' }}>
              {stats.requests24h}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
