/**
 * IMPORTANT:
 * All displayed data is fictional placeholder data.
 * Real data will be loaded later from Meta Ads API.
 * Do not persist mock values.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const MONTHS     = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const WEEK_DAYS  = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'];

/* ── Eventos mock ── */
const MOCK_EVENTS = {
  '2026-04-10': [{ id: 1, time: '10:00', name: 'Esmaltes Tendência',    platform: 'google',    thumb: 'linear-gradient(135deg,#D1D5DB,#9CA3AF)' }],
  '2026-04-14': [{ id: 2, time: '15:30', name: 'Skincare Rotina Diária', platform: 'instagram', thumb: 'linear-gradient(135deg,#FDE68A,#F9A8D4)' }],
  '2026-04-21': [{ id: 3, time: '09:00', name: 'Lançamento Nova Linha',  platform: 'review',    thumb: 'linear-gradient(135deg,#C4B5FD,#8B5CF6)' }],
};

const UPCOMING = [
  { id: 2, day: '14', month: 'ABR', time: '15:30', name: 'Skincare Rotina Diária', platform: 'instagram', status: null,      thumb: 'linear-gradient(135deg,#FDE68A,#F9A8D4)' },
  { id: 1, day: '10', month: 'ABR', time: '10:00', name: 'Esmaltes Tendência',     platform: 'google',    status: null,      thumb: 'linear-gradient(135deg,#D1D5DB,#9CA3AF)' },
  { id: 3, day: '21', month: 'ABR', time: '09:00', name: 'Lançamento Nova Linha',  platform: 'review',    status: 'review',  thumb: 'linear-gradient(135deg,#C4B5FD,#8B5CF6)' },
];

const PLAT_BADGE = {
  instagram: { label: 'Instagram', bg: '#FDF0F8', color: '#C13584' },
  google:    { label: 'Google Ads', bg: '#FEF9C3', color: '#CA8A04' },
  meta:      { label: 'Meta Ads',  bg: '#EFF6FF', color: '#1877F2' },
  review:    { label: 'Em revisão', bg: '#F5F3FF', color: '#7C3AED' },
};

const PLAT_DOT = {
  instagram: '#C13584',
  google:    '#F97316',
  meta:      '#1877F2',
  review:    '#8B5CF6',
};

/* ── Ícones ── */
const ChevLeft  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>;
const ChevRight = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>;
const PlusIcon  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const CalSmall  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;

function buildCalendar(year, month) {
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays    = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push({ day: prevDays - firstDay + i + 1, current: false });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, current: true });
  while (cells.length % 7 !== 0) cells.push({ day: cells.length - daysInMonth - firstDay + 1, current: false });
  return cells;
}

