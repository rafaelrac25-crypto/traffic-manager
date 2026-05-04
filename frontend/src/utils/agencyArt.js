/**
 * Agência 2D — arte pixel-art retrô colorida (estilo Game Boy Color).
 *
 * Paleta de 16 cores customizada com rosé Cris Costa (#C13584) como
 * acento de marca. Cada agente tem cor de camisa única pra ser identificado
 * de longe. Resolução nativa 320x180.
 *
 * Renderização: drawScene() desenha o cenário estático em offscreen canvas
 * uma única vez. drawAgent() pinta sprite ~14x18 sobre o cenário.
 */

export const C = {
  /* Céu / janela */
  sky:        '#A8D8FF',
  cloud:      '#FFFFFF',
  sun:        '#FFE066',
  sunCore:    '#F59E0B',

  /* Parede rosé (combina com marca) */
  wall:       '#F4D9E2',
  wallDark:   '#D9A8B8',
  baseboard:  '#7D4A5E',

  /* Madeira */
  floor:      '#8B6F47',
  floorDark:  '#5D4A30',
  desk:       '#A0826D',
  deskDark:   '#6B5440',

  /* Tech */
  monitor:    '#1E1B2E',
  monitorEdge:'#0A0814',
  screen:     '#7DD3FC',
  screenAlt:  '#86EFAC',

  /* Plantas / vaso */
  leaf:       '#4ADE80',
  leafDark:   '#15803D',
  pot:        '#B45309',
  potDark:    '#78350F',

  /* Pessoas */
  skin:       '#FECACA',
  skinDark:   '#FCA5A5',
  hairBrown:  '#3F2917',
  hairBlonde: '#F59E0B',
  hairBlack:  '#1F1B2E',
  hairRed:    '#B91C1C',

  /* Marca */
  rose:       '#C13584',
  roseLt:     '#F472B6',
  roseDk:     '#7D4A5E',

  /* Café */
  coffeeBody: '#525252',
  coffeeDark: '#1F2937',
  coffeeDisp: '#06B6D4',
  cup:        '#FFFFFF',
  cupRim:     '#7D4A5E',

  /* Estante */
  shelf:      '#92400E',
  shelfDark:  '#451A03',
  book1:      '#DC2626',
  book2:      '#2563EB',
  book3:      '#16A34A',
  book4:      '#CA8A04',
  book5:      '#7C3AED',

  /* Quadro */
  cork:       '#A16207',
  corkDark:   '#451A03',
  noteYellow: '#FEF08A',
  notePink:   '#FBCFE8',
  noteBlue:   '#BFDBFE',
  noteGreen:  '#BBF7D0',

  /* Relógio */
  clockFace:  '#FFFFFF',
  clockEdge:  '#0A0814',

  /* Outline / sombra */
  outline:    '#1E1B2E',
  shadow:     '#00000033',
  white:      '#FFFFFF',
  bubbleBg:   '#FFFFFF',
};

export const NATIVE_W = 320;
export const NATIVE_H = 180;

/* Cor de camisa por agente — diferencia personagens com paleta colorida. */
export const AGENT_COLORS = {
  'Claude Code':     { shirt: C.rose,        pants: C.roseDk,    hair: C.hairBrown,  hatColor: C.sunCore },
  Opus:              { shirt: '#7C3AED',     pants: '#3B0764',   hair: C.hairBlack,  hatColor: C.outline },
  Sonnet:            { shirt: '#3B82F6',     pants: '#1E3A8A',   hair: C.hairBlonde, hatColor: C.hairBlonde },
  Haiku:             { shirt: '#10B981',     pants: '#064E3B',   hair: C.hairBrown,  hatColor: C.hairBrown },
  'general-purpose': { shirt: '#F59E0B',     pants: '#7C2D12',   hair: C.hairRed,    hatColor: '#DC2626' },
  Explore:           { shirt: '#06B6D4',     pants: '#155E75',   hair: C.hairBrown,  hatColor: C.outline },
  Plan:              { shirt: '#EC4899',     pants: '#831843',   hair: C.hairBlack,  hatColor: C.outline },
  test:              { shirt: '#94A3B8',     pants: '#334155',   hair: C.hairBrown,  hatColor: '#DC2626' },
};

