// Port Solano — police.js
// The wanted system. Crimes only count when witnessed (a pedestrian, an
// officer, or a camera of circumstance at very close range). Reports raise
// the star level; patrol cars spawn off-screen and pursue; at three stars
// officers get out and shoot; staying unseen drains heat until a star drops.
// Box the player in — or corner them on foot — and the bust meter fills.

import { COP_SPAWN_DISTANCE, HEAT_DECAY_TIME } from './config.js';
import { G } from './state.js';
import { hasLineOfSight, collideCircle } from './city.js';
import { makeCar, stepCar, carSpeed } from './vehicles.js';
import { clamp, angleDelta } from './random.js';
import { witnessCrime } from './pedestrians.js';
import { sfx } from './audio.js';

const SEVERITY = { assault: 1, gunshot: 2, theft: 2, hitped: 3, copdown: 4, crash: 1 };

// Called for every crime the player commits. Witnesses decide whether the
// law hears about it; unwitnessed crime is free crime.
export function commitCrime(kind, x, y) {
  const severity = SEVERITY[kind] || 1;
  const byPed = witnessCrime(kind, x, y, severity);
  let byCop = false;
  for (const car of G.cars) {
    if (car.isCop && car.driver === 'cop' && Math.hypot(car.x - x, car.y - y) < 330) byCop = true;
  }
  for (const o of G.officers) {
    if (!o.dead && Math.hypot(o.x - x, o.y - y) < 300) byCop = true;
  }
  if (byCop) applyWanted(severity);
  else if (!byPed && severity >= 3 && Math.hypot(G.player.x - x, G.player.y - y) < 60) {
    // Extremely public violence is noticed even without a named witness.
    G.reports.push({ kind, x, y, severity: severity - 1, delay: 1.6 });
  }
}

export function applyWanted(level) {
  const next = clamp(Math.max(G.wanted, level), 0, 5);
  if (next > G.wanted) { G.wanted = next; G.heat = 0; }
}

export function clearWanted() {
  G.wanted = 0; G.heat = 0; G.bust = 0;
  for (let i = G.cars.length - 1; i >= 0; i--) {
    if (G.cars[i].isCop) G.cars.splice(i, 1);
  }
  G.officers = [];
}

function desiredCopCars() {
  return [0, 1, 2, 3, 4, 5][G.wanted] || 0;
}

function spawnCopCar() {
  const p = G.player;
  const a = G.fxRng.range(0, Math.PI * 2);
  const x = clamp(p.x + Math.cos(a) * COP_SPAWN_DISTANCE, 80, 3520);
  const y = clamp(p.y + Math.sin(a) * COP_SPAWN_DISTANCE, 80, 3350);
  const car = makeCar(x, y, a + Math.PI, 'cop', { isCop: true, driver: 'cop' });
  return car;
}

function spawnOfficer(x, y) {
  G.officers.push({
    x, y, r: 10, angle: 0, hp: 80, maxHp: 80, dead: false,
    cooldown: G.fxRng.range(0.4, 1.1), walkPhase: 0, flashT: 0, fadeT: 0,
  });
}

