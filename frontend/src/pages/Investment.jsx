import React, { useState, useEffect } from 'react';
import { useAppState } from '../contexts/AppStateContext';
import api from '../services/api';

function formatBRL(v) {
  return `R$\u00A0${Number(v || 0).toFixed(2).replace('.', ',')}`;
}

export default function Investment() {
  const { pixel, setPixel, metaBilling, metaBillingLoading, metaBillingLastUpdate, refreshMetaBilling } = useAppState();

  const [metaStatus, setMetaStatus] = useState(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaSyncing, setMetaSyncing] = useState(false);
  const [metaFeedback, setMetaFeedback] = useState(null);
  const [pixelOpen, setPixelOpen] = useState(false);

  async function loadMetaStatus() {
    try {
      const { data } = await api.get('/api/platforms');
      const meta = Array.isArray(data) ? data.find(p => p.platform === 'meta') : null;
      setMetaStatus(meta || null);
    } catch { setMetaStatus(null); }
  }

  useEffect(() => {
    loadMetaStatus();
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'meta') {
      setMetaFeedback({ type: 'ok', text: 'Facebook conectado com sucesso.' });
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('meta_error')) {
      setMetaFeedback({ type: 'err', text: `Erro ao conectar Facebook: ${params.get('meta_error')}` });
      window.history.replaceState({}, '', window.location.pathname);
    }
    /* Saldo é gerenciado pelo AppStateContext (auto-refresh 1h + botão manual). */
  }, []);

  function connectMeta() { window.location.href = '/api/platforms/meta/oauth/start'; }

  async function syncMeta() {
    setMetaSyncing(true);
    setMetaFeedback(null);
    try {
      const { data } = await api.post('/api/campaigns/sync/meta');
      setMetaFeedback({ type: 'ok', text: `${data.message}. Acesse a página Campanhas para visualizar.` });
      await refreshMetaBilling();
    } catch (e) {
      setMetaFeedback({ type: 'err', text: e?.response?.data?.error || 'Erro ao sincronizar' });
    } finally { setMetaSyncing(false); }
  }

  async function disconnectMeta() {
    if (!window.confirm('Desconectar o Facebook? As campanhas ficarão offline (não sincronizam) até reconectar.')) return;
    setMetaLoading(true);
    try {
      await api.delete('/api/platforms/meta');
      setMetaFeedback({ type: 'ok', text: 'Facebook desconectado.' });
      await loadMetaStatus();
      await refreshMetaBilling();
    } catch { setMetaFeedback({ type: 'err', text: 'Erro ao desconectar.' }); }
    finally { setMetaLoading(false); }
  }

  function formatRelativeTime(iso) {
    if (!iso) return 'nunca atualizado';
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return 'agora mesmo';
    if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
    return `há ${Math.floor(diff / 86400)} d`;
  }

  const assetId = (metaStatus?.account_id || '').replace(/^act_/, '');
  const billingUrl = assetId
    ? `https://business.facebook.com/billing_hub/accounts/details?asset_id=${assetId}`
    : 'https://business.facebook.com/billing_hub/payment_settings';

  return (
    <div className="page-container">
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '4px' }}>
          Investimento
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--c-text-3)' }}>
          Saldo, integração Meta e rastreamento de conversões.
        </p>
      </div>

      {/* ── Saldo real da conta Meta ── */}
      {metaStatus?.connected && (
        <div className="ccb-card" style={{
          background: 'linear-gradient(135deg, rgba(214,141,143,.08), rgba(125,74,94,.05))',
          border: '1.5px solid var(--c-border)',
          borderRadius: '18px', padding: '24px 28px', marginBottom: '20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px',
        }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--c-text-3)', marginBottom: '6px', letterSpacing: '.5px', textTransform: 'uppercase' }}>
              Saldo disponível (Meta Ads)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontSize: '36px', fontWeight: 700, color: 'var(--c-accent)', lineHeight: 1 }}>
                {metaBilling ? formatBRL(metaBilling.available ?? metaBilling.balance) : '—'}
              </div>
              <button
                onClick={refreshMetaBilling}
                disabled={metaBillingLoading}
                title="Atualizar saldo agora"
                aria-label="Atualizar saldo"
                style={{
                  width: '34px', height: '34px', borderRadius: '50%',
                  border: '1.5px solid var(--c-border)',
                  background: 'var(--c-card-bg)',
                  color: 'var(--c-accent)', fontSize: '16px', lineHeight: 1,
                  cursor: metaBillingLoading ? 'wait' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'transform .18s ease, background .18s ease',
                }}
                onMouseEnter={e => { if (!metaBillingLoading) e.currentTarget.style.background = 'var(--c-hover)'; }}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--c-card-bg)'}
              >
                <span style={{
                  display: 'inline-block',
                  animation: metaBillingLoading ? 'spin 0.9s linear infinite' : 'none',
                }}>↻</span>
              </button>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--c-text-4)', marginTop: '8px' }}>
              {metaBilling
                ? <>Gasto total: {formatBRL(metaBilling.amount_spent)}{metaBilling.spend_cap ? ` · Limite: ${formatBRL(metaBilling.spend_cap)}` : ''} · Atualizado {formatRelativeTime(metaBillingLastUpdate)}<br/><span style={{ fontSize: '10px', color: 'var(--c-text-4)', opacity: 0.8 }}>Pode variar alguns centavos do Meta por créditos promocionais</span></>
                : (metaBillingLoading ? 'Carregando saldo da conta de anúncios…' : 'Clique em ↻ para carregar o saldo')}
            </div>
          </div>
          <a
            href={billingUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '12px 20px', borderRadius: '10px',
              background: 'var(--c-accent)', color: '#fff',
              fontSize: '13px', fontWeight: 700, textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center', gap: '8px',
            }}
          >
            💳 Adicionar crédito no Meta
          </a>
        </div>
      )}

      {/* ── Integração Meta (Facebook + Instagram Ads) ── */}
      <div className="ccb-card" style={{
        background: 'var(--c-card-bg)', border: '1px solid var(--c-border)',
        borderRadius: '16px', padding: '22px', boxShadow: '0 2px 8px var(--c-shadow)',
        marginBottom: '20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '22px' }}>📱</span>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--c-text-1)' }}>
                Facebook / Instagram Ads
              </div>
              <div style={{ fontSize: '11px', color: 'var(--c-text-4)', marginTop: '2px' }}>
                Conecte a conta de anúncios da Meta para publicar direto do painel.
              </div>
            </div>
          </div>
          {metaStatus?.connected ? (
            <span style={{
              padding: '4px 10px', fontSize: '10px', fontWeight: 700,
              background: '#DCFCE7', color: '#16A34A',
              borderRadius: '6px', letterSpacing: '.3px',
            }}>CONECTADO</span>
          ) : (
            <span style={{
              padding: '4px 10px', fontSize: '10px', fontWeight: 700,
              background: '#FEF3C7', color: '#B45309',
              borderRadius: '6px', letterSpacing: '.3px',
            }}>DESCONECTADO</span>
          )}
        </div>

        {metaStatus?.connected ? (
          <div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '10px', marginBottom: '14px',
            }}>
              <InfoCell label="Ad Account" value={metaStatus.account_id || '—'} />
              <InfoCell label="Página Facebook" value={metaStatus.page_id || '—'} />
              <InfoCell label="Instagram Business" value={metaStatus.ig_business_id || '—'} />
              <InfoCell
                label="Token expira em"
                value={metaStatus.token_expires_at
                  ? new Date(metaStatus.token_expires_at).toLocaleDateString('pt-BR')
                  : '—'}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={syncMeta}
                disabled={metaSyncing}
                style={{
                  padding: '10px 16px', borderRadius: '10px',
                  border: 'none', background: 'var(--c-accent)',
                  color: '#fff', fontSize: '12px', fontWeight: 700,
                  cursor: metaSyncing ? 'wait' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                }}
              >
                {metaSyncing ? '⏳ Sincronizando…' : '🔄 Sincronizar agora'}
              </button>
              <button
                onClick={disconnectMeta}
                disabled={metaLoading}
                style={{
                  padding: '10px 16px', borderRadius: '10px',
                  border: '1.5px solid #FCA5A5', background: '#FEF2F2',
                  color: '#DC2626', fontSize: '12px', fontWeight: 700,
                  cursor: metaLoading ? 'wait' : 'pointer',
                }}
              >
                {metaLoading ? 'Desconectando…' : 'Desconectar'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={connectMeta}
            style={{
              padding: '12px 18px', borderRadius: '10px',
              border: 'none', background: '#1877F2',
              color: '#fff', fontSize: '13px', fontWeight: 700,
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px',
            }}
          >
            <span style={{ fontSize: '16px' }}>🅕</span> Conectar Facebook
          </button>
        )}

        {metaFeedback && (
          <div style={{
            marginTop: '14px', padding: '10px 14px',
            background: metaFeedback.type === 'ok' ? 'rgba(34,197,94,.08)' : 'rgba(220,38,38,.08)',
            border: `1px solid ${metaFeedback.type === 'ok' ? 'rgba(34,197,94,.3)' : 'rgba(220,38,38,.3)'}`,
            borderRadius: '10px', fontSize: '12px',
            color: metaFeedback.type === 'ok' ? '#16A34A' : '#DC2626', fontWeight: 600,
          }}>
            {metaFeedback.text}
          </div>
        )}
      </div>

      {/* ── Pixel / Rastreamento de conversão (minimizado por padrão) ── */}
      <div className="ccb-card" style={{
        background: 'var(--c-card-bg)', border: '1px solid var(--c-border)',
        borderRadius: '16px', boxShadow: '0 2px 8px var(--c-shadow)', overflow: 'hidden',
      }}>
        <button
          type="button"
          onClick={() => setPixelOpen(v => !v)}
          style={{
            width: '100%', textAlign: 'left',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: '12px', flexWrap: 'wrap', padding: '14px 18px',
            background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
            <span style={{
              display: 'inline-block', fontSize: '13px', color: 'var(--c-text-4)',
              transform: pixelOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .18s',
            }}>›</span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--c-text-1)' }}>
              📊 Pixel de rastreamento
            </span>
            {pixel?.enabled && (
              <span style={{
                padding: '2px 8px', fontSize: '10px', fontWeight: 700,
                background: '#DCFCE7', color: '#16A34A',
                borderRadius: '6px', letterSpacing: '.3px',
              }}>ATIVO</span>
            )}
            {!pixelOpen && !pixel?.enabled && (
              <span style={{ fontSize: '11px', color: 'var(--c-text-4)', fontWeight: 500 }}>
                — opcional, use apenas se tiver site/LP
              </span>
            )}
          </span>
        </button>

        {pixelOpen && (
          <div style={{ padding: '4px 22px 22px' }}>
            <p style={{ fontSize: '12px', color: 'var(--c-text-3)', margin: '0 0 14px', maxWidth: '560px', lineHeight: 1.5 }}>
              Rastreie conversões (agendamentos, contatos, compras) no seu site ou landing page para otimizar seus anúncios.
            </p>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--c-text-3)' }}>
                {pixel?.enabled ? 'Ativado' : 'Desativado'}
              </span>
              <div
                onClick={() => setPixel({ ...pixel, enabled: !pixel?.enabled })}
                style={{
                  width: '38px', height: '22px', borderRadius: '22px',
                  background: pixel?.enabled ? 'var(--c-accent)' : 'var(--c-border)',
                  position: 'relative', transition: 'background .2s',
                }}
              >
                <div style={{
                  position: 'absolute',
                  width: '16px', height: '16px', background: '#fff',
                  borderRadius: '50%', top: '3px',
                  left: pixel?.enabled ? '19px' : '3px',
                  transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.3)',
                }} />
              </div>
            </label>

            {pixel?.enabled && (
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{
                    display: 'block', fontSize: '11px', fontWeight: 700,
                    color: 'var(--c-text-3)', marginBottom: '6px',
                    textTransform: 'uppercase', letterSpacing: '.4px',
                  }}>
                    ID do Pixel Meta
                  </label>
                  <input
                    type="text"
                    placeholder="Ex.: 1234567890123456"
                    value={pixel?.pixelId || ''}
                    onChange={e => setPixel({ ...pixel, pixelId: e.target.value.replace(/\D/g, '') })}
                    style={inputStyle}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoCell({ label, value }) {
  return (
    <div style={{
      padding: '10px 12px', background: 'var(--c-surface)',
      border: '1px solid var(--c-border)', borderRadius: '10px',
    }}>
      <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--c-text-4)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: '3px' }}>
        {label}
      </div>
      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--c-text-1)', wordBreak: 'break-all' }}>
        {value}
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '10px 14px', fontSize: '13px',
  border: '1.5px solid var(--c-border)', borderRadius: '10px',
  background: 'var(--c-surface)', color: 'var(--c-text-1)',
  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
};
