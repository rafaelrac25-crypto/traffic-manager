import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { getRelevantCommercialDatesInWindow } from '../data/commercialDates';
import { playBell } from '../utils/sounds';
import * as adsApi from '../services/adsApi';
import { fetchDistrictInsights, strongInsightAlert } from '../data/districtInsights';

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
const KEY_LOC_PRESETS = 'ccb_location_presets';
const KEY_PIXEL     = 'ccb_pixel';
const KEY_COMMERCIAL_ALERTED = 'ccb_commercial_alerted';
const KEY_DISMISSED_DATES    = 'ccb_dismissed_dates';
const KEY_HISTORY            = 'ccb_history';
const HISTORY_MAX_ENTRIES    = 500;

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

/* Joinville/SC — Cris atende apenas esta cidade (regra de negócio) */
const DEFAULT_CITY_COORDS = {
  'Joinville':        { lat: -26.3044, lng: -48.8487 },
  'Centro':           { lat: -26.3044, lng: -48.8487 },
  'América':          { lat: -26.3021, lng: -48.8431 },
  'Glória':           { lat: -26.3028, lng: -48.8656 },
  'Saguaçu':          { lat: -26.2914, lng: -48.8181 },
};
function defaultLoc(name, i) {
  const c = DEFAULT_CITY_COORDS[name];
  return { id: `loc-default-${i}`, name, lat: c?.lat ?? null, lng: c?.lng ?? null, radius: 5 };
}

const DEFAULT_AUDIENCES = [];

const AppStateContext = createContext(null);

