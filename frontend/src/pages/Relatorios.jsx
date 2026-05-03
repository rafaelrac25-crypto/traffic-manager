import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';

/* ── Mapa de "kind" técnico → contexto leigo ──
   Por trás roda routine de cron / one-shot / monitoramento. Pra Cris/Rafa,
   o que importa é: "isso fala da minha campanha", "isso fala se tá tudo
   funcionando", "isso é um lembrete". */
const KINDS = {
  campaign: {
    label: 'Sua campanha',
    description: 'Como sua campanha está performando — gasto, cliques, mensagens.',
    emoji: '📊',
    color: 'var(--c-accent)',
    bg: 'var(--c-accent-soft)',
  },
  system: {
    label: 'Sistema',
    description: 'Se tudo está funcionando — Meta conectado, banco ok, robôs rodando.',
    emoji: '🩺',
    color: '#10B981',
    bg: '#ECFDF5',
  },
  reminder: {
    label: 'Lembretes',
    description: 'Avisos pontuais, datas marcadas e itens pra você revisar.',
    emoji: '⏰',
    color: '#F59E0B',
    bg: '#FFFBEB',
  },
};

const SEVERITY = {
  info:     { label: 'Informativo', color: '#6B7280', bg: '#F3F4F6' },
  success:  { label: 'Tudo certo',  color: '#059669', bg: '#D1FAE5' },
  warn:     { label: 'Atenção',     color: '#B45309', bg: '#FEF3C7' },
  critical: { label: 'Urgente',     color: '#B91C1C', bg: '#FEE2E2' },
};

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `Hoje às ${time}`;
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Ontem às ${time}`;
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} às ${time}`;
}

function ReportCard({ report, expanded, onToggle, onMarkRead, onDelete }) {
  const kind = KINDS[report.kind] || KINDS.campaign;
  const sev = SEVERITY[report.severity] || SEVERITY.info;
  const isUnread = !report.read;

  return (
    <div
      className="ccb-card"
      style={{
        borderLeft: `4px solid ${kind.color}`,
        borderRadius: '14px',
        padding: '16px 18px',
        marginBottom: '12px',
        boxShadow: isUnread ? '0 2px 14px rgba(193,53,132,.14)' : undefined,
        transition: 'all .18s ease',
      }}
    >
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '8px' }}>
        <span style={{ fontSize: '22px', lineHeight: 1, flexShrink: 0 }}>{kind.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h3 style={{
              fontSize: '14px', fontWeight: 700,
              color: 'var(--c-text-1)', margin: 0,
              flex: 1, minWidth: 0,
            }}>
              {report.title}
            </h3>
            <span style={{
              fontSize: '10px', fontWeight: 700,
              color: sev.color, background: sev.bg,
              padding: '2px 8px', borderRadius: '999px',
              textTransform: 'uppercase', letterSpacing: '.4px',
              whiteSpace: 'nowrap',
            }}>
              {sev.label}
            </span>
            {isUnread && (
              <span title="Não lido" style={{
                width: '8px', height: '8px',
                background: kind.color,
                borderRadius: '50%', flexShrink: 0,
                boxShadow: kind.color === 'var(--c-accent)' ? '0 0 8px var(--c-accent-glow)' : 'none',
              }} />
            )}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--c-text-3)', marginTop: '3px', fontWeight: 400 }}>
            {fmtDate(report.created_at)} · {kind.label}
          </div>
        </div>
      </div>

      {/* Resumo leigo (sempre visível) */}
      {report.summary && (
        <div style={{
          fontSize: '13px', color: 'var(--c-text-2)',
          lineHeight: 1.55, padding: '6px 0 4px',
        }}>
          {report.summary}
        </div>
      )}

      {/* Detalhes técnicos (collapsible) */}
      {report.body_md && (
        <>
          <div style={{ marginTop: '8px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={onToggle}
              style={{
                background: 'none', border: 'none',
                color: kind.color, cursor: 'pointer',
                fontSize: '12px', fontWeight: 600,
                padding: 0,
              }}
            >
              {expanded ? '− Ocultar detalhes' : '+ Ver detalhes técnicos'}
            </button>
            {isUnread && (
              <button
                onClick={onMarkRead}
                style={{
                  background: 'none', border: 'none',
                  color: 'var(--c-text-3)', cursor: 'pointer',
                  fontSize: '12px', fontWeight: 500,
                  padding: 0,
                }}
              >
                Marcar como lido
              </button>
            )}
            <button
              onClick={onDelete}
              style={{
                background: 'none', border: 'none',
                color: 'var(--c-text-4)', cursor: 'pointer',
                fontSize: '12px', fontWeight: 500,
                padding: 0, marginLeft: 'auto',
              }}
            >
              Remover
            </button>
          </div>

          {expanded && (
            <pre style={{
              marginTop: '10px', padding: '12px 14px',
              background: 'var(--c-surface)',
              border: '1px solid var(--c-border)',
              borderRadius: '10px',
              fontSize: '12px',
              color: 'var(--c-text-2)',
              fontFamily: 'inherit',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: '500px',
              overflowY: 'auto',
              lineHeight: 1.55,
            }}>
              {report.body_md}
            </pre>
          )}
        </>
      )}

      {/* Sem body_md mas com summary? Ainda assim oferecer marcar como lido */}
      {!report.body_md && (isUnread || true) && (
        <div style={{ marginTop: '8px', display: 'flex', gap: '12px' }}>
          {isUnread && (
            <button
              onClick={onMarkRead}
              style={{
                background: 'none', border: 'none',
                color: 'var(--c-text-3)', cursor: 'pointer',
                fontSize: '12px', fontWeight: 500, padding: 0,
              }}
            >
              Marcar como lido
            </button>
          )}
          <button
            onClick={onDelete}
            style={{
              background: 'none', border: 'none',
              color: 'var(--c-text-4)', cursor: 'pointer',
              fontSize: '12px', fontWeight: 500,
              padding: 0, marginLeft: 'auto',
            }}
          >
            Remover
          </button>
        </div>
      )}
    </div>
  );
}

