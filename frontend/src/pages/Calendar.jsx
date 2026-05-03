/**
 * IMPORTANT:
 * All displayed data is fictional placeholder data.
 * Real data will be loaded later from Meta Ads API.
 * Do not persist mock values.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getUpcomingCommercialDates, getCommercialDateByKey } from '../data/commercialDates';

const MONTHS_ABBR = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

function formatDateLong(d) {
  return `${String(d.getDate()).padStart(2, '0')} de ${['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'][d.getMonth()]} de ${d.getFullYear()}`;
}

function BudgetPicker({ entry, dailyBudget, setDailyBudget, period, setPeriod }) {
  const suggested = entry.suggestedBudget.daily;
  const campaignDays = entry.daysBefore;

  const multiplier = period === 'weekly' ? 7 : period === 'monthly' ? 30 : 1;
  const periodLabel = period === 'weekly' ? 'por semana' : period === 'monthly' ? 'por mês' : 'por dia';
  const periodShort = period === 'weekly' ? 'SEMANAL' : period === 'monthly' ? 'MENSAL' : 'POR DIA';

  const displayedValue = Math.round(dailyBudget * multiplier);
  const totalCampaign = Math.round(dailyBudget * campaignDays);
  const diffFromSuggested = dailyBudget - suggested;

  function handleInput(raw) {
    const n = Number(raw.replace(/\D/g, ''));
    if (!Number.isFinite(n)) return;
    const asDaily = period === 'weekly' ? n / 7 : period === 'monthly' ? n / 30 : n;
    setDailyBudget(Math.max(1, Math.round(asDaily)));
  }

  return (
    <div style={{
      padding: '14px 16px',
      background: 'linear-gradient(135deg, rgba(193,53,132,.10), rgba(125,74,94,.04))',
      border: '1px solid rgba(193,53,132,.4)',
      borderRadius: '12px',
      display: 'flex', flexDirection: 'column', gap: '12px',
    }}>
      {/* Toggle de período */}
      <div style={{ display: 'flex', gap: '4px', background: 'var(--c-surface)', padding: '3px', borderRadius: '9px', width: 'fit-content', border: '1px solid var(--c-border)' }}>
        {[['daily','Diário'], ['weekly','Semanal'], ['monthly','Mensal']].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setPeriod(k)}
            style={{
              padding: '6px 12px', borderRadius: '7px', border: 'none',
              background: period === k ? 'rgba(193,53,132,.18)' : 'transparent',
              color: period === k ? 'var(--c-accent)' : 'var(--c-text-3)',
              fontSize: '11.5px', fontWeight: 700, cursor: 'pointer',
              boxShadow: period === k ? 'inset 0 0 0 1px rgba(193,53,132,.4)' : 'none',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Input editável grande + sugestão ao lado */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        <div style={{
          padding: '14px 18px',
          background: 'var(--c-surface)',
          border: '2px solid var(--c-accent)',
          borderRadius: '12px',
          minWidth: '200px',
          flex: '1 1 200px',
          boxShadow: '0 0 18px rgba(193,53,132,.18)',
        }}>
          <div style={{ fontSize: '10.5px', fontWeight: 500, color: 'var(--c-text-3)', letterSpacing: '1.2px', marginBottom: '4px' }}>
            {periodShort}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--c-accent)' }}>R$</span>
            <input
              type="text"
              inputMode="numeric"
              value={displayedValue}
              onChange={e => handleInput(e.target.value)}
              style={{
                width: '140px', border: 'none', outline: 'none',
                background: 'transparent', fontSize: '28px', fontWeight: 800,
                color: 'var(--c-accent)', fontFamily: 'inherit', padding: 0,
                fontFeatureSettings: "'tnum'", letterSpacing: '-0.02em',
              }}
            />
          </div>
        </div>
        <div style={{ fontSize: '11.5px', color: 'var(--c-text-3)', lineHeight: 1.5, fontWeight: 400 }}>
          <div>Sugerido: <strong style={{ color: 'var(--c-text-1)', fontFeatureSettings: "'tnum'" }}>R$ {suggested}/dia</strong></div>
          <div style={{ color: diffFromSuggested < 0 ? '#34D399' : diffFromSuggested > 0 ? '#FBBF24' : 'var(--c-text-4)' }}>
            {diffFromSuggested === 0
              ? '= sugestão'
              : diffFromSuggested < 0
                ? `↓ R$ ${Math.abs(diffFromSuggested)}/dia abaixo`
                : `↑ R$ ${diffFromSuggested}/dia acima`}
          </div>
        </div>
      </div>

      {/* Resumo */}
      <div style={{ fontSize: '11.5px', color: 'var(--c-text-2)', lineHeight: 1.6, borderTop: '1px dashed var(--c-border)', paddingTop: '10px', fontWeight: 400 }}>
        <div>
          Campanha de <strong style={{ fontWeight: 700 }}>{campaignDays} dia{campaignDays > 1 ? 's' : ''}</strong>: investimento total{' '}
          <strong style={{ color: 'var(--c-accent)', fontWeight: 700, fontFeatureSettings: "'tnum'" }}>R$ {totalCampaign}</strong>
          {' '}(R$ {dailyBudget} {periodLabel === 'por dia' ? 'por dia' : `· equivalente a R$ ${displayedValue} ${periodLabel}`})
        </div>
        <div style={{ fontSize: '11px', color: 'var(--c-text-4)', marginTop: '4px' }}>
          {entry.suggestedBudget.reason}
        </div>
      </div>
    </div>
  );
}