/* Posições fixas. y é o topo da mesa; sprite senta na cadeira atrás. */
export const AGENT_LAYOUT = {
  'Claude Code':     { x: 148, y: 110, label: 'CLAUDE',  hat: 'crown'  },
  Opus:              { x:  44, y:  68, label: 'OPUS',    hat: 'tall'   },
  Sonnet:            { x: 220, y: 110, label: 'SONNET',  hat: 'bob'    },
  Haiku:             { x:  88, y: 110, label: 'HAIKU',   hat: 'short'  },
  'general-purpose': { x: 220, y:  68, label: 'GP',      hat: 'cap'    },
  Explore:           { x: 132, y:  68, label: 'EXPL',    hat: 'lens'   },
  Plan:              { x:  44, y: 110, label: 'PLAN',    hat: 'tie'    },
  test:              { x: 264, y: 110, label: 'TEST',    hat: 'beanie' },
};

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

/* Compat: PX usado em código antigo — deprecated mas mantido. */
export const PALETTE = C;
export const PX = (k) => (typeof k === 'string' ? (C[k] || k) : C.sky);

/* ─────────────────────────────────────────────────────────────────────
   CENÁRIO ESTÁTICO
   ───────────────────────────────────────────────────────────────────── */
export function drawScene(ctx) {
  /* Fundo */
  fill(ctx, 0, 0, NATIVE_W, NATIVE_H, C.wall);

  /* Janela / céu — faixa superior 0-32 */
  fill(ctx, 0, 0, NATIVE_W, 32, C.sky);

  /* Sol */
  drawCircle(ctx, 282, 16, 9, C.sun);
  drawCircle(ctx, 282, 16, 6, C.sunCore);

  /* Nuvens */
  drawCloud(ctx, 40, 12);
  drawCloud(ctx, 130, 8);
  drawCloud(ctx, 200, 14);

  /* Moldura da janela */
  fill(ctx, 0, 30, NATIVE_W, 2, C.outline);
  fill(ctx, 0, 0, 2, 32, C.outline);

  /* Parede 32-100 */
  fill(ctx, 0, 32, NATIVE_W, 68, C.wall);
  /* listras decorativas sutis */
  for (let x = 0; x < NATIVE_W; x += 8) {
    fillAlpha(ctx, x, 32, 1, 68, C.wallDark, 0.15);
  }

  /* Rodapé entre parede e chão */
  fill(ctx, 0, 98, NATIVE_W, 3, C.baseboard);
  fill(ctx, 0, 96, NATIVE_W, 2, C.outline);

  /* Quadro de cortiça */
  fill(ctx, 19, 37, 38, 26, C.outline);
  fill(ctx, 20, 38, 36, 24, C.cork);
  /* Notas adesivas coloridas */
  fill(ctx, 24, 42, 8, 6, C.noteYellow);
  fill(ctx, 36, 44, 7, 5, C.notePink);
  fill(ctx, 46, 41, 6, 7, C.noteBlue);
  fill(ctx, 28, 52, 9, 6, C.noteGreen);
  fill(ctx, 40, 53, 8, 6, C.noteYellow);

  /* Relógio */
  drawCircle(ctx, 160, 50, 11, C.clockEdge);
  drawCircle(ctx, 160, 50, 9, C.clockFace);
  /* ponteiros */
  fill(ctx, 160, 44, 1, 7, C.outline);   /* hora */
  fill(ctx, 160, 50, 6, 1, C.outline);   /* min */
  fill(ctx, 159, 49, 3, 3, C.outline);   /* miolo */
  /* marcadores 12/3/6/9 */
  fill(ctx, 160, 42, 1, 1, C.outline);
  fill(ctx, 168, 50, 1, 1, C.outline);
  fill(ctx, 160, 58, 1, 1, C.outline);
  fill(ctx, 152, 50, 1, 1, C.outline);

  /* Estante de livros */
  fill(ctx, 251, 39, 42, 26, C.shelfDark);
  fill(ctx, 252, 40, 40, 24, C.shelf);
  fill(ctx, 251, 51, 42, 1, C.shelfDark);
  /* Lombadas variadas */
  const books = [C.book1, C.book2, C.book3, C.book4, C.book5, C.book2, C.book1, C.book3];
  for (let i = 0; i < 8; i++) {
    fill(ctx, 254 + i * 5, 41, 4, 9, books[i]);
  }
  const books2 = [C.book4, C.book5, C.book1, C.book2, C.book3, C.book4, C.book5, C.book1];
  for (let i = 0; i < 8; i++) {
    fill(ctx, 254 + i * 5, 53, 4, 10, books2[i]);
  }

  /* Planta */
  fill(ctx, 213, 69, 10, 10, C.potDark);
  fill(ctx, 214, 70, 8, 8, C.pot);
  /* folhas */
  fill(ctx, 216, 60, 2, 10, C.leafDark);
  fill(ctx, 214, 64, 10, 2, C.leaf);
  fill(ctx, 212, 66, 2, 4, C.leaf);
  fill(ctx, 222, 66, 2, 4, C.leaf);
  fill(ctx, 215, 62, 1, 3, C.leaf);
  fill(ctx, 218, 62, 1, 3, C.leaf);

  /* Chão de madeira 100-180 */
  fill(ctx, 0, 101, NATIVE_W, 79, C.floor);
  /* Linhas de tábua */
  for (let y = 119; y < 180; y += 18) {
    fill(ctx, 0, y, NATIVE_W, 1, C.floorDark);
  }
  for (let x = 30; x < NATIVE_W; x += 60) {
    fillAlpha(ctx, x, 101, 1, 79, C.floorDark, 0.5);
  }

  /* Fileira de trás (y mesa = 88) — 4 estações */
  for (const x of [30, 118, 162, 206]) {
    drawDeskBack(ctx, x, 88);
  }

  /* Fileira da frente (y mesa = 130) — 4 estações */
  for (const x of [30, 74, 162, 250]) {
    drawDeskFront(ctx, x, 130);
  }

  /* Mesa central destaque (Claude Code) */
  drawDeskFrontBig(ctx, 134, 128);

  /* Café */
  drawCoffee(ctx, 4, 140);
}

