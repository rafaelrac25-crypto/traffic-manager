import React, { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { playBubble } from '../utils/sounds';
import AgencyScene from './AgencyScene';

const MAX_BUFFER = 50;
const POLL_INTERVAL_MS = 1500;

export default function Agency() {
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);
  const lastTsRef = useRef(0);
  const mountedRef = useRef(true);

  /* Polling do Postgres a cada 1.5s — fonte única de verdade pra cena.
     SSE não funciona em multi-instance Vercel (POST/GET caem em containers
     diferentes). Trade-off: latência ~1.5s. */
  useEffect(() => {
    mountedRef.current = true;

    api.get('/api/agency/recent?limit=50').then(r => {
      if (!mountedRef.current) return;
      const evs = r.data?.events || [];
      setEvents(evs);
      lastTsRef.current = evs.length > 0 ? Math.max(...evs.map(e => e.ts)) : 0;
      setConnected(true);
    }).catch(() => setConnected(false));

    const tick = async () => {
      if (!mountedRef.current) return;
      try {
        const r = await api.get(`/api/agency/recent?since=${lastTsRef.current}&limit=20`);
        if (!mountedRef.current) return;
        const fresh = r.data?.events || [];
        if (fresh.length > 0) {
          setEvents(prev => {
            const seen = new Set(prev.map(e => e.id));
            const merged = [...fresh.filter(e => !seen.has(e.id)), ...prev];
            return merged.slice(0, MAX_BUFFER);
          });
          lastTsRef.current = Math.max(lastTsRef.current, ...fresh.map(e => e.ts));
          try { playBubble(); } catch { /* ok */ }
        }
        setConnected(true);
      } catch {
        if (mountedRef.current) setConnected(false);
      }
    };

    const iv = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(iv);
    };
  }, []);

  return (
    <div style={{
      maxWidth: '1280px',
      margin: '0 auto',
      padding: '24px 28px',
      color: 'var(--c-text-1)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px',
      }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0, letterSpacing: '-0.4px' }}>
            🕹️ Agência 2D
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--c-text-3)', margin: '4px 0 0' }}>
            Escritório ao vivo do Claude Code — cada agente acende quando entra em ação
          </p>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          borderRadius: '999px',
          background: 'var(--c-surface)',
          border: '1px solid var(--c-border-lt)',
          fontSize: '11px',
          fontWeight: 600,
        }}>
          <span style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: connected ? '#22C55E' : '#EF4444',
            boxShadow: connected ? '0 0 8px rgba(34,197,94,.5)' : 'none',
          }} />
          {connected ? 'conectado' : 'reconectando…'}
        </div>
      </div>

      <AgencyScene events={events} />
    </div>
  );
}
