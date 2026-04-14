import React, { useEffect, useState } from 'react';
import api from '../services/api';

const ACTION_CONFIG = {
  create:        { icon: '✦', label: 'Criação',       color: '#27AE60', bg: '#E8F8EF' },
  status_change: { icon: '◎', label: 'Status',         color: '#4F46E5', bg: '#EEF2FF' },
  delete:        { icon: '✕', label: 'Remoção',        color: '#E74C3C', bg: '#FDEAED' },
  update:        { icon: '✏', label: 'Edição',         color: '#D97706', bg: '#FFFBEB' },
  sync:          { icon: '⟳', label: 'Sincronização', color: '#C13584', bg: '#FDE8F4' },
  alert:         { icon: '🔔', label: 'Alerta',        color: '#E67E22', bg: '#FEF3C7' },
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (m < 1)  return 'agora mesmo';
  if (m < 60) return `${m} min atrás`;
  if (h < 24) return `${h}h atrás`;
  if (d < 7)  return `${d}d atrás`;
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export default function History() {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('');

  useEffect(() => {
    api.get('/api/history?limit=100')
      .then(r => setLogs(Array.isArray(r.data) ? r.data : []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter ? logs.filter(l => l.action === filter) : logs;

  const actionTypes = [...new Set(logs.map(l => l.action))];

  return (
    <div style={{ padding: '24px 28px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--c-text-1)', marginBottom: '2px' }}>Histórico de Ações</h2>
          <div style={{ fontSize: '12px', color: 'var(--c-text-4)' }}>{logs.length} registro{logs.length !== 1 ? 's' : ''} encontrado{logs.length !== 1 ? 's' : ''}</div>
        </div>

        {/* Filtros */}
        {actionTypes.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <div onClick={() => setFilter('')} style={{ padding: '5px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 500, border: `1.5px solid ${!filter ? 'var(--c-accent)' : 'var(--c-border)'}`, background: !filter ? 'var(--c-active-bg)' : 'var(--c-card-bg)', color: !filter ? 'var(--c-accent)' : 'var(--c-text-3)', cursor: 'pointer', transition: 'all .15s' }}>
              Todos
            </div>
            {actionTypes.map(a => {
              const cfg = ACTION_CONFIG[a] || { icon: '●', label: a, color: '#999', bg: '#eee' };
              const active = filter === a;
              return (
                <div key={a} onClick={() => setFilter(active ? '' : a)} style={{ padding: '5px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 500, border: `1.5px solid ${active ? cfg.color : 'var(--c-border)'}`, background: active ? cfg.bg : 'var(--c-card-bg)', color: active ? cfg.color : 'var(--c-text-3)', cursor: 'pointer', transition: 'all .15s' }}>
                  {cfg.icon} {cfg.label}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--c-text-4)', fontSize: '13px' }}>Carregando histórico...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px', opacity: .4 }}>📋</div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '6px' }}>Nenhum registro ainda</h3>
          <p style={{ fontSize: '13px', color: 'var(--c-text-3)' }}>As ações do sistema aparecerão aqui.</p>
        </div>
      ) : (
        <div style={{ background: 'var(--c-card-bg)', borderRadius: '16px', border: '1px solid var(--c-border)', boxShadow: '0 2px 12px var(--c-shadow)', overflow: 'hidden' }}>
          {filtered.map((log, idx) => {
            const cfg = ACTION_CONFIG[log.action] || { icon: '●', label: log.action, color: 'var(--c-text-3)', bg: 'var(--c-surface)' };
            let meta = null;
            try { meta = log.meta ? JSON.parse(log.meta) : null; } catch {}

            return (
              <div
                key={log.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '14px',
                  padding: '14px 20px',
                  borderBottom: idx < filtered.length - 1 ? '1px solid var(--c-border-lt)' : 'none',
                  transition: 'background .15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--c-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {/* Ícone */}
                <div style={{
                  width: '34px', height: '34px', borderRadius: '10px',
                  background: cfg.bg, color: cfg.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px', fontWeight: 700, flexShrink: 0,
                }}>
                  {cfg.icon}
                </div>

                {/* Conteúdo */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '2px 8px', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                      {cfg.label}
                    </span>
                    {log.entity_id && (
                      <span style={{ fontSize: '9px', color: 'var(--c-text-4)', fontWeight: 600 }}>#{log.entity_id}</span>
                    )}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--c-text-1)', fontWeight: 500, marginBottom: '3px', lineHeight: 1.4 }}>
                    {log.description || `${cfg.label} em ${log.entity}`}
                  </div>
                  {meta && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {Object.entries(meta).map(([k, v]) => (
                        <span key={k} style={{ fontSize: '9px', color: 'var(--c-text-4)', background: 'var(--c-surface)', padding: '1px 7px', borderRadius: '20px', border: '1px solid var(--c-border-lt)' }}>
                          {k}: {String(v)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tempo */}
                <div style={{ fontSize: '10px', color: 'var(--c-text-4)', fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0, marginTop: '2px' }}>
                  {timeAgo(log.created_at)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
