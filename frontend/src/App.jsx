import React, { useEffect, useState, useRef } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Campaigns from './pages/Campaigns';
import Calendar from './pages/Calendar';
import CreateAd from './pages/CreateAd';
import Rejected from './pages/Rejected';
import Investment from './pages/Investment';
import Audiences from './pages/Audiences';
import CreativeLibrary from './pages/CreativeLibrary';
import References from './pages/References';
import History from './pages/History';
import Relatorios from './pages/Relatorios';
import AIAssistant from './components/AIAssistant';
import SplashScreen from './components/SplashScreen';
import { useTheme } from './contexts/ThemeContext';
import { AppStateProvider, useAppState } from './contexts/AppStateContext';

/* ── Mapa de busca — termos → destino ou ação ── */
const SEARCH_MAP = [
  { terms: ['dashboard','home','início','inicio','resumo'], to: '/',              label: 'Dashboard' },
  { terms: ['anúncio','anuncio','anúncios','anuncios','campanhas','campanha','ads'], to: '/anuncios', label: 'Anúncios' },
  { terms: ['relatório','relatorio','relatórios','relatorios','report','reports','análise','analise','performance','desempenho'], to: '/relatorios', label: 'Relatórios' },
  { terms: ['reprovado','reprovados','rejeitado','recusado','negado'], to: '/reprovados', label: 'Reprovados' },
  { terms: ['calendário','calendario','agenda','datas'], to: '/calendario', label: 'Calendário' },
  { terms: ['investimento','saldo','fundos','cartão','cartao','pix','pagamento','recarga','orçamento','orcamento','pixel','rastreamento','conversão','conversao'], to: '/investimento', label: 'Investimento' },
  { terms: ['público','publico','públicos','publicos','audiência','audiencia','segmentação','segmentacao'], to: '/publicos', label: 'Públicos' },
  { terms: ['criativo','criativos','biblioteca','texto','título','titulo','copy'], to: '/criativos', label: 'Criativos' },
  { terms: ['criar','novo','nova campanha','meta','instagram','google'], to: '/criar-anuncio', label: 'Criar anúncio' },
  { terms: ['histórico','historico','desfazer','restaurar','log','ações'], to: '/historico', label: 'Histórico' },
];

const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

const BellIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);

const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);
const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4"/>
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
  </svg>
);

