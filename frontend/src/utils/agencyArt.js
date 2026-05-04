/**
 * Agência 2D — arte pixel-art Game Boy DMG.
 *
 * Paleta DMG clássica (4 cores), resolução nativa 320x180.
 * Renderização: drawScene() desenha o cenário estático em offscreen canvas
 * uma única vez. drawAgent() pinta sprite 14x18 por agente sobre o cenário.
 * Tudo em fillRect — zero asset externo.
 */

export const PALETTE = {
  /* 4 verdes do Game Boy DMG. Index 0 = mais escuro, 3 = mais claro. */
  0: '#0f380f',
  1: '#306230',
  2: '#8bac0f',
  3: '#9bbc0f',
};
export const PX = (i) => PALETTE[i];

export const NATIVE_W = 320;
export const NATIVE_H = 180;

/* Posições fixas de cada agente na cena. y é o topo da mesa; o sprite
   senta na cadeira atrás. x é o canto esquerdo do sprite. */
export const AGENT_LAYOUT = {
  'Claude Code':     { x: 148, y: 110, label: 'CLAUDE',  hat: 'crown' },
  Opus:              { x:  44, y:  68, label: 'OPUS',    hat: 'tall'  },
  Sonnet:            { x: 220, y: 110, label: 'SONNET',  hat: 'bob'   },
  Haiku:             { x:  88, y: 110, label: 'HAIKU',   hat: 'short' },
  'general-purpose': { x: 220, y:  68, label: 'GP',      hat: 'cap'   },
  Explore:           { x: 132, y:  68, label: 'EXPL',    hat: 'lens'  },
  Plan:              { x:  44, y: 110, label: 'PLAN',    hat: 'tie'   },
  test:              { x: 264, y: 110, label: 'TEST',    hat: 'beanie'},
};

/* Aliases de agente — eventos vêm com nomes variáveis do hook. */
export function resolveAgent(name) {
  if (!name) return 'Claude Code';
  if (AGENT_LAYOUT[name]) return name;
  const lower = String(name).toLowerCase();
  if (lower.includes('opus')) return 'Opus';
  if (lower.includes('sonnet')) return 'Sonnet';
  if (lower.includes('haiku')) return 'Haiku';
  if (lower.includes('plan')) return 'Plan';
  if (lower.includes('explor')) return 'Explore';
  if (lower.includes('test')) return 'test';
  if (lower.includes('general') || lower === 'subagent') return 'general-purpose';
  return 'Claude Code';
}

/* ─────────────────────────────────────────────────────────────────────
   CENÁRIO ESTÁTICO
   Chama drawScene(ctx) em offscreen canvas no mount. Depois drawImage.
   ───────────────────────────────────────────────────────────────────── */
