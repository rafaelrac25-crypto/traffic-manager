/**
 * PublishingModal — exibe progresso real de publicação via polling do job async.
 * Props:
 *   jobId      string    — UUID retornado pelo POST /api/campaigns (202)
 *   onComplete ()=>void  — chamado após 1.5s quando status=completed
 *   onFailure  ()=>void  — chamado imediatamente quando status=failed (opcional)
 *   onClose    (retry?:boolean)=>void — botão "Fechar" / "Tentar de novo"
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getPublishJob } from '../services/api';
import { playBell, playBubble } from '../utils/sounds';

/* Mapeamento status → rótulo PT-BR */
const STATUS_LABELS = {
  queued:            'Aguardando worker...',
  uploading_media:   'Subindo mídia... ⬆️',
  creating_campaign: 'Criando campanha... 🏗️',
  creating_adsets:   'Criando conjuntos... 📦',
  creating_creatives:'Criando criativos... 🖼️',
  creating_ads:      'Criando anúncios... 📢',
  completed:         'Publicado! ✅',
  failed:            'Algo deu errado ❌',
};

/* Fases ativas: modal não pode ser fechado nessas */
const ACTIVE_PHASES = new Set([
  'queued', 'uploading_media', 'creating_campaign',
  'creating_adsets', 'creating_creatives', 'creating_ads',
]);

const POLL_INTERVAL_MS = 1200;
const COMPLETE_DELAY_MS = 1500;

