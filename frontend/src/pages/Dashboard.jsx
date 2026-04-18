/**
 * IMPORTANT:
 * All displayed data is fictional placeholder data.
 * Real data will be loaded later from Meta Ads API.
 * Do not persist mock values.
 */

import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../contexts/AppStateContext';

/* ── Constantes de mock ── */
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const WEEK_DAYS_SHORT = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'];

const MOCK_METRICS = [
  {
    label: 'Investimento',
    value: 'R$ 3.700,00',
    trend: '+12,5%',
    trendUp: true,
    sub: 'vs. ontem',
    icon: <WalletIcon />,
    iconBg: '#FDF0F8',
    iconColor: '#d68d8f',
  },
  {
    label: 'Cliques',
    value: '13.663',
    trend: '+8,3%',
    trendUp: true,
    sub: 'vs. ontem',
    icon: <CursorIcon />,
    iconBg: '#EFF6FF',
    iconColor: '#3B82F6',
  },
  {
    label: 'Resultados',
    value: '166',
    trend: '+6,1%',
    trendUp: true,
    sub: 'vs. ontem',
    icon: <ResultIcon />,
    iconBg: '#F0FDF4',
    iconColor: '#22C55E',
  },
  {
    label: 'Custo por resultado',
    value: 'R$ 22,29',
    trend: '-4,7%',
    trendUp: false,
    sub: 'vs. ontem',
    icon: <DollarIcon />,
    iconBg: '#FFF7ED',
    iconColor: '#F97316',
  },
];

/* Dados do gráfico — 7 dias */
const CHART_DATA = [
  { label: '08 Abr', value: 82 },
  { label: '09 Abr', value: 95 },
  { label: '10 Abr', value: 72 },
  { label: '11 Abr', value: 118 },
  { label: '12 Abr', value: 166 },
  { label: '13 Abr', value: 148 },
  { label: '14 Abr', value: 158 },
];

/* Eventos do calendário */
const CALENDAR_EVENTS = {
  '2026-04-10': { label: 'Esmaltes Tendência', color: '#F97316', dot: true },
  '2026-04-14': { label: 'Skincare Rotina Diária', color: '#d68d8f', dot: true },
  '2026-04-21': { label: 'Lançamento Nova Linha', color: '#8B5CF6', dot: true },
};

/* ── Ícones SVG ── */
function WalletIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>
    </svg>
  );
}
function CursorIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3l14 9-7 1-3 7z"/>
    </svg>
  );
}
function ResultIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  );
}
function DollarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  );
}
function ArrowUp({ color }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 15 12 9 6 15"/>
    </svg>
  );
}
function ArrowDown({ color }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  );
}
function CalendarIcon2() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}
function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  );
}

