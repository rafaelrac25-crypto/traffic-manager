import React, { useMemo, useState } from 'react';
import { useAppState } from '../contexts/AppStateContext';

const TYPE_META = {
  'commercial-dismissed': { emoji: '📅', label: 'Data comercial dispensada', color: '#8B5CF6' },
  'ad-removed':           { emoji: '🗑️', label: 'Anúncio removido',         color: '#EF4444' },
  'audience-removed':     { emoji: '👥', label: 'Público removido',          color: '#EF4444' },
  'creative-removed':     { emoji: '🎨', label: 'Criativo removido',         color: '#EF4444' },
  'ad-published':         { emoji: '🚀', label: 'Anúncio publicado',         color: '#22C55E' },
  'ad-updated':           { emoji: '✏️', label: 'Anúncio atualizado',        color: '#3B82F6' },
  'ad-corrected':         { emoji: '✅', label: 'Correção publicada',        color: '#22C55E' },
};

function formatDateGroup(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return 'Hoje';
  if (sameDay(d, yesterday)) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function History() {
  const { history, restoreHistoryEntry, removeHistoryEntry, clearHistory } = useAppState();
  const [filter, setFilter] = useState('all');
  const [feedback, setFeedback] = useState(null);

  const filtered = useMemo(() => {
    if (filter === 'all') return history;
    if (filter === 'restorable') return history.filter(h => h.restorable && !h.restored);
    return history.filter(h => h.type === filter);
  }, [history, filter]);

  const grouped = useMemo(() => {
    const g = {};
    filtered.forEach(h => {
      const key = formatDateGroup(h.createdAt);
      if (!g[key]) g[key] = [];
      g[key].push(h);
    });
    return g;
  }, [filtered]);

  const restorableCount = history.filter(h => h.restorable && !h.restored).length;

  function handleRestore(id) {
    const ok = restoreHistoryEntry(id);
    setFeedback({ kind: ok ? 'ok' : 'err', text: ok ? 'Entrada restaurada com sucesso.' : 'Não foi possível restaurar.' });
    setTimeout(() => setFeedback(null), 2400);
  }

  function handleClearAll() {
    if (window.confirm('Limpar todo o histórico? Itens restauráveis serão perdidos.')) {
      clearHistory();
    }
  }

  return (
    <div className="page-container">
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '6px' }}>
          Histórico
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--c-text-3)', lineHeight: 1.6 }}>
          Registro das ações principais do sistema. Use para restaurar itens removidos ou datas dispensadas.
        </p>
      </div>

      {feedback && (
        <div style={{
          padding: '10px 14px', borderRadius: '10px', marginBottom: '16px', fontSize: '13px', fontWeight: 600,
          background: feedback.kind === 'ok' ? '#DCFCE7' : '#FEE2E2',
          color: feedback.kind === 'ok' ? '#166534' : '#991B1B',
          border: `1px solid ${feedback.kind === 'ok' ? '#86EFAC' : '#FCA5A5'}`,
        }}>
          {feedback.text}
        </div>
      )}

      <div style={{
        background: 'var(--c-card-bg)', border: '1px solid var(--c-border)',
        borderRadius: '14px', padding: '16px', marginBottom: '16px',
        display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'all',        label: `Tudo (${history.length})` },
            { id: 'restorable', label: `Restauráveis (${restorableCount})` },
            { id: 'commercial-dismissed', label: 'Datas dispensadas' },
            { id: 'ad-published', label: 'Anúncios publicados' },
            { id: 'ad-removed',   label: 'Anúncios removidos' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                padding: '7px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 600,
                cursor: 'pointer',
                background: filter === f.id ? 'var(--c-accent)' : 'var(--c-surface)',
                color:      filter === f.id ? '#fff'            : 'var(--c-text-3)',
                border: `1px solid ${filter === f.id ? 'var(--c-accent)' : 'var(--c-border)'}`,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        {history.length > 0 && (
          <button
            onClick={handleClearAll}
            style={{
              background: 'transparent', border: '1px solid var(--c-border)',
              color: 'var(--c-text-3)', borderRadius: '8px',
              padding: '7px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Limpar histórico
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div style={{
          background: 'var(--c-card-bg)', border: '1px solid var(--c-border)',
          borderRadius: '14px', padding: '60px 20px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
          <div style={{ fontSize: '14px', color: 'var(--c-text-3)', fontWeight: 600, marginBottom: '4px' }}>
            Nada no histórico ainda
          </div>
          <div style={{ fontSize: '12px', color: 'var(--c-text-4)' }}>
            As ações principais (publicar, remover, dispensar datas) aparecerão aqui.
          </div>
        </div>
      ) : (
        Object.entries(grouped).map(([groupLabel, entries]) => (
          <div key={groupLabel} style={{ marginBottom: '20px' }}>
            <div style={{
              fontSize: '11px', fontWeight: 700, color: 'var(--c-text-4)',
              textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '8px', padding: '0 4px',
            }}>
              {groupLabel} · {entries.length} {entries.length === 1 ? 'ação' : 'ações'}
            </div>
            <div style={{
              background: 'var(--c-card-bg)', border: '1px solid var(--c-border)',
              borderRadius: '14px', overflow: 'hidden',
            }}>
              {entries.map((h, idx) => {
                const meta = TYPE_META[h.type] || { emoji: '•', label: h.type, color: 'var(--c-text-3)' };
                const canRestore = h.restorable && !h.restored;
                return (
                  <div
                    key={h.id}
                    style={{
                      padding: '14px 16px', display: 'flex', gap: '12px', alignItems: 'flex-start',
                      borderBottom: idx < entries.length - 1 ? '1px solid var(--c-border-lt)' : 'none',
                      opacity: h.restored ? 0.6 : 1,
                    }}
                  >
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                      background: `${meta.color}15`, color: meta.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px',
                    }}>
                      {meta.emoji}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '2px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text-1)' }}>
                          {h.title}
                        </span>
                        {h.restored && (
                          <span style={{
                            fontSize: '10px', fontWeight: 700, color: '#16A34A',
                            background: '#DCFCE7', padding: '2px 7px', borderRadius: '999px',
                          }}>
                            Restaurado
                          </span>
                        )}
                      </div>
                      {h.description && (
                        <div style={{ fontSize: '12px', color: 'var(--c-text-3)', lineHeight: 1.5, marginBottom: '4px' }}>
                          {h.description}
                        </div>
                      )}
                      <div style={{ fontSize: '10px', color: 'var(--c-text-4)' }}>
                        {meta.label} · {formatTime(h.createdAt)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      {canRestore && (
                        <button
                          onClick={() => handleRestore(h.id)}
                          style={{
                            background: 'var(--c-accent)', color: '#fff', border: 'none',
                            borderRadius: '8px', padding: '7px 12px', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                          }}
                        >
                          ↶ Restaurar
                        </button>
                      )}
                      <button
                        onClick={() => removeHistoryEntry(h.id)}
                        title="Remover do histórico"
                        style={{
                          background: 'transparent', color: 'var(--c-text-4)',
                          border: '1px solid var(--c-border)',
                          borderRadius: '8px', padding: '7px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
