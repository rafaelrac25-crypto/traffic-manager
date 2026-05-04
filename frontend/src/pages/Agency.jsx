import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api';
import { playBubble } from '../utils/sounds';

/* Cores por agente — paleta vinho/rosé do projeto + complementares. */
const AGENT_COLORS = {
  main:              '#C13584',
  'Claude Code':     '#C13584',
  Sonnet:            '#60A5FA',
  Haiku:             '#34D399',
  Opus:              '#A78BFA',
  'general-purpose': '#F59E0B',
  Explore:           '#22D3EE',
  Plan:              '#F472B6',
};
const FALLBACK_COLOR = '#94A3B8';

const TOOL_ICON = {
  Read:     '📖',
  Edit:     '✎',
  Write:    '＋',
  MultiEdit:'✎✎',
  Bash:     '＞_',
  Grep:     '🔍',
  Glob:     '🔍',
  WebFetch: '🌐',
  WebSearch:'🌐',
  Task:     '🤖',
  Skill:    '🛠',
  Agent:    '🤖',
};

function colorForAgent(name) {
  return AGENT_COLORS[name] || FALLBACK_COLOR;
}

function relativeTime(ts) {
  const diff = Math.max(0, Date.now() - ts);
  if (diff < 1500) return 'agora';
  if (diff < 60_000) return `${Math.round(diff / 1000)}s atrás`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}min atrás`;
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

const MAX_VISIBLE = 50;
const POLL_INTERVAL_MS = 1500;

export default function Agency() {
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState('all');
  const [connected, setConnected] = useState(false);
  const lastTsRef = useRef(0);
  const mountedRef = useRef(true);

  /* Polling — em multi-instance Vercel, SSE não funciona (POST e GET vão pra
     containers diferentes; emitter local não conversa entre instâncias).
     Polling do Postgres a cada 1.5s usa a tabela agency_events como fonte
     única de verdade. Trade-off: latência ~1.5s, mas funciona em qualquer
     topologia serverless. */
  useEffect(() => {
    mountedRef.current = true;

    /* Hidratação inicial — pega últimos 50. */
    api.get('/api/agency/recent?limit=50').then(r => {
      if (!mountedRef.current) return;
      const evs = r.data?.events || [];
      setEvents(evs);
      lastTsRef.current = evs.length > 0 ? Math.max(...evs.map(e => e.ts)) : 0;
      setConnected(true);
    }).catch(() => setConnected(false));

    /* Polling incremental — só pega eventos com ts > lastTsRef. */
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
            return merged.slice(0, MAX_VISIBLE);
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

  const agents = useMemo(() => {
    const set = new Set(['all']);
    for (const ev of events) set.add(ev.agent);
    return Array.from(set);
  }, [events]);

  const filtered = useMemo(() => {
    if (filter === 'all') return events;
    return events.filter(e => e.agent === filter);
  }, [events, filter]);

  return (
    <div style={{
      maxWidth: '900px',
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
            Eventos ao vivo do Claude Code rodando no terminal — Fase 1 (texto)
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

      {agents.length > 2 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
          {agents.map(a => (
            <button
              key={a}
              onClick={() => setFilter(a)}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 600,
                borderRadius: '999px',
                border: '1px solid var(--c-border-lt)',
                background: filter === a ? colorForAgent(a) : 'var(--c-surface)',
                color: filter === a ? '#fff' : 'var(--c-text-2)',
                cursor: 'pointer',
              }}
            >
              {a}
            </button>
          ))}
        </div>
      )}

      <div style={{
        background: 'var(--c-card-bg)',
        border: '1px solid var(--c-border-lt)',
        borderRadius: '12px',
        overflow: 'hidden',
      }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--c-text-3)', fontSize: '13px' }}>
            <div style={{ fontSize: '40px', marginBottom: '8px', opacity: 0.4 }}>🎮</div>
            Aguardando os agentes acordarem… faz qualquer comando no Claude Code que aparece aqui.
          </div>
        ) : filtered.map((ev, idx) => (
          <div
            key={ev.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '110px 60px 1fr 70px',
              gap: '12px',
              alignItems: 'center',
              padding: '10px 14px',
              borderBottom: idx === filtered.length - 1 ? 'none' : '1px solid var(--c-border-lt)',
              fontSize: '12.5px',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            }}
          >
            <span style={{
              padding: '3px 9px',
              borderRadius: '6px',
              background: colorForAgent(ev.agent) + '22',
              color: colorForAgent(ev.agent),
              fontWeight: 700,
              fontSize: '11px',
              textAlign: 'center',
              fontFamily: 'inherit',
            }}>
              {ev.agent}
            </span>
            <span style={{
              fontSize: '13px',
              color: 'var(--c-text-2)',
              textAlign: 'center',
              fontFamily: 'inherit',
            }}>
              {TOOL_ICON[ev.tool] || ev.tool.slice(0, 4)}
            </span>
            <span style={{
              color: ev.status === 'error' ? '#EF4444' : 'var(--c-text-1)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {ev.action || ev.tool}
              {ev.meta?.file && (
                <span style={{ color: 'var(--c-text-3)', marginLeft: 6 }}>
                  · {ev.meta.file}
                </span>
              )}
              {ev.duration_ms != null && (
                <span style={{ color: 'var(--c-text-4)', marginLeft: 6 }}>
                  ({ev.duration_ms}ms)
                </span>
              )}
            </span>
            <span style={{
              fontSize: '10.5px',
              color: 'var(--c-text-4)',
              textAlign: 'right',
              fontFeatureSettings: "'tnum'",
            }}>
              {relativeTime(ev.ts)}
            </span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--c-text-4)', textAlign: 'right' }}>
        {filtered.length} evento{filtered.length === 1 ? '' : 's'} · cap {MAX_VISIBLE} · poll {POLL_INTERVAL_MS}ms
      </div>
    </div>
  );
}
