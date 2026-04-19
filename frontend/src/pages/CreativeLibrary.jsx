import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../contexts/AppStateContext';

/**
 * CreativeLibrary — biblioteca de criativos (texto, título, imagem/vídeo).
 * Criativos de anúncios publicados são salvos automaticamente aqui.
 * Usuário pode criar manualmente e reutilizar em novos anúncios.
 */

const GRAD_OPTIONS = [
  'linear-gradient(135deg,#FECDD3,#FDA4AF,#FB7185)',
  'linear-gradient(135deg,#FDE68A,#FCD34D,#F59E0B)',
  'linear-gradient(135deg,#C7D2FE,#A5B4FC,#818CF8)',
  'linear-gradient(135deg,#BBF7D0,#86EFAC,#4ADE80)',
  'linear-gradient(135deg,#FCE7F3,#FBCFE8,#F9A8D4)',
  'linear-gradient(135deg,#E9D5FF,#D8B4FE,#C084FC)',
];

const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/>
  </svg>
);
const IconCopy = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);
const IconReuse = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);
const IconImage = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
);

function emptyCreative() {
  return {
    name: '',
    primaryText: '',
    headline: '',
    description: '',
    cta: 'WhatsApp',
    thumbGrad: GRAD_OPTIONS[0],
  };
}