export default function Calendar() {
  const navigate = useNavigate();
  const today    = new Date();
  const [year,  setYear]  = useState(2026);
  const [month, setMonth] = useState(3); /* Abril */

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  const cells    = buildCalendar(year, month);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  function dayKey(day) {
    return `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }

  return (
    <div style={{ padding: '28px', animation: 'fadeIn .25s ease' }}>

      {/* ── Cabeçalho ── */}
      <div style={{ marginBottom: '22px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--c-text-1)', marginBottom: '4px' }}>Calendário</h1>
        <p style={{ fontSize: '13px', color: 'var(--c-text-3)' }}>
          Visualize e <span style={{ color: 'var(--c-accent)', fontWeight: 600 }}>planeje</span> suas campanhas.
        </p>
      </div>

      {/* ── Layout: calendário + painel direito ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px', alignItems: 'start' }}>

        {/* ── Calendário principal ── */}
        <div style={{
          background: 'var(--c-card-bg)',
          borderRadius: '16px',
          border: '1px solid var(--c-border)',
          boxShadow: '0 2px 8px var(--c-shadow)',
          overflow: 'hidden',
        }}>
          {/* Nav do mês */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px', borderBottom: '1px solid var(--c-border)',
          }}>
            <button
              onClick={prevMonth}
              style={{ width: '32px', height: '32px', border: '1.5px solid var(--c-border)', background: 'var(--c-surface)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-3)' }}
            ><ChevLeft /></button>
            <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--c-text-1)' }}>
              {MONTHS[month]} {year}
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={nextMonth}
                style={{ width: '32px', height: '32px', border: '1.5px solid var(--c-border)', background: 'var(--c-surface)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-3)' }}
              ><ChevRight /></button>
              <button style={{
                padding: '6px 14px', borderRadius: '8px',
                border: '1.5px solid var(--c-border)', background: 'var(--c-surface)',
                fontSize: '12px', fontWeight: 500, color: 'var(--c-text-2)', cursor: 'pointer',
              }}>Hoje</button>
            </div>
          </div>

          {/* Cabeçalho dos dias da semana */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--c-border)' }}>
            {WEEK_DAYS.map(d => (
              <div key={d} style={{
                padding: '10px 0', textAlign: 'center',
                fontSize: '10px', fontWeight: 700,
                color: 'var(--c-text-4)', letterSpacing: '.7px',
              }}>{d}</div>
            ))}
          </div>

          {/* Células do calendário */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {cells.map((cell, idx) => {
              const key = cell.current ? dayKey(cell.day) : null;
              const events = key ? (MOCK_EVENTS[key] || []) : [];
              const isToday = key === todayStr;
              const isLastRow = idx >= cells.length - 7;

              return (
                <div
                  key={idx}
                  style={{
                    minHeight: '100px',
                    padding: '8px 6px 6px',
                    borderRight: (idx + 1) % 7 !== 0 ? '1px solid var(--c-border-lt)' : 'none',
                    borderBottom: !isLastRow ? '1px solid var(--c-border-lt)' : 'none',
                    background: !cell.current ? 'var(--c-surface)' : isToday ? 'var(--c-active-bg)' : 'var(--c-card-bg)',
                    cursor: cell.current ? 'pointer' : 'default',
                    transition: 'background .12s',
                  }}
                  onMouseEnter={e => { if (cell.current && !isToday) e.currentTarget.style.background = 'var(--c-hover)'; }}
                  onMouseLeave={e => { if (cell.current && !isToday) e.currentTarget.style.background = 'var(--c-card-bg)'; }}
                >
                  {/* Número do dia */}
                  <div style={{
                    width: '26px', height: '26px', borderRadius: '50%',
                    background: isToday ? 'var(--c-accent)' : 'transparent',
                    color: !cell.current ? 'var(--c-text-4)' : isToday ? '#fff' : 'var(--c-text-2)',
                    fontSize: '12px', fontWeight: isToday ? 800 : cell.current ? 500 : 400,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: '4px',
                    opacity: !cell.current ? 0.4 : 1,
                  }}>
                    {cell.day}
                  </div>

                  {/* Eventos */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {events.map(ev => (
                      <div key={ev.id} style={{
                        fontSize: '9px', fontWeight: 600,
                        color: PLAT_DOT[ev.platform],
                        borderLeft: `2px solid ${PLAT_DOT[ev.platform]}`,
                        borderRadius: '0 4px 4px 0',
                        padding: '2px 5px',
                        background: `${PLAT_DOT[ev.platform]}18`,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        maxWidth: '100%',
                      }}>
                        <span style={{ opacity: 0.7, marginRight: '3px' }}>● {ev.time}</span>
                        {ev.name}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Rodapé: legenda + botão */}
          <div style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--c-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px',
          }}>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {[['#C13584','Instagram'], ['#F97316','Google Ads'], ['#8B5CF6','Em revisão']].map(([color, label]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: color }} />
                  <span style={{ fontSize: '11px', color: 'var(--c-text-3)' }}>{label}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => navigate('/criar-anuncio')}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                background: 'var(--c-accent)', color: '#fff',
                border: 'none', borderRadius: '10px',
                padding: '9px 16px', fontSize: '12px', fontWeight: 700,
                cursor: 'pointer', transition: 'background .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--c-accent-dk)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--c-accent)'}
            >
              <PlusIcon />
              Novo agendamento
            </button>
          </div>
        </div>

        {/* ── Painel direito ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Próximos anúncios */}
          <div style={{
            background: 'var(--c-card-bg)',
            borderRadius: '16px',
            border: '1px solid var(--c-border)',
            padding: '18px',
            boxShadow: '0 2px 8px var(--c-shadow)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <CalSmall />
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--c-text-1)' }}>
                Próximos anúncios
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {UPCOMING.map(item => {
                const badge = PLAT_BADGE[item.platform] || PLAT_BADGE.instagram;
                return (
                  <div key={item.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: '12px',
                    padding: '10px',
                    borderRadius: '10px',
                    background: 'var(--c-surface)',
                    border: '1px solid var(--c-border-lt)',
                    cursor: 'pointer',
                    transition: 'all .12s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--c-border)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--c-border-lt)'}
                  >
                    {/* Data */}
                    <div style={{
                      background: 'var(--c-active-bg)',
                      borderRadius: '8px', padding: '6px 8px',
                      textAlign: 'center', flexShrink: 0,
                      minWidth: '44px',
                    }}>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--c-accent)', lineHeight: 1 }}>{item.day}</div>
                      <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--c-text-4)', letterSpacing: '1px' }}>{item.month}</div>
                    </div>

                    {/* Thumbnail */}
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '8px',
                      background: item.thumb, flexShrink: 0,
                    }} />

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '11px', color: 'var(--c-text-4)', marginBottom: '3px' }}>{item.time}</div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--c-text-1)', marginBottom: '5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.name}
                      </div>
                      <span style={{
                        fontSize: '10px', fontWeight: 600,
                        background: badge.bg, color: badge.color,
                        padding: '2px 8px', borderRadius: '20px',
                        display: 'inline-block',
                      }}>
                        {badge.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card de dica */}
          <div style={{
            background: 'var(--c-card-bg)',
            borderRadius: '16px',
            border: '1px solid var(--c-border)',
            padding: '18px',
            boxShadow: '0 2px 8px var(--c-shadow)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{
                width: '38px', height: '38px', borderRadius: '10px',
                background: 'var(--c-active-bg)', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '18px',
              }}>📅</div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-accent)', marginBottom: '5px' }}>
                  Organize melhor suas campanhas
                </div>
                <p style={{ fontSize: '11px', color: 'var(--c-text-3)', lineHeight: 1.6 }}>
                  Planeje seus anúncios com antecedência e uma estratégia consistente.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
