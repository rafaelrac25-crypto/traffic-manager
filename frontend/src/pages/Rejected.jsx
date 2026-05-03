import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../contexts/AppStateContext';
import { getRejectionInfo } from '../data/rejectionRules';

function SuggestionBox({ reason }) {
  const { hint } = getRejectionInfo(reason);
  return (
    <div style={{
      marginTop: '10px',
      padding: '12px 14px',
      background: 'rgba(52,211,153,.10)',
      border: '1px solid rgba(52,211,153,.3)',
      borderRadius: '10px',
    }}>
      <div style={{ fontSize: '11px', fontWeight: 500, color: '#34D399', marginBottom: '4px', letterSpacing: '.5px' }}>
        💡 COMO CORRIGIR
      </div>
      <p style={{ fontSize: '12px', color: 'var(--c-text-2)', margin: 0, lineHeight: 1.6, fontWeight: 400 }}>
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
    <div className="ccb-card" style={{
      borderLeft: '2px solid #F87171',
      borderRadius: '18px',
      padding: '18px 20px',
      marginBottom: '14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '10px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <span style={{
              fontSize: '10.5px', fontWeight: 700, color: '#F87171',
              background: 'rgba(248,113,113,.16)', border: '1px solid rgba(248,113,113,.3)',
              padding: '4px 9px', borderRadius: '999px',
              letterSpacing: '.3px',
            }}>REPROVADO</span>
            <span style={{ fontSize: '11px', color: 'var(--c-text-4)', fontWeight: 400 }}>{when}</span>
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--c-text-1)', margin: 0 }}>
            {ad.name || 'Anúncio sem nome'}
          </h3>
        </div>
        <button
          onClick={() => onRemove(ad.id)}
          title="Remover da lista"
          style={{
            background: 'var(--c-surface)', border: '1px solid var(--c-border)',
            color: 'var(--c-text-3)', cursor: 'pointer',
            width: '28px', height: '28px', borderRadius: '8px',
            fontSize: '14px', lineHeight: 1, flexShrink: 0,
          }}
        >×</button>
      </div>

      <div style={{ fontSize: '13px', color: 'var(--c-text-2)', lineHeight: 1.6, fontWeight: 400 }}>
        <strong style={{ color: '#F87171', fontWeight: 700 }}>Motivo do Meta:</strong> {ad.reason || 'políticas de anúncio não atendidas'}
      </div>

      {ad.details && (
        <p style={{ fontSize: '12px', color: 'var(--c-text-3)', lineHeight: 1.6, marginTop: '8px', marginBottom: 0, fontWeight: 400 }}>
          {ad.details}
        </p>
      )}

      {/* Painel de diagnóstico técnico (expansível) — mostra stage + params
         enviados quando Meta retorna erro sem error_user_msg específico */}
      {(ad.stage || ad.sentParams) && (
        <details style={{ marginTop: '10px', fontSize: '11.5px' }}>
          <summary style={{ cursor: 'pointer', color: 'var(--c-text-3)', fontWeight: 500 }}>
            🔧 Diagnóstico técnico (pro dev)
          </summary>
          <div style={{ marginTop: '8px', padding: '10px 12px', background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: '10px', fontFamily: 'monospace', fontSize: '11px', color: 'var(--c-text-3)' }}>
            {ad.stage && <div><strong>Etapa:</strong> {ad.stage}</div>}
            {ad.code != null && <div><strong>Código Meta:</strong> {ad.code}{ad.subcode ? ` / ${ad.subcode}` : ''}</div>}
            {ad.endpoint && <div><strong>Endpoint:</strong> {ad.endpoint}</div>}
            {ad.sentParams && (
              <div style={{ marginTop: '6px' }}>
                <strong>Params enviados:</strong>
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginTop: '4px', background: 'var(--c-card-bg)', padding: '8px', borderRadius: '6px', maxHeight: '200px', overflow: 'auto' }}>
                  {JSON.stringify(ad.sentParams, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </details>
      )}

      <SuggestionBox reason={ad.reason} />

      <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
        <button
          onClick={() => onEdit(ad)}
          style={{
            padding: '11px 18px', borderRadius: '12px',
            border: 0,
            background: 'linear-gradient(135deg, var(--c-accent), var(--c-accent-dk))',
            color: '#fff', fontWeight: 700, fontSize: '13px',
            boxShadow: '0 8px 24px rgba(193,53,132,.4), inset 0 1px 0 rgba(255,255,255,.18)',
            cursor: 'pointer',
          }}
        >
          Corrigir e reenviar
        </button>
        <button
          onClick={() => onRemove(ad.id)}
          style={{
            padding: '8px 14px', borderRadius: '10px',
            background: 'var(--c-surface)', color: 'var(--c-text-2)',
            border: '1px solid var(--c-border)',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer',
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
      payload: {
        objective: 'messages',
        locations: [
          { id: 'loc-seed-1', name: 'Joinville', lat: -26.3044, lng: -48.8487, radius: 5 },
          { id: 'loc-seed-2', name: 'Centro',    lat: -26.3044, lng: -48.8487, radius: 5 },
        ],
        ageRange: [25, 45],
        gender: 'female',
        interests: ['Estética', 'Autocuidado', 'Bem-estar'],
        budgetType: 'daily',
        budgetValue: '50',
        startDate: '',
        endDate: '',
        adFormat: 'image',
        mediaFiles: [],
        primaryText: 'Pacote Spa Relax com resultado em 1 dia garantido! Relaxamento milagroso para quem não aguenta mais stress. Vem já!',
        headline: 'Resultado milagroso garantido',
        destUrl: 'https://wa.me/5547997071161',
        ctaButton: 'WhatsApp',
      },
    });
  }

  function handleEdit(ad) {
    navigate('/criar-anuncio', { state: { rejectedAd: ad } });
  }

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--c-text-1)', marginBottom: '4px', letterSpacing: '-0.01em' }}>
            Anúncios reprovados
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--c-text-3)', fontWeight: 400 }}>
            Veja os motivos da recusa pelo Meta e como corrigir antes de reenviar.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {rejectedAds.length === 0 && (
            <button
              onClick={seedDemo}
              style={{
                padding: '8px 14px', fontSize: '12px',
                background: 'var(--c-surface)', border: '1px solid var(--c-border)',
                borderRadius: '10px', cursor: 'pointer', color: 'var(--c-text-2)',
                fontWeight: 600,
              }}
            >
              + Simular reprovação (teste)
            </button>
          )}
          <button
            onClick={() => navigate('/criar-anuncio')}
            style={{
              padding: '11px 18px', borderRadius: '12px',
              border: 0,
              background: 'linear-gradient(135deg, var(--c-accent), var(--c-accent-dk))',
              color: '#fff', fontSize: '13px', fontWeight: 700,
              boxShadow: '0 8px 24px rgba(193,53,132,.4), inset 0 1px 0 rgba(255,255,255,.18)',
              cursor: 'pointer',
            }}
          >
            Criar novo anúncio
          </button>
        </div>
      </div>

      {rejectedAds.length === 0 ? (
        <div className="ccb-card" style={{
          borderRadius: '18px', padding: '60px 30px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '44px', marginBottom: '12px' }}>✅</div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '6px' }}>
            Nenhum anúncio reprovado
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--c-text-3)', margin: 0, fontWeight: 400 }}>
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
              onEdit={handleEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}
