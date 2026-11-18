// Port Solano — pedestrians.js
// Sidewalk life: citizens stroll along the pavement edges, panic and flee
// from gunfire, speeding cars and violence, can be knocked down (a crime,
// and they remember it), and — crucially — witness crimes and file the
// reports the police module acts on.

import { ROAD_WIDTH, WITNESS_RADIUS } from './config.js';
import { G } from './state.js';
import { ROAD_LINES, collideCircle } from './city.js';
import { clamp, angleLerp } from './random.js';
import { bloodPuff } from './effects.js';
import { sfx } from './audio.js';

const PED_COUNT = 42;
const SHIRT_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#e67e22', '#9b59b6', '#ecf0f1', '#fd79a8', '#00b894', '#fdcb6e'];
const SKIN_TONES = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];

export function spawnPeds(rng) {
  G.peds = [];
  for (let i = 0; i < PED_COUNT; i++) {
    const vertical = rng.chance(0.5);
    const line = rng.pick(ROAD_LINES);
    const side = rng.sign();
    const offset = ROAD_WIDTH / 2 + 13;
    const along = rng.range(100, 3400);
    const x = vertical ? line + side * offset : along;
    const y = vertical ? along : line + side * offset;
    if (y > 3120) { i--; continue; }
    G.peds.push({
      x, y, r: 9, angle: rng.range(0, Math.PI * 2),
      speed: rng.range(52, 84), walkPhase: rng.range(0, 6),
      shirt: rng.pick(SHIRT_COLORS), skin: rng.pick(SKIN_TONES),
      state: 'walk',           // walk | flee | down
      panicT: 0, downT: 0, wanderT: rng.range(1, 5),
      targetAngle: 0, reportCooldown: 0,
      vertical, line, side,
    });
  }
}

// Something scary happened at (x, y): nearby peds run from it.
export function scarePeds(x, y, radius = 190) {
  for (const ped of G.peds) {
    if (ped.state === 'down') continue;
    if (Math.hypot(ped.x - x, ped.y - y) < radius) {
      ped.state = 'flee';
      ped.panicT = Math.max(ped.panicT, 2.6);
      ped.targetAngle = Math.atan2(ped.y - y, ped.x - x);
    }
  }
}

// A crime happened. Any conscious ped with a view of it becomes a witness:
// after a short shocked delay they file a report the police will answer.
export function witnessCrime(kind, x, y, severity) {
  let witnessed = false;
  for (const ped of G.peds) {
    if (ped.state === 'down') continue;
    if (Math.hypot(ped.x - x, ped.y - y) <= WITNESS_RADIUS) {
      witnessed = true;
      if (ped.reportCooldown <= 0) {
        ped.reportCooldown = 6;
        G.reports.push({ kind, x, y, severity, delay: 0.9 });
      }
      ped.state = 'flee';
      ped.panicT = Math.max(ped.panicT, 2.2);
      ped.targetAngle = Math.atan2(ped.y - y, ped.x - x);
    }
  }
  return witnessed;
}

export function knockDownPed(ped, byPlayerAction) {
  if (ped.state === 'down') return;
  ped.state = 'down';
  ped.downT = 7;
  bloodPuff(ped.x, ped.y);
  sfx('hit');
  if (byPlayerAction) {
    G.stats.knockdowns++;
    if (G.commitCrime) G.commitCrime('hitped', ped.x, ped.y);
  }
}