export function updatePolice(dt) {
  const p = G.player;
  if (!p) return;
  // Deliver witness reports.
  for (let i = G.reports.length - 1; i >= 0; i--) {
    const r = G.reports[i];
    r.delay -= dt;
    if (r.delay <= 0) { applyWanted(r.severity); G.reports.splice(i, 1); }
  }

  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;

  // Visibility: any live cop unit with line of sight counts as seeing us.
  let seen = false;
  for (const car of G.cars) {
    if (car.isCop && car.driver === 'cop' && !car.wrecked && Math.hypot(car.x - px, car.y - py) < 560 && hasLineOfSight(car.x, car.y, px, py)) seen = true;
  }
  for (const o of G.officers) {
    if (!o.dead && Math.hypot(o.x - px, o.y - py) < 430 && hasLineOfSight(o.x, o.y, px, py)) seen = true;
  }
  G.seenByCop = seen;

  // Heat: unseen time erodes the wanted level, one star at a time.
  if (G.wanted > 0) {
    if (seen) G.heat = 0;
    else {
      G.heat += dt;
      if (G.heat >= HEAT_DECAY_TIME) {
        G.wanted -= 1;
        G.heat = 0;
        if (G.wanted <= 0) { G.wanted = 0; }
      }
    }
  }

  // Spawn and retire patrol cars to match the star level.
  const cops = G.cars.filter((c) => c.isCop && c.driver === 'cop');
  if (G.wanted > 0 && cops.length < desiredCopCars()) {
    if (G.fxRng.chance(dt * 1.4)) spawnCopCar();
  }
  for (const car of cops) {
    const d = Math.hypot(car.x - px, car.y - py);
    if (G.wanted === 0 && d > 500) { car.driver = null; car.isCop = false; car.color = '#5d6d7e'; }
    if (d > 1700) { car.x = clamp(px + G.fxRng.range(-650, 650), 80, 3520); car.y = clamp(py + G.fxRng.range(-650, 650), 80, 3350); car.vx = 0; car.vy = 0; }
  }

  // Pursuit driving: aim at a point just ahead of the player's motion; ram
  // when close. At 3+ stars some units stop and deploy foot officers.
  for (const car of cops) {
    if (car.wrecked) continue;
    const pvx = p.car ? p.car.vx : 0, pvy = p.car ? p.car.vy : 0;
    const tx = px + pvx * 0.35, ty = py + pvy * 0.35;
    const desired = Math.atan2(ty - car.y, tx - car.x);
    const steer = clamp(angleDelta(car.angle, desired) * 2.6, -1, 1);
    const d = Math.hypot(tx - car.x, ty - car.y);
    let throttle = 1;
    if (d < 60) throttle = 0.25;
    if (d > 420) throttle = 1;
    stepCar(car, throttle, steer, false, dt);
    // Deploy officers when stopped near the player at high heat.
    if (G.wanted >= 3 && d < 190 && carSpeed(car) < 40 && G.officers.filter((o) => !o.dead).length < G.wanted && G.fxRng.chance(dt * 0.7)) {
      spawnOfficer(car.x + 18, car.y + 10);
    }
    if (car.alarmT > 0) car.alarmT -= dt;
  }

  updateOfficers(dt, px, py);

  // Bust meter: boxed in while driving slowly, or cornered on foot.
  let bustPressure = 0;
  if (G.wanted > 0 && !p.dead) {
    if (p.car) {
      if (carSpeed(p.car) < 26) {
        for (const car of cops) if (Math.hypot(car.x - px, car.y - py) < 95) bustPressure += 0.5;
      }
    } else {
      for (const o of G.officers) if (!o.dead && Math.hypot(o.x - px, o.y - py) < 60) bustPressure += 0.45;
      for (const car of cops) if (Math.hypot(car.x - px, car.y - py) < 70) bustPressure += 0.3;
    }
  }
  if (bustPressure > 0) G.bust = clamp(G.bust + dt * 0.5 * bustPressure, 0, 1);
  else G.bust = clamp(G.bust - dt * 0.7, 0, 1);
  if (G.bust >= 1 && G.mode === 'playing') {
    G.mode = 'busted';
    sfx('fail');
  }
}

function updateOfficers(dt, px, py) {
  const p = G.player;
  for (const o of G.officers) {
    if (o.dead) { o.fadeT += dt; continue; }
    o.flashT = Math.max(0, o.flashT - dt);
    o.cooldown -= dt;
    o.walkPhase += dt * 9;
    const d = Math.hypot(px - o.x, py - o.y);
    const toPlayer = Math.atan2(py - o.y, px - o.x);
    o.angle = toPlayer;
    // Officers close to mid-range, then hold and fire at 3+ stars.
    if (d > 150 || G.wanted < 3) {
      const fixed = collideCircle(o.x + Math.cos(toPlayer) * 128 * dt, o.y + Math.sin(toPlayer) * 128 * dt, o.r);
      o.x = fixed.x; o.y = fixed.y;
    }
    if (G.wanted >= 3 && d < 400 && o.cooldown <= 0 && hasLineOfSight(o.x, o.y, px, py)) {
      o.cooldown = G.fxRng.range(0.8, 1.4);
      const a = toPlayer + (G.fxRng.float() - 0.5) * 0.15;
      sfx('shot');
      G.bullets.push({
        x: o.x + Math.cos(a) * 15, y: o.y + Math.sin(a) * 15,
        vx: Math.cos(a) * 800, vy: Math.sin(a) * 800,
        life: 0.55, damage: 7, from: 'cop', tracer: '#9fc2ff',
      });
    }
    void p;
  }
  for (let i = G.officers.length - 1; i >= 0; i--) {
    if (G.officers[i].dead && G.officers[i].fadeT > 20) G.officers.splice(i, 1);
  }
  if (G.wanted === 0 && G.officers.length) G.officers = [];
}

export function drawOfficer(ctx, o, camX, camY) {
  const sx = o.x - camX, sy = o.y - camY;
  ctx.save();
  ctx.translate(sx, sy);
  if (o.dead) {
    ctx.rotate(o.angle + Math.PI / 2);
    ctx.fillStyle = '#26303c';
    ctx.fillRect(-11, -4, 15, 8);
    ctx.fillStyle = '#e0ac69';
    ctx.beginPath(); ctx.arc(8, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle = 'rgba(30,25,15,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 5, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(o.angle);
  const bob = Math.sin(o.walkPhase) * 1.4;
  ctx.fillStyle = '#141a22';
  ctx.fillRect(-2 + bob, -5, 5, 3.4);
  ctx.fillRect(-2 - bob, 1.6, 5, 3.4);
  ctx.fillStyle = o.flashT > 0 ? '#ffffff' : '#26394f';
  ctx.beginPath(); ctx.arc(0, 0, 7.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e0ac69';
  ctx.beginPath(); ctx.arc(1.5, 0, 4.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#14151a';
  ctx.fillRect(6, -1.4, 11, 2.8);
  ctx.restore();
}