/* Helpers de pintura */
function fill(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}
function fillAlpha(ctx, x, y, w, h, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}
function drawCircle(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy <= r * r) ctx.fillRect(cx + dx, cy + dy, 1, 1);
    }
  }
}
function drawCloud(ctx, x, y) {
  ctx.fillStyle = C.cloud;
  ctx.fillRect(x, y, 14, 4);
  ctx.fillRect(x + 2, y - 2, 10, 6);
  ctx.fillRect(x + 4, y - 3, 6, 8);
}

/* Mesa de trás */
function drawDeskBack(ctx, x, y) {
  fill(ctx, x, y, 28, 8, C.deskDark);
  fill(ctx, x + 1, y + 1, 26, 5, C.desk);
  /* Monitor */
  fill(ctx, x + 9, y - 12, 12, 12, C.monitorEdge);
  fill(ctx, x + 10, y - 11, 10, 10, C.monitor);
  fill(ctx, x + 11, y - 10, 8, 8, C.screen);
  fill(ctx, x + 13, y - 1, 4, 2, C.monitorEdge);
}

/* Mesa da frente */
function drawDeskFront(ctx, x, y) {
  fill(ctx, x, y, 36, 12, C.deskDark);
  fill(ctx, x + 1, y + 1, 34, 9, C.desk);
  /* Pernas */
  fill(ctx, x + 1, y + 12, 2, 14, C.deskDark);
  fill(ctx, x + 33, y + 12, 2, 14, C.deskDark);
  /* Monitor */
  fill(ctx, x + 11, y - 18, 16, 18, C.monitorEdge);
  fill(ctx, x + 12, y - 17, 14, 14, C.monitor);
  fill(ctx, x + 13, y - 16, 12, 12, C.screen);
  fill(ctx, x + 16, y - 3, 6, 4, C.monitorEdge);
  /* Teclado */
  fill(ctx, x + 6, y + 1, 10, 2, C.outline);
}

/* Mesa central maior */
function drawDeskFrontBig(ctx, x, y) {
  fill(ctx, x, y, 52, 14, C.deskDark);
  fill(ctx, x + 1, y + 1, 50, 11, C.desk);
  /* Pernas */
  fill(ctx, x + 1, y + 14, 2, 14, C.deskDark);
  fill(ctx, x + 49, y + 14, 2, 14, C.deskDark);
  /* Dois monitores */
  fill(ctx, x + 4, y - 22, 18, 22, C.monitorEdge);
  fill(ctx, x + 30, y - 22, 18, 22, C.monitorEdge);
  fill(ctx, x + 5, y - 21, 16, 18, C.monitor);
  fill(ctx, x + 31, y - 21, 16, 18, C.monitor);
  fill(ctx, x + 6, y - 20, 14, 16, C.screen);
  fill(ctx, x + 32, y - 20, 14, 16, C.screenAlt);
  /* Bases */
  fill(ctx, x + 10, y - 3, 6, 4, C.monitorEdge);
  fill(ctx, x + 36, y - 3, 6, 4, C.monitorEdge);
  /* Teclado */
  fill(ctx, x + 18, y + 1, 16, 2, C.outline);
}

