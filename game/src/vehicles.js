// Port Solano — vehicles.js
// The car factory and arcade driving physics: velocity with a grip model so
// cars drift under handbrake, speed-sensitive steering, collision damage that
// smokes and then wrecks, and the top-down car renderer (body, glass, wheels,
// police livery and light bar).

import { CAR_TYPES } from './config.js';
import { G } from './state.js';
import { collideCircle } from './city.js';
import { clamp, angleDelta } from './random.js';
import { sparks, smokePuff, addSkid, addShake } from './effects.js';
import { sfx } from './audio.js';

let nextCarId = 1;

export function makeCar(x, y, angle, type, opts = {}) {
  const spec = CAR_TYPES[type] || CAR_TYPES.sedan;
  const car = {
    id: nextCarId++,
    x, y, angle, vx: 0, vy: 0,
    type, spec,
    w: spec.w, h: spec.h,
    color: opts.color || spec.colors[Math.floor(G.rng.float() * spec.colors.length) % spec.colors.length],
    hp: spec.hp, maxHp: spec.hp,
    parked: !!opts.parked,
    locked: !!opts.locked,
    isCop: !!opts.isCop,
    driver: opts.driver || null,   // 'player' | 'traffic' | 'cop' | null
    wrecked: false,
    alarmT: 0,
    smokeT: 0,
    ai: null,                      // traffic brain, installed by traffic.js
    lightPhase: G.rng.float() * 6,
  };
  G.cars.push(car);
  return car;
}

export function carSpeed(car) { return Math.hypot(car.vx, car.vy); }

// Forward speed signed along the heading (negative when reversing).
export function forwardSpeed(car) {
  return car.vx * Math.cos(car.angle) + car.vy * Math.sin(car.angle);
}

// One physics step. throttle -1..1, steer -1..1. Returns the impact speed if
// the car hit something hard this step (for damage/sound at the call site).
export function stepCar(car, throttle, steer, handbrake, dt) {
  if (car.wrecked) { car.vx *= 0.9; car.vy *= 0.9; return 0; }
  const spec = car.spec;
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  let fwd = car.vx * fx + car.vy * fy;
  const latX = car.vx - fx * fwd, latY = car.vy - fy * fwd;

  if (throttle > 0) fwd += spec.accel * throttle * dt * (fwd < spec.top ? 1 : 0);
  else if (throttle < 0) fwd += (fwd > 8 ? -spec.accel * 1.4 : -spec.accel * 0.55) * -throttle * dt * (fwd > -spec.top * 0.38 ? 1 : 0);
  // Rolling drag and air resistance settle the car at its top speed.
  fwd -= fwd * 0.55 * dt;
  if (!handbrake && Math.abs(throttle) < 0.05) fwd -= Math.sign(fwd) * Math.min(Math.abs(fwd), 26 * dt);

  const steerAuthority = clamp(Math.abs(fwd) / 60, 0, 1) * (fwd < 0 ? -1 : 1);
  car.angle += steer * 1.85 * steerAuthority * dt * (handbrake ? 1.35 : 1);

  const grip = handbrake ? 1.6 : spec.grip;
  const keep = Math.max(0, 1 - grip * dt);
  const nfx = Math.cos(car.angle), nfy = Math.sin(car.angle);
  car.vx = nfx * fwd + latX * keep;
  car.vy = nfy * fwd + latY * keep;

  const prevX = car.x, prevY = car.y;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  const fixed = collideCircle(car.x, car.y, 20);
  let impact = 0;
  if (fixed.x !== car.x || fixed.y !== car.y) {
    const closing = Math.hypot(car.x - prevX, car.y - prevY) / Math.max(dt, 0.001);
    impact = closing;
    car.x = fixed.x; car.y = fixed.y;
    if (closing > 130) {
      damageCar(car, (closing - 110) * 0.16, car.x, car.y);
      car.vx *= -0.25; car.vy *= -0.25;
    } else {
      car.vx *= 0.55; car.vy *= 0.55;
    }
  }

  // Skid marks while drifting or braking hard at speed.
  const lateral = Math.abs(car.vx * -nfy + car.vy * nfx);
  if ((lateral > 55 || (handbrake && Math.abs(fwd) > 90)) && Math.abs(fwd) > 40) {
    addSkid(car.x - nfx * 14 - nfy * 9, car.y - nfy * 14 + nfx * 9, car.angle);
    addSkid(car.x - nfx * 14 + nfy * 9, car.y - nfy * 14 - nfx * 9, car.angle);
  }
  if (car.hp < car.maxHp * 0.45 && !car.wrecked) {
    car.smokeT -= dt;
    if (car.smokeT <= 0) { smokePuff(car.x + nfx * 18, car.y + nfy * 18, car.hp < car.maxHp * 0.22); car.smokeT = 0.14; }
  }
  return impact;
}