export function AppStateProvider({ children }) {
  const [notifications, setNotifications] = useState(() => load(KEY_NOTIFS, []));
  const [rejectedAds,   setRejectedAds]   = useState(() => load(KEY_REJECTED, []));
  const [funds,         setFunds]         = useState(() => load(KEY_FUNDS, 50));
  const [metaAccount,   setMetaAccount]   = useState(() => load(KEY_META, {
    connected: false, name: 'Cris Costa', avatarUrl: null, pageId: null, accountId: null,
  }));

  /* Sincroniza metaAccount com a realidade do backend — sem isso o frontend
     mostrava 'Conta Meta não conectada' mesmo quando platform_credentials
     tinha linha válida no banco. */
  useEffect(() => {
    let cancelled = false;
    fetch('/api/platforms', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled || !Array.isArray(data)) return;
        const meta = data.find(p => p.platform === 'meta');
        if (!meta) return;
        setMetaAccount(prev => ({
          ...prev,
          connected: !!meta.connected,
          pageId: meta.page_id || prev.pageId,
          accountId: meta.account_id || prev.accountId,
          igBusinessId: meta.ig_business_id || prev.igBusinessId,
        }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const [metaBilling,   setMetaBilling]   = useState(null);
  const [metaBillingLoading, setMetaBillingLoading] = useState(false);
  const [metaBillingLastUpdate, setMetaBillingLastUpdate] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(() => load(KEY_PAYMENT, null));
  const [ads,           setAds]           = useState(() => load(KEY_ADS, []));
  const [audiences,       setAudiences]       = useState(() => load(KEY_AUDIENCES, DEFAULT_AUDIENCES));
  const [creatives,       setCreatives]       = useState(() => load(KEY_CREATIVES, []));
  const [locationPresets, setLocationPresets] = useState(() => load(KEY_LOC_PRESETS, []));
  const [pixel,         setPixel]         = useState(() => load(KEY_PIXEL, {
    enabled: false, pixelId: '', events: { ViewContent: true, Lead: true, Contact: true, Purchase: false },
  }));
  const [dismissedDates, setDismissedDates] = useState(() => load(KEY_DISMISSED_DATES, []));
  const [history,        setHistory]        = useState(() => load(KEY_HISTORY, []));

  /* ─── Status de sincronização com as APIs ─── */
  const [syncStatus, setSyncStatus] = useState({
    status: 'checking',
    lastCheck: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function ping() {
      try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        setSyncStatus({
          status: data?.status === 'ok' ? 'ok' : 'error',
          lastCheck: new Date().toISOString(),
          error: data?.status === 'ok' ? null : 'Resposta inesperada da API',
        });
      } catch (err) {
        if (cancelled) return;
        setSyncStatus({
          status: 'error',
          lastCheck: new Date().toISOString(),
          error: err?.message || 'Falha de conexão',
        });
      }
    }

    ping();
    const id = setInterval(ping, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  /* Hidrata ads do backend — backend é a fonte da verdade.
     Também limpa ads "zumbi": sem serverId e criados há mais de 10 min
     (publish falhou silenciosamente). */
  useEffect(() => {
    let cancelled = false;
    adsApi.fetchAds().then((remote) => {
      if (cancelled) return;
      if (!remote) {
        /* backend offline — só limpa zumbis antigos, mantém ads com serverId */
        setAds(prev => prev.filter(a => a.serverId || (Date.now() - new Date(a.createdAt).getTime() < 10 * 60 * 1000)));
        return;
      }
      /* Merge: remoto é autoritativo + preserva ads pending de publicação recente (<10min).
         Reconciliação: ads locais com serverId que NÃO aparecem no remoto foram
         deletados no backend (cleanup, RGPD, ou bug de sync). Antes ficavam como
         "ads fantasmas" até o usuário limpar localStorage manualmente. Agora
         logamos quantos foram descartados pra ficar visível no console. */
      setAds(prev => {
        const remoteIds = new Set(remote.map(r => String(r.id)));
        const ghosts = prev.filter(a => a.serverId && !remoteIds.has(String(a.serverId)));
        if (ghosts.length > 0) {
          console.warn('[AppState] reconciliação: descartando', ghosts.length, 'ads locais sem espelho no servidor (deletados no backend):', ghosts.map(g => g.serverId).join(', '));
        }
        const remoteWithServer = remote.map(r => ({ ...r, serverId: r.id }));
        const pendingLocal = prev.filter(a =>
          !a.serverId && (Date.now() - new Date(a.createdAt).getTime() < 10 * 60 * 1000)
        );
        return [...pendingLocal, ...remoteWithServer];
      });
    });
    return () => { cancelled = true; };
  }, []);

  /* Polling de status Meta: pega aprovação/rejeição/métricas dos ads publicados.
     Roda no mount + a cada 90s. Aplica diffs in-place, preservando payload local.
     Também grava effective_status (PENDING_REVIEW/ACTIVE/WITH_ISSUES/...) pra UI
     mostrar claramente se ad está entregando de verdade ou só aprovado-em-espera. */
  const [metaSyncedAt, setMetaSyncedAt] = useState(null);
  const [metaSyncing, setMetaSyncing] = useState(false);
  /* Ref pra evitar overlap real entre ticks. setInterval dispara a cada 90s
     mesmo se a sync anterior ainda está rodando (Promise no `tick` não pausa
     o intervalo). Antes desse guard, sync >90s causava chamadas empilhadas
     ao Meta e, se uma travasse, polling ficava em loop morto sem aviso. */
  const metaSyncingRef = useRef(false);

  const runMetaSync = useCallback(async () => {
    if (metaSyncingRef.current) return; /* sync anterior ainda rodando — pula esse tick */
    metaSyncingRef.current = true;
    setMetaSyncing(true);
    try {
      const updates = await adsApi.syncMetaStatus();
      if (Array.isArray(updates) && updates.length > 0) {
        /* Detecta transições de effective_status pra tocar o sino.
           - PENDING_REVIEW (primeira vez) → "Em revisão"
           - ACTIVE depois de PENDING_REVIEW/PREAPPROVED → "Aprovado 🎉"
           - DISAPPROVED (primeira vez) → "Reprovado após revisão"
           Os eventos de rejeição IMEDIATA no publish (antes de revisão) já são
           tratados por addRejectedAd — esta lógica cobre as mudanças que chegam
           via sync periódico depois que o Meta termina a análise. */
        const transitions = [];
        setAds(prev => {
          const byId = new Map(prev.map(a => [a.id, a]));
          const next = prev.map(a => {
            const diff = updates.find(u => u.id === a.id || u.id === a.serverId || u.platform_campaign_id === a.metaCampaignId);
            if (!diff) return a;
            /* Worst-status do ad: se algum ad estiver DISAPPROVED/WITH_ISSUES,
               consideramos isso o effective_status REAL pra notificação.
               Sem isso, campanha podia ficar ACTIVE no Meta enquanto ad
               estava reprovado e ninguém percebia (incidente camp 437). */
            const worstAdStatus = Array.isArray(diff.ads) && diff.ads.length > 0
              ? (diff.ads.find(x => x.effective_status === 'DISAPPROVED')?.effective_status
                 || diff.ads.find(x => x.effective_status === 'WITH_ISSUES')?.effective_status
                 || diff.ads.find(x => x.effective_status === 'PAUSED')?.effective_status
                 || diff.ads.find(x => x.effective_status === 'PENDING_REVIEW')?.effective_status
                 || diff.ads[0].effective_status)
              : null;
            const merged = {
              ...a,
              status: diff.status || a.status,
              effective_status: diff.effective_status || a.effective_status,
              ad_effective_status: worstAdStatus || a.ad_effective_status,
              spent: diff.spent ?? a.spent,
              clicks: diff.clicks ?? a.clicks,
              link_clicks: diff.link_clicks ?? a.link_clicks,
              impressions: diff.impressions ?? a.impressions,
              conversions: diff.conversions ?? a.conversions,
              reach: diff.reach ?? a.reach,
              ctr: diff.ctr ?? a.ctr,
              cpc: diff.cpc ?? a.cpc,
              cpm: diff.cpm ?? a.cpm,
              frequency: diff.frequency ?? a.frequency,
              ads_meta: Array.isArray(diff.ads) ? diff.ads : a.ads_meta,
              meta_synced_at: new Date().toISOString(),
            };
            const old = byId.get(a.id);
            /* Transition checa AD-level worst status (que é o que define se
               anúncio realmente roda). Antes só campaign-level escapava
               casos onde campaign=ACTIVE mas ad=DISAPPROVED. */
            const oldES = old?.ad_effective_status || old?.effective_status;
            const newES = merged.ad_effective_status || merged.effective_status;
            if (oldES !== newES && newES) {
              transitions.push({ ad: merged, from: oldES, to: newES });
            }
            return merged;
          });
          return next;
        });

        /* Dispara notificações depois do setAds pra não disparar dentro do render */
        for (const t of transitions) {
          const name = t.ad.name || 'Anúncio';
          if (t.to === 'PENDING_REVIEW' && t.from !== 'PENDING_REVIEW') {
            addNotification({
              kind: 'info',
              title: 'Anúncio em revisão no Meta',
              message: `"${name}" foi enviado e está sendo analisado. Geralmente leva algumas horas.`,
              link: '/anuncios',
            });
          } else if (t.to === 'ACTIVE' && (t.from === 'PENDING_REVIEW' || t.from === 'PREAPPROVED' || t.from === 'PENDING_BILLING_INFO')) {
            addNotification({
              kind: 'approved',
              title: 'Anúncio aprovado e no ar 🎉',
              message: `"${name}" foi aprovado pelo Meta e já está rodando.`,
              link: '/anuncios',
            });
          } else if (t.to === 'DISAPPROVED' && t.from === 'ACTIVE') {
            addNotification({
              kind: 'rejected',
              title: 'Anúncio reprovado durante a veiculação ⚠️',
              message: `"${name}" estava no ar e foi reprovado pelo Meta. Verifique as políticas em Reprovados.`,
              link: '/reprovados',
            });
          } else if (t.to === 'DISAPPROVED' && t.from !== 'DISAPPROVED') {
            addNotification({
              kind: 'rejected',
              title: 'Anúncio reprovado após revisão',
              message: `"${name}" foi reprovado pelo Meta depois da análise. Veja o motivo em Reprovados.`,
              link: '/reprovados',
            });
          } else if (t.to === 'WITH_ISSUES' && t.from !== 'WITH_ISSUES') {
            addNotification({
              kind: 'warning',
              title: 'Anúncio com problema no Meta ⚠️',
              message: `"${name}" está com problemas detectados pelo Meta. Verifique o painel de anúncios.`,
              link: '/anuncios',
            });
          } else if (t.to === 'ADSET_PAUSED' && t.from !== 'ADSET_PAUSED') {
            /* Ad ACTIVE mas conjunto PAUSED → não entrega.
               Caso 437: user ligou só o ad e não percebeu que conjunto
               continuava parado. Antes invisível, agora avisa. */
            addNotification({
              kind: 'warning',
              title: 'Conjunto de anúncios está pausado',
              message: `"${name}" não está entregando porque o CONJUNTO está pausado. Ligue o conjunto no Meta Ads Manager.`,
              link: '/anuncios',
            });
          } else if (t.to === 'CAMPAIGN_PAUSED' && t.from !== 'CAMPAIGN_PAUSED') {
            addNotification({
              kind: 'warning',
              title: 'Campanha está pausada',
              message: `"${name}" não está entregando porque a CAMPANHA está pausada. Ative no painel.`,
              link: '/anuncios',
            });
          }
        }
      }
      setMetaSyncedAt(new Date().toISOString());
    } finally {
      metaSyncingRef.current = false;
      setMetaSyncing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => { if (!cancelled) await runMetaSync(); };
    tick();
    const id = setInterval(tick, 90000);
    return () => { cancelled = true; clearInterval(id); };
  }, [runMetaSync]);

  /* Avisa no sino apenas quando o Rafa precisa reconectar manualmente.
     Dedupa: não repete se já existe uma notificação 'reconnect-required' não lida. */
  const notifyReconnectRequired = useCallback(() => {
    setNotifications(prev => {
      if (prev.some(n => n.kind === 'reconnect-required' && !n.read)) return prev;
      setTimeout(() => playBell(), 0);
      return [{
        id: Date.now() + Math.random(),
        createdAt: new Date().toISOString(),
        read: false,
        kind: 'reconnect-required',
        title: 'Conexão Meta expirada — reconecte',
        message: 'A renovação automática do token falhou. Clique para reconectar o Facebook sem perder suas configurações.',
        link: '/investimento',
      }, ...prev].slice(0, 50);
    });
  }, []);

  /* Saldo Meta Ads — busca do backend, auto-refresh horário + refresh manual via botão */
  const refreshMetaBilling = useCallback(async () => {
    setMetaBillingLoading(true);
    try {
      const r = await fetch('/api/platforms/meta/billing', { cache: 'no-store' });
      if (r.status === 401) {
        const body = await r.json().catch(() => ({}));
        if (body?.needs_reconnect) notifyReconnectRequired();
        setMetaBilling(null);
        return null;
      }
      if (!r.ok) { setMetaBilling(null); return null; }
      const data = await r.json();
      setMetaBilling(data);
      setMetaBillingLastUpdate(new Date().toISOString());
      return data;
    } catch {
      setMetaBilling(null);
      return null;
    } finally {
      setMetaBillingLoading(false);
    }
  }, [notifyReconnectRequired]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      await refreshMetaBilling();
    };
    tick();
    /* 1 hora = 24 refreshes/dia (user pode forçar manual via botão quando quiser) */
    const id = setInterval(tick, 60 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [refreshMetaBilling]);

  /* Detector de desconexão Meta real — só toca sino se o estado persistir.
     Substitui o polling agressivo antigo (que disparava falsos positivos a cada
     hiccup da rede/rate limit). Roda a cada 3min — suficiente pra detectar
     reconexão necessária sem sobrecarregar. */
  useEffect(() => {
    let cancelled = false;
    let consecutiveFailures = 0;

    const checkConnection = async () => {
      if (cancelled) return;
      try {
        const pr = await fetch('/api/platforms', { cache: 'no-store' });
        if (!pr.ok) return; /* backend offline — ignora, não toca sino */
        const data = await pr.json();
        const meta = Array.isArray(data) ? data.find(p => p.platform === 'meta') : null;
        /* Só avisa se needs_reconnect foi marcado explicitamente (token expirou).
           `connected: false` por si só pode ser estado transitório no cold start. */
        if (meta?.needs_reconnect) {
          notifyReconnectRequired();
          consecutiveFailures = 0;
        } else if (meta?.connected) {
          /* Conectado: auto-limpa notificações obsoletas de desconexão/erro
             que ficaram presas do fluxo antigo. Executa UMA vez ao detectar
             conexão saudável. */
          consecutiveFailures = 0;
          setNotifications(prev => prev.filter(n =>
            n.kind !== 'reconnect-required' &&
            n.kind !== 'meta-sync-error'
          ));
        } else if (!meta?.connected) {
          consecutiveFailures++;
          /* Só notifica se ficar desconectado por 3 checks seguidos (~9min) */
          if (consecutiveFailures >= 3) {
            notifyReconnectRequired();
            consecutiveFailures = 0;
          }
        } else {
          consecutiveFailures = 0;
        }
      } catch {
        /* Erro de rede — não conta como desconexão, só ignora */
      }
    };

    checkConnection();
    const id = setInterval(checkConnection, 3 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── Watcher de insights de bairro: alerta se algum bairro está convertendo
     ≥30% melhor que a média. Roda a cada 4h (oportunidade é slow-moving). ─── */
  useEffect(() => {
    let cancelled = false;
    const ALERTED_KEY = 'ccb_insight_alerted_at';
    const COOLDOWN = 24 * 60 * 60 * 1000; /* 1 alerta de insight por dia no máx */

    async function checkInsights() {
      if (cancelled) return;
      try {
        const lastAt = Number(localStorage.getItem(ALERTED_KEY) || 0);
        if (Date.now() - lastAt < COOLDOWN) return;
        const data = await fetchDistrictInsights();
        const alert = strongInsightAlert(data);
        if (alert && !cancelled) {
          addNotification(alert);
          localStorage.setItem(ALERTED_KEY, String(Date.now()));
        }
      } catch {}
    }
    checkInsights();
    const id = setInterval(checkInsights, 4 * 60 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── Alertas de datas comerciais relevantes em janela de 45 dias (no mount) ─── */
  useEffect(() => {
    const upcoming = getRelevantCommercialDatesInWindow(new Date(), 45);
    if (upcoming.length === 0) return;
    const alerted   = load(KEY_COMMERCIAL_ALERTED, []);
    const dismissed = load(KEY_DISMISSED_DATES, []);
    const toAlert   = upcoming.filter(c => !alerted.includes(c.key) && !dismissed.includes(c.key));
    if (toAlert.length === 0) return;

    toAlert.forEach(c => {
      const when = c.daysUntil === 0
        ? 'hoje'
        : c.daysUntil === 1
          ? 'amanhã'
          : `em ${c.daysUntil} dias`;
      addNotification({
        kind: 'commercial-date',
        dateKey: c.key,
        title: `${c.emoji} ${c.name} ${when}`,
        message: `${c.whyImportant.split('.')[0]}. Planeje a campanha com antecedência.`,
        link: '/criar-anuncio',
        commercialDate: {
          id: c.id,
          name: c.name,
          emoji: c.emoji,
          dateISO: c.date.toISOString(),
          daysBefore: c.daysBefore,
          preFill: c.preFill,
        },
      });
    });
    save(KEY_COMMERCIAL_ALERTED, [...alerted, ...toAlert.map(c => c.key)].slice(-100));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => save(KEY_NOTIFS,    notifications), [notifications]);
  useEffect(() => save(KEY_REJECTED,  rejectedAds),   [rejectedAds]);
  useEffect(() => save(KEY_FUNDS,     funds),         [funds]);
  useEffect(() => save(KEY_META,      metaAccount),   [metaAccount]);
  useEffect(() => save(KEY_PAYMENT,   paymentMethod), [paymentMethod]);
  useEffect(() => save(KEY_ADS,       ads),           [ads]);
  useEffect(() => save(KEY_AUDIENCES, audiences),     [audiences]);
  useEffect(() => save(KEY_CREATIVES, creatives),     [creatives]);
  useEffect(() => save(KEY_LOC_PRESETS, locationPresets), [locationPresets]);
  useEffect(() => save(KEY_PIXEL,     pixel),         [pixel]);
  useEffect(() => save(KEY_DISMISSED_DATES, dismissedDates), [dismissedDates]);
  useEffect(() => save(KEY_HISTORY,   history),       [history]);

  const mountedAtRef = useRef(Date.now());
  /* Anti-flood do sino: depois de tocar uma vez, supressa por 8s.
     Se Rafa volta após dias offline e o sync gera 50 notificações de uma vez,
     antes ele ouvia 50 dings em loop. Agora ouve 1, e o resto é agrupado. */
  const lastBellAtRef = useRef(0);
  /* Kinds que podem ser agrupados quando vários eventos do mesmo tipo
     chegam em janela curta (60s). Em vez de empilhar 30 sinos "Anúncio
     aprovado", criamos UMA notificação "5 anúncios aprovados". */
  const GROUPABLE_KINDS = ['approved', 'rejected', 'info', 'meta-sync-error', 'low-balance'];
  const GROUP_WINDOW_MS = 60000;
  const addNotification = useCallback((notif) => {
    const now = Date.now();
    setNotifications(prev => {
      /* Tenta agrupar com a notificação mais recente do mesmo kind se
         ainda estiver dentro da janela e não foi lida. */
      if (notif.kind && GROUPABLE_KINDS.includes(notif.kind) && prev.length > 0) {
        const head = prev[0];
        const headAt = new Date(head.createdAt || 0).getTime();
        if (head.kind === notif.kind && !head.read && (now - headAt) < GROUP_WINDOW_MS) {
          const count = (head.groupCount || 1) + 1;
          /* Atualiza head: aumenta contador e prefixa título com [N]. */
          const baseTitle = (head.baseTitle || head.title || '').replace(/^\(\d+\)\s*/, '');
          const updated = {
            ...head,
            baseTitle,
            title: `(${count}) ${baseTitle}`,
            message: `${count} eventos similares — último: ${notif.message || notif.body || baseTitle}`,
            groupCount: count,
            createdAt: new Date().toISOString(),
          };
          return [updated, ...prev.slice(1)];
        }
      }
      return [{
        id: now + Math.random(),
        createdAt: new Date().toISOString(),
        read: false,
        ...notif,
      }, ...prev].slice(0, 50);
    });
    // Evita tocar som durante a rehidratação inicial (primeiros 1.5s após montar)
    // Anti-flood: 1 sino por 8s no máximo (evita "metralhadora" ao voltar online)
    if (!notif.silent && (now - mountedAtRef.current) > 1500 && (now - lastBellAtRef.current) > 8000) {
      lastBellAtRef.current = now;
      playBell();
    }
    /* Replica no histórico erros/warnings relevantes pro log de auditoria.
       Exclui kinds ruidosos como commercial-date ou low-balance (vão no sino mas
       não inflam histórico). */
    const loggableKinds = ['publish-failed', 'rejected', 'meta-sync-error', 'reconnect-required', 'warning', 'insight-high-performer', 'insight-low-performer'];
    if (loggableKinds.includes(notif.kind)) {
      setHistory(prev => [{
        id: `hist-${now}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: new Date().toISOString(),
        type: `notif-${notif.kind}`,
        title: notif.title || 'Notificação',
        description: notif.message || notif.body || null,
        restorable: false,
      }, ...prev].slice(0, 500));
    }
  }, []);

  /* ─── Histórico (log de ações principais + undo) ─── */
  const logHistory = useCallback((entry) => {
    setHistory(prev => [{
      id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      restored: false,
      ...entry,
    }, ...prev].slice(0, HISTORY_MAX_ENTRIES));
  }, []);

  const removeHistoryEntry = useCallback((id) => {
    setHistory(prev => prev.filter(h => h.id !== id));
  }, []);

  const clearHistory = useCallback(() => setHistory([]), []);

  /* ─── Dispensar datas comerciais (com entrada no histórico) ─── */
  const dismissCommercialDate = useCallback((dateKey, dateMeta = {}) => {
    if (!dateKey) return;
    setDismissedDates(prev => prev.includes(dateKey) ? prev : [...prev, dateKey]);
    setNotifications(prev => prev.filter(n => !(n.kind === 'commercial-date' && n.dateKey === dateKey)));
    logHistory({
      type: 'commercial-dismissed',
      title: `Data dispensada: ${dateMeta.name || dateKey}`,
      description: 'Você pode restaurar esta data para voltar a receber o alerta.',
      restorable: true,
      payload: { dateKey, ...dateMeta },
    });
  }, [logHistory]);

  const restoreCommercialDate = useCallback((dateKey) => {
    if (!dateKey) return;
    setDismissedDates(prev => prev.filter(k => k !== dateKey));
    const alerted = load(KEY_COMMERCIAL_ALERTED, []);
    save(KEY_COMMERCIAL_ALERTED, alerted.filter(k => k !== dateKey));
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const markNotificationRead = useCallback((id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => n.read ? n : { ...n, read: true, readAt: new Date().toISOString() }));
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

  const removeRejectedAd = useCallback(async (id) => {
    /* Antes só removia do localStorage — campanha continuava órfã no Meta
       (lixo no Ads Manager). Agora propaga DELETE pro Meta quando o anúncio
       reprovado tem platform_campaign_id (foi publicado e Meta criou). */
    const ad = rejectedAds.find(a => a.id === id);
    const metaCampaignId = ad?.metaCampaignId || ad?.platform_campaign_id;
    if (metaCampaignId && /^\d{6,}$/.test(String(metaCampaignId))) {
      try {
        await fetch('/api/platforms/meta/delete-by-meta-id', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: String(metaCampaignId) }),
        });
      } catch (e) {
        console.warn('[removeRejectedAd] falha ao deletar no Meta — só removendo local:', e?.message);
      }
    }
    setRejectedAds(prev => prev.filter(a => a.id !== id));
  }, [rejectedAds]);

  const addFunds = useCallback((amount) => {
    setFunds(prev => {
      const next = Number((prev + amount).toFixed(2));
      logHistory({
        type: 'funds-added',
        title: `Saldo +R$\u00A0${amount.toFixed(2).replace('.', ',')}`,
        description: `Novo saldo: R$\u00A0${next.toFixed(2).replace('.', ',')}`,
      });
      return next;
    });
  }, [logHistory]);

  useEffect(() => {
    if (funds < LOW_BALANCE_THRESHOLD) {
      const hasAlert = notifications.some(n => n.kind === 'low-balance' && !n.read);
      if (!hasAlert) {
        addNotification({
          kind: 'low-balance',
          title: 'Saldo baixo de investimento',
          message: `Seu saldo está em R$\u00A0${funds.toFixed(2).replace('.', ',')}. Adicione fundos para continuar com seus anúncios.`,
          link: '/investimento',
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [funds]);

  /* ─── Rascunhos (drafts) ───
     Auto-save do wizard: se user sair a meio caminho, persiste como
     status='draft' e aparece em /anuncios com visual diferente pra ser
     retomado depois. Draft é só localStorage — não vai pro backend. */
  const saveDraft = useCallback((draftData) => {
    const KEY_CURRENT_DRAFT = 'ccb_current_draft_id';
    const existingDraftId = localStorage.getItem(KEY_CURRENT_DRAFT);

    setAds(prev => {
      const id = existingDraftId ? Number(existingDraftId) : Date.now();
      if (!existingDraftId) localStorage.setItem(KEY_CURRENT_DRAFT, String(id));
      const draftAd = {
        id,
        adId: `DRAFT-${String(id).slice(-6)}`,
        createdAt: new Date().toISOString(),
        status: 'draft',
        platform: 'instagram',
        thumbGrad: 'linear-gradient(135deg,#E5E7EB,#D1D5DB,#9CA3AF)',
        ...draftData,
      };
      const exists = prev.some(a => a.id === id);
      return exists
        ? prev.map(a => a.id === id ? { ...a, ...draftAd, updatedAt: new Date().toISOString() } : a)
        : [draftAd, ...prev];
    });
  }, []);

  const clearCurrentDraft = useCallback(() => {
    const KEY_CURRENT_DRAFT = 'ccb_current_draft_id';
    const id = localStorage.getItem(KEY_CURRENT_DRAFT);
    if (id) {
      setAds(prev => prev.filter(a => String(a.id) !== id));
      localStorage.removeItem(KEY_CURRENT_DRAFT);
    }
  }, []);

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
    logHistory({
      type: 'ad-created',
      title: `Anúncio criado: ${newAd.name || 'sem nome'}`,
      description: newAd.platform ? `Plataforma: ${newAd.platform}` : null,
    });
    /* Persiste no backend. Se o backend falhar (null) ou rejeitar, REMOVE o ad
       local — eliminamos ads "zumbi" que aparecem no painel mas não existem em
       lugar nenhum (banco ou Meta). Trade-off aceito: offline resiliente vira
       offline-com-erro visível. */
    adsApi.createAd(newAd).then((serverAd) => {
      if (!serverAd || serverAd.__failed) {
        setAds(prev => prev.filter(a => a.id !== newAd.id));
        /* Extrai motivo real garantindo string (nunca [object Object]).
           body.error pode ser string OU objeto {code, message, pt, ...} */
        function extractReason(payload) {
          if (!payload) return 'Sem resposta do servidor';
          const err = payload.error;
          if (typeof err === 'string') return err;
          if (err && typeof err === 'object') {
            return err.pt || err.message || err.error_user_msg || JSON.stringify(err);
          }
          if (payload.meta && typeof payload.meta === 'object') {
            return payload.meta.pt || payload.meta.message || JSON.stringify(payload.meta);
          }
          return 'Erro desconhecido';
        }
        const reason = extractReason(serverAd);
        const friendly =
          serverAd?.status === 504 || serverAd?.status === 408
            ? 'O servidor demorou demais. Reduza imagem/vídeo pra <2MB e tente novamente.'
            : reason;
        /* Log no console pro dev ver o payload completo (facilita debug) */
        if (serverAd) console.error('[publish-failed] resposta completa:', serverAd);
        addNotification({
          kind: 'publish-failed',
          title: 'Falha ao publicar',
          message: `"${newAd.name}" não foi publicado. ${friendly}`,
        });
        return;
      }

      /* Meta recusou a publicação: remove de /anuncios e move pra /reprovados + toca sino.
         Guarda payload completo pra 'Corrigir e reenviar' preservar tudo que user fez. */
      if (serverAd.rejected) {
        setAds(prev => prev.filter(a => a.id !== newAd.id));
        addRejectedAd({
          name: newAd.name,
          reason: serverAd.reason || 'Meta recusou a publicação',
          details: serverAd.details || null,
          code: serverAd.code || null,
          subcode: serverAd.subcode || null,
          stage: serverAd.stage || null,
          userTitle: serverAd.user_title || null,
          sentParams: serverAd.sentParams || null,
          endpoint: serverAd.endpoint || null,
          platform: newAd.platform,
          payload: newAd, /* usado pelo fixMode do CreateAd — restaura tudo que user preencheu */
        });
        return;
      }

      /* Sucesso — adota id real do banco + reconcilia status com o que o
         backend gravou. Antes só atualizava id, e status local 'active'
         (otimismo) mascarava o real do Meta (PAUSED após publish). Caso da
         camp 437: painel mostrava "Ativo" mas Meta tava pausado, user
         esperou 8h por entrega que nunca veio. Agora status local = real. */
      if (serverAd.id) {
        setAds(prev => prev.map(a => a.id === newAd.id ? {
          ...a,
          id: serverAd.id,
          serverId: serverAd.id,
          status: serverAd.status || a.status,
          metaCampaignId: serverAd.metaCampaignId || a.metaCampaignId,
          metaAdSetId: serverAd.metaAdSetId || a.metaAdSetId,
          metaAdId: serverAd.metaAdId || a.metaAdId,
          metaCreativeId: serverAd.metaCreativeId || a.metaCreativeId,
          platform_campaign_id: serverAd.platform_campaign_id || a.platform_campaign_id,
        } : a));
      }
    });
    return newAd;
  }, [logHistory, addRejectedAd]);

  const updateAd = useCallback(async (id, patch) => {
    const before = ads.find(a => a.id === id);
    if (!before) return;
    const fields = Object.keys(patch).filter(k => k !== 'updatedAt').join(', ');
    logHistory({
      type: 'ad-updated',
      title: `Anúncio editado: ${before.name || 'sem nome'}`,
      description: fields ? `Campos: ${fields}` : null,
    });
    const merged = { ...before, ...patch };
    /* Otimista — aplica local imediato; reverte se o Meta recusar */
    setAds(prev => prev.map(a => a.id === id ? merged : a));

    const serverId = before.serverId || before.id;
    try {
      const result = await adsApi.updateAd(serverId, merged);
      if (!result) return; /* offline — permanece local, será reconciliado no sync */
    } catch (err) {
      console.warn('[updateAd] Meta rejeitou, revertendo:', err?.message);
      setAds(prev => prev.map(a => a.id === id ? before : a));
      addNotification({
        type: 'error',
        title: 'Meta recusou a edição',
        description: err?.message || 'Tente novamente em alguns instantes.',
      });
    }
    return merged;
  }, [ads, logHistory, addNotification]);

  const removeAd = useCallback((id) => {
    setAds(prev => {
      const target = prev.find(a => a.id === id);
      if (target) {
        logHistory({
          type: 'ad-removed',
          title: `Anúncio removido: ${target.name || 'sem nome'}`,
          description: 'Você pode restaurar este anúncio no histórico.',
          restorable: true,
          payload: target,
        });
        adsApi.deleteAd(target.serverId || target.id);
      }
      return prev.filter(a => a.id !== id);
    });
  }, [logHistory]);

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
    logHistory({
      type: 'ad-duplicated',
      title: `Anúncio duplicado: ${src.name}`,
      description: `Nova cópia: ${dup.name}`,
    });
    return dup;
  }, [ads, addNotification, logHistory]);

  /* Alterna status local + sincroniza com backend/Meta.
     - review/paused → active: confirma, dispara update, reverte se Meta recusar
     - active → paused: idem
     - outros: no-op */
  const toggleAdStatus = useCallback(async (id) => {
    const current = ads.find(a => a.id === id);
    if (!current) return;
    let next;
    if (current.status === 'active') next = 'paused';
    else if (current.status === 'paused' || current.status === 'review') next = 'active';
    else return;

    /* Aplica otimisticamente — UI responde na hora */
    setAds(prev => prev.map(a => a.id === id ? { ...a, status: next } : a));
    logHistory({
      type: next === 'active' ? 'ad-activated' : 'ad-paused',
      title: `${next === 'active' ? 'Ativado' : 'Pausado'}: ${current.name || 'anúncio'}`,
    });

    /* Persiste no backend. Se backend rejeitar (ex: Meta recusa), reverte o estado local. */
    const serverId = current.serverId || current.id;
    try {
      const result = await adsApi.updateAdStatus(serverId, next);
      if (!result) {
        /* Rede offline — mantém local, será reconciliado no próximo sync */
        return;
      }
      /* Força refresh do effective_status sem esperar o tick de 90s do polling.
         Sem isso, a UI mostra "Pausado no Meta" mesmo após dar play até o
         próximo tick (até 90s grudado em estado obsoleto). 2,5s = tempo de
         o Meta processar a mudança e devolver o novo effective_status. */
      setTimeout(() => { runMetaSync().catch(() => {}); }, 2500);
    } catch (err) {
      console.warn('[toggleAdStatus] backend rejeitou, revertendo:', err?.message);
      setAds(prev => prev.map(a => a.id === id ? { ...a, status: current.status } : a));
      addNotification({
        type: 'error',
        title: `Não foi possível ${next === 'active' ? 'ativar' : 'pausar'} no Meta`,
        description: err?.message || 'Tente novamente em alguns instantes.',
      });
    }
  }, [ads, logHistory, addNotification, runMetaSync]);

  const getAdById = useCallback((id) => ads.find(a => a.id === id) || null, [ads]);

  /* ─── Públicos salvos ─── */
  const addAudience = useCallback((audience) => {
    const newAudience = {
      id: `aud-${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...audience,
    };
    setAudiences(prev => [newAudience, ...prev]);
    logHistory({
      type: 'audience-created',
      title: `Público criado: ${newAudience.name || 'sem nome'}`,
    });
    return newAudience;
  }, [logHistory]);

  const updateAudience = useCallback((id, patch) => {
    setAudiences(prev => prev.map(a => {
      if (a.id !== id) return a;
      logHistory({
        type: 'audience-updated',
        title: `Público editado: ${a.name || 'sem nome'}`,
      });
      return { ...a, ...patch };
    }));
  }, [logHistory]);

  const removeAudience = useCallback((id) => {
    setAudiences(prev => {
      const target = prev.find(a => a.id === id);
      if (target) {
        logHistory({
          type: 'audience-removed',
          title: `Público removido: ${target.name || 'sem nome'}`,
          description: 'Você pode restaurar este público no histórico.',
          restorable: true,
          payload: target,
        });
      }
      return prev.filter(a => a.id !== id);
    });
  }, [logHistory]);

  /* ─── Biblioteca de criativos ─── */
  const addCreative = useCallback((creative) => {
    const newCreative = {
      id: `cre-${Date.now()}`,
      createdAt: new Date().toISOString(),
      usedCount: 0,
      ...creative,
    };
    setCreatives(prev => [newCreative, ...prev]);
    logHistory({
      type: 'creative-created',
      title: `Criativo criado: ${newCreative.name || newCreative.headline || 'sem nome'}`,
    });
    return newCreative;
  }, [logHistory]);

  const markCreativeUsed = useCallback((id) => {
    setCreatives(prev => prev.map(c => c.id === id ? { ...c, usedCount: (c.usedCount || 0) + 1 } : c));
  }, []);

  const removeCreative = useCallback((id) => {
    setCreatives(prev => {
      const target = prev.find(c => c.id === id);
      if (target) {
        logHistory({
          type: 'creative-removed',
          title: `Criativo removido: ${target.name || target.headline || 'sem nome'}`,
          description: 'Você pode restaurar este criativo no histórico.',
          restorable: true,
          payload: target,
        });
      }
      return prev.filter(c => c.id !== id);
    });
  }, [logHistory]);

  /* ─── Presets de localização (bairros + modo de anéis) ─── */
  const addLocationPreset = useCallback((preset) => {
    const newPreset = {
      id: `lp-${Date.now()}`,
      createdAt: new Date().toISOString(),
      name: preset.name?.trim() || 'Preset sem nome',
      locations: preset.locations || [],
      ringsMode: preset.ringsMode || 'auto',
    };
    setLocationPresets(prev => [newPreset, ...prev]);
    return newPreset;
  }, []);

  const updateLocationPreset = useCallback((id, patch) => {
    setLocationPresets(prev => prev.map(p => p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p));
  }, []);

  const removeLocationPreset = useCallback((id) => {
    setLocationPresets(prev => prev.filter(p => p.id !== id));
  }, []);

  /* ─── Restaurar entradas do histórico ─── */
  const restoreHistoryEntry = useCallback((id) => {
    const entry = history.find(h => h.id === id);
    if (!entry || !entry.restorable || entry.restored) return false;

    if (entry.type === 'commercial-dismissed') {
      const key = entry.payload?.dateKey;
      if (key) {
        setDismissedDates(prev => prev.filter(k => k !== key));
        const alerted = load(KEY_COMMERCIAL_ALERTED, []);
        save(KEY_COMMERCIAL_ALERTED, alerted.filter(k => k !== key));
      }
    } else if (entry.type === 'ad-removed') {
      setAds(prev => prev.some(a => a.id === entry.payload?.id) ? prev : [entry.payload, ...prev]);
    } else if (entry.type === 'audience-removed') {
      setAudiences(prev => prev.some(a => a.id === entry.payload?.id) ? prev : [entry.payload, ...prev]);
    } else if (entry.type === 'creative-removed') {
      setCreatives(prev => prev.some(c => c.id === entry.payload?.id) ? prev : [entry.payload, ...prev]);
    } else {
      return false;
    }

    setHistory(prev => prev.map(h => h.id === id ? { ...h, restored: true, restoredAt: new Date().toISOString() } : h));
    return true;
  }, [history]);

  const value = {
    notifications,
    unreadCount: notifications.filter(n => !n.read).length,
    addNotification,
    removeNotification,
    markNotificationRead,
    markAllNotificationsRead,
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

    metaBilling,
    metaBillingLoading,
    metaBillingLastUpdate,
    refreshMetaBilling,

    paymentMethod,
    setPaymentMethod,

    ads,
    addAd,
    updateAd,
    removeAd,
    duplicateAd,
    toggleAdStatus,
    getAdById,
    saveDraft,
    clearCurrentDraft,
    runMetaSync,
    metaSyncedAt,
    metaSyncing,

    audiences,
    addAudience,
    updateAudience,
    removeAudience,

    creatives,
    addCreative,
    markCreativeUsed,
    removeCreative,

    locationPresets,
    addLocationPreset,
    updateLocationPreset,
    removeLocationPreset,

    pixel,
    setPixel,

    syncStatus,

    history,
    logHistory,
    removeHistoryEntry,
    restoreHistoryEntry,
    clearHistory,

    dismissedDates,
    dismissCommercialDate,
    restoreCommercialDate,
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState deve ser usado dentro de AppStateProvider');
  return ctx;
}
