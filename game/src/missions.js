// Port Solano — missions.js
// The story chain: six missions for fixer Alba Ferrer against Bruno Vane and
// the Vantrek crew, told in talk / drive / fight / deliver steps with a gold
// marker, cash rewards and the SMG unlock — plus repeatable courier runs out
// of Marina Azul once the story is done (or between chapters).

import { G, toast, showBanner, addCash } from './state.js';
import { spawnGunman, clearGunmen } from './combat.js';
import { playerPos } from './player.js';
import { sfx } from './audio.js';
import { saveGame } from './save.js';

function zone(id) { return G.zones.find((z) => z.id === id); }

// Step kinds: talk/deliver = reach the marker (deliver implies carrying the
// thing, which the step text says), drive = reach it in any vehicle or on
// foot (the marker is the destination), fight = clear spawned gunmen there.
export const STORY = [
  {
    title: 'First Wheels',
    intro: 'Alba needs Reyes mobile. Meet her at the Chop Shop, then take her regards to Marina Azul.',
    reward: 400,
    steps: [
      { kind: 'talk', zone: 'chopshop', text: 'Meet Alba at the Chop Shop' },
      { kind: 'drive', zone: 'marina', text: 'Drive to Marina Azul' },
      { kind: 'talk', zone: 'chopshop', text: 'Report back to Alba' },
    ],
  },
  {
    title: 'Hot Cargo',
    intro: 'A quiet package waits at the Clínica. No questions, no sirens.',
    reward: 650,
    steps: [
      { kind: 'talk', zone: 'chopshop', text: 'Get the job from Alba' },
      { kind: 'deliver', zone: 'clinica', text: 'Collect the package at Clínica del Sol' },
      { kind: 'deliver', zone: 'marina', text: 'Deliver the package to Marina Azul' },
    ],
  },
  {
    title: 'The Debt',
    intro: 'Vantrek collectors are leaning on the Marina. Alba wants them gone — and leaves Reyes an SMG.',
    reward: 900,
    steps: [
      { kind: 'talk', zone: 'chopshop', text: 'Get the job from Alba' },
      { kind: 'fight', zone: 'marina', count: 3, text: 'Clear the Vantrek crew at the Marina' },
      { kind: 'talk', zone: 'chopshop', text: 'Tell Alba the debt is settled' },
    ],
  },
  {
    title: 'Night Run',
    intro: 'Medicine to Casa Reyes, then a pickup at the Marina. Keep it smooth.',
    reward: 1200,
    steps: [
      { kind: 'deliver', zone: 'clinica', text: 'Pick up medicine at the Clínica' },
      { kind: 'deliver', zone: 'casa', text: 'Drop it at Casa Reyes' },
      { kind: 'drive', zone: 'marina', text: 'Finish the run at Marina Azul' },
    ],
  },
  {
    title: 'Rival Colors',
    intro: 'Bruno Vane is buying guns at the Armería. Interrupt the sale.',
    reward: 1600,
    steps: [
      { kind: 'talk', zone: 'chopshop', text: 'Get the job from Alba' },
      { kind: 'fight', zone: 'armeria', count: 4, text: 'Break up the arms sale at the Armería' },
      { kind: 'talk', zone: 'chopshop', text: 'Report back to Alba' },
    ],
  },
  {
    title: 'Solano Goodbye',
    intro: 'Bruno Vane himself, at the Marina, with what is left of Vantrek. End it.',
    reward: 7500,
    steps: [
      { kind: 'talk', zone: 'chopshop', text: 'One last job from Alba' },
      { kind: 'fight', zone: 'marina', count: 3, boss: true, text: 'Face Bruno Vane at Marina Azul' },
      { kind: 'talk', zone: 'chopshop', text: 'Say goodbye to Alba' },
    ],
  },
];

export function currentStep() {
  if (!G.mission) return null;
  return G.mission.def.steps[G.mission.step] || null;
}

export function missionTarget() {
  const step = currentStep();
  if (step) { const z = zone(step.zone); return z ? { x: z.x, y: z.y, label: step.text } : null; }
  if (G.courier) return { x: G.courier.x, y: G.courier.y, label: 'Courier delivery' };
  if (!G.storyDone && G.missionIndex < STORY.length) {
    const z = zone('chopshop');
    return z ? { x: z.x, y: z.y, label: 'See Alba at the Chop Shop' } : null;
  }
  if (G.storyDone) { const z = zone('marina'); return z ? { x: z.x, y: z.y, label: 'Courier work at the Marina' } : null; }
  return null;
}

export function startStoryMission(index) {
  const def = STORY[index];
  if (!def) return false;
  G.mission = { def, step: 0, spawned: false };
  showBanner('Mission: ' + def.title, def.intro);
  toast(def.steps[0].text, '#ffd75e');
  sfx('mission');
  return true;
}

export function startNextStoryMission() {
  if (G.storyDone || G.mission) return false;
  return startStoryMission(G.missionIndex);
}

