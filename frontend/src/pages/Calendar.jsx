import React, { useEffect, useState } from 'react';
import api from '../services/api';

const PLAT_COLOR  = { meta: '#C13584', google: '#E74C3C', manual: '#7D4A5E' };
const PLAT_LABEL  = { meta: 'Instagram', google: 'Google Ads', manual: 'Manual' };
const STATUS_COLOR = { active: '#27AE60', review: '#D97706', scheduled: '#4F46E5', paused: '#9A7070', ended: '#9A7070' };
const STATUS_LABEL = { active: 'Rodando', review: 'Em revisão', scheduled: 'Agendado', paused: 'Pausado', ended: 'Encerrado' };
const WEEK_DAYS   = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS      = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function parseLocalDate(str) {
  if (!str) return null;
  const d = new Date(str.includes('T') ? str : str + 'T00:00:00');
  return isNaN(d) ? null : d;
}

function isoDate(d) {
  return d.toISOString().split('T')[0];
}

function campaignsOnDay(campaigns, dayStr) {
  return campaigns.filter(c => {
    // Campanhas agendadas: aparece no dia do scheduled_for
    if (c.publish_mode === 'scheduled' && c.scheduled_for) {
      const sf = parseLocalDate(c.scheduled_for);
      if (sf && isoDate(sf) === dayStr) return true;
    }
    // Campanhas com período de veiculação
    const start = parseLocalDate(c.start_date);
    const end   = parseLocalDate(c.end_date);
    if (start && isoDate(start) === dayStr) return true;
    if (start && end && dayStr >= isoDate(start) && dayStr <= isoDate(end)) return true;
    return false;
  });
}

