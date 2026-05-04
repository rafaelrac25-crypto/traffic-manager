import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../contexts/AppStateContext';
import { useTheme } from '../contexts/ThemeContext';
import { getUpcomingCommercialDates } from '../data/commercialDates';
import { globalRingPerformance } from '../data/performanceMock';
import RingRecommendation from '../components/RingRecommendation';
import Icon from '../components/Icon';

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
  /* link_clicks: Meta inline_link_clicks — só cliques no CTA/link
     (exclui likes, follows, comentários). Mais relevante pra tráfego. */
  const linkClicks = Number(ad?.link_clicks || 0);
  const conversions = Number(ad?.conversions || ad?.results || 0);
  const impressions = Number(ad?.impressions || 0);
  const reach = Number(ad?.reach || 0);
  /* Frequência vem direto do Meta (insights) OU calculada via impressions/reach.
     >2,5 = público saturando — sinal pra trocar criativo. */
  const frequency = Number(ad?.frequency || (reach > 0 ? impressions / reach : 0));
  const cpr = conversions > 0 ? spent / conversions : 0;
  /* CTR em % com 2 casas. Estética facial: <0,8% fraco, 1-2% médio, >2% bom. */
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  /* CPC implícito — usado pra alertar contra benchmark estética facial 1,20. */
  const cpc = clicks > 0 ? spent / clicks : 0;

  /* Thresholds de alerta — orçamento Cris R$ 15-20/dia, contexto estética facial:
     - Custo por resultado > R$ 30 = caro pro orçamento dela
     - CTR < 1% (com >100 impressões pra evitar falso positivo) = criativo fraco
     - Frequência > 2,5 = público saturado
     - CPC implícito > R$ 1,20 (benchmark) = clique caro */
  const cprAlert  = conversions > 0 && cpr > 30;
  const ctrAlert  = impressions > 100 && ctr < 1;
  const freqAlert = frequency > 2.5;
  const cpcAlert  = clicks > 5 && cpc > 1.20;

  const metrics = [
    { label: 'Investimento',        value: fmtBRL(spent),                       icon: <WalletIcon />, iconBg: '#FDF0F8', iconColor: 'var(--c-accent)',
      hint: 'Quanto já foi gasto desta campanha.' },
    { label: 'Cliques',             value: clicks.toLocaleString('pt-BR'),      icon: <CursorIcon />, iconBg: '#EFF6FF', iconColor: '#3B82F6',
      hint: 'Total de cliques no anúncio (qualquer área).',
      alert: cpcAlert,
      alertReason: cpcAlert ? `CPC implícito de ${fmtBRL(cpc)} acima do benchmark de R$ 1,20 — clique caro.` : null },
    { label: 'Cliques no link',     value: linkClicks.toLocaleString('pt-BR'),  icon: <CursorIcon />, iconBg: '#ECFEFF', iconColor: '#0891B2',
      hint: 'Só cliques no botão/link (CTA). Mais relevante pra tráfego: filtra likes e follows.' },
    { label: 'Resultados',          value: conversions.toLocaleString('pt-BR'), icon: <ResultIcon />, iconBg: '#F0FDF4', iconColor: '#22C55E',
      hint: 'Mensagens recebidas (objetivo da campanha).' },
    { label: 'Custo por resultado', value: conversions > 0 ? fmtBRL(cpr) : '—', icon: <DollarIcon />, iconBg: '#FFF7ED', iconColor: '#F97316',
      hint: 'Quanto cada mensagem está custando.',
      alert: cprAlert,
      alertReason: cprAlert ? `${fmtBRL(cpr)} por mensagem está acima do limite saudável de R$ 30 pro orçamento da Cris (R$ 15-20/dia).` : null },
  ];

  if (impressions > 0) {
    metrics.push({
      label: 'CTR',
      value: `${ctr.toFixed(2).replace('.', ',')}%`,
      icon: <CursorIcon />, iconBg: '#EEF2FF', iconColor: '#6366F1',
      hint: 'De cada 100 que viram, quantas clicaram. >1% bom, >2% ótimo.',
      alert: ctrAlert,
      alertReason: ctrAlert ? `CTR de ${ctr.toFixed(2).replace('.', ',')}% abaixo de 1% — criativo não está engajando.` : null,
    });
  }

  if (frequency > 0) {
    metrics.push({
      label: 'Frequência',
      value: frequency.toFixed(2).replace('.', ','),
      icon: <ResultIcon />, iconBg: freqAlert ? '#FEF3C7' : '#F5F3FF', iconColor: freqAlert ? '#B45309' : '#8B5CF6',
      hint: freqAlert
        ? 'Cada pessoa viu mais de 2,5x — público começando a cansar. Considere novo criativo.'
        : 'Quantas vezes em média a mesma pessoa viu o anúncio.',
      alert: freqAlert,
      alertReason: freqAlert ? `Frequência ${frequency.toFixed(2).replace('.', ',')} acima de 2,5 — público saturado, hora de trocar criativo.` : null,
    });
  }

  return metrics;
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
    '#C13584': { from: '#E879A8', to: '#C13584' },
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
          <stop offset="0%"   stopColor="#C13584" stopOpacity="0.22"/>
          <stop offset="100%" stopColor="#C13584" stopOpacity="0.01"/>
        </linearGradient>
        <linearGradient id="chartLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#E879A8"/>
          <stop offset="100%" stopColor="#C13584"/>
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
            fill={isNear ? '#C13584' : 'var(--c-text-4)'}
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
            stroke="#C13584"
            strokeWidth={1.5 + weight * 0.6}
          />
        );
      })}

      {/* Linha vertical vai suave porque activeX desliza por interpolação */}
      <line
        x1={activeX} y1={padT}
        x2={activeX} y2={padT + plotH}
        stroke="#C13584"
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
        fill="#C13584"
        stroke="#fff"
        strokeWidth="2.5"
        style={{ filter: 'drop-shadow(0 2px 6px rgba(193,53,132,.45))' }}
      />

      {/* Tooltip refinado — compacto, tipografia leve, sombra suave */}
      <g style={{ pointerEvents: 'none' }}>
        <rect
          x={tooltipCenterX - TOOLTIP_W/2}
          y={tooltipY}
          width={TOOLTIP_W}
          height={TOOLTIP_H}
          rx="8"
          fill="#C13584"
          style={{ filter: 'drop-shadow(0 3px 8px rgba(193,53,132,.28))' }}
        />
        {/* Flecha discreta abaixo do retângulo */}
        <path
          d={`M ${activeX - 3.5} ${tooltipY + TOOLTIP_H - 0.5} L ${activeX} ${tooltipY + TOOLTIP_H + 4} L ${activeX + 3.5} ${tooltipY + TOOLTIP_H - 0.5} Z`}
          fill="#C13584"
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
          <Icon name="calendar" size={12} />
          <span style={{ fontSize: '10px', color: 'var(--c-text-3)' }}>Data comercial — clique para estratégia</span>
        </div>
      </div>
    </div>
  );
}

