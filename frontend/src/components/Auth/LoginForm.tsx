import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { TurnstileWidget } from '../Common/TurnstileWidget';

export function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 2FA Challenge state
  const [requires2FA, setRequires2FA] = useState(false);
  const [preAuthToken, setPreAuthToken] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');

  const navigate = useNavigate();
  const { login, verify2FA } = useAuthStore();

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await login(username, password, turnstileToken);
      if (res.requires2FA && res.preAuthToken) {
        setRequires2FA(true);
        setPreAuthToken(res.preAuthToken);
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await verify2FA(preAuthToken, twoFactorCode);
      navigate('/dashboard');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (requires2FA) {
    return (
      <form id="twoFactorForm" name="twoFactorForm" onSubmit={handle2FASubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div style={{ textAlign: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>🔐</div>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 6px', color: '#111827' }}>
            Two-Factor Authentication
          </h2>
          <label htmlFor="totp" style={{ fontSize: 13, color: '#6b7280', margin: 0, display: 'block' }}>
            Enter the 6-digit code from your authenticator app or an 8-character recovery backup code.
          </label>
        </div>

        <input
          id="totp"
          name="totp"
          type="text"
          placeholder="e.g. 123456 or a1b2-c3d4"
          value={twoFactorCode}
          onChange={(e) => setTwoFactorCode(e.target.value)}
          autoFocus
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={10}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          style={{
            padding: '12px',
            borderRadius: '6px',
            border: '1px solid #e5e7eb',
            backgroundColor: '#f9fafb',
            color: '#111827',
            fontSize: '16px',
            letterSpacing: '2px',
            textAlign: 'center',
            fontWeight: 600,
          }}
        />

        {error && (
          <p style={{ color: '#b91c1c', margin: 0, fontSize: '13px', textAlign: 'center' }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !twoFactorCode.trim()}
          style={{
            padding: '10px',
            cursor: loading ? 'not-allowed' : 'pointer',
            backgroundColor: loading ? '#9ca3af' : '#0d9488',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 600,
            fontSize: '14px',
          }}
        >
          {loading ? 'Verifying...' : 'Verify & Continue'}
        </button>

        <button
          type="button"
          onClick={() => {
            setRequires2FA(false);
            setPreAuthToken('');
            setTwoFactorCode('');
            setError('');
          }}
          style={{
            background: 'none',
            border: 'none',
            color: '#6b7280',
            fontSize: '13px',
            cursor: 'pointer',
            textDecoration: 'underline',
            marginTop: 4,
          }}
        >
          Back to standard login
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
      <input
        type="text"
        id="username"
        name="username"
        autoComplete="username"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
        style={{
          padding: '10px',
          borderRadius: '6px',
          border: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb',
          color: '#111827',
          fontSize: '14px',
        }}
      />
      <input
        type="password"
        id="password"
        name="password"
        autoComplete="current-password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        style={{
          padding: '10px',
          borderRadius: '6px',
          border: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb',
          color: '#111827',
          fontSize: '14px',
        }}
      />

      <TurnstileWidget
        onVerify={(token) => setTurnstileToken(token)}
        onExpire={() => setTurnstileToken(null)}
      />

      {error && (
        <div
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            borderRadius: 6,
            padding: '8px 12px',
            fontSize: '13px',
            lineHeight: 1.4,
          }}
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        style={{
          padding: '10px',
          cursor: loading ? 'not-allowed' : 'pointer',
          backgroundColor: loading ? '#9ca3af' : '#0d9488',
          color: '#ffffff',
          border: 'none',
          borderRadius: '6px',
          fontWeight: 600,
          fontSize: '14px',
        }}
      >
        {loading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
}
