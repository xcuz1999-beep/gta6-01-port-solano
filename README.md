# Port Solano

A top-down open-world crime game that runs entirely in the browser — no
build step, no dependencies, no network. Serve the `game/` folder with any
static server (or run `node serve.ts` and open http://localhost:8080).

You are **Reyes**, back in the sun-baked port city of Port Solano. Fixer
**Alba Ferrer** has work for you; **Bruno Vane** and his Vantrek crew have
other plans. Work the six-mission story, build your cash, and try not to
let the Solano PD put you away.

## Controls

- **WASD / arrows** — walk and drive
- **E** — enter / exit a car (hold **E** next to a locked car to break in)
- **Space** — handbrake drift · **Shift** — sprint
- **Mouse** — aim · **click / F** — punch or shoot
- **1 / 2 / 3** — fists / pistol / SMG
- **Q** at a named zone — take the next story job (or a courier run)
- **Esc** — pause · **M** — mute

## What's in the city

- A seeded 3600px city: road grid, buildings with lit windows at night,
  beach, sea and marina, palm avenues, and five named zones — Alba's Chop
  Shop, Clínica del Sol, Marina Azul, Casa Reyes and Armería Solano.
- Live traffic that drives the road network, parked cars (some locked,
  with alarms), and pedestrians who stroll, flee danger and report crimes.
- A 1–5 star wanted system: witness reports build heat, patrol cars
  pursue and ram, officers get out and shoot at three stars and up, and a
  bust meter fills when you are cornered. Lay low, or visit the clinic or
  your safehouse, to clear the heat.
- Combat with fists, a pistol and an unlockable SMG against Vantrek gunmen.
- A six-mission story chain (talk, drive, fight and deliver jobs) paying
  out up to a $7,500 finale, then endless courier runs.
- HUD with cash, clock, health, weapon and wanted stars, a live minimap,
  day/night tint, skid marks, particles and procedural WebAudio (engine,
  sirens, gunshots, pickups) — plus a localStorage save with autosave.

## Layout

- `game/index.html` — the page; `game/src/` holds one module per system
  (city, vehicles, traffic, pedestrians, player, combat, police, missions,
  hud, save, audio, effects, plus boot, input, state, config and helpers).
- `main.ts` — the make.fun hand-in program; `serve.ts` — the dev server.
- Handy URLs: `?seed=7` for another city, `?shot=cover` (also `chase`,
  `combat`, `drive`) for posed scenes, `?test=1` for the self-test.
