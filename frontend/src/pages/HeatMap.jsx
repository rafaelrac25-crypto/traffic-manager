/**
 * HeatMap — Mapa de calor de performance por bairro de Joinville.
 *
 * Visualização térmica (azul frio → amarelo morno → vermelho quente) dos
 * resultados das campanhas agregados por bairro. Usuário pode alternar entre
 * CPR, CPC e Conversões, e filtrar por campanha específica ou ver resumo geral.
 *
 * IMPORTANTE: dados são derivados das métricas mock por anel — serão
 * substituídos pela agregação real da Meta Ads API quando implementada.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { useAppState } from '../contexts/AppStateContext';
import { buildHeatMapData, METRIC_CONFIG } from '../data/districtPerformance';
import { HOME_COORDS } from '../data/joinvilleDistricts';

const PERIODS = [
  { v: 7,         l: '7 dias'  },
  { v: 30,        l: '30 dias' },
  { v: 'current', l: 'Atual'   },
];

/* Calcula dias decorridos do startDate da campanha até agora */
function daysSince(startDate) {
  if (!startDate) return null;
  const startMs = new Date(startDate + 'T00:00:00').getTime();
  if (!Number.isFinite(startMs)) return null;
  const diff = Date.now() - startMs;
  return Math.max(1, Math.round(diff / 86400000));
}

const METRICS = ['conversions', 'cpr', 'cpc'];

/* Gradiente térmico estilo radar meteorológico */
const HEAT_GRADIENT = {
  0.0:  '#1E3A8A',
  0.25: '#0EA5E9',
  0.5:  '#84CC16',
  0.65: '#FACC15',
  0.85: '#F97316',
  1.0:  '#DC2626',
};

/* Camada de heatmap com radius adaptativo ao zoom (evita blob gigante em zoom out) */
function HeatLayer({ points }) {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    if (!map || !L.heatLayer) return;

    const build = () => {
      if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
      if (!points || points.length === 0) return;

      const z = map.getZoom();
      /* radius maior + blur menor = cores mais saturadas e definidas */
      const radius = Math.round(28 + (z - 11) * 12);   /* z=11 → 28; z=13 → 52; z=15 → 76 */
      const blur   = Math.round(radius * 0.55);         /* menos blur = cor mais forte */

      /* Gamma curve (expoente < 1) empurra intensidade pra cima →
         valores médios ficam mais "quentes", contraste fica mais vivo */
      const heatPoints = points.map((p) => {
        const t = Math.min(1, Math.max(0, p.intensity || 0));
        const boosted = Math.pow(t, 0.6);
        return [p.coords.lat, p.coords.lng, Math.max(0.35, boosted)];
      });

      layerRef.current = L.heatLayer(heatPoints, {
        radius,
        blur,
        max: 1.0,
        minOpacity: 0.75,
        gradient: HEAT_GRADIENT,
      }).addTo(map);
    };

    build();
    map.on('zoomend', build);
    return () => {
      map.off('zoomend', build);
      if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
    };
  }, [map, points]);

  return null;
}

function colorForIntensity(t) {
  const stops = [
    [0.0, [30, 58, 138]],
    [0.25, [14, 165, 233]],
    [0.5, [250, 204, 21]],
    [0.75, [249, 115, 22]],
    [1.0, [220, 38, 38]],
  ];
  const v = Math.max(0, Math.min(1, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const [a, ca] = stops[i];
    const [b, cb] = stops[i + 1];
    if (v >= a && v <= b) {
      const k = (v - a) / (b - a);
      const rgb = ca.map((c, j) => Math.round(c + (cb[j] - c) * k));
      return `rgb(${rgb.join(',')})`;
    }
  }
  return '#94A3B8';
}

function LegendBar({ metric, minValue, maxValue }) {
  const config = METRIC_CONFIG[metric];
  const leftLabel  = config.invert ? 'Melhor (quente)' : 'Menor (frio)';
  const rightLabel = config.invert ? 'Pior (frio)'     : 'Maior (quente)';
  /* Se invertido, visualmente a esquerda é "quente". Mas a barra térmica SEMPRE
     cresce de frio → quente (azul → vermelho), porque a intensidade já foi
     invertida na normalização. Então a interpretação do valor bruto inverte. */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '220px' }}>
      <div style={{
        height: '14px', borderRadius: '7px',
        background: 'linear-gradient(90deg, #1E3A8A 0%, #0EA5E9 25%, #FACC15 50%, #F97316 75%, #DC2626 100%)',
        border: '1px solid var(--c-border)',
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--c-text-4)', fontWeight: 600 }}>
        <span>{config.invert ? `${config.format(maxValue)} (pior)` : `${config.format(minValue)}`}</span>
        <span>{config.invert ? `${config.format(minValue)} (melhor)` : `${config.format(maxValue)}`}</span>
      </div>
    </div>
  );
}

