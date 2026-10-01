import { LoginForm } from '../../components/Auth/LoginForm';
import { Link } from 'react-router-dom';
import { BrandLogo } from '../../components/Common/BrandLogo';

export function LoginPage() {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh', 
      backgroundColor: '#f7f6f3' 
    }}>
      <div style={{ 
        width: '100%', 
        maxWidth: '400px', 
        padding: '40px', 
        backgroundColor: '#ffffff', 
        borderRadius: '8px', 
        border: '1px solid #e5e7eb',
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08)' 
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <BrandLogo width={168} />
        </div>
        <h1 style={{ textAlign: 'center', margin: '0 0 30px', color: '#111827', fontSize: 18, fontWeight: 600 }}>Login</h1>
        <LoginForm />
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <p style={{ color: '#111827' }}>
            Don't have an account? <Link to="/register" style={{ color: '#0d9488' }}>Register</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
