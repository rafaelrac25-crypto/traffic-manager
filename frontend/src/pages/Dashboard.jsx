import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import NewCampaignWizard from '../components/NewCampaignWizard';

const PLAT_COLORS = { meta: '#C13584', google: '#E74C3C', manual: '#7D4A5E' };
const PLAT_LABELS = { meta: 'Instagram', google: 'Google Ads', manual: 'Manual' };

const STATUS_COLOR = { active: '#22C55E', review: '#F59E0B', scheduled: '#6366F1', paused: '#94A3B8', ended: '#94A3B8' };
const STATUS_LABEL = { active: 'Rodando', review: 'Em revisão', scheduled: 'Agendado', paused: 'Pausado', ended: 'Encerrado' };

function MetricCell({ label, value, muted }) {
  return (
    <div>
      <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--c-text-4)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: '1px' }}>{label}</div>
      <div style={{ fontSize: '12px', fontWeight: 700, color: muted ? 'var(--c-text-4)' : 'var(--c-text-1)' }}>{value}</div>
    </div>
  );
}

// ── Lista compacta por linha ────────────────────────────────────────────────
function CampaignRow({ c, onToggle, onEdit, onDelete, rank, isLast }) {
  const [hovered, setHovered] = useState(false);
  const isActive  = c.status === 'active';
  const platColor = PLAT_COLORS[c.platform] || '#7D4A5E';
  const ctr       = c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(1) + '%' : '—';
  const cpc       = c.clicks > 0 ? 'R$ ' + (c.spent / c.clicks).toFixed(2) : '—';
  const isTop     = rank === 0 && (c.conversions || 0) > 0;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '14px',
        padding: '12px 18px',
        background: hovered ? 'var(--c-surface)' : 'var(--c-card-bg)',
        borderBottom: isLast ? 'none' : '1px solid var(--c-border-lt)',
        transition: 'background .15s',
      }}
    >
      {/* Indicador de status */}
      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: STATUS_COLOR[c.status], flexShrink: 0 }} title={STATUS_LABEL[c.status]} />

      {/* Barra de cor da plataforma */}
      <div style={{ width: '3px', height: '32px', borderRadius: '2px', background: platColor, flexShrink: 0 }} />

      {/* Nome + status */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--c-text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
            {c.name}
          </span>
          {isTop && (
            <span style={{ fontSize: '9px', background: '#FEF3C7', color: '#92400E', padding: '1px 6px', borderRadius: '10px', fontWeight: 700, flexShrink: 0 }}>🏆 Top</span>
          )}
        </div>
        <div style={{ fontSize: '10px', color: STATUS_COLOR[c.status], fontWeight: 600, marginTop: '1px' }}>
          {STATUS_LABEL[c.status]}
        </div>
      </div>

      {/* Plataforma */}
      <span style={{ fontSize: '10px', fontWeight: 700, color: platColor, background: `color-mix(in srgb, ${platColor} 12%, var(--c-surface))`, padding: '3px 9px', borderRadius: '20px', flexShrink: 0, whiteSpace: 'nowrap' }}>
        {PLAT_LABELS[c.platform] || c.platform}
      </span>

      {/* Métricas inline */}
      <div style={{ display: 'flex', gap: '20px', flexShrink: 0 }}>
        <MetricCell label="Verba/dia" value={`R$ ${c.budget || 0}`} />
        <MetricCell label="Cliques"   value={(c.clicks || 0).toLocaleString('pt-BR')} muted={!c.clicks} />
        <MetricCell label="CTR"       value={ctr} muted={ctr === '—'} />
        <MetricCell label="Conv."     value={c.conversions || 0} muted={!c.conversions} />
      </div>

      {/* Toggle ativo/pausado */}
      <label style={{ position: 'relative', width: '36px', height: '20px', flexShrink: 0, cursor: 'pointer' }} title={isActive ? 'Pausar' : 'Ativar'}>
        <input type="checkbox" checked={isActive} onChange={() => onToggle(c)} style={{ opacity: 0, width: 0, height: 0 }} />
        <span style={{ position: 'absolute', inset: 0, borderRadius: '20px', background: isActive ? 'var(--c-accent)' : 'var(--c-border)', transition: '.2s' }}>
          <span style={{ position: 'absolute', width: '14px', height: '14px', background: '#fff', borderRadius: '50%', top: '3px', left: isActive ? '19px' : '3px', transition: '.2s', boxShadow: '0 1px 3px rgba(0,0,0,.15)' }} />
        </span>
      </label>

      {/* Ações */}
      <div style={{ display: 'flex', gap: '4px', flexShrink: 0, opacity: hovered ? 1 : 0, transition: 'opacity .15s' }}>
        <button onClick={() => onEdit(c)} title="Editar"
          style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'var(--c-surface)', border: '1px solid var(--c-border)', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✏️</button>
        <button onClick={() => onDelete(c)} title="Remover"
          style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'var(--c-surface)', border: '1px solid var(--c-border)', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🗑️</button>
      </div>
    </div>
  );
}

