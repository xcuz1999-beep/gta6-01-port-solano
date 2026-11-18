// Port Solano — city.js
// Seeded city generation (road grid, city blocks with buildings, beach and
// sea, palm trees, the five named zones), collision queries against that
// geometry, and all world rendering: ground, roads, buildings with a 2.5D
// lift, zones and the marina.

import { WORLD_SIZE, ROAD_SPACING, ROAD_WIDTH, ROAD_ORIGIN, SEA_Y, SAND_Y, ZONE_DEFS } from './config.js';
import { G } from './state.js';
import { clamp } from './random.js';

export const ROAD_LINES = [];
for (let p = ROAD_ORIGIN; p < WORLD_SIZE; p += ROAD_SPACING) ROAD_LINES.push(p);
const HALF_ROAD = ROAD_WIDTH / 2;

const BUILDING_COLORS = ['#e8dcc8', '#d9c6a5', '#cfe0e4', '#e6b8a2', '#b7c9a8', '#f0e6d2', '#d3b8c9', '#a8c3cf', '#ead9b0', '#c9d6c0'];
const ROOF_COLORS = ['#9c6b4f', '#7d8a96', '#a8574a', '#6f7f6a', '#8a7a5c', '#5f7386'];

export function isOnRoad(x, y) {
  for (const p of ROAD_LINES) {
    if (Math.abs(x - p) <= HALF_ROAD || Math.abs(y - p) <= HALF_ROAD) return true;
  }
  return false;
}

export function isSea(x, y) { return y > SEA_Y; }
export function isSand(x, y) { return y > SAND_Y && y <= SEA_Y; }

// Nearest road centreline coordinate to a value, used by AI drivers to find
// the lane network and by spawners to place cars on asphalt.
export function nearestRoadLine(v) {
  let best = ROAD_LINES[0], bd = Infinity;
  for (const p of ROAD_LINES) { const d = Math.abs(v - p); if (d < bd) { bd = d; best = p; } }
  return best;
}

export function generateCity(rng) {
  G.buildings = [];
  G.palms = [];
  G.zones = ZONE_DEFS.map((z) => ({ ...z }));
  // City blocks sit between neighbouring road lines. Each block gets one to
  // four buildings with alleys between them, kept clear of the road edge.
  for (let i = 0; i < ROAD_LINES.length - 1; i++) {
    for (let j = 0; j < ROAD_LINES.length - 1; j++) {
      const x0 = ROAD_LINES[i] + HALF_ROAD + 14, x1 = ROAD_LINES[i + 1] - HALF_ROAD - 14;
      const y0 = ROAD_LINES[j] + HALF_ROAD + 14, y1 = ROAD_LINES[j + 1] - HALF_ROAD - 14;
      if (y0 > SAND_Y - 60) continue; // keep the beachfront open
      const bw = x1 - x0, bh = y1 - y0;
      const cols = rng.chance(0.6) ? 2 : 1;
      const rows = rng.chance(0.6) ? 2 : 1;
      for (let cx = 0; cx < cols; cx++) {
        for (let cy = 0; cy < rows; cy++) {
          if (rng.chance(0.12)) continue; // the odd empty lot / plaza
          const pad = 10;
          const bx = x0 + (bw / cols) * cx + pad;
          const by = y0 + (bh / rows) * cy + pad;
          const w = bw / cols - pad * 2 - rng.range(0, 22);
          const h = bh / rows - pad * 2 - rng.range(0, 22);
          G.buildings.push({
            x: bx, y: by, w, h,
            color: rng.pick(BUILDING_COLORS),
            roof: rng.pick(ROOF_COLORS),
            lift: rng.range(10, 30),
            windows: rng.int(3, 6),
            seed: rng.int(1, 99999),
          });
        }
      }
    }
  }
  // Palms line the beach and dot the southern avenues.
  for (let x = 90; x < WORLD_SIZE - 60; x += rng.range(120, 210)) {
    G.palms.push({ x: x + rng.range(-24, 24), y: SAND_Y + rng.range(26, 120), s: rng.range(0.8, 1.3) });
  }
  for (let i = 0; i < 26; i++) {
    G.palms.push({ x: rng.range(80, WORLD_SIZE - 80), y: rng.range(2300, SAND_Y - 40), s: rng.range(0.7, 1.1) });
  }
}