export function drawScene(ctx) {
  /* Limpa */
  ctx.fillStyle = PX(3);
  ctx.fillRect(0, 0, NATIVE_W, NATIVE_H);

  /* Janela / céu — faixa superior 0-32 */
  ctx.fillStyle = PX(2);
  ctx.fillRect(0, 0, NATIVE_W, 32);

  /* Sol pixelado */
  drawCircle(ctx, 282, 16, 8, 3);
  drawCircle(ctx, 282, 16, 5, 2);

  /* Nuvens */
  drawCloud(ctx, 40, 12);
  drawCloud(ctx, 130, 8);
  drawCloud(ctx, 200, 14);

  /* Parede — 32-100 */
  ctx.fillStyle = PX(2);
  ctx.fillRect(0, 32, NATIVE_W, 68);

  /* Rodapé entre parede e chão */
  ctx.fillStyle = PX(0);
  ctx.fillRect(0, 99, NATIVE_W, 2);

  /* Quadro de cortiça com avisos */
  ctx.fillStyle = PX(1);
  ctx.fillRect(20, 38, 36, 24);
  ctx.fillStyle = PX(0);
  ctx.fillRect(19, 37, 38, 1);
  ctx.fillRect(19, 62, 38, 1);
  ctx.fillRect(19, 37, 1, 26);
  ctx.fillRect(56, 37, 1, 26);
  /* Notas no quadro */
  ctx.fillStyle = PX(3);
  ctx.fillRect(24, 42, 8, 6);
  ctx.fillRect(36, 44, 7, 5);
  ctx.fillRect(46, 41, 6, 7);
  ctx.fillRect(28, 52, 9, 6);
  ctx.fillRect(40, 53, 8, 6);

  /* Relógio centralizado na parede */
  drawCircle(ctx, 160, 50, 10, 3);
  drawCircle(ctx, 160, 50, 9, 2);
  drawCircle(ctx, 160, 50, 8, 3);
  ctx.fillStyle = PX(0);
  ctx.fillRect(160, 44, 1, 7);  /* ponteiro hora */
  ctx.fillRect(160, 50, 6, 1);  /* ponteiro min  */
  ctx.fillRect(159, 49, 3, 3);  /* miolo (placeholder pra cobrir 1px) */

  /* Estante de livros */
  ctx.fillStyle = PX(1);
  ctx.fillRect(252, 40, 40, 24);
  ctx.fillStyle = PX(0);
  ctx.fillRect(251, 39, 42, 1);
  ctx.fillRect(251, 64, 42, 1);
  ctx.fillRect(251, 39, 1, 26);
  ctx.fillRect(292, 39, 1, 26);
  ctx.fillRect(251, 51, 42, 1);
  /* Lombadas */
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? PX(2) : PX(3);
    ctx.fillRect(254 + i * 5, 41, 4, 9);
  }
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? PX(3) : PX(2);
    ctx.fillRect(254 + i * 5, 53, 4, 10);
  }

  /* Planta no canto direito da parede */
  ctx.fillStyle = PX(1);
  ctx.fillRect(214, 70, 8, 8);
  ctx.fillStyle = PX(0);
  ctx.fillRect(213, 69, 10, 1);
  ctx.fillRect(213, 78, 10, 1);
  ctx.fillRect(213, 69, 1, 9);
  ctx.fillRect(222, 69, 1, 9);
  /* folhas */
  ctx.fillStyle = PX(0);
  ctx.fillRect(216, 60, 2, 10);
  ctx.fillRect(214, 64, 10, 2);
  ctx.fillRect(212, 66, 2, 4);
  ctx.fillRect(222, 66, 2, 4);

  /* Chão — 100-180 */
  ctx.fillStyle = PX(1);
  ctx.fillRect(0, 100, NATIVE_W, 80);
  /* Linhas de tábua */
  ctx.fillStyle = PX(0);
  for (let y = 120; y < 180; y += 18) {
    ctx.fillRect(0, y, NATIVE_W, 1);
  }
  for (let x = 30; x < NATIVE_W; x += 60) {
    ctx.fillRect(x, 100, 1, 80);
  }

  /* Fileira de trás — 4 estações (y mesa = 88) */
  for (const x of [30, 118, 162, 206]) {
    drawDeskBack(ctx, x, 88);
  }

  /* Fileira da frente — 4 estações (y mesa = 130) */
  for (const x of [30, 74, 162, 250]) {
    drawDeskFront(ctx, x, 130);
  }

  /* Mesa central destaque (Claude Code) — overlay */
  drawDeskFrontBig(ctx, 134, 128);

  /* Café / geladeira no canto esquerdo do chão */
  drawCoffee(ctx, 4, 140);
}

function drawCircle(ctx, cx, cy, r, color) {
  ctx.fillStyle = PX(color);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy <= r * r) ctx.fillRect(cx + dx, cy + dy, 1, 1);
    }
  }
}

function drawCloud(ctx, x, y) {
  ctx.fillStyle = PX(3);
  ctx.fillRect(x, y, 14, 4);
  ctx.fillRect(x + 2, y - 2, 10, 6);
  ctx.fillRect(x + 4, y - 3, 6, 8);
}

/* Mesa de trás — apenas frente da mesa visível */
function drawDeskBack(ctx, x, y) {
  /* Tampo */
  ctx.fillStyle = PX(0);
  ctx.fillRect(x, y, 28, 8);
  ctx.fillStyle = PX(1);
  ctx.fillRect(x + 1, y + 1, 26, 5);
  /* Monitor */
  ctx.fillStyle = PX(0);
  ctx.fillRect(x + 9, y - 12, 12, 12);
  ctx.fillStyle = PX(2);
  ctx.fillRect(x + 10, y - 11, 10, 10);
  /* Base monitor */
  ctx.fillStyle = PX(0);
  ctx.fillRect(x + 13, y - 1, 4, 2);
}

