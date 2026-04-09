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
  const navigate = useNavigate();
  const location = useLocation();
  const [campCount, setCampCount] = useState(0);
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    api.get('/api/campaigns').then(r => setCampCount(r.data.length)).catch(() => {});
  }, [location]);

  // Rota /novo abre o wizard e volta ao dashboard
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
    <div style={{ display: 'flex', minHeight: '100vh' }}>
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

      <div style={{ marginLeft: '230px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* Topbar */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--gray-200)', padding: '0 28px', height: '58px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--wine)' }}>{title}</span>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setShowWizard(true)} style={{ background: 'var(--rose-deep)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              + Novo Anúncio
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1 }}>
          <Routes>
            <Route path="/"            element={<Dashboard />} />
            <Route path="/campanhas"   element={<Campaigns />} />
            <Route path="/campanhas/:id" element={<CampaignDetail />} />
            <Route path="/plataformas" element={<Platforms />} />
            <Route path="*"            element={<Dashboard />} />
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
