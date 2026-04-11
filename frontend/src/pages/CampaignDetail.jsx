import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

const PLAT_COLORS = { meta: '#2980B9', google: '#E74C3C', manual: '#7D4A5E' };
const PLAT_LABELS = { meta: 'Meta', google: 'Google', manual: 'Manual' };
const STATUS_COLOR = { active: 'var(--green)', paused: 'var(--yellow)', ended: 'var(--gray-400)' };
const STATUS_LABEL = { active: 'Ativo', paused: 'Pausado', ended: 'Encerrado' };

const inp = {
  width: '100%', border: '1.5px solid var(--gray-200)', borderRadius: 'var(--radius-sm)',
  padding: '9px 12px', fontSize: '13px', color: 'var(--wine)', background: '#fff',
  outline: 'none', boxSizing: 'border-box', transition: 'border .15s',
};

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '6px' }}>{label}</label>
      {children}
    </div>
  );
}

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/api/campaigns').then(r => {
      const c = r.data.find(x => String(x.id) === id);
      if (!c) { navigate('/campanhas'); return; }
      setForm({
        ...c,
        budget: c.budget ?? '',
        spent: c.spent ?? '',
        clicks: c.clicks ?? '',
        impressions: c.impressions ?? '',
        conversions: c.conversions ?? '',
        start_date: c.start_date?.split('T')[0] || '',
        end_date: c.end_date?.split('T')[0] || '',
      });
    }).finally(() => setLoading(false));
  }, [id]);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      await api.put(`/api/campaigns/${id}`, form);
      setSaved(true);
      setMsg('Alterações salvas com sucesso!');
      setTimeout(() => { setMsg(''); setSaved(false); }, 3000);
    } catch {
      setMsg('Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus() {
    const next = form.status === 'active' ? 'paused' : 'active';
    await api.patch(`/api/campaigns/${id}/status`, { status: next });
    setForm(f => ({ ...f, status: next }));
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px', color: 'var(--gray-400)' }}>
      Carregando...
    </div>
  );
  if (!form) return null;

  const ctr = form.impressions > 0 ? ((form.clicks / form.impressions) * 100).toFixed(1) + '%' : '—';
  const cpc = form.clicks > 0 ? 'R$ ' + (form.spent / form.clicks).toFixed(2) : '—';
  const pct = form.budget > 0 ? Math.min((parseFloat(form.spent || 0) / (parseFloat(form.budget) * 30)) * 100, 100) : 0;
  const fillColor = pct > 85 ? 'var(--red)' : pct > 60 ? 'var(--yellow)' : 'var(--rose-deep)';

  return (
    <div style={{ padding: '24px 28px', maxWidth: '760px' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
        <button onClick={() => navigate('/campanhas')} style={{ fontSize: '12px', color: 'var(--rose-deep)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          ← Campanhas
        </button>
        <span style={{ color: 'var(--gray-300)', fontSize: '12px' }}>/</span>
        <span style={{ fontSize: '12px', color: 'var(--gray-400)' }}>{form.name}</span>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--wine)' }}>{form.name}</h2>
          <span style={{ background: PLAT_COLORS[form.platform] || '#7D4A5E', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '3px 9px', borderRadius: '20px' }}>
            {PLAT_LABELS[form.platform] || form.platform}
          </span>
          <span style={{ fontSize: '12px', fontWeight: 700, color: STATUS_COLOR[form.status] }}>● {STATUS_LABEL[form.status]}</span>
        </div>
        <button onClick={toggleStatus} style={{
          fontSize: '12px', fontWeight: 700, padding: '7px 16px', borderRadius: 'var(--radius-sm)',
          border: '1.5px solid var(--gray-200)', background: '#fff', cursor: 'pointer', color: 'var(--wine)',
        }}>
          {form.status === 'active' ? '⏸ Pausar campanha' : '▶ Ativar campanha'}
        </button>
      </div>

      {/* Metrics summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '22px' }}>
        {[
          ['CTR', ctr, 'var(--blue)'],
          ['CPC', cpc, 'var(--rose-deep)'],
          ['Cliques', (parseInt(form.clicks) || 0).toLocaleString('pt-BR'), 'var(--green)'],
          ['Conversões', form.conversions || 0, 'var(--yellow)'],
        ].map(([label, value, accent]) => (
          <div key={label} style={{ background: '#fff', borderRadius: 'var(--radius)', border: '1px solid var(--gray-200)', padding: '14px 16px', boxShadow: 'var(--shadow-sm)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: accent }} />
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: '5px' }}>{label}</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--wine)' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Budget bar */}
      <div style={{ background: '#fff', borderRadius: 'var(--radius)', border: '1px solid var(--gray-200)', padding: '16px 20px', marginBottom: '22px', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--gray-600)', marginBottom: '8px' }}>
          <span style={{ fontWeight: 600 }}>Gasto do mês</span>
          <span style={{ fontWeight: 700, color: 'var(--wine)' }}>R$ {form.spent || 0} / R$ {(parseFloat(form.budget) || 0) * 30}</span>
        </div>
        <div style={{ height: '8px', background: 'var(--gray-100)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: fillColor, borderRadius: '4px', transition: 'width .6s' }} />
        </div>
        <div style={{ fontSize: '11px', color: 'var(--gray-400)', marginTop: '5px' }}>{pct.toFixed(0)}% do orçamento mensal utilizado</div>
      </div>

      {/* Edit form */}
      <form onSubmit={save}>
        <div style={{ background: '#fff', borderRadius: 'var(--radius)', border: '1px solid var(--gray-200)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--gray-100)', background: 'var(--rose-pale)' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--wine)' }}>Editar dados da campanha</span>
          </div>

          <div style={{ padding: '20px', display: 'grid', gap: '16px' }}>
            <Field label="Nome da campanha">
              <input style={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                onFocus={e => e.target.style.borderColor = 'var(--rose-deep)'}
                onBlur={e => e.target.style.borderColor = 'var(--gray-200)'}
                required />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field label="Verba diária (R$)">
                <input style={inp} type="number" step="0.01" min="0" value={form.budget}
                  onChange={e => setForm(f => ({ ...f, budget: e.target.value }))}
                  onFocus={e => e.target.style.borderColor = 'var(--rose-deep)'}
                  onBlur={e => e.target.style.borderColor = 'var(--gray-200)'} />
              </Field>
              <Field label="Gasto total (R$)">
                <input style={inp} type="number" step="0.01" min="0" value={form.spent}
                  onChange={e => setForm(f => ({ ...f, spent: e.target.value }))}
                  onFocus={e => e.target.style.borderColor = 'var(--rose-deep)'}
                  onBlur={e => e.target.style.borderColor = 'var(--gray-200)'} />
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
              <Field label="Cliques">
                <input style={inp} type="number" min="0" value={form.clicks}
                  onChange={e => setForm(f => ({ ...f, clicks: e.target.value }))}
                  onFocus={e => e.target.style.borderColor = 'var(--rose-deep)'}
                  onBlur={e => e.target.style.borderColor = 'var(--gray-200)'} />
              </Field>
              <Field label="Impressões">
                <input style={inp} type="number" min="0" value={form.impressions}
                  onChange={e => setForm(f => ({ ...f, impressions: e.target.value }))}
                  onFocus={e => e.target.style.borderColor = 'var(--rose-deep)'}
                  onBlur={e => e.target.style.borderColor = 'var(--gray-200)'} />
              </Field>
              <Field label="Conversões">
                <input style={inp} type="number" min="0" value={form.conversions}
                  onChange={e => setForm(f => ({ ...f, conversions: e.target.value }))}
                  onFocus={e => e.target.style.borderColor = 'var(--rose-deep)'}
                  onBlur={e => e.target.style.borderColor = 'var(--gray-200)'} />
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field label="Data de início">
                <input style={inp} type="date" value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                  onFocus={e => e.target.style.borderColor = 'var(--rose-deep)'}
                  onBlur={e => e.target.style.borderColor = 'var(--gray-200)'} />
              </Field>
              <Field label="Data de fim">
                <input style={inp} type="date" value={form.end_date}
                  onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                  onFocus={e => e.target.style.borderColor = 'var(--rose-deep)'}
                  onBlur={e => e.target.style.borderColor = 'var(--gray-200)'} />
              </Field>
            </div>

            <Field label="Status">
              <select style={inp} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                onFocus={e => e.target.style.borderColor = 'var(--rose-deep)'}
                onBlur={e => e.target.style.borderColor = 'var(--gray-200)'}>
                <option value="active">Ativo</option>
                <option value="paused">Pausado</option>
                <option value="ended">Encerrado</option>
              </select>
            </Field>
          </div>

          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--rose-pale)' }}>
            {msg ? (
              <span style={{ fontSize: '12px', fontWeight: 600, color: saved ? 'var(--green)' : 'var(--red)' }}>
                {saved ? '✓ ' : '⚠ '}{msg}
              </span>
            ) : <span />}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={() => navigate('/campanhas')} style={{ fontSize: '13px', fontWeight: 600, padding: '8px 18px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--gray-200)', background: '#fff', cursor: 'pointer', color: 'var(--gray-600)' }}>
                Cancelar
              </button>
              <button type="submit" disabled={saving} style={{ fontSize: '13px', fontWeight: 700, padding: '8px 22px', borderRadius: 'var(--radius-sm)', border: 'none', background: saving ? 'var(--gray-200)' : 'var(--rose-deep)', color: saving ? 'var(--gray-400)' : '#fff', cursor: saving ? 'not-allowed' : 'pointer', transition: 'all .15s' }}>
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
