// Port Solano — missions.js
// A nine-mission story chain for Reyes and Alba Ferrer against Bruno Vane's
// Vantrek crew, built from four step types (talk, drive, fight, deliver).
// Missions unlock weapons through a data-driven `unlock` field and steps
// can carry a `heat` payload that draws PD attention mid-run. Endless
// repeatable courier runs open once the story is done.

import { G, banner, toast } from "./state.js";
import { dist } from "./random.js";
import { makeGunman } from "./combat.js";
import { sfx } from "./audio.js";
import { floater } from "./effects.js";
import { saveGame } from "./save.js";

export const STORY = [
  { title: "First Wheels", reward: 250, unlock: "pistol", steps: [
    { type: "talk", x: 600, y: 600, label: "Meet Alba at the Chop Shop", text: "Alba: Reyes, Vantrek took my yard. Start by getting us wheels." },
    { type: "drive", x: 1800, y: 1000, label: "Drive to the midtown lot", needCar: true },
  ] },
  { title: "Hot Cargo", reward: 500, steps: [
    { type: "talk", x: 600, y: 600, label: "Get the job from Alba", text: "Alba: A crate fell off a Vantrek truck at the marina. Bring it home." },
    { type: "drive", x: 3050, y: 3050, label: "Reach Marina Azul", needCar: true },
    { type: "deliver", x: 600, y: 3000, label: "Deliver the crate to Casa Reyes", needCar: true },
  ] },
  { title: "Dockside Toll", reward: 650, steps: [
    { type: "talk", x: 3050, y: 3050, label: "Meet Alba at Marina Azul", text: "Alba: The dock crews pay Vantrek for protection. Take the toll back." },
    { type: "fight", x: 3050, y: 2980, count: 3, label: "Take back the docks from Vantrek" },
    { type: "deliver", x: 600, y: 600, label: "Bring the toll to Alba", needCar: true },
  ] },
  { title: "The Debt", reward: 800, unlock: "smg", steps: [
    { type: "talk", x: 600, y: 3000, label: "Talk at Casa Reyes", text: "Alba: Bruno's collectors are shaking down the clinic. Persuade them." },
    { type: "fight", x: 3000, y: 600, count: 3, label: "Drive off the collectors at the clinic" },
  ] },
  { title: "Night Run", reward: 1200, steps: [
    { type: "talk", x: 600, y: 600, label: "Meet Alba after dark", text: "Alba: Move this package across town. No questions." },
    { type: "deliver", x: 3050, y: 3050, label: "Run the package to Marina Azul", needCar: true },
    { type: "deliver", x: 600, y: 600, label: "Return to the Chop Shop", needCar: true },
  ] },
  { title: "Siren Song", reward: 1500, steps: [
    { type: "talk", x: 600, y: 600, label: "Get the job from Alba", text: "Alba: This crate is hot — the PD will be watching. Run it to the marina anyway." },
    { type: "deliver", x: 3050, y: 3050, label: "Run the hot crate to Marina Azul", needCar: true, heat: 55 },
    { type: "deliver", x: 600, y: 3000, label: "Lay low at Casa Reyes", needCar: true },
  ] },
  { title: "Rival Colors", reward: 2000, steps: [
    { type: "talk", x: 1800, y: 1800, label: "Meet the contact at Armeria Solano", text: "Contact: Vantrek is massing at the gun shop block. End it." },
    { type: "fight", x: 2050, y: 1800, count: 5, label: "Clear the Vantrek crew" },
  ] },
  { title: "Vane's Vault", reward: 3200, steps: [
    { type: "talk", x: 1800, y: 1800, label: "Meet the contact at Armeria Solano", text: "Contact: Bruno keeps the crew's money in a midtown garage. Empty it." },
    { type: "fight", x: 2200, y: 1400, count: 6, label: "Empty Vane's vault crew" },
    { type: "drive", x: 600, y: 3000, label: "Get the take home to Casa Reyes" },
  ] },
  { title: "Solano Goodbye", reward: 7500, steps: [
    { type: "talk", x: 600, y: 600, label: "Final word with Alba", text: "Alba: Bruno is leaving by boat tonight. Make sure he waves goodbye." },
    { type: "fight", x: 3050, y: 3050, count: 4, label: "Stop Bruno's crew at the marina" },
    { type: "drive", x: 600, y: 3000, label: "Get home to Casa Reyes", needCar: false },
  ] },
];

