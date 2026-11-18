// Port Solano — hud.js
// Everything drawn over the world: cash, the day clock, health, weapon and
// ammo, wanted stars, the bust meter, objective banner and toasts — and the
// LIVE minimap: streets and water from the real city data, with blips for
// the player, police, pedestrians, gunmen and the pulsing mission target.

import { WORLD_SIZE, SEA_Y, WEAPONS, HEAT_DECAY_TIME } from './config.js';
import { G, formatClock } from './state.js';
import { ROAD_LINES } from './city.js';
import { missionTarget } from './missions.js';
import { playerPos } from './player.js';
import { clamp } from './random.js';

const MAP_SIZE = 186;
const MAP_MARGIN = 14;

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(12,16,24,0.62)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.stroke();
}

export function drawHUD(ctx, viewW, viewH) {
  const p = G.player;
  if (!p) return;
  ctx.textBaseline = 'alphabetic';

  // Cash + clock, top-left.
  panel(ctx, 12, 12, 196, 58);
  ctx.fillStyle = '#7be495';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('$' + G.cash.toLocaleString('en-US'), 24, 40);
  ctx.fillStyle = '#e8eef4';
  ctx.font = '600 14px system-ui, sans-serif';
  ctx.fillText('Day ' + G.day + '  ·  ' + formatClock(G.clock), 24, 61);

  // Health bar under the cash panel (or the car's integrity while driving).
  const hpFrac = clamp(p.hp / p.maxHp, 0, 1);
  panel(ctx, 12, 78, 196, 30);
  ctx.fillStyle = '#3a1214';
  ctx.fillRect(20, 88, 180, 10);
  ctx.fillStyle = hpFrac > 0.3 ? '#e74c3c' : '#ff5a4d';
  ctx.fillRect(20, 88, 180 * hpFrac, 10);
  ctx.fillStyle = '#e8eef4';
  ctx.font = '600 11px system-ui, sans-serif';
  if (p.car) {
    const carFrac = clamp(p.car.hp / p.car.maxHp, 0, 1);
    ctx.fillText('REYES ' + Math.ceil(p.hp) + ' HP', 20, 104);
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(110, 88, 90, 10);
    ctx.fillStyle = '#5dade2';
    ctx.fillRect(110, 88, 90 * carFrac, 10);
  } else {
    ctx.fillText('REYES ' + Math.ceil(p.hp) + ' HP', 20, 104);
  }

  // Weapon + ammo, bottom-left.
  const spec = WEAPONS[G.weapon];
  panel(ctx, 12, viewH - 64, 210, 52);
  ctx.fillStyle = '#ffd75e';
  ctx.font = 'bold 19px system-ui, sans-serif';
  ctx.fillText(spec.name.toUpperCase(), 24, viewH - 40);
  ctx.fillStyle = '#e8eef4';
  ctx.font = '600 14px system-ui, sans-serif';
  const ammoText = spec.ammoType ? 'Ammo ' + G.ammo[spec.ammoType] : '—';
  ctx.fillText(ammoText, 24, viewH - 19);
  ctx.fillStyle = 'rgba(232,238,244,0.65)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('1/2/3 or Q to swap', 108, viewH - 19);

  drawWanted(ctx, viewW);
  drawMinimap(ctx, viewW);
  drawBannerAndToasts(ctx, viewW, viewH);
  drawObjective(ctx, viewW, viewH);

  // Bust meter: a red arc of doom under the stars while the law closes in.
  if (G.bust > 0.02) {
    const x = viewW - MAP_MARGIN - MAP_SIZE / 2, y = MAP_MARGIN + MAP_SIZE + 34;
    ctx.fillStyle = 'rgba(12,16,24,0.62)';
    ctx.beginPath(); ctx.arc(x, y, 21, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ff5a4d';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(x, y, 16, -Math.PI / 2, -Math.PI / 2 + G.bust * Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BUST', x, y + 3);
  }

  // Context prompt, bottom-centre.
  const hint = contextHint();
  if (hint) {
    ctx.font = '600 15px system-ui, sans-serif';
    const w = ctx.measureText(hint).width + 30;
    panel(ctx, (viewW - w) / 2, viewH - 46, w, 32);
    ctx.fillStyle = '#ffd75e';
    ctx.textAlign = 'center';
    ctx.fillText(hint, viewW / 2, viewH - 25);
  }
}

