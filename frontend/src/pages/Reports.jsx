/**
 * Reports — Desempenho por anúncio e por anel (Joinville / 8km Boa Vista).
 *
 * IMPORTANTE:
 * Todas as métricas exibidas aqui são simuladas via data/performanceMock.js
 * com base no ID do anúncio. Serão substituídas por dados reais da Meta
 * Ads API quando a integração for implementada.
 */

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../contexts/AppStateContext';
import {
  analyzeAllAds,
  suggestOptimizedSplit,
  RING_META,
} from '../data/performanceMock';

const PERIODS = [
  { v: 7,  l: '7 dias'  },
  { v: 14, l: '14 dias' },
  { v: 30, l: '30 dias' },
];

function fmtBRL(n) {
  if (!Number.isFinite(n)) return '—';
  return `R$\u00A0${Number(n).toFixed(2).replace('.', ',')}`;
}

function fmtNum(n) {
  if (!Number.isFinite(n)) return '—';
  return Number(n).toLocaleString('pt-BR');
}

function TrophyIcon({ color = '#F59E0B' }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4a2 2 0 0 1-2-2V5h4"/>
      <path d="M18 9h2a2 2 0 0 0 2-2V5h-4"/>
      <path d="M6 9a6 6 0 0 0 12 0V4H6z"/>
      <line x1="12" y1="15" x2="12" y2="19"/>
      <line x1="8" y1="22" x2="16" y2="22"/>
      <line x1="12" y1="19" x2="12" y2="22"/>
    </svg>
  );
}

function RingChip({ ringMeta, small }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: small ? '2px 7px' : '3px 9px', borderRadius: '12px',
      background: `${ringMeta.color}1a`,
      color: ringMeta.color,
      fontSize: small ? '10.5px' : '11px', fontWeight: 700,
    }}>
      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: ringMeta.color }} />
      {ringMeta.shortLabel || ringMeta.label}
    </span>
  );
}

function Stat({ label, value, sub, emphasize }) {
  return (
    <div style={{
      background: 'var(--c-card-bg)',
      border: `1px solid ${emphasize ? 'var(--c-accent)' : 'var(--c-border)'}`,
      borderRadius: '10px',
      padding: '12px 14px',
      flex: 1, minWidth: '140px',
    }}>
      <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--c-text-4)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '16px', fontWeight: 700, color: emphasize ? 'var(--c-accent)' : 'var(--c-text-1)', lineHeight: 1.2 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '10.5px', color: 'var(--c-text-3)', marginTop: '2px' }}>{sub}</div>}
    </div>
  );
}

function RingCard({ ring, isBest, isWorst, totalSpend, totalConversions }) {
  const spendShare = totalSpend > 0 ? (ring.spend / totalSpend) * 100 : 0;
  const convShare = totalConversions > 0 ? (ring.conversions / totalConversions) * 100 : 0;

  return (
    <div style={{
      background: 'var(--c-card-bg)',
      border: `1.5px solid ${isBest ? ring.color : 'var(--c-border-lt)'}`,
      borderLeft: `5px solid ${ring.color}`,
      borderRadius: '10px',
      padding: '12px 14px',
      boxShadow: isBest ? `0 2px 12px ${ring.color}22` : 'none',
      position: 'relative',
    }}>
      {isBest && (
        <div style={{
          position: 'absolute', top: '-9px', right: '10px',
          background: ring.color, color: '#fff',
          fontSize: '10px', fontWeight: 700,
          padding: '2px 8px', borderRadius: '12px',
          display: 'inline-flex', alignItems: 'center', gap: '4px',
        }}>
          <TrophyIcon color="#fff" /> Melhor CPR
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
        <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--c-text-1)' }}>
          {ring.label}
        </div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: ring.color }}>
          {ring.pct}% · {fmtBRL(ring.dailySpend)}/dia
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(85px, 1fr))', gap: '6px', marginBottom: '8px' }}>
        <MiniStat label="Impressões" value={fmtNum(ring.impressions)} />
        <MiniStat label="Cliques" value={fmtNum(ring.clicks)} sub={`CTR ${ring.ctr}%`} />
        <MiniStat label="CPC" value={fmtBRL(ring.cpc)} />
        <MiniStat label="Conversões" value={fmtNum(ring.conversions)} sub={`${ring.convRate}%`} />
        <MiniStat
          label="Custo por resultado"
          value={fmtBRL(ring.cpr)}
          emphasize={isBest}
          warning={isWorst && ring.cpr > 0}
        />
      </div>

      <div style={{ fontSize: '10.5px', color: 'var(--c-text-3)' }}>
        🏋️ Peso do gasto: <strong>{spendShare.toFixed(0)}%</strong> · 🎯 Peso das conversões: <strong>{convShare.toFixed(0)}%</strong>
      </div>
    </div>
  );
}

