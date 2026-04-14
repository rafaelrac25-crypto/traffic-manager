import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import NewCampaignWizard from './components/NewCampaignWizard';
import Dashboard from './pages/Dashboard';
import Campaigns from './pages/Campaigns';
import CampaignDetail from './pages/CampaignDetail';
import Platforms from './pages/Platforms';
import Calendar from './pages/Calendar';
import History from './pages/History';
import api from './services/api';

function Layout() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [campCount, setCampCount]   = useState(0);
  const [showWizard, setShowWizard] = useState(false);
  const [search, setSearch]         = useState('');

  useEffect(() => {
    api.get('/api/campaigns').then(r => setCampCount(r.data.length)).catch(() => {});
  }, [location]);

  useEffect(() => {
    if (location.pathname === '/novo') {
      setShowWizard(true);
      navigate('/', { replace: true });
    }
  }, [location.pathname]);

  const PAGE_TITLE = {
    '/': 'Dashboard',
    '/campanhas': 'Campanhas',
    '/plataformas': 'Plataformas',
    '/calendario': 'Calendário',
    '/historico': 'Histórico',
  };
  const title = PAGE_TITLE[location.pathname] || 'Dashboard';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--c-page-bg)', transition: 'background .25s ease' }}>
      <Sidebar campCount={campCount} />

      {showWizard && (
        <NewCampaignWizard
          onClose={() => setShowWizard(false)}
          onCreated={() => {
            setShowWizard(false);
            api.get('/api/campaigns').then(r => setCampCount(r.data.length)).catch(() => {});
          }}
        />
      )}

      <div style={{ marginLeft: '220px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* Topbar */}
        <div style={{
          background: 'var(--c-topbar-bg)',
          borderBottom: '1px solid var(--c-border)',
          padding: '0 28px',
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          transition: 'background .25s ease, border-color .25s ease',
        }}>
          <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--c-text-1)', letterSpacing: '-0.2px' }}>{title}</span>

          {/* Busca */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--c-surface)', border: '1.5px solid var(--c-border)', borderRadius: '10px', padding: '7px 14px', minWidth: '220px', transition: 'background .25s ease' }}>
            <span style={{ fontSize: '13px', color: 'var(--c-text-4)' }}>⌕</span>
            <input
              type="text"
              placeholder="Buscar campanhas..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '12px', color: 'var(--c-text-1)', fontFamily: 'inherit', width: '100%' }}
            />
          </div>

          {/* Ações */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => setShowWizard(true)}
              style={{ background: 'var(--c-accent)', color: '#fff', border: 'none', borderRadius: '10px', padding: '8px 16px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'background .15s', letterSpacing: '.2px' }}
              onMouseEnter={e => e.target.style.background = 'var(--c-accent-dk)'}
              onMouseLeave={e => e.target.style.background = 'var(--c-accent)'}
            >
              + Nova Campanha
            </button>
            <div style={{ width: '34px', height: '34px', background: 'linear-gradient(135deg, #E8A4A4, #C98B83)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '12px', fontWeight: 700, flexShrink: 0, cursor: 'pointer' }}>
              CC
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1 }}>
          <Routes>
            <Route path="/"              element={<Dashboard searchQuery={search} />} />
            <Route path="/campanhas"     element={<Campaigns />} />
            <Route path="/campanhas/:id" element={<CampaignDetail />} />
            <Route path="/plataformas"   element={<Platforms />} />
            <Route path="/calendario"    element={<Calendar />} />
            <Route path="/historico"     element={<History />} />
            <Route path="*"              element={<Dashboard />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<Layout />} />
      </Routes>
    </BrowserRouter>
  );
}
