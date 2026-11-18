# Port Solano

A top-down open-world crime game that runs entirely in the browser — no
build step, no dependencies, no network. Serve the `game/` folder with any
static server (or run `node serve.ts` and open http://localhost:8080).

You are **Reyes**, back in the sun-baked port city of Port Solano. Fixer
**Alba Ferrer** has work for you; **Bruno Vane** and his Vantrek crew have
other plans. Work the nine-mission story, build your cash, and try not to
let the Solano PD put you away.

## Controls

- **WASD / arrows** — walk and drive
- **E** — enter / exit a car (hold **E** next to a locked car to break in)
- **Space** — handbrake drift · **Shift** — sprint
- **Mouse** — aim · **click / F** — punch or shoot
- **1 / 2 / 3** — fists / pistol / SMG
- **R** — cycle the car radio (off · Solana FM · Radio Puerto)
- **Q** at a named zone — take the next story job (or a courier run)
- **Esc** — pause · **M** — mute

## What's in the city

- A seeded 3600px city: road grid, buildings with lit windows at night,
  beach, sea and marina, palm avenues, and seven named zones — Alba's Chop
  Shop, Clínica del Sol, Marina Azul, Casa Reyes, Armería Solano, Hotel
  Miramar (a second safehouse: check in to save and clear your heat) and
  Mercado Central (empanadas heal you for $25).
- Denser streets: 22 moving traffic cars that brake for whatever is in
  front of them, 34 parked cars (some locked, with alarms), and 64
  pedestrians who stroll, flee danger and report crimes.
- A 1–5 star wanted system: witness reports build heat, patrol cars
  pursue and ram, foot officers get out and shoot at three stars and up,
  and at four stars and up a **PD helicopter** joins the hunt — its
  searchlight keeps you "seen", so your heat will not decay while it
  circles overhead. A bust meter fills when you are cornered. Lay low, or
  visit the clinic, your safehouse or the Hotel Miramar, to clear the heat.
- A car radio on **R** with two procedural WebAudio stations — Solana FM
  (A-minor synthwave) and Radio Puerto (C-major pentatonic pluck) — that
  only plays while you are behind the wheel.
- Combat with fists, a pistol and an unlockable SMG against Vantrek gunmen.
- A nine-mission story chain (talk, drive, fight and deliver jobs — some
  runs are hot and draw the PD mid-mission) paying out up to a $7,500
  finale, then endless courier runs.
- HUD with cash, clock, health, weapon and wanted stars, a live minimap
  that now marks the named zones, Vantrek gunmen and the PD helicopter,
  day/night tint, skid marks, particles and procedural WebAudio (engine,
  sirens, gunshots, pickups, radio) — plus a localStorage save with
  autosave.

## Layout

- `game/index.html` — the page; `game/src/` holds one module per system
  (city, vehicles, traffic, pedestrians, player, combat, police, missions,
  hud, save, audio, effects, plus boot, input, state, config and helpers).
- `main.ts` — the make.fun hand-in program; `serve.ts` — the dev server.
- Handy URLs: `?seed=7` for another city, `?shot=cover` (also `chase`,
  `combat`, `drive`) for posed scenes, `?test=1` for the self-test.
