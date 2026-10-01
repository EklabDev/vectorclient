import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { BrandLogo } from './BrandLogo';

const NAV = [
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
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f7f6f3', color: '#111827' }}>
      <aside
        style={{
          width: 240,
          backgroundColor: '#ffffff',
          borderRight: '1px solid #e5e7eb',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px 14px',
        }}
      >
        <div style={{ marginBottom: 28, padding: '4px 8px' }}>
          <BrandLogo width={148} />
        </div>

        {/* Navigation */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          {NAV.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                style={{
                  textDecoration: 'none',
                  color: active ? '#ffffff' : '#111827',
                  backgroundColor: active ? '#0d9488' : 'transparent',
                  padding: '9px 12px',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  fontSize: 14,
                  fontWeight: active ? 600 : 500,
                  transition: 'all 0.15s ease',
                  borderLeft: active ? '3px solid #0f766e' : '3px solid transparent',
                }}
              >
                <span style={{ width: 18, textAlign: 'center', fontSize: 15, color: active ? '#ffffff' : '#111827' }}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User & Logout */}
        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16, fontSize: 13, color: '#111827' }}>
          <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981' }} />
            <span style={{ fontWeight: 500, color: '#111827' }}>{username}</span>
          </div>
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            style={{
              width: '100%',
              padding: '9px 12px',
              cursor: 'pointer',
              backgroundColor: '#f3f4f6',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              color: '#111827',
              fontWeight: 500,
              fontSize: 13,
              transition: 'background-color 0.15s ease',
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#e5e7eb')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
          >
            Logout
          </button>
        </div>
      </aside>
      <main style={{ flex: 1, padding: 32, overflowY: 'auto', backgroundColor: '#f7f6f3' }}>
        <Outlet />
      </main>
    </div>
  );
}
