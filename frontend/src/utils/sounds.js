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

// boas-vindas: mini acorde em C (pra splash)
export function playWelcome() {
  playTone({ freq: 523.25, duration: 0.22, type: 'sine', volume: 0.11, delay: 0 });     // C5
  playTone({ freq: 659.25, duration: 0.22, type: 'sine', volume: 0.11, delay: 0.12 });  // E5
  playTone({ freq: 783.99, duration: 0.38, type: 'sine', volume: 0.11, delay: 0.24 });  // G5
}
