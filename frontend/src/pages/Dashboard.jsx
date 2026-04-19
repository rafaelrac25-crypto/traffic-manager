/**
 * IMPORTANT:
 * All displayed data is fictional placeholder data.
 * Real data will be loaded later from Meta Ads API.
 * Do not persist mock values.
 */

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../contexts/AppStateContext';
import { getUpcomingCommercialDates } from '../data/commercialDates';
import { globalRingPerformance } from '../data/performanceMock';

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

/* Dados do gráfico — 7 dias, um dataset por métrica */
const CHART_DATASETS = {
  Resultados: {
    unit: 'resultados',
    data: [
      { label: '08 Abr', value: 82 },
      { label: '09 Abr', value: 95 },
      { label: '10 Abr', value: 72 },
      { label: '11 Abr', value: 118 },
      { label: '12 Abr', value: 166 },
      { label: '13 Abr', value: 148 },
      { label: '14 Abr', value: 158 },
    ],
  },
  Cliques: {
    unit: 'cliques',
    data: [
      { label: '08 Abr', value: 612 },
      { label: '09 Abr', value: 748 },
      { label: '10 Abr', value: 530 },
      { label: '11 Abr', value: 891 },
      { label: '12 Abr', value: 1204 },
      { label: '13 Abr', value: 1087 },
      { label: '14 Abr', value: 1156 },
    ],
  },
  Investimento: {
    unit: 'reais',
    data: [
      { label: '08 Abr', value: 40 },
      { label: '09 Abr', value: 45 },
      { label: '10 Abr', value: 35 },
      { label: '11 Abr', value: 60 },
      { label: '12 Abr', value: 85 },
      { label: '13 Abr', value: 75 },
      { label: '14 Abr', value: 80 },
    ],
  },
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
function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/>
    </svg>
  );
}
/* ── Gráfico de duas linhas (Investimento + Cliques) com escalas independentes ── */
function DualLineChart({ series }) {
  const W = 540, H = 200;
  const padL = 40, padR = 20, padT = 20, padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const svgRef = useRef(null);

  const length = series[0]?.data.length || 0;
  const [cursorFrac, setCursorFrac] = useState(length - 1);
  const [isHovering, setIsHovering] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  /* Cada série é normalizada para seu próprio máximo */
  const normalized = series.map(s => {
    const max = Math.max(...s.data.map(d => d.value)) * 1.1 || 1;
    const pts = s.data.map((d, i) => ({
      x: padL + (i / (length - 1)) * plotW,
      y: padT + plotH - (d.value / max) * plotH,
      ...d,
    }));
    return { ...s, max, pts };
  });

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

  function updateCursor(clientX) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const svgX = ((clientX - rect.left) / rect.width) * W;
    const frac = Math.max(0, Math.min(length - 1, ((svgX - padL) / plotW) * (length - 1)));
    setCursorFrac(frac);
    setIsHovering(true);
  }

  const i0 = Math.floor(cursorFrac);
  const i1 = Math.min(length - 1, i0 + 1);
  const lerpT = cursorFrac - i0;
  const activeX = normalized[0]?.pts[i0]?.x + (normalized[0]?.pts[i1]?.x - normalized[0]?.pts[i0]?.x) * lerpT;
  const activeLabel = normalized[0]?.pts[Math.round(cursorFrac)]?.label || '';
  const activeValues = normalized.map(s => ({
    name: s.name,
    color: s.color,
    unit: s.unit,
    value: Math.round(s.data[i0].value + (s.data[i1].value - s.data[i0].value) * lerpT),
    y: s.pts[i0].y + (s.pts[i1].y - s.pts[i0].y) * lerpT,
  }));

  const TOOLTIP_W = 130;
  const TOOLTIP_H = 52;
  const tooltipCenterX = Math.max(padL + TOOLTIP_W/2, Math.min(W - padR - TOOLTIP_W/2, activeX));
  const tooltipY = Math.max(4, Math.min(...activeValues.map(v => v.y)) - TOOLTIP_H - 10);

  return (
    <>
      {/* Legenda */}
      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '8px' }}>
        {series.map(s => (
          <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '16px', height: '3px', borderRadius: '2px', background: s.color, display: 'inline-block' }} />
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--c-text-2)' }}>{s.name}</span>
          </div>
        ))}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: 'block', overflow: 'visible', cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none', userSelect: 'none' }}
        onMouseMove={e => updateCursor(e.clientX)}
        onMouseDown={e => { setIsDragging(true); updateCursor(e.clientX); }}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => { setIsHovering(false); setIsDragging(false); }}
        onTouchStart={e => { setIsDragging(true); const t = e.touches[0]; if (t) updateCursor(t.clientX); }}
        onTouchMove={e => { const t = e.touches[0]; if (t) updateCursor(t.clientX); }}
        onTouchEnd={() => setIsDragging(false)}
      >
        {/* Grid horizontal */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => {
          const y = padT + plotH - t * plotH;
          return <line key={t} x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--c-border-lt)" strokeWidth="1" strokeDasharray="4,4"/>;
        })}

        {/* Linhas + área suave de cada série */}
        {normalized.map(s => (
          <g key={s.name}>
            <path d={smoothPath(s.pts)} fill="none" stroke={s.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            {s.pts.map((pt, i) => {
              const dist = Math.abs(i - cursorFrac);
              const weight = Math.max(0, 1 - dist);
              return (
                <circle key={i} cx={pt.x} cy={pt.y} r={2 + weight * 1.5} fill="#fff" stroke={s.color} strokeWidth={1.5 + weight * 0.6} />
              );
            })}
          </g>
        ))}

        {/* Labels do eixo X */}
        {normalized[0]?.pts.map((pt, i) => (
          <text key={i} x={pt.x} y={H - 4} fontSize="9" fill="var(--c-text-4)" textAnchor="middle">
            {pt.label}
          </text>
        ))}

        {/* Cursor vertical */}
        <line
          x1={activeX} y1={padT}
          x2={activeX} y2={padT + plotH}
          stroke="var(--c-text-4)" strokeWidth="1" strokeDasharray="3,3"
          opacity={isHovering ? 0.6 : 0.3}
        />

        {/* Pontos ativos em cada linha */}
        {activeValues.map(v => (
          <circle key={v.name} cx={activeX} cy={v.y} r={5} fill={v.color} stroke="#fff" strokeWidth="2" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.2))' }} />
        ))}

        {/* Tooltip com as 2 séries */}
        <g style={{ pointerEvents: 'none' }}>
          <rect
            x={tooltipCenterX - TOOLTIP_W/2}
            y={tooltipY}
            width={TOOLTIP_W}
            height={TOOLTIP_H}
            rx="8"
            fill="var(--c-text-1)"
            style={{ filter: 'drop-shadow(0 3px 8px rgba(0,0,0,.18))' }}
          />
          <text x={tooltipCenterX} y={tooltipY + 13} fontSize="8.5" fill="#fff" textAnchor="middle" fontWeight="600" opacity="0.75" style={{ letterSpacing: '.4px', textTransform: 'uppercase' }}>
            {activeLabel}
          </text>
          {activeValues.map((v, idx) => (
            <g key={v.name}>
              <circle cx={tooltipCenterX - TOOLTIP_W/2 + 10} cy={tooltipY + 26 + idx * 12} r="3" fill={v.color} />
              <text x={tooltipCenterX - TOOLTIP_W/2 + 18} y={tooltipY + 29 + idx * 12} fontSize="10" fill="#fff" fontWeight="600">
                {v.name}:
                <tspan fontWeight="700" dx="4">{v.unit === 'reais' ? 'R$\u00A0' : ''}{v.value.toLocaleString('pt-BR')}</tspan>
                <tspan fontSize="8.5" fontWeight="500" opacity="0.75" dx="3">{v.unit !== 'reais' ? v.unit : ''}</tspan>
              </text>
            </g>
          ))}
        </g>
      </svg>
    </>
  );
}

