import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import NewCampaignWizard from './components/NewCampaignWizard';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Campaigns from './pages/Campaigns';
import CampaignDetail from './pages/CampaignDetail';
import Platforms from './pages/Platforms';
import api from './services/api';

function PrivateRoute({ children }) {
  return localStorage.getItem('token') ? children : <Navigate to="/login" replace />;
}

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
  };
  const title = PAGE_TITLE[location.pathname] || 'Dashboard';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#FBF0F0' }}>
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
          background: '#fff',
          borderBottom: '1px solid #F0DEDE',
          padding: '0 28px',
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}>
          {/* Título */}
          <span style={{ fontSize: '16px', fontWeight: 700, color: '#4A2535', letterSpacing: '-0.2px' }}>{title}</span>

          {/* Centro: busca */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#FBF0F0', border: '1.5px solid #F0DEDE', borderRadius: '10px', padding: '7px 14px', minWidth: '220px' }}>
            <span style={{ fontSize: '13px', color: '#C4A09A' }}>⌕</span>
            <input
              type="text"
              placeholder="Buscar campanhas..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '12px', color: '#4A2535', fontFamily: 'inherit', width: '100%' }}
            />
          </div>

          {/* Direita: botão + avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => setShowWizard(true)}
              style={{
                background: '#C98B83',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background .15s',
                letterSpacing: '.2px',
              }}
              onMouseEnter={e => e.target.style.background = '#B8776F'}
              onMouseLeave={e => e.target.style.background = '#C98B83'}
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
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}