/* Mesa da frente — perspectiva mais ampla */
function drawDeskFront(ctx, x, y) {
  /* Tampo */
  ctx.fillStyle = PX(0);
  ctx.fillRect(x, y, 36, 12);
  ctx.fillStyle = PX(1);
  ctx.fillRect(x + 1, y + 1, 34, 9);
  /* Pernas */
  ctx.fillRect(x + 1, y + 12, 2, 14);
  ctx.fillRect(x + 33, y + 12, 2, 14);
  /* Monitor */
  ctx.fillStyle = PX(0);
  ctx.fillRect(x + 11, y - 18, 16, 18);
  ctx.fillStyle = PX(2);
  ctx.fillRect(x + 12, y - 17, 14, 14);
  /* Base */
  ctx.fillStyle = PX(0);
  ctx.fillRect(x + 16, y - 3, 6, 4);
  /* Teclado */
  ctx.fillRect(x + 6, y + 1, 10, 2);
}

/* Mesa central maior */
function drawDeskFrontBig(ctx, x, y) {
  ctx.fillStyle = PX(0);
  ctx.fillRect(x, y, 52, 14);
  ctx.fillStyle = PX(1);
  ctx.fillRect(x + 1, y + 1, 50, 11);
  /* Pernas */
  ctx.fillRect(x + 1, y + 14, 2, 14);
  ctx.fillRect(x + 49, y + 14, 2, 14);
  /* Dois monitores */
  ctx.fillStyle = PX(0);
  ctx.fillRect(x + 4, y - 22, 18, 22);
  ctx.fillRect(x + 30, y - 22, 18, 22);
  ctx.fillStyle = PX(2);
  ctx.fillRect(x + 5, y - 21, 16, 18);
  ctx.fillRect(x + 31, y - 21, 16, 18);
  /* Bases */
  ctx.fillStyle = PX(0);
  ctx.fillRect(x + 10, y - 3, 6, 4);
  ctx.fillRect(x + 36, y - 3, 6, 4);
  /* Teclado */
  ctx.fillRect(x + 18, y + 1, 16, 2);
}

/* Máquina de café */
function drawCoffee(ctx, x, y) {
  /* Corpo */
  ctx.fillStyle = PX(0);
  ctx.fillRect(x, y, 22, 30);
  ctx.fillStyle = PX(1);
  ctx.fillRect(x + 1, y + 1, 20, 28);
  /* Display */
  ctx.fillStyle = PX(2);
  ctx.fillRect(x + 4, y + 4, 14, 4);
  /* Bico */
  ctx.fillStyle = PX(0);
  ctx.fillRect(x + 8, y + 14, 6, 2);
  ctx.fillRect(x + 9, y + 16, 4, 4);
  /* Xícara */
  ctx.fillStyle = PX(3);
  ctx.fillRect(x + 8, y + 21, 6, 4);
  ctx.fillStyle = PX(0);
  ctx.fillRect(x + 7, y + 21, 1, 5);
  ctx.fillRect(x + 14, y + 21, 1, 5);
  ctx.fillRect(x + 7, y + 25, 8, 1);
}

/* ─────────────────────────────────────────────────────────────────────
   SPRITES DE AGENTE
   Sprite base 14x18. 4 frames: idle, idle2 (blink), work, alert.
   Cor do "chapéu" e altura variam por agente pra dar identidade.
   ───────────────────────────────────────────────────────────────────── */
export function drawAgent(ctx, agentName, frame, isActive) {
  const layout = AGENT_LAYOUT[agentName];
  if (!layout) return;
  const { x, y, hat } = layout;

  /* Cadeira atrás do personagem (fileira de trás → cadeira mais simples) */
  const isBack = y < 100;
  if (isBack) {
    drawChairBack(ctx, x, y - 10);
  } else {
    drawChairFront(ctx, x, y - 8);
  }

  /* Personagem */
  drawCharacter(ctx, x + 1, y - 26, hat, frame, isActive);

  /* Label embaixo (texto pixel 4x5 char) */
  drawLabel(ctx, x - 2, y + 16, layout.label, isActive);

  /* Indicador de ativo: balão de fala pixelado */
  if (isActive) {
    drawSpeechBubble(ctx, x + 12, y - 36, frame);
  }
}

