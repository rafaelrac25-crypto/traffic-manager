import React, { useEffect, useRef } from 'react';
import {
  NATIVE_W, NATIVE_H, PX,
  AGENT_LAYOUT, drawScene, drawAgent, resolveAgent,
} from '../utils/agencyArt';

/**
 * Cena Game Boy DMG always-visible da Agência 2D.
 *
 * - Recebe `events` (array do polling do Agency.jsx).
 * - Cada agente tem estado interno: lastEventTs, activeUntil, animFrame.
 * - Quando entra evento novo de um agente → agente "acende" 4s (balão + braços
 *   digitando + brilho).
 * - Idle ambient: animação contínua de blink/respirar mesmo sem eventos.
 * - Render: 60fps via requestAnimationFrame em offscreen canvas 320x180,
 *   depois drawImage escalado pra canvas visível com pixelated rendering.
 */

const ACTIVE_MS = 4000;
const FRAME_MS = 250; /* 4fps de animação dos sprites — visual retrô */

export default function AgencyScene({ events = [] }) {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);     /* offscreen canvas com cenário estático */
  const stateRef = useRef({});       /* { agent: { lastEventTs, activeUntil, lastTool } } */
  const lastSeenIdRef = useRef(new Set());
  const rafRef = useRef(0);
  const animFrameRef = useRef(0);
  const animTickRef = useRef(0);

  /* Inicializa offscreen canvas com cenário (uma vez). */
  useEffect(() => {
    const off = document.createElement('canvas');
    off.width = NATIVE_W;
    off.height = NATIVE_H;
    const ctx = off.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    drawScene(ctx);
    sceneRef.current = off;
  }, []);

  /* Detecta eventos novos e ativa o agente correspondente. */
  useEffect(() => {
    if (!events || events.length === 0) return;
    const now = Date.now();
    for (const ev of events) {
      if (lastSeenIdRef.current.has(ev.id)) continue;
      lastSeenIdRef.current.add(ev.id);
      const agent = resolveAgent(ev.agent);
      const cur = stateRef.current[agent] || {};
      stateRef.current[agent] = {
        ...cur,
        lastEventTs: ev.ts || now,
        activeUntil: now + ACTIVE_MS,
        lastTool: ev.tool,
      };
    }
    /* Cap do Set pra não crescer infinito (mantém últimos 200 IDs). */
    if (lastSeenIdRef.current.size > 200) {
      const arr = Array.from(lastSeenIdRef.current);
      lastSeenIdRef.current = new Set(arr.slice(-150));
    }
  }, [events]);

  /* Loop de render. */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    /* Ajusta tamanho real do canvas baseado no width disponível,
       mantendo proporção 16:9 do native 320x180. */
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = Math.min(parent.clientWidth, 1280);
      const scale = Math.max(3, Math.floor(w / NATIVE_W));
      canvas.width = NATIVE_W * scale;
      canvas.height = NATIVE_H * scale;
      canvas.style.width = `${NATIVE_W * scale}px`;
      canvas.style.height = `${NATIVE_H * scale}px`;
      const cctx = canvas.getContext('2d');
      cctx.imageSmoothingEnabled = false;
    };
    resize();
    window.addEventListener('resize', resize);

    const loop = (ts) => {
      /* Avança frame de animação a cada FRAME_MS */
      if (ts - animTickRef.current > FRAME_MS) {
        animFrameRef.current = (animFrameRef.current + 1) % 4;
        animTickRef.current = ts;
      }

      /* Render no offscreen "frame" canvas em resolução nativa,
         depois copia escalado pro canvas visível. */
      const cctx = canvas.getContext('2d');
      const scaleX = canvas.width / NATIVE_W;

      /* 1. Cenário estático */
      if (sceneRef.current) {
        cctx.imageSmoothingEnabled = false;
        cctx.drawImage(
          sceneRef.current,
          0, 0, NATIVE_W, NATIVE_H,
          0, 0, canvas.width, canvas.height,
        );
      } else {
        cctx.fillStyle = PX(3);
        cctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      /* 2. Agentes — desenhar em offscreen "frame" 320x180, depois escalar.
         Mais barato que fazer fillRect já em escala alta. */
      const frame = document.createElement('canvas');
      frame.width = NATIVE_W;
      frame.height = NATIVE_H;
      const fctx = frame.getContext('2d');
      fctx.imageSmoothingEnabled = false;

      const now = Date.now();
      const animFrame = animFrameRef.current;

      for (const agent of Object.keys(AGENT_LAYOUT)) {
        const st = stateRef.current[agent] || {};
        const isActive = (st.activeUntil || 0) > now;
        /* Frame especial: alterna idle (0/1) e working (2/3) */
        let f = animFrame;
        if (isActive) f = animFrame % 2 === 0 ? 2 : 0;
        drawAgent(fctx, agent, f, isActive, st.lastTool);
      }

      cctx.drawImage(
        frame,
        0, 0, NATIVE_W, NATIVE_H,
        0, 0, canvas.width, canvas.height,
      );

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div style={{
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
      background: 'var(--c-card-bg)',
      border: '1px solid var(--c-border-lt)',
      borderRadius: '12px',
      padding: '12px',
      marginBottom: '16px',
    }}>
      <canvas
        ref={canvasRef}
        style={{
          imageRendering: 'pixelated',
          maxWidth: '100%',
          display: 'block',
          background: PX(3),
          borderRadius: '4px',
        }}
      />
    </div>
  );
}