/* ── Gráfico de linha SVG (interativo) ── */
function LineChart({ data, unit = 'resultados' }) {
  const W = 540, H = 180;
  const padL = 40, padR = 20, padT = 34, padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const maxVal = Math.max(200, Math.ceil(Math.max(...data.map(d => d.value)) / 50) * 50);
  const svgRef = useRef(null);
  const [hoverIdx, setHoverIdx] = useState(data.length - 1);
  const [isHovering, setIsHovering] = useState(false);

  const pts = data.map((d, i) => ({
    x: padL + (i / (data.length - 1)) * plotW,
    y: padT + plotH - (d.value / maxVal) * plotH,
    ...d,
  }));

  function smoothPath(points) {
    if (points.length < 2) return '';
    let d = `M ${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const cpx = (p0.x + p1.x) / 2;
      d += ` C ${cpx},${p0.y} ${cpx},${p1.y} ${p1.x},${p1.y}`;
    }
    return d;
  }
  function areaPath(points) {
    const lp = smoothPath(points);
    const last = points[points.length - 1];
    const first = points[0];
    return `${lp} L ${last.x},${padT + plotH} L ${first.x},${padT + plotH} Z`;
  }

  const linePath = smoothPath(pts);
  const fillPath = areaPath(pts);
  const gridVals = [0, Math.round(maxVal / 4), Math.round(maxVal / 2), Math.round(maxVal * 3 / 4), maxVal];

  function handleMove(e) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    let nearest = 0, best = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const d = Math.abs(pts[i].x - svgX);
      if (d < best) { best = d; nearest = i; }
    }
    setHoverIdx(nearest);
    setIsHovering(true);
  }

  const active = pts[hoverIdx] || pts[pts.length - 1];
  const tooltipX = Math.max(padL + 46, Math.min(W - padR - 46, active.x));

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ display: 'block', overflow: 'visible', cursor: 'crosshair' }}
      onMouseMove={handleMove}
      onMouseLeave={() => setIsHovering(false)}
      onTouchMove={(e) => {
        const t = e.touches[0];
        if (t) handleMove({ clientX: t.clientX });
      }}
    >
      <defs>
        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#d68d8f" stopOpacity="0.22"/>
          <stop offset="100%" stopColor="#d68d8f" stopOpacity="0.01"/>
        </linearGradient>
        <linearGradient id="chartLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#E879A8"/>
          <stop offset="100%" stopColor="#d68d8f"/>
        </linearGradient>
        <filter id="chartGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {gridVals.map(v => {
        const y = padT + plotH - (v / maxVal) * plotH;
        return (
          <g key={v}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--c-border-lt)" strokeWidth="1" strokeDasharray="4,4"/>
            <text x={padL - 6} y={y + 4} fontSize="9" fill="var(--c-text-4)" textAnchor="end">{v}</text>
          </g>
        );
      })}

      <path d={fillPath} fill="url(#chartFill)" style={{ transition: 'd .3s ease' }}/>
      <path d={linePath} fill="none" stroke="url(#chartLine)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter="url(#chartGlow)"/>

      {pts.map((pt, i) => (
        <text
          key={i}
          x={pt.x}
          y={H - 4}
          fontSize="9"
          fill={i === hoverIdx ? '#d68d8f' : 'var(--c-text-4)'}
          fontWeight={i === hoverIdx ? 700 : 400}
          textAnchor="middle"
          style={{ transition: 'fill .18s ease' }}
        >
          {pt.label}
        </text>
      ))}

      {pts.map((pt, i) => (
        <circle
          key={`dot-${i}`}
          cx={pt.x}
          cy={pt.y}
          r={i === hoverIdx ? 5 : 2.5}
          fill={i === hoverIdx ? '#d68d8f' : '#fff'}
          stroke="#d68d8f"
          strokeWidth={i === hoverIdx ? 2 : 1.5}
          style={{ transition: 'r .22s cubic-bezier(.22,1,.36,1), fill .18s ease' }}
        />
      ))}

      <line
        x1={active.x} y1={padT}
        x2={active.x} y2={padT + plotH}
        stroke="#d68d8f"
        strokeWidth="1"
        strokeDasharray="3,3"
        opacity={isHovering ? 0.7 : 0.45}
        style={{ transition: 'x1 .18s ease, x2 .18s ease, opacity .18s ease' }}
      />

      <g style={{ transition: 'transform .2s ease', transform: `translate(${tooltipX - active.x}px, 0)` }}>
        <rect
          x={active.x - 46}
          y={active.y - 36}
          width="92"
          height="30"
          rx="8"
          fill="#d68d8f"
          style={{ transition: 'x .22s cubic-bezier(.22,1,.36,1), y .22s cubic-bezier(.22,1,.36,1)', filter: 'drop-shadow(0 4px 10px rgba(214,141,143,.35))' }}
        />
        <text
          x={active.x}
          y={active.y - 19}
          fontSize="10.5"
          fill="white"
          textAnchor="middle"
          fontWeight="800"
          style={{ transition: 'x .22s ease, y .22s ease' }}
        >
          {active.label}
        </text>
        <text
          x={active.x}
          y={active.y - 8}
          fontSize="9"
          fill="white"
          textAnchor="middle"
          opacity="0.92"
          style={{ transition: 'x .22s ease, y .22s ease' }}
        >
          {active.value} {unit}
        </text>
      </g>
    </svg>
  );
}

/* ── Calendário mini ── */
function MiniCalendar({ onViewFull }) {
  const today = new Date();
  const year = 2026, month = 3; /* Abril 2026 */
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--c-text-1)' }}>Calendário</span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--c-accent)' }}>Abril 2026</span>
        </div>
        <button
          onClick={onViewFull}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600, color: 'var(--c-accent)' }}
        >
          Ver calendário completo
        </button>
      </div>

      {/* Dias da semana */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
        {WEEK_DAYS_SHORT.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: '9px', fontWeight: 700, color: 'var(--c-text-4)', padding: '2px 0' }}>{d}</div>
        ))}
      </div>

      {/* Células */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {/* dias do mês anterior */}
        {Array.from({ length: firstDay }).map((_, i) => {
          const prevDay = new Date(year, month, 0).getDate() - firstDay + i + 1;
          return (
            <div key={`prev-${i}`} style={{ textAlign: 'center', padding: '5px 2px', fontSize: '11px', color: 'var(--c-text-4)', opacity: 0.4 }}>{prevDay}</div>
          );
        })}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = `${year}-04-${String(day).padStart(2, '0')}`;
          const isToday = day === 14;
          const event = CALENDAR_EVENTS[dateStr];

          return (
            <div key={day} style={{
              textAlign: 'center',
              padding: '4px 2px',
              borderRadius: '6px',
              position: 'relative',
              cursor: event ? 'pointer' : 'default',
            }}>
              <div style={{
                width: '24px', height: '24px', borderRadius: '50%',
                background: isToday ? 'var(--c-accent)' : 'transparent',
                color: isToday ? '#fff' : 'var(--c-text-2)',
                fontSize: '11px', fontWeight: isToday ? 700 : 400,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto',
              }}>
                {day}
              </div>
              {event && (
                <div style={{ marginTop: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px', justifyContent: 'center' }}>
                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: event.color }} />
                    <span style={{ fontSize: '8px', color: event.color, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '50px' }}>
                      {event.label}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legenda */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
        {[['#d68d8f', 'Instagram'], ['#F97316', 'Google Ads'], ['#8B5CF6', 'Em revisão']].map(([color, label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
            <span style={{ fontSize: '10px', color: 'var(--c-text-3)' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Card de métrica (compacto — visão geral) ── */
function MetricCard({ label, value, trend, trendUp, sub, icon, iconBg, iconColor }) {
  return (
    <div className="ccb-card" style={{
      background: 'var(--c-card-bg)',
      borderRadius: '12px',
      padding: '10px 14px',
      border: '1px solid var(--c-border)',
      boxShadow: '0 1px 4px var(--c-shadow)',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      cursor: 'default',
      minHeight: '58px',
    }}>
      <div className="ccb-icon" style={{
        width: '30px', height: '30px', borderRadius: '8px',
        background: iconBg, color: iconColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {React.cloneElement(icon, { width: 15, height: 15 })}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '10px', color: 'var(--c-text-4)', lineHeight: 1.2, marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '.3px', fontWeight: 600 }}>
          {label}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--c-text-1)', lineHeight: 1.1 }}>
            {value}
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
            {trendUp ? <ArrowUp color="#22C55E" /> : <ArrowDown color="#EF4444" />}
            <span style={{ fontSize: '10px', fontWeight: 700, color: trendUp ? '#22C55E' : '#EF4444' }}>{trend}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Mock de CPC por anúncio ativo (até integração Meta Ads) ── */
const MOCK_CPC = [
  { id: 1, name: 'Promoção Verão',        cpc: 0.42 },
  { id: 2, name: 'Esmaltes Tendência',    cpc: 1.86 },
  { id: 3, name: 'Skincare Rotina Diária', cpc: 0.58 },
  { id: 5, name: 'Remarketing Site',      cpc: 0.71 },
];
const AVG_CPC = MOCK_CPC.reduce((s, a) => s + a.cpc, 0) / MOCK_CPC.length;
const HIGH_CPC_THRESHOLD = AVG_CPC * 1.3;
const HIGH_CPC_ADS = MOCK_CPC.filter(a => a.cpc > HIGH_CPC_THRESHOLD);

/* ── Card de saldo ── */
function BalanceCard({ funds, lowBalance, threshold, onAdd }) {
  const pct = Math.min(100, (funds / 200) * 100);
  return (
    <div className="ccb-card" style={{
      background: 'var(--c-card-bg)',
      borderRadius: '14px',
      border: `1px solid ${lowBalance ? '#FCA5A5' : 'var(--c-border)'}`,
      padding: '14px 16px',
      boxShadow: '0 2px 8px var(--c-shadow)',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      height: '100%',
      justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '14px' }}>{lowBalance ? '⚠️' : '💰'}</span>
          <span style={{ fontSize: '10px', fontWeight: 700, color: lowBalance ? '#DC2626' : 'var(--c-text-3)', letterSpacing: '.4px', textTransform: 'uppercase' }}>
            Saldo
          </span>
        </div>
        <button
          onClick={onAdd}
          style={{
            background: 'var(--c-accent)', color: '#fff',
            border: 'none', borderRadius: '7px',
            padding: '4px 10px', fontSize: '10px', fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Adicionar
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontSize: '22px', fontWeight: 800, color: lowBalance ? '#DC2626' : 'var(--c-text-1)', lineHeight: 1 }}>
          R$ {funds.toFixed(2).replace('.', ',')}
        </div>
        <div style={{ fontSize: '10px', color: 'var(--c-text-4)', marginTop: '3px' }}>
          {lowBalance ? `Abaixo do mínimo de R$ ${threshold},00` : 'Disponível para veicular anúncios'}
        </div>
      </div>

      <div style={{ height: '5px', background: 'var(--c-border-lt)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: lowBalance ? '#EF4444' : 'var(--c-accent)',
          transition: 'width .3s',
        }} />
      </div>
    </div>
  );
}

/* ── Histórico comparativo de datas comerciais ── */
const HISTORICAL_COMPARISON = [
  {
    event: 'Dia das Mães',
    current: { year: 2026, investment: 600, results: 54, cpr: 11.11 },
    previous: { year: 2025, investment: 480, results: 38, cpr: 12.63 },
  },
  {
    event: 'Black Friday',
    current: { year: 2025, investment: 1250, results: 178, cpr: 7.02 },
    previous: { year: 2024, investment: 900, results: 104, cpr: 8.65 },
  },
  {
    event: 'Dia dos Namorados',
    current: { year: 2025, investment: 400, results: 31, cpr: 12.90 },
    previous: { year: 2024, investment: 320, results: 22, cpr: 14.54 },
  },
];

function HistoricalComparisonCard({ onViewCalendar }) {
  const [idx, setIdx] = useState(0);
  const item = HISTORICAL_COMPARISON[idx];
  const resultsDelta = ((item.current.results - item.previous.results) / item.previous.results) * 100;
  const cprDelta = ((item.current.cpr - item.previous.cpr) / item.previous.cpr) * 100;

  return (
    <div className="ccb-card" style={{
      background: 'var(--c-card-bg)',
      borderRadius: '14px',
      border: '1px solid var(--c-border)',
      padding: '14px 16px',
      boxShadow: '0 2px 8px var(--c-shadow)',
      display: 'flex', flexDirection: 'column', gap: '8px',
      height: '100%', justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
          <span style={{ fontSize: '14px' }}>📊</span>
          <span style={{
            fontSize: '10px', fontWeight: 700, color: 'var(--c-text-3)',
            letterSpacing: '.4px', textTransform: 'uppercase',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {item.event} {item.current.year} vs {item.previous.year}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
          {HISTORICAL_COMPARISON.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: i === idx ? 'var(--c-accent)' : 'var(--c-border)',
                border: 'none', cursor: 'pointer', padding: 0,
              }}
            />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, justifyContent: 'center' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '7px 10px', background: 'var(--c-surface)', borderRadius: '8px',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '10px', color: 'var(--c-text-4)', fontWeight: 600 }}>Resultados</span>
            <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--c-text-1)', lineHeight: 1.1 }}>
              {item.current.results} <span style={{ fontSize: '10px', fontWeight: 500, color: 'var(--c-text-4)' }}>vs {item.previous.results}</span>
            </span>
          </div>
          <span style={{
            padding: '3px 8px', borderRadius: '6px',
            background: resultsDelta >= 0 ? '#DCFCE7' : '#FEE2E2',
            color: resultsDelta >= 0 ? '#16A34A' : '#DC2626',
            fontSize: '11px', fontWeight: 800,
          }}>
            {resultsDelta >= 0 ? '▲' : '▼'} {Math.abs(resultsDelta).toFixed(1)}%
          </span>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '7px 10px', background: 'var(--c-surface)', borderRadius: '8px',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '10px', color: 'var(--c-text-4)', fontWeight: 600 }}>Custo por resultado</span>
            <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--c-text-1)', lineHeight: 1.1 }}>
              R$ {item.current.cpr.toFixed(2).replace('.', ',')} <span style={{ fontSize: '10px', fontWeight: 500, color: 'var(--c-text-4)' }}>vs R$ {item.previous.cpr.toFixed(2).replace('.', ',')}</span>
            </span>
          </div>
          <span style={{
            padding: '3px 8px', borderRadius: '6px',
            background: cprDelta <= 0 ? '#DCFCE7' : '#FEE2E2',
            color: cprDelta <= 0 ? '#16A34A' : '#DC2626',
            fontSize: '11px', fontWeight: 800,
          }}>
            {cprDelta <= 0 ? '▼' : '▲'} {Math.abs(cprDelta).toFixed(1)}%
          </span>
        </div>
      </div>

      <button
        onClick={onViewCalendar}
        style={{
          background: 'none', border: '1.5px solid var(--c-border)',
          color: 'var(--c-text-2)', borderRadius: '8px',
          padding: '6px', fontSize: '10.5px', fontWeight: 700, cursor: 'pointer',
        }}
      >
        Ver todas as datas comerciais
      </button>
    </div>
  );
}

/* ── Card alerta CPC alto ── */
function CpcAlertCard({ ads, avg, onOpenAds }) {
  if (!ads.length) {
    return (
      <div className="ccb-card" style={{
        background: 'var(--c-card-bg)',
        borderRadius: '14px',
        border: '1px solid var(--c-border)',
        padding: '14px 16px',
        boxShadow: '0 2px 8px var(--c-shadow)',
        display: 'flex', flexDirection: 'column', gap: '8px',
        height: '100%', justifyContent: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '14px' }}>✅</span>
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#16A34A', letterSpacing: '.4px', textTransform: 'uppercase' }}>
            CPC saudável
          </span>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--c-text-2)', lineHeight: 1.4 }}>
          Todos os anúncios dentro da média (R$ {avg.toFixed(2).replace('.', ',')}/clique).
        </div>
      </div>
    );
  }

  return (
    <div className="ccb-card" style={{
      background: 'var(--c-card-bg)',
      borderRadius: '14px',
      border: '1px solid #FCA5A5',
      padding: '14px 16px',
      boxShadow: '0 2px 8px var(--c-shadow)',
      display: 'flex', flexDirection: 'column', gap: '8px',
      height: '100%', justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '14px' }}>🚨</span>
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#DC2626', letterSpacing: '.4px', textTransform: 'uppercase' }}>
            CPC acima da média
          </span>
        </div>
        <span style={{
          background: '#FEE2E2', color: '#DC2626',
          padding: '2px 7px', borderRadius: '10px',
          fontSize: '10px', fontWeight: 700,
        }}>
          {ads.length} {ads.length === 1 ? 'anúncio' : 'anúncios'}
        </span>
      </div>

      <div style={{ fontSize: '11px', color: 'var(--c-text-3)' }}>
        Média: <strong style={{ color: 'var(--c-text-1)' }}>R$ {avg.toFixed(2).replace('.', ',')}</strong>/clique
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
        {ads.slice(0, 2).map(ad => (
          <div key={ad.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: '#FEF2F2', borderRadius: '7px', padding: '6px 9px',
          }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--c-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ad.name}</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#DC2626', flexShrink: 0, marginLeft: '6px' }}>
              R$ {ad.cpc.toFixed(2).replace('.', ',')}
            </span>
          </div>
        ))}
      </div>

      <button
        onClick={onOpenAds}
        style={{
          background: 'none', border: '1.5px solid var(--c-accent)',
          color: 'var(--c-accent)', borderRadius: '8px',
          padding: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
        }}
      >
        Ver e otimizar
      </button>
    </div>
  );
}

/* ── Dashboard ── */
export default function Dashboard() {
  const navigate = useNavigate();
  const [chartMetric, setChartMetric] = useState('Resultados');
  const { funds, lowBalance, LOW_BALANCE_THRESHOLD } = useAppState();

  return (
    <div className="page-container">

      {/* ── Cabeçalho ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--c-text-1)', marginBottom: '4px' }}>
            Bom dia, Cris! 👋
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--c-text-3)' }}>
            Aqui está o desempenho dos seus anúncios hoje.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', borderRadius: '10px',
            border: '1.5px solid var(--c-border)', background: 'var(--c-card-bg)',
            fontSize: '12px', fontWeight: 500, color: 'var(--c-text-2)', cursor: 'pointer',
          }}>
            <CalendarIcon2 />
            Hoje, 14 de abril
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <button style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', borderRadius: '10px',
            border: '1.5px solid var(--c-border)', background: 'var(--c-card-bg)',
            fontSize: '12px', fontWeight: 500, color: 'var(--c-text-2)', cursor: 'pointer',
          }}>
            <RefreshIcon />
            Comparar período
          </button>
        </div>
      </div>

      {/* ── Cards de métricas ── */}
      <div className="metric-grid" style={{ marginBottom: '20px' }}>
        {MOCK_METRICS.map(m => (
          <MetricCard key={m.label} {...m} />
        ))}
      </div>

      {/* ── Linha: saldo + alerta CPC + histórico comparativo ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '16px',
        marginBottom: '20px',
      }}>
        <BalanceCard
          funds={funds}
          lowBalance={lowBalance}
          threshold={LOW_BALANCE_THRESHOLD}
          onAdd={() => navigate('/investimento')}
        />
        <CpcAlertCard
          ads={HIGH_CPC_ADS}
          avg={AVG_CPC}
          onOpenAds={() => navigate('/anuncios')}
        />
        <HistoricalComparisonCard onViewCalendar={() => navigate('/calendario')} />
      </div>

      {/* ── Gráfico (largura total) ── */}
      <div style={{ marginBottom: '20px' }}>
        <div className="ccb-card" style={{
          background: 'var(--c-card-bg)',
          borderRadius: '16px',
          border: '1px solid var(--c-border)',
          padding: '20px 24px 16px',
          boxShadow: '0 2px 8px var(--c-shadow)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '3px' }}>
                Resultados ao longo do tempo
              </div>
              <div style={{ fontSize: '11px', color: 'var(--c-text-4)' }}>
                Acompanhe a evolução dos seus anúncios
              </div>
            </div>
            <select
              value={chartMetric}
              onChange={e => setChartMetric(e.target.value)}
              style={{
                padding: '6px 10px', borderRadius: '8px',
                border: '1.5px solid var(--c-border)', background: 'var(--c-surface)',
                fontSize: '12px', color: 'var(--c-text-2)', cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {['Resultados','Cliques','Investimento'].map(opt => (
                <option key={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <LineChart data={CHART_DATA} />
        </div>
      </div>

      {/* ── Calendário mini (largura total) ── */}
      <div style={{
        background: 'var(--c-card-bg)',
        borderRadius: '16px',
        border: '1px solid var(--c-border)',
        padding: '20px 24px',
        boxShadow: '0 2px 8px var(--c-shadow)',
      }}>
        <MiniCalendar onViewFull={() => navigate('/calendario')} />
      </div>
    </div>
  );
}