export function startStoryMission(index) {
  const def = STORY[index];
  if (!def) return false;
  G.mission = { def, index, step: 0, kind: "story" };
  banner("Mission: " + def.title);
  toast(def.steps[0].label);
  primeStep();
  return true;
}

export function startCourier() {
  const spots = [[600, 600], [3000, 600], [3050, 3050], [600, 3000], [1800, 1800], [1000, 2600], [2600, 1000]];
  const from = spots[Math.floor(Math.random() * spots.length)];
  let to = spots[Math.floor(Math.random() * spots.length)];
  if (to === from) to = spots[0];
  G.mission = { def: { title: "Courier Run", reward: 180 + G.courierCount * 20 }, index: -1, step: 0, kind: "courier",
    defSteps: [{ type: "drive", x: from[0], y: from[1], label: "Pick up the parcel", needCar: false }, { type: "deliver", x: to[0], y: to[1], label: "Deliver the parcel", needCar: true }] };
  G.mission.def.steps = G.mission.defSteps;
  banner("Courier Run — $" + G.mission.def.reward);
  primeStep();
  return true;
}

function primeStep() {
  const m = G.mission; if (!m) return;
  const step = m.def.steps[m.step];
  if (step && step.heat && !step._heated) {
    step._heated = true;
    G.heat += step.heat;
    toast("Sirens — the PD is onto this run!");
  }
  if (step && step.type === "fight") {
    G.gunmen = [];
    for (let i = 0; i < step.count; i++) {
      G.gunmen.push(makeGunman(step.x + (Math.random() - 0.5) * 130, step.y + (Math.random() - 0.5) * 130));
    }
  }
}

export function currentStep() {
  if (!G.mission) return null;
  return G.mission.def.steps[G.mission.step] || null;
}

export function updateMissions(dt) {
  const m = G.mission; if (!m) return;
  const step = currentStep(); if (!step) return finishMission();
  const pl = G.player;
  if (step.type === "fight") {
    if (G.gunmen.every((g) => g.dead)) advanceStep();
    return;
  }
  const d = dist(pl.x, pl.y, step.x, step.y);
  if (d < 58) {
    if (step.needCar && !pl.car) { if (Math.random() < dt * 0.6) toast("You need a car for this leg."); return; }
    if (step.text) toast(step.text, 4.2);
    advanceStep();
  }
}

function advanceStep() {
  const m = G.mission;
  m.step++;
  sfx.pickup();
  if (m.step >= m.def.steps.length) finishMission();
  else { toast(m.def.steps[m.step].label); primeStep(); }
}

function finishMission() {
  const m = G.mission;
  G.cash += m.def.reward;
  floater(G.player.x, G.player.y - 20, "+$" + m.def.reward);
  sfx.cash(); sfx.stinger(true);
  banner("Mission complete — $" + m.def.reward);
  if (m.kind === "story") {
    G.storyIndex = m.index + 1;
    if (m.def.unlock === "smg" && !G.weapons.smg) {
      G.weapons.smg = true; G.ammo.smg += 120; G.weapon = "smg";
      toast("Alba hands you an SMG. Press 3 to equip it.");
    }
    if (m.def.unlock === "pistol" && !G.weapons.pistol) {
      G.weapons.pistol = true; G.ammo.pistol += 48;
      toast("You picked up a pistol. Press 2 to equip it.");
    }
    if (G.storyIndex >= STORY.length) G.mode = "complete";
  } else G.courierCount++;
  G.mission = null;
  saveGame();
}

export function missionMarker() {
  const step = currentStep();
  if (!step || !G.mission) return null;
  return {
    x: step.x, y: step.y, label: step.label,
    title: G.mission.def.title,
    step: G.mission.step + 1,
    total: G.mission.def.steps.length,
  };
}
