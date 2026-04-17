import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

/**
 * AppStateContext — estado global do painel.
 * Gerencia: notificações, anúncios reprovados, saldo de fundos e conta Meta.
 * Persiste em localStorage. Mocka eventos do Meta até a integração real.
 */

const KEY_NOTIFS   = 'ccb_notifications';
const KEY_REJECTED = 'ccb_rejected_ads';
const KEY_FUNDS    = 'ccb_funds';
const KEY_META     = 'ccb_meta_account';
const KEY_PAYMENT  = 'ccb_payment_method';

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

const AppStateContext = createContext(null);

export function AppStateProvider({ children }) {
  const [notifications, setNotifications] = useState(() => load(KEY_NOTIFS, []));
  const [rejectedAds,   setRejectedAds]   = useState(() => load(KEY_REJECTED, []));
  const [funds,         setFunds]         = useState(() => load(KEY_FUNDS, 50));
  const [metaAccount,   setMetaAccount]   = useState(() => load(KEY_META, {
    connected: false, name: 'Cris Costa', avatarUrl: null, pageId: null,
  }));
  const [paymentMethod, setPaymentMethod] = useState(() => load(KEY_PAYMENT, null));

  useEffect(() => save(KEY_NOTIFS,   notifications), [notifications]);
  useEffect(() => save(KEY_REJECTED, rejectedAds),   [rejectedAds]);
  useEffect(() => save(KEY_FUNDS,    funds),         [funds]);
  useEffect(() => save(KEY_META,     metaAccount),   [metaAccount]);
  useEffect(() => save(KEY_PAYMENT,  paymentMethod), [paymentMethod]);

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

  // Alerta de saldo baixo sempre que atravessar o threshold pra baixo
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
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState deve ser usado dentro de AppStateProvider');
  return ctx;
}