function contextHint() {
  const p = G.player;
  if (!p || G.mode !== 'playing') return '';
  if (p.car) return 'E — get out · Space — handbrake';
  if (p.breakIn) return 'Hold E — breaking in…';
  let nearCar = false;
  for (const car of G.cars) if (Math.hypot(car.x - p.x, car.y - p.y) < 46 && !car.wrecked) { nearCar = true; break; }
  if (nearCar) return 'E — enter car (locked cars: hold E)';
  for (const z of G.zones) if (Math.hypot(z.x - p.x, z.y - p.y) < 80) return 'E — ' + z.name;
  return '';
}

function drawWanted(ctx, viewW) {
  const x0 = viewW - MAP_MARGIN - MAP_SIZE;
  const y = MAP_MARGIN + MAP_SIZE + 8;
  ctx.font = '22px system-ui, sans-serif';
  ctx.textAlign = 'left';
  for (let i = 0; i < 5; i++) {
    const active = i < G.wanted;
    const flash = G.seenByCop && active && Math.floor(G.time * 4) % 2 === 0;
    ctx.fillStyle = active ? (flash ? '#ffffff' : '#ffd75e') : 'rgba(255,255,255,0.22)';
    ctx.fillText('★', x0 + 6 + i * 36, y + 22);
  }
  if (G.wanted > 0 && !G.seenByCop) {
    // Heat bar: how close the trail is to going cold.
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x0 + 6, y + 28, 174, 4);
    ctx.fillStyle = '#9fc2ff';
    ctx.fillRect(x0 + 6, y + 28, 174 * clamp(G.heat / HEAT_DECAY_TIME, 0, 1), 4);
  }
}

function drawMinimap(ctx, viewW) {
  const x0 = viewW - MAP_MARGIN - MAP_SIZE;
  const y0 = MAP_MARGIN;
  const scale = MAP_SIZE / WORLD_SIZE;
  ctx.save();
  panel(ctx, x0 - 4, y0 - 4, MAP_SIZE + 8, MAP_SIZE + 8);
  ctx.beginPath(); ctx.rect(x0, y0, MAP_SIZE, MAP_SIZE); ctx.clip();
  ctx.fillStyle = '#a89a7c';
  ctx.fillRect(x0, y0, MAP_SIZE, MAP_SIZE);
  // Water along the south edge.
  ctx.fillStyle = '#2f86a3';
  ctx.fillRect(x0, y0 + SEA_Y * scale, MAP_SIZE, MAP_SIZE - SEA_Y * scale);
  ctx.fillStyle = '#e8cf8d';
  ctx.fillRect(x0, y0 + 3160 * scale, MAP_SIZE, (SEA_Y - 3160) * scale);
  // Streets.
  ctx.strokeStyle = 'rgba(40,40,46,0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const p of ROAD_LINES) {
    ctx.moveTo(x0 + p * scale, y0); ctx.lineTo(x0 + p * scale, y0 + MAP_SIZE);
    ctx.moveTo(x0, y0 + p * scale); ctx.lineTo(x0 + MAP_SIZE, y0 + p * scale);
  }
  ctx.stroke();
  // Zone dots.
  for (const z of G.zones) {
    ctx.fillStyle = '#ffd75e';
    ctx.beginPath(); ctx.arc(x0 + z.x * scale, y0 + z.y * scale, 2.6, 0, Math.PI * 2); ctx.fill();
  }
  const blip = (wx, wy, color, r) => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x0 + wx * scale, y0 + wy * scale, r, 0, Math.PI * 2); ctx.fill();
  };
  for (const ped of G.peds) if (ped.state !== 'down') blip(ped.x, ped.y, 'rgba(240,240,240,0.75)', 1.4);
  for (const g of G.gunmen) if (!g.dead) blip(g.x, g.y, '#ff5a4d', 2.4);
  for (const car of G.cars) if (car.isCop && car.driver === 'cop') blip(car.x, car.y, Math.floor(G.time * 3) % 2 ? '#ff3b30' : '#2e7dff', 2.6);
  for (const o of G.officers) if (!o.dead) blip(o.x, o.y, '#2e7dff', 2.2);
  // Mission target pulses gold.
  const target = missionTarget();
  if (target) {
    const tx = x0 + target.x * scale, ty = y0 + target.y * scale;
    ctx.strokeStyle = '#ffd75e';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(tx, ty, 5 + Math.sin(G.time * 4) * 1.6, 0, Math.PI * 2); ctx.stroke();
  }
  // Player arrow.
  const pos = playerPos();
  if (pos) {
    const px = x0 + pos.x * scale, py = y0 + pos.y * scale;
    const a = G.player.car ? G.player.car.angle : G.player.angle;
    ctx.save();
    ctx.translate(px, py); ctx.rotate(a);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(232,238,244,0.8)';
  ctx.font = '600 10px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('PORT SOLANO', x0 + 2, y0 + MAP_SIZE + 18);
}

