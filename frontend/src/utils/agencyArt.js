/**
 * Agência 2D — arte pixel-art moderna (estilo NES/SNES upscaled).
 *
 * Paleta colorida com rosé Cris Costa (#C13584) como acento de marca.
 * Sombreamento 3-tom em mobília e personagens, gradiente de piso, listras
 * visíveis na parede, sol com raios e nuvens multi-tier — referência visual
 * fornecida pelo Rafa em 2026-05-05. Resolução nativa 320x220 (4:2.75).
 *
 * Renderização: drawScene() desenha o cenário estático em offscreen canvas
 * uma única vez. drawAgent() pinta sprite ~14x18 sobre o cenário.
 */

export const C = {
  /* Céu / janela */
  sky:        '#A8D8FF',
  skyHi:      '#CDE7FF',
  skyLo:      '#7DC0F5',
  cloud:      '#FFFFFF',
  cloudShadow:'#C7DCEC',
  cloudOutline:'#7DA8C7',
  sun:        '#FFE066',
  sunCore:    '#F59E0B',
  sunRay:     '#FCD34D',

  /* Parede rosé (combina com marca) */
  wall:       '#F4D9E2',
  wallHi:     '#FCE7EE',
  wallDark:   '#D9A8B8',
  baseboard:  '#7D4A5E',
  baseboardHi:'#A56C82',

  /* Madeira (chão e mesas com 3 tons cada) */
  floor:      '#8B6F47',
  floorHi:    '#A8855A',
  floorMid:   '#7D6240',
  floorDark:  '#5D4A30',
  desk:       '#A0826D',
  deskHi:     '#BE9B81',
  deskDark:   '#6B5440',

  /* Tech (CRT com mais profundidade) */
  monitor:    '#1E1B2E',
  monitorEdge:'#0A0814',
  monitorHi:  '#3A364E',
  screen:     '#7DD3FC',
  screenAlt:  '#86EFAC',
  screenHi:   '#BAE6FD',
  screenDark: '#0EA5E9',

  /* Plantas / vaso */
  leaf:       '#4ADE80',
  leafDark:   '#15803D',
  leafHi:     '#86EFAC',
  pot:        '#B45309',
  potDark:    '#78350F',
  potHi:      '#D97706',

  /* Pessoas */
  skin:       '#FECACA',
  skinDark:   '#FCA5A5',
  skinHi:     '#FED7D7',
  hairBrown:  '#3F2917',
  hairBrownHi:'#6B4A30',
  hairBlonde: '#F59E0B',
  hairBlondeHi:'#FBBF24',
  hairBlack:  '#1F1B2E',
  hairBlackHi:'#3F3754',
  hairRed:    '#B91C1C',
  hairRedHi:  '#DC2626',

  /* Marca */
  rose:       '#C13584',
  roseLt:     '#F472B6',
  roseDk:     '#7D4A5E',

  /* Café */
  coffeeBody: '#525252',
  coffeeDark: '#1F2937',
  coffeeHi:   '#737373',
  coffeeDisp: '#06B6D4',
  cup:        '#FFFFFF',
  cupRim:     '#7D4A5E',

  /* Cofre */
  safeBody:   '#3F3F46',
  safeBodyHi: '#52525B',
  safeBodyLo: '#27272A',
  safeDoor:   '#52525B',
  safeAccent: '#06B6D4',
  safeBolt:   '#A1A1AA',

  /* Estante */
  shelf:      '#92400E',
  shelfHi:    '#B45309',
  shelfDark:  '#451A03',
  book1:      '#DC2626',
  book2:      '#2563EB',
  book3:      '#16A34A',
  book4:      '#CA8A04',
  book5:      '#7C3AED',

  /* Quadro */
  cork:       '#A16207',
  corkHi:     '#CA8A04',
  corkDark:   '#451A03',
  noteYellow: '#FEF08A',
  notePink:   '#FBCFE8',
  noteBlue:   '#BFDBFE',
  noteGreen:  '#BBF7D0',

  /* Relógio */
  clockFace:  '#FFFFFF',
  clockFaceHi:'#F1F5F9',
  clockEdge:  '#0A0814',

  /* Outline / sombra */
  outline:    '#1E1B2E',
  shadow:     '#00000033',
  white:      '#FFFFFF',
  bubbleBg:   '#FFFFFF',
};

export const NATIVE_W = 320;
export const NATIVE_H = 220;

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

/* Posições fixas. y é o topo da mesa; sprite senta na cadeira atrás.
   Layout vertical: parede 56-126, baseboard 126-130, piso 130-220.
   Bancada de trás em y=90 (encostada na parede); mesas frente em y=144. */