/* ── Gráfico de linha SVG (interativo com slide suave) ── */
function LineChart({ data, unit = 'resultados' }) {
  const W = 540, H = 190;
  const padL = 40, padR = 20, padT = 52, padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const maxVal = Math.max(200, Math.ceil(Math.max(...data.map(d => d.value)) / 50) * 50);
  const svgRef = useRef(null);

  /* Posição fracionária no eixo X (0 a data.length-1). Começa no último ponto. */
  const [cursorFrac, setCursorFrac] = useState(data.length - 1);
  const [isHovering, setIsHovering] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

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

  function updateCursor(clientX) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const svgX = ((clientX - rect.left) / rect.width) * W;
    const frac = Math.max(0, Math.min(data.length - 1,
      ((svgX - padL) / plotW) * (data.length - 1)
    ));
    setCursorFrac(frac);
    setIsHovering(true);
  }

  function handleMouseMove(e) { updateCursor(e.clientX); }
  function handleMouseDown(e) { setIsDragging(true); updateCursor(e.clientX); }
  function handleMouseUp() { setIsDragging(false); }
  function handleTouchStart(e) {
    setIsDragging(true);
    const t = e.touches[0]; if (t) updateCursor(t.clientX);
  }
  function handleTouchMove(e) {
    const t = e.touches[0]; if (t) updateCursor(t.clientX);
  }
  function handleTouchEnd() { setIsDragging(false); }

  /* Interpolação suave entre dots */
  const i0 = Math.floor(cursorFrac);
  const i1 = Math.min(data.length - 1, i0 + 1);
  const lerpT = cursorFrac - i0;
  const activeX = pts[i0].x + (pts[i1].x - pts[i0].x) * lerpT;
  const activeY = pts[i0].y + (pts[i1].y - pts[i0].y) * lerpT;
  const activeValue = Math.round(pts[i0].value + (pts[i1].value - pts[i0].value) * lerpT);
  const showInterpolated = lerpT >= 0.18 && lerpT <= 0.82 && i0 !== i1;
  const activeLabel = showInterpolated
    ? `${pts[i0].label} → ${pts[i1].label}`
    : (lerpT < 0.5 ? pts[i0].label : pts[i1].label);

  const TOOLTIP_W = showInterpolated ? 96 : 78;
  const TOOLTIP_H = 36;
  const tooltipCenterX = Math.max(padL + TOOLTIP_W/2, Math.min(W - padR - TOOLTIP_W/2, activeX));
  const tooltipY = Math.max(4, activeY - TOOLTIP_H - 12);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{
        display: 'block', overflow: 'visible',
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        userSelect: 'none',
      }}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { setIsHovering(false); setIsDragging(false); }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
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

      <path d={fillPath} fill="url(#chartFill)"/>
      <path d={linePath} fill="none" stroke="url(#chartLine)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter="url(#chartGlow)"/>

      {pts.map((pt, i) => {
        const dist = Math.abs(i - cursorFrac);
        const isNear = dist < 0.5;
        return (
          <text
            key={`lbl-${i}`}
            x={pt.x}
            y={H - 4}
            fontSize="9"
            fill={isNear ? '#d68d8f' : 'var(--c-text-4)'}
            fontWeight={isNear ? 700 : 400}
            textAnchor="middle"
            style={{ transition: 'fill .18s ease' }}
          >
            {pt.label}
          </text>
        );
      })}

      {pts.map((pt, i) => {
        const dist = Math.abs(i - cursorFrac);
        const weight = Math.max(0, 1 - dist); /* 1 no dot, 0 a 1 unidade de distância */
        return (
          <circle
            key={`dot-${i}`}
            cx={pt.x}
            cy={pt.y}
            r={2.5 + weight * 1.5}
            fill="#fff"
            stroke="#d68d8f"
            strokeWidth={1.5 + weight * 0.6}
          />
        );
      })}

      {/* Linha vertical vai suave porque activeX desliza por interpolação */}
      <line
        x1={activeX} y1={padT}
        x2={activeX} y2={padT + plotH}
        stroke="#d68d8f"
        strokeWidth="1"
        strokeDasharray="3,3"
        opacity={isHovering ? 0.75 : 0.4}
        style={{ transition: 'opacity .18s ease' }}
      />

      {/* Active point (desliza ao longo da linha) */}
      <circle
        cx={activeX}
        cy={activeY}
        r={showInterpolated ? 5 : 6}
        fill="#d68d8f"
        stroke="#fff"
        strokeWidth="2.5"
        style={{ filter: 'drop-shadow(0 2px 6px rgba(214,141,143,.45))' }}
      />

      {/* Tooltip refinado — compacto, tipografia leve, sombra suave */}
      <g style={{ pointerEvents: 'none' }}>
        <rect
          x={tooltipCenterX - TOOLTIP_W/2}
          y={tooltipY}
          width={TOOLTIP_W}
          height={TOOLTIP_H}
          rx="8"
          fill="#d68d8f"
          style={{ filter: 'drop-shadow(0 3px 8px rgba(214,141,143,.28))' }}
        />
        {/* Flecha discreta abaixo do retângulo */}
        <path
          d={`M ${activeX - 3.5} ${tooltipY + TOOLTIP_H - 0.5} L ${activeX} ${tooltipY + TOOLTIP_H + 4} L ${activeX + 3.5} ${tooltipY + TOOLTIP_H - 0.5} Z`}
          fill="#d68d8f"
        />
        <text
          x={tooltipCenterX}
          y={tooltipY + 13.5}
          fontSize="8.5"
          fill="white"
          textAnchor="middle"
          fontWeight="600"
          opacity="0.78"
          style={{ letterSpacing: '.4px', textTransform: 'uppercase' }}
        >
          {activeLabel}
        </text>
        <text
          x={tooltipCenterX}
          y={tooltipY + 27}
          fontSize="11.5"
          fill="white"
          textAnchor="middle"
          fontWeight="700"
        >
          {activeValue}
          <tspan fontSize="8.5" fontWeight="500" opacity="0.72" dx="2.5">{unit}</tspan>
        </text>
      </g>
    </svg>
  );
}

