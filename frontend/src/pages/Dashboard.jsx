import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../contexts/AppStateContext';
import { getUpcomingCommercialDates } from '../data/commercialDates';
import { globalRingPerformance } from '../data/performanceMock';
import RingRecommendation from '../components/RingRecommendation';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const WEEK_DAYS_SHORT = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'];

const fmtBRL = (v) => `R$\u00A0${Number(v || 0).toFixed(2).replace('.', ',')}`;

/* Campanhas "no ar" = status que ainda consome ou está pronta pra consumir
   verba (active, paused, review). Ordenadas da melhor pra pior. */
function rankLiveCampaigns(ads) {
  const live = ads.filter(a => a.status === 'active' || a.status === 'paused' || a.status === 'review');
  return [...live].sort((a, b) => {
    const aActive = a.status === 'active' ? 0 : 1;
    const bActive = b.status === 'active' ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    const aConv = Number(a.conversions || a.results || 0);
    const bConv = Number(b.conversions || b.results || 0);
    const aCpr = aConv > 0 ? Number(a.spent || 0) / aConv : Infinity;
    const bCpr = bConv > 0 ? Number(b.spent || 0) / bConv : Infinity;
    if (aCpr !== bCpr) return aCpr - bCpr;
    return Number(b.clicks || 0) - Number(a.clicks || 0);
  });
}

function computeCampaignMetrics(ad) {
  const spent = Number(ad?.spent || 0);
  const clicks = Number(ad?.clicks || 0);
  const conversions = Number(ad?.conversions || ad?.results || 0);
  const cpr = conversions > 0 ? spent / conversions : 0;
  return [
    { label: 'Investimento',        value: fmtBRL(spent),                       icon: <WalletIcon />, iconBg: '#FDF0F8', iconColor: '#d68d8f' },
    { label: 'Cliques',             value: clicks.toLocaleString('pt-BR'),      icon: <CursorIcon />, iconBg: '#EFF6FF', iconColor: '#3B82F6' },
    { label: 'Resultados',          value: conversions.toLocaleString('pt-BR'), icon: <ResultIcon />, iconBg: '#F0FDF4', iconColor: '#22C55E' },
    { label: 'Custo por resultado', value: conversions > 0 ? fmtBRL(cpr) : '—', icon: <DollarIcon />, iconBg: '#FFF7ED', iconColor: '#F97316' },
  ];
}

