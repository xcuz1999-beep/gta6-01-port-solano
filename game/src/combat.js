// Port Solano — combat.js
// Fists, pistol and SMG with mouse aim; bullets with tracers; and the rival
// gunmen who shoot back. Gunmen strafe at mid-range, take cover-ish pauses
// behind their fire cooldown, flash when hit and drop cash when they fall.

import { WEAPONS } from './config.js';
import { G, addCash } from './state.js';
import { pointInBuilding, hasLineOfSight, collideCircle } from './city.js';
import { clamp, angleLerp } from './random.js';
import { muzzle, bloodPuff, burst } from './effects.js';
import { sfx } from './audio.js';
import { scarePeds, knockDownPed } from './pedestrians.js';

export function spawnGunman(x, y, opts = {}) {
  const gunman = {
    x, y, r: 10, angle: 0, hp: opts.hp || 100, maxHp: opts.hp || 100,
    speed: opts.speed || 118, damage: opts.damage || 8,
    fireRate: opts.fireRate || 0.85, cooldown: G.fxRng.range(0.3, 1),
    strafeDir: G.fxRng.sign(), strafeT: G.fxRng.range(1, 2.4),
    flashT: 0, boss: !!opts.boss, name: opts.name || 'Vantrek gunman',
    walkPhase: 0, dead: false,
  };
  G.gunmen.push(gunman);
  return gunman;
}

export function clearGunmen() { G.gunmen = G.gunmen.filter((g) => g.dead); G.gunmen = []; }

// Can the player fire right now? Handles cooldown and dry-fire clicks.
export function tryPlayerShoot(aimX, aimY, triggerHeld, triggerPressed) {
  const p = G.player;
  if (!p || p.car || p.dead) return;
  const spec = WEAPONS[G.weapon];
  G.fireCooldown -= 1 / 60;
  const wantFire = spec.auto ? triggerHeld : triggerPressed;
  if (!wantFire || G.fireCooldown > 0) return;
  if (spec.ammoType && G.ammo[spec.ammoType] <= 0) {
    G.fireCooldown = 0.25;
    sfx('deny');
    return;
  }
  G.fireCooldown = spec.rate;
  const angle = Math.atan2(aimY - p.y, aimX - p.x);
  p.angle = angle;
  if (spec.ammoType) G.ammo[spec.ammoType]--;
  G.stats.shotsFired++;
  muzzle(p.x, p.y, angle);
  if (G.weapon === 'fists') {
    sfx('punch');
    meleeHit(p, angle, spec);
  } else {
    sfx(G.weapon === 'smg' ? 'shotSmg' : 'shot');
    const spread = (G.fxRng.float() - 0.5) * 2 * spec.spread;
    G.bullets.push({
      x: p.x + Math.cos(angle) * 15, y: p.y + Math.sin(angle) * 15,
      vx: Math.cos(angle + spread) * spec.speed, vy: Math.sin(angle + spread) * spec.speed,
      life: spec.range / spec.speed, damage: spec.damage, from: 'player', tracer: '#ffe9a3',
    });
  }
  scarePeds(p.x, p.y, 210);
  if (G.commitCrime) G.commitCrime(G.weapon === 'fists' ? 'assault' : 'gunshot', p.x, p.y);
}

function meleeHit(attacker, angle, spec) {
  const reach = spec.range + 12;
  for (const g of G.gunmen) {
    if (g.dead) continue;
    if (Math.hypot(g.x - attacker.x, g.y - attacker.y) < reach + g.r && Math.abs(angleDiff(angle, Math.atan2(g.y - attacker.y, g.x - attacker.x))) < 1.1) {
      hurtGunman(g, spec.damage, angle);
    }
  }
  for (const ped of G.peds) {
    if (ped.state === 'down') continue;
    if (Math.hypot(ped.x - attacker.x, ped.y - attacker.y) < reach + ped.r) {
      knockDownPed(ped, true);
    }
  }
  for (const officer of G.officers) {
    if (officer.dead) continue;
    if (Math.hypot(officer.x - attacker.x, officer.y - attacker.y) < reach + officer.r) {
      hurtOfficer(officer, spec.damage);
    }
  }
}

