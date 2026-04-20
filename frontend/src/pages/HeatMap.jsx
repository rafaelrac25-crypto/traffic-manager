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
  { v: 7,  l: '7 dias'  },
  { v: 14, l: '14 dias' },
  { v: 30, l: '30 dias' },
];

const METRICS = ['conversions', 'cpr', 'cpc'];

/* Gradiente azul → ciano → amarelo → laranja → vermelho (estilo radar meteorológico) */
const HEAT_GRADIENT = {
  0.0: '#1E3A8A',
  0.25: '#0EA5E9',
  0.5: '#FACC15',
  0.75: '#F97316',
  1.0: '#DC2626',
};

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

/* Componente interno que gerencia a camada leaflet.heat */
function HeatLayer({ points }) {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    if (!map) return;

    const heatPoints = points.map((p) => [p.coords.lat, p.coords.lng, Math.max(p.intensity, 0.05)]);

    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }

    if (heatPoints.length > 0 && L.heatLayer) {
      layerRef.current = L.heatLayer(heatPoints, {
        radius: 55,
        blur: 45,
        maxZoom: 14,
        max: 1.0,
        minOpacity: 0.35,
        gradient: HEAT_GRADIENT,
      }).addTo(map);
    }

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, points]);

  return null;
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
  const { ads } = useAppState();
  const [days, setDays] = useState(7);
  const [metric, setMetric] = useState('conversions');
  const [campaignId, setCampaignId] = useState('all');

  const activeAds = useMemo(() => (ads || []).filter((a) => Number(a.budgetValue) > 0), [ads]);

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
          {PERIODS.map((p) => (
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
                <HeatLayer points={data} />
                {data.map((d) => (
                  <CircleMarker
                    key={d.name}
                    center={[d.coords.lat, d.coords.lng]}
                    radius={6}
                    pathOptions={{
                      color: colorForIntensity(d.intensity),
                      fillColor: colorForIntensity(d.intensity),
                      fillOpacity: 0.95,
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
                ))}
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