export default function Relatorios() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [filter, setFilter]   = useState('all'); // all | campaign | system | reminder
  const [expanded, setExpanded] = useState({});  // { [id]: boolean }
  const [refreshing, setRefreshing] = useState(null); // null | 'campaign' | 'system'

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/reports', { params: { limit: 200 } });
      setReports(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return reports;
    return reports.filter(r => (r.kind || 'campaign') === filter);
  }, [reports, filter]);

  const counts = useMemo(() => {
    const out = { all: reports.length, campaign: 0, system: 0, reminder: 0 };
    for (const r of reports) {
      const k = r.kind || 'campaign';
      if (out[k] != null) out[k] += 1;
    }
    return out;
  }, [reports]);

  const unreadCount = reports.filter(r => !r.read).length;

  async function markRead(id) {
    try {
      await axios.patch(`/api/reports/${id}/read`);
      setReports(prev => prev.map(r => r.id === id ? { ...r, read: true } : r));
    } catch {}
  }

  async function remove(id) {
    if (!window.confirm('Remover este relatório? Não dá pra desfazer.')) return;
    try {
      await axios.delete(`/api/reports/${id}`);
      setReports(prev => prev.filter(r => r.id !== id));
    } catch (e) {
      alert('Erro ao remover: ' + (e?.message || ''));
    }
  }

  async function generateNow(kind) {
    setRefreshing(kind);
    try {
      await axios.post(`/api/reports/generate/${kind}`);
      await load();
      // Foca na aba correspondente pra usuário ver o relatório novo
      setFilter(kind);
    } catch (e) {
      alert('Erro ao gerar relatório: ' + (e?.response?.data?.error || e?.message || ''));
    } finally {
      setRefreshing(null);
    }
  }

  function RefreshButton({ kind, label, color }) {
    const isLoading = refreshing === kind;
    const isAnyLoading = refreshing !== null;
    const isAccent = color === 'var(--c-accent)';
    /* Hover bg — pra accent usa accent-soft via token; pra cores semânticas, gera 20% da cor literal */
    const hoverBg = isAccent ? 'var(--c-accent-soft)' : (typeof color === 'string' && color.startsWith('#') ? color + '20' : 'rgba(255,255,255,.06)');
    return (
      <button
        onClick={() => generateNow(kind)}
        disabled={isAnyLoading}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '7px 12px',
          background: isLoading
            ? (isAccent ? 'var(--c-accent)' : color)
            : (isAccent ? 'rgba(193,53,132,.10)' : 'transparent'),
          color: isLoading ? '#fff' : color,
          border: `1.5px solid ${isAccent ? 'rgba(193,53,132,.65)' : color}`,
          borderRadius: '10px',
          fontSize: '12px', fontWeight: 700,
          cursor: isAnyLoading ? 'not-allowed' : 'pointer',
          opacity: isAnyLoading && !isLoading ? 0.45 : 1,
          transition: 'all .15s',
          boxShadow: isAccent && !isLoading
            ? '0 0 18px rgba(193,53,132,.16), inset 0 0 12px rgba(193,53,132,.06)'
            : undefined,
          textShadow: isAccent && !isLoading ? '0 0 12px rgba(193,53,132,.35)' : undefined,
        }}
        onMouseEnter={e => { if (!isAnyLoading) e.currentTarget.style.background = hoverBg; }}
        onMouseLeave={e => {
          if (!isAnyLoading) e.currentTarget.style.background = isAccent ? 'rgba(193,53,132,.10)' : 'transparent';
        }}
      >
        <span style={{
          display: 'inline-block',
          animation: isLoading ? 'spin 0.9s linear infinite' : 'none',
        }}>↻</span>
        <span>{isLoading ? 'Gerando…' : label}</span>
      </button>
    );
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: '880px', margin: '0 auto' }}>
      {/* ── Cabeçalho ── */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{
          fontSize: '24px', fontWeight: 800, letterSpacing: '-0.01em',
          color: 'var(--c-text-1)', margin: 0,
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          📋 Relatórios
          {unreadCount > 0 && (
            <span style={{
              fontSize: '11px', fontWeight: 700,
              color: 'var(--c-accent)',
              background: 'var(--c-accent-soft)',
              border: '1px solid rgba(193,53,132,.4)',
              padding: '3px 10px', borderRadius: '999px',
              boxShadow: '0 0 14px rgba(193,53,132,.22)',
            }}>
              {unreadCount} não lido{unreadCount > 1 ? 's' : ''}
            </span>
          )}
        </h1>
        <p style={{
          fontSize: '13px', color: 'var(--c-text-3)',
          margin: '6px 0 0', lineHeight: 1.55, fontWeight: 400,
        }}>
          Resumos automáticos do que está acontecendo: como sua campanha vai,
          se o sistema está saudável, e lembretes que você marcou.
        </p>
      </div>

      {/* ── Barra de atualização manual ── */}
      <div className="ccb-card" style={{
        display: 'flex', gap: '10px', flexWrap: 'wrap',
        alignItems: 'center', marginBottom: '14px',
        padding: '12px 14px',
        borderRadius: '14px',
      }}>
        <div style={{
          fontSize: '12px', color: 'var(--c-text-3)', fontWeight: 400,
          marginRight: '4px',
        }}>
          ⚡ Gerar relatório agora:
        </div>
        {(filter === 'all' || filter === 'campaign') && (
          <RefreshButton kind="campaign" label="Sua campanha" color={KINDS.campaign.color} />
        )}
        {(filter === 'all' || filter === 'system') && (
          <RefreshButton kind="system" label="Sistema" color={KINDS.system.color} />
        )}
        {filter === 'reminder' && (
          <span style={{ fontSize: '12px', color: 'var(--c-text-4)', fontStyle: 'italic', fontWeight: 400 }}>
            Lembretes são pontuais — disparados pela rotina que você programou.
          </span>
        )}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: '11px', color: 'var(--c-text-4)', fontWeight: 400 }}>
          Atualização automática: semanal · sem custo de IA
        </span>
      </div>

      {/* ── Filtros ── */}
      <div style={{
        display: 'flex', gap: '8px', flexWrap: 'wrap',
        marginBottom: '20px',
      }}>
        {[
          { id: 'all',      label: 'Todos',         emoji: '📋', color: 'var(--c-text-2)' },
          { id: 'campaign', label: KINDS.campaign.label, emoji: KINDS.campaign.emoji, color: KINDS.campaign.color },
          { id: 'system',   label: KINDS.system.label,   emoji: KINDS.system.emoji,   color: KINDS.system.color },
          { id: 'reminder', label: KINDS.reminder.label, emoji: KINDS.reminder.emoji, color: KINDS.reminder.color },
        ].map(tab => {
          const active = filter === tab.id;
          const count = counts[tab.id] ?? 0;
          const isAccent = tab.color === KINDS.campaign.color; // var(--c-accent)
          /* Estilo do active depende se é tab accent (gradient rosa) ou semântico (cor literal). */
          let activeBg, activeBorder, activeShadow;
          if (active) {
            if (isAccent) {
              activeBg = 'linear-gradient(135deg, var(--c-accent), var(--c-accent-dk))';
              activeBorder = 'rgba(193,53,132,.65)';
              activeShadow = '0 6px 18px rgba(193,53,132,.35), inset 0 1px 0 rgba(255,255,255,.18)';
            } else {
              activeBg = tab.color;
              activeBorder = tab.color;
              activeShadow = 'none';
            }
          }
          return (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px',
                background: active ? activeBg : 'var(--c-surface)',
                color: active ? '#fff' : 'var(--c-text-2)',
                border: `1.5px solid ${active ? activeBorder : 'var(--c-border)'}`,
                borderRadius: '999px',
                fontSize: '12.5px', fontWeight: 700,
                cursor: 'pointer',
                transition: 'all .15s',
                boxShadow: activeShadow,
              }}
            >
              <span>{tab.emoji}</span>
              <span>{tab.label}</span>
              <span style={{
                fontSize: '11px', fontWeight: 700,
                opacity: active ? 0.85 : 0.65,
                fontFeatureSettings: "'tnum'",
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Conteúdo ── */}
      {loading && (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--c-text-3)', fontSize: '13px' }}>
          Carregando relatórios…
        </div>
      )}

      {!loading && error && (
        <div style={{
          padding: '16px 18px', borderRadius: '12px',
          background: '#FEE2E2', border: '1px solid #FCA5A5',
          color: '#991B1B', fontSize: '13px',
        }}>
          ⚠️ {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="ccb-card" style={{
          padding: '48px 24px', textAlign: 'center',
          borderRadius: '18px',
        }}>
          <div style={{ fontSize: '40px', marginBottom: '10px' }}>📭</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--c-text-2)', marginBottom: '4px' }}>
            Nenhum relatório por aqui ainda
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--c-text-3)', lineHeight: 1.55, maxWidth: '460px', margin: '0 auto', fontWeight: 400 }}>
            Os relatórios aparecem automaticamente quando seu sistema gera análises
            sobre as campanhas, verifica a saúde da plataforma ou dispara lembretes
            que você programou.
          </div>
        </div>
      )}

      {!loading && !error && filtered.map(r => (
        <ReportCard
          key={r.id}
          report={r}
          expanded={!!expanded[r.id]}
          onToggle={() => setExpanded(prev => ({ ...prev, [r.id]: !prev[r.id] }))}
          onMarkRead={() => markRead(r.id)}
          onDelete={() => remove(r.id)}
        />
      ))}
    </div>
  );
}
