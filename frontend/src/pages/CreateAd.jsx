/**
 * DESIGN STANDARD
 *
 * All future screens must follow the same visual structure
 * defined in the reference images at Visual/Tema Cris costa Beauty/
 *
 * Do not create new layout patterns.
 * Extend existing components only.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

/* ── Passos do wizard ── */
const STEPS = ['Plataforma', 'Objetivo', 'Público', 'Orçamento', 'Revisar', 'Publicar'];

/* ── Plataformas ── */
const PLATFORMS = [
  {
    id: 'instagram',
    name: 'Instagram',
    desc: 'Feed, Stories e Reels',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" width="32" height="32">
        <defs>
          <radialGradient id="ig1" cx="30%" cy="107%" r="150%">
            <stop offset="0%" stopColor="#fdf497"/>
            <stop offset="5%" stopColor="#fdf497"/>
            <stop offset="45%" stopColor="#fd5949"/>
            <stop offset="60%" stopColor="#d6249f"/>
            <stop offset="90%" stopColor="#285AEB"/>
          </radialGradient>
        </defs>
        <rect x="2" y="2" width="20" height="20" rx="5.5" fill="url(#ig1)"/>
        <circle cx="12" cy="12" r="4.5" stroke="white" strokeWidth="2" fill="none"/>
        <circle cx="17.5" cy="6.5" r="1.2" fill="white"/>
      </svg>
    ),
  },
  {
    id: 'google',
    name: 'Google Ads',
    desc: 'Resultados no Google',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" width="32" height="32">
        <path d="M3.5 17.5L9 7.5L14.5 17.5H3.5Z" fill="#4285F4"/>
        <path d="M9 7.5L14.5 17.5H3.5Z" fill="#4285F4" opacity="0.4"/>
        <circle cx="18.5" cy="14.5" r="4" fill="#34A853"/>
        <path d="M14.5 17.5L9 7.5" stroke="#FBBC05" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'meta',
    name: 'Meta Ads',
    desc: 'Facebook, Instagram e Audience',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" width="32" height="32">
        <path d="M12 2.5C6.75 2.5 2.5 6.75 2.5 12S6.75 21.5 12 21.5 21.5 17.25 21.5 12 17.25 2.5 12 2.5z" fill="#1877F2"/>
        <path d="M16 8.5h-1.5c-.55 0-.75.25-.75.75V10.5h2.25L15.7 13H13.75v7H11v-7H9.5v-2.5H11V9c0-2 1.25-3 3-3 .85 0 2 .15 2 .15V8.5z" fill="white"/>
      </svg>
    ),
  },
];

/* ── Ícone de check ── */
const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

/* ── Ícone info ── */
const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

