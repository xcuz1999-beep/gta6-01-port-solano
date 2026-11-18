// Port Solano — config.js
// World constants, tuning tables, car archetypes and the weapon table.
// Everything gameplay-related that a designer would tweak lives here so the
// other modules stay about behaviour, not numbers.

export const WORLD_SIZE = 3600;          // the city is a square, pixels
export const ROAD_SPACING = 400;         // distance between road centrelines
export const ROAD_WIDTH = 96;            // asphalt width
export const ROAD_ORIGIN = 200;          // first road centreline coordinate
export const SEA_Y = 3420;               // water starts here (south edge)
export const SAND_Y = 3160;              // beach sand starts here
export const VIEW_W = 1280;
export const VIEW_H = 800;

export const PLAYER_RADIUS = 11;
export const PLAYER_WALK_SPEED = 168;
export const PLAYER_RUN_SPEED = 252;
export const PLAYER_MAX_HP = 100;

export const DAY_LENGTH_SECONDS = 240;   // one full in-game day
export const START_MINUTES = 9 * 60 + 20; // new games begin mid-morning

export const SAVE_KEY = 'port-solano-save-v1';
export const AUTOSAVE_SECONDS = 20;

// Car archetypes: body size, pace, toughness and the paint palette the
// traffic spawner picks from. `coupe` and `sport` are the fun ones to steal.
export const CAR_TYPES = {
  sedan: { w: 44, h: 21, accel: 300, top: 330, grip: 5.2, hp: 120, colors: ['#c8ccd2', '#7d8894', '#a33327', '#2e4d6b', '#3f3f46', '#77683c'] },
  coupe: { w: 46, h: 20, accel: 380, top: 420, grip: 5.8, hp: 110, colors: ['#d9a441', '#8c1f28', '#203864', '#e8e4da', '#5b2a86'] },
  sport: { w: 47, h: 20, accel: 470, top: 520, grip: 6.4, hp: 100, colors: ['#e4572e', '#17bebb', '#ffc914', '#76b041', '#ef476f'] },
  van:   { w: 52, h: 24, accel: 240, top: 270, grip: 4.4, hp: 170, colors: ['#d8d5cc', '#5d6d7e', '#34495e', '#8a7f5c'] },
  taxi:  { w: 44, h: 21, accel: 310, top: 340, grip: 5.2, hp: 120, colors: ['#f2b705'] },
  cop:   { w: 46, h: 21, accel: 430, top: 470, grip: 6.0, hp: 190, colors: ['#18222e'] },
};

// Weapons: fists are always owned; the pistol is bought at the Armeria and
// the SMG is a story unlock (mission 3) that can also be bought late.
export const WEAPONS = {
  fists:  { name: 'Fists',  damage: 22, rate: 0.34, range: 30,  spread: 0,    speed: 0,    auto: false, ammoType: null },
  pistol: { name: 'Pistol', damage: 34, rate: 0.27, range: 460, spread: 0.02, speed: 900,  auto: false, ammoType: 'pistol', price: 350 },
  smg:    { name: 'SMG',    damage: 16, rate: 0.095, range: 420, spread: 0.07, speed: 950, auto: true,  ammoType: 'smg', price: 900 },
};

export const WEAPON_ORDER = ['fists', 'pistol', 'smg'];

// Named places. Coordinates sit on road junctions so a mission marker is
// always reachable by car; the flavour text is what the HUD banner shows.
export const ZONE_DEFS = [
  { id: 'chopshop', name: "Alba's Chop Shop", short: 'Chop Shop', x: 600,  y: 600,  kind: 'fixer' },
  { id: 'clinica',  name: 'Clínica del Sol',  short: 'Clínica',   x: 1400, y: 1000, kind: 'clinic' },
  { id: 'marina',   name: 'Marina Azul',      short: 'Marina',    x: 1800, y: 3300, kind: 'marina' },
  { id: 'casa',     name: 'Casa Reyes',       short: 'Safehouse', x: 2600, y: 600,  kind: 'safehouse' },
  { id: 'armeria',  name: 'Armería Solano',   short: 'Armería',   x: 3000, y: 1800, kind: 'gunshop' },
];

export const COP_SPAWN_DISTANCE = 620;   // police appear just off camera
export const WITNESS_RADIUS = 270;       // peds inside this see a crime
export const HEAT_DECAY_TIME = 14;       // unseen seconds to drop a star