function spawnFight(step) {
  const z = zone(step.zone);
  clearGunmen();
  for (let i = 0; i < (step.count || 3); i++) {
    const a = (i / (step.count || 3)) * Math.PI * 2;
    spawnGunman(z.x + Math.cos(a) * 120, z.y + Math.sin(a) * 120, {});
  }
  if (step.boss) {
    spawnGunman(z.x + 40, z.y - 60, { hp: 280, damage: 11, fireRate: 0.7, boss: true, name: 'Bruno Vane' });
  }
}

function completeMission() {
  const def = G.mission.def;
  const pos = playerPos();
  addCash(def.reward, pos.x, pos.y - 20);
  G.stats.missionsDone++;
  sfx('mission');
  const finishedIndex = G.missionIndex;
  G.mission = null;
  G.missionIndex++;
  showBanner('Mission complete: ' + def.title, '+$' + def.reward + ' — Alba pays on time, every time.');
  if (finishedIndex === 2 && !G.owned.smg) {
    G.owned.smg = true;
    G.ammo.smg += 120;
    toast('Weapon unlocked: SMG (+120 rounds) — press 3', '#7be495');
    sfx('unlock');
  }
  if (G.missionIndex >= STORY.length) {
    G.storyDone = true;
    G.mode = 'complete';
  }
  saveGame();
}

// Courier runs: pick up at the Marina, deliver anywhere in the city, beat
// the clock for a bonus. Repeatable forever.
export function startCourier() {
  const spots = [[600, 2200], [2600, 2600], [1000, 600], [3000, 1000], [600, 1400], [2200, 3000], [3400, 2200], [1400, 2600]];
  const spot = spots[Math.floor(G.fxRng.float() * spots.length) % spots.length];
  const pos = playerPos();
  const d = Math.hypot(spot[0] - pos.x, spot[1] - pos.y);
  G.courier = { x: spot[0], y: spot[1], reward: 160 + Math.round(d / 12), timeLeft: 75 + d / 22 };
  showBanner('Courier run', 'Deliver across Port Solano before the clock runs out.');
  sfx('mission');
}

export function updateMissions(dt) {
  const pos = playerPos();
  if (!pos) return;

  // Offer the next story chapter when Reyes reaches Alba with none active.
  if (!G.mission && !G.storyDone) {
    const z = zone('chopshop');
    if (z && Math.hypot(pos.x - z.x, pos.y - z.y) < 62 && !G.player.car) {
      startNextStoryMission();
    }
  }

  if (G.mission) {
    const step = currentStep();
    if (step) {
      const z = zone(step.zone);
      const d = Math.hypot(pos.x - z.x, pos.y - z.y);
      if (step.kind === 'fight') {
        if (!G.mission.spawned && d < 330) { spawnFight(step); G.mission.spawned = true; toast('Vantrek is here — fight!', '#ff8a7a'); }
        if (G.mission.spawned && G.gunmen.every((g) => g.dead)) advanceStep();
      } else if (d < 58) {
        advanceStep();
      }
    }
  }

  // Courier pickup point lives at the Marina when no story step owns us.
  if (!G.courier && G.storyDone && !G.mission) {
    const z = zone('marina');
    if (z && Math.hypot(pos.x - z.x, pos.y - z.y) < 58) startCourier();
  }
  if (G.courier) {
    G.courier.timeLeft -= dt;
    if (Math.hypot(pos.x - G.courier.x, pos.y - G.courier.y) < 60) {
      const bonus = G.courier.timeLeft > 0 ? Math.round(G.courier.timeLeft * 2) : 0;
      addCash(G.courier.reward + bonus, pos.x, pos.y - 20);
      toast('Delivered! +$' + (G.courier.reward + bonus), '#7be495');
      sfx('cash');
      G.courier = null;
      saveGame();
    } else if (G.courier.timeLeft <= -20) {
      toast('Courier run abandoned.', '#ff8a7a');
      G.courier = null;
    }
  }
}

function advanceStep() {
  G.mission.step++;
  G.mission.spawned = false;
  const step = currentStep();
  if (!step) { completeMission(); return; }
  toast(step.text, '#ffd75e');
  showBanner(G.mission.def.title, step.text);
  sfx('ui');
}

// The pulsing gold pillar that marks the active objective in the world.
export function drawMissionMarker(ctx, camX, camY, viewW, viewH) {
  const target = missionTarget();
  if (!target) return;
  const sx = target.x - camX, sy = target.y - camY;
  const onScreen = sx > -30 && sy > -30 && sx < viewW + 30 && sy < viewH + 30;
  if (onScreen) {
    const bob = Math.sin(G.time * 2.6) * 6;
    ctx.fillStyle = 'rgba(255,215,94,0.20)';
    ctx.beginPath(); ctx.arc(sx, sy, 44 + Math.sin(G.time * 3) * 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd75e';
    ctx.beginPath();
    ctx.moveTo(sx, sy - 58 + bob);
    ctx.lineTo(sx - 13, sy - 82 + bob);
    ctx.lineTo(sx + 13, sy - 82 + bob);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(120,84,0,0.8)';
    ctx.lineWidth = 2; ctx.stroke();
  }
}
