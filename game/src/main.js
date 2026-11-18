// Port Solano — main.js
// Boot and the frame loop: build the seeded world, wire the menus, run the
// simulation in the right order (player, traffic, peds, combat, police,
// missions, effects), follow Reyes with the camera, and render the city,
// its people and the HUD. Also owns the day clock, autosave, postcard
// moments, and the ?shot= / ?test= deterministic hooks.

import { VIEW_W, VIEW_H, WORLD_SIZE, DAY_LENGTH_SECONDS, AUTOSAVE_SECONDS } from './config.js';
import { G, resetPlayer, toast, showBanner } from './state.js';
import { Rng, clamp } from './random.js';
import { attachInput, keys, consume, mouse, endFrameInput } from './input.js';
import { initAudio, sfx, setSiren } from './audio.js';
import { generateCity, drawCity } from './city.js';
import { spawnTraffic, spawnParkedCars, updateTraffic, maintainTraffic } from './traffic.js';
import { spawnPeds, updatePeds, drawPed } from './pedestrians.js';
import { updatePlayer, drawPlayer, playerPos } from './player.js';
import { tryPlayerShoot, updateGunmen, updateBullets, drawGunman, drawBullets } from './combat.js';
import { commitCrime, updatePolice, drawOfficer, clearWanted } from './police.js';
import { updateMissions, drawMissionMarker } from './missions.js';
import { updateEffects, drawEffects, drawDayTint, nightFactor } from './effects.js';
import { drawCar, collideCars } from './vehicles.js';
import { drawHUD } from './hud.js';
import { saveGame, loadGame, applySave, hasSave, wipeSave } from './save.js';
import { setupShot } from './shots.js';
import { runSelfTest } from './selftest.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(window.location.search);
const SEED = parseInt(params.get('seed') || '1', 10) || 1;

G.commitCrime = commitCrime;

function buildWorld() {
  G.rng = new Rng(SEED * 7919 + 13);
  G.fxRng = new Rng(SEED * 104729 + 7);
  G.cars = []; G.peds = []; G.officers = []; G.gunmen = []; G.bullets = [];
  G.particles = []; G.skids = []; G.texts = []; G.reports = []; G.toasts = [];
  generateCity(G.rng);
  resetPlayer(600, 800);
  spawnParkedCars(G.rng);
  spawnTraffic(G.rng);
  spawnPeds(G.rng);
  G.camera.x = clamp(G.player.x - VIEW_W / 2, 0, WORLD_SIZE - VIEW_W);
  G.camera.y = clamp(G.player.y - VIEW_H / 2, 0, WORLD_SIZE - VIEW_H);
}

function resetProgress() {
  G.cash = 120;
  G.clock = 9 * 60 + 20;
  G.day = 1;
  G.wanted = 0; G.heat = 0; G.bust = 0;
  G.weapon = 'fists';
  G.owned = { fists: true, pistol: false, smg: false };
  G.ammo = { pistol: 0, smg: 0 };
  G.missionIndex = 0; G.mission = null; G.courier = null; G.storyDone = false;
  G.postcards = [];
  G.stats = { stolen: 0, knockdowns: 0, shotsFired: 0, missionsDone: 0, earned: 0 };
}

function startNewGame() {
  buildWorld();
  resetProgress();
  G.mode = 'playing';
  showBanner('Port Solano', 'Reyes is back in town. Alba Ferrer has work — follow the gold marker.');
  toast('WASD move · Mouse aim · E interact · Esc pause', '#cfe0e4');
  syncScreens();
}

function continueGame() {
  const data = loadGame();
  buildWorld();
  resetProgress();
  if (data) applySave(data);
  G.mode = 'playing';
  showBanner('Port Solano', 'Welcome back, Reyes.');
  syncScreens();
}

function togglePause() {
  if (G.mode === 'playing') { G.mode = 'paused'; saveGame(); }
  else if (G.mode === 'paused' || G.mode === 'help') G.mode = 'playing';
  syncScreens();
}

function respawnAfterEnd() {
  // Busted costs a fine and the heat; wasted costs a clinic bill. Either
  // way Reyes wakes at the Clínica with the story intact.
  const fine = G.mode === 'busted' ? Math.min(300, Math.floor(G.cash * 0.25)) : 150;
  G.cash = Math.max(0, G.cash - fine);
  clearWanted();
  const clinica = G.zones.find((z) => z.id === 'clinica');
  const p = G.player;
  if (p.car) { p.car.driver = null; p.car = null; }
  p.x = clinica.x + 30; p.y = clinica.y + 40;
  p.hp = p.maxHp;
  p.dead = false;
  G.bust = 0;
  G.mode = 'playing';
  toast(G.mode === 'playing' ? 'Back on the street. -$' + fine : '', '#ff8a7a');
  saveGame();
  syncScreens();
}

