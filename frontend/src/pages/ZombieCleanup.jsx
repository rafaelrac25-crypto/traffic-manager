import React, { useState, useCallback } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import api from '../services/api';
import { playBell } from '../utils/sounds';
import { statusLabel as statusLabelOf } from '../utils/statusLabels';

/* Formata data ISO do Meta em pt-BR (ex: "03 de maio de 2025, 14:32") */
function formatDateBR(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/* Tradução vem do util único — statusLabels.js */

/* Tradução de objetivos Meta mais comuns */
const OBJECTIVE_LABEL = {
  OUTCOME_TRAFFIC: 'Tráfego',
  OUTCOME_AWARENESS: 'Reconhecimento',
  OUTCOME_ENGAGEMENT: 'Engajamento',
  OUTCOME_LEADS: 'Geração de leads',
  OUTCOME_SALES: 'Vendas',
  OUTCOME_APP_PROMOTION: 'Promoção de app',
  LINK_CLICKS: 'Cliques no link',
  MESSAGES: 'Mensagens',
  CONVERSIONS: 'Conversões',
};

/* Skeleton de card durante loading */
function SkeletonCard() {
  return (
    <div style={{
      background: 'var(--c-surface)',
      border: '1px solid var(--c-border)',
      borderRadius: '14px',
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      animation: 'pulse 1.4s ease-in-out infinite',
    }}>
      <div style={{ height: '14px', width: '60%', background: 'var(--c-border)', borderRadius: '6px' }} />
      <div style={{ height: '12px', width: '35%', background: 'var(--c-border)', borderRadius: '6px' }} />
      <div style={{ height: '12px', width: '45%', background: 'var(--c-border)', borderRadius: '6px' }} />
      <div style={{ height: '32px', width: '140px', background: 'var(--c-border)', borderRadius: '8px', marginTop: '6px' }} />
    </div>
  );
}

/* Modal de confirmação de deleção */
function ConfirmModal({ campaign, onConfirm, onCancel, deleting }) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--c-card-bg)',
          border: '1px solid var(--c-border)',
          borderRadius: '18px',
          padding: '28px 28px 24px',
          maxWidth: '420px',
          width: '100%',
          boxShadow: '0 24px 64px rgba(0,0,0,.35)',
        }}
      >
        {/* Ícone de aviso */}
        <div style={{ textAlign: 'center', marginBottom: '18px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '52px', height: '52px',
            background: 'rgba(239,68,68,.12)',
            borderRadius: '50%',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/>
              <path d="M9 6V4h6v2"/>
            </svg>
          </div>
        </div>

        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--c-text-1)', textAlign: 'center', marginBottom: '10px' }}>
          Deletar campanha no Meta?
        </div>
        <div style={{ fontSize: '13px', color: 'var(--c-text-3)', textAlign: 'center', lineHeight: 1.6, marginBottom: '24px' }}>
          Isso vai apagar a campanha <strong style={{ color: 'var(--c-text-1)' }}>"{campaign.name}"</strong> diretamente no Meta Ads. Essa ação não pode ser desfeita.
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onCancel}
            disabled={deleting}
            style={{
              flex: 1, height: '40px',
              background: 'var(--c-surface)',
              border: '1.5px solid var(--c-border)',
              borderRadius: '10px',
              fontSize: '13px', fontWeight: 600,
              color: 'var(--c-text-2)',
              cursor: deleting ? 'not-allowed' : 'pointer',
              opacity: deleting ? 0.6 : 1,
            }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            style={{
              flex: 1, height: '40px',
              background: '#EF4444',
              border: 'none',
              borderRadius: '10px',
              fontSize: '13px', fontWeight: 700,
              color: '#fff',
              cursor: deleting ? 'not-allowed' : 'pointer',
              opacity: deleting ? 0.7 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}
          >
            {deleting ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Deletando…
              </>
            ) : 'Sim, deletar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ZombieCleanup() {
  const { isDark } = useTheme();

  const [zombies, setZombies]           = useState(null);   // null = não carregado ainda
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);

  // { campaign, resolve, reject } ou null
  const [confirmModal, setConfirmModal] = useState(null);
  const [deletingId, setDeletingId]     = useState(null);

  // Toast: { id, text, ok }
  const [toasts, setToasts]             = useState([]);

  function addToast(text, ok = true) {
    const id = Date.now();
    setToasts(t => [...t, { id, text, ok }]);
    if (!ok) playBell();
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4500);
  }

  const loadZombies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/api/admin/zombie-campaigns');
      setZombies(data.zombies ?? []);
    } catch (e) {
      const msg = e?.response?.data?.error || 'Erro ao buscar campanhas zumbi';
      setError(msg);
      addToast(msg, false);
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleDelete(campaign) {
    /* Abre modal, espera confirmação */
    await new Promise((resolve, reject) => {
      setConfirmModal({ campaign, resolve, reject });
    });
  }

  async function confirmDelete() {
    if (!confirmModal) return;
    const { campaign, resolve } = confirmModal;
    setConfirmModal(null);
    setDeletingId(campaign.meta_id);
    try {
      await api.delete(`/api/admin/zombie-campaigns/${campaign.meta_id}`);
      setZombies(prev => (prev ?? []).filter(z => z.meta_id !== campaign.meta_id));
      addToast(`Campanha "${campaign.name}" deletada do Meta.`, true);
      resolve();
    } catch (e) {
      const msg = e?.response?.data?.error_pt || e?.response?.data?.error || 'Erro ao deletar campanha';
      addToast(msg, false);
    } finally {
      setDeletingId(null);
    }
  }

  function cancelDelete() {
    if (confirmModal?.reject) confirmModal.reject(new Error('cancelado'));
    setConfirmModal(null);
  }

  const isEmpty = Array.isArray(zombies) && zombies.length === 0;

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto', padding: '32px 24px' }}>

      {/* ── Keyframes inline (spin + pulse) ── */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .45; }
        }
      `}</style>

      {/* ── Cabeçalho ── */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '42px', height: '42px',
            background: 'rgba(239,68,68,.12)',
            borderRadius: '12px',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/>
              <path d="M9 6V4h6v2"/>
            </svg>
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--c-text-1)' }}>
              Limpeza de campanhas zumbi
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--c-text-3)', lineHeight: 1.5 }}>
              Campanhas criadas no Meta que falharam no fluxo e ficaram órfãs — sem conjuntos de anúncios e sem registro aqui no painel.
            </p>
          </div>
        </div>
      </div>

      {/* ── Botão recarregar ── */}
      <button
        onClick={loadZombies}
        disabled={loading}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          height: '40px', padding: '0 18px',
          background: loading ? 'var(--c-surface)' : 'var(--c-accent)',
          border: loading ? '1.5px solid var(--c-border)' : 'none',
          borderRadius: '10px',
          fontSize: '13px', fontWeight: 700,
          color: loading ? 'var(--c-text-3)' : '#fff',
          cursor: loading ? 'not-allowed' : 'pointer',
          marginBottom: '28px',
          transition: 'all .15s',
          opacity: loading ? 0.75 : 1,
        }}
      >
        {loading ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            Buscando…
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/>
            </svg>
            Recarregar lista
          </>
        )}
      </button>

      {/* ── Erro ao carregar ── */}
      {error && !loading && (
        <div style={{
          background: 'rgba(239,68,68,.08)',
          border: '1px solid rgba(239,68,68,.3)',
          borderRadius: '12px',
          padding: '14px 18px',
          fontSize: '13px',
          color: '#EF4444',
          marginBottom: '24px',
        }}>
          {error}
        </div>
      )}

      {/* ── Skeletons durante loading ── */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && isEmpty && (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: 'var(--c-surface)',
          border: '1px solid var(--c-border)',
          borderRadius: '18px',
        }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>✨</div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '6px' }}>
            Nenhuma campanha zumbi por aqui
          </div>
          <div style={{ fontSize: '13px', color: 'var(--c-text-3)' }}>
            Todas as campanhas do Meta têm registro no painel ou têm conjuntos de anúncios ativos.
          </div>
        </div>
      )}

      {/* ── Lista de zumbis ── */}
      {!loading && !isEmpty && Array.isArray(zombies) && zombies.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{
            fontSize: '12px', color: 'var(--c-text-4)', fontWeight: 600,
            letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: '4px',
          }}>
            {zombies.length} campanha{zombies.length !== 1 ? 's' : ''} zumbi encontrada{zombies.length !== 1 ? 's' : ''}
          </div>

          {zombies.map(z => (
            <div
              key={z.meta_id}
              style={{
                background: 'var(--c-card-bg)',
                border: '1px solid var(--c-border)',
                borderRadius: '14px',
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                transition: 'border-color .15s, box-shadow .15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(239,68,68,.4)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(239,68,68,.08)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--c-border)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Nome + ID */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {z.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--c-text-4)', fontFamily: 'monospace' }}>
                    ID: {z.meta_id}
                  </div>
                </div>

                {/* Badge 0 conjuntos */}
                <div style={{
                  flexShrink: 0,
                  background: 'rgba(239,68,68,.1)',
                  border: '1px solid rgba(239,68,68,.25)',
                  borderRadius: '8px',
                  padding: '4px 10px',
                  fontSize: '11px', fontWeight: 700, color: '#EF4444',
                  whiteSpace: 'nowrap',
                }}>
                  {z.adsets_count === -1 ? 'erro ao verificar' : '0 conjuntos'}
                </div>
              </div>

              {/* Metadados */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '4px' }}>
                <MetaTag label="Status" value={statusLabelOf(z.status)} />
                <MetaTag label="Objetivo" value={OBJECTIVE_LABEL[z.objective] ?? z.objective} />
                <MetaTag label="Criada em" value={formatDateBR(z.created_time)} />
              </div>

              {/* Botão deletar */}
              <div style={{ marginTop: '10px' }}>
                <button
                  onClick={() => handleDelete(z)}
                  disabled={deletingId === z.meta_id}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '7px',
                    height: '36px', padding: '0 16px',
                    background: 'transparent',
                    border: '1.5px solid rgba(239,68,68,.5)',
                    borderRadius: '9px',
                    fontSize: '12px', fontWeight: 700,
                    color: '#EF4444',
                    cursor: deletingId === z.meta_id ? 'not-allowed' : 'pointer',
                    opacity: deletingId === z.meta_id ? 0.6 : 1,
                    transition: 'all .15s',
                  }}
                  onMouseEnter={e => {
                    if (deletingId !== z.meta_id) {
                      e.currentTarget.style.background = 'rgba(239,68,68,.08)';
                      e.currentTarget.style.borderColor = '#EF4444';
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = 'rgba(239,68,68,.5)';
                  }}
                >
                  {deletingId === z.meta_id ? (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                      </svg>
                      Deletando…
                    </>
                  ) : (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                        <path d="M10 11v6"/><path d="M14 11v6"/>
                        <path d="M9 6V4h6v2"/>
                      </svg>
                      Deletar do Meta
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Estado inicial (antes de clicar Recarregar) ── */}
      {!loading && zombies === null && !error && (
        <div style={{
          textAlign: 'center',
          padding: '50px 20px',
          background: 'var(--c-surface)',
          border: '1px dashed var(--c-border)',
          borderRadius: '18px',
          color: 'var(--c-text-4)',
          fontSize: '13px',
        }}>
          Clique em <strong style={{ color: 'var(--c-text-2)' }}>Recarregar lista</strong> para verificar campanhas zumbi no Meta.
        </div>
      )}

      {/* ── Modal de confirmação ── */}
      {confirmModal && (
        <ConfirmModal
          campaign={confirmModal.campaign}
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
          deleting={deletingId === confirmModal.campaign?.meta_id}
        />
      )}

      {/* ── Toasts ── */}
      <div style={{
        position: 'fixed', bottom: '24px', right: '24px',
        display: 'flex', flexDirection: 'column', gap: '10px',
        zIndex: 2000, pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div
            key={t.id}
            style={{
              background: t.ok ? 'var(--c-card-bg)' : 'rgba(239,68,68,.95)',
              border: `1px solid ${t.ok ? 'var(--c-border)' : 'transparent'}`,
              borderLeft: `4px solid ${t.ok ? '#22C55E' : 'transparent'}`,
              borderRadius: '12px',
              padding: '12px 16px',
              fontSize: '13px', fontWeight: 600,
              color: t.ok ? 'var(--c-text-1)' : '#fff',
              boxShadow: '0 8px 24px rgba(0,0,0,.2)',
              maxWidth: '320px',
              animation: 'toastIn .25s cubic-bezier(.22,1,.36,1)',
            }}
          >
            {t.text}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes toastIn {
          from { transform: translateX(30px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}

/* Pill de metadado (rótulo + valor) */
function MetaTag({ label, value }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      background: 'var(--c-surface)',
      border: '1px solid var(--c-border-lt)',
      borderRadius: '7px',
      padding: '4px 10px',
      fontSize: '12px',
    }}>
      <span style={{ color: 'var(--c-text-4)', fontWeight: 500 }}>{label}:</span>
      <span style={{ color: 'var(--c-text-2)', fontWeight: 600 }}>{value}</span>
    </div>
  );
}