/* ── Card de métrica (compacto — visão geral) ── */
function MetricCard({ label, value, trend, trendUp, sub, icon, hint, alert, alertReason }) {
  /* Layout UNIFICADO (mesma estrutura em ambos temas — cores via CSS vars).
     Glass card via .ccb-card herda var(--c-card-bg) que ja eh theme-aware.
     Icone 40x40 abrangendo 2 linhas; direita: label+? em cima, valor+delta embaixo. */
  return (
    <div className="ccb-card" style={{
      borderRadius: '14px',
      padding: '14px 18px',
      position: 'relative',
      overflow: 'hidden',
      cursor: 'default',
      display: 'flex', alignItems: 'center', gap: '14px',
      minHeight: '72px',
      border: alert ? '1.5px solid var(--c-attention)' : undefined,
      boxShadow: alert
        ? '0 0 0 3px rgba(255,120,73,.12), 0 0 18px rgba(255,120,73,.18)'
        : undefined,
    }}>
      <div style={{
        width: '40px', height: '40px', borderRadius: '10px',
        background: alert ? 'rgba(255,120,73,.14)' : 'var(--c-accent-soft)',
        color: alert ? 'var(--c-attention)' : 'var(--c-accent)',
        border: alert ? '1px solid rgba(255,120,73,.4)' : '1px solid rgba(193,53,132,.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {React.cloneElement(icon, { width: 18, height: 18 })}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{
          fontSize: '11px', color: 'var(--c-text-3)',
          textTransform: 'uppercase', letterSpacing: '1.2px', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: '5px',
          lineHeight: 1.1,
        }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
          {(hint || alertReason) && (
            <span title={alert && alertReason ? alertReason : hint} style={{
              cursor: 'help',
              width: '13px', height: '13px',
              borderRadius: '50%',
              border: `1px solid ${alert ? 'var(--c-attention)' : 'var(--c-text-4)'}`,
              color: alert ? 'var(--c-attention)' : 'var(--c-text-4)',
              fontSize: '9px', fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1, opacity: alert ? 1 : 0.7,
              flexShrink: 0,
            }}>{alert ? '!' : '?'}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '20px', fontWeight: 700,
            color: alert ? 'var(--c-attention)' : 'var(--c-text-1)', letterSpacing: '-0.01em',
            fontFeatureSettings: "'tnum'",
            lineHeight: 1.1,
          }}>
            {value}
          </span>
          {trend && (
            <span style={{
              fontSize: '12px', fontWeight: 700,
              color: trendUp ? 'var(--c-success)' : 'var(--c-attention)',
              lineHeight: 1,
            }}
            title={trend}>
              {trendUp ? '▲' : '▼'}
            </span>
          )}
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
function BalanceCard({ funds, lowBalance, threshold, onAdd, dailyBudget }) {
  const pct = Math.min(100, (funds / 200) * 100);
  /* Estimativa de quantos dias o saldo cobre, com base no budget diário da
     campanha mais ativa. Útil pra leigo entender "R$ 101 ≈ 6,7 dias" em vez
     de só ver o número cru. */
  const daysLeft = (dailyBudget && dailyBudget > 0) ? funds / dailyBudget : null;
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
          {lowBalance
            ? <Icon name="alert" color="danger" size={16} />
            : <Icon name="money" size={16} />}
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
          {lowBalance ? `Abaixo do mínimo de R$\u00A0${threshold},00` : (daysLeft != null
              ? `≈ ${daysLeft.toFixed(1).replace('.', ',')} dias de veiculação`
              : 'Disponível para veicular anúncios')}
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
          <Icon name="star" color="warning" size={16} />
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
          <Icon name="chart-bar" size={16} style={{ flexShrink: 0 }} />
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
        <div style={{ marginBottom: '6px', display: 'flex', justifyContent: 'center' }}><Icon name="alert" color="danger" size={22} /></div>
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

  /* Empty: oculta a seção inteira até existir dado real (Rafa pediu — seção
     vazia polui o Dashboard). Aparece sozinha quando Meta começar a retornar. */
  if (isEmpty) return null;

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

  /* Maior spend pra normalizar largura das barras (relativo ao maior anel). */
  const maxSpend = Math.max(...ringsOrdered.map(r => Number(r.spend || 0)), 1);

  return cardWrap(
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {ringsOrdered.map(ring => {
        const visual = RING_VISUAL[ring.ring_key] || { emoji: '⚪', color: 'var(--c-text-3)', bg: 'var(--c-surface)', hint: '' };
        const isBest = ring.ring_key === bestRingKey;
        const conv = Number(ring.conversions || 0);
        const spend = Number(ring.spend || 0);
        const cpr = Number(ring.cpr || 0);
        /* Largura proporcional ao maior anel (mín 4% pra sempre ser visível). */
        const barPct = Math.max(4, Math.round((spend / maxSpend) * 100));

        return (
          <div
            key={ring.ring_key}
            style={{
              background: 'var(--c-card-bg)',
              borderRadius: '10px',
              padding: '12px 14px',
              border: isBest ? `2px solid ${visual.color}` : '1px solid var(--c-border)',
              boxShadow: isBest ? `0 2px 8px ${visual.color}22` : '0 1px 4px var(--c-shadow)',
              display: 'grid',
              gridTemplateColumns: 'minmax(140px, 200px) 1fr minmax(180px, auto)',
              alignItems: 'center',
              gap: '14px',
              position: 'relative',
            }}
          >
            {isBest && (
              <div style={{
                position: 'absolute', top: '-9px', left: '12px',
                background: visual.color, color: '#fff',
                fontSize: '9px', fontWeight: 700,
                padding: '2px 8px', borderRadius: '8px',
                letterSpacing: '.3px',
                boxShadow: `0 2px 6px ${visual.color}55`,
                display: 'inline-flex', alignItems: 'center', gap: '4px',
              }}>
                <Icon name="star" size={11} color="#fff" /> Melhor retorno
              </div>
            )}

            {/* Coluna 1: identidade do anel */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
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

            {/* Coluna 2: barra horizontal proporcional ao investimento */}
            <div
              style={{
                position: 'relative',
                height: '14px',
                background: 'var(--c-surface)',
                borderRadius: '7px',
                overflow: 'hidden',
                border: '1px solid var(--c-border-lt)',
              }}
              role="progressbar"
              aria-valuenow={Math.round((spend / maxSpend) * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Investimento do anel ${ring.ring_label || ring.ring_key}: ${fmtBRL(spend)}`}
            >
              <div
                style={{
                  width: `${barPct}%`,
                  height: '100%',
                  background: visual.color,
                  transition: 'width 0.3s ease',
                  borderRadius: '7px',
                }}
              />
            </div>

            {/* Coluna 3: métricas compactas — gasto · conversões · custo */}
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: '14px',
              fontSize: '12px', justifyContent: 'flex-end', flexShrink: 0,
            }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '10px', color: 'var(--c-text-4)', fontWeight: 500, lineHeight: 1 }}>Investido</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text-1)', marginTop: '2px' }}>
                  {fmtBRL(spend)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '10px', color: 'var(--c-text-4)', fontWeight: 500, lineHeight: 1 }}>Conv.</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text-1)', marginTop: '2px' }}>
                  {conv.toLocaleString('pt-BR')}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '10px', color: 'var(--c-text-4)', fontWeight: 500, lineHeight: 1 }}>Custo/result.</div>
                <div style={{
                  fontSize: '13px', fontWeight: 700,
                  color: isBest ? visual.color : 'var(--c-text-1)',
                  marginTop: '2px',
                }}>
                  {conv > 0 && cpr > 0 ? fmtBRL(cpr) : '—'}
                </div>
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
          <Icon name="check-circle" color="success" size={16} />
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
          <Icon name="alert" color="danger" size={16} />
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
  /* Compara como String pra evitar bug de tipo: select retorna sempre string,
     mas c.id pode ser number (do backend) ou string (rascunhos locais). */
  const selected =
    (selectedId != null && campaigns.find(c => String(c.id) === String(selectedId))) ||
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
        <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'center' }}><Icon name="bell-off" size={28} /></div>
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
            <span title="Melhor CPR entre as campanhas no ar" style={{ flexShrink: 0, display: 'inline-flex' }}>
              <Icon name="star" color="warning" size={14} />
            </span>
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

/* ── Card adaptativo: fase de aprendizado Meta ──
   Aparece quando há campanha ATIVA com <7 dias de vida; some sozinho quando
   todas estabilizam. Avisa o Rafa pra não mexer no orçamento (>20% reseta o
   algoritmo). Bate com a regra documentada em CRITICAL_STATE.md. */
function LearningPhaseCard({ campaigns }) {
  const learning = useMemo(() => {
    return campaigns
      .filter(c => c.status === 'active')
      .map(c => {
        const start = c.live_at || c.submitted_at || c.created_at || c.createdAt;
        if (!start) return null;
        const ageMs = Date.now() - new Date(start).getTime();
        if (ageMs < 0) return null;
        const ageDays = ageMs / 86_400_000;
        if (ageDays >= 7) return null;
        return { name: c.name, ageDays, remainingDays: 7 - ageDays };
      })
      .filter(Boolean)
      .sort((a, b) => a.remainingDays - b.remainingDays);
  }, [campaigns]);

  if (learning.length === 0) return null;

  const head = learning[0];
  const remH = Math.floor(head.remainingDays * 24);
  const remD = Math.floor(remH / 24);
  const remHRest = remH % 24;
  const remLabel = remD > 0
    ? `${remD}d ${remHRest}h`
    : `${remH}h`;
  const ageH = Math.floor(head.ageDays * 24);
  const ageD = Math.floor(ageH / 24);
  const ageHRest = ageH % 24;
  const ageLabel = ageD > 0 ? `${ageD}d ${ageHRest}h` : `${ageH}h`;

  /* Layout UNIFICADO em ambos temas — glass card com border-left amarelo. Cores via vars. */
  return (
    <div className="ccb-card" style={{
      borderRadius: '12px',
      borderLeft: '2px solid var(--c-warning)',
      padding: '12px 16px',
      marginBottom: '14px',
      display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
    }}>
      <div style={{ flexShrink: 0, opacity: .9 }}><Icon name="hourglass" color="warning" size={20} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '2px' }}>
          {learning.length === 1
            ? `Campanha em fase de aprendizado — ${ageLabel} de 7d`
            : `${learning.length} campanhas em fase de aprendizado`}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--c-text-3)', fontWeight: 400, lineHeight: 1.4 }}>
          {learning.length === 1
            ? <>Estabiliza em <strong style={{ color: 'var(--c-warning)', fontWeight: 700 }}>{remLabel}</strong>. Não mexer no orçamento até lá — alterações &gt;20% resetam o algoritmo do Meta.</>
            : <>A mais nova estabiliza em <strong style={{ color: 'var(--c-warning)', fontWeight: 700 }}>{remLabel}</strong>. Não mexer nos orçamentos até lá.</>}
        </div>
      </div>
    </div>
  );
}

/* ── Resumo executivo (apenas dark) ── */
/* Conjunto de componentes locais que reproduzem o mockup
   `.design/mockups/dashboard.html` no topo da Dashboard, sem demolir nada
   do legado. Métricas vêm do AppState; gráfico usa um mock plausível
   ancorado no total real de mensagens (não há série temporal salva ainda). */

function ExecMetricCard({ label, value, delta, deltaUp, accent, icon }) {
  const deltaColor = deltaUp ? '#34D399' : '#F87171';
  const deltaBg    = deltaUp ? 'rgba(52,211,153,.16)' : 'rgba(248,113,113,.16)';
  const deltaBorder= deltaUp ? 'rgba(52,211,153,.25)' : 'rgba(248,113,113,.25)';
  return (
    <div
      className="ccb-card"
      style={{
        position: 'relative',
        padding: '18px 20px',
        borderRadius: '18px',
        ...(accent ? {
          borderColor: 'rgba(193,53,132,.55)',
          boxShadow: '0 8px 30px rgba(0,0,0,.4), 0 0 30px rgba(193,53,132,.15), inset 0 1px 0 rgba(255,194,228,.18), inset 0 0 16px rgba(193,53,132,.08)',
        } : {}),
        overflow: 'hidden',
      }}
    >
      {/* Ícone top-right */}
      <div style={{
        position: 'absolute', top: '16px', right: '16px',
        width: '36px', height: '36px', borderRadius: '10px',
        background: 'var(--c-accent-soft)',
        color: 'var(--c-accent)',
        display: 'grid', placeItems: 'center',
        border: '1px solid rgba(193,53,132,.3)',
        boxShadow: '0 0 16px rgba(193,53,132,.2)',
      }}>
        {icon}
      </div>
      <div style={{
        fontSize: '11px', color: 'var(--c-text-3)',
        textTransform: 'uppercase', letterSpacing: '1.2px',
        fontWeight: 500,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: '30px', fontWeight: 800, marginTop: '8px',
        letterSpacing: '-0.02em',
        fontFeatureSettings: "'tnum'",
        color: 'var(--c-text-1)',
        lineHeight: 1.1,
      }}>
        {value}
      </div>
      {delta && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          fontSize: '11.5px', fontWeight: 700, marginTop: '6px',
          padding: '3px 9px', borderRadius: '999px',
          color: deltaColor, background: deltaBg,
          border: `1px solid ${deltaBorder}`,
        }}>
          {deltaUp ? '▲' : '▼'} {delta}
        </span>
      )}
    </div>
  );
}

/* Gera 14 dias de mensagens com distribuição plausível ancorada no total real.
   Curva crescente leve com ruído + pico no último dia (HOJE). Se totalReal é 0,
   devolve zeros pro card mostrar estado limpo. */
function buildMessagesSeriesMock(totalReal) {
  const days = 14;
  /* Pesos plausíveis (cresce ~9x do dia 1 ao HOJE, com pequenas oscilações) */
  const weights = [8, 12, 15, 22, 18, 26, 20, 31, 28, 42, 38, 55, 48, 72];
  const sumW = weights.reduce((s, w) => s + w, 0);
  /* Se total real <= 0, usa os próprios pesos como valores. Caso contrário,
     escala os pesos pra soma bater com o total real. */
  const scale = totalReal > 0 ? totalReal / sumW : 1;
  const today = new Date();
  return weights.map((w, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (days - 1 - i));
    const dayLabel = i === days - 1 ? 'HOJE' : String(d.getDate()).padStart(2, '0');
    return {
      day: dayLabel,
      value: Math.max(0, Math.round(w * scale)),
      isToday: i === days - 1,
    };
  });
}

function ExecBarsChart({ totalMessages }) {
  const series = useMemo(() => buildMessagesSeriesMock(totalMessages), [totalMessages]);
  const max = Math.max(...series.map(d => d.value), 1);
  const totalPeriodo = series.reduce((s, d) => s + d.value, 0);
  return (
    <div className="ccb-card" style={{ padding: '18px 20px', borderRadius: '18px' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        marginBottom: '16px', gap: '14px', flexWrap: 'wrap',
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--c-text-1)' }}>
            Mensagens iniciadas · por dia
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--c-text-3)', fontWeight: 400 }}>
            Quanto maior a barra, mais gente conversou com você naquele dia.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '14px' }}>
          <span style={{ fontSize: '11px', color: 'var(--c-text-3)', display: 'inline-flex', gap: '6px', alignItems: 'center', fontWeight: 600 }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '2px', background: '#fff', boxShadow: '0 0 8px #fff' }} />
            Hoje
          </span>
          <span style={{ fontSize: '11px', color: 'var(--c-text-3)', display: 'inline-flex', gap: '6px', alignItems: 'center', fontWeight: 600 }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '2px', background: 'var(--c-accent)', boxShadow: '0 0 8px var(--c-accent)' }} />
            Dias anteriores
          </span>
        </div>
      </div>

      {/* Barras */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(14, 1fr)',
        gap: '6px',
        alignItems: 'end',
        height: '200px',
        padding: '0 4px',
        marginTop: '6px',
      }}>
        {series.map((d, i) => {
          const heightPct = max > 0 ? (d.value / max) * 100 : 0;
          return (
            <div key={i} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
              gap: '4px', height: '100%', position: 'relative',
            }}>
              <span style={{
                fontSize: '10px', fontWeight: 700, color: 'var(--c-text-2)',
                fontFeatureSettings: "'tnum'", lineHeight: 1,
              }}>
                {d.value}
              </span>
              <div style={{
                width: '100%', maxWidth: '28px',
                height: `${heightPct}%`,
                borderRadius: '6px 6px 2px 2px',
                background: d.isToday
                  ? 'linear-gradient(180deg, #fff, var(--c-accent))'
                  : 'linear-gradient(180deg, var(--c-accent), rgba(193,53,132,.4))',
                boxShadow: d.isToday
                  ? '0 0 18px var(--c-accent), inset 0 1px 0 rgba(255,255,255,.4)'
                  : '0 0 14px rgba(193,53,132,.35), inset 0 1px 0 rgba(255,255,255,.2)',
              }} />
              <span style={{
                fontSize: '9.5px', color: 'var(--c-text-4)', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '.5px',
              }}>
                {d.day}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginTop: '6px', borderTop: '1px solid var(--c-border)', paddingTop: '8px',
        fontSize: '10.5px', color: 'var(--c-text-4)', fontWeight: 600,
      }}>
        <span>14 dias atrás</span>
        <span>
          Total no período:{' '}
          <strong style={{ color: 'var(--c-accent)', fontWeight: 700 }}>
            {totalPeriodo.toLocaleString('pt-BR')} mensagens
          </strong>
        </span>
        <span>Hoje</span>
      </div>
    </div>
  );
}

const PT_MONTH_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function ExecNextDates() {
  const items = useMemo(() => {
    const upcoming = getUpcomingCommercialDates(new Date(), 180);
    return (upcoming || []).slice(0, 3);
  }, []);

  return (
    <div className="ccb-card" style={{
      padding: '18px 20px', borderRadius: '18px',
      display: 'flex', flexDirection: 'column', gap: '14px',
    }}>
      <div>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--c-text-1)' }}>
          Próximas datas
        </h3>
        <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--c-text-3)', fontWeight: 400 }}>
          Datas comerciais e oportunidades
        </p>
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: '12px', color: 'var(--c-text-3)' }}>
          Nenhuma data comercial próxima.
        </div>
      ) : items.map((entry, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: '12px', padding: '12px',
          borderRadius: '12px',
          background: 'var(--c-surface)',
          border: '1px solid var(--c-border)',
        }}>
          <div style={{
            width: '50px', textAlign: 'center',
            background: 'var(--c-accent-soft)',
            border: '1px solid rgba(193,53,132,.4)',
            borderRadius: '10px', padding: '6px 0',
            color: 'var(--c-accent)', fontWeight: 700,
            boxShadow: '0 0 14px rgba(193,53,132,.18)',
          }}>
            <div style={{ fontSize: '17px', lineHeight: 1, fontFeatureSettings: "'tnum'" }}>
              {String(entry.date.getDate()).padStart(2, '0')}
            </div>
            <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.85 }}>
              {PT_MONTH_SHORT[entry.date.getMonth()]}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ fontSize: '13px', color: 'var(--c-text-1)', display: 'block' }}>
              {entry.name}
            </strong>
            {entry.description && (
              <small style={{ display: 'block', color: 'var(--c-text-3)', fontSize: '11px', marginTop: '2px', fontWeight: 400 }}>
                {entry.description}
              </small>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

const STATUS_BADGE_EXEC = {
  active:  { label: 'ATIVO',     color: '#34D399', bg: 'rgba(52,211,153,.16)',  bd: 'rgba(52,211,153,.3)' },
  review:  { label: 'EM REVISÃO',color: '#FBBF24', bg: 'rgba(251,191,36,.16)',  bd: 'rgba(251,191,36,.3)' },
  paused:  { label: 'PAUSADO',   color: '#F87171', bg: 'rgba(248,113,113,.16)', bd: 'rgba(248,113,113,.3)' },
};

function ExecActiveAdsTable({ ads, onSeeAll }) {
  const top = ads.slice(0, 5);
  return (
    <div className="ccb-card" style={{ padding: '18px 20px', borderRadius: '18px' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '14px',
      }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--c-text-1)' }}>
          Anúncios ativos
        </h3>
        <button
          onClick={onSeeAll}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--c-accent)', fontSize: '12px', fontWeight: 600,
            padding: 0,
          }}
        >
          Ver todos →
        </button>
      </div>

      {top.length === 0 ? (
        <div style={{ fontSize: '12px', color: 'var(--c-text-3)', padding: '12px 4px' }}>
          Nenhum anúncio no ar ainda.
        </div>
      ) : top.map((ad, i) => {
        const status = STATUS_BADGE_EXEC[ad.status] || STATUS_BADGE_EXEC.active;
        const conv = Number(ad.conversions || ad.results || 0);
        const spent = Number(ad.spent || 0);
        const cpr = conv > 0 ? spent / conv : 0;
        const ringLabel = ad.ring_label || ad.ringLabel || (ad.radius ? `raio ${ad.radius} km` : 'Joinville');
        return (
          <div
            key={ad.id || i}
            style={{
              display: 'grid',
              gridTemplateColumns: '36px 1fr auto auto auto',
              gap: '14px', alignItems: 'center',
              padding: '11px 6px',
              borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,.05)',
            }}
          >
            <div style={{
              width: '36px', height: '36px', borderRadius: '9px',
              background: 'linear-gradient(135deg, var(--c-accent-soft), rgba(125,74,94,.2))',
              border: '1px solid var(--c-border)',
              display: 'grid', placeItems: 'center',
              color: 'var(--c-accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="image" size={16} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: '13px', fontWeight: 600, color: 'var(--c-text-1)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {ad.name || 'Anúncio sem nome'}
              </div>
              <small style={{ display: 'block', color: 'var(--c-text-3)', fontSize: '11px', fontWeight: 400 }}>
                Conjunto · Joinville · {ringLabel}
              </small>
            </div>
            <span style={{
              fontSize: '10.5px', padding: '4px 9px', borderRadius: '999px',
              fontWeight: 700, letterSpacing: '.3px',
              background: status.bg, color: status.color,
              border: `1px solid ${status.bd}`,
            }}>
              {status.label}
            </span>
            <div style={{ fontSize: '13px', fontWeight: 700, fontFeatureSettings: "'tnum'", minWidth: '70px', textAlign: 'right', color: 'var(--c-text-1)' }}>
              {conv > 0 ? conv.toLocaleString('pt-BR') : '—'}
              <small style={{ display: 'block', color: 'var(--c-text-3)', fontSize: '10.5px', fontWeight: 400 }}>
                {conv > 0 ? 'mensagens' : 'aguardando'}
              </small>
            </div>
            <div className="hide-sm" style={{ fontSize: '13px', fontWeight: 700, fontFeatureSettings: "'tnum'", minWidth: '70px', textAlign: 'right', color: 'var(--c-text-1)' }}>
              {cpr > 0 ? `R$ ${cpr.toFixed(2).replace('.', ',')}` : '—'}
              <small style={{ display: 'block', color: 'var(--c-text-3)', fontSize: '10.5px', fontWeight: 400 }}>
                {cpr > 0 ? 'por msg' : '—'}
              </small>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ResumoExecutivo({ liveCampaigns, metaBilling, onSeeAllAds }) {
  /* === Cálculos das 4 métricas === */
  const balance = metaBilling
    ? Number(metaBilling.available ?? metaBilling.balance ?? 0)
    : 0;

  const activeCount = liveCampaigns.filter(c => c.status === 'active').length;

  const totalMessages = liveCampaigns.reduce(
    (s, c) => s + Number(c.conversions || c.results || 0), 0
  );

  const totalSpend = liveCampaigns.reduce(
    (s, c) => s + Number(c.spent || 0), 0
  );

  const cpm = totalMessages > 0 ? totalSpend / totalMessages : 0;

  /* Ícones SVG inline */
  const IconWallet = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  );
  const IconAds = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 12l9 4 9-4"/>
    </svg>
  );
  const IconChat = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );
  const IconChart = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3v18h18"/><polyline points="7 14 11 10 15 14 21 8"/>
    </svg>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', marginBottom: '22px' }}>
      {/* === Linha 1: 4 métricas === */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px',
        }}
        className="exec-metrics"
      >
        <ExecMetricCard
          label="Saldo disponível"
          value={`R$ ${balance.toFixed(2).replace('.', ',')}`}
          icon={IconWallet}
        />
        <ExecMetricCard
          label="Anúncios ativos"
          value={activeCount.toString()}
          icon={IconAds}
        />
        <ExecMetricCard
          label="Mensagens iniciadas"
          value={totalMessages.toLocaleString('pt-BR')}
          icon={IconChat}
        />
        <ExecMetricCard
          label="Custo por msg"
          value={cpm > 0 ? `R$ ${cpm.toFixed(2).replace('.', ',')}` : '—'}
          icon={IconChart}
          accent
        />
      </section>

      {/* === Linha 2: gráfico + próximas datas === */}
      <section className="exec-grid-2" style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: '16px',
      }}>
        <ExecBarsChart totalMessages={totalMessages} />
        <ExecNextDates />
      </section>

      {/* === Linha 3: tabela de anúncios === */}
      <ExecActiveAdsTable ads={liveCampaigns} onSeeAll={onSeeAllAds} />

      {/* Responsivo via style tag inline (não cria CSS global novo) */}
      <style>{`
        @media (max-width: 1024px) {
          .exec-grid-2 { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 900px) {
          .exec-metrics { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 480px) {
          .exec-metrics { grid-template-columns: 1fr !important; }
        }
      `}</style>
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
  const { isDark } = useTheme();

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
    if (selectedCampaignId != null && !liveCampaigns.find(c => String(c.id) === String(selectedCampaignId))) {
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

  /* Soma diária de orçamento das campanhas no ar — usado no BalanceCard pra
     traduzir saldo em "≈ X dias de veiculação". Pula valores 0/falsy. */
  const totalDailyBudget = useMemo(() => {
    return liveCampaigns.reduce((sum, c) => {
      const b = Number(c.budgetValue || c.budget || 0);
      return c.budgetType === 'daily' || !c.budgetType ? sum + b : sum;
    }, 0);
  }, [liveCampaigns]);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const horaAgora = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="page-container">

      {/* Cabecalho duplicado removido — saudacao "Ola, Cris" ja aparece na topbar em ambos temas */}

      {/* Onda 6.1: ResumoExecutivo removido — Dashboard começa direto pelos
         "detalhes operacionais". Definições de Exec* permanecem no arquivo
         como código morto reutilizável caso queira voltar. */}

      {/* ── Aviso de fase de aprendizado (some sozinho quando não há campanha <7d) ── */}
      <LearningPhaseCard campaigns={liveCampaigns} />

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
          dailyBudget={totalDailyBudget}
          onAdd={() => navigate('/investimento')}
        />
        <CpcAlertCard
          ads={computeHighCpcAds(ads)}
          benchmark={CPC_BENCHMARK_ESTETICA_FACIAL}
          benchmarkLabel={CPC_BENCHMARK_LABEL}
          onOpenAds={() => navigate('/anuncios')}
        />
      </div>

      {/* Gráfico de séries temporais e MiniCalendar foram removidos do
          Dashboard a pedido do Rafa: o gráfico ficava com placeholder
          permanente "sem dados" e o calendário/datas comerciais já têm
          páginas dedicadas (/calendario + sino de notificações). O gráfico
          volta automaticamente quando houver ≥3 dias de histórico de
          insights — basta reativar a seção condicional aqui. */}
    </div>
  );
}
