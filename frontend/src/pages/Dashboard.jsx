import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import NewCampaignWizard from '../components/NewCampaignWizard';

const PLAT_COLORS = { meta: '#C13584', google: '#E74C3C', manual: '#7D4A5E' };
const PLAT_LABELS = { meta: 'Instagram', google: 'Google Ads', manual: 'Manual' };
const PLAT_BG_L   = { meta: '#FDE8F4', google: '#FDEAED', manual: '#EDE0E8' };
const PLAT_BG_D   = { meta: '#3A1030', google: '#3A1018', manual: '#2A1028' };

const STATUS_COLOR = { active: '#27AE60', review: '#D97706', scheduled: '#4F46E5', paused: '#9A7070', ended: '#9A7070' };
const STATUS_LABEL = { active: 'Rodando', review: 'Em revisão', scheduled: 'Agendado', paused: 'Pausado', ended: 'Encerrado' };

const MOCK_DELTA = {
  meta:   { ontem: +14, mes: +38 },
  google: { ontem: -3,  mes: +12 },
};

function DeltaBadge({ val }) {
  const up = val >= 0;
  return (
    <span style={{ fontSize: '11px', fontWeight: 700, color: up ? '#27AE60' : '#E74C3C', background: up ? '#E8F8EF' : '#FDEAED', padding: '2px 8px', borderRadius: '20px' }}>
      {up ? '↑' : '↓'} {Math.abs(val)}%
    </span>
  );
}