// Postcards: small collectible moments for simply being somewhere.
const POSTCARD_SPOTS = [
  { name: 'First sunrise over Marina Azul', test: (pos) => pos.y > 3050 && G.clock > 300 && G.clock < 480 },
  { name: 'Night owl of Port Solano', test: () => G.clock > 1380 || G.clock < 120 },
  { name: 'Beach avenue cruiser', test: (pos) => pos.y > 2900 && !!G.player.car },
  { name: 'Home sweet Casa Reyes', test: (pos) => Math.hypot(pos.x - 2600, pos.y - 600) < 90 },
];

function checkPostcards() {
  const pos = playerPos();
  if (!pos) return;
  for (const spot of POSTCARD_SPOTS) {
    if (!G.postcards.includes(spot.name) && spot.test(pos)) {
      G.postcards.push(spot.name);
      toast('Postcard: ' + spot.name, '#9fc2ff');
      sfx('unlock');
    }
  }
}

function update(dt) {
  G.time += dt;
  // Escape must work from pause too, so it is consumed before the mode gate.
  if ((G.mode === 'playing' || G.mode === 'paused') && consume('Escape')) togglePause();
  if (G.mode !== 'playing') { updateEffects(dt); return; }

  // The day clock: a full day every DAY_LENGTH_SECONDS.
  G.clock += (dt / DAY_LENGTH_SECONDS) * 1440;
  if (G.clock >= 1440) { G.clock -= 1440; G.day++; }

  G.mouse.wx = G.camera.x + mouse.x;
  G.mouse.wy = G.camera.y + mouse.y;
  G.mouse.down = mouse.down;

  updatePlayer(dt);
  if (consume('Escape')) { togglePause(); return; }
  // Combat input: click (or hold for the SMG) fires toward the mouse.
  if (!G.player.car && !G.player.dead) {
    tryPlayerShoot(G.mouse.wx, G.mouse.wy, mouse.down, mouse.down && !update.wasDown);
  }
  update.wasDown = mouse.down;

  updateTraffic(dt);
  maintainTraffic(dt);
  updatePeds(dt);
  updateGunmen(dt);
  updateBullets(dt);
  updatePolice(dt);
  collideCars(dt);
  updateMissions(dt);
  updateEffects(dt);
  checkPostcards();

  // Death check.
  if (G.player.dead && G.mode === 'playing') {
    G.mode = 'wasted';
    sfx('fail');
    syncScreens();
  }

  // Siren follows the nearest live patrol car.
  let siren = false;
  if (G.wanted > 0) {
    const pos = playerPos();
    for (const car of G.cars) {
      if (car.isCop && car.driver === 'cop' && Math.hypot(car.x - pos.x, car.y - pos.y) < 700) siren = true;
    }
  }
  setSiren(siren);

  // Camera: follow with a speed look-ahead while driving.
  const focus = G.player.car || G.player;
  const lookX = G.player.car ? G.player.car.vx * 0.42 : 0;
  const lookY = G.player.car ? G.player.car.vy * 0.42 : 0;
  const tx = clamp(focus.x + lookX - VIEW_W / 2, 0, WORLD_SIZE - VIEW_W);
  const ty = clamp(focus.y + lookY - VIEW_H / 2, 0, WORLD_SIZE - VIEW_H);
  G.camera.x += (tx - G.camera.x) * Math.min(1, dt * 5);
  G.camera.y += (ty - G.camera.y) * Math.min(1, dt * 5);

  // Autosave.
  G.autosaveT += dt;
  if (G.autosaveT >= AUTOSAVE_SECONDS) { G.autosaveT = 0; saveGame(); }
}
update.wasDown = false;