function CreativeCard({ creative, onRemove, onCopy, onReuseQuick, onReuseAdjust }) {
  return (
    <div className="ccb-card" style={{
      background: 'var(--c-card-bg)', border: '1px solid var(--c-border)',
      borderRadius: '14px', overflow: 'hidden',
      boxShadow: '0 2px 8px var(--c-shadow)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        height: '160px',
        background: creative.thumbGrad || GRAD_OPTIONS[0],
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        <IconImage />
        {creative.usedCount > 0 && (
          <div style={{
            position: 'absolute', top: '10px', right: '10px',
            background: 'rgba(0,0,0,.55)', color: '#fff',
            padding: '3px 9px', borderRadius: '20px',
            fontSize: '10px', fontWeight: 700,
          }}>
            Usado {creative.usedCount}×
          </div>
        )}
      </div>

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text-1)', lineHeight: 1.3 }}>
          {creative.name}
        </div>
        {creative.primaryText && (
          <div style={{
            fontSize: '11px', color: 'var(--c-text-3)', lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {creative.primaryText}
          </div>
        )}
        {creative.headline && (
          <div style={{
            fontSize: '11px', fontWeight: 600,
            color: 'var(--c-accent)', padding: '5px 10px',
            background: 'var(--c-active-bg)', borderRadius: '6px',
            alignSelf: 'flex-start',
          }}>
            🎯 {creative.headline}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: 'auto', paddingTop: '8px' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => onReuseQuick(creative)}
              title="Abre a criação direto na revisão, com público e orçamento padrão"
              style={{
                flex: 1, padding: '8px 10px',
                background: 'var(--c-accent)', color: '#fff',
                border: 'none', borderRadius: '8px',
                fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}
            >
              🚀 Publicar rápido
            </button>
            <button
              onClick={() => onReuseAdjust(creative)}
              title="Abre a criação com este texto preenchido e o passo a passo completo"
              style={{
                flex: 1, padding: '8px 10px',
                background: 'var(--c-surface)', color: 'var(--c-text-2)',
                border: '1.5px solid var(--c-border)', borderRadius: '8px',
                fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}
            >
              ✏️ Usar e ajustar
            </button>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={() => onCopy(creative)} style={{ ...actionBtn, flex: 1 }} title="Copiar texto">
              <IconCopy /> Copiar texto
            </button>
            <button onClick={() => onRemove(creative.id)} style={{ ...actionBtn, color: '#DC2626' }} title="Remover">
              <IconTrash />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreativeForm({ onSave, onCancel }) {
  const [data, setData] = useState(emptyCreative());

  function update(patch) { setData(prev => ({ ...prev, ...patch })); }

  function handleSave() {
    if (!data.name.trim()) return;
    onSave(data);
  }

  return (
    <div style={{
      background: 'var(--c-card-bg)', border: '1.5px solid var(--c-accent)',
      borderRadius: '16px', padding: '22px',
      display: 'flex', flexDirection: 'column', gap: '14px',
    }}>
      <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--c-text-1)', margin: 0 }}>
        Novo criativo
      </h3>

      <div>
        <label style={labelStyle}>Nome do criativo *</label>
        <input
          type="text"
          placeholder="Ex.: Promo pele renovada — maio"
          value={data.name}
          onChange={e => update({ name: e.target.value })}
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Texto principal</label>
        <textarea
          placeholder="Copie/cole o texto que aparece acima do anúncio"
          value={data.primaryText}
          onChange={e => update({ primaryText: e.target.value })}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={labelStyle}>Título</label>
          <input
            type="text"
            placeholder="Chame a atenção"
            value={data.headline}
            onChange={e => update({ headline: e.target.value })}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Descrição</label>
          <input
            type="text"
            placeholder="Reforço curto"
            value={data.description}
            onChange={e => update({ description: e.target.value })}
            style={inputStyle}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={labelStyle}>CTA</label>
          <select
            value={data.cta}
            onChange={e => update({ cta: e.target.value })}
            style={inputStyle}
          >
            <option>WhatsApp</option>
            <option>Saiba mais</option>
            <option>Agende agora</option>
            <option>Enviar mensagem</option>
            <option>Ligar</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Miniatura</label>
          <div style={{ display: 'flex', gap: '5px' }}>
            {GRAD_OPTIONS.map((g, i) => (
              <button
                key={i}
                onClick={() => update({ thumbGrad: g })}
                style={{
                  width: '32px', height: '32px', borderRadius: '8px',
                  background: g,
                  border: data.thumbGrad === g ? '2.5px solid var(--c-accent)' : '2px solid transparent',
                  cursor: 'pointer', padding: 0,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
        <button onClick={handleSave} style={btnPrimary} disabled={!data.name.trim()}>
          Salvar criativo
        </button>
        <button onClick={onCancel} style={btnGhost}>Cancelar</button>
      </div>
    </div>
  );
}

export default function CreativeLibrary() {
  const navigate = useNavigate();
  const { creatives, addCreative, removeCreative, markCreativeUsed, addNotification } = useAppState();
  const [mode, setMode] = useState('list');

  function handleSave(data) {
    addCreative(data);
    setMode('list');
  }

  function handleCopy(creative) {
    const text = [creative.primaryText, creative.headline, creative.description]
      .filter(Boolean).join('\n\n');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      addNotification({
        kind: 'info',
        title: 'Texto copiado',
        message: `Texto do criativo "${creative.name}" copiado para a área de transferência.`,
      });
    }
  }

  function handleReuseQuick(creative) {
    markCreativeUsed(creative.id);
    navigate('/criar-anuncio', { state: { reuseCreative: creative, reviewMode: true } });
  }

  function handleReuseAdjust(creative) {
    markCreativeUsed(creative.id);
    navigate('/criar-anuncio', { state: { reuseCreative: creative, reviewMode: false } });
  }

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '4px' }}>
            Biblioteca de criativos
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--c-text-3)', margin: 0 }}>
            Textos, títulos e descrições que você pode reutilizar em novos anúncios. Criativos de anúncios publicados são salvos aqui automaticamente.
          </p>
        </div>
        {mode === 'list' && (
          <button onClick={() => setMode('edit')} style={btnPrimaryInline}>
            <IconPlus /> Novo criativo
          </button>
        )}
      </div>

      {mode === 'edit' ? (
        <CreativeForm
          onSave={handleSave}
          onCancel={() => setMode('list')}
        />
      ) : (
        <>
          {creatives.length === 0 ? (
            <div style={emptyState}>
              <div style={{ fontSize: '40px', marginBottom: '10px' }}>🎨</div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '6px' }}>
                Nenhum criativo salvo
              </div>
              <div style={{ fontSize: '12px', color: 'var(--c-text-3)', marginBottom: '16px', maxWidth: '400px', margin: '0 auto 16px' }}>
                Crie um criativo manualmente ou publique um anúncio — o texto será salvo aqui para você reutilizar.
              </div>
              <button onClick={() => setMode('edit')} style={btnPrimaryInline}>
                <IconPlus /> Criar primeiro criativo
              </button>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '14px',
            }}>
              {creatives.map(c => (
                <CreativeCard
                  key={c.id}
                  creative={c}
                  onRemove={removeCreative}
                  onCopy={handleCopy}
                  onReuseQuick={handleReuseQuick}
                  onReuseAdjust={handleReuseAdjust}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '10px 14px', fontSize: '13px',
  border: '1.5px solid var(--c-border)', borderRadius: '10px',
  background: 'var(--c-surface)', color: 'var(--c-text-1)',
  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
};
const labelStyle = {
  display: 'block', fontSize: '11px', fontWeight: 700,
  color: 'var(--c-text-3)', marginBottom: '6px',
  textTransform: 'uppercase', letterSpacing: '.4px',
};
const btnPrimary = {
  flex: 1, padding: '12px', fontSize: '13px', fontWeight: 700,
  background: 'var(--c-accent)', color: '#fff',
  border: 'none', borderRadius: '10px', cursor: 'pointer',
};
const btnPrimaryInline = {
  padding: '10px 16px', fontSize: '12px', fontWeight: 700,
  background: 'var(--c-accent)', color: '#fff',
  border: 'none', borderRadius: '10px', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: '6px',
};
const btnGhost = {
  padding: '12px 18px', fontSize: '13px', fontWeight: 600,
  background: 'var(--c-surface)', color: 'var(--c-text-3)',
  border: '1.5px solid var(--c-border)', borderRadius: '10px', cursor: 'pointer',
};
const actionBtn = {
  padding: '7px 10px', fontSize: '11px', fontWeight: 600,
  background: 'var(--c-surface)', color: 'var(--c-text-2)',
  border: '1px solid var(--c-border)', borderRadius: '8px',
  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
  justifyContent: 'center',
};
const emptyState = {
  background: 'var(--c-card-bg)', border: '1px dashed var(--c-border)',
  borderRadius: '18px', padding: '56px 24px', textAlign: 'center',
  color: 'var(--c-text-3)',
};
