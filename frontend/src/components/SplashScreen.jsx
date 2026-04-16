import React, { useEffect, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import marcaBranca   from '../assets/marca-branca.png';
import marcaColorida from '../assets/marca-colorida.png';

/* Duração total: HOLD_MS + EXIT_MS ≈ 5 s */
const HOLD_MS = 4200;
const EXIT_MS = 700;

export default function SplashScreen({ onDone }) {
  const { isDark } = useTheme();
  const [phase, setPhase] = useState('enter'); // 'enter' | 'hold' | 'exit'

  useEffect(() => {
    /* enter → hold após 600 ms (animação de entrada) */
    const t1 = setTimeout(() => setPhase('hold'), 600);
    /* hold → exit */
    const t2 = setTimeout(() => setPhase('exit'), HOLD_MS);
    /* exit → remove */
    const t3 = setTimeout(() => onDone(), HOLD_MS + EXIT_MS);
    return () => [t1, t2, t3].forEach(clearTimeout);
  }, []);

  const bg   = isDark ? '#0C0C0C' : '#FFFFFF';
  const logo = isDark ? marcaBranca : marcaColorida;

  return (
    <div style={{
      position:       'fixed',
      inset:          0,
      zIndex:         9999,
      background:     bg,
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      animation:      phase === 'exit' ? `splashOut ${EXIT_MS}ms ease forwards` : 'none',
    }}>

      {/* ── Logo ── */}
      <div style={{
        animation: 'splashLogoIn .7s cubic-bezier(.22,1,.36,1) forwards',
        opacity: 0,
      }}>
        <img
          src={logo}
          alt="Cris Costa Beauty"
          style={{ height: '90px', width: 'auto', objectFit: 'contain' }}
        />
      </div>

      {/* ── Tagline ── */}
      <div style={{
        marginTop:    '18px',
        fontSize:     '11px',
        fontWeight:   700,
        letterSpacing:'4px',
        textTransform:'uppercase',
        color:        'var(--c-text-4)',
        animation:    'splashTagIn .6s .5s ease forwards',
        opacity:      0,
      }}>
        Gestor de Tráfego
      </div>

      {/* ── Barra de progresso ── */}
      <div style={{
        position:     'absolute',
        bottom:       0, left: 0,
        width:        '100%',
        height:       '3px',
        background:   isDark ? '#222' : '#F3E6F0',
        overflow:     'hidden',
      }}>
        <div style={{
          height:     '100%',
          background: 'var(--c-accent)',
          animation:  `splashProgress ${HOLD_MS}ms linear forwards`,
          width:      '0%',
        }} />
      </div>

      {/* ── Ponto pulsante ── */}
      <div style={{
        position:   'absolute',
        bottom:     '24px',
        display:    'flex',
        gap:        '6px',
        animation:  'splashTagIn .4s .8s ease forwards',
        opacity:    0,
      }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width:      '6px',
            height:     '6px',
            borderRadius:'50%',
            background: 'var(--c-accent)',
            animation:  `pulse 1.2s ${i * 0.2}s ease-in-out infinite`,
          }} />
        ))}
      </div>

    </div>
  );
}
