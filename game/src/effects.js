// Port Solano — effects.js
// Juice: particles, floating text, skid marks and the day/night tint that
// washes over the world as the game clock turns.

import { G } from "./state.js";

export function burst(x, y, n, color) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 30 + Math.random() * 130;
    G.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.35 + Math.random() * 0.4, max: 0.75, color, size: 2 + Math.random() * 3 });
  }
  if (G.particles.length > 500) G.particles.splice(0, G.particles.length - 500);
}

export function floater(x, y, text, color = "#ffe27a") {
  G.floaters.push({ x, y, text, color, life: 1.3 });
}

export function updateEffects(dt) {
  for (const p of G.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; p.life -= dt; }
  G.particles = G.particles.filter((p) => p.life > 0);
  for (const f of G.floaters) { f.y -= 26 * dt; f.life -= dt; }
  G.floaters = G.floaters.filter((f) => f.life > 0);
  for (const s of G.skids) s.life -= dt;
  G.skids = G.skids.filter((s) => s.life > 0);
  G.shake = Math.max(0, G.shake - dt * 16);
}

export function drawEffects(ctx) {
  ctx.fillStyle = "rgba(20,20,24,0.35)";
  for (const s of G.skids) ctx.fillRect(s.x - 3, s.y - 2, 6, 4);
  for (const p of G.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  ctx.font = "bold 14px sans-serif"; ctx.textAlign = "center";
  for (const f of G.floaters) { ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y); }
}

export function nightTint(clock) {
  // clock 0..1: dawn 0.25, noon 0.5, dusk 0.78, midnight 0
  const day = Math.max(0, Math.sin((clock - 0.22) * Math.PI / 0.62));
  return 1 - Math.min(1, Math.max(0, day));
}

export function drawTint(ctx, w, h, clock) {
  const n = nightTint(clock);
  if (n > 0.55) { ctx.fillStyle = `rgba(16,20,52,${(n - 0.55) * 0.55})`; ctx.fillRect(0, 0, w, h); }
  else if (clock > 0.68 && clock < 0.86) { ctx.fillStyle = "rgba(255,140,60,0.10)"; ctx.fillRect(0, 0, w, h); }
}
