// Port Solano — selftest.js
// Scripted playability check for ?test=1&seed=1. It drives the real game
// systems step by step and prints one SELFTEST line to the page and the
// console: ten checks covering start, walking, theft, driving, crime,
// save/load, missions and pause.

import { G } from "./state.js";
import { keys } from "./input.js";
import { tryEnterCar, exitCar } from "./player.js";
import { saveGame, loadGame, applySave } from "./save.js";
import { startStoryMission } from "./missions.js";

export function runSelfTest(api) {
  const results = [];
  const check = (label, ok) => results.push((ok ? "PASS " : "FAIL ") + label);
  try {
    api.newGame();
    check("new game starts", G.mode === "playing" && !!G.player);
    const sx = G.player.x, sy = G.player.y;
    keys.KeyD = true;
    for (let i = 0; i < 30; i++) api.step(1 / 30);
    keys.KeyD = false;
    check("player walks", Math.hypot(G.player.x - sx, G.player.y - sy) > 12);
    const unlocked = G.cars.find((c) => c.parked && !c.locked && !c.wrecked);
    check("an unlocked parked car exists", !!unlocked);
    if (unlocked) { G.player.x = unlocked.x + 20; G.player.y = unlocked.y; G.player.car = null; tryEnterCar(); }
    check("car entry works", !!G.player.car);
    if (G.player.car) {
      const cx = G.player.car.x, cy = G.player.car.y;
      keys.KeyW = true;
      for (let i = 0; i < 40; i++) api.step(1 / 30);
      keys.KeyW = false;
      check("driving moves the car", Math.hypot(G.player.car.x - cx, G.player.car.y - cy) > 14);
      exitCar();
    } else check("driving moves the car", false);
    check("exit works", !G.player.car);
    // park a witness next to the player, then commit a witnessed crime
    if (G.peds.length) { G.peds[0].x = G.player.x + 40; G.peds[0].y = G.player.y; G.peds[0].down = 0; }
    G.heat = 0;
    const { witnessCrime } = window.__psPed || {};
    if (witnessCrime) witnessCrime(G.player.x, G.player.y, 60);
    for (let i = 0; i < 5; i++) api.step(1 / 30);
    check("a witnessed crime raises wanted to 3", G.wanted >= 3);
    G.cash = 4321;
    saveGame();
    const loaded = loadGame();
    G.cash = 1;
    if (loaded) applySave(loaded);
    check("save/load round-trips", G.cash === 4321);
    G.heat = 0; G.cops.length = 0;
    const started = startStoryMission(0);
    check("first mission starts", started && !!G.mission);
    api.togglePause();
    const pausedOk = G.mode === "paused";
    if (pausedOk) api.togglePause();
    check("pause works", pausedOk && G.mode === "playing");
  } catch (err) {
    results.push("FAIL exception: " + (err && err.message));
  }
  const passed = results.filter((r) => r.startsWith("PASS")).length;
  const line = (passed === results.length && results.length === 10 ? "SELFTEST ALL PASS" : "SELFTEST " + passed + "/" + results.length) + " :: " + results.join(" | ");
  console.log(line);
  const el = document.createElement("div");
  el.id = "selftest-result";
  el.textContent = line;
  el.style.cssText = "position:fixed;inset:auto 0 0 0;background:#111;color:#7ee787;font:13px monospace;padding:8px;z-index:99";
  document.body.appendChild(el);
  document.title = line.slice(0, 60);
  return line;
}
