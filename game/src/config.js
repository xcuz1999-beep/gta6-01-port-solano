// Port Solano — config.js
// World tuning, vehicle archetypes and the weapon table live here so the
// rest of the game never hard-codes a balance number.

export const WORLD_SIZE = 3600;
export const ROAD_STEP = 400;
export const ROAD_WIDTH = 92;
export const PLAYER_SPEED = 178;
export const PLAYER_RADIUS = 13;
export const SAVE_KEY = "port-solano-save-v1";
export const DAY_LENGTH = 240;

export const ZONES = [
  { id: "chopshop", name: "Alba's Chop Shop", x: 600, y: 600, color: "#e0a458" },
  { id: "clinic", name: "Clinica del Sol", x: 3000, y: 600, color: "#7fd6a4" },
  { id: "marina", name: "Marina Azul", x: 3050, y: 3050, color: "#6fc3e7" },
  { id: "safehouse", name: "Casa Reyes", x: 600, y: 3000, color: "#f2d06b" },
  { id: "gunshop", name: "Armeria Solano", x: 1800, y: 1800, color: "#e77f7f" },
];

export const CAR_TYPES = [
  { name: "Coupe", w: 44, h: 22, top: 330, accel: 260, grip: 0.92, colors: ["#d94f3d", "#e8b13a", "#3d7bd9", "#e8e8e8"] },
  { name: "Sedan", w: 48, h: 24, top: 285, accel: 215, grip: 0.9, colors: ["#8a93a3", "#33415c", "#6b8f71", "#c9c9c9"] },
  { name: "Pickup", w: 52, h: 26, top: 260, accel: 200, grip: 0.86, colors: ["#7a4a2b", "#4a6741", "#555f6e"] },
  { name: "Van", w: 54, h: 27, top: 235, accel: 180, grip: 0.84, colors: ["#d8d3c3", "#5b7a99", "#8c8c8c"] },
];

export const WEAPONS = {
  fists: { name: "Fists", damage: 14, range: 36, cooldown: 0.32, ammo: Infinity, spread: 0 },
  pistol: { name: "Pistol", damage: 26, range: 430, cooldown: 0.28, ammo: 60, spread: 0.03, speed: 760 },
  smg: { name: "SMG", damage: 17, range: 380, cooldown: 0.1, ammo: 160, spread: 0.09, speed: 820 },
};

export const STAR_THRESHOLDS = [0, 12, 30, 55, 85, 125];
export const BUST_TIME = 2.4;
export const HEAT_DECAY = 7;
