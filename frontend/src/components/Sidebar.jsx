import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const NAV = [
  { section: 'Principal', items: [
    { to: '/',            icon: '◈', label: 'Dashboard' },
    { to: '/campanhas',   icon: '◉', label: 'Campanhas', badge: true },
    { to: '/novo',        icon: '✦', label: 'Nova Análise' },
  ]},
  { section: 'Conta', items: [
    { to: '/plataformas', icon: '⊕', label: 'Plataformas' },
  ]},
];

export default function Sidebar({ campCount = 0 }) {
  const navigate  = useNavigate();
  const location  = useLocation();

  function logout() {
    localStorage.removeItem('token');
    navigate('/login');
  }

  return (
    <aside style={{
      width: '220px',
      minHeight: '100vh',
      background: '#fff',
      borderRight: '1px solid #F0DEDE',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      top: 0, left: 0, zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid #F8ECEC' }}>
        <img
          src="/logo.png"
          alt="Cris Costa Beauty"
          onError={e => {
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'block';
          }}
          style={{ height: '40px', objectFit: 'contain', display: 'block' }}
        />
        <div style={{ display: 'none', fontSize: '20px', fontWeight: 700, color: '#4A2535', fontFamily: 'Georgia, serif' }}>
          Cris<span style={{ color: '#C98B83' }}>Costa</span>
        </div>
        <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: '#C4A09A', marginTop: '8px' }}>
          Gestor de Tráfego
        </div>
      </div>

      {/* Nav */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 0' }}>
        {NAV.map(group => (
          <div key={group.section} style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#D4B0B0', padding: '4px 8px 6px' }}>
              {group.section}
            </div>
            {group.items.map(item => {
              const active = location.pathname === item.to
                || (item.to === '/campanhas' && location.pathname.startsWith('/campanhas'));
              return (
                <div
                  key={item.to}
                  onClick={() => navigate(item.to)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '9px 10px',
                    borderRadius: '10px',
                    color: active ? '#4A2535' : '#9A7070',
                    background: active ? '#F8E8E8' : 'transparent',
                    fontSize: '13px',
                    fontWeight: active ? 600 : 400,
                    cursor: 'pointer',
                    marginBottom: '2px',
                    transition: 'all .15s',
                    position: 'relative',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#FDF4F4'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                >
                  {active && (
                    <span style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: '3px', height: '18px', background: '#C98B83', borderRadius: '0 3px 3px 0' }} />
                  )}
                  <span style={{ fontSize: '14px', color: active ? '#C98B83' : '#D4B0B0', fontWeight: 400 }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge && campCount > 0 && (
                    <span style={{ background: '#F5E0E0', color: '#C98B83', fontSize: '10px', fontWeight: 700, padding: '1px 7px', borderRadius: '10px', border: '1px solid #EDCECE' }}>
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
      <div style={{ padding: '12px', borderTop: '1px solid #F8ECEC' }}>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '10px', cursor: 'pointer', marginBottom: '4px', transition: 'background .15s' }}
          onMouseEnter={e => e.currentTarget.style.background = '#FDF4F4'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <div style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, #E8A4A4, #C98B83)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>
            CC
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#4A2535' }}>Cris Costa</div>
            <div style={{ fontSize: '10px', color: '#C4A09A' }}>Admin</div>
          </div>
        </div>
        <div
          onClick={logout}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '10px', cursor: 'pointer', fontSize: '12px', color: '#C4A09A', transition: 'all .15s' }}
          onMouseEnter={e => e.currentTarget.style.background = '#FDF4F4'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ fontSize: '13px' }}>⎋</span>
          <span>Sair da conta</span>
        </div>
      </div>
    </aside>
  );
}
