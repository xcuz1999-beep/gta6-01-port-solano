// Port Solano — player.js
// Reyes on foot and behind the wheel: walking with mouse aim, entering and
// leaving cars, the break-in minigame for locked cars (hold E, mind the
// alarm), ejecting traffic drivers, and zone interactions — the clinic that
// patches you up and cools the heat, the safehouse that saves, the Armeria
// that sells iron.

import { PLAYER_WALK_SPEED, PLAYER_RUN_SPEED, WEAPONS } from './config.js';
import { G, toast, addCash } from './state.js';
import { keys, consume, mouse } from './input.js';
import { collideCircle, zoneAt } from './city.js';
import { stepCar, forwardSpeed, carSpeed } from './vehicles.js';
import { clamp } from './random.js';
import { scarePeds } from './pedestrians.js';
import { sfx, setEngine } from './audio.js';
import { saveGame } from './save.js';

export function playerPos() {
  const p = G.player;
  return p.car ? { x: p.car.x, y: p.car.y } : { x: p.x, y: p.y };
}

function nearestCar(x, y, maxD) {
  let best = null, bd = maxD;
  for (const car of G.cars) {
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

export function tryEnterExit() {
  const p = G.player;
  if (!p || p.dead) return false;
  if (p.car) {
    // Step out on the left side of the car, collision-checked so Reyes
    // never materialises inside a wall.
    const car = p.car;
    const exitAngle = car.angle - Math.PI / 2;
    const fixed = collideCircle(car.x + Math.cos(exitAngle) * 30, car.y + Math.sin(exitAngle) * 30, p.r);
    p.x = fixed.x; p.y = fixed.y;
    car.driver = null;
    if (car.wasParked) car.parked = true; // a borrowed parked car parks again
    car.wasParked = false;
    p.car = null;
    p.breakIn = null;
    sfx('door');
    setEngine(0, false);
    return true;
  }
  const car = nearestCar(p.x, p.y, 46);
  if (!car || car.wrecked) return false;
  if (car.locked) {
    p.breakIn = { car, t: 0 };
    return true; // the break-in itself runs in updatePlayer while E is held
  }
  enterCar(car);
  return true;
}

export function enterCar(car) {
  const p = G.player;
  const wasTraffic = car.driver === 'traffic';
  if (wasTraffic) {
    // The driver is pulled out onto the street — and remembers it.
    scarePeds(car.x, car.y, 150);
    if (G.commitCrime) G.commitCrime('theft', car.x, car.y);
    G.stats.stolen++;
  } else if (car.parked) {
    G.stats.stolen++;
  }
  car.driver = 'player';
  car.wasParked = car.parked;
  car.parked = false;
  car.ai = null;
  p.car = car;
  p.breakIn = null;
  sfx('door');
}

function finishBreakIn(car) {
  car.locked = false;
  car.alarmT = 2.5;
  sfx('alarm');
  toast('Alarm! The street heard that.', '#ff8a7a');
  if (G.commitCrime) G.commitCrime('theft', car.x, car.y);
  enterCar(car);
}

export function updatePlayer(dt) {
  const p = G.player;
  if (!p || p.dead) { setEngine(0, false); return; }

  // Weapon switching on the number keys and the wheel-ish Q key.
  if (consume('Digit1')) selectWeapon('fists');
  if (consume('Digit2')) selectWeapon('pistol');
  if (consume('Digit3')) selectWeapon('smg');
  if (consume('KeyQ')) cycleWeapon();

  if (consume('KeyE')) {
    if (!tryEnterExit()) interactZone();
  }

  if (p.car) {
    const car = p.car;
    let throttle = 0, steer = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) throttle += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) throttle -= 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) steer -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) steer += 1;
    const handbrake = keys.has('Space');
    const impact = stepCar(car, throttle, steer, handbrake, dt);
    p.x = car.x; p.y = car.y;
    p.angle = car.angle;
    if (impact > 240) { if (G.commitCrime) G.commitCrime('crash', car.x, car.y); }
    const speedNorm = clamp(Math.abs(forwardSpeed(car)) / car.spec.top, 0, 1);
    setEngine(speedNorm, true);
    if (car.wrecked) {
      toast('Wrecked! Get out and find another ride.', '#ff8a7a');
      tryEnterExit();
    }
    return;
  }

  setEngine(0, false);

  // Break-in progress: E held next to a locked car.
  if (p.breakIn) {
    const car = p.breakIn.car;
    if (!keys.has('KeyE') || Math.hypot(car.x - p.x, car.y - p.y) > 50) {
      p.breakIn = null;
    } else {
      p.breakIn.t += dt;
      if (p.breakIn.t >= 1.2) { p.breakIn = null; finishBreakIn(car); return; }
    }
  }

  // On-foot movement, aimed by the mouse.
  let mx = 0, my = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) my -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) my += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
  const moving = mx !== 0 || my !== 0;
  const running = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const speed = running ? PLAYER_RUN_SPEED : PLAYER_WALK_SPEED;
  if (moving) {
    const len = Math.hypot(mx, my);
    const fixed = collideCircle(p.x + (mx / len) * speed * dt, p.y + (my / len) * speed * dt, p.r);
    p.x = fixed.x; p.y = fixed.y;
    p.walkPhase += dt * (running ? 13 : 10);
  }
  p.angle = Math.atan2(G.mouse.wy - p.y, G.mouse.wx - p.x);
}

