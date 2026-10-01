import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

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
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0f172a', color: '#f8fafc' }}>
      <aside
        style={{
          width: 240,
          backgroundColor: '#090d16',
          borderRight: '1px solid #1e293b',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px 14px',
        }}
      >
        {/* EKLab Brand Header with Beaker Logo */}
        <div style={{ marginBottom: 28, padding: '0 8px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <svg
            viewBox="0 0 1024 1024"
            width="36"
            height="36"
            style={{ flexShrink: 0 }}
          >
            <g transform="translate(0.000000,1024.000000) scale(0.100000,-0.100000)" fill="#0d9488" stroke="none">
              <path d="M4524 8121 c-62 -4 -107 -11 -117 -20 -34 -28 -39 -82 -44 -539 l-6 -453 -31 -46 c-17 -26 -157 -176 -311 -333 -570 -580 -625 -641 -687 -763 -47 -94 -96 -255 -109 -361 -18 -150 -7 -387 24 -506 84 -321 293 -594 582 -760 93 -53 215 -102 340 -137 l100 -28 1025 0 c1151 0 1082 -4 1224 75 188 104 321 277 362 471 21 99 14 276 -16 374 -49 159 -72 187 -636 755 l-303 305 -4 945 c-2 520 -7 955 -11 968 -5 12 -23 30 -40 39 -28 15 -93 17 -636 19 -333 1 -650 -1 -706 -5z m1144 -246 c9 -3 12 -104 12 -457 l0 -453 -1044 -1044 -1044 -1044 -31 62 c-149 294 -149 701 0 954 30 50 120 148 362 395 521 529 589 603 625 674 18 34 37 86 43 113 6 28 13 217 16 430 l5 380 522 -3 c286 -2 527 -5 534 -7z m14 -1540 c5 -223 9 -279 21 -298 8 -12 202 -212 431 -445 228 -232 428 -442 444 -465 147 -215 74 -529 -149 -642 -125 -64 -145 -67 -401 -73 -131 -2 -259 -1 -285 2 -48 7 -51 9 -596 558 -301 304 -546 556 -545 560 5 12 1059 1078 1067 1078 5 0 10 -124 13 -275z m-787 -1456 l470 -470 -535 4 -535 4 -100 30 c-157 47 -295 117 -408 206 l-39 30 334 334 c183 183 335 333 338 333 3 0 217 -212 475 -471z"/>
            </g>
          </svg>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 1.2, color: '#14b8a6', lineHeight: 1.2 }}>
              EKLAB
            </div>
            <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1.5, color: '#64748b', textTransform: 'uppercase' }}>
              Vector Studio
            </div>
          </div>
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
                  color: active ? '#ffffff' : '#94a3b8',
                  backgroundColor: active ? '#0f766e' : 'transparent',
                  padding: '9px 12px',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  fontSize: 14,
                  fontWeight: active ? 600 : 500,
                  transition: 'all 0.15s ease',
                  borderLeft: active ? '3px solid #2dd4bf' : '3px solid transparent',
                }}
              >
                <span style={{ width: 18, textAlign: 'center', fontSize: 15, opacity: active ? 1 : 0.75 }}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User & Logout */}
        <div style={{ borderTop: '1px solid #1e293b', paddingTop: 16, fontSize: 13, color: '#94a3b8' }}>
          <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981' }} />
            <span style={{ fontWeight: 500, color: '#e2e8f0' }}>{username}</span>
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
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 8,
              color: '#e2e8f0',
              fontWeight: 500,
              fontSize: 13,
              transition: 'background-color 0.15s ease',
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#334155')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#1e293b')}
          >
            Logout
          </button>
        </div>
      </aside>
      <main style={{ flex: 1, padding: 32, overflowY: 'auto', backgroundColor: '#0f172a' }}>
        <Outlet />
      </main>
    </div>
  );
}
