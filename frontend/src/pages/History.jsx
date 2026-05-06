import React, { useMemo, useState, useEffect } from 'react';
import { useAppState } from '../contexts/AppStateContext';
import api from '../services/api';
import Icon from '../components/Icon';

const TYPE_META = {
  'commercial-dismissed': { icon: '📅', label: 'Data dispensada', color: '#A78BFA' },
  'ad-removed':           { icon: '🗑',  label: 'Anúncio removido', color: '#F87171' },
  'ad-created':           { icon: '＋',  label: 'Anúncio criado',   color: '#34D399' },
  'ad-updated':           { icon: '✎',  label: 'Anúncio editado',  color: '#60A5FA' },
  'ad-paused':            { icon: '⏸',  label: 'Anúncio pausado',  color: '#FBBF24' },
  'ad-activated':         { icon: '▶',  label: 'Anúncio ativado',  color: '#34D399' },
  'ad-duplicated':        { icon: '⎘',  label: 'Anúncio duplicado',color: '#60A5FA' },
  'ad-published':         { icon: '🚀', label: 'Anúncio publicado',color: '#34D399' },
  'ad-corrected':         { icon: '✅', label: 'Correção publicada',color: '#34D399' },
  'audience-created':     { icon: '＋',  label: 'Público criado',   color: '#34D399' },
  'audience-removed':     { icon: '🗑',  label: 'Público removido', color: '#F87171' },
  'audience-updated':     { icon: '✎',  label: 'Público editado',  color: '#60A5FA' },
  'creative-created':     { icon: '＋',  label: 'Criativo criado',  color: '#34D399' },
  'creative-removed':     { icon: '🗑',  label: 'Criativo removido',color: '#F87171' },
  'creative-used':        { icon: '♻',  label: 'Criativo reusado', color: '#60A5FA' },
  'funds-added':          { icon: '💰', label: 'Saldo adicionado', color: '#34D399' },
  'platform-connected':   { icon: '🔗', label: 'Plataforma conectada', color: '#34D399' },
  'platform-disconnected':{ icon: '⛓',  label: 'Plataforma desconectada', color: '#FBBF24' },
  'payment-updated':      { icon: '💳', label: 'Pagamento atualizado', color: '#60A5FA' },
  /* Erros e avisos do sino espelhados no histórico pra log de auditoria */
  'notif-publish-failed':      { icon: '⚠', label: 'Erro ao publicar',       color: '#F87171' },
  'notif-rejected':            { icon: '❌', label: 'Anúncio reprovado',     color: '#F87171' },
  'notif-meta-sync-error':     { icon: '⚠', label: 'Erro de sincronização', color: '#FBBF24' },
  'notif-reconnect-required':  { icon: '🔐', label: 'Reconexão necessária',  color: '#FBBF24' },
  'notif-warning':             { icon: '⚠', label: 'Aviso',                 color: '#FBBF24' },
  'notif-insight-high-performer': { icon: '🔥', label: 'Oportunidade detectada', color: '#34D399' },
  'notif-insight-low-performer':  { icon: '📉', label: 'Baixa performance',  color: '#FBBF24' },
  /* Eventos vindos do activity_log do backend (ações executadas no Meta) */
  'adset-activated':       { icon: '▶',  label: 'Conjunto ativado',     color: '#34D399' },
  'adset-paused':          { icon: '⏸',  label: 'Conjunto pausado',     color: '#FBBF24' },
  'adset-removed':         { icon: '🗑',  label: 'Conjunto excluído',    color: '#F87171' },
  'campaign-activated':    { icon: '▶',  label: 'Campanha ativada',     color: '#34D399' },
  'campaign-paused':       { icon: '⏸',  label: 'Campanha pausada',     color: '#FBBF24' },
  'budget-changed':        { icon: '💰', label: 'Orçamento alterado',   color: '#60A5FA' },
  'ab-test-created':       { icon: '🧪', label: 'Teste A/B criado',     color: '#A78BFA' },
  'meta-sync':             { icon: '🔄', label: 'Sincronização Meta',   color: '#60A5FA' },
};