/* Café */
function drawCoffee(ctx, x, y) {
  fill(ctx, x, y, 22, 30, C.coffeeDark);
  fill(ctx, x + 1, y + 1, 20, 28, C.coffeeBody);
  fill(ctx, x + 4, y + 4, 14, 4, C.coffeeDisp);
  fill(ctx, x + 8, y + 14, 6, 2, C.coffeeDark);
  fill(ctx, x + 9, y + 16, 4, 4, C.coffeeDark);
  /* Xícara */
  fill(ctx, x + 8, y + 21, 6, 4, C.cup);
  fill(ctx, x + 7, y + 21, 1, 5, C.cupRim);
  fill(ctx, x + 14, y + 21, 1, 5, C.cupRim);
  fill(ctx, x + 7, y + 25, 8, 1, C.cupRim);
}

/* ─────────────────────────────────────────────────────────────────────
   SPRITES DE AGENTE
   ───────────────────────────────────────────────────────────────────── */
export function drawAgent(ctx, agentName, frame, isActive) {
  const layout = AGENT_LAYOUT[agentName];
  if (!layout) return;
  const colors = AGENT_COLORS[agentName] || AGENT_COLORS['Claude Code'];
  const { x, y, hat } = layout;

  const isBack = y < 100;
  if (isBack) {
    drawChairBack(ctx, x, y - 10);
  } else {
    drawChairFront(ctx, x, y - 8, colors);
  }

  drawCharacter(ctx, x + 1, y - 26, hat, colors, frame, isActive);

  drawLabel(ctx, x - 2, y + 16, layout.label, isActive ? colors.shirt : C.outline);

  if (isActive) {
    drawSpeechBubble(ctx, x + 12, y - 36, frame, colors.shirt);
  }
}

function drawChairBack(ctx, x, y) {
  /* Encosto simples (visto de trás) */
  fill(ctx, x + 4, y, 16, 4, C.outline);
  fill(ctx, x + 5, y + 1, 14, 2, C.deskDark);
  fill(ctx, x + 4, y + 14, 2, 8, C.outline);
  fill(ctx, x + 18, y + 14, 2, 8, C.outline);
}

function drawChairFront(ctx, x, y, colors) {
  /* Encosto */
  fill(ctx, x + 6, y + 2, 14, 8, C.outline);
  fill(ctx, x + 7, y + 3, 12, 6, C.deskDark);
  /* Almofada do encosto na cor da camisa do dono (toque) */
  fillAlpha(ctx, x + 8, y + 4, 10, 4, colors.shirt, 0.3);
  /* Assento */
  fill(ctx, x + 4, y + 18, 18, 4, C.outline);
  fill(ctx, x + 5, y + 19, 16, 2, C.deskDark);
  /* Pernas */
  fill(ctx, x + 5, y + 22, 2, 6, C.outline);
  fill(ctx, x + 19, y + 22, 2, 6, C.outline);
}

/* Personagem 14x18 */
function drawCharacter(ctx, x, y, hat, colors, frame, isActive) {
  const blink = frame === 1 && Math.random() > 0.85;

  /* Cabeça 8x8 — outline + skin */
  fill(ctx, x + 3, y, 8, 8, C.outline);
  fill(ctx, x + 4, y + 1, 6, 6, C.skin);
  /* Bochechas levemente coradas */
  fillAlpha(ctx, x + 4, y + 4, 1, 1, C.rose, 0.4);
  fillAlpha(ctx, x + 9, y + 4, 1, 1, C.rose, 0.4);
  /* Olhos */
  ctx.fillStyle = C.outline;
  if (blink) {
    ctx.fillRect(x + 5, y + 4, 1, 1);
    ctx.fillRect(x + 8, y + 4, 1, 1);
  } else {
    ctx.fillRect(x + 5, y + 3, 1, 2);
    ctx.fillRect(x + 8, y + 3, 1, 2);
  }
  /* Boca */
  ctx.fillRect(x + 6, y + 6, 2, 1);

  /* Cabelo / acessório */
  drawHat(ctx, x, y, hat, colors);

  /* Pescoço */
  fill(ctx, x + 6, y + 7, 2, 1, C.skin);

  /* Corpo (camisa) — cor do agente */
  fill(ctx, x + 2, y + 8, 10, 7, C.outline);
  fill(ctx, x + 3, y + 8, 8, 7, colors.shirt);
  /* Detalhe colarinho/luz */
  fillAlpha(ctx, x + 6, y + 8, 2, 1, C.white, 0.4);

  /* Braços */
  if (frame === 2 || (isActive && frame === 0)) {
    /* Digitando: braços pra frente */
    fill(ctx, x + 1, y + 9, 2, 4, colors.shirt);
    fill(ctx, x + 11, y + 9, 2, 4, colors.shirt);
    fill(ctx, x + 1, y + 13, 2, 1, C.skin);
    fill(ctx, x + 11, y + 13, 2, 1, C.skin);
  } else {
    /* Idle: braços ao lado */
    fill(ctx, x + 1, y + 9, 1, 5, colors.shirt);
    fill(ctx, x + 12, y + 9, 1, 5, colors.shirt);
  }
}

