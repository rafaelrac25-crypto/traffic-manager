import React, { useEffect, useState } from 'react';
import api from '../services/api';

const PLATFORMS = [
  {
    id: 'meta',
    label: 'Instagram / Meta Ads',
    icon: '📸',
    color: '#C13584',
    desc: 'Conecte sua conta Meta Business para sincronizar campanhas do Instagram e Facebook.',
    fields: [
      { key: 'access_token', label: 'Access Token', placeholder: 'EAAxxxxx...', type: 'password' },
      { key: 'account_id', label: 'Ad Account ID', placeholder: 'act_123456789', type: 'text' },
    ],
  },
  {
    id: 'google',
    label: 'Google Ads',
    icon: '🔴',
    color: '#E74C3C',
    desc: 'Conecte sua conta Google Ads via OAuth2 para importar e gerenciar campanhas de busca e display.',
    fields: [
      { key: 'access_token', label: 'Access Token', placeholder: 'ya29.xxxxx', type: 'password' },
      { key: 'account_id', label: 'Customer ID', placeholder: '123-456-7890', type: 'text' },
    ],
  },
];

const inp = {
  width: '100%', border: '1.5px solid var(--gray-200)', borderRadius: 'var(--radius-sm)',
  padding: '9px 12px', fontSize: '12px', color: 'var(--wine)', background: '#fff',
  outline: 'none', boxSizing: 'border-box', transition: 'border .15s',
};