/* Converte item do activity_log do backend para shape compatível com LogRow.
   Backend: { id, action, entity, entity_id, description, meta (JSON string), created_at }
   Local:   { id, createdAt, type, title, description, restorable, restored } */
function normalizeBackendItem(item) {
  let parsedMeta = null;
  try { parsedMeta = typeof item.meta === 'string' ? JSON.parse(item.meta) : item.meta; }
  catch { parsedMeta = null; }

  const status = parsedMeta?.status;
  let type = item.action; // fallback bruto

  if (item.action === 'ad_status')      type = status === 'paused' ? 'ad-paused' : 'ad-activated';
  else if (item.action === 'adset_status')   type = status === 'paused' ? 'adset-paused' : 'adset-activated';
  else if (item.action === 'status_change')  type = status === 'paused' ? 'campaign-paused' : 'campaign-activated';
  else if (item.action === 'create_ad_in_adset') type = 'ad-created';
  else if (item.action === 'delete_ad')      type = 'ad-removed';
  else if (item.action === 'delete_adset')   type = 'adset-removed';
  else if (item.action === 'budget_safe')    type = 'budget-changed';
  else if (item.action === 'ab_test_created') type = 'ab-test-created';
  else if (item.action === 'meta_sync' || item.action === 'sync_meta') type = 'meta-sync';

  const meta = TYPE_META[type];
  return {
    id: `bk-${item.id}`,
    createdAt: item.created_at,
    type,
    title: meta?.label || item.action,
    description: item.description || null,
    restorable: false,
    restored: false,
    source: 'backend',
  };
}

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

/* Grupo de um dia com "ver mais" quando tem muitas entradas.
   Padrão: mostra as 8 primeiras; botão expande o resto. */
function DayGroup({ label, entries, onRestore, onRemove }) {
  const [expanded, setExpanded] = useState(false);
  const LIMIT = 8;
  const overflow = entries.length > LIMIT;
  const visible = expanded || !overflow ? entries : entries.slice(0, LIMIT);
  const hidden = overflow && !expanded ? entries.length - LIMIT : 0;

  return (
    <div>
      <div style={{
        fontSize: '10.5px', fontWeight: 400, color: 'var(--c-text-3)',
        textTransform: 'uppercase', letterSpacing: '1.2px',
        padding: '0 12px', marginBottom: '4px',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <span>{label}</span>
        <span style={{ flex: 1, height: '1px', background: 'var(--c-border)' }} />
        <span style={{ color: 'var(--c-text-4)', fontWeight: 400, fontFeatureSettings: "'tnum'" }}>{entries.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {visible.map(h => (
          <LogRow key={h.id} entry={h} onRestore={onRestore} onRemove={onRemove} />
        ))}
        {overflow && (
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: '6px 12px', fontSize: '11px', fontWeight: 600,
              color: 'var(--c-accent)', textAlign: 'left',
              alignSelf: 'flex-start',
            }}
          >
            {expanded ? '↑ Mostrar menos' : `↓ Ver mais ${hidden}`}
          </button>
        )}
      </div>
    </div>
  );
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
        fontFeatureSettings: "'tnum'",
        fontSize: '11px', color: 'var(--c-text-4)', fontWeight: 400,
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
            marginLeft: '8px', fontSize: '10.5px', fontWeight: 700, letterSpacing: '.3px',
            color: '#34D399',
            background: 'rgba(52,211,153,.16)',
            border: '1px solid rgba(52,211,153,.3)',
            padding: '4px 9px', borderRadius: '999px',
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
              background: 'linear-gradient(135deg, var(--c-accent), var(--c-accent-dk))',
              color: '#fff', border: 'none',
              borderRadius: '8px', padding: '4px 10px', fontSize: '10.5px', fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(193,53,132,.35), inset 0 1px 0 rgba(255,255,255,.18)',
            }}
          >
            ↶
          </button>
        )}
        <button
          onClick={() => onRemove(entry.id)}
          title="Remover do log"
          style={{
            background: 'var(--c-surface)', color: 'var(--c-text-3)',
            border: '1px solid var(--c-border)',
            borderRadius: '8px', padding: '3px 8px', fontSize: '10.5px', cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </span>
    </div>
  );
}

