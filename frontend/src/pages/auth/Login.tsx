import { LoginForm } from '../../components/Auth/LoginForm';
import { Link } from 'react-router-dom';

export function LoginPage() {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh', 
      backgroundColor: '#0f172a' 
    }}>
      <div style={{ 
        width: '100%', 
        maxWidth: '400px', 
        padding: '40px', 
        backgroundColor: '#1e293b', 
        borderRadius: '8px', 
        border: '1px solid #334155',
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)' 
      }}>
        <h1 style={{ textAlign: 'center', marginBottom: '30px', color: '#fff' }}>Login</h1>
        <LoginForm />
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <p style={{ color: '#a1a1aa' }}>
            Don't have an account? <Link to="/register" style={{ color: '#14b8a6' }}>Register</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