export default function Platforms() {
  const [statuses, setStatuses] = useState([]);
  const [forms, setForms] = useState({});
  const [saving, setSaving] = useState('');
  const [msg, setMsg] = useState({});
  const [open, setOpen] = useState({});

  function load() {
    api.get('/api/platforms').then(r => {
      setStatuses(r.data);
      const initial = {};
      r.data.forEach(p => {
        initial[p.platform] = { access_token: '', account_id: p.account_id || '' };
      });
      setForms(initial);
    });
  }
  useEffect(() => { load(); }, []);

  async function connect(platform, e) {
    e.preventDefault();
    setSaving(platform);
    try {
      await api.post(`/api/platforms/${platform}/connect`, forms[platform]);
      setMsg(m => ({ ...m, [platform]: { text: 'Conectado com sucesso!', ok: true } }));
      load();
      setOpen(o => ({ ...o, [platform]: false }));
    } catch (err) {
      setMsg(m => ({ ...m, [platform]: { text: err.response?.data?.error || 'Erro ao conectar', ok: false } }));
    } finally {
      setSaving('');
      setTimeout(() => setMsg(m => ({ ...m, [platform]: null })), 3500);
    }
  }

  async function disconnect(platform) {
    if (!window.confirm(`Desconectar ${PLATFORMS.find(p => p.id === platform)?.label}?`)) return;
    await api.delete(`/api/platforms/${platform}`);
    load();
  }

  const getStatus = (id) => statuses.find(s => s.platform === id) || {};

  return (
    <div style={{ padding: '24px 28px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--wine)', marginBottom: '6px' }}>Configurar Plataformas</h2>
        <p style={{ fontSize: '13px', color: 'var(--gray-400)' }}>Conecte suas contas de anúncio para sincronizar campanhas automaticamente.</p>
      </div>

      {/* Info banner */}
      <div style={{ background: 'var(--rose-pale)', border: '1.5px solid var(--rose)', borderRadius: 'var(--radius)', padding: '14px 18px', marginBottom: '24px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <span style={{ fontSize: '18px' }}>💡</span>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--wine)', marginBottom: '3px' }}>Modo demonstração ativo</div>
          <div style={{ fontSize: '12px', color: 'var(--gray-600)' }}>
            Os dados exibidos são simulados. Para conectar uma plataforma real, insira as credenciais abaixo.
            Os tokens são armazenados de forma segura e usados apenas para sincronizar seus dados.
          </div>
        </div>
      </div>

      {/* Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {PLATFORMS.map(plat => {
          const s = getStatus(plat.id);
          const connected = s.connected;
          const formData = forms[plat.id] || {};
          const isOpen = open[plat.id];
          const m = msg[plat.id];

          return (
            <div key={plat.id} style={{ background: '#fff', borderRadius: 'var(--radius)', border: `1.5px solid ${connected ? 'rgba(39,174,96,.25)' : 'var(--gray-200)'}`, boxShadow: 'var(--shadow-sm)', overflow: 'hidden', transition: 'box-shadow .2s' }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow-sm)'}>

              {/* Card top stripe */}
              <div style={{ height: '4px', background: plat.color }} />

              <div style={{ padding: '18px' }}>
                {/* Platform header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '22px' }}>{plat.icon}</span>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--wine)' }}>{plat.label}</span>
                  </div>
                  <span style={{
                    fontSize: '10px', fontWeight: 700, padding: '3px 9px', borderRadius: '20px',
                    background: connected ? 'rgba(39,174,96,.12)' : 'var(--gray-100)',
                    color: connected ? 'var(--green)' : 'var(--gray-400)',
                  }}>
                    {connected ? '● Conectado' : '○ Desconectado'}
                  </span>
                </div>

                <p style={{ fontSize: '12px', color: 'var(--gray-400)', lineHeight: 1.5, marginBottom: '14px' }}>{plat.desc}</p>

                {connected && s.account_id && (
                  <div style={{ background: 'var(--rose-pale)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', marginBottom: '12px', fontSize: '11px', color: 'var(--wine)' }}>
                    <span style={{ color: 'var(--gray-400)', fontWeight: 600 }}>Conta: </span>{s.account_id}
                  </div>
                )}

                {m && (
                  <div style={{ fontSize: '11px', fontWeight: 600, padding: '7px 10px', borderRadius: 'var(--radius-sm)', marginBottom: '10px', background: m.ok ? 'rgba(39,174,96,.1)' : 'rgba(231,76,60,.08)', color: m.ok ? 'var(--green)' : 'var(--red)' }}>
                    {m.ok ? '✓ ' : '⚠ '}{m.text}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => setOpen(o => ({ ...o, [plat.id]: !o[plat.id] }))} style={{
                    flex: 1, fontSize: '12px', fontWeight: 700, padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)', border: 'none',
                    background: isOpen ? 'var(--gray-100)' : 'var(--rose-deep)',
                    color: isOpen ? 'var(--gray-600)' : '#fff', cursor: 'pointer', transition: 'all .15s',
                  }}>
                    {isOpen ? '✕ Fechar' : connected ? '🔄 Atualizar token' : '🔗 Conectar'}
                  </button>
                  {connected && (
                    <button onClick={() => disconnect(plat.id)} style={{ fontSize: '12px', fontWeight: 600, padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1.5px solid rgba(231,76,60,.3)', background: 'var(--red-bg)', color: 'var(--red)', cursor: 'pointer' }}>
                      Desconectar
                    </button>
                  )}
                </div>

                {/* Expand form */}
                {isOpen && (
                  <form onSubmit={e => connect(plat.id, e)} style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--gray-100)', display: 'grid', gap: '10px', animation: 'fadeIn .2s ease' }}>
                    {plat.fields.map(field => (
                      <div key={field.key}>
                        <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '5px' }}>{field.label}</label>
                        <input
                          style={inp}
                          type={field.type}
                          placeholder={field.placeholder}
                          value={formData[field.key] || ''}
                          onChange={e => setForms(f => ({ ...f, [plat.id]: { ...f[plat.id], [field.key]: e.target.value } }))}
                          onFocus={e => e.target.style.borderColor = 'var(--rose-deep)'}
                          onBlur={e => e.target.style.borderColor = 'var(--gray-200)'}
                          required={field.key === 'access_token'}
                        />
                      </div>
                    ))}
                    <button type="submit" disabled={saving === plat.id} style={{ fontSize: '12px', fontWeight: 700, padding: '9px', borderRadius: 'var(--radius-sm)', border: 'none', background: saving === plat.id ? 'var(--gray-200)' : 'var(--wine)', color: saving === plat.id ? 'var(--gray-400)' : '#fff', cursor: saving === plat.id ? 'not-allowed' : 'pointer' }}>
                      {saving === plat.id ? 'Salvando...' : connected ? 'Atualizar credenciais' : 'Salvar e conectar'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Help section */}
      <div style={{ marginTop: '32px', background: '#fff', borderRadius: 'var(--radius)', border: '1px solid var(--gray-200)', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--wine)', marginBottom: '12px' }}>Como obter as credenciais?</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px' }}>
          {[
            ['📘 Meta Ads', 'Acesse business.facebook.com → Configurações → Acesso à API → Gere um token de longa duração e copie o ID da conta de anúncio.'],
            ['🔴 Google Ads', 'Acesse console.developers.google.com → Crie credenciais OAuth2 → Autorize a API de Google Ads e copie o token gerado.'],
          ].map(([title, text]) => (
            <div key={title}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--wine)', marginBottom: '5px' }}>{title}</div>
              <div style={{ fontSize: '11px', color: 'var(--gray-400)', lineHeight: 1.6 }}>{text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