export function damageCar(car, amount, x = car.x, y = car.y) {
  if (car.wrecked) return;
  car.hp -= amount;
  sparks(x, y);
  if (car.hp <= 0) {
    car.hp = 0;
    car.wrecked = true;
    smokePuff(car.x, car.y, true);
    addShake(7);
    sfx('crash');
  }
}

// Simple car-vs-car separation: overlapping cars push apart and trade a
// little damage at speed. Runs over all pairs; the city never holds enough
// cars for the quadratic cost to matter.
export function collideCars(dt) {
  const cars = G.cars;
  for (let i = 0; i < cars.length; i++) {
    const a = cars[i];
    for (let j = i + 1; j < cars.length; j++) {
      const b = cars[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      const minD = 40;
      if (d2 > minD * minD || d2 < 0.01) continue;
      const d = Math.sqrt(d2);
      const push = (minD - d) / 2;
      const nx = dx / d, ny = dy / d;
      a.x -= nx * push; a.y -= ny * push;
      b.x += nx * push; b.y += ny * push;
      const rel = Math.abs((b.vx - a.vx) * nx + (b.vy - a.vy) * ny);
      if (rel > 120) {
        damageCar(a, rel * 0.07, a.x + nx * 18, a.y + ny * 18);
        damageCar(b, rel * 0.07, b.x - nx * 18, b.y - ny * 18);
        if (a.driver === 'player' || b.driver === 'player') { addShake(6); sfx('crash'); }
      }
      // Trade a slice of velocity along the impact normal so shunts feel
      // physical, then bleed speed overall — crashes should cost momentum.
      const impulse = ((b.vx - a.vx) * nx + (b.vy - a.vy) * ny) * 0.35;
      a.vx += nx * impulse; a.vy += ny * impulse;
      b.vx -= nx * impulse; b.vy -= ny * impulse;
      a.vx *= 0.92; a.vy *= 0.92; b.vx *= 0.92; b.vy *= 0.92;
    }
  }
}

export function drawCar(ctx, car, camX, camY) {
  const sx = car.x - camX, sy = car.y - camY;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(car.angle);
  const w = car.w, h = car.h;
  // Shadow, then body.
  ctx.fillStyle = 'rgba(30,25,15,0.35)';
  ctx.fillRect(-w / 2 + 3, -h / 2 + 5, w, h);
  ctx.fillStyle = car.wrecked ? '#2c2c30' : car.color;
  roundRect(ctx, -w / 2, -h / 2, w, h, 6); ctx.fill();
  if (car.isCop) {
    ctx.fillStyle = '#e8ecf0';
    ctx.fillRect(-w * 0.18, -h / 2, w * 0.36, h);
    ctx.fillStyle = '#18222e';
    ctx.font = 'bold 7px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('POLICÍA', 0, 0);
  }
  if (car.type === 'taxi') {
    ctx.fillStyle = '#20242a';
    ctx.fillRect(-6, -6, 12, 12);
    ctx.fillStyle = '#f2b705';
    ctx.font = 'bold 6px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 2);
  }
  // Cabin glass.
  ctx.fillStyle = car.wrecked ? '#17181c' : 'rgba(28,44,60,0.9)';
  roundRect(ctx, -w * 0.16, -h * 0.36, w * 0.34, h * 0.72, 4); ctx.fill();
  ctx.fillStyle = 'rgba(160,200,225,0.5)';
  ctx.fillRect(w * 0.10, -h * 0.32, 3, h * 0.64);
  // Wheels.
  ctx.fillStyle = '#14151a';
  for (const [wx, wy] of [[-w * 0.32, -h / 2 - 2], [w * 0.32, -h / 2 - 2], [-w * 0.32, h / 2 - 2], [w * 0.32, h / 2 - 2]]) {
    ctx.fillRect(wx - 5, wy, 10, 4);
  }
  // Headlights.
  ctx.fillStyle = '#ffeebb';
  ctx.fillRect(w / 2 - 2, -h * 0.32, 3, 5);
  ctx.fillRect(w / 2 - 2, h * 0.32 - 5, 3, 5);
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(-w / 2 - 1, -h * 0.32, 3, 5);
  ctx.fillRect(-w / 2 - 1, h * 0.32 - 5, 3, 5);
  // Police light bar flashes red/blue.
  if (car.isCop && !car.wrecked) {
    const phase = Math.floor(G.time * 6 + car.lightPhase) % 2;
    ctx.fillStyle = phase ? '#ff3b30' : '#2e7dff';
    ctx.fillRect(-7, -h * 0.30, 14, 6);
    ctx.fillStyle = phase ? '#2e7dff' : '#ff3b30';
    ctx.fillRect(-7, h * 0.30 - 6, 14, 6);
  }
  // Damage smoke scorch marks.
  if (car.hp < car.maxHp * 0.5) {
    ctx.fillStyle = 'rgba(20,20,20,0.35)';
    ctx.beginPath(); ctx.arc(w * 0.28, 0, 8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  if (car.alarmT > 0) {
    ctx.fillStyle = '#ff5a4d';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', sx, sy - 26 + Math.sin(G.time * 10) * 2);
  }
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