const CAMPAIGN_STATUS_LABEL = {
  active: { label: 'No ar', color: '#16A34A', bg: '#DCFCE7' },
  paused: { label: 'Pausada', color: '#B45309', bg: '#FEF3C7' },
  review: { label: 'Em revisão', color: '#2563EB', bg: '#DBEAFE' },
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
  const W = 540, H = 160;
  const padL = 34, padR = 14, padT = 10, padB = 22;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const svgRef = useRef(null);

  const length = series[0]?.data.length || 0;
  const [cursorFrac, setCursorFrac] = useState(length - 1);
  const [isHovering, setIsHovering] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  /* Cada série normalizada para seu próprio máximo (com 10% de folga no topo) */
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
  function areaPath(points) {
    const lp = smoothPath(points);
    const last = points[points.length - 1];
    const first = points[0];
    return `${lp} L ${last.x},${padT + plotH} L ${first.x},${padT + plotH} Z`;
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

  const TOOLTIP_W = 128;
  const TOOLTIP_H = 48;
  const tooltipCenterX = Math.max(padL + TOOLTIP_W/2, Math.min(W - padR - TOOLTIP_W/2, activeX));
  const tooltipY = Math.max(4, Math.min(...activeValues.map(v => v.y)) - TOOLTIP_H - 8);

  /* Cores de degradê por série */
  const gradients = {
    '#d68d8f': { from: '#E879A8', to: '#d68d8f' },
    '#3B82F6': { from: '#60A5FA', to: '#2563EB' },
  };

  return (
    <>
      {/* Legenda inline, compacta */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '6px', padding: '0 2px' }}>
        {series.map(s => (
          <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              width: '14px', height: '2.5px', borderRadius: '2px',
              background: `linear-gradient(90deg, ${gradients[s.color]?.from || s.color}, ${gradients[s.color]?.to || s.color})`,
            }} />
            <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--c-text-3)' }}>{s.name}</span>
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
        <defs>
          {series.map(s => {
            const g = gradients[s.color] || { from: s.color, to: s.color };
            return (
              <React.Fragment key={s.name}>
                <linearGradient id={`line-${s.name}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%"   stopColor={g.from}/>
                  <stop offset="100%" stopColor={g.to}/>
                </linearGradient>
                <linearGradient id={`fill-${s.name}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={s.color} stopOpacity="0.18"/>
                  <stop offset="100%" stopColor={s.color} stopOpacity="0"/>
                </linearGradient>
              </React.Fragment>
            );
          })}
        </defs>

        {/* Grid horizontal muito sutil */}
        {[0, 0.5, 1].map(t => {
          const y = padT + plotH - t * plotH;
          return <line key={t} x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--c-border-lt)" strokeWidth="1" strokeDasharray="3,5" opacity="0.6"/>;
        })}

        {/* Áreas suaves (fill) embaixo de cada linha */}
        {normalized.map(s => (
          <path key={`fill-${s.name}`} d={areaPath(s.pts)} fill={`url(#fill-${s.name})`} />
        ))}

        {/* Linhas com degradê + pontos */}
        {normalized.map(s => (
          <g key={s.name}>
            <path
              d={smoothPath(s.pts)}
              fill="none"
              stroke={`url(#line-${s.name})`}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {s.pts.map((pt, i) => {
              const dist = Math.abs(i - cursorFrac);
              const weight = Math.max(0, 1 - dist);
              return (
                <circle key={i} cx={pt.x} cy={pt.y} r={1.8 + weight * 1.4} fill="#fff" stroke={s.color} strokeWidth={1.3 + weight * 0.5} />
              );
            })}
          </g>
        ))}

        {/* Labels do eixo X */}
        {normalized[0]?.pts.map((pt, i) => {
          const dist = Math.abs(i - cursorFrac);
          const isNear = dist < 0.5;
          return (
            <text
              key={i}
              x={pt.x}
              y={H - 4}
              fontSize="9"
              fill={isNear ? 'var(--c-text-2)' : 'var(--c-text-4)'}
              fontWeight={isNear ? 600 : 400}
              textAnchor="middle"
              style={{ transition: 'fill .18s' }}
            >
              {pt.label}
            </text>
          );
        })}

        {/* Cursor vertical fino */}
        <line
          x1={activeX} y1={padT}
          x2={activeX} y2={padT + plotH}
          stroke="var(--c-text-4)" strokeWidth="1" strokeDasharray="2,3"
          opacity={isHovering ? 0.45 : 0.2}
          style={{ transition: 'opacity .18s' }}
        />

        {/* Pontos ativos em cada linha */}
        {activeValues.map(v => (
          <circle key={v.name} cx={activeX} cy={v.y} r={4} fill={v.color} stroke="#fff" strokeWidth="1.8" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.18))' }} />
        ))}

        {/* Tooltip com as 2 séries — cor fixa semi-transparente que funciona
            em tema claro e escuro com alto contraste no texto */}
        <g style={{ pointerEvents: 'none' }}>
          <rect
            x={tooltipCenterX - TOOLTIP_W/2}
            y={tooltipY}
            width={TOOLTIP_W}
            height={TOOLTIP_H}
            rx="8"
            fill="rgba(20,22,30,0.88)"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
            style={{ filter: 'drop-shadow(0 4px 10px rgba(0,0,0,.22))', backdropFilter: 'blur(6px)' }}
          />
          <text x={tooltipCenterX} y={tooltipY + 13} fontSize="9" fill="rgba(255,255,255,0.7)" textAnchor="middle" fontWeight="700" style={{ letterSpacing: '.5px', textTransform: 'uppercase' }}>
            {activeLabel}
          </text>
          {activeValues.map((v, idx) => (
            <g key={v.name}>
              <circle cx={tooltipCenterX - TOOLTIP_W/2 + 11} cy={tooltipY + 25 + idx * 12} r="3" fill={v.color} stroke="rgba(255,255,255,0.9)" strokeWidth="0.6" />
              <text x={tooltipCenterX - TOOLTIP_W/2 + 19} y={tooltipY + 28 + idx * 12} fontSize="10" fill="#fff" fontWeight="600">
                {v.name}
                <tspan fontWeight="700" dx="4" fill="#fff">{v.unit === 'reais' ? 'R$\u00A0' : ''}{v.value.toLocaleString('pt-BR')}</tspan>
                <tspan fontSize="8.5" fontWeight="500" fill="rgba(255,255,255,0.7)" dx="3">{v.unit !== 'reais' ? v.unit : ''}</tspan>
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

const CPC_BENCHMARK_ESTETICA_FACIAL = 1.20;
const CPC_BENCHMARK_LABEL = 'Estética facial avançada';
const HIGH_CPC_THRESHOLD = CPC_BENCHMARK_ESTETICA_FACIAL * 1.3;

function computeHighCpcAds(ads) {
  return ads
    .filter(a => a.clicks > 0 && a.spent > 0)
    .map(a => ({ id: a.id, name: a.name, cpc: Number(a.spent) / Number(a.clicks) }))
    .filter(a => a.cpc > HIGH_CPC_THRESHOLD);
}

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
            Abrir Mapa de Calor
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: '14px', flexShrink: 0 }}>📊</span>
          <span style={{
            fontSize: '10px', fontWeight: 700, color: 'var(--c-text-3)',
            letterSpacing: '.4px', textTransform: 'uppercase',
            minWidth: 0,
            lineHeight: 1.3,
          }}>
            {item.event} {item.current.year} vs {item.previous.year}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0, padding: '2px 0' }}>
          {HISTORICAL_COMPARISON.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              aria-label={`Ver item ${i + 1}`}
              style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: i === idx ? 'var(--c-accent)' : 'var(--c-border)',
                border: 'none', cursor: 'pointer', padding: 0,
                transition: 'background .15s, transform .15s',
                transform: i === idx ? 'scale(1.2)' : 'scale(1)',
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

/* ── Performance por anel (dado real do Meta) ──
   Consome GET /api/campaigns/analytics/rings, mostra 3 colunas (primário/médio/externo)
   com investido + conversões + custo por resultado. Destaca o anel com MENOR cpr. */
const RING_VISUAL = {
  primario: { emoji: '🟢', color: '#16A34A', bg: '#DCFCE7', hint: 'perto do salão' },
  medio:    { emoji: '🟡', color: '#CA8A04', bg: '#FEF9C3', hint: 'distância média' },
  externo:  { emoji: '🔴', color: '#DC2626', bg: '#FEE2E2', hint: 'mais longe' },
};

function RingPerformanceCard({ onDataChange, refreshSignal } = {}) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });

  const fetchRings = async () => {
    setState(prev => ({ ...prev, status: prev.data ? 'refetching' : 'loading' }));
    try {
      const res = await fetch('/api/campaigns/analytics/rings');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setState({ status: 'ok', data, error: null });
      if (typeof onDataChange === 'function') onDataChange(data);
    } catch (err) {
      setState(prev => ({ ...prev, status: 'error', error: err?.message || 'fetch failed' }));
      if (typeof onDataChange === 'function') onDataChange(null);
    }
  };

  useEffect(() => {
    fetchRings();
    const id = setInterval(fetchRings, 5 * 60 * 1000); /* refetch a cada 5min */
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Re-fetch externo: quando o pai bumpar refreshSignal (ex: após aplicar
     redistribuição entre anéis), atualiza os dados sem esperar o intervalo. */
  useEffect(() => {
    if (refreshSignal === undefined || refreshSignal === 0) return;
    fetchRings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

  const cardWrap = (children) => (
    <section
      aria-label="Performance por anel de distância"
      className="ccb-card"
      style={{
        background: 'var(--c-card-bg)',
        borderRadius: '16px',
        border: '1px solid var(--c-border)',
        padding: '20px 24px',
        boxShadow: '0 2px 8px var(--c-shadow)',
        marginBottom: '20px',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: '12px', marginBottom: '14px', flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '3px' }}>
            Performance por anel
          </div>
          <div style={{ fontSize: '11px', color: 'var(--c-text-4)' }}>
            Dado real do Meta — qual distância está convertendo melhor
          </div>
        </div>
        <button
          onClick={fetchRings}
          aria-label="Atualizar performance por anel"
          disabled={state.status === 'loading' || state.status === 'refetching'}
          style={{
            background: 'none', border: '1.5px solid var(--c-border)',
            color: 'var(--c-text-3)', borderRadius: '8px',
            padding: '5px 12px', fontSize: '11px', fontWeight: 600,
            cursor: (state.status === 'loading' || state.status === 'refetching') ? 'default' : 'pointer',
            opacity: (state.status === 'loading' || state.status === 'refetching') ? 0.5 : 1,
          }}
        >
          {state.status === 'refetching' ? 'Atualizando…' : 'Atualizar'}
        </button>
      </div>
      {children}
    </section>
  );

  /* Loading skeleton */
  if (state.status === 'loading') {
    return cardWrap(
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '12px',
      }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            background: 'var(--c-surface)', borderRadius: '12px',
            padding: '14px 16px', minHeight: '128px',
            border: '1px solid var(--c-border-lt)',
          }}>
            <div style={{ width: '60%', height: '12px', background: 'var(--c-border)', borderRadius: '4px', marginBottom: '10px', opacity: 0.6 }} />
            <div style={{ width: '40%', height: '10px', background: 'var(--c-border)', borderRadius: '4px', marginBottom: '16px', opacity: 0.45 }} />
            <div style={{ width: '80%', height: '10px', background: 'var(--c-border)', borderRadius: '4px', marginBottom: '6px', opacity: 0.45 }} />
            <div style={{ width: '70%', height: '10px', background: 'var(--c-border)', borderRadius: '4px', marginBottom: '6px', opacity: 0.45 }} />
            <div style={{ width: '85%', height: '10px', background: 'var(--c-border)', borderRadius: '4px', opacity: 0.45 }} />
          </div>
        ))}
      </div>
    );
  }

  /* Erro */
  if (state.status === 'error') {
    return cardWrap(
      <div style={{
        padding: '24px 16px', textAlign: 'center',
        background: '#FEF2F2', borderRadius: '10px',
        border: '1px dashed #FCA5A5',
      }}>
        <div style={{ fontSize: '20px', marginBottom: '6px' }}>⚠️</div>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#B91C1C', marginBottom: '10px' }}>
          Não foi possível carregar performance por anel
        </div>
        <button
          onClick={fetchRings}
          style={{
            background: 'var(--c-accent)', color: '#fff',
            border: 'none', borderRadius: '8px',
            padding: '6px 14px', fontSize: '11px', fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const data = state.data || {};
  const rings = Array.isArray(data.rings) ? data.rings : [];
  const totalSpend = Number(data.total?.spend || 0);
  const isEmpty = data.data_source === 'empty' || totalSpend === 0;

  /* Empty state amigável */
  if (isEmpty) {
    return cardWrap(
      <div style={{
        padding: '28px 16px', textAlign: 'center',
        background: 'var(--c-surface)', borderRadius: '10px',
        border: '1px dashed var(--c-border)',
      }}>
        <div style={{ fontSize: '24px', marginBottom: '6px' }}>⏳</div>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '4px' }}>
          Aguardando primeiros dados
        </div>
        <div style={{ fontSize: '12px', color: 'var(--c-text-3)', maxWidth: '420px', margin: '0 auto', lineHeight: 1.5 }}>
          O Meta libera as informações em torno de <strong>24h</strong> depois que sua campanha começa a entregar.
        </div>
      </div>
    );
  }

  /* Encontra o anel com MENOR cpr (melhor) — só conta se cpr > 0 */
  const ringsWithCpr = rings.filter(r => r && Number(r.cpr) > 0);
  const bestRingKey = ringsWithCpr.length
    ? ringsWithCpr.reduce((best, r) => (Number(r.cpr) < Number(best.cpr) ? r : best)).ring_key
    : null;

  /* Garante a ordem fixa primário → médio → externo, mesmo se o backend mandar fora de ordem */
  const RING_ORDER = ['primario', 'medio', 'externo'];
  const ringsOrdered = RING_ORDER
    .map(key => rings.find(r => r && r.ring_key === key))
    .filter(Boolean);

  return cardWrap(
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: '12px',
    }}>
      {ringsOrdered.map(ring => {
        const visual = RING_VISUAL[ring.ring_key] || { emoji: '⚪', color: 'var(--c-text-3)', bg: 'var(--c-surface)', hint: '' };
        const isBest = ring.ring_key === bestRingKey;
        const conv = Number(ring.conversions || 0);
        const spend = Number(ring.spend || 0);
        const cpr = Number(ring.cpr || 0);

        return (
          <div
            key={ring.ring_key}
            style={{
              background: 'var(--c-card-bg)',
              borderRadius: '12px',
              padding: '14px 16px',
              border: isBest ? `2px solid ${visual.color}` : '1px solid var(--c-border)',
              boxShadow: isBest ? `0 2px 12px ${visual.color}22` : '0 1px 4px var(--c-shadow)',
              display: 'flex', flexDirection: 'column', gap: '10px',
              position: 'relative',
            }}
          >
            {isBest && (
              <div style={{
                position: 'absolute', top: '-10px', right: '12px',
                background: visual.color, color: '#fff',
                fontSize: '10px', fontWeight: 700,
                padding: '3px 9px', borderRadius: '10px',
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                letterSpacing: '.3px',
                boxShadow: `0 2px 6px ${visual.color}55`,
              }}>
                🏆 Melhor retorno
              </div>
            )}

            {/* Cabeçalho do anel */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }} aria-hidden="true">{visual.emoji}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text-1)', lineHeight: 1.2 }}>
                  {ring.ring_label || ring.ring_key}
                </div>
                {visual.hint && (
                  <div style={{ fontSize: '10px', color: 'var(--c-text-4)', marginTop: '1px' }}>
                    {visual.hint}
                  </div>
                )}
              </div>
            </div>

            {/* Métricas */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--c-text-3)', fontWeight: 500 }}>Investido</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text-1)' }}>
                  {fmtBRL(spend)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--c-text-3)', fontWeight: 500 }}>Conversões</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text-1)' }}>
                  {conv.toLocaleString('pt-BR')}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--c-text-3)', fontWeight: 500 }}>Custo por resultado</span>
                <span style={{
                  fontSize: '13px', fontWeight: 700,
                  color: isBest ? visual.color : 'var(--c-text-1)',
                }}>
                  {conv > 0 && cpr > 0 ? fmtBRL(cpr) : '—'}
                </span>
              </div>
            </div>
          </div>
        );
      })}
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