function MiniStat({ label, value, sub, emphasize, warning }) {
  const color = emphasize ? '#16A34A' : warning ? '#DC2626' : 'var(--c-text-1)';
  return (
    <div>
      <div style={{ fontSize: '9.5px', color: 'var(--c-text-4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: '2px' }}>
        {label}
      </div>
      <div style={{ fontSize: '13px', fontWeight: 700, color, lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '10px', color: 'var(--c-text-4)', marginTop: '1px' }}>{sub}</div>}
    </div>
  );
}

function RingMiniRow({ ring, isBest, totalConversions }) {
  const convShare = totalConversions > 0 ? (ring.conversions / totalConversions) * 100 : 0;
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(120px,1.2fr) 70px 70px 90px 80px',
      alignItems: 'center',
      gap: '10px',
      padding: '8px 10px',
      borderRadius: '8px',
      background: isBest ? `${ring.color}0f` : 'var(--c-surface)',
      border: `1px solid ${isBest ? ring.color : 'var(--c-border-lt)'}`,
      borderLeft: `4px solid ${ring.color}`,
      fontSize: '11.5px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
        <span style={{ fontWeight: 700, color: ring.color, whiteSpace: 'nowrap' }}>{ring.label}</span>
        {isBest && <span title="Melhor CPR" style={{ fontSize: '12px' }}>🏆</span>}
      </div>
      <div><strong style={{ color: 'var(--c-text-1)' }}>{fmtNum(ring.conversions)}</strong> <span style={{ color: 'var(--c-text-4)', fontSize: '10px' }}>conv</span></div>
      <div style={{ color: 'var(--c-text-3)' }}>{convShare.toFixed(0)}%</div>
      <div>CPR <strong style={{ color: 'var(--c-text-1)' }}>{fmtBRL(ring.cpr)}</strong></div>
      <div style={{ color: 'var(--c-text-3)' }}>{fmtBRL(ring.spend)}</div>
    </div>
  );
}

