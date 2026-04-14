import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

const NAV = [
  { section: 'Principal', items: [
    { to: '/',            icon: '◈', label: 'Dashboard' },
    { to: '/campanhas',   icon: '◉', label: 'Campanhas', badge: true },
    { to: '/calendario',  icon: '◻', label: 'Calendário' },
    { to: '/novo',        icon: '✦', label: 'Nova Campanha' },
  ]},
  { section: 'Conta', items: [
    { to: '/plataformas', icon: '⊕', label: 'Plataformas' },
  ]},
];

export default function Sidebar({ campCount = 0 }) {
  const navigate      = useNavigate();
  const location      = useLocation();
  const { isDark, toggle } = useTheme();

  function logout() {
    localStorage.removeItem('token');
    navigate('/login');
  }

  return (
    <aside style={{
      width: '220px',
      minHeight: '100vh',
      background: 'var(--c-sidebar-bg)',
      borderRight: '1px solid var(--c-border)',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      top: 0, left: 0, zIndex: 100,
      transition: 'background .25s ease, border-color .25s ease',
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid var(--c-border-lt)' }}>
        <img
          src="/logo.png"
          alt="Cris Costa Beauty"
          onError={e => {
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'block';
          }}
          style={{
            height: '40px',
            objectFit: 'contain',
            display: 'block',
            filter: isDark ? 'brightness(0) invert(1) sepia(.1) saturate(.6) brightness(.85)' : 'none',
          }}
        />
        <div style={{ display: 'none', fontSize: '20px', fontWeight: 700, color: 'var(--c-text-1)', fontFamily: 'Georgia, serif' }}>
          Cris<span style={{ color: 'var(--c-accent)' }}>Costa</span>
        </div>
        <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--c-text-4)', marginTop: '8px' }}>
          Gestor de Tráfego
        </div>
      </div>

      {/* Nav */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 0' }}>
        {NAV.map(group => (
          <div key={group.section} style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--c-text-4)', padding: '4px 8px 6px' }}>
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
                    color: active ? 'var(--c-text-1)' : 'var(--c-text-3)',
                    background: active ? 'var(--c-active-bg)' : 'transparent',
                    fontSize: '13px',
                    fontWeight: active ? 600 : 400,
                    cursor: 'pointer',
                    marginBottom: '2px',
                    transition: 'all .15s',
                    position: 'relative',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--c-hover)'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                >
                  {active && (
                    <span style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: '3px', height: '18px', background: 'var(--c-accent)', borderRadius: '0 3px 3px 0' }} />
                  )}
                  <span style={{ fontSize: '14px', color: active ? 'var(--c-accent)' : 'var(--c-text-4)', fontWeight: 400 }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge && campCount > 0 && (
                    <span style={{ background: 'var(--c-active-bg)', color: 'var(--c-accent)', fontSize: '10px', fontWeight: 700, padding: '1px 7px', borderRadius: '10px', border: '1px solid var(--c-border)' }}>
                      {campCount}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Toggle de tema — separado do perfil */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid var(--c-border-lt)' }}>
        <div
          onClick={toggle}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '9px 10px',
            borderRadius: '10px',
            cursor: 'pointer',
            transition: 'background .15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--c-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <span style={{ fontSize: '15px' }}>{isDark ? '☀️' : '🌙'}</span>
            <span style={{ fontSize: '12px', color: 'var(--c-text-3)', fontWeight: 500 }}>
              {isDark ? 'Tema claro' : 'Tema escuro'}
            </span>
          </div>
          {/* Switch visual */}
          <div style={{
            width: '34px', height: '18px',
            borderRadius: '20px',
            background: isDark ? 'var(--c-accent)' : 'var(--c-border)',
            position: 'relative',
            transition: 'background .2s',
            flexShrink: 0,
          }}>
            <div style={{
              position: 'absolute',
              width: '12px', height: '12px',
              background: '#fff',
              borderRadius: '50%',
              top: '3px',
              left: isDark ? '19px' : '3px',
              transition: 'left .2s',
              boxShadow: '0 1px 3px rgba(0,0,0,.2)',
            }} />
          </div>
        </div>
      </div>

      {/* Perfil + Sair */}
      <div style={{ padding: '8px 12px 12px', borderTop: '1px solid var(--c-border-lt)' }}>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '10px', cursor: 'pointer', marginBottom: '2px', transition: 'background .15s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--c-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <div style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, #E8A4A4, #C98B83)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>
            CC
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--c-text-1)' }}>Cris Costa</div>
            <div style={{ fontSize: '10px', color: 'var(--c-text-4)' }}>Admin</div>
          </div>
        </div>
        <div
          onClick={logout}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '10px', cursor: 'pointer', fontSize: '12px', color: 'var(--c-text-4)', transition: 'all .15s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--c-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ fontSize: '13px' }}>⎋</span>
          <span>Sair da conta</span>
        </div>
      </div>
    </aside>
  );
}
