import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export function RegisterPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const { register } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await register(username, password, email, displayName);
      navigate('/dashboard');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh', 
      backgroundColor: '#18181b' 
    }}>
      <div style={{ 
        width: '100%', 
        maxWidth: '400px', 
        padding: '40px', 
        backgroundColor: '#27272a', 
        borderRadius: '8px', 
        border: '1px solid #3f3f46',
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)' 
      }}>
        <h1 style={{ textAlign: 'center', marginBottom: '30px', color: '#fff' }}>Register</h1>
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
              border: '1px solid #3f3f46',
              backgroundColor: '#18181b',
              color: '#fff',
              fontSize: '14px'
            }}
          />
           <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              padding: '10px',
              borderRadius: '6px',
              border: '1px solid #3f3f46',
              backgroundColor: '#18181b',
              color: '#fff',
              fontSize: '14px'
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
              border: '1px solid #3f3f46',
              backgroundColor: '#18181b',
              color: '#fff',
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
              border: '1px solid #3f3f46',
              backgroundColor: '#18181b',
              color: '#fff',
              fontSize: '14px'
            }}
          />
          {error && <p style={{ color: '#fca5a5', margin: 0, fontSize: '14px' }}>{error}</p>}
          <button 
            type="submit" 
            disabled={loading}
            style={{
              padding: '10px',
              cursor: loading ? 'not-allowed' : 'pointer',
              backgroundColor: loading ? '#3f3f46' : '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: '500'
            }}
          >
            {loading ? 'Creating Account...' : 'Register'}
          </button>
        </form>
         <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <p style={{ color: '#a1a1aa' }}>
            Already have an account? <Link to="/login" style={{ color: '#3b82f6' }}>Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