function MetricToggle({ metric, setMetric }) {
  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
      {METRICS.map((m) => {
        const config = METRIC_CONFIG[m];
        const active = metric === m;
        return (
          <button
            key={m}
            onClick={() => setMetric(m)}
            style={{
              padding: '8px 14px', borderRadius: '10px',
              border: `1.5px solid ${active ? 'var(--c-accent)' : 'var(--c-border)'}`,
              background: active ? 'var(--c-active-bg)' : 'var(--c-surface)',
              color: active ? 'var(--c-accent)' : 'var(--c-text-2)',
              fontSize: '12px', fontWeight: 700, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: '6px',
            }}
          >
            <span>{config.icon}</span>{config.label}
          </button>
        );
      })}
    </div>
  );
}

function SummaryCards({ data, metric }) {
  if (data.length === 0) return null;
  const config = METRIC_CONFIG[metric];

  const sorted = [...data].filter((d) => d.metricValue != null && Number.isFinite(d.metricValue))
    .sort((a, b) => config.invert ? a.metricValue - b.metricValue : b.metricValue - a.metricValue);

  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const totalSpend = data.reduce((s, d) => s + (d.spend || 0), 0);
  const totalConv = data.reduce((s, d) => s + (d.conversions || 0), 0);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginBottom: '16px' }}>
      <SummaryCard
        label={`Bairro mais quente (${config.label})`}
        value={best ? best.name : '—'}
        sub={best ? config.format(best.metricValue) : ''}
        color="#DC2626"
      />
      <SummaryCard
        label={`Bairro mais frio (${config.label})`}
        value={worst ? worst.name : '—'}
        sub={worst ? config.format(worst.metricValue) : ''}
        color="#1E3A8A"
      />
      <SummaryCard
        label="Investimento total"
        value={`R$\u00A0${totalSpend.toFixed(2).replace('.', ',')}`}
        sub={`${data.length} bairros cobertos`}
        color="var(--c-accent)"
      />
      <SummaryCard
        label="Conversões totais"
        value={totalConv.toLocaleString('pt-BR')}
        sub="soma agregada"
        color="var(--c-accent)"
      />
    </div>
  );
}

/* Converte um budgetValue+budgetType para equivalentes diário/semanal/mensal */
function normalizeBudget(ad) {
  const v = Number(ad.budgetValue) || 0;
  if (v <= 0) return { daily: 0, weekly: 0, monthly: 0 };
  if (ad.budgetType === 'weekly') {
    return { daily: v / 7, weekly: v, monthly: v * (30 / 7) };
  }
  if (ad.budgetType === 'total') {
    /* assume 30 dias como campanha total */
    return { daily: v / 30, weekly: v / 30 * 7, monthly: v };
  }
  /* daily (default) */
  return { daily: v, weekly: v * 7, monthly: v * 30 };
}

