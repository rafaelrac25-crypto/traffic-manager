/**
 * IMPORTANT:
 * All displayed data is fictional placeholder data.
 * Real data will be loaded later from Meta Ads API.
 * Do not persist mock values.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../contexts/AppStateContext';

/* ── Dados mock ── */
const MOCK_ADS = [
  { id: 1, name: 'Promoção Verão',       adId: '2388471', platform: 'instagram', status: 'active',   budget: 50,  results: 43,   clicks: 3456, costPerResult: 18.64, thumbGrad: 'linear-gradient(135deg,#FECDD3,#FDA4AF,#FB7185)' },
  { id: 2, name: 'Esmaltes Tendência',   adId: '2388472', platform: 'meta',      status: 'paused',   budget: 70,  results: 28,   clicks: 2187, costPerResult: 25.00, thumbGrad: 'linear-gradient(135deg,#D1D5DB,#9CA3AF,#6B7280)' },
  { id: 3, name: 'Skincare Rotina Diária', adId: '2388473', platform: 'instagram', status: 'active', budget: 30,  results: 15,   clicks: 743,  costPerResult: 20.00, thumbGrad: 'linear-gradient(135deg,#FDE68A,#FCA5A5,#F9A8D4)' },
  { id: 4, name: 'Lançamento Nova Linha', adId: '2388474', platform: 'meta',      status: 'review',  budget: 100, results: null, clicks: null, costPerResult: null,  thumbGrad: 'linear-gradient(135deg,#C4B5FD,#A78BFA,#8B5CF6)' },
  { id: 5, name: 'Remarketing Site',     adId: '2388475', platform: 'instagram', status: 'ended',    budget: 40,  results: 12,   clicks: 1102, costPerResult: 23.10, thumbGrad: 'linear-gradient(135deg,#BAE6FD,#7DD3FC,#38BDF8)' },
];

/* ── Configurações visuais ── */
const PLAT = {
  instagram: { label: 'Instagram', bg: '#FDF0F8', color: '#d68d8f' },
  meta:      { label: 'Meta Ads',  bg: '#EFF6FF', color: '#1877F2' },
  google:    { label: 'Google Ads', bg: '#FEF9C3', color: '#CA8A04' },
};

const STATUS = {
  active:  { label: 'Ativo',       dot: '#22C55E', bg: '#F0FDF4', color: '#16A34A' },
  paused:  { label: 'Pausado',     dot: '#F97316', bg: '#FFF7ED', color: '#EA580C' },
  review:  { label: 'Em revisão',  dot: '#8B5CF6', bg: '#F5F3FF', color: '#7C3AED' },
  ended:   { label: 'Inativo',     dot: '#94A3B8', bg: 'var(--c-surface)', color: 'var(--c-text-4)' },
};

/* ── Ícones ── */
const PauseIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
);
const PlayIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
);
const EditIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const CopyIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);
const DotsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
  </svg>
);
const ChevronDown = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
);
const CalIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

/* ── Thumbnail placeholder ── */
function AdThumb({ grad }) {
  return (
    <div style={{
      width: '52px', height: '52px', borderRadius: '10px',
      background: grad, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '18px', opacity: 0.85,
    }}>
      <span>🌸</span>
    </div>
  );
}

/* ── Cálculo de CPC e baixa performance ── */
function getCpc(ad) {
  if (!ad.clicks || ad.clicks === 0) return null;
  const spent = Number(ad.spent ?? ad.budget) || 0;
  return spent / ad.clicks;
}

function getAvgCpc(ads) {
  const valid = ads.map(getCpc).filter(v => v != null);
  if (!valid.length) return 0;
  return valid.reduce((s, v) => s + v, 0) / valid.length;
}

function getPerformanceIssues(ad, avgCostPerResult) {
  const issues = [];
  if (ad.clicks && ad.results && (ad.results / ad.clicks) < 0.01) {
    issues.push('Taxa de conversão baixa (<1%). Revise o texto e a oferta.');
  }
  if (ad.costPerResult && avgCostPerResult && ad.costPerResult > avgCostPerResult * 1.3) {
    issues.push('Custo por resultado acima da média. Teste nova criativo ou público.');
  }
  if (ad.clicks && ad.clicks < 500 && ad.status === 'active') {
    issues.push('Poucos cliques. Aumente o orçamento ou melhore a imagem do anúncio.');
  }
  return issues;
}