/* ── Step indicator ── */
function StepIndicator({ current, steps }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '32px', overflowX: 'auto', paddingBottom: '4px' }}>
      {steps.map((label, i) => {
        const isActive   = i === current;
        const isDone     = i < current;
        const isUpcoming = i > current;

        return (
          <React.Fragment key={label}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              {/* Círculo */}
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: isDone ? 'var(--c-accent)' : isActive ? 'var(--c-accent)' : 'var(--c-surface)',
                border: `2px solid ${isActive || isDone ? 'var(--c-accent)' : 'var(--c-border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: 700,
                color: isActive || isDone ? '#fff' : 'var(--c-text-4)',
                transition: 'all .2s',
              }}>
                {isDone ? <CheckIcon /> : i + 1}
              </div>
              {/* Label */}
              <div style={{
                fontSize: '11px', fontWeight: isActive ? 700 : 400,
                color: isActive ? 'var(--c-accent)' : isDone ? 'var(--c-text-3)' : 'var(--c-text-4)',
                marginTop: '6px', whiteSpace: 'nowrap',
              }}>
                {label}
              </div>
            </div>

            {/* Linha conectora */}
            {i < steps.length - 1 && (
              <div style={{
                flex: 1, height: '2px', minWidth: '20px', maxWidth: '80px',
                background: i < current ? 'var(--c-accent)' : 'var(--c-border)',
                margin: '0 4px', marginBottom: '18px',
                transition: 'background .2s',
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ── Página Criar Anúncio ── */
export default function CreateAd() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedPlatform, setSelectedPlatform] = useState('instagram');
  const [adName, setAdName] = useState('');

  const platform = PLATFORMS.find(p => p.id === selectedPlatform) || PLATFORMS[0];

  return (
    <div style={{ padding: '28px', animation: 'fadeIn .25s ease' }}>

      {/* ── Cabeçalho ── */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--c-text-1)', marginBottom: '4px' }}>
          Criar novo anúncio
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--c-text-3)' }}>
          Configure sua campanha em poucos passos.
        </p>
      </div>

      {/* ── Step indicator ── */}
      <StepIndicator current={currentStep} steps={STEPS} />

      {/* ── Layout: conteúdo + resumo ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '20px', alignItems: 'start' }}>

        {/* ── Conteúdo principal ── */}
        <div style={{
          background: 'var(--c-card-bg)',
          borderRadius: '16px',
          border: '1px solid var(--c-border)',
          padding: '28px',
          boxShadow: '0 2px 8px var(--c-shadow)',
        }}>

          {/* Pergunta */}
          <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '6px' }}>
            Onde você quer anunciar?
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--c-text-4)', marginBottom: '24px' }}>
            Você pode escolher uma plataforma agora. Depois ajustamos os detalhes.
          </p>

          {/* Cards de plataforma */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '28px' }}>
            {PLATFORMS.map(plat => {
              const isSelected = selectedPlatform === plat.id;
              return (
                <div
                  key={plat.id}
                  onClick={() => setSelectedPlatform(plat.id)}
                  style={{
                    position: 'relative',
                    border: `2px solid ${isSelected ? 'var(--c-accent)' : 'var(--c-border)'}`,
                    borderRadius: '14px',
                    padding: '20px 16px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--c-active-bg)' : 'var(--c-surface)',
                    transition: 'all .15s',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = 'var(--c-text-4)'; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = 'var(--c-border)'; }}
                >
                  {/* Radio indicator */}
                  <div style={{
                    position: 'absolute', top: '12px', right: '12px',
                    width: '16px', height: '16px', borderRadius: '50%',
                    border: `2px solid ${isSelected ? 'var(--c-accent)' : 'var(--c-border)'}`,
                    background: isSelected ? 'var(--c-accent)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all .15s',
                  }}>
                    {isSelected && (
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff' }} />
                    )}
                  </div>

                  {/* Ícone */}
                  <div style={{
                    width: '52px', height: '52px', borderRadius: '14px',
                    background: 'var(--c-card-bg)',
                    border: '1px solid var(--c-border-lt)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 12px',
                    boxShadow: isSelected ? '0 2px 8px var(--c-shadow-md)' : 'none',
                    transition: 'box-shadow .15s',
                  }}>
                    {plat.icon}
                  </div>

                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '4px' }}>
                    {plat.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--c-text-4)' }}>
                    {plat.desc}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Campo nome do anúncio */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--c-text-1)', marginBottom: '6px' }}>
              Dê um nome para seu anúncio
            </label>
            <p style={{ fontSize: '11px', color: 'var(--c-text-4)', marginBottom: '10px' }}>
              Escolha um nome simples para identificar depois.
            </p>
            <input
              type="text"
              value={adName}
              onChange={e => setAdName(e.target.value)}
              placeholder="Ex: Promoção Verão — Skincare"
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1.5px solid var(--c-border)',
                borderRadius: '10px',
                background: 'var(--c-surface)',
                fontSize: '13px',
                color: 'var(--c-text-1)',
                fontFamily: 'inherit',
                outline: 'none',
                transition: 'border-color .15s',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--c-accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--c-border)'}
            />
          </div>

          {/* Nota informativa */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: '10px',
            background: 'var(--c-surface)',
            border: '1px solid var(--c-border)',
            borderRadius: '10px',
            padding: '14px 16px',
            marginBottom: '32px',
          }}>
            <span style={{ color: 'var(--c-accent)', flexShrink: 0, marginTop: '1px' }}>
              <InfoIcon />
            </span>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--c-text-2)', marginBottom: '3px' }}>
                Você poderá ajustar tudo depois
              </div>
              <div style={{ fontSize: '11px', color: 'var(--c-text-4)', lineHeight: 1.6 }}>
                Imagens, público, orçamento, posicionamentos e muito mais serão configurados nos próximos passos.
              </div>
            </div>
          </div>

          {/* Botões de ação */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              onClick={() => navigate('/anuncios')}
              style={{
                padding: '11px 22px',
                borderRadius: '10px',
                border: '1.5px solid var(--c-border)',
                background: 'var(--c-card-bg)',
                fontSize: '13px', fontWeight: 600,
                color: 'var(--c-text-2)', cursor: 'pointer',
                transition: 'all .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--c-text-3)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--c-border)'}
            >
              Cancelar
            </button>

            <button
              onClick={() => setCurrentStep(s => Math.min(STEPS.length - 1, s + 1))}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: 'var(--c-accent)', color: '#fff',
                border: 'none', borderRadius: '10px',
                padding: '11px 22px', fontSize: '13px', fontWeight: 700,
                cursor: 'pointer', transition: 'background .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--c-accent-dk)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--c-accent)'}
            >
              Próximo passo
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
            </button>
          </div>
        </div>

        {/* ── Painel de resumo ── */}
        <div style={{
          background: 'var(--c-card-bg)',
          borderRadius: '16px',
          border: '1px solid var(--c-border)',
          padding: '20px',
          boxShadow: '0 2px 8px var(--c-shadow)',
          position: 'sticky',
          top: '80px',
        }}>
          {/* Título do painel */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <div style={{
              width: '30px', height: '30px', borderRadius: '8px',
              background: 'var(--c-active-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px',
            }}>📋</div>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text-1)' }}>
              Resumo da criação
            </span>
          </div>

          {/* Passo atual */}
          <div style={{
            background: 'var(--c-surface)',
            borderRadius: '10px',
            padding: '12px 14px',
            marginBottom: '16px',
            border: '1px solid var(--c-border-lt)',
          }}>
            <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1px', color: 'var(--c-text-4)', textTransform: 'uppercase', marginBottom: '6px' }}>
              Passo atual
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '4px' }}>
              {STEPS[currentStep]}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--c-text-4)' }}>
              {currentStep === 0 ? 'Escolha onde deseja anunciar.' : ''}
              {currentStep === 1 ? 'Defina o objetivo da campanha.' : ''}
              {currentStep === 2 ? 'Configure o público-alvo.' : ''}
              {currentStep === 3 ? 'Defina o orçamento diário.' : ''}
              {currentStep === 4 ? 'Revise todos os detalhes.' : ''}
              {currentStep === 5 ? 'Publique sua campanha.' : ''}
            </div>
          </div>

          {/* O que foi selecionado */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1px', color: 'var(--c-text-4)', textTransform: 'uppercase', marginBottom: '10px' }}>
              Você selecionou
            </div>

            {/* Plataforma selecionada */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              background: 'var(--c-surface)',
              borderRadius: '10px', padding: '10px 12px',
              border: '1px solid var(--c-border-lt)',
            }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '8px',
                background: 'var(--c-card-bg)',
                border: '1px solid var(--c-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {platform.icon}
              </div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--c-text-1)' }}>
                {platform.name}
              </span>
            </div>

            {/* Nome do anúncio — se preenchido */}
            {adName && (
              <div style={{
                marginTop: '8px',
                background: 'var(--c-surface)',
                borderRadius: '10px', padding: '10px 12px',
                border: '1px solid var(--c-border-lt)',
              }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--c-text-4)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '.5px' }}>Nome</div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--c-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {adName}
                </div>
              </div>
            )}
          </div>

          {/* Próximo passo info */}
          {currentStep < STEPS.length - 1 && (
            <div style={{
              background: 'var(--c-surface)',
              borderRadius: '10px', padding: '12px 14px',
              border: '1px solid var(--c-border-lt)',
            }}>
              <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1px', color: 'var(--c-text-4)', textTransform: 'uppercase', marginBottom: '6px' }}>
                Próximo passo
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text-1)', marginBottom: '4px' }}>
                {STEPS[currentStep + 1] === 'Objetivo' ? 'Definir objetivo' : STEPS[currentStep + 1]}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--c-text-4)' }}>
                {STEPS[currentStep + 1] === 'Objetivo' && 'Vamos escolher o resultado que você quer alcançar.'}
                {STEPS[currentStep + 1] === 'Público' && 'Defina quem verá seu anúncio.'}
                {STEPS[currentStep + 1] === 'Orçamento' && 'Configure quanto investir por dia.'}
                {STEPS[currentStep + 1] === 'Revisar' && 'Confira todos os detalhes antes de publicar.'}
                {STEPS[currentStep + 1] === 'Publicar' && 'Última etapa antes de ir ao ar!'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