function CommercialDateModal({ entry, onClose, onCreateAd }) {
  const [dailyBudget, setDailyBudget] = useState(entry?.suggestedBudget?.daily || 20);
  const [period, setPeriod] = useState('daily');
  useEffect(() => {
    if (entry?.suggestedBudget?.daily) setDailyBudget(entry.suggestedBudget.daily);
    setPeriod('daily');
  }, [entry?.id]);

  if (!entry) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200, padding: '20px',
      }}
    >
      <div
        className="ccb-card ccb-modal"
        onClick={e => e.stopPropagation()}
        style={{
          borderRadius: '18px',
          padding: 0,
          width: '100%', maxWidth: '620px',
          maxHeight: '88vh', overflow: 'auto',
        }}
      >
        <div style={{
          padding: '22px 24px 18px',
          borderBottom: '1px solid var(--c-border)',
          display: 'flex', alignItems: 'flex-start', gap: '14px',
        }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            background: 'var(--c-active-bg)',
            border: '1px solid rgba(193,53,132,.4)',
            flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '24px',
            boxShadow: '0 0 14px rgba(193,53,132,.18)',
          }}>{entry.emoji}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--c-text-1)', marginBottom: '4px', letterSpacing: '-0.005em' }}>
              {entry.name}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--c-text-3)', fontWeight: 400 }}>
              {formatDateLong(entry.date)} · poste com <strong style={{ color: 'var(--c-accent)', fontWeight: 700 }}>{entry.daysBefore} dias</strong> de antecedência
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '30px', height: '30px', borderRadius: '8px',
              border: '1px solid var(--c-border)', background: 'var(--c-surface)',
              cursor: 'pointer', color: 'var(--c-text-3)', fontSize: '16px', lineHeight: 1,
            }}
          >×</button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          <Section title="Por que é importante para a Cris Costa Beauty">
            <p style={{ fontSize: '13px', color: 'var(--c-text-2)', lineHeight: 1.65, margin: 0, fontWeight: 400 }}>
              {entry.whyImportant}
            </p>
          </Section>

          <Section title="Ações sugeridas">
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {entry.actions.map((a, i) => (
                <li key={i} style={{
                  fontSize: '12.5px', color: 'var(--c-text-2)', lineHeight: 1.55,
                  padding: '9px 12px', borderRadius: '10px',
                  background: 'var(--c-surface)', border: '1px solid var(--c-border)',
                  fontWeight: 400,
                }}>
                  <span style={{ color: 'var(--c-accent)', marginRight: '8px', fontWeight: 700 }}>→</span>
                  {a}
                </li>
              ))}
            </ul>
          </Section>

          {entry.suggestedBudget && (
            <Section title="Orçamento — ajuste para sua realidade">
              <BudgetPicker
                entry={entry}
                dailyBudget={dailyBudget}
                setDailyBudget={setDailyBudget}
                period={period}
                setPeriod={setPeriod}
              />
            </Section>
          )}

          <Section title="Diretrizes de comunicação">
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {entry.communication.map((c, i) => (
                <li key={i} style={{ fontSize: '12px', color: 'var(--c-text-3)', lineHeight: 1.55, display: 'flex', gap: '8px', fontWeight: 400 }}>
                  <span style={{ color: 'var(--c-accent)' }}>✓</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
            <div style={{
              marginTop: '10px', padding: '10px 12px',
              background: 'rgba(248,113,113,.10)', border: '1px solid rgba(248,113,113,.3)', borderRadius: '10px',
              fontSize: '11.5px', color: '#F87171', lineHeight: 1.55, fontWeight: 400,
            }}>
              <strong style={{ fontWeight: 700 }}>Evite:</strong> "promoção", "desconto", "liquidação". Use "condição especial", "oportunidade", "poucas vagas", "exclusivo".
            </div>
          </Section>
        </div>

        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--c-border)',
          display: 'flex', justifyContent: 'flex-end', gap: '10px',
          background: 'var(--c-surface)',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 14px', borderRadius: '10px',
              border: '1px solid var(--c-border)', background: 'var(--c-surface)',
              fontSize: '13px', fontWeight: 600, color: 'var(--c-text-2)', cursor: 'pointer',
            }}
          >Fechar</button>
          <button
            onClick={() => onCreateAd(entry, { dailyBudget })}
            style={{
              padding: '11px 18px', borderRadius: '12px',
              border: 0,
              background: 'linear-gradient(135deg, var(--c-accent), var(--c-accent-dk))',
              fontSize: '13px', fontWeight: 700, color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px',
              boxShadow: '0 8px 24px rgba(193,53,132,.4), inset 0 1px 0 rgba(255,255,255,.18)',
            }}
          >
            <PlusIcon /> Criar anúncio · R$ {dailyBudget}/dia
          </button>
        </div>
      </div>
    </div>
  );
}