function buildCalendar(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function Calendar() {
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [campaigns, setCampaigns] = useState([]);
  const [selected,  setSelected]  = useState(null); // dia selecionado
  const [detail,    setDetail]    = useState(null);  // campanha expandida

  useEffect(() => {
    api.get('/api/campaigns').then(r => setCampaigns(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelected(null);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelected(null);
  }

  const cells = buildCalendar(year, month);
  const todayStr = isoDate(today);

  const selectedStr = selected
    ? `${year}-${String(month + 1).padStart(2,'0')}-${String(selected).padStart(2,'0')}`
    : null;

  const selectedCamps = selectedStr ? campaignsOnDay(campaigns, selectedStr) : [];

  // Total de campanhas no mês
  const monthCamps = campaigns.filter(c => {
    const start = parseLocalDate(c.start_date);
    const end   = parseLocalDate(c.end_date);
    const sf    = parseLocalDate(c.scheduled_for);
    const mStart = new Date(year, month, 1);
    const mEnd   = new Date(year, month + 1, 0);
    if (sf && sf >= mStart && sf <= mEnd) return true;
    if (start && start <= mEnd && (!end || end >= mStart)) return true;
    return false;
  });

  return (
    <div style={{ padding: '24px 28px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--c-text-1)', marginBottom: '2px' }}>Calendário de Campanhas</h2>
          <div style={{ fontSize: '12px', color: 'var(--c-text-4)' }}>{monthCamps.length} campanha{monthCamps.length !== 1 ? 's' : ''} em {MONTHS[month]}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={prevMonth} style={{ width: '34px', height: '34px', border: '1.5px solid var(--c-border)', background: 'var(--c-card-bg)', borderRadius: '9px', cursor: 'pointer', fontSize: '15px', color: 'var(--c-text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--c-text-1)', minWidth: '160px', textAlign: 'center' }}>{MONTHS[month]} {year}</span>
          <button onClick={nextMonth} style={{ width: '34px', height: '34px', border: '1.5px solid var(--c-border)', background: 'var(--c-card-bg)', borderRadius: '9px', cursor: 'pointer', fontSize: '15px', color: 'var(--c-text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 320px' : '1fr', gap: '20px', alignItems: 'start' }}>

        {/* Calendário */}
        <div style={{ background: 'var(--c-card-bg)', borderRadius: '16px', border: '1px solid var(--c-border)', boxShadow: '0 2px 12px var(--c-shadow)', overflow: 'hidden' }}>

          {/* Dias da semana */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--c-border)' }}>
            {WEEK_DAYS.map(d => (
              <div key={d} style={{ padding: '10px 0', textAlign: 'center', fontSize: '10px', fontWeight: 700, color: 'var(--c-text-4)', textTransform: 'uppercase', letterSpacing: '.7px' }}>{d}</div>
            ))}
          </div>

          {/* Células */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {cells.map((day, idx) => {
              if (!day) return <div key={`e-${idx}`} style={{ minHeight: '90px', borderRight: (idx + 1) % 7 !== 0 ? '1px solid var(--c-border-lt)' : 'none', borderBottom: idx < cells.length - 7 ? '1px solid var(--c-border-lt)' : 'none', background: 'var(--c-surface)' }} />;

              const dayStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const isToday = dayStr === todayStr;
              const isSelected = day === selected;
              const dayCamps = campaignsOnDay(campaigns, dayStr);

              return (
                <div
                  key={day}
                  onClick={() => setSelected(isSelected ? null : day)}
                  style={{
                    minHeight: '90px',
                    padding: '8px 6px 6px',
                    borderRight: (idx + 1) % 7 !== 0 ? '1px solid var(--c-border-lt)' : 'none',
                    borderBottom: idx < cells.length - 7 ? '1px solid var(--c-border-lt)' : 'none',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--c-active-bg)' : 'var(--c-card-bg)',
                    transition: 'background .15s',
                    position: 'relative',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--c-hover)'; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'var(--c-card-bg)'; }}
                >
                  {/* Número do dia */}
                  <div style={{
                    width: '22px', height: '22px', borderRadius: '50%',
                    background: isToday ? 'var(--c-accent)' : 'transparent',
                    color: isToday ? '#fff' : 'var(--c-text-2)',
                    fontSize: '12px', fontWeight: isToday ? 800 : 500,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: '4px',
                  }}>{day}</div>

                  {/* Campanhas do dia */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {dayCamps.slice(0, 3).map(c => (
                      <div key={c.id} style={{
                        fontSize: '9px', fontWeight: 600,
                        background: `color-mix(in srgb, ${PLAT_COLOR[c.platform] || '#7D4A5E'} 15%, transparent)`,
                        color: PLAT_COLOR[c.platform] || '#7D4A5E',
                        borderLeft: `2px solid ${PLAT_COLOR[c.platform] || '#7D4A5E'}`,
                        borderRadius: '0 3px 3px 0',
                        padding: '1px 4px',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        maxWidth: '100%',
                      }}>
                        {c.name}
                      </div>
                    ))}
                    {dayCamps.length > 3 && (
                      <div style={{ fontSize: '9px', color: 'var(--c-text-4)', fontWeight: 600, paddingLeft: '4px' }}>+{dayCamps.length - 3} mais</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Painel lateral — dia selecionado */}
        {selected && (
          <div style={{ background: 'var(--c-card-bg)', borderRadius: '16px', border: '1px solid var(--c-border)', boxShadow: '0 2px 12px var(--c-shadow)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text-1)' }}>
                  {selected} de {MONTHS[month]}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--c-text-4)', marginTop: '1px' }}>
                  {selectedCamps.length} campanha{selectedCamps.length !== 1 ? 's' : ''}
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--c-text-4)', lineHeight: 1 }}>×</button>
            </div>

            {selectedCamps.length === 0 ? (
              <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--c-text-4)', fontSize: '12px' }}>
                <div style={{ fontSize: '28px', marginBottom: '8px', opacity: .4 }}>📅</div>
                Nenhuma campanha neste dia.
              </div>
            ) : (
              <div style={{ padding: '12px' }}>
                {selectedCamps.map(c => {
                  const isExpanded = detail === c.id;
                  const color = PLAT_COLOR[c.platform] || '#7D4A5E';
                  const isScheduled = c.publish_mode === 'scheduled';
                  const sf = parseLocalDate(c.scheduled_for);

                  return (
                    <div key={c.id} style={{ marginBottom: '8px' }}>
                      <div
                        onClick={() => setDetail(isExpanded ? null : c.id)}
                        style={{
                          background: 'var(--c-surface)',
                          borderRadius: '10px',
                          border: `1.5px solid ${isExpanded ? color : 'var(--c-border)'}`,
                          padding: '10px 12px',
                          cursor: 'pointer',
                          transition: 'all .15s',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--c-text-1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '9px', fontWeight: 700, color, background: `color-mix(in srgb, ${color} 12%, transparent)`, padding: '2px 7px', borderRadius: '20px' }}>
                            {PLAT_LABEL[c.platform] || c.platform}
                          </span>
                          <span style={{ fontSize: '9px', fontWeight: 700, color: STATUS_COLOR[c.status], background: `color-mix(in srgb, ${STATUS_COLOR[c.status]} 12%, transparent)`, padding: '2px 7px', borderRadius: '20px' }}>
                            {STATUS_LABEL[c.status] || c.status}
                          </span>
                          {isScheduled && (
                            <span style={{ fontSize: '9px', fontWeight: 700, color: '#4F46E5', background: '#EEF2FF', padding: '2px 7px', borderRadius: '20px' }}>
                              📅 Agendado
                            </span>
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div style={{ background: 'var(--c-surface)', borderRadius: '0 0 10px 10px', border: `1.5px solid ${color}`, borderTop: 'none', padding: '10px 12px', marginTop: '-4px' }}>
                          {[
                            ['Verba/dia', `R$ ${c.budget || '—'}`],
                            ['Início', c.start_date?.split('T')[0] || '—'],
                            ['Término', c.end_date?.split('T')[0] || '—'],
                            isScheduled && sf ? ['Agendado para', sf.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })] : null,
                            ['Criado em', c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : '—'],
                            c.live_at ? ['Começou a rodar', new Date(c.live_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })] : null,
                          ].filter(Boolean).map(([l, v]) => (
                            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--c-border-lt)' }}>
                              <span style={{ fontSize: '10px', color: 'var(--c-text-4)' }}>{l}</span>
                              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--c-text-1)' }}>{v}</span>
                            </div>
                          ))}
                          {c.conversions > 0 && (
                            <div style={{ marginTop: '8px', padding: '6px 10px', background: '#E8F8EF', borderRadius: '8px', display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '10px', color: '#27AE60', fontWeight: 700 }}>Conversões</span>
                              <span style={{ fontSize: '10px', fontWeight: 800, color: '#27AE60' }}>{c.conversions}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legenda */}
      <div style={{ marginTop: '16px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '10px', color: 'var(--c-text-4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>Legenda:</span>
        {Object.entries(PLAT_LABEL).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: PLAT_COLOR[k] }} />
            <span style={{ fontSize: '11px', color: 'var(--c-text-3)' }}>{v}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'var(--c-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '8px', color: '#fff', fontWeight: 800 }}>1</span>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--c-text-3)' }}>Hoje</span>
        </div>
      </div>
    </div>
  );
}