function angleDiff(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function hurtGunman(g, damage, fromAngle = 0) {
  if (g.dead) return;
  g.hp -= damage;
  g.flashT = 0.12;
  bloodPuff(g.x, g.y);
  sfx('hit');
  if (g.hp <= 0) {
    g.dead = true;
    burst(g.x, g.y, { n: 14, color: '#b03030', speed: 130, life: 0.5 });
    const reward = g.boss ? 500 : 45;
    addCash(reward, g.x, g.y);
    if (G.commitCrime) G.commitCrime('gunshot', g.x, g.y);
  } else {
    g.x += Math.cos(fromAngle) * 4;
    g.y += Math.sin(fromAngle) * 4;
  }
}

export function hurtOfficer(officer, damage) {
  if (officer.dead) return;
  officer.hp -= damage;
  officer.flashT = 0.12;
  bloodPuff(officer.x, officer.y);
  if (officer.hp <= 0) {
    officer.dead = true;
    if (G.commitCrime) G.commitCrime('copdown', officer.x, officer.y);
  }
}

export function hurtPlayer(damage) {
  const p = G.player;
  if (!p || p.dead) return;
  if (p.car) {
    // Shots at a driver mostly chew the car; a fraction finds the driver.
    p.car.hp -= damage * 0.7;
    if (G.fxRng.chance(0.35)) p.hp -= damage * 0.5;
  } else {
    p.hp -= damage;
  }
  sfx('hurt');
  if (p.hp <= 0) { p.hp = 0; p.dead = true; }
}

export function updateGunmen(dt) {
  const p = G.player;
  if (!p) return;
  for (const g of G.gunmen) {
    if (g.dead) continue;
    g.flashT = Math.max(0, g.flashT - dt);
    g.cooldown -= dt;
    g.strafeT -= dt;
    if (g.strafeT <= 0) { g.strafeDir = -g.strafeDir; g.strafeT = G.fxRng.range(0.9, 2.2); }
    const targetX = p.car ? p.car.x : p.x;
    const targetY = p.car ? p.car.y : p.y;
    const d = Math.hypot(targetX - g.x, targetY - g.y);
    const toPlayer = Math.atan2(targetY - g.y, targetX - g.x);
    g.angle = angleLerp(g.angle, toPlayer, dt * 7);
    g.walkPhase += dt * 9;
    let mx = 0, my = 0;
    if (d > 300) { mx = Math.cos(toPlayer); my = Math.sin(toPlayer); }
    else if (d < 130) { mx = -Math.cos(toPlayer); my = -Math.sin(toPlayer); }
    else { mx = Math.cos(toPlayer + Math.PI / 2) * g.strafeDir; my = Math.sin(toPlayer + Math.PI / 2) * g.strafeDir; }
    const fixed = collideCircle(g.x + mx * g.speed * dt, g.y + my * g.speed * dt, g.r);
    g.x = fixed.x; g.y = fixed.y;
    // Fire when in range with a clear line.
    if (d < 430 && g.cooldown <= 0 && hasLineOfSight(g.x, g.y, targetX, targetY)) {
      g.cooldown = g.fireRate * G.fxRng.range(0.8, 1.25);
      const spread = (G.fxRng.float() - 0.5) * 0.16;
      const a = toPlayer + spread;
      muzzle(g.x, g.y, a);
      sfx('shot');
      G.bullets.push({
        x: g.x + Math.cos(a) * 15, y: g.y + Math.sin(a) * 15,
        vx: Math.cos(a) * 820, vy: Math.sin(a) * 820,
        life: 0.55, damage: g.damage, from: 'enemy', tracer: '#ff9d7a',
      });
    }
  }
  // Fallen gunmen linger as bodies for a while, then fade.
  for (let i = G.gunmen.length - 1; i >= 0; i--) {
    const g = G.gunmen[i];
    if (g.dead) { g.fadeT = (g.fadeT || 0) + dt; if (g.fadeT > 25) G.gunmen.splice(i, 1); }
  }
}

export function updateBullets(dt) {
  const p = G.player;
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt;
    b.life -= dt;
    let kill = b.life <= 0;
    if (!kill && pointInBuilding(b.x, b.y, -1)) { burst(b.x, b.y, { n: 3, color: '#cbbf9f', speed: 70, life: 0.25, size: 2 }); kill = true; }
    if (!kill && b.from === 'player') {
      for (const g of G.gunmen) {
        if (!g.dead && Math.hypot(g.x - b.x, g.y - b.y) < g.r + 3) { hurtGunman(g, b.damage, Math.atan2(b.vy, b.vx)); kill = true; break; }
      }
      if (!kill) for (const officer of G.officers) {
        if (!officer.dead && Math.hypot(officer.x - b.x, officer.y - b.y) < officer.r + 3) { hurtOfficer(officer, b.damage); kill = true; break; }
      }
      if (!kill) for (const ped of G.peds) {
        if (ped.state !== 'down' && Math.hypot(ped.x - b.x, ped.y - b.y) < ped.r + 3) {
          ped.state = 'down'; ped.downT = 8; bloodPuff(ped.x, ped.y);
          if (G.commitCrime) G.commitCrime('hitped', ped.x, ped.y);
          kill = true; break;
        }
      }
      if (!kill) for (const car of G.cars) {
        if (Math.hypot(car.x - b.x, car.y - b.y) < 24) { car.hp -= b.damage * 0.4; kill = true; break; }
      }
    }
    if (!kill && b.from !== 'player' && p) {
      const tx = p.car ? p.car.x : p.x, ty = p.car ? p.car.y : p.y;
      const rr = p.car ? 24 : p.r + 3;
      if (Math.hypot(tx - b.x, ty - b.y) < rr) { hurtPlayer(b.damage); kill = true; }
    }
    if (kill) G.bullets.splice(i, 1);
  }
}

