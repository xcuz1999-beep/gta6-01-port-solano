// Port Solano — selftest.js
// A scripted playability test (?test=1&seed=1). It drives the real game
// through the same public controls a player uses — key state, the enter-car
// action, the wanted system, save/load, mission start, pause — stepping the
// actual update functions, and logs one PASS/FAIL line per check plus a
// final verdict to the console and into the page for headless runners.

import { G } from './state.js';
import { setKey, clearKeys } from './input.js';
import { updatePlayer, tryEnterExit } from './player.js';
import { stepCar } from './vehicles.js';
import { saveGame, loadGame, applySave } from './save.js';
import { updateMissions } from './missions.js';

const results = [];

function report(ok, label) {
  results.push({ ok, label });
  console.log((ok ? 'PASS ' : 'FAIL ') + label);
}

function stepPlayerFrames(frames, dt = 1 / 30) {
  for (let i = 0; i < frames; i++) updatePlayer(dt);
}

export function runSelfTest(api) {
  results.length = 0;
  try {
    // 1 — A new game enters playing mode with Reyes alive in the world.
    api.startNewGame();
    report(G.mode === 'playing' && !!G.player && G.player.hp > 0, 'new game enters playing mode');

    // 2 — Walking moves the player.
    const startX = G.player.x, startY = G.player.y;
    setKey('KeyW', true);
    stepPlayerFrames(24);
    setKey('KeyW', false);
    const walked = Math.hypot(G.player.x - startX, G.player.y - startY);
    report(walked > 25, 'walking moves the player');

    // 3 — An unlocked parked car exists in the world.
    const parked = G.cars.find((c) => c.parked && !c.locked && !c.wrecked);
    report(!!parked, 'an unlocked parked car exists');

    // 4 — E enters that car.
    if (parked) {
      G.player.x = parked.x + 30; G.player.y = parked.y;
      const entered = tryEnterExit();
      report(entered && G.player.car === parked, 'E enters the car');
    } else report(false, 'E enters the car');

    // 5 — Driving moves the car.
    if (G.player.car) {
      const car = G.player.car;
      const cx = car.x, cy = car.y;
      for (let i = 0; i < 40; i++) stepCar(car, 1, 0, false, 1 / 30);
      report(Math.hypot(car.x - cx, car.y - cy) > 40, 'driving moves the car');
    } else report(false, 'driving moves the car');

    // 6 — E exits the car again.
    if (G.player.car) {
      const exited = tryEnterExit();
      report(exited && !G.player.car, 'E exits the car');
    } else report(false, 'E exits the car');

    // 7 — A witnessed serious crime raises the wanted level to 3.
    G.wanted = 0; G.reports = [];
    const witness = G.peds[0];
    if (witness) { witness.state = 'walk'; witness.x = G.player.x + 40; witness.y = G.player.y; witness.reportCooldown = 0; }
    if (G.commitCrime) G.commitCrime('hitped', G.player.x, G.player.y);
    // Deliver any witness report immediately, as the police update would.
    for (const r of G.reports) { if (r.severity > G.wanted) G.wanted = Math.min(5, r.severity); }
    report(G.wanted >= 3, 'a witnessed crime raises wanted to 3');
    G.wanted = 0; G.reports = [];

    // 8 — Save writes and loads back.
    G.cash = 4321;
    const saved = saveGame();
    G.cash = 1;
    const data = loadGame();
    const applied = data && applySave(data);
    report(saved && !!applied && G.cash === 4321, 'save writes and loads back');

    // 9 — The first story mission starts when Reyes reaches Alba.
    G.mission = null; G.missionIndex = 0; G.storyDone = false;
    const alba = G.zones.find((z) => z.id === 'chopshop');
    G.player.x = alba.x + 20; G.player.y = alba.y + 20;
    updateMissions(0.1);
    report(!!G.mission && G.mission.def.title === 'First Wheels', 'first story mission starts');

    // 10 — Pause holds the game, and resume returns to play.
    api.togglePause();
    const pausedOk = G.mode === 'paused';
    api.togglePause();
    report(pausedOk && G.mode === 'playing', 'pause holds the game');
  } catch (err) {
    console.error('SELFTEST ERROR', err);
    report(false, 'selftest crashed: ' + (err && err.message));
  }
  clearKeys();
  const passed = results.filter((r) => r.ok).length;
  const verdict = passed === results.length ? 'SELFTEST ALL PASS' : 'SELFTEST FAILED ' + passed + '/' + results.length;
  console.log(verdict + ' :: ' + results.map((r) => (r.ok ? 'PASS ' : 'FAIL ') + r.label).join(' | '));
  const el = document.getElementById('testlog');
  if (el) el.textContent = verdict + '\n' + results.map((r) => (r.ok ? 'PASS ' : 'FAIL ') + r.label).join('\n');
  document.title = verdict;
  return results;
}
