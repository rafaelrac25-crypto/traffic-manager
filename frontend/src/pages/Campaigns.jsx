import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import NewCampaignWizard, { getDrafts, deleteDraft } from '../components/NewCampaignWizard';

const PLAT_COLORS = { meta: '#C13584', google: '#E74C3C', tiktok: '#000', manual: '#7D4A5E' };
const PLAT_LABELS = { meta: 'Tráfego Instagram', google: 'Google Ads', tiktok: 'TikTok', manual: 'Manual' };
const STATUS_COLOR = { active: 'var(--green)', paused: 'var(--yellow)', ended: 'var(--gray-400)' };
const STATUS_LABEL = { active: 'Ativo', paused: 'Pausado', ended: 'Encerrado' };

const PLAT_LABELS_DRAFT = { meta: 'Tráfego Instagram', google: 'Google Ads' };
const OBJ_LABELS = { vendas: 'Vendas', cadastros: 'Cadastros', trafego: 'Visitas ao site', engajamento: 'Engajamento', contato: 'Contato', loja: 'Loja física' };

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState({ platform: '', status: '' });
  const [showWizard, setShowWizard] = useState(false);
  const [activeDraft, setActiveDraft] = useState(null);
  const [drafts, setDrafts]       = useState([]);
  const [syncing, setSyncing]     = useState('');
  const navigate = useNavigate();

  function loadDrafts() { setDrafts(getDrafts()); }

  function removeDraft(id) {
    deleteDraft(id);
    loadDrafts();
  }

  function continueDraft(draft) {
    setActiveDraft(draft);
    setShowWizard(true);
  }

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter.platform) params.set('platform', filter.platform);
    if (filter.status)   params.set('status',   filter.status);
    api.get(`/api/campaigns?${params}`).then(r => setCampaigns(r.data)).finally(() => setLoading(false));
  }
  useEffect(() => { load(); loadDrafts(); }, [filter]);

  async function toggleStatus(c) {
    const next = c.status === 'active' ? 'paused' : 'active';
    await api.patch(`/api/campaigns/${c.id}/status`, { status: next });
    load();
  }

  async function remove(c) {
    if (!window.confirm(`Remover "${c.name}"?`)) return;
    await api.delete(`/api/campaigns/${c.id}`);
    load();
  }

  async function sync(platform) {
    setSyncing(platform);
    try {
      const { data } = await api.post(`/api/campaigns/sync/${platform}`);
      alert(data.message);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao sincronizar');
    } finally {
      setSyncing('');
    }
  }

  const chip = (label, active, onClick) => (
    <div onClick={onClick} style={{
      padding: '5px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
      border: `1.5px solid ${active ? 'var(--rose-deep)' : 'var(--gray-200)'}`,
      background: active ? 'var(--rose)' : '#fff',
      color: active ? 'var(--rose-deep)' : 'var(--gray-600)', transition: 'all .15s',
    }}>{label}</div>
  );

  return (
    <div style={{ padding: '24px 28px' }}>
      {showWizard && (
        <NewCampaignWizard
          initialDraft={activeDraft}
          onClose={() => { setShowWizard(false); setActiveDraft(null); loadDrafts(); }}
          onCreated={() => { load(); loadDrafts(); }}
        />
      )}

      {/* Cabeçalho */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--wine)' }}>Todas as Campanhas</h2>
      </div>

      {/* Rascunhos */}
      {drafts.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.5px' }}>📝 Rascunhos</span>
            <span style={{ background: 'var(--yellow-bg,#fff8e1)', color: '#7a4a00', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', border: '1px solid rgba(255,193,7,.4)' }}>{drafts.length}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
            {drafts.map(d => {
              const platLabel = PLAT_LABELS_DRAFT[d.platform] || d.platform;
              const objLabel  = OBJ_LABELS[d.objective] || d.objective;
              const savedDate = new Date(d.savedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
              const stepLabel = ['Plataforma','Objetivo','Criativo','Público','Orçamento'][d.step] || '';
              return (
                <div key={d.id} style={{ background: '#fff', border: '1.5px dashed var(--gray-200)', borderRadius: 'var(--radius)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px', animation: 'fadeIn .2s ease' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--wine)' }}>{d.adName || 'Sem título'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--gray-400)', marginTop: '2px' }}>{platLabel} · {objLabel}</div>
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px', background: 'rgba(255,193,7,.12)', color: '#7a4a00', border: '1px solid rgba(255,193,7,.3)', whiteSpace: 'nowrap' }}>
                      Passo {d.step + 1} — {stepLabel}
                    </span>
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--gray-400)' }}>Salvo em {savedDate}</div>
                  <div style={{ display: 'flex', gap: '7px' }}>
                    <button onClick={() => continueDraft(d)} style={{ flex: 1, fontSize: '12px', fontWeight: 700, padding: '7px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--rose-deep)', color: '#fff', cursor: 'pointer' }}>
                      ▶ Continuar
                    </button>
                    <button onClick={() => removeDraft(d.id)} style={{ fontSize: '12px', fontWeight: 600, padding: '7px 12px', borderRadius: 'var(--radius-sm)', border: '1.5px solid rgba(231,76,60,.3)', background: 'var(--red-bg)', color: 'var(--red)', cursor: 'pointer' }}>
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Plataforma:</span>
        {chip('Todas', !filter.platform, () => setFilter(f => ({ ...f, platform: '' })))}
        {['meta','google'].map(p => chip(PLAT_LABELS[p], filter.platform === p, () => setFilter(f => ({ ...f, platform: f.platform === p ? '' : p }))))}
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.5px', marginLeft: '8px' }}>Status:</span>
        {chip('Todos', !filter.status, () => setFilter(f => ({ ...f, status: '' })))}
        {[['active','🟢 Ativos'],['paused','⏸ Pausados'],['ended','✖ Encerrados']].map(([v, l]) => chip(l, filter.status === v, () => setFilter(f => ({ ...f, status: f.status === v ? '' : v }))))}
      </div>

      {/* Sync buttons */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['meta','google'].map(p => (
          <button key={p} onClick={() => sync(p)} disabled={!!syncing} style={{
            fontSize: '11px', fontWeight: 600, padding: '5px 12px', borderRadius: '20px',
            border: '1.5px solid var(--gray-200)', background: '#fff', color: 'var(--gray-600)',
            cursor: syncing ? 'not-allowed' : 'pointer', opacity: syncing && syncing !== p ? .5 : 1,
          }}>
            {syncing === p ? '⟳ Sincronizando...' : `⟳ Sync ${PLAT_LABELS[p]}`}
          </button>
        ))}
      </div>

      {/* Tabela */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--gray-400)' }}>Carregando...</div>
      ) : campaigns.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--gray-400)' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📣</div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--wine)', marginBottom: '6px' }}>Nenhuma campanha encontrada</div>
          <div style={{ fontSize: '13px', marginBottom: '20px' }}>Tente remover os filtros ou crie um novo anúncio.</div>
          <button onClick={() => setShowWizard(true)} style={{ background: 'var(--rose-deep)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '10px 20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>+ Criar Anúncio</button>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 'var(--radius)', border: '1px solid var(--gray-200)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'var(--rose-pale)', borderBottom: '1px solid var(--gray-200)' }}>
                {['Campanha','Plataforma','Status','Verba/dia','Gasto','Cliques','CTR','Conversões','Ações'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: h === 'Ações' ? 'center' : 'left', fontSize: '10px', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.7px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c, i) => {
                const ctr = c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(1) + '%' : '—';
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--gray-100)', background: i % 2 === 0 ? '#fff' : 'var(--rose-pale)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--rose)'}
                    onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#fff' : 'var(--rose-pale)'}>
                    <td style={{ padding: '11px 14px', fontWeight: 600, color: 'var(--wine)' }}>
                      <div style={{ cursor: 'pointer' }} onClick={() => navigate(`/campanhas/${c.id}`)}>{c.name}</div>
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ background: PLAT_COLORS[c.platform] || '#7D4A5E', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '20px' }}>
                        {PLAT_LABELS[c.platform] || c.platform}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', fontWeight: 700, color: STATUS_COLOR[c.status] }}>● {STATUS_LABEL[c.status]}</td>
                    <td style={{ padding: '11px 14px', color: 'var(--wine)' }}>R$ {c.budget || 0}</td>
                    <td style={{ padding: '11px 14px', color: 'var(--wine)' }}>R$ {c.spent || 0}</td>
                    <td style={{ padding: '11px 14px', color: 'var(--wine)' }}>{(c.clicks || 0).toLocaleString('pt-BR')}</td>
                    <td style={{ padding: '11px 14px', color: 'var(--wine)' }}>{ctr}</td>
                    <td style={{ padding: '11px 14px', color: 'var(--wine)' }}>{c.conversions || 0}</td>
                    <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                        <button onClick={() => toggleStatus(c)} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--gray-200)', background: '#fff', cursor: 'pointer', color: 'var(--wine-mid)', fontWeight: 600 }}>
                          {c.status === 'active' ? '⏸ Pausar' : '▶ Ativar'}
                        </button>
                        <button onClick={() => navigate(`/campanhas/${c.id}`)} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--gray-200)', background: '#fff', cursor: 'pointer', color: 'var(--wine-mid)', fontWeight: 600 }}>
                          ✏️ Editar
                        </button>
                        <button onClick={() => remove(c)} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(231,76,60,.3)', background: 'var(--red-bg)', cursor: 'pointer', color: 'var(--red)', fontWeight: 600 }}>
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
