import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';

/**
 * Widget de status fixado no canto inferior esquerdo do painel.
 *
 * Mostra 4 peças do sistema (Banco, Meta Ads, IA Groq, Webhook) com semáforo.
 * Clique na pílula expande um card com detalhes + ações rápidas.
 *
 * Polling automático a cada 60s; refetch manual via botão.
 * Busca em GET /api/health/full (ver backend/src/routes/health.js).
 */

const POLL_INTERVAL_MS = 60_000;

const STATUS_META = {
  ok:    { color: '#16A34A', bg: 'rgba(22,163,74,.10)',  label: 'Sistema ok',        icon: '🟢' },
  warn:  { color: '#F59E0B', bg: 'rgba(245,158,11,.10)', label: 'Atenção',           icon: '🟡' },
  error: { color: '#DC2626', bg: 'rgba(239,68,68,.10)',  label: 'Precisa atenção',   icon: '🔴' },
  loading:{ color: '#9CA3AF', bg: 'rgba(156,163,175,.10)', label: 'Verificando…',    icon: '⚪' },
};

export default function SystemStatus() {
  const [state, setState] = useState({ overall: 'loading', items: [], checked_at: null, error: null });
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const abortRef = useRef(null);

  const fetchHealth = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch('/api/health/full', { signal: ctrl.signal });
      const json = await res.json();
      setState({ overall: json.overall || 'error', items: json.items || [], checked_at: json.checked_at, error: null });
    } catch (e) {
      if (e.name === 'AbortError') return;
      setState(s => ({ ...s, overall: 'error', error: e.message }));
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const id = setInterval(fetchHealth, POLL_INTERVAL_MS);
    return () => { clearInterval(id); if (abortRef.current) abortRef.current.abort(); };
  }, [fetchHealth]);

  /* Fecha ao clicar fora */
  useEffect(() => {
    if (!open) return;
    function onClick(e) { if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const s = STATUS_META[state.overall] || STATUS_META.loading;

  function fmtTime(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  }

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        bottom: '14px',
        left: '14px',
        zIndex: 90, /* abaixo do modal da IA (que é 100+) */
        fontFamily: 'inherit',
      }}
    >
      {/* Pílula compacta */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Status do sistema"
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '6px 12px',
          background: 'var(--c-card-bg)',
          border: `1.5px solid ${s.color}`,
          borderRadius: '999px',
          fontSize: '11.5px',
          fontWeight: 700,
          color: s.color,
          cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(0,0,0,.08)',
          transition: 'transform .14s ease, box-shadow .14s ease',
          fontFamily: 'inherit',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,.12)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,.08)'; }}
      >
        <span style={{ fontSize: '12px', lineHeight: 1 }}>{s.icon}</span>
        <span>{s.label}</span>
      </button>

      {/* Painel expandido */}
      {open && (
        <div
          style={{
            position: 'absolute', bottom: 'calc(100% + 8px)', left: 0,
            width: '340px',
            background: 'var(--c-card-bg)',
            border: '1px solid var(--c-border)',
            borderRadius: '14px',
            boxShadow: '0 16px 48px rgba(214,141,143,.22)',
            overflow: 'hidden',
            animation: 'fadeIn .18s ease',
          }}
        >
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--c-border-lt)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text-1)' }}>
              Status do sistema
            </div>
            <button
              onClick={fetchHealth}
              title="Atualizar agora"
              style={{
                background: 'var(--c-surface)',
                border: '1px solid var(--c-border)',
                borderRadius: '7px',
                padding: '3px 9px',
                fontSize: '11px', fontWeight: 600,
                color: 'var(--c-text-3)', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              ↻ Atualizar
            </button>
          </div>

          <div style={{ padding: '6px 0' }}>
            {state.items.length === 0 && state.overall === 'loading' && (
              <div style={{ padding: '20px', textAlign: 'center', fontSize: '12px', color: 'var(--c-text-4)' }}>
                🔎 Verificando integrações…
              </div>
            )}
            {state.items.map(item => {
              const palette = STATUS_META[item.status] || STATUS_META.loading;
              return (
                <div key={item.key} style={{ padding: '10px 14px', borderTop: '1px solid var(--c-border-lt)', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '13px', marginTop: '1px' }}>{palette.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '2px' }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--c-text-3)', lineHeight: 1.5 }}>
                      {item.details}
                    </div>
                    {item.key === 'meta' && item.status !== 'ok' && (
                      <Link
                        to="/investimento"
                        onClick={() => setOpen(false)}
                        style={{
                          display: 'inline-block', marginTop: '6px',
                          fontSize: '11px', fontWeight: 700,
                          color: 'var(--c-accent)', textDecoration: 'none',
                        }}
                      >
                        Abrir Investimento →
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ padding: '8px 14px', borderTop: '1px solid var(--c-border-lt)', fontSize: '10.5px', color: 'var(--c-text-4)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Última verificação: {fmtTime(state.checked_at)}</span>
            <span>atualiza a cada 60s</span>
          </div>
        </div>
      )}
    </div>
  );
}