function ThemeToggleButton() {
  const { isDark, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      title={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      aria-label="Alternar tema"
      style={{
        cursor: 'pointer', color: 'var(--c-text-2)',
        background: 'var(--c-surface)',
        border: '1.5px solid var(--c-border)',
        width: '40px', height: '40px', borderRadius: '12px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, transition: 'all .18s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--c-active-bg)'}
      onMouseLeave={e => e.currentTarget.style.background = 'var(--c-surface)'}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

const HamburgerIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'agora mesmo';
  if (diff < 3600) return `${Math.floor(diff / 60)} min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h atrás`;
  return `${Math.floor(diff / 86400)} d atrás`;
}

/* Fallback de rota por tipo — garante que toda notificação leve a algum lugar */
const FALLBACK_LINK = {
  approved: '/anuncios',
  rejected: '/reprovados',
  'low-balance': '/investimento',
  'high-cpc': '/anuncios',
  funds: '/investimento',
  'commercial-date': '/criar-anuncio',
  'reconnect-required': '/investimento',
  info: '/',
};

function NotificationDropdown({ open, onClose }) {
  const navigate = useNavigate();
  const {
    notifications,
    removeNotification,
    markNotificationRead,
    markAllNotificationsRead,
    clearAllNotifications,
    dismissCommercialDate,
  } = useAppState();
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) onClose(); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open, onClose]);

  if (!open) return null;

  const colors = {
    approved:    { bg: '#F0FDF4', border: '#86EFAC', emoji: '✅' },
    rejected:    { bg: '#FEF2F2', border: '#FCA5A5', emoji: '❌' },
    'low-balance':{bg: '#FFFBEB', border: '#FCD34D', emoji: '💰' },
    'high-cpc':  { bg: '#FFF7ED', border: '#FDBA74', emoji: '📈' },
    funds:       { bg: '#F0FDF4', border: '#86EFAC', emoji: '💵' },
    'commercial-date': { bg: '#FDF2F8', border: '#F9A8D4', emoji: '📅' },
    'reconnect-required': { bg: '#FEF2F2', border: '#FCA5A5', emoji: '🔌' },
    info:        { bg: 'var(--c-surface)', border: 'var(--c-border)', emoji: '🔔' },
  };

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute', top: 'calc(100% + 8px)', right: 0,
        width: '360px', maxHeight: '480px',
        background: 'var(--c-card-bg)', border: '1px solid var(--c-border)',
        borderRadius: '14px', boxShadow: '0 16px 48px rgba(214,141,143,.22)',
        zIndex: 1000, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        transformOrigin: 'top right',
        animation: 'bellOpen .28s cubic-bezier(.22,1,.36,1)',
      }}
    >
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--c-border-lt)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text-1)' }}>
          Notificações {notifications.length > 0 && <span style={{ color: 'var(--c-text-4)', fontWeight: 500 }}>({notifications.length})</span>}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {notifications.some(n => !n.read) && (
            <button
              onClick={markAllNotificationsRead}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--c-text-3)', fontWeight: 600 }}
              title="Marcar todas como lidas"
            >
              Marcar lidas
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={clearAllNotifications}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--c-accent)', fontWeight: 600 }}
            >
              Limpar todas
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {notifications.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '34px', marginBottom: '8px' }}>🔕</div>
            <div style={{ fontSize: '12px', color: 'var(--c-text-4)' }}>Nenhuma notificação no momento</div>
          </div>
        ) : notifications.map(n => {
          const style = colors[n.kind] || colors.info;
          const isCommercial = n.kind === 'commercial-date' && n.dateKey;
          const isRead = !!n.read;
          const readBg = 'transparent';
          const unreadBg = style.bg;
          const target = n.link || FALLBACK_LINK[n.kind] || '/';

          return (
            <div
              key={n.id}
              onClick={() => {
                if (!isRead) markNotificationRead(n.id);
                if (n.commercialDate) {
                  navigate(target, { state: { commercialDate: n.commercialDate } });
                } else {
                  navigate(target);
                }
                onClose();
              }}
              style={{
                padding: '12px 16px', borderBottom: '1px solid var(--c-border-lt)',
                cursor: 'pointer', display: 'flex', gap: '10px',
                background: isRead ? readBg : unreadBg,
                borderLeft: `3px solid ${isRead ? '#E5E7EB' : style.border}`,
                filter: isRead ? 'grayscale(1)' : 'none',
                opacity: isRead ? 0.72 : 1,
                transition: 'background .16s ease, transform .22s cubic-bezier(.22,1,.36,1), box-shadow .22s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = isRead ? '#F3F4F6' : 'var(--c-hover)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(214,141,143,.14)';
                e.currentTarget.style.position = 'relative';
                e.currentTarget.style.zIndex = '1';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = isRead ? readBg : unreadBg;
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.zIndex = 'auto';
              }}
            >
              <span style={{ fontSize: '18px', flexShrink: 0, color: isRead ? '#9CA3AF' : undefined }}>{style.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '13px', fontWeight: isRead ? 500 : 700,
                  color: isRead ? '#9CA3AF' : 'var(--c-text-1)', marginBottom: '2px',
                }}>
                  {n.title}
                </div>
                <div style={{
                  fontSize: '12px',
                  color: isRead ? '#B0B4BB' : 'var(--c-text-3)',
                  lineHeight: 1.5, marginBottom: '4px',
                }}>
                  {n.message}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ fontSize: '10px', color: isRead ? '#B0B4BB' : 'var(--c-text-4)' }}>{timeAgo(n.createdAt)}</div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {isCommercial && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const title = n.title?.replace(/^[\p{Emoji}\s]+/u, '').replace(/ (hoje|amanhã|em \d+ dias).*$/, '');
                          dismissCommercialDate(n.dateKey, { name: title });
                        }}
                        style={{
                          background: 'transparent', border: '1px solid var(--c-border)',
                          color: 'var(--c-text-3)', borderRadius: '6px',
                          padding: '3px 8px', fontSize: '10px', fontWeight: 600,
                          cursor: 'pointer',
                        }}
                        title="Não tenho interesse nesta data — pode ser restaurada no histórico"
                      >
                        Dispensar
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeNotification(n.id); }}
                      title="Remover notificação"
                      style={{
                        background: 'transparent', border: 'none',
                        color: isRead ? '#9CA3AF' : 'var(--c-text-4)',
                        cursor: 'pointer', fontSize: '14px', lineHeight: 1,
                        padding: '2px 4px',
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SearchBar() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showDrop, setShowDrop] = useState(false);
  const [noMatch, setNoMatch] = useState(false);
  const ref = useRef(null);

  const matches = search.trim() === '' ? [] : SEARCH_MAP.filter(item =>
    item.terms.some(t => t.includes(search.toLowerCase()) || search.toLowerCase().includes(t))
  );

  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setShowDrop(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    if (!search.trim()) return;
    if (matches.length > 0) {
      navigate(matches[0].to);
      setSearch('');
      setShowDrop(false);
    } else {
      // Sem correspondência: aciona chat flutuante com a pergunta
      window.dispatchEvent(new CustomEvent('ai-ask', { detail: { text: search } }));
      setNoMatch(true);
      setSearch('');
      setShowDrop(false);
      setTimeout(() => setNoMatch(false), 2500);
    }
  }

  return (
    <form ref={ref} onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', justifyContent: 'center', position: 'relative' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        background: 'var(--c-surface)', border: '1.5px solid var(--c-border)',
        borderRadius: '10px', padding: '8px 14px',
        width: '100%', maxWidth: '420px',
      }}>
        <span style={{ color: 'var(--c-text-4)', display: 'flex' }}><SearchIcon /></span>
        <input
          type="text"
          placeholder="Buscar páginas, ajuda ou perguntar à IA..."
          value={search}
          onChange={e => { setSearch(e.target.value); setShowDrop(true); }}
          onFocus={() => setShowDrop(true)}
          style={{
            border: 'none', outline: 'none', background: 'transparent',
            fontSize: '13px', color: 'var(--c-text-1)', fontFamily: 'inherit', width: '100%',
          }}
        />
      </div>

      {showDrop && search.trim() && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)',
          left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: '420px',
          background: 'var(--c-card-bg)', border: '1px solid var(--c-border)',
          borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,.12)',
          zIndex: 1000, overflow: 'hidden',
        }}>
          {matches.length > 0 ? matches.map(m => (
            <div
              key={m.to}
              onClick={() => { navigate(m.to); setSearch(''); setShowDrop(false); }}
              style={{ padding: '10px 14px', cursor: 'pointer', fontSize: '13px', color: 'var(--c-text-2)', borderBottom: '1px solid var(--c-border-lt)', display: 'flex', justifyContent: 'space-between' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--c-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span>→ {m.label}</span>
              <span style={{ fontSize: '10px', color: 'var(--c-text-4)' }}>sessão</span>
            </div>
          )) : (
            <div
              onClick={handleSubmit}
              style={{ padding: '12px 14px', cursor: 'pointer', fontSize: '13px', color: 'var(--c-text-2)', display: 'flex', alignItems: 'center', gap: '8px' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--c-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              💬 <span>Perguntar à IA: <strong>"{search}"</strong></span>
            </div>
          )}
        </div>
      )}

      {noMatch && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)',
          background: '#d68d8f', color: '#fff',
          padding: '8px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: 600,
          boxShadow: '0 4px 12px rgba(214,141,143,.3)',
        }}>
          Enviado ao assistente IA →
        </div>
      )}
    </form>
  );
}

