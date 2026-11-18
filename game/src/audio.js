// Port Solano — audio.js
// Procedural WebAudio: no audio files. Short oscillator/noise bursts for
// shots, hits and pickups, plus looping engine and siren nodes while the
// player drives or the police close in. M toggles mute.

import { G } from "./state.js";

let ctx = null;
let engineOsc = null, engineGain = null;
let sirenOsc = null, sirenGain = null;

// Car radio: two procedural stations driven by a lookahead step
// sequencer. It only sounds while the player sits in a car.
export const STATION_NAMES = ["Radio off", "Solana FM", "Radio Puerto"];
let seqStep = 0;
let seqNext = 0;

function noteAt(midi, time, dur, type, vol) {
  const freq = 440 * Math.pow(2, (midi - 69) / 12);
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, time);
  g.gain.linearRampToValueAtTime(vol, time + 0.012);
  g.gain.exponentialRampToValueAtTime(0.001, time + dur);
  o.connect(g).connect(ctx.destination); o.start(time); o.stop(time + dur + 0.03);
}

// One 8th-note step of the selected station, scheduled at ctx time `t`.
function scheduleRadioStep(step, t) {
  const bar = Math.floor(step / 8) % 4;
  const pos = step % 8;
  if (G.radio === 1) {
    // Solana FM — A-minor synthwave: [A, A, F, G] bass roots, cycling arp.
    const roots = [33, 33, 29, 31]; // A1 A1 F1 G1
    if (pos === 0) noteAt(roots[bar], t, 0.24, "triangle", 0.05);
    if (pos === 4) noteAt(roots[bar] + 12, t, 0.2, "triangle", 0.042);
    const arp = [57, 60, 64, 69, 64, 60]; // A3 C4 E4 A4 E4 C4
    noteAt(arp[step % arp.length], t, 0.17, "square", 0.026);
  } else if (G.radio === 2) {
    // Radio Puerto — C-major pentatonic pluck over a C–G–Am–F bass.
    const roots = [36, 43, 45, 41]; // C2 G2 A2 F2
    if (pos === 0) noteAt(roots[bar], t, 0.26, "sine", 0.05);
    if (pos === 4) noteAt(roots[bar], t, 0.2, "sine", 0.036);
    const melody = [72, 76, 79, 76, 74, 72, 69, 72]; // C5 E5 G5 E5 D5 C5 A4 C5
    noteAt(melody[step % melody.length], t, 0.19, "triangle", 0.044);
  }
}

function updateRadio() {
  const on = !G.muted && G.player && G.player.car && G.radio > 0;
  if (!on) { seqNext = 0; return; }
  const now = ctx.currentTime;
  if (!seqNext || seqNext < now) { seqStep = 0; seqNext = now + 0.05; }
  const stepDur = 60 / 116 / 2; // 8th notes at ~116 BPM
  while (seqNext < now + 0.15) {
    scheduleRadioStep(seqStep, seqNext);
    seqStep++;
    seqNext += stepDur;
  }
}

export function ensureAudio() {
  if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    engineOsc = ctx.createOscillator(); engineOsc.type = "sawtooth"; engineOsc.frequency.value = 55;
    engineGain = ctx.createGain(); engineGain.gain.value = 0;
    engineOsc.connect(engineGain).connect(ctx.destination); engineOsc.start();
    sirenOsc = ctx.createOscillator(); sirenOsc.type = "triangle"; sirenOsc.frequency.value = 700;
    sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain).connect(ctx.destination); sirenOsc.start();
  } catch { ctx = null; }
}

function blip(freq, dur, type = "square", vol = 0.12, slide = 0) {
  if (!ctx || G.muted) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), ctx.currentTime + dur);
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + dur);
}

function noiseBurst(dur, vol = 0.2) {
  if (!ctx || G.muted) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const g = ctx.createGain(); g.gain.value = vol;
  src.connect(g).connect(ctx.destination); src.start();
}

export const sfx = {
  shot() { noiseBurst(0.09, 0.22); blip(180, 0.07, "square", 0.1, -120); },
  punch() { noiseBurst(0.05, 0.14); },
  hit() { blip(120, 0.08, "sawtooth", 0.12, -60); },
  pickup() { blip(660, 0.09, "sine", 0.14); setTimeout(() => blip(990, 0.12, "sine", 0.14), 70); },
  cash() { blip(880, 0.08, "triangle", 0.15); setTimeout(() => blip(1320, 0.14, "triangle", 0.15), 80); },
  alarm() { blip(520, 0.16, "square", 0.1); },
  ui() { blip(440, 0.05, "sine", 0.08); },
  stinger(win) { blip(win ? 523 : 220, 0.16, "triangle", 0.16); setTimeout(() => blip(win ? 784 : 165, 0.24, "triangle", 0.16), 130); },
};

export function updateAudio(speedRatio, policeNear) {
  if (!ctx) return;
  const t = ctx.currentTime;
  if (engineGain) engineGain.gain.setTargetAtTime(G.muted ? 0 : (G.player && G.player.car ? 0.035 + speedRatio * 0.05 : 0), t, 0.1);
  if (engineOsc && G.player && G.player.car) engineOsc.frequency.setTargetAtTime(55 + speedRatio * 130, t, 0.1);
  if (sirenGain) sirenGain.gain.setTargetAtTime(G.muted ? 0 : (policeNear ? 0.02 : 0), t, 0.2);
  if (sirenOsc) sirenOsc.frequency.setTargetAtTime(650 + Math.sin(t * 5) * 160, t, 0.05);
  updateRadio();
}
