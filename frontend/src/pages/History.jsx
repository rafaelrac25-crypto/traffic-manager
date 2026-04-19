import React, { useMemo, useState } from 'react';
import { useAppState } from '../contexts/AppStateContext';

const TYPE_META = {
  'commercial-dismissed': { icon: '📅', label: 'Data dispensada', color: '#8B5CF6' },
  'ad-removed':           { icon: '🗑',  label: 'Anúncio removido', color: '#EF4444' },
  'ad-created':           { icon: '＋',  label: 'Anúncio criado',   color: '#16A34A' },
  'ad-updated':           { icon: '✎',  label: 'Anúncio editado',  color: '#3B82F6' },
  'ad-paused':            { icon: '⏸',  label: 'Anúncio pausado',  color: '#EA580C' },
  'ad-activated':         { icon: '▶',  label: 'Anúncio ativado',  color: '#16A34A' },
  'ad-duplicated':        { icon: '⎘',  label: 'Anúncio duplicado',color: '#0EA5E9' },
  'ad-published':         { icon: '🚀', label: 'Anúncio publicado',color: '#22C55E' },
  'ad-corrected':         { icon: '✅', label: 'Correção publicada',color: '#22C55E' },
  'audience-created':     { icon: '＋',  label: 'Público criado',   color: '#16A34A' },
  'audience-removed':     { icon: '🗑',  label: 'Público removido', color: '#EF4444' },
  'audience-updated':     { icon: '✎',  label: 'Público editado',  color: '#3B82F6' },
  'creative-created':     { icon: '＋',  label: 'Criativo criado',  color: '#16A34A' },
  'creative-removed':     { icon: '🗑',  label: 'Criativo removido',color: '#EF4444' },
  'creative-used':        { icon: '♻',  label: 'Criativo reusado', color: '#0EA5E9' },
  'funds-added':          { icon: '💰', label: 'Saldo adicionado', color: '#16A34A' },
  'platform-connected':   { icon: '🔗', label: 'Plataforma conectada', color: '#16A34A' },
  'platform-disconnected':{ icon: '⛓',  label: 'Plataforma desconectada', color: '#EA580C' },
  'payment-updated':      { icon: '💳', label: 'Pagamento atualizado', color: '#3B82F6' },
};

