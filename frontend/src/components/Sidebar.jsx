import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const NAV = [
  { section: 'Principal', items: [
    { to: '/',           icon: '📊', label: 'Dashboard' },
    { to: '/campanhas',  icon: '📣', label: 'Campanhas', badge: true },
    { to: '/novo',       icon: '✨', label: 'Novo Anúncio' },
  ]},
  { section: 'Conta', items: [
    { to: '/plataformas', icon: '🔗', label: 'Plataformas' },
  ]},
];

export default function Sidebar({ campCount = 0 }) {
  const navigate = useNavigate();
  const location = useLocation();

  function logout() {
    localStorage.removeItem('token');
    navigate('/login');
  }

  return (
    <aside style={{
      width: '230px', minHeight: '100vh', background: 'var(--wine)',
      display: 'flex', flexDirection: 'column', position: 'fixed',
      top: 0, left: 0, zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ padding: '22px 18px 18px', borderBottom: '1px solid rgba(255,255,255,.09)' }}>
        <img
          src="/logo.png"
          alt="Cris Costa Beauty"
          onError={e => { e.target.style.display = 'none'; }}
          style={{ width: '140px', display: 'block', marginBottom: '12px', filter: 'brightness(0) invert(1) sepia(.15) saturate(.5) brightness(1.4)', opacity: .88 }}
        />
        <div style={{ color: 'rgba(255,255,255,.38)', fontSize: '10px', fontWeight: 600, letterSpacing: '1.4px', textTransform: 'uppercase', marginBottom: '1px' }}>Gestor de Tráfego</div>
        <div style={{ color: 'rgba(255,255,255,.55)', fontSize: '12px' }}>AdManager</div>
      </div>

      {/* Nav */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {NAV.map(group => (
          <div key={group.section} style={{ padding: '12px 10px 6px' }}>
            <div style={{ color: 'rgba(255,255,255,.3)', fontSize: '10px', fontWeight: 600, letterSpacing: '1.2px', textTransform: 'uppercase', padding: '0 8px', marginBottom: '5px' }}>
              {group.section}
            </div>
            {group.items.map(item => {
              const active = location.pathname === item.to || (item.to === '/campanhas' && location.pathname.startsWith('/campanhas'));
              return (
                <div
                  key={item.to}
                  onClick={() => navigate(item.to)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '9px',
                    padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                    color: active ? '#fff' : 'rgba(255,255,255,.6)',
                    background: active ? 'var(--rose-deep)' : 'transparent',
                    fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                    marginBottom: '2px', transition: 'all .15s',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,.08)'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge && campCount > 0 && (
                    <span style={{ background: 'rgba(255,255,255,.18)', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '10px' }}>
                      {campCount}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ padding: '14px 10px', borderTop: '1px solid rgba(255,255,255,.08)' }}>
        <div
          onClick={logout}
          style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '8px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.07)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <div style={{ width: '32px', height: '32px', background: 'var(--rose-deep)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '13px', fontWeight: 700, flexShrink: 0 }}>CC</div>
          <div>
            <div style={{ color: '#fff', fontSize: '12px', fontWeight: 600 }}>Cris Costa</div>
            <div style={{ color: 'rgba(255,255,255,.4)', fontSize: '11px' }}>Sair →</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
