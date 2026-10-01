import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      navigate('/dashboard');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
      <input
        type="text"
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
          fontSize: '14px'
        }}
      />
      <input
        type="password"
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
          fontSize: '14px'
        }}
      />
      {error && <p style={{ color: '#b91c1c', margin: 0, fontSize: '14px' }}>{error}</p>}
      <button
        type="submit"
        disabled={loading}
        style={{
          padding: '10px',
          cursor: loading ? 'not-allowed' : 'pointer',
          backgroundColor: loading ? '#e5e7eb' : '#0d9488',
          color: '#111827',
          border: 'none',
          borderRadius: '6px',
          fontWeight: '500'
        }}
      >
        {loading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
}
