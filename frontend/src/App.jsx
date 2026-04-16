import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Campaigns from './pages/Campaigns';
import Calendar from './pages/Calendar';
import CreateAd from './pages/CreateAd';
import AIAssistant from './components/AIAssistant';
import SplashScreen from './components/SplashScreen';

const PAGE_TITLES = {
  '/':              'Dashboard',
  '/anuncios':      'Anúncios',
  '/calendario':    'Calendário',
  '/criar-anuncio': 'Criar anúncio',
};

/* ── Ícone de busca ── */
const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

/* ── Ícone de sino ── */
const BellIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);

/* ── Ícone hamburger ── */
const HamburgerIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);

function Layout() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [search, setSearch]           = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile]       = useState(window.innerWidth <= 1024);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 1024);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  /* Fecha sidebar ao trocar de rota no mobile */
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  const title = PAGE_TITLES[location.pathname] || 'Dashboard';

  return (
    <div className="app-wrapper">
      {/* Overlay mobile */}
      {isMobile && sidebarOpen && (
        <div
          className="sidebar-overlay show"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar open={sidebarOpen} isMobile={isMobile} />

      {/* Conteúdo principal */}
      <div className="main-content">

        {/* ── TopHeader ── */}
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

          {/* Hamburger — só mobile */}
          {isMobile && (
            <button
              className="hamburger-btn"
              onClick={() => setSidebarOpen(o => !o)}
              style={{ border: '1.5px solid var(--c-border)', background: 'var(--c-surface)' }}
            >
              <HamburgerIcon />
            </button>
          )}

          {/* Título da página */}
          <span style={{
            fontSize: '15px',
            fontWeight: 700,
            color: 'var(--c-text-1)',
            letterSpacing: '-0.2px',
            flexShrink: 0,
            minWidth: isMobile ? 'auto' : '100px',
          }}>
            {title}
          </span>

          {/* Barra de busca centralizada */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--c-surface)',
              border: '1.5px solid var(--c-border)',
              borderRadius: '10px',
              padding: '8px 14px',
              width: '100%',
              maxWidth: '380px',
              transition: 'background .25s ease, border-color .2s ease',
            }}
              onFocus={() => {}}
            >
              <span style={{ color: 'var(--c-text-4)', display: 'flex' }}><SearchIcon /></span>
              <input
                type="text"
                placeholder="Buscar anúncios, resultados..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  border: 'none', outline: 'none', background: 'transparent',
                  fontSize: '13px', color: 'var(--c-text-1)', fontFamily: 'inherit', width: '100%',
                }}
              />
            </div>
          </div>

          {/* Área direita */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>

            {/* Conta info — oculto em mobile pequeno */}
            {!isMobile && (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
                padding: '4px 10px',
                borderRadius: '10px',
                border: '1px solid var(--c-border)',
                background: 'var(--c-surface)',
                cursor: 'default',
              }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--c-text-1)', lineHeight: 1.2 }}>
                  Cris Costa Beauty
                </span>
                <span style={{ fontSize: '10px', color: '#22C55E', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
                  Conta conectada
                </span>
              </div>
            )}

            {/* Sino */}
            <div style={{ position: 'relative', cursor: 'pointer', color: 'var(--c-text-3)', display: 'flex', alignItems: 'center' }}>
              <BellIcon />
              <span style={{
                position: 'absolute', top: '-3px', right: '-3px',
                width: '8px', height: '8px', borderRadius: '50%',
                background: 'var(--c-accent)',
                border: '1.5px solid var(--c-topbar-bg)',
              }} />
            </div>

            {/* Avatar CC */}
            <div style={{
              width: '34px', height: '34px',
              background: 'linear-gradient(135deg, #E8A4C8, #C13584)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: '12px', fontWeight: 700,
              flexShrink: 0, cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(193,53,132,.3)',
            }}>
              CC
            </div>
          </div>
        </div>

        {/* ── Conteúdo ── */}
        <div style={{ flex: 1 }}>
          <Routes>
            <Route path="/"              element={<Dashboard searchQuery={search} />} />
            <Route path="/anuncios"      element={<Campaigns />} />
            <Route path="/campanhas"     element={<Navigate to="/anuncios" replace />} />
            <Route path="/calendario"    element={<Calendar />} />
            <Route path="/criar-anuncio" element={<CreateAd />} />
            <Route path="/novo"          element={<Navigate to="/criar-anuncio" replace />} />
            <Route path="*"              element={<Dashboard />} />
          </Routes>
        </div>
      </div>

      {/* Chat flutuante — em todas as telas */}
      <AIAssistant />
    </div>
  );
}

export default function App() {
  /* Splash aparece sempre que a página carrega ou é atualizada */
  const [showSplash, setShowSplash] = useState(true);

  function handleSplashDone() {
    setShowSplash(false);
  }

  return (
    <BrowserRouter>
      {showSplash && <SplashScreen onDone={handleSplashDone} />}
      <Routes>
        <Route path="/*" element={<Layout />} />
      </Routes>
    </BrowserRouter>
  );
}
