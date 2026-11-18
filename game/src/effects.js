// Port Solano — effects.js
// Juice: particles, skid marks, floating texts, screen shake and the
// day/night tint. Purely cosmetic — nothing here can change gameplay state,
// which keeps the deterministic scenes stable.

import { G } from './state.js';
import { clamp } from './random.js';

export function addShake(amount) { G.shake = Math.min(22, G.shake + amount); }

export function burst(x, y, opts = {}) {
  const n = opts.n || 10;
  const color = opts.color || '#ffd75e';
  const speed = opts.speed || 160;
  const life = opts.life || 0.5;
  const size = opts.size || 3;
  for (let i = 0; i < n; i++) {
    const a = G.fxRng.float() * Math.PI * 2;
    const s = speed * (0.3 + G.fxRng.float() * 0.9);
    G.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      t: 0, life: life * (0.6 + G.fxRng.float() * 0.7), color, size: size * (0.6 + G.fxRng.float() * 0.8),
      gravity: opts.gravity || 0, drag: opts.drag || 2.2,
    });
  }
  if (G.particles.length > 700) G.particles.splice(0, G.particles.length - 700);
}

export function sparks(x, y) { burst(x, y, { n: 9, color: '#ffb347', speed: 230, life: 0.32, size: 2.4 }); }
export function smokePuff(x, y, dark = false) {
  G.particles.push({
    x: x + (G.fxRng.float() - 0.5) * 8, y: y + (G.fxRng.float() - 0.5) * 8,
    vx: (G.fxRng.float() - 0.5) * 22, vy: -28 - G.fxRng.float() * 22,
    t: 0, life: 1.15, color: dark ? 'rgba(40,40,44,0.5)' : 'rgba(210,210,210,0.45)', size: 8 + G.fxRng.float() * 7,
    gravity: -12, drag: 0.6,
  });
}
export function bloodPuff(x, y) { burst(x, y, { n: 7, color: '#b03030', speed: 120, life: 0.4, size: 2.8 }); }
export function muzzle(x, y, angle) {
  G.particles.push({
    x: x + Math.cos(angle) * 16, y: y + Math.sin(angle) * 16,
    vx: Math.cos(angle) * 60, vy: Math.sin(angle) * 60,
    t: 0, life: 0.07, color: '#ffe9a3', size: 6, gravity: 0, drag: 0,
  });
}
export function cashSparkle(x, y) { burst(x, y, { n: 12, color: '#7be495', speed: 120, life: 0.6, size: 2.6 }); }

export function addSkid(x, y, angle) {
  G.skids.push({ x, y, angle, t: 0, life: 7 });
  if (G.skids.length > 420) G.skids.shift();
}

export function updateEffects(dt) {
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const p = G.particles[i];
    p.t += dt;
    if (p.t >= p.life) { G.particles.splice(i, 1); continue; }
    p.vy += (p.gravity || 0) * dt;
    const dragK = Math.max(0, 1 - (p.drag || 0) * dt);
    p.vx *= dragK; p.vy *= dragK;
    p.x += p.vx * dt; p.y += p.vy * dt;
  }
  for (let i = G.skids.length - 1; i >= 0; i--) {
    G.skids[i].t += dt;
    if (G.skids[i].t >= G.skids[i].life) G.skids.splice(i, 1);
  }
  for (let i = G.texts.length - 1; i >= 0; i--) {
    const t = G.texts[i];
    t.t += dt; t.y -= 34 * dt;
    if (t.t >= t.life) G.texts.splice(i, 1);
  }
  for (let i = G.toasts.length - 1; i >= 0; i--) {
    G.toasts[i].t += dt;
    if (G.toasts[i].t >= G.toasts[i].life) G.toasts.splice(i, 1);
  }
  if (G.banner) { G.banner.t += dt; if (G.banner.t >= G.banner.life) G.banner = null; }
  G.shake = Math.max(0, G.shake - dt * 34);
}

export function drawEffects(ctx, camX, camY, viewW, viewH) {
  // Skid marks lie under everything else.
  ctx.fillStyle = 'rgba(25,25,28,0.5)';
  for (const s of G.skids) {
    const sx = s.x - camX, sy = s.y - camY;
    if (sx < -10 || sy < -10 || sx > viewW + 10 || sy > viewH + 10) continue;
    ctx.save();
    ctx.translate(sx, sy); ctx.rotate(s.angle);
    ctx.globalAlpha = 0.5 * (1 - s.t / s.life);
    ctx.fillRect(-5, -2, 10, 4);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  for (const p of G.particles) {
    const sx = p.x - camX, sy = p.y - camY;
    if (sx < -16 || sy < -16 || sx > viewW + 16 || sy > viewH + 16) continue;
    ctx.globalAlpha = clamp(1 - p.t / p.life, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(sx, sy, p.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const t of G.texts) {
    const sx = t.x - camX, sy = t.y - camY;
    ctx.globalAlpha = clamp(1 - t.t / t.life, 0, 1);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, sx, sy);
  }
  ctx.globalAlpha = 1;
}

// 0 at noon, 1 at deep night. Drives the blue tint and lit windows.
export function nightFactor() {
  const m = G.clock;
  if (m < 300) return 1;
  if (m < 420) return 1 - (m - 300) / 120;         // dawn
  if (m < 1080) return 0;                          // day
  if (m < 1200) return (m - 1080) / 120 * 0.55;    // golden dusk
  if (m < 1320) return 0.55 + (m - 1200) / 120 * 0.45; // into night
  return 1;
}

export function drawDayTint(ctx, viewW, viewH) {
  const n = nightFactor();
  if (n > 0.02) {
    ctx.fillStyle = `rgba(16,24,64,${(n * 0.42).toFixed(3)})`;
    ctx.fillRect(0, 0, viewW, viewH);
  } else if (G.clock > 1020 && G.clock < 1200) {
    ctx.fillStyle = 'rgba(255,140,50,0.10)';
    ctx.fillRect(0, 0, viewW, viewH);
  }
}
