// Port Solano — main.js
// Boot and the frame loop: build the seeded world, wire input and menus,
// step every system in a fixed order, then render world, actors and HUD.

import { WORLD_SIZE, DAY_LENGTH, ZONES } from "./config.js";
import { G, toast, earnPostcard } from "./state.js";
import { bindInput, pressed, mouse, clearPressed } from "./input.js";
import { ensureAudio, updateAudio, sfx } from "./audio.js";
import { buildCity, drawCity } from "./city.js";
import { drawCar } from "./vehicles.js";
import { updateEffects, drawEffects, drawTint } from "./effects.js";
import { spawnTraffic, updateTraffic } from "./traffic.js";
import { spawnPeds, updatePeds, drawPed, witnessCrime } from "./pedestrians.js";
import { makePlayer, updatePlayer, drawPlayer } from "./player.js";
import { playerAttack, updateCombat, drawGunman, drawBullets } from "./combat.js";
import { updatePolice, clearHeat } from "./police.js";
import { updateMissions, startStoryMission, startCourier, STORY } from "./missions.js";
import { drawHUD, drawScreens } from "./hud.js";
import { saveGame, loadGame, applySave, hasSave, clearSave } from "./save.js";
import { setupShot } from "./shots.js";
import { runSelfTest } from "./selftest.js";
import { dist, clamp } from "./random.js";

window.__psPed = { witnessCrime };

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const params = new URLSearchParams(location.search);
const seed = parseInt(params.get("seed") || "1", 10) || 1;
const cam = { x: 800, y: 800 };

export function newGame(fromSave) {
  buildCity(seed);
  G.player = makePlayer(660, 660);
  G.cars = spawnTraffic(seed);
  G.peds = spawnPeds(seed);
  G.cops = []; G.gunmen = []; G.bullets = []; G.particles = []; G.floaters = []; G.skids = [];
  G.cash = 120; G.heat = 0; G.wanted = 0; G.bust = 0; G.storyIndex = 0; G.courierCount = 0;
  G.weapons = { pistol: false, smg: false }; G.ammo = { pistol: 0, smg: 0 }; G.weapon = "fists";
  G.postcards = []; G.mission = null; G.clock = 0.32; G.breakIn = null;
  if (fromSave) { const data = loadGame(); if (data) applySave(data); }
  G.mode = "playing";
  toast(fromSave ? "Welcome back to Port Solano." : "Reyes arrives in Port Solano. Find Alba at the Chop Shop.");
}

export function togglePause() {
  if (G.mode === "playing") G.mode = "paused";
  else if (G.mode === "paused" || G.mode === "help") G.mode = "playing";
}

function zoneActions() {
  const pl = G.player; if (!pl || pl.car) return;
  for (const z of ZONES) {
    if (dist(pl.x, pl.y, z.x, z.y) > 46) continue;
    if (z.id === "clinic" && (pl.hp < pl.maxHp || G.wanted > 0)) {
      pl.hp = pl.maxHp; clearHeat(); toast("Clinica del Sol patched you up. Heat cleared.");
      earnPostcard("clinic", "Clinica del Sol");
    } else if (z.id === "safehouse") { saveGame(); clearHeat(); toast("Saved at Casa Reyes. Heat cleared."); earnPostcard("casa", "Casa Reyes"); }
    else if (z.id === "gunshop") {
      if (!G.weapons.pistol) { if (G.cash >= 150) { G.cash -= 150; G.weapons.pistol = true; G.ammo.pistol += 48; toast("Bought a pistol at Armeria Solano."); } else toast("Pistol costs $150."); }
      else { G.ammo.pistol += 24; G.ammo.smg += G.weapons.smg ? 60 : 0; toast("Ammo topped up."); }
      earnPostcard("armeria", "Armeria Solano");
    } else if (z.id === "marina") earnPostcard("marina", "Marina Azul");
    else if (z.id === "chopshop") earnPostcard("chop", "Alba's Chop Shop");
    if (pressed.KeyQ && !G.mission) {
      if (G.storyIndex < STORY.length) startStoryMission(G.storyIndex);
      else startCourier();
    }
  }
}

