// Port Solano — player.js
// Reyes on foot and behind the wheel: walking, sprinting, entering and
// leaving cars, and breaking into locked ones (which sets off an alarm
// and, if anyone hears it, the police).

import { PLAYER_SPEED, PLAYER_RADIUS, WORLD_SIZE } from "./config.js";
import { G, toast } from "./state.js";
import { keys, pressed, moveAxis } from "./input.js";
import { resolveCollision, isWater } from "./city.js";
import { clamp, dist } from "./random.js";
import { stepCar } from "./vehicles.js";
import { sfx } from "./audio.js";
import { witnessCrime } from "./pedestrians.js";

export function makePlayer(x, y) {
  return { x, y, angle: 0, hp: 100, maxHp: 100, car: null, cooldown: 0, stepPhase: 0 };
}

export function nearestCar(x, y, maxD = 52) {
  let best = null, bd = maxD;
  for (const car of G.cars) {
    const d = dist(x, y, car.x, car.y);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

export function tryEnterCar() {
  const pl = G.player;
  const car = nearestCar(pl.x, pl.y);
  if (!car) return false;
  if (car.wrecked) { toast("That car is wrecked."); return false; }
  if (car.locked && !G.breakIn) {
    G.breakIn = { car, t: 0, need: 1.2 };
    return true;
  }
  enterCar(car);
  return true;
}

export function enterCar(car) {
  const pl = G.player;
  pl.car = car; car.parked = false; car.driver = null; delete car.ai;
  G.breakIn = null;
  sfx.ui();
}

export function exitCar() {
  const pl = G.player;
  if (!pl.car) return;
  const car = pl.car;
  pl.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
  pl.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
  pl.car = null; car.parked = true; car.speed = 0; car.vx = 0; car.vy = 0;
}

export function updatePlayer(dt) {
  const pl = G.player; if (!pl) return;
  if (G.breakIn) {
    const b = G.breakIn;
    if (!keys.KeyE) { G.breakIn = null; }
    else {
      b.t += dt; b.car.alarm = 0.4;
      if (Math.random() < dt * 2) sfx.alarm();
      if (b.t >= b.need) {
        b.car.locked = false;
        witnessCrime(pl.x, pl.y, 18);
        toast("Broken in — the alarm gave you away.");
        enterCar(b.car);
      }
    }
    return;
  }
  if (pl.car) {
    const input = {
      up: keys.KeyW || keys.ArrowUp, down: keys.KeyS || keys.ArrowDown,
      left: keys.KeyA || keys.ArrowLeft, right: keys.KeyD || keys.ArrowRight,
      drift: !!keys.Space,
    };
    stepCar(pl.car, dt, input);
    pl.x = pl.car.x; pl.y = pl.car.y; pl.angle = pl.car.angle;
    if (pressed.KeyE || pressed.KeyF) exitCar();
    return;
  }
  const axis = moveAxis();
  const sprint = keys.ShiftLeft || keys.ShiftRight;
  const speed = PLAYER_SPEED * (sprint ? 1.45 : 1);
  if (axis.x || axis.y) {
    pl.angle = Math.atan2(axis.y, axis.x);
    pl.x += axis.x * speed * dt; pl.y += axis.y * speed * dt;
    pl.stepPhase += dt * (sprint ? 13 : 9);
  }
  pl.x = clamp(pl.x, 20, WORLD_SIZE - 20); pl.y = clamp(pl.y, 20, WORLD_SIZE - 20);
  if (isWater(pl.x, pl.y)) { pl.x -= axis.x * speed * dt * 1.4; pl.y -= axis.y * speed * dt * 1.4; }
  resolveCollision(pl, PLAYER_RADIUS);
  if (pressed.KeyE) tryEnterCar();
}

export function drawPlayer(ctx) {
  const pl = G.player; if (!pl || pl.car) return;
  ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.arc(pl.x + 2, pl.y + 3, 10, 0, Math.PI * 2); ctx.fill();
  const bob = Math.sin(pl.stepPhase) * 1.6;
  ctx.save(); ctx.translate(pl.x, pl.y + bob * 0.3); ctx.rotate(pl.angle + Math.PI / 2);
  ctx.fillStyle = "#233043"; ctx.fillRect(-5, 2, 10, 9);
  ctx.fillStyle = "#e8572a"; ctx.beginPath(); ctx.arc(0, -1, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#f2c094"; ctx.beginPath(); ctx.arc(0, -3, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#17202b"; ctx.fillRect(5, -6, 10, 3);
  ctx.restore();
  if (pl.hp < pl.maxHp) {
    ctx.fillStyle = "#40151c"; ctx.fillRect(pl.x - 11, pl.y - 22, 22, 4);
    ctx.fillStyle = "#57d977"; ctx.fillRect(pl.x - 11, pl.y - 22, 22 * Math.max(0, pl.hp / pl.maxHp), 4);
  }
}
