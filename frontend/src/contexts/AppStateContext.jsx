import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

/**
 * AppStateContext — estado global do painel.
 * Gerencia: notificações, anúncios reprovados, saldo de fundos, conta Meta,
 * anúncios criados, públicos salvos, biblioteca de criativos e pixel.
 * Persiste em localStorage.
 */

const KEY_NOTIFS    = 'ccb_notifications';
const KEY_REJECTED  = 'ccb_rejected_ads';
const KEY_FUNDS     = 'ccb_funds';
const KEY_META      = 'ccb_meta_account';
const KEY_PAYMENT   = 'ccb_payment_method';
const KEY_ADS       = 'ccb_ads';
const KEY_AUDIENCES = 'ccb_audiences';
const KEY_CREATIVES = 'ccb_creatives';
const KEY_PIXEL     = 'ccb_pixel';

const LOW_BALANCE_THRESHOLD = 20;

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

const DEFAULT_AUDIENCES = [
  {
    id: 'aud-demo-1',
    name: 'Mulheres 25-45 — estética',
    description: 'Clientes-alvo principais. Moram em Balneário Camboriú e região.',
    gender: 'F',
    ageMin: 25,
    ageMax: 45,
    locations: ['Balneário Camboriú', 'Itajaí', 'Itapema', 'Camboriú'],
    interests: ['Estética', 'Skincare', 'Autocuidado', 'Beleza', 'Bem-estar'],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'aud-demo-2',
    name: 'Noivas & madrinhas',
    description: 'Segmentação para datas como Dia das Mães e pré-festas.',
    gender: 'F',
    ageMin: 22,
    ageMax: 40,
    locations: ['Balneário Camboriú', 'Itajaí'],
    interests: ['Casamento', 'Estética', 'Beleza', 'Eventos'],
    createdAt: new Date().toISOString(),
  },
];

const AppStateContext = createContext(null);