// Circle-vs-city collision: pushes (x, y) out of every building and the sea,
// and clamps to the world edge. Returns the corrected position.
export function collideCircle(x, y, r) {
  if (y > SEA_Y - r) y = SEA_Y - r;
  x = clamp(x, r, WORLD_SIZE - r);
  y = clamp(y, r, WORLD_SIZE - r);
  for (const b of G.buildings) {
    const nx = clamp(x, b.x, b.x + b.w);
    const ny = clamp(y, b.y, b.y + b.h);
    const dx = x - nx, dy = y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * r; y = ny + (dy / d) * r;
      } else {
        // Centre inside the rect: push out along the smallest penetration.
        const left = x - b.x, right = b.x + b.w - x, top = y - b.y, bot = b.y + b.h - y;
        const m = Math.min(left, right, top, bot);
        if (m === left) x = b.x - r; else if (m === right) x = b.x + b.w + r;
        else if (m === top) y = b.y - r; else y = b.y + b.h + r;
      }
    }
  }
  return { x, y };
}

export function pointInBuilding(x, y, pad = 0) {
  for (const b of G.buildings) {
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
  }
  return null;
}

// Line-of-sight between two points, sampled against buildings. Used for
// gunfire and for whether a cop can currently see the player.
export function hasLineOfSight(x1, y1, x2, y2) {
  const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 26);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (pointInBuilding(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, -2)) return false;
  }
  return true;
}

export function zoneAt(x, y, extra = 26) {
  for (const z of G.zones) {
    if (Math.hypot(x - z.x, y - z.y) < 54 + extra) return z;
  }
  return null;
}

