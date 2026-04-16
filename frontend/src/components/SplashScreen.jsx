import React, { useEffect, useState } from 'react';
import marcaColorida from '../assets/marca-colorida.png';

/* Duração total: HOLD_MS + EXIT_MS ≈ 3 s */
const HOLD_MS = 2400;
const EXIT_MS = 600;

/* Splash sempre com fundo rosê claro + marca colorida, independente do tema */
export default function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState('enter');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 600);
    const t2 = setTimeout(() => setPhase('exit'), HOLD_MS);
    const t3 = setTimeout(() => onDone(), HOLD_MS + EXIT_MS);
    return () => [t1, t2, t3].forEach(clearTimeout);
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
        width:        '340px',
        height:       '340px',
        borderRadius: '50%',
        background:   'radial-gradient(circle, rgba(193,53,132,.07) 0%, rgba(193,53,132,0) 70%)',
        animation:    'splashLogoIn .9s cubic-bezier(.22,1,.36,1) forwards',
        opacity:      0,
      }} />

      {/* ── Logo + divisor + tagline ── */}
      <div style={{
        display:    'flex',
        alignItems: 'center',
        gap:        '24px',
        animation:  'splashLogoIn .7s cubic-bezier(.22,1,.36,1) forwards',
        opacity:    0,
      }}>
        {/* Logo */}
        <img
          src={marcaColorida}
          alt="Cris Costa Beauty"
          style={{ height: '100px', width: 'auto', objectFit: 'contain' }}
        />

        {/* Traço vertical */}
        <div style={{
          width:      '1px',
          height:     '56px',
          background: '#d68d8f',
          flexShrink: 0,
        }} />

        {/* Texto */}
        <div style={{
          display:       'flex',
          flexDirection: 'column',
          gap:           '3px',
        }}>
          <span style={{
            fontSize:      '11px',
            fontWeight:    700,
            letterSpacing: '4px',
            textTransform: 'uppercase',
            color:         '#d68d8f',
            lineHeight:    1,
          }}>Gestor de</span>
          <span style={{
            fontSize:      '11px',
            fontWeight:    700,
            letterSpacing: '4px',
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
        background:'rgba(193,53,132,.12)',
        overflow:  'hidden',
      }}>
        <div style={{
          height:    '100%',
          background:'linear-gradient(90deg, #E8A4C8, #d68d8f)',
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