/* ── Calendário mini ── */
function MiniCalendar({ onViewFull, onPickCommercialDate }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const commercialMap = useMemo(() => {
    const upcoming = getUpcomingCommercialDates(today, 45);
    const map = {};
    upcoming.forEach(entry => {
      if (entry.date.getFullYear() === year && entry.date.getMonth() === month) {
        map[entry.date.getDate()] = entry;
      }
    });
    return map;
  }, [year, month]);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--c-text-1)' }}>Datas comerciais</span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--c-accent)' }}>
            {MONTHS[month]} {year}
          </span>
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
        {Array.from({ length: firstDay }).map((_, i) => {
          const prevDay = new Date(year, month, 0).getDate() - firstDay + i + 1;
          return (
            <div key={`prev-${i}`} style={{ textAlign: 'center', padding: '5px 2px', fontSize: '11px', color: 'var(--c-text-4)', opacity: 0.4 }}>{prevDay}</div>
          );
        })}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const isToday = day === today.getDate();
          const entry = commercialMap[day];
          const hasEvent = !!entry;

          return (
            <div
              key={day}
              onClick={() => hasEvent && onPickCommercialDate(entry)}
              style={{
                textAlign: 'center',
                padding: '4px 2px',
                borderRadius: '6px',
                position: 'relative',
                cursor: hasEvent ? 'pointer' : 'default',
                transition: 'background .15s',
              }}
              onMouseEnter={e => { if (hasEvent) e.currentTarget.style.background = 'var(--c-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              title={hasEvent ? `${entry.name} — clique para abrir estratégia` : undefined}
            >
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
              {hasEvent && (
                <div style={{ marginTop: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px', justifyContent: 'center' }}>
                    <span style={{ fontSize: '10px', lineHeight: 1 }}>{entry.emoji}</span>
                    <span style={{ fontSize: '8px', color: 'var(--c-accent)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '50px' }}>
                      {entry.name}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legenda */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '12px' }}>🗓️</span>
          <span style={{ fontSize: '10px', color: 'var(--c-text-3)' }}>Data comercial — clique para estratégia</span>
        </div>
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
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--c-text-1)', lineHeight: 1.1 }}>
            {value}
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
            {trendUp ? <ArrowUp color="#22C55E" /> : <ArrowDown color="#EF4444" />}
            <span style={{ fontSize: '10px', fontWeight: 700, color: trendUp ? '#22C55E' : '#EF4444' }}>{trend}</span>
          </div>
          {sub && (
            <span style={{ fontSize: '10px', color: 'var(--c-text-4)', fontWeight: 500 }}>
              {sub}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Mock de CPC por anúncio ativo (até integração Meta Ads) ── */
const MOCK_CPC = [
  { id: 1, name: 'Limpeza de Pele Profunda', cpc: 0.92 },
  { id: 2, name: 'Micropigmentação Labial',  cpc: 1.86 },
  { id: 3, name: 'Lash Lifting + Brow',      cpc: 1.08 },
  { id: 5, name: 'Remarketing Glow Lips',    cpc: 0.78 },
];

/**
 * Benchmark de CPC do ramo de ESTÉTICA FACIAL AVANÇADA.
 * Referência: micropigmentação (labial, sobrancelhas), extensão de cílios,
 * lash lifting, brow lamination, glow lips, limpeza de pele, microagulhamento.
 * NÃO representa salão de beleza generalista — procedimentos com ticket médio
 * mais alto e público qualificado tendem a ter CPC nesta faixa.
 * Mercado BR, Meta Ads, 2026. Atualizar quando integrar API real.
 */
const CPC_BENCHMARK_ESTETICA_FACIAL = 1.20;
const CPC_BENCHMARK_LABEL = 'Estética facial avançada';
const HIGH_CPC_THRESHOLD = CPC_BENCHMARK_ESTETICA_FACIAL * 1.3;
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
        <div style={{ fontSize: '22px', fontWeight: 700, color: lowBalance ? '#DC2626' : 'var(--c-text-1)', lineHeight: 1 }}>
          R$ {funds.toFixed(2).replace('.', ',')}
        </div>
        <div style={{ fontSize: '10px', color: 'var(--c-text-4)', marginTop: '3px' }}>
          {lowBalance ? `Abaixo do mínimo de R$\u00A0${threshold},00` : 'Disponível para veicular anúncios'}
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

/* ── Teaser de desempenho por anel (últimos 7 dias) ── */
function RingPerformanceTeaser({ ads, onOpen }) {
  const perf = useMemo(() => globalRingPerformance(ads, { daysActive: 7 }), [ads]);
  const hasData = perf.adCount > 0 && perf.best;

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '14px' }}>🏆</span>
          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--c-text-3)', letterSpacing: '.4px', textTransform: 'uppercase' }}>
            Melhor anel (7d)
          </span>
        </div>
        {hasData && (
          <span style={{
            background: `${perf.best.color}22`, color: perf.best.color,
            padding: '2px 7px', borderRadius: '10px',
            fontSize: '10px', fontWeight: 700,
          }}>
            {perf.adCount} {perf.adCount === 1 ? 'anúncio' : 'anúncios'}
          </span>
        )}
      </div>

      {hasData ? (
        <>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: perf.best.color, lineHeight: 1.2, marginBottom: '2px' }}>
              {perf.best.shortLabel}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--c-text-3)' }}>
              CPR <strong style={{ color: 'var(--c-text-1)' }}>R$ {perf.best.cpr.toFixed(2).replace('.', ',')}</strong> · {perf.best.conversions} conversões
            </div>
          </div>
          <button
            onClick={onOpen}
            style={{
              background: 'none', border: '1.5px solid var(--c-accent)',
              color: 'var(--c-accent)', borderRadius: '8px',
              padding: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
            }}
          >
            Ver relatório completo
          </button>
        </>
      ) : (
        <>
          <div style={{ fontSize: '12px', color: 'var(--c-text-3)', lineHeight: 1.5 }}>
            Publique um anúncio com <strong>split por anel</strong> para comparar performance por região.
          </div>
          <button
            onClick={onOpen}
            style={{
              background: 'none', border: '1.5px solid var(--c-border)',
              color: 'var(--c-text-3)', borderRadius: '8px',
              padding: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Abrir Desempenho
          </button>
        </>
      )}
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
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--c-text-1)', lineHeight: 1.1 }}>
              {item.current.results} <span style={{ fontSize: '10px', fontWeight: 500, color: 'var(--c-text-4)' }}>vs {item.previous.results}</span>
            </span>
          </div>
          <span style={{
            padding: '3px 8px', borderRadius: '6px',
            background: resultsDelta >= 0 ? '#DCFCE7' : '#FEE2E2',
            color: resultsDelta >= 0 ? '#16A34A' : '#DC2626',
            fontSize: '11px', fontWeight: 700,
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
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--c-text-1)', lineHeight: 1.1 }}>
              R$ {item.current.cpr.toFixed(2).replace('.', ',')} <span style={{ fontSize: '10px', fontWeight: 500, color: 'var(--c-text-4)' }}>vs R$ {item.previous.cpr.toFixed(2).replace('.', ',')}</span>
            </span>
          </div>
          <span style={{
            padding: '3px 8px', borderRadius: '6px',
            background: cprDelta <= 0 ? '#DCFCE7' : '#FEE2E2',
            color: cprDelta <= 0 ? '#16A34A' : '#DC2626',
            fontSize: '11px', fontWeight: 700,
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
function CpcAlertCard({ ads, benchmark, benchmarkLabel, onOpenAds }) {
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
          Todos os anúncios dentro do benchmark do ramo ({benchmarkLabel}: R$ {benchmark.toFixed(2).replace('.', ',')}/clique).
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
            CPC acima do ramo
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

      <div style={{ fontSize: '11px', color: 'var(--c-text-3)', lineHeight: 1.45 }}>
        Benchmark <strong style={{ color: 'var(--c-text-2)' }}>{benchmarkLabel}</strong>:{' '}
        <strong style={{ color: 'var(--c-text-1)' }}>R$ {benchmark.toFixed(2).replace('.', ',')}</strong>/clique
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
const MESES_PT = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
function saudacaoPorHora() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { funds, lowBalance, LOW_BALANCE_THRESHOLD, ads } = useAppState();

  const hoje = new Date();
  const labelHoje = `Hoje, ${hoje.getDate()} de ${MESES_PT[hoje.getMonth()]}`;
  const saudacao = saudacaoPorHora();

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const horaAgora = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="page-container">

      {/* ── Cabeçalho ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '4px' }}>
            {saudacao}, Cris! 👋
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--c-text-3)' }}>
            Aqui está o desempenho dos seus anúncios hoje.
          </p>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '8px 14px', borderRadius: '10px',
          border: '1.5px solid var(--c-border)', background: 'var(--c-card-bg)',
          fontSize: '12px', fontWeight: 500, color: 'var(--c-text-2)',
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <CalendarIcon2 />
            {labelHoje}
          </span>
          <span style={{
            width: '1px', height: '14px', background: 'var(--c-border)',
            margin: '0 12px',
          }} />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontVariantNumeric: 'tabular-nums' }}>
            <ClockIcon />
            {horaAgora}
          </span>
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
          benchmark={CPC_BENCHMARK_ESTETICA_FACIAL}
          benchmarkLabel={CPC_BENCHMARK_LABEL}
          onOpenAds={() => navigate('/anuncios')}
        />
        <RingPerformanceTeaser ads={ads} onOpen={() => navigate('/desempenho')} />
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
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '3px' }}>
              Resultados ao longo do tempo
            </div>
            <div style={{ fontSize: '11px', color: 'var(--c-text-4)' }}>
              Investimento × Cliques — últimos 7 dias
            </div>
          </div>
          <DualLineChart
            series={[
              { name: 'Investimento', color: '#d68d8f', unit: 'reais', data: CHART_DATASETS.Investimento.data },
              { name: 'Cliques',      color: '#3B82F6', unit: 'cliques', data: CHART_DATASETS.Cliques.data },
            ]}
          />
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
        <MiniCalendar
          onViewFull={() => navigate('/calendario')}
          onPickCommercialDate={(entry) => navigate('/calendario', { state: { openCommercialKey: entry.key } })}
        />
      </div>
    </div>
  );
}