/* ── Linha da tabela ── */
function AdRow({ ad, isLast, highCpc, onToggle, onDuplicate, onEdit, onRemove }) {
  const [hovered, setHovered] = useState(false);
  const plat   = PLAT[ad.platform]   || PLAT.instagram;
  const status = STATUS[ad.status]   || STATUS.ended;
  const isActive = ad.status === 'active';
  const isEnded  = ad.status === 'ended';

  const fmt = v => v != null ? v.toLocaleString('pt-BR') : '—';
  const fmtCurrency = v => v != null ? `R$\u00A0${v.toFixed(2).replace('.', ',')}` : '—';

  const rowBg = isEnded
    ? (hovered ? '#ECEEF1' : '#F3F4F6')
    : highCpc
      ? (hovered ? '#FEF2F2' : '#FFF5F5')
      : (hovered ? 'var(--c-surface)' : 'var(--c-card-bg)');

  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderBottom: isLast ? 'none' : '1px solid var(--c-border-lt)',
        background: rowBg,
        transition: 'background .12s',
        borderLeft: highCpc ? '3px solid #EF4444' : '3px solid transparent',
        opacity: isEnded ? 0.55 : 1,
        color: isEnded ? '#9CA3AF' : undefined,
        filter: isEnded ? 'grayscale(1)' : 'none',
      }}
    >
      {/* Anúncio */}
      <td style={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AdThumb grad={ad.thumbGrad} />
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--c-text-1)', marginBottom: '2px' }}>{ad.name}</div>
            <div style={{ fontSize: '10px', color: 'var(--c-text-4)' }}>ID: {ad.adId}</div>
          </div>
        </div>
      </td>

      {/* Plataforma */}
      <td style={{ padding: '14px 16px' }}>
        <span style={{
          fontSize: '11px', fontWeight: 600,
          background: plat.bg, color: plat.color,
          padding: '4px 10px', borderRadius: '20px',
          display: 'inline-block',
        }}>
          {plat.label}
        </span>
      </td>

      {/* Situação */}
      <td style={{ padding: '14px 16px' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          fontSize: '11px', fontWeight: 600,
          background: status.bg, color: status.color,
          padding: '4px 10px', borderRadius: '20px',
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: status.dot, display: 'inline-block', flexShrink: 0 }} />
          {status.label}
        </span>
      </td>

      {/* Investimento */}
      <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--c-text-2)', whiteSpace: 'nowrap' }}>
        R$ {ad.budget},00 / dia
      </td>

      {/* Resultados */}
      <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--c-text-2)', fontWeight: ad.results ? 600 : 400 }}>
        {fmt(ad.results)}
      </td>

      {/* Cliques */}
      <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--c-text-2)', fontWeight: ad.clicks ? 600 : 400 }}>
        {fmt(ad.clicks)}
      </td>

      {/* Custo por resultado */}
      <td style={{ padding: '14px 16px', fontSize: '13px', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: highCpc ? '#DC2626' : 'var(--c-text-2)', fontWeight: highCpc ? 700 : 400 }}>
            {fmtCurrency(ad.costPerResult)}
          </span>
          {highCpc && (
            <span title="Custo por resultado acima da média" style={{
              background: '#FEE2E2', color: '#DC2626',
              padding: '2px 6px', borderRadius: '10px',
              fontSize: '10px', fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: '3px',
            }}>
              ⚠ alto
            </span>
          )}
        </div>
      </td>

      {/* Ações */}
      <td style={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {(isActive || ad.status === 'paused') && onToggle && (
            <button
              title={isActive ? 'Pausar anúncio' : 'Reativar anúncio'}
              onClick={() => onToggle(ad)}
              style={{ width: '30px', height: '30px', borderRadius: '8px', border: '1.5px solid var(--c-border)', background: 'var(--c-surface)', color: 'var(--c-text-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >{isActive ? <PauseIcon /> : <PlayIcon />}</button>
          )}
          {onDuplicate && (
            <button
              title="Duplicar anúncio"
              onClick={() => onDuplicate(ad)}
              style={{ width: '30px', height: '30px', borderRadius: '8px', border: '1.5px solid var(--c-border)', background: 'var(--c-surface)', color: 'var(--c-text-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            ><CopyIcon /></button>
          )}
          {onEdit && (
            <button
              title="Editar anúncio"
              onClick={() => onEdit(ad)}
              style={{ width: '30px', height: '30px', borderRadius: '8px', border: '1.5px solid var(--c-border)', background: 'var(--c-surface)', color: 'var(--c-text-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            ><EditIcon /></button>
          )}
          {onRemove && (
            <button
              title="Remover"
              onClick={() => { if (confirm(`Remover "${ad.name}"?`)) onRemove(ad); }}
              style={{ width: '30px', height: '30px', borderRadius: '8px', border: '1.5px solid var(--c-border)', background: 'var(--c-surface)', color: 'var(--c-text-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            ><DotsIcon /></button>
          )}
        </div>
      </td>
    </tr>
  );
}

/* ── Select dropdown estilizado ── */
function FilterSelect({ value, onChange, options }) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          appearance: 'none',
          padding: '8px 32px 8px 14px',
          borderRadius: '10px',
          border: '1.5px solid var(--c-border)',
          background: 'var(--c-card-bg)',
          fontSize: '12px', fontWeight: 500, color: 'var(--c-text-2)',
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        {options.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
      </select>
      <span style={{ position: 'absolute', right: '10px', pointerEvents: 'none', color: 'var(--c-text-4)' }}>
        <ChevronDown />
      </span>
    </div>
  );
}

/* ── Relatório de baixa performance ── */
function PerformanceReport({ ads, avgCostPerResult }) {
  const problematic = ads
    .map(ad => ({ ad, issues: getPerformanceIssues(ad, avgCostPerResult) }))
    .filter(x => x.issues.length > 0);

  if (!problematic.length) {
    return (
      <div style={{
        background: 'var(--c-card-bg)',
        borderRadius: '14px',
        border: '1px solid var(--c-border)',
        padding: '16px 20px',
        marginBottom: '16px',
        display: 'flex', alignItems: 'center', gap: '10px',
      }}>
        <span style={{ fontSize: '18px' }}>✅</span>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#16A34A' }}>Todos os anúncios performando bem</div>
          <div style={{ fontSize: '11px', color: 'var(--c-text-4)' }}>Nenhum alerta de performance no momento.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--c-card-bg)',
      borderRadius: '14px',
      border: '1px solid #FCA5A5',
      padding: '16px 20px',
      marginBottom: '16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span style={{ fontSize: '18px' }}>📊</span>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text-1)' }}>
            Relatório de performance — {problematic.length} {problematic.length === 1 ? 'anúncio precisa' : 'anúncios precisam'} de atenção
          </div>
          <div style={{ fontSize: '11px', color: 'var(--c-text-4)' }}>
            Custo médio por resultado: R$ {avgCostPerResult.toFixed(2).replace('.', ',')}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {problematic.map(({ ad, issues }) => (
          <div key={ad.id} style={{
            background: '#FFF5F5',
            borderRadius: '10px',
            padding: '10px 12px',
            display: 'flex', flexDirection: 'column', gap: '6px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--c-text-1)' }}>{ad.name}</span>
              <span style={{ fontSize: '11px', color: '#DC2626', fontWeight: 600 }}>
                CPR: R$ {ad.costPerResult?.toFixed(2).replace('.', ',') || '—'}
              </span>
            </div>
            <ul style={{ margin: 0, paddingLeft: '18px', color: 'var(--c-text-3)', fontSize: '11px', lineHeight: 1.55 }}>
              {issues.map((tip, i) => <li key={i}>{tip}</li>)}
            </ul>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--c-text-4)', fontStyle: 'italic' }}>
        💡 Integração futura com Meta Ads vai analisar também a imagem do anúncio para sugestões mais específicas.
      </div>
    </div>
  );
}

/* ── Página Anúncios ── */
export default function Campaigns() {
  const navigate = useNavigate();
  const { ads: userAds, toggleAdStatus, duplicateAd, removeAd } = useAppState();
  const [statusFilter, setStatusFilter] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [page, setPage] = useState(1);
  const [reportOpen, setReportOpen] = useState(true);
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('desc');

  const allAds = [...userAds, ...MOCK_ADS];
  const TOTAL = allAds.length;

  function handleEdit(ad) {
    navigate('/criar-anuncio', { state: { editId: ad.id } });
  }

  function handleSort(key) {
    if (!key) return;
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const filtered = allAds.filter(ad => {
    if (statusFilter && ad.status !== statusFilter) return false;
    if (platformFilter && ad.platform !== platformFilter) return false;
    return true;
  });

  const sorted = sortKey
    ? [...filtered].sort((a, b) => {
        const va = a[sortKey];
        const vb = b[sortKey];
        const aNull = va == null;
        const bNull = vb == null;
        if (aNull && bNull) return 0;
        if (aNull) return 1;
        if (bNull) return -1;
        let cmp;
        if (typeof va === 'number' && typeof vb === 'number') {
          cmp = va - vb;
        } else {
          cmp = String(va).localeCompare(String(vb), 'pt-BR', { sensitivity: 'base' });
        }
        return sortDir === 'desc' ? -cmp : cmp;
      })
    : filtered;

  const validCostPerResult = allAds.map(a => a.costPerResult).filter(v => v != null);
  const avgCostPerResult = validCostPerResult.length
    ? validCostPerResult.reduce((s, v) => s + v, 0) / validCostPerResult.length
    : 0;
  const HIGH_CPR_THRESHOLD = avgCostPerResult * 1.3;

  return (
    <div className="page-container">

      {/* ── Cabeçalho ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '22px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '4px' }}>Anúncios</h1>
          <p style={{ fontSize: '13px', color: 'var(--c-text-3)' }}>Gerencie seus anúncios e acompanhe os resultados.</p>
        </div>
        <button
          onClick={() => navigate('/criar-anuncio')}
          style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            background: 'var(--c-accent)', color: '#fff',
            border: 'none', borderRadius: '10px',
            padding: '10px 18px', fontSize: '13px', fontWeight: 700,
            cursor: 'pointer', transition: 'background .15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--c-accent-dk)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--c-accent)'}
        >
          <PlusIcon />
          Novo anúncio
        </button>
      </div>

      {/* ── Filtros ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <FilterSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={[['','Todos os status'],['active','Ativo'],['paused','Pausado'],['review','Em revisão'],['ended','Encerrado']]}
        />
        <FilterSelect
          value={platformFilter}
          onChange={setPlatformFilter}
          options={[['','Todas as plataformas'],['instagram','Instagram'],['meta','Meta Ads'],['google','Google Ads']]}
        />
        <div style={{
          display: 'flex', alignItems: 'center', gap: '7px',
          padding: '8px 14px', borderRadius: '10px',
          border: '1.5px solid var(--c-border)', background: 'var(--c-card-bg)',
          fontSize: '12px', fontWeight: 500, color: 'var(--c-text-2)', cursor: 'pointer',
        }}>
          <CalIcon />
          01/04/2026 - 14/04/2026
        </div>
        {(statusFilter || platformFilter) && (
          <button
            onClick={() => { setStatusFilter(''); setPlatformFilter(''); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '12px', fontWeight: 600, color: 'var(--c-accent)',
            }}
          >
            Limpar filtros
          </button>
        )}
        <button
          onClick={() => setReportOpen(v => !v)}
          style={{
            marginLeft: 'auto',
            background: 'var(--c-card-bg)', border: '1.5px solid var(--c-border)',
            borderRadius: '10px', padding: '8px 14px',
            fontSize: '12px', fontWeight: 600, color: 'var(--c-text-2)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
          }}
        >
          📊 {reportOpen ? 'Ocultar' : 'Ver'} relatório de performance
        </button>
      </div>

      {/* ── Relatório de performance ── */}
      {reportOpen && (
        <PerformanceReport ads={allAds} avgCostPerResult={avgCostPerResult} />
      )}

      {/* ── Tabela ── */}
      <div className="ads-table-wrapper" style={{
        background: 'var(--c-card-bg)',
        borderRadius: '16px',
        border: '1px solid var(--c-border)',
        boxShadow: '0 2px 8px var(--c-shadow)',
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
          <thead>
            <tr style={{ background: 'var(--c-surface)', borderBottom: '1px solid var(--c-border)' }}>
              {[
                { label: 'ANÚNCIO',           w: 'auto',   key: 'name' },
                { label: 'PLATAFORMA',        w: '120px',  key: 'platform' },
                { label: 'SITUAÇÃO',          w: '130px',  key: 'status' },
                { label: 'INVESTIMENTO',      w: '130px',  key: 'budget' },
                { label: 'RESULTADOS',        w: '110px',  key: 'results' },
                { label: 'CLIQUES',           w: '90px',   key: 'clicks' },
                { label: 'CUSTO POR RESULT.', w: '140px',  key: 'costPerResult' },
                { label: 'AÇÕES',             w: '140px',  key: null },
              ].map(({ label, w, key }) => {
                const isActive = sortKey === key && key != null;
                return (
                  <th
                    key={label}
                    onClick={() => handleSort(key)}
                    title={key ? 'Clique para ordenar' : undefined}
                    style={{
                      padding: '12px 16px', textAlign: 'left', fontSize: '10px',
                      fontWeight: 700,
                      color: isActive ? 'var(--c-accent)' : 'var(--c-text-4)',
                      letterSpacing: '.7px', whiteSpace: 'nowrap', width: w,
                      cursor: key ? 'pointer' : 'default',
                      userSelect: 'none',
                      transition: 'color .15s',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      {label}
                      {key && (
                        <span style={{
                          fontSize: '11px',
                          opacity: isActive ? 1 : 0.35,
                          transition: 'opacity .15s',
                        }}>
                          {isActive ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '60px', textAlign: 'center' }}>
                  <div style={{ fontSize: '32px', marginBottom: '10px', opacity: .4 }}>📣</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '4px' }}>Nenhum anúncio encontrado</div>
                  <div style={{ fontSize: '12px', color: 'var(--c-text-4)' }}>Tente remover os filtros ou crie um novo anúncio.</div>
                </td>
              </tr>
            ) : (
              sorted.map((ad, i) => {
                const isUserAd = userAds.some(u => u.id === ad.id);
                return (
                  <AdRow
                    key={ad.id}
                    ad={ad}
                    isLast={i === sorted.length - 1}
                    highCpc={ad.costPerResult != null && ad.costPerResult > HIGH_CPR_THRESHOLD}
                    onToggle={isUserAd ? (a) => toggleAdStatus(a.id) : null}
                    onDuplicate={isUserAd ? (a) => duplicateAd(a.id) : null}
                    onEdit={isUserAd ? handleEdit : null}
                    onRemove={isUserAd ? (a) => removeAd(a.id) : null}
                  />
                );
              })
            )}
          </tbody>
        </table>

        {/* ── Paginação ── */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--c-border-lt)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: '12px', color: 'var(--c-text-4)' }}>
            Mostrando {filtered.length} de {TOTAL} anúncios
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {/* Prev */}
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{
                width: '30px', height: '30px', borderRadius: '8px',
                border: '1.5px solid var(--c-border)', background: 'var(--c-surface)',
                color: 'var(--c-text-3)', cursor: page === 1 ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: page === 1 ? 0.4 : 1, fontSize: '14px',
              }}
            >‹</button>

            {[1, 2, 3].map(n => (
              <button
                key={n}
                onClick={() => setPage(n)}
                style={{
                  width: '30px', height: '30px', borderRadius: '8px',
                  border: `1.5px solid ${page === n ? 'var(--c-accent)' : 'var(--c-border)'}`,
                  background: page === n ? 'var(--c-accent)' : 'var(--c-surface)',
                  color: page === n ? '#fff' : 'var(--c-text-3)',
                  fontSize: '12px', fontWeight: page === n ? 700 : 400,
                  cursor: 'pointer', transition: 'all .15s',
                }}
              >{n}</button>
            ))}

            {/* Next */}
            <button
              onClick={() => setPage(p => Math.min(3, p + 1))}
              disabled={page === 3}
              style={{
                width: '30px', height: '30px', borderRadius: '8px',
                border: '1.5px solid var(--c-border)', background: 'var(--c-surface)',
                color: 'var(--c-text-3)', cursor: page === 3 ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: page === 3 ? 0.4 : 1, fontSize: '14px',
              }}
            >›</button>
          </div>
        </div>
      </div>
    </div>
  );
}