function drawBannerAndToasts(ctx, viewW, viewH) {
  if (G.banner) {
    const b = G.banner;
    const alpha = b.t < 0.3 ? b.t / 0.3 : b.t > b.life - 0.5 ? Math.max(0, (b.life - b.t) / 0.5) : 1;
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 21px system-ui, sans-serif';
    const w = Math.max(ctx.measureText(b.title).width, b.sub ? ctx.measureText(b.sub).width * 0.62 : 0) + 56;
    panel(ctx, (viewW - w) / 2, 18, w, b.sub ? 62 : 44);
    ctx.fillStyle = '#ffd75e';
    ctx.textAlign = 'center';
    ctx.fillText(b.title, viewW / 2, 46);
    if (b.sub) {
      ctx.fillStyle = '#e8eef4';
      ctx.font = '13px system-ui, sans-serif';
      const sub = b.sub.length > 74 ? b.sub.slice(0, 74) + '…' : b.sub;
      ctx.fillText(sub, viewW / 2, 67);
    }
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'right';
  ctx.font = '600 14px system-ui, sans-serif';
  let ty = viewH - 90;
  for (let i = G.toasts.length - 1; i >= 0; i--) {
    const t = G.toasts[i];
    ctx.globalAlpha = clamp(1.4 - t.t / t.life, 0, 1);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, viewW - 16, ty);
    ty -= 20;
  }
  ctx.globalAlpha = 1;
}

function drawObjective(ctx, viewW, viewH) {
  const target = missionTarget();
  if (!target || G.mode !== 'playing') return;
  const pos = playerPos();
  if (!pos) return;
  const d = Math.round(Math.hypot(target.x - pos.x, target.y - pos.y));
  ctx.font = '600 14px system-ui, sans-serif';
  const text = '◆ ' + target.label + '  ·  ' + d + 'm';
  const w = ctx.measureText(text).width + 26;
  panel(ctx, 12, 116, w, 30);
  ctx.fillStyle = '#ffd75e';
  ctx.textAlign = 'left';
  ctx.fillText(text, 24, 136);
  // Off-screen direction arrow at the screen edge.
  const sx = target.x - G.camera.x, sy = target.y - G.camera.y;
  if (sx < 0 || sy < 0 || sx > viewW || sy > viewH) {
    const cx = viewW / 2, cy = viewH / 2;
    const a = Math.atan2(sy - cy, sx - cx);
    const ex = cx + Math.cos(a) * (viewW / 2 - 60);
    const ey = cy + Math.sin(a) * (viewH / 2 - 60);
    ctx.save();
    ctx.translate(ex, ey); ctx.rotate(a);
    ctx.fillStyle = '#ffd75e';
    ctx.beginPath();
    ctx.moveTo(14, 0); ctx.lineTo(-8, -8); ctx.lineTo(-8, 8); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}
