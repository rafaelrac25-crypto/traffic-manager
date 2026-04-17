import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../contexts/AppStateContext';

/* ── Catálogo de motivos e sugestões ── */
const REASON_HINTS = {
  'políticas de anúncio':  'Revise o texto e a imagem: evite promessas exageradas, linguagem sensacionalista e comparações.',
  'conteúdo sensível':     'Substitua imagens com pele excessivamente exposta ou procedimentos invasivos.',
  'texto enganoso':        'Seja claro sobre preço, prazo e resultado. Evite termos como "milagroso" ou "instantâneo".',
  'antes e depois':        'Imagens de antes/depois em estética são limitadas — use foto do procedimento ou resultado sutil.',
  'direitos autorais':     'Use apenas imagens próprias, licenciadas ou do seu portfólio.',
  'qualidade baixa':       'Use imagens em alta resolução, bem iluminadas e com o produto/serviço claro.',
};

function SuggestionBox({ reason }) {
  const key = Object.keys(REASON_HINTS).find(k => reason?.toLowerCase().includes(k));
  const hint = key ? REASON_HINTS[key] : 'Revise texto, imagem e público-alvo conforme as políticas do Meta Ads.';
  return (
    <div style={{
      marginTop: '10px',
      padding: '12px 14px',
      background: 'rgba(34,197,94,.07)',
      border: '1px solid rgba(34,197,94,.25)',
      borderRadius: '10px',
    }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: '#16A34A', marginBottom: '4px', letterSpacing: '.5px' }}>
        💡 COMO CORRIGIR
      </div>
      <p style={{ fontSize: '12px', color: 'var(--c-text-2)', margin: 0, lineHeight: 1.6 }}>
        {hint}
      </p>
    </div>
  );
}

function RejectedCard({ ad, onRemove, onEdit }) {
  const when = new Date(ad.rejectedAt).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div style={{
      background: 'var(--c-card-bg)',
      border: '1px solid var(--c-border)',
      borderLeft: '4px solid #EF4444',
      borderRadius: '14px',
      padding: '18px 20px',
      boxShadow: '0 2px 8px var(--c-shadow)',
      marginBottom: '14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '10px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <span style={{
              fontSize: '10px', fontWeight: 700, color: '#DC2626',
              background: 'rgba(239,68,68,.1)', padding: '3px 8px', borderRadius: '20px',
              letterSpacing: '.5px',
            }}>REPROVADO</span>
            <span style={{ fontSize: '11px', color: 'var(--c-text-4)' }}>{when}</span>
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--c-text-1)', margin: 0 }}>
            {ad.name || 'Anúncio sem nome'}
          </h3>
        </div>
        <button
          onClick={() => onRemove(ad.id)}
          title="Remover da lista"
          style={{
            background: 'none', border: '1px solid var(--c-border)',
            color: 'var(--c-text-4)', cursor: 'pointer',
            width: '28px', height: '28px', borderRadius: '8px',
            fontSize: '14px', lineHeight: 1, flexShrink: 0,
          }}
        >×</button>
      </div>

      <div style={{ fontSize: '13px', color: 'var(--c-text-2)', lineHeight: 1.6 }}>
        <strong style={{ color: '#DC2626' }}>Motivo do Meta:</strong> {ad.reason || 'políticas de anúncio não atendidas'}
      </div>

      {ad.details && (
        <p style={{ fontSize: '12px', color: 'var(--c-text-3)', lineHeight: 1.6, marginTop: '8px', marginBottom: 0 }}>
          {ad.details}
        </p>
      )}

      <SuggestionBox reason={ad.reason} />

      <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
        <button
          onClick={() => onEdit(ad)}
          style={{
            padding: '9px 16px', background: 'var(--c-accent)', color: '#fff',
            border: 'none', borderRadius: '10px', fontSize: '12px', fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Corrigir e reenviar
        </button>
        <button
          onClick={() => onRemove(ad.id)}
          style={{
            padding: '9px 16px', background: 'var(--c-surface)', color: 'var(--c-text-3)',
            border: '1.5px solid var(--c-border)', borderRadius: '10px',
            fontSize: '12px', fontWeight: 500, cursor: 'pointer',
          }}
        >
          Descartar
        </button>
      </div>
    </div>
  );
}

export default function Rejected() {
  const navigate = useNavigate();
  const { rejectedAds, removeRejectedAd, addRejectedAd } = useAppState();

  function seedDemo() {
    addRejectedAd({
      name: 'Pacote Spa Relax',
      reason: 'políticas de anúncio — texto enganoso',
      details: 'O texto "resultado em 1 dia garantido" não pode ser usado. Remova promessas de resultado ou tempo específico.',
    });
  }

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--c-text-1)', marginBottom: '4px' }}>
            Anúncios reprovados
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--c-text-3)' }}>
            Veja os motivos da recusa pelo Meta e como corrigir antes de reenviar.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {rejectedAds.length === 0 && (
            <button
              onClick={seedDemo}
              style={{
                padding: '8px 14px', fontSize: '11px',
                background: 'var(--c-surface)', border: '1.5px solid var(--c-border)',
                borderRadius: '10px', cursor: 'pointer', color: 'var(--c-text-3)',
              }}
            >
              + Simular reprovação (teste)
            </button>
          )}
          <button
            onClick={() => navigate('/criar-anuncio')}
            style={{
              padding: '10px 18px', background: 'var(--c-accent)', color: '#fff',
              border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Criar novo anúncio
          </button>
        </div>
      </div>

      {rejectedAds.length === 0 ? (
        <div style={{
          background: 'var(--c-card-bg)', border: '1px solid var(--c-border)',
          borderRadius: '16px', padding: '60px 30px', textAlign: 'center',
          boxShadow: '0 2px 8px var(--c-shadow)',
        }}>
          <div style={{ fontSize: '44px', marginBottom: '12px' }}>✅</div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '6px' }}>
            Nenhum anúncio reprovado
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--c-text-4)', margin: 0 }}>
            Quando o Meta rejeitar algum anúncio, ele aparecerá aqui com o motivo e sugestões de correção.
          </p>
        </div>
      ) : (
        <div>
          {rejectedAds.map(ad => (
            <RejectedCard
              key={ad.id}
              ad={ad}
              onRemove={removeRejectedAd}
              onEdit={() => navigate('/criar-anuncio')}
            />
          ))}
        </div>
      )}
    </div>
  );
}