let interactHint = "";
function step(dt) {
  G.time += dt;
  if (G.mode !== "playing") return;
  G.clock = (G.clock + dt / DAY_LENGTH) % 1;
  G.messageTimer = Math.max(0, G.messageTimer - dt);
  G.bannerTimer = Math.max(0, G.bannerTimer - dt);
  window.__psMouseDown = mouse.down || !!pressed.KeyF;
  // weapon switching
  if (pressed.Digit1) G.weapon = "fists";
  if (pressed.Digit2 && G.weapons.pistol) G.weapon = "pistol";
  if (pressed.Digit3 && G.weapons.smg) G.weapon = "smg";
  if (pressed.KeyM) { G.muted = !G.muted; toast(G.muted ? "Sound off" : "Sound on"); }
  mouse.wx = cam.x + mouse.x; mouse.wy = cam.y + mouse.y;
  updatePlayer(dt);
  playerAttack(dt, mouse.wx, mouse.wy);
  updateTraffic(dt);
  updatePeds(dt);
  updateCombat(dt);
  updatePolice(dt);
  updateMissions(dt);
  zoneActions();
  for (const cop of G.cops) cop.alarm = Math.max(0, (cop.alarm || 0) - dt);
  for (const car of G.cars) car.alarm = Math.max(0, (car.alarm || 0) - dt);
  updateEffects(dt);
  // mission auto-offer at chop shop when idle
  interactHint = "";
  const pl = G.player;
  if (pl.hp <= 0) { G.mode = "wasted"; sfx.stinger(false); }
  const speedRatio = pl.car ? Math.min(1, Math.hypot(pl.car.vx, pl.car.vy) / 300) : 0;
  updateAudio(speedRatio, G.cops.some((c) => dist(c.x, c.y, pl.x, pl.y) < 500));
  // camera with speed look-ahead
  const lookX = pl.car ? pl.car.vx * 0.55 : 0, lookY = pl.car ? pl.car.vy * 0.55 : 0;
  cam.x = clamp(pl.x + lookX - canvas.width / 2, 0, Math.max(0, WORLD_SIZE - canvas.width));
  cam.y = clamp(pl.y + lookY - canvas.height / 2, 0, Math.max(0, WORLD_SIZE - canvas.height));
}

function render() {
  ctx.save();
  const shX = (Math.random() - 0.5) * G.shake, shY = (Math.random() - 0.5) * G.shake;
  ctx.translate(-Math.round(cam.x + shX), -Math.round(cam.y + shY));
  drawCity(ctx, cam, canvas.width, canvas.height, G.clock);
  for (const car of G.cars) drawCar(ctx, car);
  for (const p of G.peds) drawPed(ctx, p);
  for (const g of G.gunmen) drawGunman(ctx, g);
  for (const cop of G.cops) if (cop.copAI && cop.copAI.officer) {
    const o = cop.copAI.officer;
    ctx.fillStyle = "#22406e"; ctx.beginPath(); ctx.arc(o.x, o.y, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e8b88a"; ctx.beginPath(); ctx.arc(o.x, o.y - 2, 5, 0, Math.PI * 2); ctx.fill();
  }
  drawPlayer(ctx);
  drawBullets(ctx);
  drawEffects(ctx);
  // mission marker beacon
  if (G.mission) {
    const stepDef = G.mission.def.steps[G.mission.step];
    if (stepDef) {
      ctx.strokeStyle = "#ffd34d"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(stepDef.x, stepDef.y, 30 + Math.sin(G.time * 4) * 5, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#ffd34d"; ctx.fillRect(stepDef.x - 2, stepDef.y - 90, 4, 55);
    }
  }
  ctx.restore();
  drawTint(ctx, canvas.width, canvas.height, G.clock);
  if (G.mode !== "title") drawHUD(ctx, canvas.width, canvas.height);
  drawScreens(ctx, canvas.width, canvas.height);
  if (G.mode === "playing" && G.player && !G.player.car) {
    ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.font = "13px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("Q at a zone — take a job · E — car · click — fight", canvas.width / 2, canvas.height - 12);
  }
}

function menuKeys() {
  if (G.mode === "title") {
    if (pressed.KeyN) { clearSave(); newGame(false); sfx.ui(); }
    if (pressed.KeyC && hasSave()) { newGame(true); sfx.ui(); }
    if (pressed.KeyH) G.mode = "help";
  } else if (G.mode === "help" && (pressed.Escape || pressed.Enter)) G.mode = G.player ? "paused" : "title";
  else if (G.mode === "paused") {
    if (pressed.KeyS) { saveGame(); toast("Saved."); G.mode = "playing"; }
    if (pressed.KeyR) newGame(false);
    if (pressed.KeyH) G.mode = "help";
  } else if ((G.mode === "busted" || G.mode === "wasted" || G.mode === "complete") && pressed.Enter) {
    if (G.mode === "busted") { G.cash = Math.max(0, G.cash - 150); clearHeat(); G.cops = []; G.cars = G.cars.filter((c) => !c.cop); }
    if (G.mode === "wasted") { G.cash = Math.max(0, G.cash - 100); G.player.hp = 70; G.player.x = 3000; G.player.y = 660; clearHeat(); }
    G.mode = "playing";
  }
}

// boot: a quiet world behind the title screen
buildCity(seed);
G.player = makePlayer(660, 660);
G.cars = spawnTraffic(seed);
G.peds = spawnPeds(seed);
cam.x = clamp(G.player.x - canvas.width / 2, 0, WORLD_SIZE - canvas.width);
cam.y = clamp(G.player.y - canvas.height / 2, 0, WORLD_SIZE - canvas.height);

bindInput(canvas, () => { ensureAudio(); togglePause(); });
canvas.addEventListener("mousedown", ensureAudio);
addEventListener("keydown", ensureAudio);

const shotName = params.get("shot");
if (shotName) setupShot(shotName);

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  menuKeys();
  step(dt);
  render();
  clearPressed();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if (params.get("test") === "1") {
  const api = { newGame: () => newGame(false), step, togglePause };
  setTimeout(() => runSelfTest(api), 350);
}