export function updatePeds(dt) {
  const p = G.player;
  for (const ped of G.peds) {
    ped.reportCooldown -= dt;
    ped.walkPhase += dt * (ped.state === 'flee' ? 13 : 8);
    if (ped.state === 'down') {
      ped.downT -= dt;
      if (ped.downT <= 0) { ped.state = 'flee'; ped.panicT = 2; ped.targetAngle = G.fxRng.range(0, Math.PI * 2); }
      continue;
    }

    // A fast car bearing down on a pedestrian scares them off the road.
    if (p && p.car && Math.hypot(p.car.x - ped.x, p.car.y - ped.y) < 90 && Math.hypot(p.car.vx, p.car.vy) > 120) {
      ped.state = 'flee'; ped.panicT = Math.max(ped.panicT, 1.4);
      ped.targetAngle = Math.atan2(ped.y - p.car.y, ped.x - p.car.x);
    }
    // Cars (any) can knock a pedestrian down.
    for (const car of G.cars) {
      const speed = Math.hypot(car.vx, car.vy);
      if (speed > 55 && Math.hypot(car.x - ped.x, car.y - ped.y) < 26) {
        knockDownPed(ped, car.driver === 'player');
        break;
      }
    }
    if (ped.state === 'down') continue;

    let speed = ped.speed;
    if (ped.state === 'flee') {
      speed = 178;
      ped.panicT -= dt;
      ped.angle = angleLerp(ped.angle, ped.targetAngle, dt * 8);
      if (ped.panicT <= 0) ped.state = 'walk';
    } else {
      // Stroll along the pavement: follow the road edge, drift at junctions.
      ped.wanderT -= dt;
      if (ped.wanderT <= 0) {
        ped.wanderT = G.fxRng.range(2, 6);
        if (G.fxRng.chance(0.4)) ped.targetAngle = ped.angle + Math.PI; // turn back
        else {
          const base = ped.vertical ? Math.PI / 2 : 0;
          ped.targetAngle = base + (G.fxRng.chance(0.5) ? 0 : Math.PI);
        }
      }
      ped.angle = angleLerp(ped.angle, ped.targetAngle || ped.angle, dt * 3);
    }
    const nx = ped.x + Math.cos(ped.angle) * speed * dt;
    const ny = ped.y + Math.sin(ped.angle) * speed * dt;
    const fixed = collideCircle(nx, ny, ped.r);
    if (fixed.x !== nx || fixed.y !== ny) ped.targetAngle = ped.angle + Math.PI * 0.7;
    ped.x = clamp(fixed.x, 12, 3588);
    ped.y = clamp(fixed.y, 12, 3408);
  }
  // Keep peds loosely near the player so the streets never feel empty.
  if (p) {
    for (const ped of G.peds) {
      if (Math.hypot(ped.x - p.x, ped.y - p.y) > 1400 && ped.state !== 'down') {
        const line = G.fxRng.pick(ROAD_LINES);
        const vertical = G.fxRng.chance(0.5);
        const along = clamp((vertical ? p.y : p.x) + G.fxRng.range(-600, 600), 120, 3350);
        const offset = ROAD_WIDTH / 2 + 13;
        ped.x = vertical ? line + G.fxRng.sign() * offset : along;
        ped.y = vertical ? along : line + G.fxRng.sign() * offset;
        if (ped.y > 3120) ped.y = 2900;
      }
    }
  }
}

export function drawPed(ctx, ped, camX, camY) {
  const sx = ped.x - camX, sy = ped.y - camY;
  ctx.save();
  ctx.translate(sx, sy);
  if (ped.state === 'down') {
    ctx.rotate(ped.angle + Math.PI / 2);
    ctx.fillStyle = 'rgba(30,25,15,0.3)';
    ctx.fillRect(-12, 3, 24, 7);
    ctx.fillStyle = ped.shirt;
    ctx.fillRect(-11, -4, 15, 8);
    ctx.fillStyle = ped.skin;
    ctx.beginPath(); ctx.arc(8, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  const bob = Math.sin(ped.walkPhase) * 1.6;
  ctx.fillStyle = 'rgba(30,25,15,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 5, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(ped.angle);
  // Legs scissor while walking.
  ctx.fillStyle = '#2d3436';
  ctx.fillRect(-2 + bob, -5, 5, 3.4);
  ctx.fillRect(-2 - bob, 1.6, 5, 3.4);
  // Torso and head.
  ctx.fillStyle = ped.shirt;
  ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ped.skin;
  ctx.beginPath(); ctx.arc(1.5, 0, 4.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (ped.state === 'flee') {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', sx, sy - 14);
  }
}