export function drawGunman(ctx, g, camX, camY) {
  const sx = g.x - camX, sy = g.y - camY;
  ctx.save();
  ctx.translate(sx, sy);
  if (g.dead) {
    ctx.rotate(g.angle + Math.PI / 2);
    ctx.fillStyle = '#4a2020';
    ctx.fillRect(-11, -4, 15, 8);
    ctx.fillStyle = '#c68642';
    ctx.beginPath(); ctx.arc(8, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle = 'rgba(30,25,15,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 5, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(g.angle);
  const bob = Math.sin(g.walkPhase) * 1.4;
  ctx.fillStyle = '#23272e';
  ctx.fillRect(-2 + bob, -5, 5, 3.4);
  ctx.fillRect(-2 - bob, 1.6, 5, 3.4);
  ctx.fillStyle = g.flashT > 0 ? '#ffffff' : (g.boss ? '#7d1f1f' : '#3a3f4a');
  ctx.beginPath(); ctx.arc(0, 0, 7.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c68642';
  ctx.beginPath(); ctx.arc(1.5, 0, 4.4, 0, Math.PI * 2); ctx.fill();
  // Gun barrel toward the aim direction.
  ctx.fillStyle = '#14151a';
  ctx.fillRect(6, -1.4, 11, 2.8);
  ctx.restore();
  if (g.boss) {
    ctx.fillStyle = '#ff8a7a';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(g.name, sx, sy - 20);
  }
  // Health pip for wounded gunmen.
  if (g.hp < g.maxHp) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(sx - 13, sy - 16, 26, 4);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(sx - 13, sy - 16, 26 * clamp(g.hp / g.maxHp, 0, 1), 4);
  }
}

export function drawBullets(ctx, camX, camY) {
  for (const b of G.bullets) {
    const sx = b.x - camX, sy = b.y - camY;
    ctx.strokeStyle = b.tracer;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx - b.vx * 0.016, sy - b.vy * 0.016);
    ctx.lineTo(sx, sy);
    ctx.stroke();
  }
}