function drawHat(ctx, x, y, hat, colors) {
  switch (hat) {
    case 'crown':
      /* Coroa dourada */
      fill(ctx, x + 3, y - 2, 8, 2, colors.hatColor);
      fill(ctx, x + 3, y - 4, 1, 2, colors.hatColor);
      fill(ctx, x + 6, y - 4, 2, 2, colors.hatColor);
      fill(ctx, x + 10, y - 4, 1, 2, colors.hatColor);
      /* Joia */
      fill(ctx, x + 6, y - 1, 2, 1, C.book1);
      break;
    case 'tall':
      /* Cartola preta */
      fill(ctx, x + 2, y - 1, 10, 1, colors.hatColor);
      fill(ctx, x + 4, y - 6, 6, 5, colors.hatColor);
      /* Faixa */
      fill(ctx, x + 4, y - 3, 6, 1, C.rose);
      break;
    case 'bob':
      /* Cabelo bob loiro */
      fill(ctx, x + 2, y - 1, 10, 2, colors.hair);
      fill(ctx, x + 2, y, 2, 4, colors.hair);
      fill(ctx, x + 10, y, 2, 4, colors.hair);
      fillAlpha(ctx, x + 4, y - 1, 6, 1, C.white, 0.3);
      break;
    case 'short':
      /* Cabelo curto marrom */
      fill(ctx, x + 3, y - 1, 8, 2, colors.hair);
      fill(ctx, x + 3, y, 1, 1, colors.hair);
      fill(ctx, x + 10, y, 1, 1, colors.hair);
      break;
    case 'cap':
      /* Boné colorido com aba */
      fill(ctx, x + 3, y - 2, 8, 2, colors.hatColor);
      fill(ctx, x + 1, y, 4, 1, colors.hatColor);
      /* Logo */
      fill(ctx, x + 6, y - 1, 2, 1, C.white);
      break;
    case 'lens':
      /* Cabelo + lupa flutuante */
      fill(ctx, x + 3, y - 1, 8, 1, colors.hair);
      /* Lupa */
      fill(ctx, x + 11, y + 1, 5, 5, C.outline);
      fill(ctx, x + 12, y + 2, 3, 3, C.cup);
      fillAlpha(ctx, x + 12, y + 2, 2, 1, C.screen, 0.6);
      fill(ctx, x + 15, y + 6, 2, 2, C.outline);
      break;
    case 'tie':
      /* Cabelo preto + faixa rosa (gravata) */
      fill(ctx, x + 3, y - 2, 8, 2, colors.hair);
      fill(ctx, x + 4, y, 6, 1, colors.hair);
      break;
    case 'beanie':
      /* Gorro vermelho com pompom */
      fill(ctx, x + 3, y - 3, 8, 3, colors.hatColor);
      fill(ctx, x + 3, y - 1, 8, 1, colors.hatColor);
      /* Faixa */
      fill(ctx, x + 3, y - 1, 8, 1, C.outline);
      /* Pompom */
      fill(ctx, x + 6, y - 4, 2, 1, C.cup);
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

function drawLabel(ctx, x, y, text, color) {
  ctx.fillStyle = color;
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

function drawSpeechBubble(ctx, x, y, frame, accent) {
  /* Borda */
  fill(ctx, x, y, 12, 9, C.outline);
  fill(ctx, x + 1, y + 1, 10, 7, C.bubbleBg);
  /* Cauda */
  fill(ctx, x + 2, y + 9, 2, 1, C.outline);
  fill(ctx, x + 3, y + 10, 1, 1, C.outline);
  /* Conteúdo: 3 pontos pulsando na cor do agente */
  ctx.fillStyle = accent;
  if (frame === 0 || frame === 2) {
    ctx.fillRect(x + 3, y + 4, 1, 1);
    ctx.fillRect(x + 6, y + 4, 1, 1);
    ctx.fillRect(x + 9, y + 4, 1, 1);
  } else {
    ctx.fillRect(x + 5, y + 4, 2, 1);
  }
}

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
