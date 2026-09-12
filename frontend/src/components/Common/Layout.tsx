import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

const NAV = [
  { to: '/query', label: 'Query', icon: '⌘' },
  { to: '/database', label: 'Database', icon: '◈' },
  { to: '/dashboard', label: 'Dashboard', icon: '▣' },
  { to: '/endpoints', label: 'Endpoints', icon: '↗' },
  { to: '/schemas', label: 'Knowledge', icon: '☰' },
  { to: '/scrape', label: 'Scrape', icon: '◎' },
  { to: '/tokens', label: 'Tokens', icon: '⚿' },
];

export function Layout() {
  const { logout, username } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#1a1c22', color: '#e8eaed' }}>
      <aside
        style={{
          width: 220,
          backgroundColor: '#12141a',
          borderRight: '1px solid #2a2e38',
          display: 'flex',
          flexDirection: 'column',
          padding: '16px 12px',
        }}
      >
        <div style={{ marginBottom: 28, padding: '0 8px' }}>
          <div style={{ fontSize: 13, letterSpacing: 1.4, color: '#8b93a7' }}>ARCADE STUDIO</div>
          <h2 style={{ margin: '4px 0 0', fontSize: 18, color: '#fff' }}>VectorClient</h2>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          {NAV.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                style={{
                  textDecoration: 'none',
                  color: active ? '#fff' : '#9aa3b5',
                  backgroundColor: active ? '#2a3142' : 'transparent',
                  padding: '8px 10px',
                  borderRadius: 6,
                  display: 'flex',
                  gap: 10,
                  fontSize: 14,
                }}
              >
                <span style={{ width: 18, textAlign: 'center', opacity: 0.8 }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div style={{ borderTop: '1px solid #2a2e38', paddingTop: 12, fontSize: 13, color: '#9aa3b5' }}>
          <div style={{ marginBottom: 8 }}>
            {username}
          </div>
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            style={{
              width: '100%',
              padding: 8,
              cursor: 'pointer',
              backgroundColor: '#2a2e38',
              border: '1px solid #3a4150',
              borderRadius: 6,
              color: '#fff',
            }}
          >
            Logout
          </button>
        </div>
      </aside>
      <main style={{ flex: 1, padding: 28, overflowY: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
}