function drawChairBack(ctx, x, y) {
  ctx.fillStyle = PX(0);
  ctx.fillRect(x + 4, y, 16, 4);
  ctx.fillRect(x + 4, y + 14, 2, 8);
  ctx.fillRect(x + 18, y + 14, 2, 8);
}

function drawChairFront(ctx, x, y) {
  /* Encosto */
  ctx.fillStyle = PX(0);
  ctx.fillRect(x + 6, y + 2, 14, 8);
  ctx.fillStyle = PX(1);
  ctx.fillRect(x + 7, y + 3, 12, 6);
  /* Assento (sob personagem) */
  ctx.fillStyle = PX(0);
  ctx.fillRect(x + 4, y + 18, 18, 4);
  /* Pernas */
  ctx.fillRect(x + 5, y + 22, 2, 6);
  ctx.fillRect(x + 19, y + 22, 2, 6);
}

/* Personagem 14x18 */
function drawCharacter(ctx, x, y, hat, frame, isActive) {
  const blink = frame === 1 && Math.random() > 0.85;
  const headColor = isActive ? PX(0) : PX(0);
  const skinColor = PX(2);
  const shirtColor = isActive ? PX(0) : PX(1);

  /* Cabeça 8x8 */
  ctx.fillStyle = headColor;
  ctx.fillRect(x + 3, y, 8, 8);
  ctx.fillStyle = skinColor;
  ctx.fillRect(x + 4, y + 1, 6, 6);
  /* Olhos */
  ctx.fillStyle = headColor;
  if (blink) {
    ctx.fillRect(x + 5, y + 4, 1, 1);
    ctx.fillRect(x + 8, y + 4, 1, 1);
  } else {
    ctx.fillRect(x + 5, y + 3, 1, 2);
    ctx.fillRect(x + 8, y + 3, 1, 2);
  }
  /* Boca: muda com active/work */
  if (isActive && frame === 2) {
    ctx.fillRect(x + 6, y + 6, 2, 1);
  } else {
    ctx.fillRect(x + 6, y + 6, 2, 1);
  }

  /* Acessório no topo (hat / cabelo) */
  drawHat(ctx, x, y, hat);

  /* Corpo 8x8 */
  ctx.fillStyle = shirtColor;
  ctx.fillRect(x + 2, y + 8, 10, 7);
  /* Pescoço */
  ctx.fillStyle = skinColor;
  ctx.fillRect(x + 6, y + 7, 2, 1);

  /* Braços animados — frame 2 = digitando (braço pra frente) */
  ctx.fillStyle = shirtColor;
  if (frame === 2 || (isActive && frame === 0)) {
    /* Digitando */
    ctx.fillRect(x + 1, y + 9, 2, 4);
    ctx.fillRect(x + 11, y + 9, 2, 4);
    ctx.fillStyle = skinColor;
    ctx.fillRect(x + 1, y + 13, 2, 1);
    ctx.fillRect(x + 11, y + 13, 2, 1);
  } else {
    /* Idle, braços ao lado */
    ctx.fillRect(x + 1, y + 9, 1, 5);
    ctx.fillRect(x + 12, y + 9, 1, 5);
  }
}