export const AGENT_LAYOUT = {
  'Claude Code':     { x: 148, y: 144, label: 'CLAUDE',  hat: 'crown'  },
  Opus:              { x:  44, y:  90, label: 'OPUS',    hat: 'tall'   },
  Sonnet:            { x: 220, y: 144, label: 'SONNET',  hat: 'bob'    },
  Haiku:             { x:  88, y: 144, label: 'HAIKU',   hat: 'short'  },
  'general-purpose': { x: 220, y:  90, label: 'GP',      hat: 'cap'    },
  Explore:           { x: 132, y:  90, label: 'EXPL',    hat: 'lens'   },
  Plan:              { x:  44, y: 144, label: 'PLAN',    hat: 'tie'    },
  test:              { x: 264, y: 144, label: 'TEST',    hat: 'beanie' },
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
   CENÁRIO ESTÁTICO  (320x220)

   Layout vertical:
     0-56    : céu (janela)
     56-126  : parede rosé com elementos
     126-130 : baseboard
     130-220 : piso de madeira (gradiente 3 tons)
   ───────────────────────────────────────────────────────────────────── */
export function drawScene(ctx) {
  /* Fundo */
  fill(ctx, 0, 0, NATIVE_W, NATIVE_H, C.wall);

  /* ── CÉU 0-56 ── gradiente vertical (claro topo, mais saturado embaixo) */
  fill(ctx, 0, 0, NATIVE_W, 56, C.skyHi);
  fill(ctx, 0, 18, NATIVE_W, 22, C.sky);
  fill(ctx, 0, 40, NATIVE_W, 14, C.skyLo);

  /* Sol com raios */
  drawSun(ctx, 282, 26);

  /* Nuvens multi-tier */
  drawFatCloud(ctx, 36, 16);
  drawFatCloud(ctx, 138, 10);
  drawFatCloud(ctx, 208, 22);

  /* Borda inferior da janela (faixa preta separando céu/parede) */
  fill(ctx, 0, 54, NATIVE_W, 2, C.outline);
  fill(ctx, 0, 56, NATIVE_W, 1, C.baseboardHi);

  /* ── PAREDE 56-126 ── rosa com listras verticais visíveis */
  fill(ctx, 0, 56, NATIVE_W, 70, C.wall);
  /* Highlight superior */
  fillAlpha(ctx, 0, 56, NATIVE_W, 4, C.wallHi, 0.6);
  /* Listras verticais marcantes */
  for (let x = 4; x < NATIVE_W; x += 6) {
    fillAlpha(ctx, x, 56, 1, 70, C.wallDark, 0.35);
  }
  /* Sombra sutil acima do baseboard (luz vindo de cima) */
  fillAlpha(ctx, 0, 118, NATIVE_W, 8, C.wallDark, 0.25);

  /* ── BASEBOARD 126-130 ── */
  fill(ctx, 0, 126, NATIVE_W, 1, C.outline);
  fill(ctx, 0, 127, NATIVE_W, 2, C.baseboard);
  fill(ctx, 0, 129, NATIVE_W, 1, C.outline);

  /* ── ELEMENTOS DA PAREDE (entre y=58 e y=86) ── */

  /* Quadro de cortiça */
  fill(ctx, 18, 60, 40, 26, C.outline);
  fill(ctx, 19, 61, 38, 24, C.corkDark);
  fill(ctx, 20, 62, 36, 22, C.cork);
  fillAlpha(ctx, 20, 62, 36, 2, C.corkHi, 0.5);
  /* Notas adesivas coloridas com sombrinha */
  drawSticky(ctx, 23, 65, C.noteYellow);
  drawSticky(ctx, 32, 67, C.notePink);
  drawSticky(ctx, 42, 64, C.noteBlue);
  drawSticky(ctx, 26, 75, C.noteGreen);
  drawSticky(ctx, 41, 76, C.noteYellow);

  /* Relógio */
  drawCircle(ctx, 160, 73, 11, C.clockEdge);
  drawCircle(ctx, 160, 73, 9, C.clockFace);
  fillAlpha(ctx, 156, 67, 6, 4, C.clockFaceHi, 0.6);
  /* ponteiros */
  fill(ctx, 160, 67, 1, 7, C.outline);
  fill(ctx, 160, 73, 6, 1, C.outline);
  fill(ctx, 159, 72, 3, 3, C.outline);
  /* marcadores 12/3/6/9 */
  fill(ctx, 160, 65, 1, 1, C.outline);
  fill(ctx, 168, 73, 1, 1, C.outline);
  fill(ctx, 160, 81, 1, 1, C.outline);
  fill(ctx, 152, 73, 1, 1, C.outline);

  /* Estante de livros */
  fill(ctx, 250, 60, 44, 26, C.outline);
  fill(ctx, 251, 61, 42, 24, C.shelfDark);
  fill(ctx, 252, 62, 40, 22, C.shelf);
  fillAlpha(ctx, 252, 62, 40, 2, C.shelfHi, 0.5);
  /* Linha divisória de prateleira */
  fill(ctx, 251, 73, 42, 1, C.shelfDark);
  fillAlpha(ctx, 252, 74, 40, 1, C.outline, 0.4);
  /* Lombadas variadas — fileira de cima */
  const books = [C.book1, C.book2, C.book3, C.book4, C.book5, C.book2, C.book1, C.book3];
  for (let i = 0; i < 8; i++) {
    fill(ctx, 254 + i * 5, 63, 4, 9, books[i]);
    fillAlpha(ctx, 254 + i * 5, 63, 1, 9, C.white, 0.35);
  }
  /* Lombadas variadas — fileira de baixo */
  const books2 = [C.book4, C.book5, C.book1, C.book2, C.book3, C.book4, C.book5, C.book1];
  for (let i = 0; i < 8; i++) {
    fill(ctx, 254 + i * 5, 75, 4, 9, books2[i]);
    fillAlpha(ctx, 254 + i * 5, 75, 1, 9, C.white, 0.35);
  }

  /* Plantinha pendurada (canto direito da parede, antes da estante) */
  drawWallPlant(ctx, 226, 64);

  /* ── PISO 130-220 ── gradiente 3 tons + tábuas */
  fill(ctx, 0, 130, NATIVE_W, 90, C.floorMid);
  /* Faixa clara perto da parede */
  fillAlpha(ctx, 0, 130, NATIVE_W, 18, C.floorHi, 0.7);
  /* Faixa escura perto do espectador */
  fillAlpha(ctx, 0, 196, NATIVE_W, 24, C.floorDark, 0.5);
  /* Linhas de tábua horizontal (perspectiva) */
  for (let y = 148; y < 220; y += 16) {
    fillAlpha(ctx, 0, y, NATIVE_W, 1, C.floorDark, 0.6);
  }
  /* Cortes verticais de tábua */
  const seamY = [148, 164, 180, 196, 212];
  for (const sy of seamY) {
    for (let x = 24 + (sy * 7) % 40; x < NATIVE_W; x += 56) {
      fillAlpha(ctx, x, sy - 16, 1, 16, C.floorDark, 0.4);
    }
  }

  /* ── BANCADA DE TRÁS (y=90, encostada na parede) — 4 estações ── */
  for (const x of [30, 118, 162, 206]) {
    drawDeskBack(ctx, x, 90);
  }

  /* ── FILEIRA DA FRENTE (y=144) — 4 estações + central ── */
  for (const x of [30, 74, 162, 250]) {
    drawDeskFront(ctx, x, 144);
  }
  /* Mesa central destaque (Claude Code) */
  drawDeskFrontBig(ctx, 134, 142);

  /* ── COFRE no canto inferior esquerdo ── */
  drawSafe(ctx, 4, 176);

  /* ── CAFETEIRA no canto direito do piso ── */
  drawCoffee(ctx, 294, 170);

  /* ── VASO DE PLANTA grande no chão (canto direito da fileira da frente) ── */
  drawFloorPlant(ctx, 296, 196);

  /* Sombra suave sob mobília (ground shadow geral) */
  fillAlpha(ctx, 0, 218, NATIVE_W, 2, C.outline, 0.25);
}

/* ─────────────────────────────────────────────────────────────────────
   HELPERS DE PINTURA
   ───────────────────────────────────────────────────────────────────── */
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

/* Sol com raios + miolo iluminado */
function drawSun(ctx, cx, cy) {
  /* Raios cardinais sutis (alpha) */
  for (let i = 1; i <= 4; i++) {
    const t = 13 + i * 2;
    fillAlpha(ctx, cx - 1, cy - t, 2, 2, C.sunRay, 0.35 - i * 0.06);
    fillAlpha(ctx, cx - 1, cy + t - 1, 2, 2, C.sunRay, 0.35 - i * 0.06);
    fillAlpha(ctx, cx - t, cy - 1, 2, 2, C.sunRay, 0.35 - i * 0.06);
    fillAlpha(ctx, cx + t - 1, cy - 1, 2, 2, C.sunRay, 0.35 - i * 0.06);
  }
  /* Halo */
  drawCircle(ctx, cx, cy, 13, C.sunRay);
  /* Disco */
  drawCircle(ctx, cx, cy, 11, C.sun);
  drawCircle(ctx, cx, cy, 8, C.sunCore);
  /* Highlight */
  fillAlpha(ctx, cx - 4, cy - 5, 4, 3, C.cup, 0.5);
}

/* Nuvem volumosa multi-tier */
function drawFatCloud(ctx, x, y) {
  /* Sombra inferior (azul-acinzentada) */
  fill(ctx, x + 1, y + 5, 22, 2, C.cloudShadow);
  fill(ctx, x + 4, y + 7, 16, 1, C.cloudShadow);
  /* Corpo principal — várias camadas brancas */
  fill(ctx, x + 2, y + 2, 20, 4, C.cloud);
  fill(ctx, x + 4, y, 16, 6, C.cloud);
  fill(ctx, x + 6, y - 2, 12, 9, C.cloud);
  fill(ctx, x + 9, y - 3, 6, 11, C.cloud);
  /* Highlight superior */
  fillAlpha(ctx, x + 8, y - 2, 8, 2, C.skyHi, 0.4);
  /* Outline pixel ao redor (uns toques) */
  fill(ctx, x + 4, y + 6, 1, 1, C.cloudOutline);
  fill(ctx, x + 19, y + 6, 1, 1, C.cloudOutline);
  fill(ctx, x + 5, y - 1, 1, 1, C.cloudOutline);
  fill(ctx, x + 18, y - 1, 1, 1, C.cloudOutline);
}

/* Nota adesiva 8x6 com sombrinha */
function drawSticky(ctx, x, y, color) {
  fillAlpha(ctx, x + 1, y + 6, 8, 1, C.outline, 0.25);
  fill(ctx, x, y, 8, 6, color);
  fillAlpha(ctx, x, y, 8, 1, C.white, 0.5);
  fillAlpha(ctx, x + 6, y + 1, 1, 4, C.outline, 0.25);
}

/* Plantinha pendurada na parede (vaso + folhas pequenas) */
function drawWallPlant(ctx, x, y) {
  /* Vaso */
  fill(ctx, x, y + 12, 10, 8, C.outline);
  fill(ctx, x + 1, y + 13, 8, 6, C.potDark);
  fill(ctx, x + 1, y + 13, 8, 2, C.pot);
  fillAlpha(ctx, x + 1, y + 13, 8, 1, C.potHi, 0.7);
  /* Folhas */
  fill(ctx, x + 4, y + 4, 2, 9, C.leafDark);
  fill(ctx, x + 2, y + 6, 6, 2, C.leaf);
  fill(ctx, x + 6, y + 8, 2, 4, C.leaf);
  fill(ctx, x + 1, y + 8, 2, 3, C.leaf);
  fill(ctx, x + 3, y + 2, 1, 4, C.leaf);
  fill(ctx, x + 6, y + 3, 1, 3, C.leafHi);
}

/* Vaso de planta grande no chão (canto) */
function drawFloorPlant(ctx, x, y) {
  /* Sombra base */
  fillAlpha(ctx, x - 2, y + 22, 24, 2, C.outline, 0.3);
  /* Vaso */
  fill(ctx, x, y + 14, 18, 10, C.outline);
  fill(ctx, x + 1, y + 15, 16, 8, C.potDark);
  fill(ctx, x + 1, y + 15, 16, 3, C.pot);
  fillAlpha(ctx, x + 1, y + 15, 16, 1, C.potHi, 0.7);
  /* Folhagem volumosa */
  fill(ctx, x + 8, y - 6, 2, 20, C.leafDark);
  fill(ctx, x + 4, y - 2, 10, 2, C.leaf);
  fill(ctx, x + 2, y + 2, 14, 3, C.leaf);
  fill(ctx, x + 1, y + 6, 16, 3, C.leaf);
  fill(ctx, x + 3, y + 10, 12, 3, C.leafDark);
  /* Highlights */
  fillAlpha(ctx, x + 5, y, 1, 2, C.leafHi, 0.7);
  fillAlpha(ctx, x + 11, y + 4, 1, 2, C.leafHi, 0.7);
  fillAlpha(ctx, x + 7, y + 7, 2, 1, C.leafHi, 0.6);
}

/* Cofre 22x42 — corpo cinza com porta + display LED + maçaneta */
function drawSafe(ctx, x, y) {
  /* Sombra base */
  fillAlpha(ctx, x - 1, y + 41, 24, 2, C.outline, 0.3);
  /* Corpo (outline + 2 tons) */
  fill(ctx, x, y, 22, 42, C.outline);
  fill(ctx, x + 1, y + 1, 20, 40, C.safeBodyLo);
  fill(ctx, x + 2, y + 2, 18, 38, C.safeBody);
  fillAlpha(ctx, x + 2, y + 2, 18, 2, C.safeBodyHi, 0.7);
  fillAlpha(ctx, x + 2, y + 2, 2, 38, C.safeBodyHi, 0.4);
  /* Porta interna */
  fill(ctx, x + 4, y + 6, 14, 32, C.outline);
  fill(ctx, x + 5, y + 7, 12, 30, C.safeDoor);
  fillAlpha(ctx, x + 5, y + 7, 12, 1, C.safeBodyHi, 0.6);
  /* Display LED (ciano) */
  fill(ctx, x + 7, y + 10, 8, 4, C.outline);
  fill(ctx, x + 8, y + 11, 6, 2, C.safeAccent);
  /* Maçaneta circular */
  drawCircle(ctx, x + 11, y + 26, 4, C.outline);
  drawCircle(ctx, x + 11, y + 26, 3, C.safeBolt);
  fill(ctx, x + 11, y + 22, 1, 8, C.outline);
  fill(ctx, x + 7, y + 26, 8, 1, C.outline);
  /* Reflexo na porta */
  fillAlpha(ctx, x + 6, y + 8, 4, 1, C.white, 0.4);
}

/* Cafeteira com xícara — usado no canto direito do piso */
function drawCoffee(ctx, x, y) {
  /* Sombra base */
  fillAlpha(ctx, x - 2, y + 30, 26, 2, C.outline, 0.3);
  /* Corpo */
  fill(ctx, x, y, 22, 30, C.outline);
  fill(ctx, x + 1, y + 1, 20, 28, C.coffeeDark);
  fill(ctx, x + 2, y + 2, 18, 26, C.coffeeBody);
  fillAlpha(ctx, x + 2, y + 2, 18, 2, C.coffeeHi, 0.6);
  fillAlpha(ctx, x + 2, y + 2, 2, 26, C.coffeeHi, 0.3);
  /* Display ciano */
  fill(ctx, x + 4, y + 4, 14, 4, C.outline);
  fill(ctx, x + 5, y + 5, 12, 2, C.coffeeDisp);
  /* Bico */
  fill(ctx, x + 8, y + 14, 6, 2, C.coffeeDark);
  fill(ctx, x + 9, y + 16, 4, 4, C.coffeeDark);
  /* Xícara */
  fill(ctx, x + 7, y + 21, 8, 1, C.outline);
  fill(ctx, x + 8, y + 22, 6, 4, C.cup);
  fill(ctx, x + 7, y + 22, 1, 4, C.cupRim);
  fill(ctx, x + 14, y + 22, 1, 4, C.cupRim);
  fill(ctx, x + 7, y + 26, 8, 1, C.cupRim);
  fillAlpha(ctx, x + 8, y + 22, 6, 1, C.rose, 0.4);
}

/* ─────────────────────────────────────────────────────────────────────
   MESAS (com 3 tons: highlight, base, sombra)
   ───────────────────────────────────────────────────────────────────── */

/* Bancada de trás (sem pernas — encostada na parede) */
function drawDeskBack(ctx, x, y) {
  /* Outline + corpo + topo iluminado */
  fill(ctx, x, y, 28, 9, C.outline);
  fill(ctx, x + 1, y + 1, 26, 7, C.deskDark);
  fill(ctx, x + 1, y + 1, 26, 4, C.desk);
  fillAlpha(ctx, x + 1, y + 1, 26, 1, C.deskHi, 0.7);
  /* Sombra na parede atrás (sutil) */
  fillAlpha(ctx, x - 1, y - 1, 30, 1, C.outline, 0.2);
  /* Monitor CRT */
  fill(ctx, x + 8, y - 13, 14, 13, C.outline);
  fill(ctx, x + 9, y - 12, 12, 12, C.monitorEdge);
  fill(ctx, x + 10, y - 11, 10, 10, C.monitor);
  fill(ctx, x + 11, y - 10, 8, 8, C.screen);
  /* Gradiente da tela */
  fillAlpha(ctx, x + 11, y - 10, 8, 3, C.screenHi, 0.6);
  fillAlpha(ctx, x + 11, y - 4, 8, 2, C.screenDark, 0.4);
  /* Brilho canto superior esquerdo da tela */
  fill(ctx, x + 11, y - 10, 2, 1, C.white);
  fill(ctx, x + 11, y - 9, 1, 1, C.white);
  /* Base/pé do monitor */
  fill(ctx, x + 13, y - 1, 4, 2, C.outline);
  fill(ctx, x + 12, y, 6, 1, C.outline);
}

/* Mesa da frente (com pernas pretas firmes) */
function drawDeskFront(ctx, x, y) {
  /* Tampo: outline + corpo + 3 tons */
  fill(ctx, x, y, 36, 13, C.outline);
  fill(ctx, x + 1, y + 1, 34, 11, C.deskDark);
  fill(ctx, x + 1, y + 1, 34, 7, C.desk);
  fillAlpha(ctx, x + 1, y + 1, 34, 2, C.deskHi, 0.65);
  /* Pernas pretas firmes */
  fill(ctx, x + 1, y + 13, 3, 14, C.outline);
  fill(ctx, x + 32, y + 13, 3, 14, C.outline);
  /* Sombra no chão sob a mesa */
  fillAlpha(ctx, x + 1, y + 26, 34, 2, C.outline, 0.35);
  /* Monitor CRT */
  fill(ctx, x + 10, y - 19, 18, 19, C.outline);
  fill(ctx, x + 11, y - 18, 16, 18, C.monitorEdge);
  fill(ctx, x + 12, y - 17, 14, 14, C.monitor);
  fill(ctx, x + 13, y - 16, 12, 12, C.screen);
  fillAlpha(ctx, x + 13, y - 16, 12, 4, C.screenHi, 0.55);
  fillAlpha(ctx, x + 13, y - 8, 12, 4, C.screenDark, 0.4);
  /* Brilho */
  fill(ctx, x + 13, y - 16, 2, 1, C.white);
  fill(ctx, x + 13, y - 15, 1, 1, C.white);
  /* Base */
  fill(ctx, x + 16, y - 4, 6, 4, C.outline);
  fill(ctx, x + 14, y - 1, 10, 1, C.outline);
  /* Teclado + papelzinho */
  fill(ctx, x + 5, y + 2, 12, 3, C.outline);
  fill(ctx, x + 6, y + 3, 10, 1, C.monitorHi);
  fill(ctx, x + 19, y + 2, 8, 4, C.cup);
  fillAlpha(ctx, x + 20, y + 3, 6, 1, C.outline, 0.4);
  fillAlpha(ctx, x + 20, y + 5, 5, 1, C.outline, 0.4);
}

/* Mesa central maior (Claude — dois monitores) */
function drawDeskFrontBig(ctx, x, y) {
  /* Tampo */
  fill(ctx, x, y, 52, 15, C.outline);
  fill(ctx, x + 1, y + 1, 50, 13, C.deskDark);
  fill(ctx, x + 1, y + 1, 50, 8, C.desk);
  fillAlpha(ctx, x + 1, y + 1, 50, 2, C.deskHi, 0.65);
  /* Pernas */
  fill(ctx, x + 1, y + 15, 3, 14, C.outline);
  fill(ctx, x + 48, y + 15, 3, 14, C.outline);
  /* Sombra no chão */
  fillAlpha(ctx, x + 1, y + 28, 50, 2, C.outline, 0.4);
  /* Monitor esquerdo */
  fill(ctx, x + 3, y - 23, 20, 23, C.outline);
  fill(ctx, x + 4, y - 22, 18, 22, C.monitorEdge);
  fill(ctx, x + 5, y - 21, 16, 18, C.monitor);
  fill(ctx, x + 6, y - 20, 14, 16, C.screen);
  fillAlpha(ctx, x + 6, y - 20, 14, 5, C.screenHi, 0.55);
  fillAlpha(ctx, x + 6, y - 9, 14, 5, C.screenDark, 0.4);
  fill(ctx, x + 6, y - 20, 2, 1, C.white);
  /* Monitor direito (verde — destaque) */
  fill(ctx, x + 29, y - 23, 20, 23, C.outline);
  fill(ctx, x + 30, y - 22, 18, 22, C.monitorEdge);
  fill(ctx, x + 31, y - 21, 16, 18, C.monitor);
  fill(ctx, x + 32, y - 20, 14, 16, C.screenAlt);
  fillAlpha(ctx, x + 32, y - 20, 14, 5, C.cup, 0.45);
  fillAlpha(ctx, x + 32, y - 9, 14, 5, C.leafDark, 0.3);
  fill(ctx, x + 32, y - 20, 2, 1, C.white);
  /* Bases dos dois monitores */
  fill(ctx, x + 10, y - 4, 6, 4, C.outline);
  fill(ctx, x + 36, y - 4, 6, 4, C.outline);
  fill(ctx, x + 8, y - 1, 10, 1, C.outline);
  fill(ctx, x + 34, y - 1, 10, 1, C.outline);
  /* Teclado central + mouse */
  fill(ctx, x + 17, y + 2, 18, 3, C.outline);
  fill(ctx, x + 18, y + 3, 16, 1, C.monitorHi);
  fill(ctx, x + 38, y + 2, 5, 4, C.outline);
  fill(ctx, x + 39, y + 3, 3, 2, C.monitorHi);
  /* Coroa decorativa — pequena estatueta (lembra "Claude" com hat crown) */
  fillAlpha(ctx, x + 40, y - 6, 5, 5, C.sunCore, 0.0);
  fill(ctx, x + 4, y + 2, 4, 4, C.outline);
  fill(ctx, x + 5, y + 3, 2, 2, C.rose);
}

/* ─────────────────────────────────────────────────────────────────────
   SPRITES DE AGENTE
   ───────────────────────────────────────────────────────────────────── */
export function drawAgent(ctx, agentName, frame, isActive, tool) {
  const layout = AGENT_LAYOUT[agentName];
  if (!layout) return;
  const colors = AGENT_COLORS[agentName] || AGENT_COLORS['Claude Code'];
  const { x, y, hat } = layout;

  const isBack = y < 120;
  if (isBack) {
    drawChairBack(ctx, x, y - 10);
  } else {
    drawChairFront(ctx, x, y - 8, colors);
  }

  drawCharacter(ctx, x + 1, y - 26, hat, colors, frame, isActive);

  /* Label embaixo da mesa, no chão (frente) ou direto sob a bancada (trás) */
  const labelY = isBack ? y + 11 : y + 18;
  drawLabel(ctx, x + 4, labelY, layout.label, isActive ? colors.shirt : C.outline);

  if (isActive) {
    drawSpeechBubble(ctx, x + 12, y - 38, frame, colors.shirt, tool);
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

/* Personagem 14x18 — agora com highlight de cabelo, bochechas firmes e boca animada */
function drawCharacter(ctx, x, y, hat, colors, frame, isActive) {
  const blink = frame === 1 && Math.random() > 0.85;

  /* Cabeça 8x8 — outline + skin com sombra lateral */
  fill(ctx, x + 3, y, 8, 8, C.outline);
  fill(ctx, x + 4, y + 1, 6, 6, C.skin);
  /* Sombra na lateral direita do rosto (luz da janela à esquerda) */
  fillAlpha(ctx, x + 9, y + 1, 1, 6, C.skinDark, 0.6);
  fillAlpha(ctx, x + 4, y + 1, 1, 6, C.skinHi, 0.5);
  /* Bochechas */
  fillAlpha(ctx, x + 4, y + 4, 2, 1, C.rose, 0.55);
  fillAlpha(ctx, x + 8, y + 4, 2, 1, C.rose, 0.55);
  /* Olhos */
  ctx.fillStyle = C.outline;
  if (blink) {
    ctx.fillRect(x + 5, y + 4, 1, 1);
    ctx.fillRect(x + 8, y + 4, 1, 1);
  } else {
    ctx.fillRect(x + 5, y + 3, 1, 2);
    ctx.fillRect(x + 8, y + 3, 1, 2);
    /* Brilhinho do olho */
    fill(ctx, x + 5, y + 3, 1, 1, C.white);
    fill(ctx, x + 8, y + 3, 1, 1, C.white);
    fill(ctx, x + 5, y + 4, 1, 1, C.outline);
    fill(ctx, x + 8, y + 4, 1, 1, C.outline);
  }
  /* Boca — anima quando ativo */
  if (isActive && (frame === 0 || frame === 2)) {
    /* Falando: boca aberta "o" */
    fill(ctx, x + 6, y + 6, 2, 2, C.outline);
    fill(ctx, x + 6, y + 6, 2, 1, C.rose);
  } else {
    /* Sorriso fechado */
    ctx.fillStyle = C.outline;
    ctx.fillRect(x + 6, y + 6, 2, 1);
  }

  /* Cabelo / acessório */
  drawHat(ctx, x, y, hat, colors);

  /* Pescoço */
  fill(ctx, x + 6, y + 7, 2, 1, C.skin);
  fillAlpha(ctx, x + 6, y + 7, 2, 1, C.skinDark, 0.4);

  /* Corpo (camisa) — cor do agente com highlight + sombra */
  fill(ctx, x + 2, y + 8, 10, 7, C.outline);
  fill(ctx, x + 3, y + 8, 8, 7, colors.shirt);
  /* Highlight ombro esquerdo */
  fillAlpha(ctx, x + 3, y + 8, 4, 1, C.white, 0.35);
  /* Sombra lateral direita do tronco */
  fillAlpha(ctx, x + 10, y + 9, 1, 6, C.outline, 0.35);
  /* Botão/colarinho */
  fillAlpha(ctx, x + 6, y + 8, 2, 1, C.white, 0.5);
  fill(ctx, x + 7, y + 11, 1, 1, C.outline);

  /* Braços */
  if (frame === 2 || (isActive && frame === 0)) {
    /* Digitando: braços pra frente */
    fill(ctx, x + 1, y + 9, 2, 4, colors.shirt);
    fill(ctx, x + 11, y + 9, 2, 4, colors.shirt);
    fill(ctx, x + 1, y + 13, 2, 1, C.skin);
    fill(ctx, x + 11, y + 13, 2, 1, C.skin);
    fillAlpha(ctx, x + 1, y + 9, 1, 4, C.white, 0.25);
  } else {
    /* Idle: braços ao lado */
    fill(ctx, x + 1, y + 9, 1, 5, colors.shirt);
    fill(ctx, x + 12, y + 9, 1, 5, colors.shirt);
    fill(ctx, x + 1, y + 14, 1, 1, C.skin);
    fill(ctx, x + 12, y + 14, 1, 1, C.skin);
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
      /* Cabelo bob loiro com highlight */
      fill(ctx, x + 2, y - 1, 10, 2, colors.hair);
      fill(ctx, x + 2, y, 2, 4, colors.hair);
      fill(ctx, x + 10, y, 2, 4, colors.hair);
      fillAlpha(ctx, x + 4, y - 1, 6, 1, C.white, 0.45);
      fillAlpha(ctx, x + 2, y, 1, 3, C.white, 0.2);
      break;
    case 'short':
      /* Cabelo curto com highlight */
      fill(ctx, x + 3, y - 1, 8, 2, colors.hair);
      fill(ctx, x + 3, y, 1, 1, colors.hair);
      fill(ctx, x + 10, y, 1, 1, colors.hair);
      fillAlpha(ctx, x + 3, y - 1, 8, 1, C.white, 0.3);
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

function drawSpeechBubble(ctx, x, y, frame, accent, tool) {
  /* Mapeia tool pra label curto (4 chars max) */
  const map = {
    Bash: 'BASH',
    Read: 'READ',
    Edit: 'EDIT',
    MultiEdit: 'EDIT',
    Write: 'NEW',
    Grep: 'GREP',
    Glob: 'FIND',
    WebFetch: 'WEB',
    WebSearch: 'WEB',
    Task: 'BOT',
    Agent: 'BOT',
    Skill: 'GEAR',
  };
  const label = tool ? (map[tool] || String(tool).toUpperCase().slice(0, 4)) : '';

  /* Largura adaptativa: vazio (3 pontos) = 14px, com label = 4*charW + padding */
  const labelW = label ? label.length * 4 - 1 : 0;
  const w = label ? Math.max(14, labelW + 4) : 14;

  /* Sombra suave */
  fillAlpha(ctx, x + 1, y + 1, w, 10, C.outline, 0.25);
  /* Borda outline */
  fill(ctx, x, y, w, 10, C.outline);
  fill(ctx, x + 1, y + 1, w - 2, 8, C.bubbleBg);
  /* Highlight superior */
  fillAlpha(ctx, x + 1, y + 1, w - 2, 1, accent, 0.18);
  /* Cauda */
  fill(ctx, x + 2, y + 10, 3, 1, C.outline);
  fill(ctx, x + 3, y + 11, 1, 1, C.outline);

  if (label) {
    /* Texto na cor do agente */
    drawLabel(ctx, x + 2, y + 2, label, accent);
  } else {
    /* 3 pontos pulsando */
    ctx.fillStyle = accent;
    if (frame === 0 || frame === 2) {
      ctx.fillRect(x + 3, y + 4, 1, 1);
      ctx.fillRect(x + 6, y + 4, 1, 1);
      ctx.fillRect(x + 9, y + 4, 1, 1);
    } else {
      ctx.fillRect(x + 5, y + 4, 2, 1);
    }
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
