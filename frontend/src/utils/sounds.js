let audioCtx = null;

function getCtx() {
  if (audioCtx) return audioCtx;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  } catch { return null; }
  return audioCtx;
}

function enabled() {
  try { return localStorage.getItem('ccb_sounds_disabled') !== '1'; }
  catch { return true; }
}

export function setSoundsEnabled(on) {
  try { localStorage.setItem('ccb_sounds_disabled', on ? '0' : '1'); } catch {}
}

export function soundsEnabled() { return enabled(); }

function playTone({ freq, duration = 0.1, type = 'sine', volume = 0.15, attack = 0.01, release = 0.1, delay = 0, freqEnd }) {
  const ctx = getCtx();
  if (!ctx || !enabled()) return;
  try {
    if (ctx.state === 'suspended') ctx.resume();
  } catch {}
  const now = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, now + duration);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + attack);
  gain.gain.linearRampToValueAtTime(0, now + attack + duration + release);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + attack + duration + release + 0.05);
}

// sino de notificação: duas notas ascendentes
export function playBell() {
  playTone({ freq: 880,  duration: 0.08, type: 'sine',     volume: 0.16, delay: 0 });
  playTone({ freq: 1175, duration: 0.18, type: 'triangle', volume: 0.14, delay: 0.09 });
}

// bubble do chat: pop curto com slide ascendente
export function playBubble() {
  playTone({ freq: 300, freqEnd: 650, duration: 0.12, type: 'sine', volume: 0.16, attack: 0.005, release: 0.08 });
}

// boas-vindas: mini acorde em C (pra splash) — substituido por playSparkle
export function playWelcome() {
  playTone({ freq: 523.25, duration: 0.22, type: 'sine', volume: 0.11, delay: 0 });     // C5
  playTone({ freq: 659.25, duration: 0.22, type: 'sine', volume: 0.11, delay: 0.12 });  // E5
  playTone({ freq: 783.99, duration: 0.38, type: 'sine', volume: 0.11, delay: 0.24 });  // G5
}

// brilho de varinha magica (pra splash de entrada)
// Whoosh ascendente + arpejo de altas frequencias + chime cintilante
export function playSparkle() {
  // Whoosh magico ascendente (400Hz -> 2400Hz)
  playTone({ freq: 400, freqEnd: 2400, duration: 0.5, type: 'sine', volume: 0.09, attack: 0.02, release: 0.25, delay: 0 });
  // Arpejo brilhante em alta frequencia
  playTone({ freq: 1568, duration: 0.08, type: 'triangle', volume: 0.11, delay: 0.16 }); // G6
  playTone({ freq: 1975, duration: 0.08, type: 'triangle', volume: 0.10, delay: 0.23 }); // B6
  playTone({ freq: 2349, duration: 0.09, type: 'triangle', volume: 0.10, delay: 0.30 }); // D7
  playTone({ freq: 2637, duration: 0.20, type: 'sine',     volume: 0.08, delay: 0.40 }); // E7 com sustain
  // Chime final cintilante
  playTone({ freq: 3136, duration: 0.06, type: 'sine', volume: 0.06, delay: 0.56 }); // G7
  playTone({ freq: 3951, duration: 0.10, type: 'sine', volume: 0.05, delay: 0.62 }); // B7
}