// ---------------------------------------------------------------- rendering
export function drawCity(ctx, camX, camY, viewW, viewH, litFactor) {
  // Base ground: warm pavement-grass of a sun-baked coastal city.
  ctx.fillStyle = '#b9ac8d';
  ctx.fillRect(0, 0, viewW, viewH);
  const wx0 = camX, wy0 = camY, wx1 = camX + viewW, wy1 = camY + viewH;

  // Beach sand and sea (south edge of the world).
  if (wy1 > SAND_Y) {
    ctx.fillStyle = '#ecd28f';
    ctx.fillRect(0, Math.max(0, SAND_Y - wy0), viewW, Math.min(viewH, SEA_Y - Math.max(wy0, SAND_Y) + 1));
    const seaTop = Math.max(0, SEA_Y - wy0);
    const grad = ctx.createLinearGradient(0, seaTop, 0, viewH);
    grad.addColorStop(0, '#3fa7c4');
    grad.addColorStop(1, '#1d6f8e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, seaTop, viewW, viewH - seaTop);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = Math.floor(wx0 / 90) * 90; x < wx1; x += 90) {
      const yy = SEA_Y + 46 + Math.sin((x + G.time * 30) * 0.02) * 6 - wy0;
      if (yy > 0 && yy < viewH) { ctx.moveTo(x - wx0, yy); ctx.lineTo(x - wx0 + 44, yy); }
    }
    ctx.stroke();
  }

  // Roads: asphalt strips with sidewalks and dashed centre lines.
  ctx.fillStyle = '#8f8a80';
  for (const p of ROAD_LINES) {
    if (p + HALF_ROAD + 10 > wx0 && p - HALF_ROAD - 10 < wx1) ctx.fillRect(p - HALF_ROAD - 10 - wx0, 0, ROAD_WIDTH + 20, viewH);
    if (p + HALF_ROAD + 10 > wy0 && p - HALF_ROAD - 10 < wy1) ctx.fillRect(0, p - HALF_ROAD - 10 - wy0, viewW, ROAD_WIDTH + 20);
  }
  ctx.fillStyle = '#4c4c52';
  for (const p of ROAD_LINES) {
    if (p + HALF_ROAD > wx0 && p - HALF_ROAD < wx1) ctx.fillRect(p - HALF_ROAD - wx0, 0, ROAD_WIDTH, viewH);
    if (p + HALF_ROAD > wy0 && p - HALF_ROAD < wy1) ctx.fillRect(0, p - HALF_ROAD - wy0, viewW, ROAD_WIDTH);
  }
  ctx.strokeStyle = 'rgba(245,220,120,0.75)';
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  ctx.beginPath();
  for (const p of ROAD_LINES) {
    if (p > wx0 && p < wx1) { ctx.moveTo(p - wx0, 0); ctx.lineTo(p - wx0, viewH); }
    if (p > wy0 && p < wy1) { ctx.moveTo(0, p - wy0); ctx.lineTo(viewW, p - wy0); }
  }
  ctx.stroke();
  ctx.setLineDash([]);

  drawMarina(ctx, wx0, wy0);

  // Buildings with a 2.5D lift: a dropped shadow, walls, then the roof.
  for (const b of G.buildings) {
    if (b.x + b.w < wx0 || b.x > wx1 || b.y + b.h < wy0 || b.y > wy1) continue;
    const sx = b.x - wx0, sy = b.y - wy0;
    ctx.fillStyle = 'rgba(60,45,25,0.30)';
    ctx.fillRect(sx + 7, sy + 9, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(sx, sy - b.lift, b.w, b.h + b.lift);
    ctx.fillStyle = b.roof;
    ctx.fillRect(sx, sy - b.lift, b.w, b.h);
    ctx.strokeStyle = 'rgba(70,55,35,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx, sy - b.lift, b.w, b.h);
    // Windows: lit warm at night, glassy blue by day.
    const cols = b.windows, rows = Math.max(2, Math.floor(b.h / 34));
    ctx.fillStyle = litFactor > 0.35 ? 'rgba(255,196,92,0.9)' : 'rgba(90,130,160,0.55)';
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if (((b.seed + i * 7 + j * 13) % 5) === 0) continue;
        ctx.fillRect(sx + 8 + i * ((b.w - 14) / cols), sy - b.lift + 8 + j * ((b.h - 14) / rows), 7, 9);
      }
    }
  }

  // Palms: trunk plus a fan of fronds.
  for (const p of G.palms) {
    const sx = p.x - wx0, sy = p.y - wy0;
    if (sx < -40 || sy < -40 || sx > viewW + 40 || sy > viewH + 40) continue;
    ctx.strokeStyle = '#7a5c38';
    ctx.lineWidth = 4 * p.s;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 4, sy - 16 * p.s); ctx.stroke();
    ctx.strokeStyle = '#3e8e4f';
    ctx.lineWidth = 3 * p.s;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.moveTo(sx + 4, sy - 16 * p.s);
      ctx.quadraticCurveTo(sx + 4 + Math.cos(a) * 13 * p.s, sy - 16 * p.s + Math.sin(a) * 8 * p.s - 4, sx + 4 + Math.cos(a) * 19 * p.s, sy - 16 * p.s + Math.sin(a) * 12 * p.s + 3);
      ctx.stroke();
    }
  }

  // Zone markers on the ground: a soft ring and the place's initial.
  for (const z of G.zones) {
    const sx = z.x - wx0, sy = z.y - wy0;
    if (sx < -80 || sy < -80 || sx > viewW + 80 || sy > viewH + 80) continue;
    const pulse = 1 + Math.sin(G.time * 3) * 0.08;
    ctx.strokeStyle = 'rgba(255,215,94,0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(sx, sy, 30 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(20,20,26,0.55)';
    ctx.beginPath(); ctx.arc(sx, sy, 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd75e';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(z.short[0], sx, sy + 1);
  }
}

function drawMarina(ctx, wx0, wy0) {
  // Wooden piers reaching into the sea near Marina Azul.
  const marina = G.zones.find((z) => z.id === 'marina');
  if (!marina) return;
  ctx.fillStyle = '#8a6844';
  for (let i = -1; i <= 1; i++) {
    const px = marina.x + i * 130 - wx0;
    if (px < -60 || px > 1400) continue;
    ctx.fillRect(px - 9, SEA_Y - wy0 - 6, 18, 150);
    // Moored boats.
    ctx.fillStyle = '#e8e4da';
    ctx.beginPath();
    ctx.ellipse(px + 26, SEA_Y - wy0 + 66, 11, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b03a2e';
    ctx.beginPath();
    ctx.ellipse(px - 26, SEA_Y - wy0 + 96, 10, 19, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8a6844';
  }
}
