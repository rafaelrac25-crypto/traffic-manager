import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';

/**
 * Linha de status do sistema integrada na sidebar (acima do "Tema escuro").
 * Mantém visual consistente com as outras linhas (Tema, Perfil) da sidebar.
 *
 * Clique abre popover à direita da sidebar com os 4 semáforos detalhados:
 * Banco Neon · Meta Ads · IA (Groq) · Webhook Meta.
 *
 * Polling automático a cada 60s, com botão de refresh manual no popover.
 * Busca em GET /api/health/full (ver backend/src/routes/health.js).
 */

const POLL_INTERVAL_MS = 60_000;

const STATUS_META = {
  ok:      { color: '#16A34A', label: 'Sistema ok',      icon: '🟢' },
  warn:    { color: '#F59E0B', label: 'Atenção',         icon: '🟡' },
  error:   { color: '#DC2626', label: 'Precisa atenção', icon: '🔴' },
  loading: { color: '#9CA3AF', label: 'Verificando…',    icon: '⚪' },
};

const StatusIcon = ({ color }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="3" fill={color} stroke="none" />
  </svg>
);

export default function SystemStatus() {
  const [state, setState] = useState({ overall: 'loading', items: [], checked_at: null, error: null });
  const [open, setOpen] = useState(false);
  const rowRef = useRef(null);
  const popoverRef = useRef(null);
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

  /* Fecha popover ao clicar fora */
  useEffect(() => {
    if (!open) return;
    function onClick(e) {
      if (rowRef.current?.contains(e.target)) return;
      if (popoverRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const s = STATUS_META[state.overall] || STATUS_META.loading;

  const fmtTime = (iso) => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch { return iso; }
  };

  return (
    <>
      {/* Linha de status — alinha com "Tema escuro" e "Perfil" na sidebar */}
      <div style={{ padding: '8px 10px', borderTop: '1px solid var(--c-border-lt)' }}>
        <div
          ref={rowRef}
          onClick={() => setOpen(o => !o)}
          title="Clique pra ver detalhes das conexões"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '9px 12px', borderRadius: '10px', cursor: 'pointer',
            background: open ? 'var(--c-hover)' : 'transparent',
            transition: 'background .15s',
          }}
          onMouseEnter={e => { if (!open) e.currentTarget.style.background = 'var(--c-hover)'; }}
          onMouseLeave={e => { if (!open) e.currentTarget.style.background = 'transparent'; }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--c-text-3)' }}>
            {/* Bolinha tipo sinaleira (única — substitui ícone alvo + bolinha da direita) */}
            <span style={{
              width: '10px', height: '10px', borderRadius: '50%',
              background: s.color,
              flexShrink: 0,
              boxShadow: `0 0 0 3px ${s.color}22, 0 0 8px ${s.color}66`,
              display: 'inline-block',
            }} />
            <span style={{ fontSize: '12px', fontWeight: 500 }}>
              Status do sistema
            </span>
          </div>
        </div>
      </div>

      {/* Popover detalhado — aparece à direita da sidebar quando aberto */}
      {open && (
        <div
          ref={popoverRef}
          style={{
            position: 'fixed',
            left: '230px', /* 220px sidebar + 10px gap */
            bottom: '70px', /* alinhado acima da área do perfil */
            width: '340px',
            background: 'var(--c-card-bg)',
            border: '1px solid var(--c-border)',
            borderRadius: '14px',
            boxShadow: '0 16px 48px rgba(0,0,0,.18)',
            zIndex: 101,
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
    </>
  );
}
