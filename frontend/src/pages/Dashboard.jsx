import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import NewCampaignWizard from '../components/NewCampaignWizard';

const PLAT_COLORS = { meta: '#C13584', google: '#E74C3C', tiktok: '#000', manual: '#7D4A5E' };
const PLAT_LABELS = { meta: 'INSTAGRAM', google: 'GOOGLE ADS', tiktok: 'TIKTOK', manual: 'MANUAL' };
const STATUS_COLOR = { active: 'var(--green)', review: '#D97706', scheduled: '#4F46E5', paused: 'var(--gray-400)', ended: 'var(--gray-400)' };
const STATUS_FLAG  = { active: '🟢', review: '🟡', scheduled: '🔵', paused: '⚫', ended: '⚫' };
const STATUS_LABEL = { active: 'Rodando', review: 'Em revisão', scheduled: 'Agendado', paused: 'Pausado', ended: 'Encerrado' };

/* ── simulações de variação (sem histórico real ainda) ── */
const MOCK_DELTA = {
  meta:   { ontem: +14, mes: +38 },
  google: { ontem: -3,  mes: +12 },
};

function delta(val, suffix = '%') {
  const up = val >= 0;
  return (
    <span style={{ fontSize: '11px', fontWeight: 600, color: up ? 'var(--green)' : 'var(--red)' }}>
      {up ? '↑' : '↓'} {Math.abs(val)}{suffix}
    </span>
  );
}

function PlatformBlock({ platform, campaigns, totalSpent, label, color, icon }) {
  const cs       = campaigns.filter(c => c.platform === platform);
  const spent    = cs.reduce((s, c) => s + parseFloat(c.spent || 0), 0);
  const budget   = cs.reduce((s, c) => s + parseFloat(c.budget || 0), 0);
  const clicks   = cs.reduce((s, c) => s + (c.clicks || 0), 0);
  const conv     = cs.reduce((s, c) => s + (c.conversions || 0), 0);
  const active   = cs.filter(c => c.status === 'active').length;
  const cpc      = clicks > 0 ? (spent / clicks).toFixed(2) : null;
  const pctTotal = totalSpent > 0 ? ((spent / totalSpent) * 100).toFixed(0) : 0;
  const d        = MOCK_DELTA[platform] || { ontem: 0, mes: 0 };

  const metric = (lbl, val, sub) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <span style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,.55)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{lbl}</span>
      <span style={{ fontSize: '18px', fontWeight: 800, color: '#fff', lineHeight: 1 }}>{val}</span>
      {sub && <span style={{ fontSize: '10px', color: 'rgba(255,255,255,.45)' }}>{sub}</span>}
    </div>
  );

  return (
    <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', boxShadow: 'var(--shadow)', animation: 'fadeIn .3s ease' }}>
      {/* Header da plataforma */}
      <div style={{ background: color, padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '22px' }}>{icon}</span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#fff' }}>{label}</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,.6)' }}>
              {active} campanha{active !== 1 ? 's' : ''} ativa{active !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,.55)', fontWeight: 600, marginBottom: '2px' }}>PARTICIPAÇÃO</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#fff' }}>{pctTotal}%</div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,.45)' }}>do gasto total</div>
        </div>
      </div>

      {/* Métricas principais */}
      <div style={{ background: `${color}dd`, padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px' }}>
        {metric(
          'Gasto total',
          `R$ ${spent.toFixed(0)}`,
          `(investido R$ ${(budget * 30).toFixed(0)})`
        )}
        {metric('Cliques', clicks.toLocaleString('pt-BR'), `CPC: ${cpc ? 'R$ ' + cpc : '—'}`)}
        {metric('Conversões', conv, '')}
      </div>

      {/* Variações */}
      <div style={{ background: '#fff', borderLeft: `4px solid ${color}`, padding: '14px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '4px' }}>vs Ontem</div>
          {delta(d.ontem)}
          <div style={{ fontSize: '10px', color: 'var(--gray-400)', marginTop: '1px' }}>em conversões</div>
        </div>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '4px' }}>vs Mês passado</div>
          {delta(d.mes)}
          <div style={{ fontSize: '10px', color: 'var(--gray-400)', marginTop: '1px' }}>em conversões</div>
        </div>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '4px' }}>Custo / Clique</div>
          <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--wine)' }}>{cpc ? `R$ ${cpc}` : '—'}</span>
        </div>
      </div>

      {/* Barra de gasto */}
      <div style={{ background: 'var(--rose-pale)', borderTop: '1px solid var(--gray-100)', padding: '10px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--gray-600)', marginBottom: '5px' }}>
          <span>Gasto / Orçamento mensal</span>
          <strong style={{ color: 'var(--wine)' }}>R$ {spent.toFixed(0)} / R$ {(budget * 30).toFixed(0)}</strong>
        </div>
        {(() => {
          const pct = budget * 30 > 0 ? Math.min((spent / (budget * 30)) * 100, 100) : 0;
          const barColor = pct > 85 ? 'var(--red)' : pct > 60 ? 'var(--yellow)' : color;
          return (
            <div style={{ height: '6px', background: 'var(--gray-200)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: '3px', transition: 'width .6s' }} />
            </div>
          );
        })()}
      </div>
    </div>
  );
}