/* Retorna o patch certo pra updateAd quando o usuário muda um dos 3 campos */
function budgetPatchFor(ad, field, newValue) {
  const n = Number(newValue) || 0;
  const type = ad.budgetType || 'daily';
  /* Convertemos pra daily como base interna, e ajustamos budgetValue conforme o budgetType original */
  const dailyEquiv = field === 'daily' ? n : field === 'weekly' ? n / 7 : n / 30;
  if (type === 'weekly') return { budgetValue: Number((dailyEquiv * 7).toFixed(2)) };
  if (type === 'total')  return { budgetValue: Number((dailyEquiv * 30).toFixed(2)) };
  return { budgetValue: Number(dailyEquiv.toFixed(2)) };
}

function ResultsCard({ label, spend, conversions, clicks, emphasis }) {
  const cpr = conversions > 0 ? spend / conversions : null;
  return (
    <div style={{
      background: 'var(--c-card-bg)',
      border: `1px solid ${emphasis ? 'var(--c-accent)' : 'var(--c-border)'}`,
      borderRadius: '10px',
      padding: '12px 14px',
      flex: 1, minWidth: '150px',
    }}>
      <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--c-text-4)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '6px' }}>
        {label}
      </div>
      <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--c-text-1)', lineHeight: 1.1 }}>
        R$&nbsp;{spend.toFixed(2).replace('.', ',')}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--c-text-3)', marginTop: '3px' }}>
        {conversions} conv · {clicks} cliq
        {cpr != null && <> · CPR R$&nbsp;{cpr.toFixed(2).replace('.', ',')}</>}
      </div>
    </div>
  );
}

function BudgetInput({ label, value, onSave, disabled, unit }) {
  const [draft, setDraft] = useState(value.toFixed(2));
  const [editing, setEditing] = useState(false);

  useEffect(() => { if (!editing) setDraft(value.toFixed(2)); }, [value, editing]);

  const save = () => {
    const n = Number(String(draft).replace(',', '.'));
    if (Number.isFinite(n) && n > 0 && Math.abs(n - value) > 0.001) {
      onSave(n);
    } else {
      setDraft(value.toFixed(2));
    }
    setEditing(false);
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '140px',
      opacity: disabled ? 0.5 : 1,
    }}>
      <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--c-text-4)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
        {label}
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        background: 'var(--c-surface)', border: '1.5px solid var(--c-border)',
        borderRadius: '10px', padding: '0 12px',
      }}>
        <span style={{ fontSize: '13px', color: 'var(--c-text-4)' }}>R$</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setEditing(true); }}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          disabled={disabled}
          style={{
            flex: 1, padding: '10px 4px', border: 'none', background: 'transparent',
            fontSize: '15px', fontWeight: 700, color: 'var(--c-text-1)', outline: 'none',
            minWidth: 0,
          }}
        />
        <span style={{ fontSize: '11px', color: 'var(--c-text-4)', fontWeight: 600 }}>{unit}</span>
      </div>
    </div>
  );
}