export function AppStateProvider({ children }) {
  const [notifications, setNotifications] = useState(() => load(KEY_NOTIFS, []));
  const [rejectedAds,   setRejectedAds]   = useState(() => load(KEY_REJECTED, []));
  const [funds,         setFunds]         = useState(() => load(KEY_FUNDS, 50));
  const [metaAccount,   setMetaAccount]   = useState(() => load(KEY_META, {
    connected: false, name: 'Cris Costa', avatarUrl: null, pageId: null,
  }));
  const [paymentMethod, setPaymentMethod] = useState(() => load(KEY_PAYMENT, null));
  const [ads,           setAds]           = useState(() => load(KEY_ADS, []));
  const [audiences,     setAudiences]     = useState(() => load(KEY_AUDIENCES, DEFAULT_AUDIENCES));
  const [creatives,     setCreatives]     = useState(() => load(KEY_CREATIVES, []));
  const [pixel,         setPixel]         = useState(() => load(KEY_PIXEL, {
    enabled: false, pixelId: '', events: { ViewContent: true, Lead: true, Contact: true, Purchase: false },
  }));

  useEffect(() => save(KEY_NOTIFS,    notifications), [notifications]);
  useEffect(() => save(KEY_REJECTED,  rejectedAds),   [rejectedAds]);
  useEffect(() => save(KEY_FUNDS,     funds),         [funds]);
  useEffect(() => save(KEY_META,      metaAccount),   [metaAccount]);
  useEffect(() => save(KEY_PAYMENT,   paymentMethod), [paymentMethod]);
  useEffect(() => save(KEY_ADS,       ads),           [ads]);
  useEffect(() => save(KEY_AUDIENCES, audiences),     [audiences]);
  useEffect(() => save(KEY_CREATIVES, creatives),     [creatives]);
  useEffect(() => save(KEY_PIXEL,     pixel),         [pixel]);

  const addNotification = useCallback((notif) => {
    setNotifications(prev => [{
      id: Date.now() + Math.random(),
      createdAt: new Date().toISOString(),
      read: false,
      ...notif,
    }, ...prev].slice(0, 50));
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAllNotifications = useCallback(() => setNotifications([]), []);

  const addRejectedAd = useCallback((ad) => {
    setRejectedAds(prev => [{
      id: Date.now(),
      rejectedAt: new Date().toISOString(),
      ...ad,
    }, ...prev]);
    addNotification({
      kind: 'rejected',
      title: 'Anúncio reprovado pelo Meta',
      message: `"${ad.name}" foi reprovado. Motivo: ${ad.reason || 'políticas de anúncio'}.`,
      link: '/reprovados',
    });
  }, [addNotification]);

  const removeRejectedAd = useCallback((id) => {
    setRejectedAds(prev => prev.filter(a => a.id !== id));
  }, []);

  const addFunds = useCallback((amount) => {
    setFunds(prev => {
      const next = Number((prev + amount).toFixed(2));
      addNotification({
        kind: 'funds',
        title: 'Saldo adicionado',
        message: `R$ ${amount.toFixed(2).replace('.', ',')} adicionados. Saldo atual: R$ ${next.toFixed(2).replace('.', ',')}.`,
      });
      return next;
    });
  }, [addNotification]);

  useEffect(() => {
    if (funds < LOW_BALANCE_THRESHOLD) {
      const hasAlert = notifications.some(n => n.kind === 'low-balance' && !n.read);
      if (!hasAlert) {
        addNotification({
          kind: 'low-balance',
          title: 'Saldo baixo de investimento',
          message: `Seu saldo está em R$ ${funds.toFixed(2).replace('.', ',')}. Adicione fundos para continuar com seus anúncios.`,
          link: '/investimento',
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [funds]);

  /* ─── Ads ─── */
  const addAd = useCallback((ad) => {
    const newAd = {
      id: Date.now(),
      adId: `Z${Math.floor(1000000 + Math.random() * 9000000)}`,
      createdAt: new Date().toISOString(),
      status: 'active',
      results: 0,
      clicks: 0,
      costPerResult: null,
      platform: 'instagram',
      thumbGrad: 'linear-gradient(135deg,#FECDD3,#FDA4AF,#FB7185)',
      ...ad,
    };
    setAds(prev => [newAd, ...prev]);
    return newAd;
  }, []);

  const updateAd = useCallback((id, patch) => {
    setAds(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));
  }, []);

  const removeAd = useCallback((id) => {
    setAds(prev => prev.filter(a => a.id !== id));
  }, []);

  const duplicateAd = useCallback((id) => {
    const src = ads.find(a => a.id === id);
    if (!src) return null;
    const dup = {
      ...src,
      id: Date.now(),
      adId: `Z${Math.floor(1000000 + Math.random() * 9000000)}`,
      name: `${src.name} (cópia)`,
      status: 'paused',
      createdAt: new Date().toISOString(),
      results: 0,
      clicks: 0,
      costPerResult: null,
    };
    setAds(prev => [dup, ...prev]);
    addNotification({
      kind: 'info',
      title: 'Anúncio duplicado',
      message: `"${src.name}" foi duplicado como "${dup.name}". Ajuste e ative quando quiser.`,
    });
    return dup;
  }, [ads, addNotification]);

  const toggleAdStatus = useCallback((id) => {
    setAds(prev => prev.map(a => {
      if (a.id !== id) return a;
      const next = a.status === 'active' ? 'paused' : a.status === 'paused' ? 'active' : a.status;
      return { ...a, status: next };
    }));
  }, []);

  const getAdById = useCallback((id) => ads.find(a => a.id === id) || null, [ads]);

  /* ─── Públicos salvos ─── */
  const addAudience = useCallback((audience) => {
    const newAudience = {
      id: `aud-${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...audience,
    };
    setAudiences(prev => [newAudience, ...prev]);
    return newAudience;
  }, []);

  const updateAudience = useCallback((id, patch) => {
    setAudiences(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));
  }, []);

  const removeAudience = useCallback((id) => {
    setAudiences(prev => prev.filter(a => a.id !== id));
  }, []);

  /* ─── Biblioteca de criativos ─── */
  const addCreative = useCallback((creative) => {
    const newCreative = {
      id: `cre-${Date.now()}`,
      createdAt: new Date().toISOString(),
      usedCount: 0,
      ...creative,
    };
    setCreatives(prev => [newCreative, ...prev]);
    return newCreative;
  }, []);

  const markCreativeUsed = useCallback((id) => {
    setCreatives(prev => prev.map(c => c.id === id ? { ...c, usedCount: (c.usedCount || 0) + 1 } : c));
  }, []);

  const removeCreative = useCallback((id) => {
    setCreatives(prev => prev.filter(c => c.id !== id));
  }, []);

  const value = {
    notifications,
    unreadCount: notifications.filter(n => !n.read).length,
    addNotification,
    removeNotification,
    clearAllNotifications,

    rejectedAds,
    rejectedCount: rejectedAds.length,
    addRejectedAd,
    removeRejectedAd,

    funds,
    addFunds,
    setFunds,
    lowBalance: funds < LOW_BALANCE_THRESHOLD,
    LOW_BALANCE_THRESHOLD,

    metaAccount,
    setMetaAccount,

    paymentMethod,
    setPaymentMethod,

    ads,
    addAd,
    updateAd,
    removeAd,
    duplicateAd,
    toggleAdStatus,
    getAdById,

    audiences,
    addAudience,
    updateAudience,
    removeAudience,

    creatives,
    addCreative,
    markCreativeUsed,
    removeCreative,

    pixel,
    setPixel,
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState deve ser usado dentro de AppStateProvider');
  return ctx;
}