function DayDetailsModal({ dateStr, events, commercial, onClose, onOpenCommercial, onCreateForDate }) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const title = formatDateLong(dateObj);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200, padding: '20px',
      }}
    >
      <div
        className="ccb-card ccb-modal"
        onClick={e => e.stopPropagation()}
        style={{
          borderRadius: '18px',
          padding: 0,
          width: '100%', maxWidth: '480px',
          maxHeight: '85vh', overflow: 'auto',
        }}
      >
        <div style={{
          padding: '18px 20px',
          borderBottom: '1px solid var(--c-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
        }}>
          <div>
            <div style={{ fontSize: '10.5px', fontWeight: 500, color: 'var(--c-text-3)', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: '2px' }}>
              Detalhes do dia
            </div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--c-text-1)', letterSpacing: '-0.005em' }}>
              {title}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '28px', height: '28px', borderRadius: '8px',
              border: '1px solid var(--c-border)', background: 'var(--c-surface)',
              cursor: 'pointer', color: 'var(--c-text-3)', fontSize: '15px', lineHeight: 1,
            }}
          >×</button>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {commercial && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(193,53,132,.16), rgba(125,74,94,.06))',
              border: '1px solid rgba(193,53,132,.55)',
              borderRadius: '12px',
              padding: '12px 14px',
              boxShadow: '0 0 18px rgba(193,53,132,.16), inset 0 1px 0 rgba(255,194,228,.18)',
            }}>
              <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--c-accent)', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '6px' }}>
                Data comercial
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <span style={{ fontSize: '22px' }}>{commercial.emoji}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--c-text-1)', lineHeight: 1.3 }}>
                    {commercial.name}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--c-text-3)', marginTop: '2px', fontWeight: 400 }}>
                    Postar com <strong style={{ color: 'var(--c-accent)', fontWeight: 700 }}>{commercial.daysBefore} dias</strong> de antecedência
                  </div>
                </div>
              </div>
              <button
                onClick={() => onOpenCommercial(commercial)}
                style={{
                  padding: '9px 14px', borderRadius: '10px',
                  background: 'linear-gradient(135deg, var(--c-accent), var(--c-accent-dk))',
                  color: '#fff',
                  border: 'none', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 6px 18px rgba(193,53,132,.4), inset 0 1px 0 rgba(255,255,255,.18)',
                }}
              >
                Ver estratégia completa →
              </button>
            </div>
          )}

          {!commercial && events.length === 0 && (
            <div style={{
              padding: '18px 16px', textAlign: 'center',
              background: 'var(--c-surface)',
              border: '1px dashed var(--c-border)',
              borderRadius: '12px',
            }}>
              <div style={{ fontSize: '24px', marginBottom: '6px', opacity: 0.7 }}>📅</div>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '4px' }}>
                Dia livre
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--c-text-3)', lineHeight: 1.5, fontWeight: 400 }}>
                Nenhum anúncio agendado nem data comercial. Use o botão abaixo para criar um anúncio para este dia.
              </div>
            </div>
          )}

          {events.length > 0 && (
            <div>
              <div style={{ fontSize: '10.5px', fontWeight: 500, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '8px' }}>
                Anúncios agendados ({events.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {events.map(ev => {
                  const badge = PLAT_BADGE[ev.platform] || PLAT_BADGE.instagram;
                  return (
                    <div key={ev.id} style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '10px 12px', borderRadius: '10px',
                      background: 'var(--c-surface)',
                      border: '1px solid var(--c-border)',
                      borderLeft: `3px solid ${PLAT_DOT[ev.platform]}`,
                    }}>
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '8px',
                        background: ev.thumb, flexShrink: 0,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '10.5px', color: 'var(--c-text-3)', marginBottom: '1px', fontWeight: 400 }}>
                          {ev.time}
                        </div>
                        <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--c-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ev.name}
                        </div>
                      </div>
                      <span style={{
                        fontSize: '10.5px', fontWeight: 700,
                        background: badge.bg, color: badge.color,
                        border: `1px solid ${badge.border}`,
                        padding: '4px 9px', borderRadius: '999px',
                        flexShrink: 0, letterSpacing: '.3px',
                      }}>{badge.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--c-border)',
          background: 'var(--c-surface)',
          display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 14px', borderRadius: '10px',
              border: '1px solid var(--c-border)', background: 'var(--c-surface)',
              fontSize: '13px', fontWeight: 600, color: 'var(--c-text-2)', cursor: 'pointer',
            }}
          >Fechar</button>
          <button
            onClick={() => onCreateForDate(dateStr)}
            style={{
              padding: '11px 18px', borderRadius: '12px',
              border: 0,
              background: 'linear-gradient(135deg, var(--c-accent), var(--c-accent-dk))',
              fontSize: '13px', fontWeight: 700, color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px',
              boxShadow: '0 8px 24px rgba(193,53,132,.4), inset 0 1px 0 rgba(255,255,255,.18)',
            }}
          >
            <PlusIcon /> Agendar para este dia
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '18px' }}>
      <div style={{
        fontSize: '11px', fontWeight: 500, letterSpacing: '1.2px',
        color: 'var(--c-text-3)', textTransform: 'uppercase', marginBottom: '8px',
      }}>{title}</div>
      {children}
    </div>
  );
}

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
  instagram: { label: 'Instagram',  bg: 'rgba(193,53,132,.18)', border: 'rgba(193,53,132,.4)', color: 'var(--c-accent)' },
  google:    { label: 'Google Ads', bg: 'rgba(251,191,36,.16)', border: 'rgba(251,191,36,.3)', color: '#FBBF24' },
  meta:      { label: 'Meta Ads',   bg: 'rgba(96,165,250,.16)', border: 'rgba(96,165,250,.3)', color: '#60A5FA' },
  review:    { label: 'Em revisão', bg: 'rgba(167,139,250,.16)',border: 'rgba(167,139,250,.3)',color: '#A78BFA' },
};

