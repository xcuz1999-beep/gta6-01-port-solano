// Port Solano — audio.js
// Procedural WebAudio: no audio files, every sound is synthesized. Short
// blips for shots and hits, a two-oscillator siren, and an engine hum whose
// pitch follows the player's speed. Everything is guarded so a browser that
// refuses an AudioContext (or headless test runs) simply stays silent.

let ctx = null;
let engineOsc = null, engineGain = null, engineFilter = null;
let sirenOsc = null, sirenGain = null, sirenLfo = null;
let master = null;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  } catch { ctx = null; }
}

function tone(freq, dur, type = 'square', vol = 0.2, slideTo = null, delay = 0) {
  if (!ctx || !master) return;
  try {
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain); gain.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  } catch { /* silent */ }
}

function noiseBurst(dur, vol = 0.25, freq = 1200, delay = 0) {
  if (!ctx || !master) return;
  try {
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buffer;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = freq;
    const gain = ctx.createGain(); gain.gain.value = vol;
    src.connect(filter); filter.connect(gain); gain.connect(master);
    src.start(t0);
  } catch { /* silent */ }
}

export function sfx(name) {
  if (!ctx) return;
  switch (name) {
    case 'shot': noiseBurst(0.09, 0.30, 2600); tone(160, 0.07, 'square', 0.12, 60); break;
    case 'shotSmg': noiseBurst(0.06, 0.22, 3000); tone(200, 0.05, 'square', 0.09, 80); break;
    case 'punch': noiseBurst(0.07, 0.28, 700); break;
    case 'hit': tone(220, 0.06, 'triangle', 0.18, 140); break;
    case 'hurt': tone(140, 0.16, 'sawtooth', 0.20, 70); break;
    case 'cash': tone(880, 0.09, 'sine', 0.18); tone(1320, 0.14, 'sine', 0.16, null, 0.07); break;
    case 'ui': tone(520, 0.05, 'sine', 0.12); break;
    case 'deny': tone(160, 0.12, 'square', 0.14, 110); break;
    case 'door': tone(300, 0.06, 'triangle', 0.15, 180); noiseBurst(0.04, 0.10, 900); break;
    case 'alarm': tone(980, 0.11, 'square', 0.16); tone(740, 0.11, 'square', 0.16, null, 0.13); break;
    case 'crash': noiseBurst(0.22, 0.36, 800); tone(90, 0.2, 'sawtooth', 0.16, 40); break;
    case 'mission': tone(523, 0.12, 'triangle', 0.2); tone(659, 0.12, 'triangle', 0.2, null, 0.11); tone(784, 0.22, 'triangle', 0.22, null, 0.22); break;
    case 'fail': tone(392, 0.16, 'triangle', 0.2); tone(311, 0.16, 'triangle', 0.2, null, 0.15); tone(233, 0.3, 'triangle', 0.2, null, 0.3); break;
    case 'unlock': tone(660, 0.1, 'sine', 0.2); tone(990, 0.2, 'sine', 0.2, null, 0.09); break;
    case 'sirenOn': break; // handled by setSiren
  }
}

// Continuous engine hum. speedNorm is 0..1 of the car's top speed.
export function setEngine(speedNorm, driving) {
  if (!ctx || !master) return;
  try {
    if (driving && !engineOsc) {
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth';
      engineFilter = ctx.createBiquadFilter(); engineFilter.type = 'lowpass'; engineFilter.frequency.value = 420;
      engineGain = ctx.createGain(); engineGain.gain.value = 0.0;
      engineOsc.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
    }
    if (engineOsc) {
      const target = driving ? 0.05 + speedNorm * 0.05 : 0.0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(55 + speedNorm * 165, ctx.currentTime, 0.08);
      if (!driving && speedNorm <= 0) {
        const osc = engineOsc; engineOsc = null;
        setTimeout(() => { try { osc.stop(); } catch { /* gone */ } }, 350);
      }
    }
  } catch { /* silent */ }
}

// Continuous police siren, wailing between two pitches while active.
export function setSiren(active) {
  if (!ctx || !master) return;
  try {
    if (active && !sirenOsc) {
      sirenOsc = ctx.createOscillator(); sirenOsc.type = 'triangle'; sirenOsc.frequency.value = 760;
      sirenLfo = ctx.createOscillator(); sirenLfo.frequency.value = 0.55;
      const lfoGain = ctx.createGain(); lfoGain.gain.value = 170;
      sirenLfo.connect(lfoGain); lfoGain.connect(sirenOsc.frequency);
      sirenGain = ctx.createGain(); sirenGain.gain.value = 0.028;
      sirenOsc.connect(sirenGain); sirenGain.connect(master);
      sirenOsc.start(); sirenLfo.start();
    } else if (!active && sirenOsc) {
      const osc = sirenOsc, lfo = sirenLfo; sirenOsc = null; sirenLfo = null;
      try { osc.stop(); lfo.stop(); } catch { /* gone */ }
    }
  } catch { /* silent */ }
}