function drawHat(ctx, x, y, hat) {
  ctx.fillStyle = PX(0);
  switch (hat) {
    case 'crown':
      /* Coroa de chefe */
      ctx.fillRect(x + 3, y - 2, 8, 2);
      ctx.fillRect(x + 3, y - 4, 1, 2);
      ctx.fillRect(x + 6, y - 4, 2, 2);
      ctx.fillRect(x + 10, y - 4, 1, 2);
      break;
    case 'tall':
      /* Cartola Opus */
      ctx.fillRect(x + 3, y - 1, 8, 1);
      ctx.fillRect(x + 4, y - 6, 6, 5);
      break;
    case 'bob':
      /* Cabelo bob */
      ctx.fillRect(x + 2, y - 1, 10, 2);
      ctx.fillRect(x + 2, y, 2, 4);
      ctx.fillRect(x + 10, y, 2, 4);
      break;
    case 'short':
      /* Cabelo curto */
      ctx.fillRect(x + 3, y - 1, 8, 1);
      break;
    case 'cap':
      /* Boné */
      ctx.fillRect(x + 3, y - 2, 8, 2);
      ctx.fillRect(x + 1, y, 4, 1);
      break;
    case 'lens':
      /* Lupa Explore */
      ctx.fillRect(x + 3, y - 1, 8, 1);
      /* Lupa flutuante */
      ctx.fillStyle = PX(0);
      ctx.fillRect(x + 11, y + 2, 4, 4);
      ctx.fillStyle = PX(2);
      ctx.fillRect(x + 12, y + 3, 2, 2);
      ctx.fillStyle = PX(0);
      ctx.fillRect(x + 14, y + 6, 2, 2);
      break;
    case 'tie':
      /* Cabelo + gravata Plan (gravata desenhada com corpo, aqui só cabelo) */
      ctx.fillRect(x + 3, y - 2, 8, 2);
      ctx.fillRect(x + 4, y, 6, 1);
      break;
    case 'beanie':
      /* Gorro estagiário */
      ctx.fillRect(x + 3, y - 3, 8, 3);
      ctx.fillStyle = PX(3);
      ctx.fillRect(x + 6, y - 4, 2, 1);
      break;
  }
}

/* Texto label minúsculo — fonte pixel 3x5 */
const FONT_3x5 = {
  A: ['010','101','111','101','101'],
  B: ['110','101','110','101','110'],
  C: ['011','100','100','100','011'],
  D: ['110','101','101','101','110'],
  E: ['111','100','110','100','111'],
  F: ['111','100','110','100','100'],
  G: ['011','100','101','101','011'],
  H: ['101','101','111','101','101'],
  I: ['111','010','010','010','111'],
  J: ['001','001','001','101','010'],
  K: ['101','110','100','110','101'],
  L: ['100','100','100','100','111'],
  M: ['101','111','111','101','101'],
  N: ['101','111','111','111','101'],
  O: ['010','101','101','101','010'],
  P: ['110','101','110','100','100'],
  Q: ['010','101','101','111','011'],
  R: ['110','101','110','110','101'],
  S: ['011','100','010','001','110'],
  T: ['111','010','010','010','010'],
  U: ['101','101','101','101','111'],
  V: ['101','101','101','010','010'],
  W: ['101','101','111','111','101'],
  X: ['101','101','010','101','101'],
  Y: ['101','101','010','010','010'],
  Z: ['111','001','010','100','111'],
  ' ': ['000','000','000','000','000'],
};

function drawLabel(ctx, x, y, text, isActive) {
  ctx.fillStyle = isActive ? PX(0) : PX(0);
  let cx = x;
  for (const ch of String(text).toUpperCase()) {
    const glyph = FONT_3x5[ch] || FONT_3x5[' '];
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 3; col++) {
        if (glyph[row][col] === '1') ctx.fillRect(cx + col, y + row, 1, 1);
      }
    }
    cx += 4;
  }
}

function drawSpeechBubble(ctx, x, y, frame) {
  ctx.fillStyle = PX(0);
  ctx.fillRect(x, y, 12, 9);
  ctx.fillStyle = PX(3);
  ctx.fillRect(x + 1, y + 1, 10, 7);
  /* Cauda */
  ctx.fillStyle = PX(0);
  ctx.fillRect(x + 2, y + 9, 2, 1);
  ctx.fillRect(x + 3, y + 10, 1, 1);
  /* Conteúdo: ponto piscando */
  ctx.fillStyle = PX(0);
  if (frame === 0 || frame === 2) {
    ctx.fillRect(x + 3, y + 4, 1, 1);
    ctx.fillRect(x + 6, y + 4, 1, 1);
    ctx.fillRect(x + 9, y + 4, 1, 1);
  } else {
    ctx.fillRect(x + 5, y + 4, 2, 1);
  }
}

/* ─────────────────────────────────────────────────────────────────────
   Ícone de ferramenta no balão (opcional, futuro)
   ───────────────────────────────────────────────────────────────────── */
export const TOOL_GLYPH = {
  Bash: 'cmd',
  Read: 'eye',
  Edit: 'pen',
  Write: 'plus',
  MultiEdit: 'pen',
  Grep: 'mag',
  Glob: 'mag',
  WebFetch: 'globe',
  WebSearch: 'globe',
  Task: 'bot',
  Agent: 'bot',
  Skill: 'gear',
};