function AdReportCard({ analysis, onOpenNewWithSplit, onEdit }) {
  const [expanded, setExpanded] = useState(false);
  const optimized = useMemo(() => suggestOptimizedSplit(analysis), [analysis]);

  if (!analysis.hasSplit) {
    return (
      <div className="ccb-card" style={{
        background: 'var(--c-card-bg)',
        border: '1px solid var(--c-border)',
        borderRadius: '12px',
        padding: '10px 14px',
        boxShadow: '0 1px 4px var(--c-shadow)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text-1)' }}>
              {analysis.ad.name}
            </div>
            <div style={{ fontSize: '10.5px', color: 'var(--c-text-4)' }}>
              Sem split — 1 conjunto
            </div>
          </div>
          <div style={{ display: 'flex', gap: '14px', fontSize: '11.5px', color: 'var(--c-text-2)', flexWrap: 'wrap' }}>
            <span><strong>{analysis.totalConversions}</strong> conv</span>
            <span>{fmtNum(analysis.totalClicks)} cliq</span>
            <span>{fmtBRL(analysis.totalSpend)} · {analysis.daysActive}d</span>
          </div>
        </div>
      </div>
    );
  }

  const best = analysis.bestRing;
  const worst = analysis.worstRing;
  const sortedRings = [...analysis.rings].sort((a, b) => b.conversions - a.conversions);
  const cprMedio = analysis.totalConversions > 0 ? analysis.totalSpend / analysis.totalConversions : 0;

  return (
    <div className="ccb-card" style={{
      background: 'var(--c-card-bg)',
      border: '1px solid var(--c-border)',
      borderRadius: '12px',
      padding: '12px 14px',
      boxShadow: '0 1px 4px var(--c-shadow)',
    }}>
      {/* Header compacto */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--c-text-1)', lineHeight: 1.25 }}>
            {analysis.ad.name}
          </div>
          <div style={{ fontSize: '10.5px', color: 'var(--c-text-4)' }}>
            {analysis.daysActive}d · {analysis.rings.length} anéis · melhor: <strong style={{ color: best.color }}>{best.label}</strong>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap', fontSize: '11.5px' }}>
          <span style={{ color: 'var(--c-text-2)' }}><strong style={{ color: 'var(--c-text-1)' }}>{fmtNum(analysis.totalConversions)}</strong> conv</span>
          <span style={{ color: 'var(--c-text-2)' }}>{fmtBRL(analysis.totalSpend)}</span>
          <span style={{ color: 'var(--c-accent)', fontWeight: 700 }}>CPR {fmtBRL(cprMedio)}</span>
          <button
            onClick={() => setExpanded(v => !v)}
            style={{
              padding: '5px 10px', borderRadius: '7px',
              background: expanded ? 'var(--c-accent)' : 'var(--c-surface)',
              color: expanded ? '#fff' : 'var(--c-text-2)',
              border: `1.5px solid ${expanded ? 'var(--c-accent)' : 'var(--c-border)'}`,
              fontSize: '10.5px', fontWeight: 700, cursor: 'pointer',
            }}
          >
            {expanded ? 'Ocultar' : 'Ver mais'}
          </button>
        </div>
      </div>

      {/* Mini-linhas por anel — sempre visíveis, ordenadas por conversões desc */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {sortedRings.map(r => (
          <RingMiniRow
            key={r.key}
            ring={r}
            isBest={r.key === best?.key}
            totalConversions={analysis.totalConversions}
          />
        ))}
      </div>

      {/* Detalhes expandidos */}
      {expanded && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px', marginTop: '14px' }}>
            {sortedRings.map(r => (
              <RingCard
                key={r.key}
                ring={r}
                isBest={r.key === best?.key}
                isWorst={r.key === worst?.key && analysis.rings.length > 1}
                totalSpend={analysis.totalSpend}
                totalConversions={analysis.totalConversions}
              />
            ))}
          </div>

          {/* Recomendação acionável */}
          {best && optimized && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(22,163,74,.06), rgba(22,163,74,.01))',
          border: '1px solid rgba(22,163,74,.25)',
          borderLeft: '4px solid #16A34A',
          borderRadius: '10px',
          padding: '12px 14px',
        }}>
          <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#16A34A', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            💡 Sugestão para o próximo anúncio
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--c-text-2)', lineHeight: 1.55, marginBottom: '10px' }}>
            O <strong>{best.label}</strong> teve o melhor CPR ({fmtBRL(best.cpr)}
            {worst && worst.key !== best.key ? <> · {(worst.cpr / best.cpr).toFixed(1)}× melhor que o {worst.label.toLowerCase()}</> : null}).
            Sugiro redistribuir o orçamento priorizando esse anel:
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
            {['primario', 'medio', 'externo'].filter(k => optimized[k] > 0).map(k => {
              const meta = RING_META[k];
              return (
                <span key={k} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '5px 10px', borderRadius: '20px',
                  background: 'var(--c-card-bg)', border: `1.5px solid ${meta.color}`,
                  fontSize: '11.5px', fontWeight: 700, color: meta.color,
                }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: meta.color }} />
                  {meta.shortLabel}: {optimized[k]}%
                </span>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => onOpenNewWithSplit(analysis.ad, optimized)}
              style={{
                padding: '8px 14px', borderRadius: '8px',
                background: '#16A34A', border: 'none', color: '#fff',
                fontSize: '12px', fontWeight: 700, cursor: 'pointer',
              }}
            >
              🚀 Criar próximo com esse split
            </button>
            <button
              onClick={() => onEdit(analysis.ad)}
              style={{
                padding: '8px 14px', borderRadius: '8px',
                background: 'var(--c-surface)', border: '1.5px solid var(--c-border)',
                color: 'var(--c-text-2)',
                fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              ✏️ Editar este anúncio
            </button>
          </div>
        </div>
          )}
        </>
      )}
    </div>
  );
}