function render() {
  const shakeX = G.shake ? (Math.random() - 0.5) * G.shake : 0;
  const shakeY = G.shake ? (Math.random() - 0.5) * G.shake : 0;
  const camX = G.camera.x + shakeX, camY = G.camera.y + shakeY;
  const lit = nightFactor();
  drawCity(ctx, camX, camY, VIEW_W, VIEW_H, lit);
  drawMissionMarker(ctx, camX, camY, VIEW_W, VIEW_H);
  drawEffects(ctx, camX, camY, VIEW_W, VIEW_H);
  for (const ped of G.peds) {
    if (ped.x < camX - 40 || ped.y < camY - 40 || ped.x > camX + VIEW_W + 40 || ped.y > camY + VIEW_H + 40) continue;
    drawPed(ctx, ped, camX, camY);
  }
  for (const car of G.cars) {
    if (car.x < camX - 70 || car.y < camY - 70 || car.x > camX + VIEW_W + 70 || car.y > camY + VIEW_H + 70) continue;
    drawCar(ctx, car, camX, camY);
  }
  for (const g of G.gunmen) drawGunman(ctx, g, camX, camY);
  for (const o of G.officers) drawOfficer(ctx, o, camX, camY);
  drawPlayer(ctx, camX, camY);
  drawBullets(ctx, camX, camY);
  drawDayTint(ctx, VIEW_W, VIEW_H);
  if (G.mode !== 'title') drawHUD(ctx, VIEW_W, VIEW_H);
}

// ------------------------------------------------------------ menu screens
const screens = {
  title: document.getElementById('titleScreen'),
  pause: document.getElementById('pauseScreen'),
  help: document.getElementById('helpScreen'),
  end: document.getElementById('endScreen'),
};
const endTitle = document.getElementById('endTitle');
const endText = document.getElementById('endText');
const continueBtn = document.getElementById('continueBtn');

function syncScreens() {
  screens.title.style.display = G.mode === 'title' ? 'flex' : 'none';
  screens.pause.style.display = G.mode === 'paused' ? 'flex' : 'none';
  screens.help.style.display = G.mode === 'help' ? 'flex' : 'none';
  const ended = G.mode === 'busted' || G.mode === 'wasted' || G.mode === 'complete';
  screens.end.style.display = ended ? 'flex' : 'none';
  if (G.mode === 'busted') { endTitle.textContent = 'BUSTED'; endText.textContent = 'The Policía Municipal boxed Reyes in. A fine, a night in the cells, and the heat is gone.'; }
  if (G.mode === 'wasted') { endTitle.textContent = 'WASTED'; endText.textContent = 'Reyes wakes up at Clínica del Sol with a bill and a headache.'; }
  if (G.mode === 'complete') { endTitle.textContent = 'SOLANO GOODBYE'; endText.textContent = 'Bruno Vane is finished, Alba pays the last envelope, and Port Solano is quiet — for now. Courier work at the Marina never ends. Missions done: ' + G.stats.missionsDone + ' · Earned: $' + G.stats.earned.toLocaleString('en-US'); }
  if (continueBtn) continueBtn.style.display = hasSave() ? 'block' : 'none';
}

window.PS = {
  startNewGame,
  continueGame,
  togglePause,
  respawnAfterEnd,
  showHelp() { G.modeBeforePause = G.mode; G.mode = 'help'; syncScreens(); },
  backFromHelp() { G.mode = G.modeBeforePause === 'help' ? 'title' : G.modeBeforePause; if (G.mode === 'title' && !G.player) G.mode = 'title'; syncScreens(); },
  saveAndTitle() { saveGame(); G.mode = 'title'; syncScreens(); },
  wipeAndNew() { wipeSave(); startNewGame(); },
};
document.getElementById('newBtn').addEventListener('click', () => { initAudio(); sfx('ui'); startNewGame(); });
if (continueBtn) continueBtn.addEventListener('click', () => { initAudio(); sfx('ui'); continueGame(); });
document.getElementById('resumeBtn').addEventListener('click', () => { sfx('ui'); togglePause(); });
document.getElementById('pauseSaveBtn').addEventListener('click', () => { saveGame(); toast('Saved.', '#7be495'); sfx('ui'); });
document.getElementById('pauseHelpBtn').addEventListener('click', () => { window.PS.showHelp(); });
document.getElementById('helpBackBtn').addEventListener('click', () => { window.PS.backFromHelp(); });
document.getElementById('endBtn').addEventListener('click', () => { respawnAfterEnd(); });
canvas.addEventListener('mousedown', () => initAudio());
window.addEventListener('keydown', (e) => {
  initAudio();
  if (e.code === 'Escape' && G.mode === 'help') window.PS.backFromHelp();
  if (e.code === 'KeyH' && G.mode === 'playing') window.PS.showHelp();
  void keys;
});

// ------------------------------------------------------------------- boot
buildWorld();
resetProgress();
G.mode = 'title';
const shotName = params.get('shot');
if (shotName) setupShot(shotName);
syncScreens();

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (params.get('test') === '1' && !frame.testDone) {
    frame.testDone = true;
    startNewGame();
    runSelfTest(window.PS);
  }
  update(dt);
  render();
  endFrameInput();
  window.requestAnimationFrame(frame);
}
window.requestAnimationFrame(frame);