const PLAT_DOT = {
  instagram: 'var(--c-accent)',
  google:    '#FBBF24',
  meta:      '#60A5FA',
  review:    '#A78BFA',
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
  const location = useLocation();
  const today    = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [modalEntry, setModalEntry] = useState(null);
  const [dayDetails, setDayDetails] = useState(null);

  const upcomingCommercial = useMemo(() => getUpcomingCommercialDates(new Date(), 45), []);

  /* Abrir modal automaticamente quando vier do Dashboard via state */
  useEffect(() => {
    const key = location.state?.openCommercialKey;
    if (!key) return;
    const entry = getCommercialDateByKey(key);
    if (entry) {
      setYear(entry.date.getFullYear());
      setMonth(entry.date.getMonth());
      setModalEntry(entry);
    }
    window.history.replaceState({}, document.title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCommercialModal(entry) { setModalEntry(entry); }
  function closeCommercialModal() { setModalEntry(null); }
  function createAdForDate(entry, overrides = {}) {
    const dailyBudget = overrides.dailyBudget ?? entry.suggestedBudget?.daily;
    navigate('/criar-anuncio', { state: { commercialDate: {
      id: entry.id,
      name: entry.name,
      emoji: entry.emoji,
      dateISO: entry.date.toISOString(),
      daysBefore: entry.daysBefore,
      preFill: entry.preFill,
      dailyBudget,
    } } });
  }

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
    <div className="page-container">

      {/* ── Cabeçalho ── */}
      <div style={{ marginBottom: '22px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--c-text-1)', marginBottom: '4px', letterSpacing: '-0.01em' }}>Calendário</h1>
        <p style={{ fontSize: '13px', color: 'var(--c-text-3)', fontWeight: 400 }}>
          Visualize e <span style={{ color: 'var(--c-accent)', fontWeight: 600 }}>planeje</span> suas campanhas.
        </p>
      </div>

      {/* ── Layout: calendário + painel direito ── */}
      <div className="calendar-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px', alignItems: 'start' }}>

        {/* ── Calendário principal ── */}
        <div className="ccb-card" style={{
          borderRadius: '18px',
          padding: 0,
          overflow: 'hidden',
        }}>
          {/* Nav do mês */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px', borderBottom: '1px solid var(--c-border)',
          }}>
            <button
              onClick={prevMonth}
              style={{ width: '32px', height: '32px', border: '1px solid var(--c-border)', background: 'var(--c-surface)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-2)' }}
            ><ChevLeft /></button>
            <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--c-text-1)', letterSpacing: '-0.005em' }}>
              {MONTHS[month]} {year}
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={nextMonth}
                style={{ width: '32px', height: '32px', border: '1px solid var(--c-border)', background: 'var(--c-surface)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-2)' }}
              ><ChevRight /></button>
              <button style={{
                padding: '8px 14px', borderRadius: '10px',
                border: '1px solid var(--c-border)', background: 'var(--c-surface)',
                fontSize: '12.5px', fontWeight: 600, color: 'var(--c-text-2)', cursor: 'pointer',
              }}>Hoje</button>
            </div>
          </div>

          {/* Cabeçalho dos dias da semana */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--c-border)' }}>
            {WEEK_DAYS.map(d => (
              <div key={d} style={{
                padding: '10px 0', textAlign: 'center',
                fontSize: '10.5px', fontWeight: 500,
                color: 'var(--c-text-3)', letterSpacing: '1.2px',
              }}>{d}</div>
            ))}
          </div>

          {/* Células do calendário */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {cells.map((cell, idx) => {
              const key = cell.current ? dayKey(cell.day) : null;
              const events = key ? (MOCK_EVENTS[key] || []) : [];
              const commercial = key ? getCommercialDateByKey(key) : null;
              const isToday = key === todayStr;
              const isLastRow = idx >= cells.length - 7;

              const isClickable = cell.current;

              return (
                <div
                  key={idx}
                  onClick={() => {
                    if (!isClickable) return;
                    setDayDetails({ dateStr: key, events, commercial });
                  }}
                  style={{
                    minHeight: '100px',
                    padding: '8px 6px 6px',
                    position: 'relative',
                    borderRight: (idx + 1) % 7 !== 0 ? '1px solid var(--c-border-lt)' : 'none',
                    borderBottom: !isLastRow ? '1px solid var(--c-border-lt)' : 'none',
                    background: !cell.current ? 'rgba(0,0,0,.18)' : isToday ? 'var(--c-active-bg)' : 'transparent',
                    cursor: isClickable ? 'pointer' : 'default',
                    transition: 'background .12s',
                  }}
                  onMouseEnter={e => { if (isClickable && !isToday) e.currentTarget.style.background = 'var(--c-hover)'; }}
                  onMouseLeave={e => { if (isClickable && !isToday) e.currentTarget.style.background = 'transparent'; }}
                >
                  {/* Número do dia */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <div style={{
                      width: '26px', height: '26px', borderRadius: '50%',
                      background: isToday ? 'var(--c-accent)' : 'transparent',
                      color: !cell.current ? 'var(--c-text-4)' : isToday ? '#fff' : 'var(--c-text-2)',
                      fontSize: '12.5px', fontWeight: isToday ? 800 : 500,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: !cell.current ? 0.4 : 1,
                      fontFeatureSettings: "'tnum'",
                      boxShadow: isToday ? '0 0 14px rgba(193,53,132,.5)' : 'none',
                    }}>
                      {cell.day}
                    </div>
                    {commercial && (
                      <span
                        title={commercial.name}
                        style={{ fontSize: '14px', lineHeight: 1 }}
                      >{commercial.emoji}</span>
                    )}
                  </div>

                  {/* Eventos */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {commercial && (
                      <div style={{
                        fontSize: '9.5px', fontWeight: 700,
                        color: 'var(--c-accent)',
                        borderLeft: '2px solid var(--c-accent)',
                        borderRadius: '0 4px 4px 0',
                        padding: '2px 5px',
                        background: 'rgba(193,53,132,.18)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        maxWidth: '100%',
                      }}>{commercial.name}</div>
                    )}
                    {events.map(ev => (
                      <div key={ev.id} style={{
                        fontSize: '9.5px', fontWeight: 600,
                        color: PLAT_DOT[ev.platform],
                        borderLeft: `2px solid ${PLAT_DOT[ev.platform]}`,
                        borderRadius: '0 4px 4px 0',
                        padding: '2px 5px',
                        background: `${PLAT_DOT[ev.platform]}24`,
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
              {[['var(--c-accent)','Instagram'], ['#FBBF24','Google Ads'], ['#A78BFA','Em revisão']].map(([color, label]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}` }} />
                  <span style={{ fontSize: '11.5px', color: 'var(--c-text-3)', fontWeight: 400 }}>{label}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => navigate('/criar-anuncio')}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '11px 18px', borderRadius: '12px',
                border: 0,
                background: 'linear-gradient(135deg, var(--c-accent), var(--c-accent-dk))',
                color: '#fff',
                fontSize: '13px', fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(193,53,132,.4), inset 0 1px 0 rgba(255,255,255,.18)',
                transition: 'transform .15s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <PlusIcon />
              Criar anúncio
            </button>
          </div>
        </div>

        {/* ── Painel direito ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Próximos anúncios */}
          <div className="ccb-card" style={{
            borderRadius: '18px',
            padding: '18px 20px',
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
                    borderRadius: '12px',
                    background: 'var(--c-surface)',
                    border: '1px solid var(--c-border)',
                    cursor: 'pointer',
                    transition: 'all .12s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--c-glass-border-2)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--c-border)'}
                  >
                    {/* Data */}
                    <div style={{
                      background: 'var(--c-active-bg)',
                      border: '1px solid rgba(193,53,132,.4)',
                      borderRadius: '10px', padding: '6px 8px',
                      textAlign: 'center', flexShrink: 0,
                      minWidth: '44px',
                      boxShadow: '0 0 14px rgba(193,53,132,.18)',
                    }}>
                      <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--c-accent)', lineHeight: 1, fontFeatureSettings: "'tnum'" }}>{item.day}</div>
                      <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--c-accent)', letterSpacing: '1px', opacity: 0.85 }}>{item.month}</div>
                    </div>

                    {/* Thumbnail */}
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '8px',
                      background: item.thumb, flexShrink: 0,
                      border: '1px solid var(--c-border)',
                    }} />

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '10.5px', fontWeight: 700,
                          background: badge.bg, color: badge.color,
                          border: `1px solid ${badge.border}`,
                          padding: '4px 9px', borderRadius: '999px',
                          whiteSpace: 'nowrap', letterSpacing: '.3px',
                        }}>
                          {badge.label}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--c-text-4)', fontWeight: 400 }}>{item.time}</span>
                      </div>
                      <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--c-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.name}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Datas comerciais BR — 45 dias à frente */}
          <div className="ccb-card" style={{
            borderRadius: '18px',
            padding: '18px 20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{ fontSize: '16px' }}>🗓️</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--c-text-1)' }}>
                Datas comerciais
              </span>
            </div>
            <p style={{ fontSize: '11.5px', color: 'var(--c-text-3)', lineHeight: 1.5, marginBottom: '14px', fontWeight: 400 }}>
              Próximos 45 dias. Clique para ver estratégia e criar anúncio.
            </p>

            {upcomingCommercial.length === 0 ? (
              <div style={{ fontSize: '11.5px', color: 'var(--c-text-4)', padding: '8px 0', fontWeight: 400 }}>
                Nenhuma data comercial relevante nos próximos 45 dias.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {upcomingCommercial.map(entry => (
                  <button
                    key={entry.key}
                    onClick={() => openCommercialModal(entry)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '9px 10px', borderRadius: '12px',
                      background: 'var(--c-surface)',
                      border: '1px solid var(--c-border)',
                      cursor: 'pointer', textAlign: 'left',
                      transition: 'all .12s',
                      width: '100%',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(193,53,132,.55)'; e.currentTarget.style.background = 'var(--c-hover)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--c-border)'; e.currentTarget.style.background = 'var(--c-surface)'; }}
                  >
                    <div style={{
                      background: 'var(--c-active-bg)',
                      border: '1px solid rgba(193,53,132,.4)',
                      borderRadius: '10px', padding: '5px 6px',
                      textAlign: 'center', flexShrink: 0,
                      minWidth: '40px',
                      boxShadow: '0 0 14px rgba(193,53,132,.18)',
                    }}>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--c-accent)', lineHeight: 1, fontFeatureSettings: "'tnum'" }}>
                        {String(entry.date.getDate()).padStart(2, '0')}
                      </div>
                      <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--c-accent)', letterSpacing: '1px', opacity: 0.85 }}>
                        {MONTHS_ABBR[entry.date.getMonth()]}
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '12.5px', fontWeight: 700, color: 'var(--c-text-1)',
                        marginBottom: '2px',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        <span style={{ marginRight: '5px' }}>{entry.emoji}</span>
                        {entry.name}
                      </div>
                      <div style={{ fontSize: '10.5px', color: 'var(--c-text-3)', fontWeight: 400 }}>
                        {entry.daysUntil === 0 ? 'hoje' : entry.daysUntil === 1 ? 'amanhã' : `em ${entry.daysUntil} dias`}
                        {' · '}
                        <span style={{ color: 'var(--c-accent)', fontWeight: 600 }}>
                          postar com {entry.daysBefore}d
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <DayDetailsModal
        dateStr={dayDetails?.dateStr}
        events={dayDetails?.events || []}
        commercial={dayDetails?.commercial}
        onClose={() => setDayDetails(null)}
        onOpenCommercial={(entry) => { setDayDetails(null); openCommercialModal(entry); }}
        onCreateForDate={(dateStr) => {
          setDayDetails(null);
          navigate('/criar-anuncio', { state: { scheduledFor: dateStr } });
        }}
      />

      <CommercialDateModal
        entry={modalEntry}
        onClose={closeCommercialModal}
        onCreateAd={createAdForDate}
      />
    </div>
  );
}