export default function PublishingModal({ jobId, onComplete, onFailure, onClose }) {
  const [job, setJob] = useState(null);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);
  const completedRef = useRef(false);
  const failedRef = useRef(false);
  const firstFocusRef = useRef(null);

  /* Foca o modal ao montar — acessibilidade */
  useEffect(() => {
    firstFocusRef.current?.focus();
  }, []);

  /* Bloqueia ESC durante fases ativas */
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        const isActive = ACTIVE_PHASES.has(job?.status);
        if (isActive) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    }
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [job?.status]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  /* Inicia polling */
  useEffect(() => {
    if (!jobId) return;

    async function poll() {
      try {
        const res = await getPublishJob(jobId);
        const data = res.data;
        setJob(data);
        setError(null);

        if (data.status === 'completed' && !completedRef.current) {
          completedRef.current = true;
          stopPolling();
          playBubble();
          setTimeout(() => {
            onComplete?.();
          }, COMPLETE_DELAY_MS);
        }

        if (data.status === 'failed' && !failedRef.current) {
          failedRef.current = true;
          stopPolling();
          playBell();
          onFailure?.();
        }
      } catch (err) {
        /* Não para o polling em erros de rede — pode ser flap momentâneo */
        setError('Erro ao buscar status. Tentando novamente...');
      }
    }

    /* Busca imediata ao montar */
    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => stopPolling();
  }, [jobId, onComplete, onFailure, stopPolling]);

  /* Calcula % de progresso */
  const pct = (() => {
    if (!job) return null;
    const { current_step, total_steps } = job;
    if (!total_steps || total_steps === 0) return null; // barra indeterminada
    return Math.min(100, Math.max(0, Math.round((current_step / total_steps) * 100)));
  })();

  const statusLabel = job ? (STATUS_LABELS[job.status] || job.status) : 'Iniciando...';
  const isActive    = ACTIVE_PHASES.has(job?.status);
  const isCompleted = job?.status === 'completed';
  const isFailed    = job?.status === 'failed';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Progresso de publicação"
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,.72)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        ref={firstFocusRef}
        tabIndex={-1}
        className="ccb-card ccb-modal"
        style={{
          padding: '36px 32px',
          maxWidth: '440px',
          width: '100%',
          borderRadius: '20px',
          textAlign: 'center',
          outline: 'none',
        }}
      >
        {/* Ícone animado */}
        <div style={{ marginBottom: '18px', fontSize: '44px', lineHeight: 1 }}>
          {isCompleted ? (
            <span style={{ animation: 'ccb-pop .4s ease' }}>✅</span>
          ) : isFailed ? (
            '❌'
          ) : (
            <span style={{ display: 'inline-block', animation: 'ccb-spin 1.4s linear infinite' }}>⚙️</span>
          )}
        </div>

        {/* Título do status */}
        <h2
          style={{
            fontSize: '18px',
            fontWeight: 800,
            color: isFailed ? '#F87171' : isCompleted ? '#34D399' : 'var(--c-text-1)',
            marginBottom: '8px',
            lineHeight: 1.3,
          }}
          aria-live="polite"
        >
          {statusLabel}
        </h2>

        {/* Mensagem da fase */}
        {job?.message && (
          <p
            style={{ fontSize: '13px', color: 'var(--c-text-2)', marginBottom: '16px', lineHeight: 1.6 }}
            aria-live="polite"
          >
            {job.message}
          </p>
        )}

        {/* Barra de progresso */}
        <div style={{ marginBottom: '20px' }}>
          {pct !== null ? (
            /* Barra determinada */
            <>
              <div style={{
                height: '8px',
                background: 'rgba(0,0,0,.12)',
                borderRadius: '4px',
                overflow: 'hidden',
                marginBottom: '6px',
              }}>
                <div style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: isFailed
                    ? '#F87171'
                    : isCompleted
                      ? '#34D399'
                      : 'linear-gradient(90deg, var(--c-accent), var(--c-accent-dk))',
                  borderRadius: '4px',
                  transition: 'width .4s ease',
                }} />
              </div>
              <div style={{ fontSize: '11px', color: 'var(--c-text-3)', fontWeight: 600 }}>
                Etapa {job?.current_step} de {job?.total_steps} — {pct}%
              </div>
            </>
          ) : (
            /* Barra indeterminada */
            <div style={{
              height: '8px',
              background: 'rgba(0,0,0,.12)',
              borderRadius: '4px',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: '40%',
                background: 'linear-gradient(90deg, var(--c-accent), var(--c-accent-dk))',
                borderRadius: '4px',
                animation: 'ccb-indeterminate 1.6s ease-in-out infinite',
              }} />
            </div>
          )}
        </div>

        {/* Erro em caso de falha */}
        {isFailed && job?.error && (
          <div style={{
            padding: '12px 14px',
            background: 'rgba(248,113,113,.12)',
            border: '1px solid rgba(248,113,113,.3)',
            borderRadius: '10px',
            fontSize: '12.5px',
            color: '#F87171',
            marginBottom: '20px',
            lineHeight: 1.6,
            textAlign: 'left',
          }}>
            {job.error}
          </div>
        )}

        {/* Erro de polling (rede) */}
        {error && !isFailed && (
          <p style={{ fontSize: '11.5px', color: 'var(--c-text-4)', marginBottom: '12px' }}>
            {error}
          </p>
        )}

        {/* Botões — só visíveis após terminal */}
        {(isCompleted || isFailed) && (
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              onClick={() => onClose?.(false)}
              style={{
                padding: '11px 22px',
                background: 'transparent',
                color: 'var(--c-text-2)',
                border: '1.5px solid var(--c-border)',
                borderRadius: '12px',
                fontSize: '13px', fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Fechar
            </button>
            {isFailed && (
              <button
                onClick={() => onClose?.(true)}
                style={{
                  padding: '11px 24px',
                  background: 'linear-gradient(135deg, var(--c-accent), var(--c-accent-dk))',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '13px', fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 6px 20px rgba(193,53,132,.35)',
                }}
              >
                Tentar de novo
              </button>
            )}
          </div>
        )}

        {/* Feedback sutil durante fases ativas */}
        {isActive && (
          <p style={{ fontSize: '11px', color: 'var(--c-text-4)', marginTop: '4px' }}>
            Não feche esta janela — publicação em andamento.
          </p>
        )}
      </div>

      {/* Keyframes inline */}
      <style>{`
        @keyframes ccb-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes ccb-pop {
          0%   { transform: scale(0.5); opacity: 0; }
          70%  { transform: scale(1.2); }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes ccb-indeterminate {
          0%   { transform: translateX(-150%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </div>
  );
}