export default function History() {
  const { history: localHistory, restoreHistoryEntry, removeHistoryEntry, clearHistory } = useAppState();
  const [filter, setFilter] = useState('all');
  const [feedback, setFeedback] = useState(null);
  const [backendHistory, setBackendHistory] = useState([]);

  useEffect(() => {
    api.get('/api/history').then(r => setBackendHistory(r.data || [])).catch(() => {});
  }, []);

  /* Funde backend (activity_log) com local (localStorage). Backend usa shape
     {id, action, meta(json), created_at} — convertido por normalizeBackendItem
     pra shape do local {id, createdAt, type, title, description}. IDs do backend
     ficam prefixados 'bk-' pra não colidir com IDs locais 'hist-'. Dedup conservador
     por chave (timestamp_seg + type) cobre o caso raro de mesma ação ter sido
     logada nos dois lados. */
  const history = useMemo(() => {
    const backendNormalized = backendHistory.map(normalizeBackendItem);
    const localNormalized = localHistory.map(item => ({ ...item, source: item.source || 'local' }));
    const seen = new Set();
    return [...backendNormalized, ...localNormalized]
      .filter(item => {
        const ts = item.createdAt ? new Date(item.createdAt).toISOString().slice(0, 19) : '';
        const key = `${ts}|${item.type || ''}`;
        if (seen.has(key) && key !== '|') return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [backendHistory, localHistory]);

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
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '4px' }}>
          Histórico
        </h1>
        <p style={{ fontSize: '12.5px', color: 'var(--c-text-3)' }}>
          Log completo de ações do sistema — em ordem cronológica.
        </p>
      </div>

      {feedback && (
        <div style={{
          padding: '8px 12px', borderRadius: '999px', marginBottom: '12px',
          fontSize: '10.5px', fontWeight: 700, letterSpacing: '.3px',
          display: 'inline-block',
          background: feedback.kind === 'ok' ? 'rgba(52,211,153,.16)' : 'rgba(248,113,113,.16)',
          color: feedback.kind === 'ok' ? '#34D399' : '#F87171',
          border: `1px solid ${feedback.kind === 'ok' ? 'rgba(52,211,153,.3)' : 'rgba(248,113,113,.3)'}`,
        }}>
          {feedback.text}
        </div>
      )}

      <div className="ccb-card" style={{ padding: '18px 20px', borderRadius: '18px' }}>
        {/* Filtros em barra simples */}
        <div style={{
          display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid var(--c-border)',
        }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { id: 'all',        label: `Todas (${history.length})` },
              { id: 'restorable', label: `Restauráveis (${restorableCount})` },
              { id: 'ad-published', label: 'Publicações' },
              { id: 'ad-updated',   label: 'Edições' },
              { id: 'ad-removed',   label: 'Remoções' },
              { id: 'commercial-dismissed', label: 'Datas' },
            ].map(f => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  style={{
                    padding: '6px 12px', borderRadius: '999px', fontSize: '11px',
                    fontWeight: active ? 700 : 500, letterSpacing: active ? '.3px' : 0,
                    cursor: 'pointer',
                    background: active ? 'var(--c-accent-soft)' : 'var(--c-surface)',
                    color: active ? 'var(--c-accent)' : 'var(--c-text-3)',
                    border: `1px solid ${active ? 'rgba(193,53,132,.4)' : 'var(--c-border)'}`,
                    transition: 'all .15s',
                  }}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
          {history.length > 0 && (
            <button
              onClick={handleClearAll}
              style={{
                background: 'var(--c-surface)',
                border: '1px solid var(--c-border)',
                color: 'var(--c-text-3)',
                padding: '6px 12px', fontSize: '11px', fontWeight: 600, borderRadius: '8px',
                cursor: 'pointer',
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
            <div style={{ marginBottom: '8px', opacity: 0.5 }}><Icon name="bell-off" size={32} /></div>
            Nenhuma ação registrada.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {Object.entries(grouped).map(([groupLabel, entries]) => (
              <DayGroup
                key={groupLabel}
                label={groupLabel}
                entries={entries}
                onRestore={handleRestore}
                onRemove={removeHistoryEntry}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