function PlatformBlock({ platform, campaigns, totalSpent }) {
  const cs     = campaigns.filter(c => c.platform === platform);
  const spent  = cs.reduce((s, c) => s + parseFloat(c.spent  || 0), 0);
  const budget = cs.reduce((s, c) => s + parseFloat(c.budget || 0), 0);
  const clicks = cs.reduce((s, c) => s + (c.clicks      || 0), 0);
  const impr   = cs.reduce((s, c) => s + (c.impressions || 0), 0);
  const conv   = cs.reduce((s, c) => s + (c.conversions || 0), 0);
  const active = cs.filter(c => c.status === 'active').length;
  const ctr    = impr > 0 ? ((clicks / impr) * 100).toFixed(1) : '—';
  const pctTotal = totalSpent > 0 ? ((spent / totalSpent) * 100).toFixed(0) : 0;
  const d      = MOCK_DELTA[platform] || { ontem: 0, mes: 0 };
  const color  = PLAT_COLORS[platform];
  const label  = PLAT_LABELS[platform];
  const icon   = platform === 'meta' ? '📸' : platform === 'google' ? '🔴' : '📣';
  const pctBar = budget * 30 > 0 ? Math.min((spent / (budget * 30)) * 100, 100) : 0;
  const barColor = pctBar > 85 ? '#E74C3C' : pctBar > 60 ? '#E67E22' : color;

  if (cs.length === 0) return null;

  return (
    <div style={{ background: 'var(--c-card-bg)', borderRadius: '16px', border: '1px solid var(--c-border)', boxShadow: '0 2px 12px var(--c-shadow)', overflow: 'hidden', transition: 'background .25s ease' }}>
      {/* Header */}
      <div style={{ background: `color-mix(in srgb, ${color} 12%, var(--c-surface))`, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--c-border-lt)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', background: 'var(--c-card-bg)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', boxShadow: '0 1px 4px var(--c-shadow)' }}>
            {icon}
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text-1)' }}>{label}</div>
            <div style={{ fontSize: '10px', color: 'var(--c-text-4)', marginTop: '1px' }}>{active} campanha{active !== 1 ? 's' : ''} ativa{active !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '10px', color: 'var(--c-text-4)', fontWeight: 600, marginBottom: '2px' }}>PARTICIPAÇÃO</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color }}>{pctTotal}%</div>
        </div>
      </div>

      {/* Métricas */}
      <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', borderBottom: '1px solid var(--c-border-lt)' }}>
        {[['Investido', `R$ ${spent.toFixed(0)}`], ['Cliques', clicks.toLocaleString('pt-BR')], ['CTR', `${ctr}%`]].map(([lbl, val]) => (
          <div key={lbl}>
            <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--c-text-4)', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: '3px' }}>{lbl}</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--c-text-1)', lineHeight: 1 }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Variações + barra */}
      <div style={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '9px', color: 'var(--c-text-4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '4px' }}>vs Ontem</div>
            <DeltaBadge val={d.ontem} />
          </div>
          <div>
            <div style={{ fontSize: '9px', color: 'var(--c-text-4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '4px' }}>vs Mês</div>
            <DeltaBadge val={d.mes} />
          </div>
          <div>
            <div style={{ fontSize: '9px', color: 'var(--c-text-4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '4px' }}>Conversões</div>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text-1)' }}>{conv}</span>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--c-text-4)', marginBottom: '5px' }}>
          <span>Gasto / Orçamento mensal</span>
          <strong style={{ color: 'var(--c-text-1)' }}>R$ {spent.toFixed(0)} / R$ {(budget * 30).toFixed(0)}</strong>
        </div>
        <div style={{ height: '5px', background: 'var(--c-border)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pctBar}%`, background: barColor, borderRadius: '3px', transition: 'width .6s' }} />
        </div>
      </div>
    </div>
  );
}

function CampaignCard({ c, onToggle, onEdit, onDelete }) {
  const pct = c.budget > 0 ? Math.min((c.spent / (c.budget * 30)) * 100, 100) : 0;
  const fillColor = pct > 85 ? '#E74C3C' : pct > 60 ? '#E67E22' : 'var(--c-accent)';
  const isActive  = c.status === 'active';
  const platColor = PLAT_COLORS[c.platform] || '#7D4A5E';

  return (
    <div
      style={{ background: 'var(--c-card-bg)', borderRadius: '14px', border: '1px solid var(--c-border)', boxShadow: '0 1px 6px var(--c-shadow)', overflow: 'hidden', transition: 'box-shadow .2s, transform .2s, background .25s ease', animation: 'fadeIn .3s ease' }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 6px 20px var(--c-shadow-md)`; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 6px var(--c-shadow)'; e.currentTarget.style.transform = 'none'; }}
    >
      <div style={{ height: '5px', background: platColor }} />

      <div style={{ padding: '14px 16px' }}>
        {/* Badge + toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ background: `color-mix(in srgb, ${platColor} 15%, var(--c-surface))`, color: platColor, fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px' }}>
            {PLAT_LABELS[c.platform] || c.platform}
          </span>
          <label style={{ position: 'relative', width: '36px', height: '20px', flexShrink: 0, cursor: 'pointer' }}>
            <input type="checkbox" checked={isActive} onChange={() => onToggle(c)} style={{ opacity: 0, width: 0, height: 0 }} />
            <span style={{ position: 'absolute', inset: 0, borderRadius: '20px', background: isActive ? 'var(--c-accent)' : 'var(--c-border)', transition: '.2s' }}>
              <span style={{ position: 'absolute', width: '14px', height: '14px', background: '#fff', borderRadius: '50%', top: '3px', left: isActive ? '19px' : '3px', transition: '.2s', boxShadow: '0 1px 3px rgba(0,0,0,.15)' }} />
            </span>
          </label>
        </div>

        {/* Nome + status */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text-1)', lineHeight: 1.3, marginBottom: '3px' }}>{c.name}</div>
          <span style={{ fontSize: '10px', fontWeight: 600, color: STATUS_COLOR[c.status] }}>● {STATUS_LABEL[c.status]}</span>
        </div>

        {/* Métricas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '5px', marginBottom: '12px' }}>
          {[
            ['Verba/dia', `R$ ${c.budget || 0}`],
            ['CPC',       c.clicks > 0 ? `R$ ${(c.spent / c.clicks).toFixed(2)}` : '—'],
            ['CTR',       c.impressions > 0 ? `${((c.clicks / c.impressions) * 100).toFixed(1)}%` : '—'],
            ['Cliques',   (c.clicks || 0).toLocaleString('pt-BR')],
            ['Impressões',(c.impressions || 0).toLocaleString('pt-BR')],
            ['Conversões', c.conversions || 0],
          ].map(([l, v]) => (
            <div key={l} style={{ background: 'var(--c-surface)', borderRadius: '8px', padding: '6px 8px', transition: 'background .25s ease' }}>
              <div style={{ fontSize: '9px', color: 'var(--c-text-4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '2px' }}>{l}</div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--c-text-1)' }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Barra */}
        <div style={{ marginBottom: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--c-text-4)', marginBottom: '4px' }}>
            <span>Gasto</span>
            <strong style={{ color: 'var(--c-text-1)' }}>R$ {c.spent || 0} / R$ {(c.budget || 0) * 30}</strong>
          </div>
          <div style={{ height: '4px', background: 'var(--c-border)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: fillColor, borderRadius: '3px', transition: 'width .6s' }} />
          </div>
        </div>

        {/* Ações */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--c-border-lt)' }}>
          <span style={{ fontSize: '10px', color: 'var(--c-text-4)' }}>📅 {c.start_date?.split('T')[0] || '—'}</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[['✏️', 'Editar'], ['🗑️', 'Remover']].map(([ic, tip]) => (
              <button
                key={tip} title={tip}
                onClick={() => { if (tip === 'Editar') onEdit(c); if (tip === 'Remover') onDelete(c); }}
                style={{ width: '26px', height: '26px', borderRadius: '7px', background: 'var(--c-surface)', border: 'none', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--c-active-bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--c-surface)'}
              >{ic}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BudgetAlertCard() {
  const [status, setStatus]     = useState(null);
  const [testing, setTesting]   = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    api.get('/api/alerts/status').then(r => setStatus(r.data)).catch(() => {});
  }, []);

  async function sendTest() {
    setTesting(true); setTestResult(null);
    try {
      const r = await api.post('/api/alerts/test');
      setTestResult({ ok: true, results: r.data.results });
    } catch { setTestResult({ ok: false }); }
    finally { setTesting(false); }
  }

  if (!status) return null;

  const balance = status.balance ?? null;
  const isLow   = balance !== null && balance < 20;

  return (
    <div style={{ background: 'var(--c-card-bg)', borderRadius: '14px', border: `1.5px solid ${isLow ? '#E74C3C' : 'var(--c-border)'}`, boxShadow: '0 1px 6px var(--c-shadow)', padding: '16px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', position: 'relative', overflow: 'hidden', transition: 'background .25s ease' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: isLow ? '#E74C3C' : 'var(--c-accent)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '22px' }}>{isLow ? '🚨' : '🔔'}</span>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--c-text-4)', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: '3px' }}>Monitor de Saldo — Meta Ads</div>
          {balance !== null ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '20px', fontWeight: 800, color: isLow ? '#E74C3C' : 'var(--c-text-1)' }}>R$ {balance.toFixed(2)}</span>
              {isLow && <span style={{ fontSize: '10px', fontWeight: 700, color: '#E74C3C', background: '#FDEAED', padding: '2px 8px', borderRadius: '20px' }}>SALDO BAIXO</span>}
            </div>
          ) : (
            <div style={{ fontSize: '12px', color: 'var(--c-text-4)' }}>Meta Ads não conectado</div>
          )}
          <div style={{ fontSize: '10px', color: 'var(--c-text-4)', marginTop: '2px' }}>
            Alertas: {status.recipients?.phone1 ? `...${status.recipients.phone1.slice(-4)}` : '—'} · {status.recipients?.phone2 ? `...${status.recipients.phone2.slice(-4)}` : '—'}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
        <button onClick={sendTest} disabled={testing} style={{ background: testing ? 'var(--c-border)' : 'var(--c-text-1)', color: testing ? 'var(--c-text-4)' : 'var(--c-card-bg)', border: 'none', borderRadius: '9px', padding: '7px 14px', fontSize: '11px', fontWeight: 700, cursor: testing ? 'not-allowed' : 'pointer', transition: 'all .15s' }}>
          {testing ? 'Enviando...' : '📲 Testar WhatsApp'}
        </button>
        {testResult && (
          <div style={{ fontSize: '10px', fontWeight: 600, color: testResult.ok ? '#27AE60' : '#E74C3C' }}>
            {testResult.ok ? `✓ Enviado para ${testResult.results?.filter(r => r.success).length} número(s)` : '✗ Erro ao enviar'}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard({ searchQuery = '' }) {
  const [campaigns, setCampaigns]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState('');
  const [showWizard, setShowWizard] = useState(false);
  const navigate = useNavigate();

  function load() {
    setLoading(true);
    api.get('/api/campaigns').then(r => setCampaigns(Array.isArray(r.data) ? r.data : [])).catch(() => setCampaigns([])).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function handleToggle(c) {
    const next = c.status === 'active' ? 'paused' : 'active';
    await api.patch(`/api/campaigns/${c.id}/status`, { status: next });
    load();
  }

  async function handleDelete(c) {
    if (!window.confirm(`Remover "${c.name}"?`)) return;
    await api.delete(`/api/campaigns/${c.id}`);
    load();
  }

  const totalSpent  = campaigns.reduce((s, c) => s + parseFloat(c.spent  || 0), 0);
  const totalClicks = campaigns.reduce((s, c) => s + (c.clicks      || 0), 0);
  const totalImpr   = campaigns.reduce((s, c) => s + (c.impressions || 0), 0);
  const totalConv   = campaigns.reduce((s, c) => s + (c.conversions || 0), 0);
  const activeCount = campaigns.filter(c => c.status === 'active').length;

  let filtered = campaigns;
  if (filter)      filtered = filtered.filter(c => c.platform === filter || c.status === filter);
  if (searchQuery) filtered = filtered.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const summaryCards = [
    { label: 'Gasto Total',      value: `R$ ${totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`, sub: `CPC médio: ${totalClicks > 0 ? 'R$ ' + (totalSpent / totalClicks).toFixed(2) : '—'}`, accent: 'var(--c-accent)' },
    { label: 'Impressões',       value: totalImpr.toLocaleString('pt-BR'),  sub: `CTR médio: ${totalImpr > 0 ? ((totalClicks / totalImpr) * 100).toFixed(1) + '%' : '—'}`, accent: '#B877B8' },
    { label: 'Campanhas Ativas', value: activeCount, sub: `de ${campaigns.length} no total`, accent: '#5B8DD9' },
    { label: 'Conversões',       value: totalConv,   sub: `custo/conv: ${totalConv > 0 ? 'R$ ' + (totalSpent / totalConv).toFixed(2) : '—'}`, accent: '#E67E22' },
  ];

  return (
    <div style={{ padding: '24px 28px' }}>
      {showWizard && <NewCampaignWizard onClose={() => setShowWizard(false)} onCreated={load} />}

      <BudgetAlertCard />

      {/* Cards de resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '24px' }}>
        {summaryCards.map(({ label, value, sub, accent }) => (
          <div key={label} style={{ background: 'var(--c-card-bg)', borderRadius: '14px', padding: '18px 20px', boxShadow: '0 1px 6px var(--c-shadow)', border: '1px solid var(--c-border)', position: 'relative', overflow: 'hidden', transition: 'background .25s ease' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: accent }} />
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--c-text-4)', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: '8px' }}>{label}</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--c-text-1)', lineHeight: 1, marginBottom: '5px' }}>{value}</div>
            <div style={{ fontSize: '10px', color: 'var(--c-text-4)' }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Plataformas */}
      {campaigns.length > 0 && (
        <div style={{ marginBottom: '28px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--c-text-4)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
            Desempenho por Plataforma
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <PlatformBlock platform="meta"   campaigns={campaigns} totalSpent={totalSpent} />
            <PlatformBlock platform="google" campaigns={campaigns} totalSpent={totalSpent} />
          </div>
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text-1)' }}>Seus Anúncios</div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[['', 'Todos'], ['active', 'Ativos'], ['paused', 'Pausados'], ['meta', 'Instagram'], ['google', 'Google Ads']].map(([val, label]) => (
            <div
              key={label}
              onClick={() => setFilter(val)}
              style={{
                padding: '5px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 500,
                border: `1.5px solid ${filter === val ? 'var(--c-accent)' : 'var(--c-border)'}`,
                background: filter === val ? 'var(--c-active-bg)' : 'var(--c-card-bg)',
                color: filter === val ? 'var(--c-accent)' : 'var(--c-text-3)',
                cursor: 'pointer', transition: 'all .15s',
              }}
            >{label}</div>
          ))}
        </div>
      </div>

      {/* Grid de campanhas */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--c-text-4)', fontSize: '13px' }}>Carregando campanhas...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px', opacity: .5 }}>📣</div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '6px' }}>Nenhuma campanha ainda</h3>
          <p style={{ fontSize: '13px', color: 'var(--c-text-3)', marginBottom: '20px' }}>Crie seu primeiro anúncio.</p>
          <button onClick={() => setShowWizard(true)} style={{ background: 'var(--c-accent)', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 24px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
            + Criar Primeiro Anúncio
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
          {filtered.map(c => (
            <CampaignCard key={c.id} c={c} onToggle={handleToggle} onEdit={camp => navigate(`/campanhas/${camp.id}`)} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
