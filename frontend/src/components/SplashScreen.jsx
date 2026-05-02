import React, { useEffect, useState } from 'react';
import marcaBranca from '../assets/marca-branca.png';
import { playWelcome } from '../utils/sounds';

/* Duração total: HOLD_MS + EXIT_MS ≈ 3 s */
const HOLD_MS = 2400;
const EXIT_MS = 600;

/* Splash dark glassmorphism — fundo profundo + blobs animados + deco-rings + logo branca.
   Independente do tema do app (tela de intro fixa). */
export default function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState('enter');

  useEffect(() => {
    const t0 = setTimeout(() => playWelcome(), 200);
    const t1 = setTimeout(() => setPhase('hold'), 600);
    const t2 = setTimeout(() => setPhase('exit'), HOLD_MS);
    const t3 = setTimeout(() => onDone(), HOLD_MS + EXIT_MS);
    return () => [t0, t1, t2, t3].forEach(clearTimeout);
  }, []);

  return (
    <div style={{
      position:       'fixed',
      inset:          0,
      zIndex:         9999,
      background:     '#06080B',
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      overflow:       'hidden',
      animation:      phase === 'exit' ? `splashOut ${EXIT_MS}ms ease forwards` : 'none',
    }}>

      {/* Keyframes locais (não tocam no index.css) */}
      <style>{`
        @keyframes splashFloatA {
          0%   { transform: translate(0, 0) scale(1); }
          100% { transform: translate(80px, 60px) scale(1.15); }
        }
        @keyframes splashFloatB {
          0%   { transform: translate(0, 0) scale(1); }
          100% { transform: translate(-90px, -60px) scale(1.12); }
        }
        @keyframes splashFloatC {
          0%   { transform: translate(-50%, -50%) scale(1); }
          100% { transform: translate(-30%, -70%) scale(1.2); }
        }
        @keyframes splashSpin {
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes splashStageIn {
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes splashPulseDot {
          0%, 100% { transform: scale(1);   opacity: .55; }
          50%      { transform: scale(1.4); opacity: 1;   }
        }
        @media (prefers-reduced-motion: reduce) {
          .splash-blob, .splash-ring { animation: none !important; }
        }
      `}</style>

      {/* ── Grid sutil de fundo (mascarado por radial) ── */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage:
          'linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px),' +
          'linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at center, rgba(0,0,0,.7), transparent 70%)',
        maskImage:       'radial-gradient(ellipse 80% 70% at center, rgba(0,0,0,.7), transparent 70%)',
        zIndex: 0,
      }} />

      {/* ── Blob 1 (rosa accent — topo esquerda) ── */}
      <div style={{
        position: 'absolute',
        width: '520px', height: '520px',
        borderRadius: '50%',
        background: 'rgba(193,53,132,.6)',
        filter: 'blur(80px)',
        top: '-120px', left: '-100px',
        opacity: 0.6,
        zIndex: 0,
        animation: 'splashFloatA 14s cubic-bezier(.22,1,.36,1) infinite alternate',
      }} />

      {/* ── Blob 2 (vinho profundo — base direita) ── */}
      <div style={{
        position: 'absolute',
        width: '440px', height: '440px',
        borderRadius: '50%',
        background: 'rgba(125,74,94,.6)',
        filter: 'blur(80px)',
        bottom: '-120px', right: '-100px',
        opacity: 0.6,
        zIndex: 0,
        animation: 'splashFloatB 16s cubic-bezier(.22,1,.36,1) infinite alternate',
      }} />

      {/* ── Blob 3 (azul sutil — centro) ── */}
      <div style={{
        position: 'absolute',
        width: '320px', height: '320px',
        borderRadius: '50%',
        background: 'rgba(96,165,250,.3)',
        filter: 'blur(80px)',
        top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        opacity: 0.35,
        zIndex: 0,
        animation: 'splashFloatC 18s cubic-bezier(.22,1,.36,1) infinite alternate',
      }} />

      {/* ── Deco ring externo (720px, branco sutil, contra-rotação) ── */}
      <div style={{
        position: 'absolute',
        width: '720px', height: '720px',
        borderRadius: '50%',
        border: '1px dashed rgba(255,255,255,.05)',
        top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        zIndex: 0,
        animation: 'splashSpin 60s linear infinite reverse',
      }} />

      {/* ── Deco ring interno (540px, rosa accent) ── */}
      <div style={{
        position: 'absolute',
        width: '540px', height: '540px',
        borderRadius: '50%',
        border: '1px dashed rgba(193,53,132,.28)',
        top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        zIndex: 0,
        animation: 'splashSpin 36s linear infinite',
      }} />

      {/* ── Logo + divisor + tagline (stage central) ── */}
      <div style={{
        position:   'relative',
        zIndex:     2,
        display:    'flex',
        alignItems: 'center',
        gap:        '22px',
        maxWidth:   '88vw',
        animation:  'splashStageIn 1s cubic-bezier(.22,1,.36,1) forwards',
        opacity:    0,
        transform:  'translateY(8px)',
      }}>
        {/* Logo wrap com glow rosa atrás */}
        <div style={{
          position:    'relative',
          display:     'grid',
          placeItems:  'center',
          padding:     '8px 14px',
        }}>
          {/* Glow atrás do logo */}
          <div style={{
            position: 'absolute',
            inset: '-16px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(193,53,132,.6) 0%, transparent 70%)',
            filter: 'blur(20px)',
            opacity: 0.65,
            zIndex: -1,
          }} />
          <img
            src={marcaBranca}
            alt="Cris Costa Beauty"
            style={{
              height:    'clamp(46px, 9vw, 70px)',
              width:     'auto',
              maxWidth:  '60vw',
              objectFit: 'contain',
              flexShrink: 1,
              filter:    'drop-shadow(0 6px 24px rgba(193,53,132,.45))',
            }}
          />
        </div>

        {/* Linha gradient accent (substitui traço sólido) */}
        <div style={{
          width:      '1px',
          height:     '50px',
          background: 'linear-gradient(180deg, transparent, #C13584, transparent)',
          boxShadow:  '0 0 8px rgba(193,53,132,.6)',
          flexShrink: 0,
        }} />

        {/* Tagline */}
        <div style={{
          display:       'flex',
          flexDirection: 'column',
          gap:           '4px',
          flexShrink:    0,
        }}>
          <span style={{
            fontSize:      '11px',
            fontWeight:    700,
            letterSpacing: '3px',
            textTransform: 'uppercase',
            color:         '#C13584',
            lineHeight:    1,
            textShadow:    '0 0 14px rgba(193,53,132,.6)',
          }}>Gestor de</span>
          <span style={{
            fontSize:      '11px',
            fontWeight:    700,
            letterSpacing: '3px',
            textTransform: 'uppercase',
            color:         'rgba(255,255,255,.92)',
            lineHeight:    1,
          }}>Tráfego</span>
        </div>
      </div>

      {/* ── Barra de progresso (gradient accent + brilho central) ── */}
      <div style={{
        position:  'absolute',
        bottom:    0, left: 0, right: 0,
        height:    '3px',
        background:'rgba(193,53,132,.12)',
        overflow:  'hidden',
        zIndex:    3,
      }}>
        <div style={{
          height:    '100%',
          background:'linear-gradient(90deg, transparent, #C13584, #fff, #C13584, transparent)',
          boxShadow: '0 0 14px rgba(193,53,132,.6)',
          animation: `splashProgress ${HOLD_MS}ms linear forwards`,
          width:     '0%',
        }} />
      </div>

      {/* ── Pontos pulsantes ── */}
      <div style={{
        position:  'absolute',
        bottom:    '28px',
        left:      '50%',
        transform: 'translateX(-50%)',
        display:   'flex',
        gap:       '7px',
        zIndex:    3,
        opacity:   0,
        animation: 'splashTagIn .4s .9s ease forwards',
      }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width:       '6px',
            height:      '6px',
            borderRadius:'50%',
            background:  '#C13584',
            boxShadow:   '0 0 10px rgba(193,53,132,.6)',
            animation:   `splashPulseDot 1.4s ${i * 0.2}s ease-in-out infinite`,
          }} />
        ))}
      </div>

    </div>
  );
}