function Layout() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile]       = useState(window.innerWidth <= 1024);
  const [bellOpen, setBellOpen]       = useState(false);
  const { unreadCount } = useAppState();

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 1024);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => { setSidebarOpen(false); setBellOpen(false); }, [location.pathname]);

  return (
    <div className="app-wrapper">
      {isMobile && sidebarOpen && (
        <div className="sidebar-overlay show" onClick={() => setSidebarOpen(false)} />
      )}

      <Sidebar open={sidebarOpen} isMobile={isMobile} />

      <div className="main-content">

        <div style={{
          background: 'var(--c-topbar-bg)',
          borderBottom: '1px solid var(--c-border)',
          padding: '0 24px',
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          transition: 'background .25s ease, border-color .25s ease',
        }}>

          {isMobile && (
            <button
              className="hamburger-btn"
              onClick={() => setSidebarOpen(o => !o)}
              style={{ border: '1.5px solid var(--c-border)', background: 'var(--c-surface)' }}
            >
              <HamburgerIcon />
            </button>
          )}

          <SearchBar />

          <ThemeToggleButton />

          {/* Sino de notificações (aumentado) */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => setBellOpen(o => !o)}
              title="Notificações"
              style={{
                position: 'relative', cursor: 'pointer', color: 'var(--c-text-2)',
                background: bellOpen ? 'var(--c-active-bg)' : 'var(--c-surface)',
                border: '1.5px solid var(--c-border)',
                width: '40px', height: '40px', borderRadius: '12px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all .15s',
              }}
            >
              <span className={unreadCount > 0 && !bellOpen ? 'bell-shake' : ''} style={{ display: 'flex' }}>
                <BellIcon />
              </span>
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: '-4px', right: '-4px',
                  minWidth: '18px', height: '18px',
                  background: '#EF4444', color: '#fff',
                  borderRadius: '9px', padding: '0 5px',
                  fontSize: '10px', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid var(--c-topbar-bg)',
                  lineHeight: 1,
                }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            <NotificationDropdown open={bellOpen} onClose={() => setBellOpen(false)} />
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <Routes>
            <Route path="/"              element={<Dashboard />} />
            <Route path="/anuncios"      element={<Campaigns />} />
            <Route path="/relatorios"    element={<Relatorios />} />
            <Route path="/campanhas"     element={<Navigate to="/anuncios" replace />} />
            <Route path="/reprovados"    element={<Rejected />} />
            <Route path="/calendario"    element={<Calendar />} />
            <Route path="/investimento"  element={<Investment />} />
            <Route path="/publicos"      element={<Audiences />} />
            <Route path="/criativos"     element={<CreativeLibrary />} />
            <Route path="/referencias"   element={<References />} />
            <Route path="/criar-anuncio" element={<CreateAd />} />
            <Route path="/historico"     element={<History />} />
            {/* HeatMap removido — Meta não diferencia performance entre bairros do mesmo anel.
                Métricas por anel ficam no Dashboard (RingPerformanceCard). */}
            <Route path="/mapa-de-calor" element={<Navigate to="/" replace />} />
            <Route path="/desempenho"    element={<Navigate to="/" replace />} />
            <Route path="/novo"          element={<Navigate to="/criar-anuncio" replace />} />
            <Route path="*"              element={<Dashboard />} />
          </Routes>
        </div>
      </div>

      <AIAssistant />
    </div>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <BrowserRouter>
      <AppStateProvider>
        {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
        <Routes>
          <Route path="/*" element={<Layout />} />
        </Routes>
      </AppStateProvider>
    </BrowserRouter>
  );
}