function BudgetAlertCard() {
  const [status, setStatus]         = useState(null);
  const [testing, setTesting]       = useState(false);
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
    <div style={{ background: 'var(--c-card-bg)', borderRadius: '14px', border: `1.5px solid ${isLow ? '#EF4444' : 'var(--c-border)'}`, padding: '14px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: isLow ? '#EF4444' : 'var(--c-accent)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '20px' }}>{isLow ? '🚨' : '🔔'}</span>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--c-text-4)', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: '2px' }}>Monitor de Saldo — Meta Ads</div>
          {balance !== null ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '18px', fontWeight: 800, color: isLow ? '#EF4444' : 'var(--c-text-1)' }}>R$ {balance.toFixed(2)}</span>
              {isLow && <span style={{ fontSize: '10px', fontWeight: 700, color: '#EF4444', background: '#FEE2E2', padding: '2px 8px', borderRadius: '20px' }}>Saldo baixo</span>}
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
          <div style={{ fontSize: '10px', fontWeight: 600, color: testResult.ok ? '#16A34A' : '#DC2626' }}>
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

  const sorted = [...filtered].sort((a, b) => (b.conversions || 0) - (a.conversions || 0));

  const summaryCards = [
    { label: 'Gasto Total',      value: `R$ ${totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`, sub: totalClicks > 0 ? `CPC médio R$ ${(totalSpent / totalClicks).toFixed(2)}` : 'Nenhum clique ainda', accent: '#C13584' },
    { label: 'Campanhas Ativas', value: activeCount, sub: `de ${campaigns.length} cadastradas`, accent: '#6366F1' },
    { label: 'Cliques totais',   value: totalClicks.toLocaleString('pt-BR'), sub: totalImpr > 0 ? `CTR ${((totalClicks / totalImpr) * 100).toFixed(1)}%` : 'Sem impressões ainda', accent: '#0EA5E9' },
    { label: 'Conversões',       value: totalConv, sub: totalConv > 0 ? `Custo por conv. R$ ${(totalSpent / totalConv).toFixed(2)}` : 'Nenhuma conversão ainda', accent: '#F97316' },
  ];

  return (
    <div style={{ padding: '24px 28px', maxWidth: '1200px' }}>
      {showWizard && <NewCampaignWizard onClose={() => setShowWizard(false)} onCreated={load} />}

      <BudgetAlertCard />

      {/* Cards de resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '24px' }}>
        {summaryCards.map(({ label, value, sub, accent }) => (
          <div key={label} style={{ background: 'var(--c-card-bg)', borderRadius: '14px', padding: '18px 20px', border: '1px solid var(--c-border)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: accent }} />
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--c-text-4)', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: '8px' }}>{label}</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--c-text-1)', lineHeight: 1, marginBottom: '5px' }}>{value}</div>
            <div style={{ fontSize: '11px', color: 'var(--c-text-4)' }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Seção Seus Anúncios — lista compacta */}
      <div style={{ background: 'var(--c-card-bg)', borderRadius: '16px', border: '1px solid var(--c-border)', overflow: 'hidden' }}>

        {/* Header da seção */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--c-text-1)' }}>Seus Anúncios</span>
            {campaigns.length > 0 && (
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--c-text-4)', background: 'var(--c-surface)', padding: '2px 8px', borderRadius: '20px', border: '1px solid var(--c-border)' }}>
                {filtered.length} de {campaigns.length}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Filtros */}
            <div style={{ display: 'flex', gap: '4px' }}>
              {[['', 'Todos'], ['active', 'Ativos'], ['paused', 'Pausados'], ['meta', 'Instagram'], ['google', 'Google Ads']].map(([val, lbl]) => (
                <button key={lbl} onClick={() => setFilter(val)} style={{ padding: '4px 11px', borderRadius: '20px', fontSize: '11px', fontWeight: 500, border: `1.5px solid ${filter === val ? 'var(--c-accent)' : 'var(--c-border)'}`, background: filter === val ? 'var(--c-active-bg)' : 'transparent', color: filter === val ? 'var(--c-accent)' : 'var(--c-text-3)', cursor: 'pointer', transition: 'all .15s' }}>
                  {lbl}
                </button>
              ))}
            </div>
            {/* Botão novo anúncio */}
            <button onClick={() => setShowWizard(true)} style={{ background: 'var(--c-accent)', color: '#fff', border: 'none', borderRadius: '9px', padding: '6px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              + Novo Anúncio
            </button>
          </div>
        </div>

        {/* Cabeçalho das colunas */}
        {campaigns.length > 0 && !loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '8px 18px', background: 'var(--c-surface)', borderBottom: '1px solid var(--c-border-lt)' }}>
            <div style={{ width: '8px', flexShrink: 0 }} />
            <div style={{ width: '3px', flexShrink: 0 }} />
            <div style={{ flex: 1, fontSize: '9px', fontWeight: 700, color: 'var(--c-text-4)', textTransform: 'uppercase', letterSpacing: '.6px' }}>Campanha</div>
            <div style={{ width: '80px', fontSize: '9px', fontWeight: 700, color: 'var(--c-text-4)', textTransform: 'uppercase', letterSpacing: '.6px', flexShrink: 0 }}>Plataforma</div>
            <div style={{ display: 'flex', gap: '20px', flexShrink: 0 }}>
              {['Verba/dia', 'Cliques', 'CTR', 'Conv.'].map(l => (
                <div key={l} style={{ width: '52px', fontSize: '9px', fontWeight: 700, color: 'var(--c-text-4)', textTransform: 'uppercase', letterSpacing: '.6px' }}>{l}</div>
              ))}
            </div>
            <div style={{ width: '36px', flexShrink: 0 }} />
            <div style={{ width: '64px', flexShrink: 0 }} />
          </div>
        )}

        {/* Conteúdo */}
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--c-text-4)', fontSize: '13px' }}>
            Carregando campanhas...
          </div>
        ) : sorted.length === 0 ? (
          <div style={{ padding: '50px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '10px', opacity: .4 }}>📣</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '4px' }}>Nenhuma campanha ainda</div>
            <div style={{ fontSize: '12px', color: 'var(--c-text-4)', marginBottom: '18px' }}>Crie seu primeiro anúncio para começar a acompanhar os resultados.</div>
            <button onClick={() => setShowWizard(true)} style={{ background: 'var(--c-accent)', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 24px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
              + Criar Primeiro Anúncio
            </button>
          </div>
        ) : (
          sorted.map((c, rank) => (
            <CampaignRow
              key={c.id}
              c={c}
              rank={rank}
              isLast={rank === sorted.length - 1}
              onToggle={handleToggle}
              onEdit={camp => navigate(`/campanhas/${camp.id}`)}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}
