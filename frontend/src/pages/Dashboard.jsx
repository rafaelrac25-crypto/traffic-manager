/**
 * IMPORTANT:
 * All displayed data is fictional placeholder data.
 * Real data will be loaded later from Meta Ads API.
 * Do not persist mock values.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

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
    iconColor: '#C13584',
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
  '2026-04-14': { label: 'Skincare Rotina Diária', color: '#C13584', dot: true },
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

/* ── Gráfico de linha SVG ── */
function LineChart({ data }) {
  const W = 540, H = 160;
  const padL = 40, padR = 20, padT = 30, padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const maxVal = 200;

  const pts = data.map((d, i) => ({
    x: padL + (i / (data.length - 1)) * plotW,
    y: padT + plotH - (d.value / maxVal) * plotH,
    ...d,
  }));

  /* Smooth path com cubic bezier */
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

  /* Área preenchida */
  function areaPath(points) {
    const linePath = smoothPath(points);
    const lastPt = points[points.length - 1];
    const firstPt = points[0];
    return `${linePath} L ${lastPt.x},${padT + plotH} L ${firstPt.x},${padT + plotH} Z`;
  }

  const linePath = smoothPath(pts);
  const fillPath = areaPath(pts);
  const highlightPt = pts[4]; /* 12 Abr — pico */

  /* Y-grid labels */
  const gridVals = [0, 50, 100, 150, 200];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#C13584" stopOpacity="0.18"/>
          <stop offset="100%" stopColor="#C13584" stopOpacity="0.01"/>
        </linearGradient>
        <linearGradient id="chartLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#E879A8"/>
          <stop offset="100%" stopColor="#C13584"/>
        </linearGradient>
      </defs>

      {/* Grid Y */}
      {gridVals.map(v => {
        const y = padT + plotH - (v / maxVal) * plotH;
        return (
          <g key={v}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--c-border-lt)" strokeWidth="1" strokeDasharray="4,4"/>
            <text x={padL - 6} y={y + 4} fontSize="9" fill="var(--c-text-4)" textAnchor="end">{v}</text>
          </g>
        );
      })}

      {/* Área preenchida */}
      <path d={fillPath} fill="url(#chartFill)"/>

      {/* Linha principal */}
      <path d={linePath} fill="none" stroke="url(#chartLine)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>

      {/* Rótulos X */}
      {pts.map((pt, i) => (
        <text key={i} x={pt.x} y={H - 4} fontSize="9" fill="var(--c-text-4)" textAnchor="middle">{pt.label}</text>
      ))}

      {/* Ponto destacado — 12 Abr */}
      <line x1={highlightPt.x} y1={padT} x2={highlightPt.x} y2={padT + plotH} stroke="#C13584" strokeWidth="1" strokeDasharray="3,3" opacity="0.5"/>
      <circle cx={highlightPt.x} cy={highlightPt.y} r="5" fill="#C13584" stroke="#fff" strokeWidth="2" style={{ animation: 'chartPop .3s ease' }}/>

      {/* Tooltip do ponto */}
      <g>
        <rect x={highlightPt.x - 42} y={highlightPt.y - 32} width="84" height="26" rx="7" fill="#C13584"/>
        <text x={highlightPt.x} y={highlightPt.y - 14} fontSize="10" fill="white" textAnchor="middle" fontWeight="700">12 de Abril</text>
        <text x={highlightPt.x} y={highlightPt.y - 4} fontSize="9" fill="white" textAnchor="middle" opacity="0.85">166 resultados</text>
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
        {[['#C13584', 'Instagram'], ['#F97316', 'Google Ads'], ['#8B5CF6', 'Em revisão']].map(([color, label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
            <span style={{ fontSize: '10px', color: 'var(--c-text-3)' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Card de métrica ── */
function MetricCard({ label, value, trend, trendUp, sub, icon, iconBg, iconColor }) {
  return (
    <div style={{
      background: 'var(--c-card-bg)',
      borderRadius: '14px',
      padding: '18px 20px',
      border: '1px solid var(--c-border)',
      boxShadow: '0 2px 8px var(--c-shadow)',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    }}>
      {/* Ícone */}
      <div style={{
        width: '40px', height: '40px', borderRadius: '12px',
        background: iconBg, color: iconColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '11px', color: 'var(--c-text-3)', marginBottom: '4px' }}>{label}</div>
        <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--c-text-1)', lineHeight: 1, marginBottom: '6px' }}>{value}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {trendUp ? <ArrowUp color="#22C55E" /> : <ArrowDown color="#EF4444" />}
          <span style={{ fontSize: '11px', fontWeight: 600, color: trendUp ? '#22C55E' : '#EF4444' }}>{trend}</span>
          <span style={{ fontSize: '11px', color: 'var(--c-text-4)' }}>{sub}</span>
        </div>
      </div>
    </div>
  );
}

/* ── Dashboard ── */
export default function Dashboard() {
  const navigate = useNavigate();
  const [chartMetric, setChartMetric] = useState('Resultados');

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

      {/* ── Linha: gráfico + dica do dia ── */}
      <div className="dashboard-main-row" style={{ marginBottom: '20px' }}>

        {/* Gráfico */}
        <div style={{
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

        {/* Dica do dia */}
        <div style={{
          background: 'var(--c-card-bg)',
          borderRadius: '16px',
          border: '1px solid var(--c-border)',
          padding: '20px',
          boxShadow: '0 2px 8px var(--c-shadow)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '14px' }}>💡</span>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#F97316', letterSpacing: '1px', textTransform: 'uppercase' }}>Dica do Dia</span>
          </div>

          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '6px' }}>
              Você está no caminho certo!
            </div>
            <p style={{ fontSize: '12px', color: 'var(--c-text-3)', lineHeight: 1.6 }}>
              Seus anúncios estão performando acima da média. Que tal criar um novo anúncio para aproveitar o momento?
            </p>
          </div>

          <div style={{
            background: 'var(--c-surface)',
            borderRadius: '10px',
            padding: '12px',
            display: 'flex', alignItems: 'flex-start', gap: '10px',
          }}>
            <span style={{ fontSize: '20px', flexShrink: 0 }}>🚀</span>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--c-text-2)', marginBottom: '3px' }}>Sugestão</div>
              <p style={{ fontSize: '11px', color: 'var(--c-text-4)', lineHeight: 1.5 }}>
                Campanhas com imagens claras geram 23% mais resultados.
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate('/criar-anuncio')}
            style={{
              width: '100%',
              background: 'var(--c-accent)',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              padding: '12px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'background .15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--c-accent-dk)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--c-accent)'}
          >
            Criar novo anúncio
          </button>
        </div>
      </div>

      {/* ── Linha: calendário mini + wizard start ── */}
      <div className="dashboard-bottom-row">

        {/* Calendário mini */}
        <div style={{
          background: 'var(--c-card-bg)',
          borderRadius: '16px',
          border: '1px solid var(--c-border)',
          padding: '20px 24px',
          boxShadow: '0 2px 8px var(--c-shadow)',
        }}>
          <MiniCalendar onViewFull={() => navigate('/calendario')} />
        </div>

        {/* Quick start wizard */}
        <div style={{
          background: 'var(--c-card-bg)',
          borderRadius: '16px',
          border: '1px solid var(--c-border)',
          padding: '20px',
          boxShadow: '0 2px 8px var(--c-shadow)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--c-text-1)' }}>
              Criar novo anúncio
            </div>
            <button
              onClick={() => navigate('/criar-anuncio')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-4)', fontSize: '18px', lineHeight: 1 }}
            >×</button>
          </div>

          {/* Step indicator mini */}
          <div>
            <div style={{ fontSize: '10px', color: 'var(--c-text-4)', marginBottom: '6px' }}>Passo 1 de 6</div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[1,2,3,4,5,6].map(s => (
                <div key={s} style={{
                  flex: 1, height: '4px', borderRadius: '4px',
                  background: s === 1 ? 'var(--c-accent)' : 'var(--c-border)',
                  transition: 'background .2s',
                }} />
              ))}
            </div>
          </div>

          {/* Pergunta */}
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--c-text-1)' }}>
            Onde você quer anunciar?
          </div>

          {/* Platform cards mini */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {[
              { id: 'instagram', label: 'Instagram', sub: 'Feed, Stories e Reels', bg: 'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', selected: true },
              { id: 'google', label: 'Google Ads', sub: 'Resultados no Google', bg: 'linear-gradient(135deg,#4285F4,#34A853,#FBBC05,#EA4335)', selected: false },
            ].map(p => (
              <div key={p.id} style={{
                border: `2px solid ${p.selected ? 'var(--c-accent)' : 'var(--c-border)'}`,
                borderRadius: '10px', padding: '10px 8px', textAlign: 'center', cursor: 'pointer',
                background: p.selected ? 'var(--c-active-bg)' : 'var(--c-surface)',
                transition: 'all .15s',
              }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '8px',
                  background: p.bg, margin: '0 auto 6px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }} />
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--c-text-1)' }}>{p.label}</div>
                <div style={{ fontSize: '9px', color: 'var(--c-text-4)', marginTop: '2px' }}>{p.sub}</div>
              </div>
            ))}
          </div>

          {/* Botão próximo */}
          <button
            onClick={() => navigate('/criar-anuncio')}
            style={{
              width: '100%',
              background: 'var(--c-accent)',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              padding: '11px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              transition: 'background .15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--c-accent-dk)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--c-accent)'}
          >
            Próximo passo
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