function CampaignDetailPanel({ ad, data, daysFilter, history, onUpdateBudget }) {
  const budget = normalizeBudget(ad);

  /* Agrega totais do mapa (já filtrado para esta campanha) */
  const totalSpend = data.reduce((s, d) => s + (d.spend || 0), 0);
  const totalConv  = data.reduce((s, d) => s + (d.conversions || 0), 0);
  const totalClicks = data.reduce((s, d) => s + (d.clicks || 0), 0);

  /* Projeção proporcional por período (baseado nos últimos `daysFilter` dias) */
  const factor = daysFilter > 0 ? (1 / daysFilter) : 0;
  const today    = { spend: totalSpend * factor * 1, conversions: Math.round(totalConv * factor * 1), clicks: Math.round(totalClicks * factor * 1) };
  const week     = { spend: totalSpend * factor * 7, conversions: Math.round(totalConv * factor * 7), clicks: Math.round(totalClicks * factor * 7) };
  const month    = { spend: totalSpend * factor * 30, conversions: Math.round(totalConv * factor * 30), clicks: Math.round(totalClicks * factor * 30) };

  /* Histórico filtrado: só alterações de orçamento desta campanha */
  const budgetHistory = (history || [])
    .filter((h) => h.type === 'ad-updated' && h.description?.includes('budgetValue'))
    .filter((h) => h.title?.includes(ad.name))
    .slice(0, 5);

  const budgetType = ad.budgetType || 'daily';
  const primaryLabel = { daily: 'Diário', weekly: 'Semanal', total: 'Total' }[budgetType];

  return (
    <div style={{
      background: 'var(--c-card-bg)', border: '1px solid var(--c-border)',
      borderRadius: '12px', padding: '14px 16px', marginBottom: '14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--c-text-1)' }}>{ad.name}</span>
        <span style={{
          fontSize: '10.5px', fontWeight: 700, color: 'var(--c-accent)',
          background: 'var(--c-active-bg)', padding: '3px 8px', borderRadius: '10px',
        }}>
          Orçamento {primaryLabel}
        </span>
      </div>
      <div style={{ fontSize: '11.5px', color: 'var(--c-text-3)', marginBottom: '14px' }}>
        Resultados projetados a partir do período de {daysFilter} dias selecionado acima.
      </div>

      {/* Cards de resultados */}
      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '6px' }}>
        Resultados
      </div>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <ResultsCard label="Hoje (média)" spend={today.spend} conversions={today.conversions} clicks={today.clicks} />
        <ResultsCard label="Semana" spend={week.spend} conversions={week.conversions} clicks={week.clicks} emphasis />
        <ResultsCard label="Mês" spend={month.spend} conversions={month.conversions} clicks={month.clicks} />
      </div>

      {/* Inputs de orçamento */}
      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '6px' }}>
        Editar orçamento
      </div>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <BudgetInput
          label="Diário"
          unit="/dia"
          value={budget.daily}
          disabled={budgetType === 'total'}
          onSave={(v) => onUpdateBudget(budgetPatchFor(ad, 'daily', v))}
        />
        <BudgetInput
          label="Semanal"
          unit="/semana"
          value={budget.weekly}
          disabled={budgetType === 'total'}
          onSave={(v) => onUpdateBudget(budgetPatchFor(ad, 'weekly', v))}
        />
        <BudgetInput
          label="Mensal"
          unit="/mês"
          value={budget.monthly}
          onSave={(v) => onUpdateBudget(budgetPatchFor(ad, 'monthly', v))}
        />
      </div>
      <div style={{ fontSize: '10.5px', color: 'var(--c-text-4)', marginBottom: '14px' }}>
        ℹ️ Alterar qualquer valor recalcula automaticamente os outros dois. Tipo primário da campanha: <strong>{primaryLabel}</strong>.
        {budgetType === 'total' && ' Campanhas com orçamento total bloqueiam ajuste diário/semanal — edite só o mensal.'}
      </div>

      {/* Histórico */}
      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '6px' }}>
        Histórico de alterações ({budgetHistory.length})
      </div>
      {budgetHistory.length === 0 ? (
        <div style={{ fontSize: '11.5px', color: 'var(--c-text-4)', fontStyle: 'italic' }}>
          Nenhuma alteração registrada ainda. Edite um dos valores acima pra registrar.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {budgetHistory.map((h) => (
            <div key={h.id} style={{
              display: 'flex', justifyContent: 'space-between', gap: '12px',
              padding: '6px 8px', borderRadius: '6px', background: 'var(--c-surface)',
              fontSize: '11px',
            }}>
              <span style={{ color: 'var(--c-text-2)' }}>{h.title}</span>
              <span style={{ color: 'var(--c-text-4)' }}>
                {new Date(h.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: 'var(--c-card-bg)',
      border: '1px solid var(--c-border)',
      borderLeft: `4px solid ${color}`,
      borderRadius: '10px',
      padding: '12px 14px',
    }}>
      <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--c-text-4)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--c-text-1)', lineHeight: 1.2 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '11px', color: 'var(--c-text-3)', marginTop: '2px' }}>{sub}</div>}
    </div>
  );
}

function DistrictTable({ data, metric }) {
  if (data.length === 0) return null;
  const config = METRIC_CONFIG[metric];
  const sorted = [...data].sort((a, b) => (b.intensity || 0) - (a.intensity || 0));

  return (
    <div style={{
      background: 'var(--c-card-bg)', border: '1px solid var(--c-border)',
      borderRadius: '12px', padding: '12px 14px',
    }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '10px' }}>
        Bairros ordenados por temperatura ({config.label})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {sorted.map((d) => {
          const color = colorForIntensity(d.intensity);
          return (
            <div key={d.name} style={{
              display: 'grid', gridTemplateColumns: '14px 1fr auto auto auto', gap: '10px',
              alignItems: 'center', padding: '6px 8px', borderRadius: '6px',
              background: 'var(--c-surface)', fontSize: '11.5px',
            }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, display: 'inline-block' }} />
              <span style={{ fontWeight: 700, color: 'var(--c-text-1)' }}>{d.name}</span>
              <span style={{ color: 'var(--c-text-3)', fontSize: '10.5px' }}>{d.distKm.toFixed(1)} km</span>
              <span style={{ color: 'var(--c-text-2)', fontWeight: 600 }}>{config.format(d.metricValue)}</span>
              <span style={{ fontSize: '10px', color: 'var(--c-text-4)' }}>
                {d.conversions} conv · R$\u00A0{d.spend.toFixed(0)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function HeatMap() {
  const navigate = useNavigate();
  const { ads, updateAd, history } = useAppState();
  const [periodKey, setPeriodKey] = useState(7);
  const [metric, setMetric] = useState('conversions');
  const [campaignId, setCampaignId] = useState('all');

  const activeAds = useMemo(() => (ads || []).filter((a) => Number(a.budgetValue) > 0), [ads]);
  const selectedAd = useMemo(() => {
    if (campaignId === 'all') return null;
    return activeAds.find((a) => String(a.id) === String(campaignId)) || null;
  }, [activeAds, campaignId]);

  /* Resolve "Atual" → número de dias. Se não houver startDate, fallback pra 7 */
  const days = useMemo(() => {
    if (periodKey !== 'current') return periodKey;
    if (selectedAd) return daysSince(selectedAd.startDate) ?? 7;
    /* Resumo geral + Atual → usa a campanha ativa mais antiga */
    const dys = activeAds.map((a) => daysSince(a.startDate)).filter(Number.isFinite);
    return dys.length > 0 ? Math.max(...dys) : 7;
  }, [periodKey, selectedAd, activeAds]);

  const data = useMemo(() => {
    return buildHeatMapData(activeAds, {
      campaignId: campaignId === 'all' ? null : campaignId,
      metric,
      daysActive: days,
    });
  }, [activeAds, campaignId, metric, days]);

  const values = data.map((d) => d.metricValue).filter((v) => v != null && Number.isFinite(v));
  const minValue = values.length > 0 ? Math.min(...values) : 0;
  const maxValue = values.length > 0 ? Math.max(...values) : 0;

  return (
    <div className="page-container">
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '18px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '4px' }}>
            Mapa de Calor
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--c-text-3)', margin: 0, maxWidth: '640px' }}>
            Visualização térmica das regiões de Joinville por performance das campanhas. Azul = frio, vermelho = quente.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {PERIODS.map((p) => {
            const active = periodKey === p.v;
            const label = p.v === 'current' ? `Atual (${days}d)` : p.l;
            return (
              <button
                key={p.v}
                onClick={() => setPeriodKey(p.v)}
                style={{
                  padding: '8px 14px', borderRadius: '10px',
                  border: `1.5px solid ${active ? 'var(--c-accent)' : 'var(--c-border)'}`,
                  background: active ? 'var(--c-active-bg)' : 'var(--c-surface)',
                  color: active ? 'var(--c-accent)' : 'var(--c-text-2)',
                  fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Controles */}
      <div style={{
        background: 'var(--c-card-bg)', border: '1px solid var(--c-border)',
        borderRadius: '12px', padding: '12px 14px',
        display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center',
        marginBottom: '14px',
      }}>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--c-text-4)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '6px' }}>
            Métrica
          </div>
          <MetricToggle metric={metric} setMetric={setMetric} />
        </div>

        <div style={{ flex: 1, minWidth: '200px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--c-text-4)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '6px' }}>
            Campanha
          </div>
          <select
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            style={{
              width: '100%', padding: '8px 10px', borderRadius: '8px',
              border: '1.5px solid var(--c-border)', background: 'var(--c-surface)',
              color: 'var(--c-text-1)', fontSize: '12.5px', fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <option value="all">Resumo geral (todas as campanhas)</option>
            {activeAds.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--c-text-4)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '6px' }}>
            Escala térmica
          </div>
          <LegendBar metric={metric} minValue={minValue} maxValue={maxValue} />
        </div>
      </div>

      {/* Empty state */}
      {activeAds.length === 0 && (
        <div style={{
          padding: '48px 24px', textAlign: 'center',
          background: 'var(--c-card-bg)', border: '1px dashed var(--c-border)',
          borderRadius: '14px',
        }}>
          <div style={{ fontSize: '40px', marginBottom: '10px' }}>🗺️</div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '6px' }}>
            Nenhum anúncio ativo ainda
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--c-text-3)', maxWidth: '420px', margin: '0 auto 14px' }}>
            Publique o primeiro anúncio com segmentação em Joinville e as regiões aparecerão aqui automaticamente.
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

      {/* Mapa + resumo */}
      {activeAds.length > 0 && (
        <>
          {selectedAd && (
            <CampaignDetailPanel
              ad={selectedAd}
              data={data}
              daysFilter={days}
              history={history}
              onUpdateBudget={(patch) => updateAd(selectedAd.id, patch)}
            />
          )}
          <SummaryCards data={data} metric={metric} />

          <div style={{
            background: 'var(--c-card-bg)', border: '1px solid var(--c-border)',
            borderRadius: '12px', overflow: 'hidden', marginBottom: '14px',
            boxShadow: '0 1px 4px var(--c-shadow)',
          }}>
            <div style={{ height: '460px', width: '100%' }}>
              <MapContainer
                center={[HOME_COORDS.lat, HOME_COORDS.lng]}
                zoom={12}
                scrollWheelZoom
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {/* Camada térmica com blending suave (estilo radar meteorológico) */}
                <HeatLayer points={data} />
                {/* Ponto central + tooltip */}
                {data.map((d) => {
                  const color = colorForIntensity(d.intensity);
                  return (
                    <CircleMarker
                      key={`pt-${d.name}`}
                      center={[d.coords.lat, d.coords.lng]}
                      radius={6}
                      pathOptions={{
                        color: '#fff',
                        fillColor: color,
                        fillOpacity: 1,
                        weight: 2,
                      }}
                    >
                      <Tooltip direction="top" offset={[0, -6]} opacity={1} sticky>
                        <div style={{ fontSize: '11px', lineHeight: 1.4 }}>
                          <strong>{d.name}</strong><br/>
                          {METRIC_CONFIG[metric].label}: <strong>{METRIC_CONFIG[metric].format(d.metricValue)}</strong><br/>
                          <span style={{ color: '#666' }}>
                            {d.conversions} conv · {d.clicks} cliq · R$&nbsp;{d.spend.toFixed(2)}
                          </span>
                        </div>
                      </Tooltip>
                    </CircleMarker>
                  );
                })}
              </MapContainer>
            </div>
          </div>

          <DistrictTable data={data} metric={metric} />

          {/* Nota sobre dados mock */}
          <div style={{
            marginTop: '16px', padding: '10px 14px',
            background: 'var(--c-surface)', border: '1px dashed var(--c-border)',
            borderRadius: '10px', fontSize: '11px', color: 'var(--c-text-4)', lineHeight: 1.5,
          }}>
            ℹ️ Métricas por bairro simuladas a partir dos anéis de segmentação — consistentes entre sessões mas não são dados reais do Meta Ads.
            Quando a integração com a Meta API for ativada, a agregação geográfica virá direto das insights.
          </div>
        </>
      )}
    </div>
  );
}