/* ── Bloco de métricas focado em UMA campanha ── */
function CampaignMetricsBlock({ campaigns, selectedId, onSelect, onCreate, onOpenCampaigns }) {
  /* Campanha efetivamente exibida: a escolhida manualmente (se ainda no ar),
     ou a #1 do ranking (melhor performance / única no ar). */
  const selected =
    (selectedId && campaigns.find(c => c.id === selectedId)) ||
    campaigns[0] ||
    null;

  if (!selected) {
    return (
      <div className="ccb-card" style={{
        background: 'var(--c-card-bg)',
        borderRadius: '16px',
        border: '1px dashed var(--c-border)',
        padding: '32px 24px',
        boxShadow: '0 2px 8px var(--c-shadow)',
        textAlign: 'center',
        marginBottom: '20px',
      }}>
        <div style={{ fontSize: '28px', marginBottom: '8px' }}>📭</div>
        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '4px' }}>
          Nenhuma campanha no ar
        </div>
        <div style={{ fontSize: '12px', color: 'var(--c-text-3)', marginBottom: '14px' }}>
          Publique um anúncio para ver as métricas dele aqui.
        </div>
        <button
          onClick={onCreate}
          style={{
            background: 'var(--c-accent)', color: '#fff',
            border: 'none', borderRadius: '10px',
            padding: '8px 18px', fontSize: '12px', fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Criar anúncio
        </button>
      </div>
    );
  }

  const isTop = campaigns[0] && selected.id === campaigns[0].id;
  const hasMultiple = campaigns.length > 1;
  const statusStyle = CAMPAIGN_STATUS_LABEL[selected.status] || CAMPAIGN_STATUS_LABEL.active;
  const metrics = computeCampaignMetrics(selected);

  return (
    <div style={{ marginBottom: '20px' }}>
      {/* Cabeçalho: nome da campanha + badge + seletor */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        marginBottom: '10px',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--c-text-4)', letterSpacing: '.4px', textTransform: 'uppercase' }}>
            {hasMultiple && isTop ? 'Melhor campanha' : 'Campanha'}
          </span>
          <span style={{
            fontSize: '13px', fontWeight: 700, color: 'var(--c-text-1)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            maxWidth: '100%',
          }}>
            {selected.name}
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            background: statusStyle.bg, color: statusStyle.color,
            padding: '2px 8px', borderRadius: '10px',
            fontSize: '10px', fontWeight: 700, flexShrink: 0,
          }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: statusStyle.color }} />
            {statusStyle.label}
          </span>
          {hasMultiple && isTop && (
            <span title="Melhor CPR entre as campanhas no ar" style={{
              fontSize: '12px', flexShrink: 0,
            }}>🏆</span>
          )}
        </div>

        {hasMultiple && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--c-text-3)' }}>
              Ver:
            </label>
            <select
              value={selected.id}
              onChange={(e) => onSelect(e.target.value)}
              style={{
                appearance: 'none',
                background: 'var(--c-card-bg)',
                border: '1.5px solid var(--c-border)',
                borderRadius: '8px',
                padding: '6px 26px 6px 10px',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--c-text-1)',
                cursor: 'pointer',
                maxWidth: '220px',
                backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'10\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23999\' stroke-width=\'3\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><polyline points=\'6 9 12 15 18 9\'/></svg>")',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 8px center',
              }}
            >
              {campaigns.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.status !== 'active' ? ` · ${CAMPAIGN_STATUS_LABEL[c.status]?.label || c.status}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Cards de métricas da campanha selecionada */}
      <div className="metric-grid">
        {metrics.map(m => (
          <MetricCard key={m.label} {...m} />
        ))}
      </div>

      {/* Rodapé: atalho pra lista completa */}
      {hasMultiple && (
        <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onOpenCampaigns}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '11px', fontWeight: 600, color: 'var(--c-accent)',
              padding: '4px 2px',
            }}
          >
            Ver todas as campanhas ({campaigns.length}) →
          </button>
        </div>
      )}
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
  const { ads, metaBilling } = useAppState();

  /* Campanhas no ar, ranqueadas pela melhor performance (menor CPR → mais cliques).
     O top [0] é a "melhor"; o usuário pode trocar via seletor. */
  const liveCampaigns = useMemo(() => rankLiveCampaigns(ads), [ads]);
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);

  /* Compartilha o snapshot de rings entre o card de Performance (faz o fetch)
     e o card de Recomendação (consome). Evita 2 chamadas duplicadas ao backend
     e mantém ambos sincronizados. */
  const [ringsData, setRingsData] = useState(null);
  const [ringsRefreshSignal, setRingsRefreshSignal] = useState(0);
  const handleRingsData = useCallback((data) => setRingsData(data), []);
  const handleRecommendationApplied = useCallback(() => {
    /* Bump força o RingPerformanceCard a re-fetchar imediatamente.
       O Meta pode levar minutos pra refletir, mas pelo menos puxa o estado
       atual já reportado (e mantém os dois cards alinhados). */
    setRingsRefreshSignal(s => s + 1);
  }, []);

  /* Campanhas ativas que aceitam redistribuição entre anéis: precisam ter
     id real do backend (serverId) e estar no ar/em revisão. Pausadas também
     valem — só não faz sentido aplicar em rascunhos. */
  const ringApplicableCampaigns = useMemo(() => {
    return ads
      .filter(a => (a.serverId || (typeof a.id === 'number' && !String(a.id).startsWith('DRAFT-')))
        && (a.status === 'active' || a.status === 'paused' || a.status === 'review'))
      .map(a => ({
        id: a.serverId || a.id,
        name: a.name || `Campanha #${a.serverId || a.id}`,
        budget: a.budget,
      }));
  }, [ads]);

  /* Se a campanha escolhida sair do ar, volta pra melhor atual */
  useEffect(() => {
    if (selectedCampaignId && !liveCampaigns.find(c => c.id === selectedCampaignId)) {
      setSelectedCampaignId(null);
    }
  }, [liveCampaigns, selectedCampaignId]);

  const hoje = new Date();
  const labelHoje = `Hoje, ${hoje.getDate()} de ${MESES_PT[hoje.getMonth()]}`;
  const saudacao = saudacaoPorHora();

  /* metaBilling vem do AppStateContext — auto-refresh 1h + botão manual em /investimento */
  const funds = metaBilling ? Number(metaBilling.available ?? metaBilling.balance ?? 0) : 0;
  const LOW_BALANCE_THRESHOLD = 20;
  const lowBalance = metaBilling ? funds < LOW_BALANCE_THRESHOLD : false;

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
        <div className="hide-mobile" style={{
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

      {/* ── Bloco: métricas da campanha selecionada (ou melhor/única no ar) ── */}
      <CampaignMetricsBlock
        campaigns={liveCampaigns}
        selectedId={selectedCampaignId}
        onSelect={setSelectedCampaignId}
        onCreate={() => navigate('/criar-anuncio')}
        onOpenCampaigns={() => navigate('/anuncios')}
      />

      {/* ── Performance por anel (dado real do Meta) ── */}
      <RingPerformanceCard
        onDataChange={handleRingsData}
        refreshSignal={ringsRefreshSignal}
      />

      {/* ── Recomendação automática de redistribuição entre anéis ──
         Esconde silenciosamente se não houver dado real ou só 1 anel ativo. */}
      <RingRecommendation
        rings={ringsData?.rings || []}
        activeCampaigns={ringApplicableCampaigns}
        onApplied={handleRecommendationApplied}
      />

      {/* ── Linha: saldo + alerta CPC + desempenho por anel ── */}
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
          ads={computeHighCpcAds(ads)}
          benchmark={CPC_BENCHMARK_ESTETICA_FACIAL}
          benchmarkLabel={CPC_BENCHMARK_LABEL}
          onOpenAds={() => navigate('/anuncios')}
        />
      </div>

      {/* ── Gráfico de séries temporais (aguardando histórico de insights) ── */}
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
          <div style={{
            padding: '40px 16px', textAlign: 'center',
            background: 'var(--c-surface)', borderRadius: '10px',
            border: '1px dashed var(--c-border)',
            color: 'var(--c-text-4)', fontSize: '13px',
          }}>
            📊 Sem dados históricos ainda — o gráfico vai aparecer automaticamente após alguns dias de veiculação de anúncios reais.
          </div>
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