function groupKey(iso) {
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

function LogRow({ entry, onRestore, onRemove }) {
  const [hovered, setHovered] = useState(false);
  const meta = TYPE_META[entry.type] || { icon: '·', label: entry.type, color: 'var(--c-text-3)' };
  const canRestore = entry.restorable && !entry.restored;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '52px 16px 1fr auto',
        alignItems: 'center',
        gap: '10px',
        padding: '6px 12px',
        borderRadius: '6px',
        fontSize: '12.5px',
        lineHeight: 1.4,
        color: entry.restored ? 'var(--c-text-4)' : 'var(--c-text-2)',
        opacity: entry.restored ? 0.65 : 1,
        background: hovered ? 'var(--c-surface)' : 'transparent',
        transition: 'background .12s',
      }}
    >
      <span style={{
        fontVariantNumeric: 'tabular-nums',
        fontSize: '11px', color: 'var(--c-text-4)', fontWeight: 600,
      }}>
        {formatTime(entry.createdAt)}
      </span>
      <span style={{ fontSize: '13px', color: meta.color, textAlign: 'center', lineHeight: 1 }}>
        {meta.icon}
      </span>
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <span style={{ color: 'var(--c-text-1)', fontWeight: 600 }}>{entry.title}</span>
        {entry.description && (
          <span style={{ color: 'var(--c-text-4)', marginLeft: '6px' }}>
            — {entry.description}
          </span>
        )}
        {entry.restored && (
          <span style={{
            marginLeft: '8px', fontSize: '10px', fontWeight: 700, color: '#16A34A',
            background: '#DCFCE7', padding: '1px 6px', borderRadius: '999px',
          }}>
            restaurado
          </span>
        )}
      </span>
      <span style={{ display: 'flex', gap: '4px', opacity: hovered ? 1 : 0, transition: 'opacity .12s' }}>
        {canRestore && (
          <button
            onClick={() => onRestore(entry.id)}
            title="Restaurar"
            style={{
              background: 'var(--c-accent)', color: '#fff', border: 'none',
              borderRadius: '6px', padding: '3px 8px', fontSize: '10.5px', fontWeight: 700, cursor: 'pointer',
            }}
          >
            ↶
          </button>
        )}
        <button
          onClick={() => onRemove(entry.id)}
          title="Remover do log"
          style={{
            background: 'transparent', color: 'var(--c-text-4)',
            border: '1px solid var(--c-border)',
            borderRadius: '6px', padding: '3px 7px', fontSize: '10.5px', cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </span>
    </div>
  );
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
      const key = groupKey(h.createdAt);
      if (!g[key]) g[key] = [];
      g[key].push(h);
    });
    return g;
  }, [filtered]);

  const restorableCount = history.filter(h => h.restorable && !h.restored).length;

  function handleRestore(id) {
    const ok = restoreHistoryEntry(id);
    setFeedback({ kind: ok ? 'ok' : 'err', text: ok ? 'Entrada restaurada.' : 'Não foi possível restaurar.' });
    setTimeout(() => setFeedback(null), 2200);
  }

  function handleClearAll() {
    if (window.confirm('Limpar todo o histórico? Itens restauráveis serão perdidos.')) {
      clearHistory();
    }
  }

  return (
    <div className="page-container">
      <div style={{ marginBottom: '18px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--c-text-1)', marginBottom: '4px' }}>
          Histórico
        </h1>
        <p style={{ fontSize: '12.5px', color: 'var(--c-text-3)' }}>
          Log completo de ações do sistema — em ordem cronológica.
        </p>
      </div>

      {feedback && (
        <div style={{
          padding: '8px 12px', borderRadius: '8px', marginBottom: '12px', fontSize: '12px', fontWeight: 600,
          background: feedback.kind === 'ok' ? '#DCFCE7' : '#FEE2E2',
          color: feedback.kind === 'ok' ? '#166534' : '#991B1B',
          border: `1px solid ${feedback.kind === 'ok' ? '#86EFAC' : '#FCA5A5'}`,
        }}>
          {feedback.text}
        </div>
      )}

      {/* Filtros em barra simples */}
      <div style={{
        display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid var(--c-border-lt)',
      }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'all',        label: `Todas (${history.length})` },
            { id: 'restorable', label: `Restauráveis (${restorableCount})` },
            { id: 'ad-published', label: 'Publicações' },
            { id: 'ad-updated',   label: 'Edições' },
            { id: 'ad-removed',   label: 'Remoções' },
            { id: 'commercial-dismissed', label: 'Datas' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                cursor: 'pointer',
                background: filter === f.id ? 'var(--c-accent)' : 'transparent',
                color:      filter === f.id ? '#fff' : 'var(--c-text-3)',
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
              background: 'transparent', border: 'none',
              color: 'var(--c-text-4)',
              padding: '5px 8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Limpar tudo
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div style={{
          padding: '60px 20px', textAlign: 'center',
          color: 'var(--c-text-4)', fontSize: '13px',
        }}>
          <div style={{ fontSize: '32px', marginBottom: '8px', opacity: 0.5 }}>📭</div>
          Nenhuma ação registrada.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {Object.entries(grouped).map(([groupLabel, entries]) => (
            <div key={groupLabel}>
              <div style={{
                fontSize: '10.5px', fontWeight: 800, color: 'var(--c-text-4)',
                textTransform: 'uppercase', letterSpacing: '.7px',
                padding: '0 12px', marginBottom: '4px',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <span>{groupLabel}</span>
                <span style={{
                  flex: 1, height: '1px', background: 'var(--c-border-lt)',
                }} />
                <span style={{ color: 'var(--c-text-4)', fontWeight: 500 }}>
                  {entries.length}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {entries.map(h => (
                  <LogRow
                    key={h.id}
                    entry={h}
                    onRestore={handleRestore}
                    onRemove={removeHistoryEntry}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
