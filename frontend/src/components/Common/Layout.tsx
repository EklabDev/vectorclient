import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export function Layout() {
  const { logout, username } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#18181b' }}>
      {/* Sidebar */}
      <aside style={{ width: '250px', backgroundColor: '#27272a', padding: '20px', borderRight: '1px solid #3f3f46' }}>
        <div style={{ marginBottom: '40px' }}>
          <h2 style={{ margin: 0, color: '#fff' }}>API Gateway</h2>
          <p style={{ margin: 0, fontSize: '14px', color: '#a1a1aa' }}>Workspace</p>
        </div>
        
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Link 
            to="/dashboard" 
            style={{ 
              textDecoration: 'none', 
              color: isActive('/dashboard') ? '#fff' : '#a1a1aa',
              fontWeight: isActive('/dashboard') ? 'bold' : 'normal',
              padding: '8px 12px',
              borderRadius: '6px',
              backgroundColor: isActive('/dashboard') ? '#3f3f46' : 'transparent'
            }}
          >
            Dashboard
          </Link>
          <Link 
            to="/endpoints" 
            style={{ 
              textDecoration: 'none', 
              color: isActive('/endpoints') ? '#fff' : '#a1a1aa',
              fontWeight: isActive('/endpoints') ? 'bold' : 'normal',
               padding: '8px 12px',
              borderRadius: '6px',
              backgroundColor: isActive('/endpoints') ? '#3f3f46' : 'transparent'
            }}
          >
            Endpoints
          </Link>
          <Link 
            to="/schemas" 
            style={{ 
              textDecoration: 'none', 
              color: isActive('/schemas') ? '#fff' : '#a1a1aa',
              fontWeight: isActive('/schemas') ? 'bold' : 'normal',
               padding: '8px 12px',
              borderRadius: '6px',
              backgroundColor: isActive('/schemas') ? '#3f3f46' : 'transparent'
            }}
          >
            Schemas (Knowledge)
          </Link>
           <Link 
            to="/tokens" 
            style={{ 
              textDecoration: 'none', 
              color: isActive('/tokens') ? '#fff' : '#a1a1aa',
              fontWeight: isActive('/tokens') ? 'bold' : 'normal',
               padding: '8px 12px',
              borderRadius: '6px',
              backgroundColor: isActive('/tokens') ? '#3f3f46' : 'transparent'
            }}
          >
            API Tokens
          </Link>
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid #3f3f46' }}>
           <div style={{ marginBottom: '10px', fontSize: '14px', color: '#a1a1aa' }}>
             User: <strong style={{ color: '#fff' }}>{username}</strong>
           </div>
           <button 
             onClick={handleLogout}
             style={{ 
               width: '100%', 
               padding: '8px', 
               cursor: 'pointer', 
               backgroundColor: '#3f3f46', 
               border: '1px solid #52525b',
               borderRadius: '6px',
               color: '#fff'
             }}
           >
             Logout
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '40px', overflowY: 'auto', backgroundColor: '#18181b', color: '#fff' }}>
        <Outlet />
      </main>
    </div>
  );
}
