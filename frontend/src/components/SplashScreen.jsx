import React, { useEffect, useState } from 'react';
import marcaColorida from '../assets/marca-colorida.png';
import { playWelcome } from '../utils/sounds';

/* Duração total: HOLD_MS + EXIT_MS ≈ 3 s */
const HOLD_MS = 2400;
const EXIT_MS = 600;

/* Splash sempre com fundo rosê claro + marca colorida, independente do tema */
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
      background:     '#FDF0F8',
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      animation:      phase === 'exit' ? `splashOut ${EXIT_MS}ms ease forwards` : 'none',
    }}>

      {/* ── Círculo decorativo atrás da logo ── */}
      <div style={{
        position:     'absolute',
        width:        'min(240px, 70vw)',
        height:       'min(240px, 70vw)',
        borderRadius: '50%',
        background:   'radial-gradient(circle, rgba(214,141,143,.1) 0%, rgba(214,141,143,0) 70%)',
        animation:    'splashLogoIn .9s cubic-bezier(.22,1,.36,1) forwards',
        opacity:      0,
      }} />

      {/* ── Logo + divisor + tagline ── */}
      <div style={{
        display:    'flex',
        alignItems: 'center',
        gap:        '18px',
        maxWidth:   '88vw',
        animation:  'splashLogoIn .7s cubic-bezier(.22,1,.36,1) forwards',
        opacity:    0,
      }}>
        {/* Logo */}
        <img
          src={marcaColorida}
          alt="Cris Costa Beauty"
          style={{
            height:    'clamp(56px, 14vw, 72px)',
            width:     'auto',
            maxWidth:  '60vw',
            objectFit: 'contain',
            flexShrink: 1,
          }}
        />

        {/* Traço vertical */}
        <div style={{
          width:      '1px',
          height:     '42px',
          background: '#d68d8f',
          flexShrink: 0,
        }} />

        {/* Texto */}
        <div style={{
          display:       'flex',
          flexDirection: 'column',
          gap:           '3px',
          flexShrink:    0,
        }}>
          <span style={{
            fontSize:      '10px',
            fontWeight:    700,
            letterSpacing: '3px',
            textTransform: 'uppercase',
            color:         '#d68d8f',
            lineHeight:    1,
          }}>Gestor de</span>
          <span style={{
            fontSize:      '10px',
            fontWeight:    700,
            letterSpacing: '3px',
            textTransform: 'uppercase',
            color:         '#d68d8f',
            lineHeight:    1,
          }}>Tráfego</span>
        </div>
      </div>

      {/* ── Barra de progresso ── */}
      <div style={{
        position:  'absolute',
        bottom:    0, left: 0,
        width:     '100%',
        height:    '3px',
        background:'rgba(214,141,143,.15)',
        overflow:  'hidden',
      }}>
        <div style={{
          height:    '100%',
          background:'#d68d8f',
          animation: `splashProgress ${HOLD_MS}ms linear forwards`,
          width:     '0%',
        }} />
      </div>

      {/* ── Pontos pulsantes ── */}
      <div style={{
        position:  'absolute',
        bottom:    '24px',
        display:   'flex',
        gap:       '6px',
        opacity:   0,
        animation: 'splashTagIn .4s .8s ease forwards',
      }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width:       '6px',
            height:      '6px',
            borderRadius:'50%',
            background:  '#d68d8f',
            opacity:     0.5,
            animation:   `pulse 1.2s ${i * 0.2}s ease-in-out infinite`,
          }} />
        ))}
      </div>

    </div>
  );
}
