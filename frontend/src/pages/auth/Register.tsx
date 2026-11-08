import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { BrandLogo } from '../../components/Common/BrandLogo';
import { TurnstileWidget } from '../../components/Common/TurnstileWidget';

export function RegisterPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { register } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await register(username, password, email, displayName, turnstileToken);
      navigate('/dashboard');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f7f6f3',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          padding: '40px',
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <BrandLogo width={168} />
        </div>
        <h1
          style={{
            textAlign: 'center',
            margin: '0 0 30px',
            color: '#111827',
            fontSize: 18,
            fontWeight: 600,
          }}
        >
          Register
        </h1>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <input
            type="text"
            placeholder="Username (min 3 chars)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={{
              padding: '10px',
              borderRadius: '6px',
              border: '1px solid #e5e7eb',
              backgroundColor: '#f7f6f3',
              color: '#111827',
              fontSize: '14px',
            }}
          />
          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              padding: '10px',
              borderRadius: '6px',
              border: '1px solid #e5e7eb',
              backgroundColor: '#f7f6f3',
              color: '#111827',
              fontSize: '14px',
            }}
          />
          <input
            type="text"
            placeholder="Display Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            style={{
              padding: '10px',
              borderRadius: '6px',
              border: '1px solid #e5e7eb',
              backgroundColor: '#f7f6f3',
              color: '#111827',
              fontSize: '14px',
            }}
          />
          <input
            type="password"
            placeholder="Password (min 8 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              padding: '10px',
              borderRadius: '6px',
              border: '1px solid #e5e7eb',
              backgroundColor: '#f7f6f3',
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
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            {loading ? 'Creating Account...' : 'Register'}
          </button>
        </form>
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <p style={{ color: '#111827', fontSize: '14px', margin: 0 }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#0d9488', textDecoration: 'none', fontWeight: 500 }}>
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