export function selectWeapon(id) {
  if (G.owned[id]) { G.weapon = id; sfx('ui'); }
  else { sfx('deny'); toast(WEAPONS[id].name + ' not owned yet', '#ff8a7a'); }
}

export function cycleWeapon() {
  const order = ['fists', 'pistol', 'smg'];
  let i = order.indexOf(G.weapon);
  for (let n = 0; n < 3; n++) {
    i = (i + 1) % 3;
    if (G.owned[order[i]]) { G.weapon = order[i]; sfx('ui'); return; }
  }
}

// E at a named place with no car nearby: clinics heal and cool heat, the
// safehouse saves, the Armeria sells weapons and ammo, Alba talks story.
export function interactZone() {
  const p = G.player;
  const zone = zoneAt(p.x, p.y);
  if (!zone) return;
  if (zone.kind === 'clinic') {
    if (G.cash >= 60 && p.hp < p.maxHp) {
      addCash(-60); p.hp = p.maxHp; toast('Clínica del Sol patched you up (-$60)', '#7be495'); sfx('cash');
    } else if (p.hp >= p.maxHp) toast('You are already whole.', '#cfe0e4');
    else toast('Treatment costs $60 — you are short.', '#ff8a7a');
    if (G.wanted > 0) { G.wanted = Math.max(0, G.wanted - 1); G.heat = 0; toast('The clinic loses your paperwork. Heat drops.', '#9fc2ff'); }
  } else if (zone.kind === 'safehouse') {
    p.hp = Math.min(p.maxHp, p.hp + 40);
    saveGame();
    toast('Casa Reyes: rested and saved.', '#7be495');
    sfx('mission');
  } else if (zone.kind === 'gunshop') {
    buyAtGunshop();
  } else if (zone.kind === 'marina') {
    toast('Marina Azul. Courier work starts here when the story allows.', '#cfe0e4');
  } else if (zone.kind === 'fixer') {
    toast("Alba Ferrer: “Follow the gold marker, Reyes.”", '#ffd75e');
  }
}

function buyAtGunshop() {
  // One E press buys the first thing you need and can afford: pistol, then
  // ammo, then the SMG once the story has shown it to you.
  if (!G.owned.pistol) {
    if (G.cash >= WEAPONS.pistol.price) { addCash(-WEAPONS.pistol.price); G.owned.pistol = true; G.ammo.pistol += 48; selectWeapon('pistol'); toast('Pistol bought (+48 rounds)', '#7be495'); sfx('unlock'); }
    else toast('Pistol: $' + WEAPONS.pistol.price + ' — not enough cash', '#ff8a7a');
    return;
  }
  if (G.ammo.pistol < 40 && G.cash >= 40) { addCash(-40); G.ammo.pistol += 48; toast('+48 pistol rounds (-$40)', '#7be495'); sfx('cash'); return; }
  if (!G.owned.smg && G.missionIndex >= 3) {
    if (G.cash >= WEAPONS.smg.price) { addCash(-WEAPONS.smg.price); G.owned.smg = true; G.ammo.smg += 120; selectWeapon('smg'); toast('SMG bought (+120 rounds)', '#7be495'); sfx('unlock'); }
    else toast('SMG: $' + WEAPONS.smg.price + ' — not enough cash', '#ff8a7a');
    return;
  }
  if (G.owned.smg && G.ammo.smg < 60 && G.cash >= 50) { addCash(-50); G.ammo.smg += 120; toast('+120 SMG rounds (-$50)', '#7be495'); sfx('cash'); return; }
  toast('Armería Solano: you are fully stocked.', '#cfe0e4');
}

export function drawPlayer(ctx, camX, camY) {
  const p = G.player;
  if (!p || p.car) return;
  const sx = p.x - camX, sy = p.y - camY;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.fillStyle = 'rgba(30,25,15,0.32)';
  ctx.beginPath(); ctx.ellipse(0, 5, 9, 4.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(p.angle);
  const bob = Math.sin(p.walkPhase) * 1.7;
  ctx.fillStyle = '#263238';
  ctx.fillRect(-2 + bob, -5.4, 5.4, 3.6);
  ctx.fillRect(-2 - bob, 1.8, 5.4, 3.6);
  // Reyes: burnt-orange jacket, unmistakable on the minimap and street.
  ctx.fillStyle = '#e4572e';
  ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8d5524';
  ctx.beginPath(); ctx.arc(1.5, 0, 4.6, 0, Math.PI * 2); ctx.fill();
  // Held weapon.
  if (G.weapon !== 'fists') {
    ctx.fillStyle = '#14151a';
    ctx.fillRect(6, -1.6, G.weapon === 'smg' ? 14 : 11, 3.2);
  }
  ctx.restore();
  // Break-in progress ring.
  if (p.breakIn) {
    ctx.strokeStyle = '#ffd75e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sx, sy - 22, 9, -Math.PI / 2, -Math.PI / 2 + (p.breakIn.t / 1.2) * Math.PI * 2);
    ctx.stroke();
  }
}
