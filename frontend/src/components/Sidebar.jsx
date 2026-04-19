import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useAppState } from '../contexts/AppStateContext';
import marcaBranca from '../assets/marca-branca.png';
import marcaColorida from '../assets/marca-colorida.png';

/* ── Ícones SVG ── */
const IconDashboard = ({ active }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>
);
const IconAds = ({ active }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
  </svg>
);
const IconCalendar = ({ active }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const IconCreate = ({ active }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const IconRejected = ({ active }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
  </svg>
);
const IconInvestment = ({ active }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
  </svg>
);
const IconAudiences = ({ active }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IconCreatives = ({ active }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
);
const IconHistory = ({ active }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><polyline points="3 3 3 8 8 8"/>
    <line x1="12" y1="7" x2="12" y2="12"/><line x1="12" y1="12" x2="15" y2="14"/>
  </svg>
);
const IconReports = ({ active }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);
const IconMoon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/>
  </svg>
);
const IconSun = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);

function Logo({ isDark, onClick }) {
  return (
    <img
      src={isDark ? marcaBranca : marcaColorida}
      alt="Cris Costa Beauty"
      onClick={onClick}
      title="Ir para o Dashboard"
      style={{ height: '50px', width: 'auto', objectFit: 'contain', display: 'block', cursor: 'pointer', margin: '0 auto' }}
    />
  );
}

const PRIMARY_NAV = [
  { to: '/',              label: 'Dashboard',     Icon: IconDashboard },
  { to: '/criar-anuncio', label: 'Criar anúncio', Icon: IconCreate },
];

const NAV = [
  { to: '/anuncios',      label: 'Anúncios',      Icon: IconAds },
  { to: '/reprovados',    label: 'Reprovados',    Icon: IconRejected, badgeKey: 'rejectedCount' },
  { to: '/calendario',    label: 'Calendário',    Icon: IconCalendar },
  { kind: 'group', label: 'Biblioteca', description: 'Reutilize contexto, narrativa e público', items: [
    { to: '/publicos',  label: 'Públicos',  Icon: IconAudiences },
    { to: '/criativos', label: 'Criativos', Icon: IconCreatives },
  ]},
  { to: '/desempenho',    label: 'Desempenho',    Icon: IconReports },
  { to: '/investimento',  label: 'Investimento',  Icon: IconInvestment },
  { to: '/historico',     label: 'Histórico',     Icon: IconHistory },
];

export default function Sidebar({ open = false, isMobile = false }) {
  const navigate             = useNavigate();
  const location             = useLocation();
  const { isDark, toggle }   = useTheme();
  const { rejectedCount, metaAccount, syncStatus } = useAppState();

  const syncInfo = (() => {
    const s = syncStatus?.status || 'checking';
    if (s === 'ok')       return { color: '#22C55E', label: 'Sincronizado', pulse: true  };
    if (s === 'error')    return { color: '#EF4444', label: 'Erro de sincronização', pulse: false };
    return                       { color: '#F59E0B', label: 'Verificando…', pulse: true };
  })();

  const syncTitle = syncStatus?.lastCheck
    ? `Última verificação: ${new Date(syncStatus.lastCheck).toLocaleTimeString('pt-BR')}${syncStatus?.error ? ` · ${syncStatus.error}` : ''}`
    : 'Aguardando primeira verificação';

  const badgeValues = { rejectedCount };

  function isActive(to) {
    if (to === '/') return location.pathname === '/';
    return location.pathname.startsWith(to);
  }

  return (
    <aside
      className={`sidebar-fixed${isMobile && open ? ' sidebar-open' : ''}`}
      style={{
        width: '220px',
        minHeight: '100vh',
        background: 'var(--c-sidebar-bg)',
        borderRight: '1px solid var(--c-border)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0, left: 0, zIndex: 100,
        transition: 'background .25s ease, border-color .25s ease, transform .25s ease',
      }}
    >
      {/* ── Logo (clicável → home) ── */}
      <div style={{
        padding: '22px 20px 18px',
        borderBottom: '1px solid var(--c-border-lt)',
      }}>
        <Logo isDark={isDark} onClick={() => { window.location.href = '/'; }} />
      </div>

      {/* ── Navegação ── */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '14px 10px 0' }}>
        {/* ── Destaques: Dashboard + Criar anúncio (linha única, apenas contorno) ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
          {PRIMARY_NAV.map(({ to, label }) => {
            const active   = isActive(to);
            const isCreate = to === '/criar-anuncio';
            return (
              <div
                key={to}
                onClick={() => navigate(to)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '7px 14px',
                  height: '36px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '13px', fontWeight: 700,
                  letterSpacing: '-0.1px',
                  transition: 'all .18s var(--ease-out-soft)',
                  background: active ? 'var(--c-active-bg)' : 'transparent',
                  color: 'var(--c-accent)',
                  border: `1.5px solid ${active ? 'var(--c-accent)' : 'var(--c-accent)'}`,
                  boxShadow: active ? '0 2px 8px rgba(214,141,143,.14)' : 'none',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--c-active-bg)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(214,141,143,.22)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = active ? 'var(--c-active-bg)' : 'transparent';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = active ? '0 2px 8px rgba(214,141,143,.14)' : 'none';
                }}
              >
                <span>{label}</span>
                {isCreate && (
                  <span style={{
                    fontSize: '9px', fontWeight: 700, color: '#fff',
                    background: 'var(--c-accent)',
                    padding: '2px 7px', borderRadius: '999px', letterSpacing: '.3px',
                  }}>
                    NOVO
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div style={{
          fontSize: '10px', fontWeight: 700, color: 'var(--c-text-4)',
          textTransform: 'uppercase', letterSpacing: '.8px',
          padding: '0 12px 6px',
        }}>
          Navegação
        </div>

        {NAV.map((entry, idx) => {
          if (entry.kind === 'group') {
            const anyActive = entry.items.some(it => isActive(it.to));
            return (
              <div
                key={`group-${idx}`}
                style={{
                  margin: '10px 4px 10px',
                  padding: '10px 8px 8px',
                  borderRadius: '12px',
                  background: anyActive ? 'var(--c-active-bg)' : 'var(--c-surface)',
                  border: `1px solid ${anyActive ? 'var(--c-accent)' : 'var(--c-border-lt)'}`,
                  transition: 'all .18s',
                }}
              >
                <div
                  title={entry.description}
                  style={{
                    fontSize: '10px', fontWeight: 700, letterSpacing: '.8px',
                    textTransform: 'uppercase',
                    color: anyActive ? 'var(--c-accent)' : 'var(--c-text-4)',
                    padding: '0 8px 6px', display: 'flex', alignItems: 'center', gap: '6px',
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                  </svg>
                  {entry.label}
                </div>
                {entry.items.map(({ to, label, Icon }) => {
                  const active = isActive(to);
                  return (
                    <div
                      key={to}
                      onClick={() => navigate(to)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        color: active ? 'var(--c-accent)' : 'var(--c-text-2)',
                        background: active ? 'var(--c-card-bg)' : 'transparent',
                        fontSize: '12.5px',
                        fontWeight: active ? 700 : 500,
                        cursor: 'pointer',
                        marginBottom: '2px',
                        transition: 'all .15s',
                      }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--c-hover)'; }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <Icon active={active} />
                      <span style={{ flex: 1 }}>{label}</span>
                    </div>
                  );
                })}
              </div>
            );
          }

          const { to, label, Icon, badgeKey } = entry;
          const active = isActive(to);
          const badgeValue = badgeKey ? badgeValues[badgeKey] : 0;
          return (
            <div
              key={to}
              onClick={() => navigate(to)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '10px',
                color: active ? 'var(--c-accent)' : 'var(--c-text-3)',
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
                <span style={{
                  position: 'absolute', left: 0, top: '50%',
                  transform: 'translateY(-50%)',
                  width: '3px', height: '18px',
                  background: 'var(--c-accent)',
                  borderRadius: '0 3px 3px 0',
                }} />
              )}
              <Icon active={active} />
              <span style={{ flex: 1 }}>{label}</span>
              {badgeValue > 0 && (
                <span style={{
                  minWidth: '20px', height: '20px',
                  background: '#EF4444', color: '#fff',
                  borderRadius: '10px', padding: '0 6px',
                  fontSize: '11px', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  lineHeight: 1,
                }}>
                  {badgeValue}
                </span>
              )}
            </div>
          );
        })}
      </nav>

      {/* ── Tema escuro ── */}
      <div style={{ padding: '8px 10px', borderTop: '1px solid var(--c-border-lt)' }}>
        <div
          onClick={toggle}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '9px 12px', borderRadius: '10px', cursor: 'pointer',
            transition: 'background .15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--c-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', color: 'var(--c-text-3)' }}>
            {isDark ? <IconSun /> : <IconMoon />}
            <span style={{ fontSize: '12px', fontWeight: 500 }}>
              {isDark ? 'Tema claro' : 'Tema escuro'}
            </span>
          </div>
          <div style={{
            width: '36px', height: '20px',
            borderRadius: '20px',
            background: isDark ? 'var(--c-accent)' : 'var(--c-border)',
            position: 'relative',
            transition: 'background .2s',
            flexShrink: 0,
          }}>
            <div style={{
              position: 'absolute',
              width: '14px', height: '14px',
              background: '#fff',
              borderRadius: '50%',
              top: '3px',
              left: isDark ? '19px' : '3px',
              transition: 'left .2s',
              boxShadow: '0 1px 4px rgba(0,0,0,.2)',
            }} />
          </div>
        </div>
      </div>

      {/* ── Perfil (foto sincronizada Meta quando conectado) ── */}
      <div style={{ padding: '8px 10px 14px', borderTop: '1px solid var(--c-border-lt)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '8px 12px', borderRadius: '10px',
          transition: 'background .15s',
        }}>
          {metaAccount?.avatarUrl ? (
            <img
              src={metaAccount.avatarUrl}
              alt={metaAccount.name}
              style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid var(--c-accent)' }}
            />
          ) : (
            <div style={{
              width: '34px', height: '34px',
              background: 'linear-gradient(135deg, #E8A4C8, #d68d8f)',
              borderRadius: '50%', display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: '#fff', fontSize: '12px',
              fontWeight: 700, flexShrink: 0,
            }}>CC</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              title={syncTitle}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}
            >
              <span
                style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: syncInfo.color, flexShrink: 0,
                  boxShadow: `0 0 0 2px ${syncInfo.color}22`,
                  animation: syncInfo.pulse ? 'syncPulse 1.8s ease-in-out infinite' : 'none',
                }}
              />
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--c-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {metaAccount?.name || 'Cris Costa'}
              </div>
            </div>
            <div
              title={syncTitle}
              style={{ fontSize: '10px', color: syncInfo.color, fontWeight: 500, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {syncInfo.label}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