export default function Reports() {
  const navigate = useNavigate();
  const { ads } = useAppState();
  const [days, setDays] = useState(7);

  const analyses = useMemo(() => analyzeAllAds(ads, { daysActive: days }), [ads, days]);

  const byConversionsDesc = (a, b) => {
    const diff = (b.totalConversions || 0) - (a.totalConversions || 0);
    if (diff !== 0) return diff;
    const cprA = a.totalConversions > 0 ? a.totalSpend / a.totalConversions : Infinity;
    const cprB = b.totalConversions > 0 ? b.totalSpend / b.totalConversions : Infinity;
    return cprA - cprB;
  };

  const withSplit = analyses.filter(a => a.hasSplit).sort(byConversionsDesc);
  const withoutSplit = analyses.filter(a => !a.hasSplit).sort(byConversionsDesc);

  function handleOpenNewWithSplit(sourceAd, optimizedSplit) {
    navigate('/criar-anuncio', {
      state: {
        reuseCreative: {
          id: sourceAd.id,
          name: sourceAd.name,
          primaryText: sourceAd.primaryText,
          headline: sourceAd.headline,
          cta: sourceAd.ctaButton,
        },
        suggestedSplit: optimizedSplit,
        reviewMode: false,
      },
    });
  }

  function handleEdit(ad) {
    navigate('/criar-anuncio', { state: { editId: ad.id } });
  }

  return (
    <div className="page-container">
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '22px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '4px' }}>
            Desempenho
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--c-text-3)', margin: 0 }}>
            Compare performance por anel geográfico e por criativo. Use os insights para ajustar o split no próximo anúncio.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {PERIODS.map(p => (
            <button
              key={p.v}
              onClick={() => setDays(p.v)}
              style={{
                padding: '8px 14px', borderRadius: '10px',
                border: `1.5px solid ${days === p.v ? 'var(--c-accent)' : 'var(--c-border)'}`,
                background: days === p.v ? 'var(--c-active-bg)' : 'var(--c-surface)',
                color: days === p.v ? 'var(--c-accent)' : 'var(--c-text-2)',
                fontSize: '12px', fontWeight: 700, cursor: 'pointer',
              }}
            >
              {p.l}
            </button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {analyses.length === 0 && (
        <div style={{
          padding: '48px 24px', textAlign: 'center',
          background: 'var(--c-card-bg)', border: '1px dashed var(--c-border)',
          borderRadius: '14px',
        }}>
          <div style={{ fontSize: '40px', marginBottom: '10px' }}>📊</div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '6px' }}>
            Nenhum anúncio publicado ainda
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--c-text-3)', maxWidth: '420px', margin: '0 auto 14px' }}>
            Publique o primeiro anúncio com split por anel e os relatórios aparecerão aqui automaticamente.
          </div>
          <button
            onClick={() => navigate('/criar-anuncio')}
            style={{
              padding: '10px 18px', borderRadius: '10px',
              background: 'var(--c-accent)', border: 'none', color: '#fff',
              fontSize: '13px', fontWeight: 700, cursor: 'pointer',
            }}
          >
            Criar anúncio
          </button>
        </div>
      )}

      {/* Anúncios com split */}
      {withSplit.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '22px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
            Anúncios com split por anel ({withSplit.length})
          </div>
          {withSplit.map(a => (
            <AdReportCard
              key={a.ad.id}
              analysis={a}
              onOpenNewWithSplit={handleOpenNewWithSplit}
              onEdit={handleEdit}
            />
          ))}
        </div>
      )}

      {/* Anúncios sem split */}
      {withoutSplit.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
            Anúncios sem split ({withoutSplit.length})
          </div>
          {withoutSplit.map(a => (
            <AdReportCard key={a.ad.id} analysis={a} onOpenNewWithSplit={handleOpenNewWithSplit} onEdit={handleEdit} />
          ))}
        </div>
      )}

      {/* Nota sobre dados mock */}
      {analyses.length > 0 && (
        <div style={{
          marginTop: '24px', padding: '10px 14px',
          background: 'var(--c-surface)', border: '1px dashed var(--c-border)',
          borderRadius: '10px', fontSize: '11px', color: 'var(--c-text-4)', lineHeight: 1.5,
        }}>
          ℹ️ Métricas simuladas com base no ID do anúncio — consistentes entre sessões mas não são dados reais do Meta Ads.
          Quando a integração com a Meta API for ativada, estes valores serão substituídos automaticamente.
        </div>
      )}
    </div>
  );
}