function CampaignCard({ c, onToggle, onEdit, onDelete }) {
  const pct = c.budget > 0 ? Math.min((c.spent / (c.budget * 30)) * 100, 100) : 0;
  const fillColor = pct > 85 ? 'var(--red)' : pct > 60 ? 'var(--yellow)' : 'var(--rose-deep)';
  const isActive = c.status === 'active';

  return (
    <div style={{ background: '#fff', borderRadius: 'var(--radius)', border: '1px solid var(--gray-200)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', transition: 'box-shadow .2s, transform .2s', animation: 'fadeIn .3s ease' }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'none'; }}>

      <div style={{ height: '100px', background: 'linear-gradient(135deg, var(--rose-pale), var(--rose))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', position: 'relative' }}>
        <span style={{ position: 'absolute', top: '8px', left: '8px', background: PLAT_COLORS[c.platform] || '#7D4A5E', color: '#fff', fontSize: '9px', fontWeight: 700, padding: '3px 8px', borderRadius: '20px' }}>
          {PLAT_LABELS[c.platform] || c.platform.toUpperCase()}
        </span>
        {isActive && <span style={{ position: 'absolute', top: '8px', right: '8px', width: '8px', height: '8px', background: 'var(--green)', borderRadius: '50%', animation: 'livePulse 2s infinite' }} />}
        💄
      </div>

      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px', gap: '8px' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--wine)', lineHeight: 1.3 }}>{c.name}</div>
            <div style={{ fontSize: '11px', marginTop: '2px' }}>
              <span style={{ color: STATUS_COLOR[c.status], fontWeight: 700 }}>{STATUS_FLAG[c.status]} {STATUS_LABEL[c.status]}</span>
            </div>
          </div>
          <label style={{ position: 'relative', width: '36px', height: '19px', flexShrink: 0, cursor: 'pointer' }}>
            <input type="checkbox" checked={isActive} onChange={() => onToggle(c)} style={{ opacity: 0, width: 0, height: 0 }} />
            <span style={{ position: 'absolute', inset: 0, borderRadius: '20px', background: isActive ? 'var(--green)' : 'var(--gray-200)', transition: '.2s' }}>
              <span style={{ position: 'absolute', width: '13px', height: '13px', background: '#fff', borderRadius: '50%', top: '3px', left: isActive ? '20px' : '3px', transition: '.2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
            </span>
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '6px', marginBottom: '10px' }}>
          {[
            ['Verba/dia', `R$ ${c.budget || 0}`],
            ['CPC', c.clicks > 0 ? `R$ ${(c.spent / c.clicks).toFixed(2)}` : '—'],
            ['CTR', c.impressions > 0 ? `${((c.clicks / c.impressions) * 100).toFixed(1)}%` : '—'],
            ['Cliques', (c.clicks || 0).toLocaleString('pt-BR')],
            ['Impressões', (c.impressions || 0).toLocaleString('pt-BR')],
            ['Conversões', c.conversions || 0],
          ].map(([l, v]) => (
            <div key={l} style={{ background: 'var(--rose-pale)', borderRadius: '6px', padding: '6px 8px' }}>
              <div style={{ fontSize: '9px', color: 'var(--gray-400)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '1px' }}>{l}</div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--wine)' }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--gray-600)', marginBottom: '3px' }}>
          <span>Gasto</span><strong style={{ color: 'var(--wine)' }}>R$ {c.spent || 0} / R$ {(c.budget || 0) * 30}</strong>
        </div>
        <div style={{ height: '4px', background: 'var(--gray-200)', borderRadius: '3px', overflow: 'hidden', marginBottom: '10px' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: fillColor, borderRadius: '3px', transition: 'width .6s' }} />
        </div>

        {/* Timeline de status */}
        {(c.submitted_at || c.scheduled_for || c.live_at) && (
          <div style={{ background: 'var(--rose-pale)', borderRadius: '6px', padding: '8px 10px', marginBottom: '8px', fontSize: '10px', color: 'var(--gray-600)' }}>
            {c.scheduled_for && !c.submitted_at && (
              <div>🔵 Agendado p/ <strong>{new Date(c.scheduled_for).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</strong></div>
            )}
            {c.submitted_at && (
              <div>🟡 Enviado p/ revisão: <strong>{new Date(c.submitted_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</strong></div>
            )}
            {c.live_at && (
              <div style={{ color: 'var(--green)', fontWeight: 700 }}>🟢 Rodando desde: <strong>{new Date(c.live_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</strong></div>
            )}
            {c.submitted_at && !c.live_at && (
              <div style={{ color: '#D97706', fontSize: '9px', marginTop: '3px' }}>⏳ Aguardando aprovação da plataforma</div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--gray-100)' }}>
          <div style={{ fontSize: '10px', color: 'var(--gray-400)' }}>📅 {c.start_date?.split('T')[0] || '—'}</div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[['✏️','Editar'],['🗑️','Remover']].map(([ic, tip]) => (
              <button key={tip} title={tip}
                onClick={() => { if (tip === 'Editar') onEdit(c); if (tip === 'Remover') onDelete(c); }}
                style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'var(--rose-pale)', border: 'none', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--rose)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--rose-pale)'}
              >{ic}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BudgetAlertCard() {
  const [status, setStatus]   = useState(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    api.get('/api/alerts/status').then(r => setStatus(r.data)).catch(() => {});
  }, []);

  async function sendTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await api.post('/api/alerts/test');
      setTestResult({ ok: true, results: r.data.results });
    } catch {
      setTestResult({ ok: false });
    } finally {
      setTesting(false);
    }
  }

  if (!status) return null;

  const balance = status.balance ?? null;
  const isLow   = balance !== null && balance < 20;
  const accentColor = isLow ? 'var(--red)' : 'var(--green)';

  return (
    <div style={{ background: '#fff', borderRadius: 'var(--radius)', border: `1.5px solid ${isLow ? 'var(--red)' : 'var(--gray-200)'}`, boxShadow: 'var(--shadow-sm)', padding: '16px 20px', marginBottom: '24px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: accentColor }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '22px' }}>{isLow ? '🚨' : '🔔'}</span>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: '2px' }}>Monitor de Saldo — Meta Ads</div>
            {balance !== null ? (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontSize: '20px', fontWeight: 800, color: isLow ? 'var(--red)' : 'var(--wine)' }}>R$ {balance.toFixed(2)}</span>
                {isLow && <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--red)', background: '#fff0f0', padding: '2px 8px', borderRadius: '20px' }}>SALDO BAIXO</span>}
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--gray-400)' }}>Meta Ads não conectado</div>
            )}
            <div style={{ fontSize: '10px', color: 'var(--gray-400)', marginTop: '2px' }}>
              Alertas para: {status.recipients?.phone1 ? `...${status.recipients.phone1}` : '—'} e {status.recipients?.phone2 ? `...${status.recipients.phone2}` : '—'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
          <button onClick={sendTest} disabled={testing} style={{ background: testing ? 'var(--gray-200)' : 'var(--wine)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '7px 14px', fontSize: '11px', fontWeight: 700, cursor: testing ? 'not-allowed' : 'pointer', transition: 'all .15s' }}>
            {testing ? 'Enviando...' : '📲 Testar WhatsApp'}
          </button>
          {testResult && (
            <div style={{ fontSize: '10px', color: testResult.ok ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
              {testResult.ok ? `✓ Enviado para ${testResult.results?.filter(r => r.success).length} número(s)` : '✗ Erro ao enviar'}
            </div>
          )}
          {status.lastAlertAt && (
            <div style={{ fontSize: '10px', color: 'var(--gray-400)' }}>
              Último alerta: {new Date(status.lastAlertAt).toLocaleString('pt-BR')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState('');
  const [showWizard, setShowWizard] = useState(false);
  const navigate = useNavigate();

  function load() {
    setLoading(true);
    api.get('/api/campaigns').then(r => setCampaigns(r.data)).finally(() => setLoading(false));
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

  const filtered    = filter ? campaigns.filter(c => c.platform === filter || c.status === filter) : campaigns;
  const totalSpent  = campaigns.reduce((s, c) => s + parseFloat(c.spent || 0), 0);
  const totalClicks = campaigns.reduce((s, c) => s + (c.clicks || 0), 0);
  const totalConv   = campaigns.reduce((s, c) => s + (c.conversions || 0), 0);
  const activeCount = campaigns.filter(c => c.status === 'active').length;

  return (
    <div style={{ padding: '24px 28px' }}>
      {showWizard && <NewCampaignWizard onClose={() => setShowWizard(false)} onCreated={load} />}

      {/* Card de alerta de saldo */}
      <BudgetAlertCard />

      {/* Resumo geral */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Gasto Total', value: `R$ ${totalSpent.toFixed(0)}`, icon: '💸', accent: 'var(--rose-deep)', sub: `investido no período` },
          { label: 'Cliques',     value: totalClicks.toLocaleString('pt-BR'), icon: '🖱️', accent: 'var(--green)',    sub: `CPC médio: ${totalClicks > 0 ? 'R$ ' + (totalSpent / totalClicks).toFixed(2) : '—'}` },
          { label: 'Campanhas Ativas', value: activeCount, icon: '📣', accent: 'var(--blue)', sub: `de ${campaigns.length} no total` },
          { label: 'Conversões',  value: totalConv, icon: '🎯', accent: 'var(--yellow)', sub: `custo/conv: ${totalConv > 0 ? 'R$ ' + (totalSpent / totalConv).toFixed(2) : '—'}` },
        ].map(({ label, value, icon, accent, sub }) => (
          <div key={label} style={{ background: '#fff', borderRadius: 'var(--radius)', padding: '16px 18px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--gray-200)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: accent }} />
            <div style={{ position: 'absolute', right: '14px', top: '14px', fontSize: '18px', opacity: .1 }}>{icon}</div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: '6px' }}>{label}</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--wine)', lineHeight: 1, marginBottom: '4px' }}>{value}</div>
            <div style={{ fontSize: '10px', color: 'var(--gray-400)' }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Desempenho por plataforma */}
      {campaigns.length > 0 && (
        <div style={{ marginBottom: '28px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: '12px' }}>📈 Desempenho por plataforma</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <PlatformBlock platform="meta"   campaigns={campaigns} totalSpent={totalSpent} label="Tráfego Instagram" color="#C13584" icon="📸" />
            <PlatformBlock platform="google" campaigns={campaigns} totalSpent={totalSpent} label="Google Ads"        color="#E74C3C" icon="🔴" />
          </div>
        </div>
      )}

      {/* Header campanhas */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--wine)' }}>Seus Anúncios</h3>
        <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', alignItems: 'center' }}>
          {[['', 'Todos'], ['active', '🟢 Ativos'], ['paused', '⏸ Pausados'], ['meta', 'Tráfego Instagram'], ['google', 'Google Ads']].map(([val, label]) => (
            <div key={label} onClick={() => setFilter(val)} style={{
              padding: '5px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
              border: `1.5px solid ${filter === val ? 'var(--rose-deep)' : 'var(--gray-200)'}`,
              background: filter === val ? 'var(--rose)' : '#fff',
              color: filter === val ? 'var(--rose-deep)' : 'var(--gray-600)',
              cursor: 'pointer', transition: 'all .15s',
            }}>{label}</div>
          ))}
        </div>
      </div>

      {/* Grid de campanhas */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--gray-400)' }}>Carregando campanhas...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--gray-400)' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px', opacity: .6 }}>📣</div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--wine)', marginBottom: '6px' }}>Nenhuma campanha ainda</h3>
          <p style={{ fontSize: '13px', marginBottom: '20px' }}>Crie seu primeiro anúncio clicando em "+ Novo Anúncio".</p>
          <button onClick={() => setShowWizard(true)} style={{ background: 'var(--rose-deep)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '10px 24px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>+ Criar Primeiro Anúncio</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
          {filtered.map(c => (
            <CampaignCard key={c.id} c={c} onToggle={handleToggle} onEdit={c => navigate(`/campanhas/${c.id}`)} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
