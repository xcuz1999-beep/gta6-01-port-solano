# Port Solano

An original open-world crime game that runs in a desktop browser from static
files — no build step, no dependencies, no network. Serve the `game/` folder
with any static server (or run `node serve.ts` and open
http://localhost:8080), and play with keyboard and mouse.

## The story

Reyes returns to Port Solano, a sun-baked coastal city of palm avenues and
back-street garages. Fixer **Alba Ferrer** runs work out of her Chop Shop and
needs a driver she can trust. Rival **Bruno Vane** and the **Vantrek** crew
are squeezing the Marina, buying guns, and collecting debts that are not
theirs. Six story missions take Reyes from a first borrowed ride to a final
showdown at Marina Azul — with a weapon unlock, cash rewards, and the
Policía Municipal taking an interest throughout.

Places that matter: **Alba's Chop Shop** (story), **Clínica del Sol** (heal,
and lose some heat), **Marina Azul** (deliveries and courier work),
**Casa Reyes** (safehouse — rest and save), **Armería Solano** (weapons and
ammo).

## Controls

| Keys | Action |
| --- | --- |
| WASD / arrows | Move / drive |
| Mouse | Aim on foot |
| Click / hold | Punch or shoot (SMG is automatic) |
| E | Enter/exit a car, talk, buy, use a place |
| Hold E | Break into a locked car (sets off the alarm) |
| Shift | Run |
| Space | Handbrake / drift |
| 1 / 2 / 3, Q | Fists / Pistol / SMG, or cycle weapons |
| Esc | Pause |
| H | Help |

## Systems

- **A living city**: a seeded road grid with buildings, sidewalks, a beach
  and the sea; AI traffic that drives the network in right-hand lanes, and
  pedestrians who stroll, flee danger, can be knocked down — and witness
  crimes.
- **Cars to steal and drive**: parked and moving traffic, locked cars with a
  timed break-in and alarm, arcade physics with drifting, damage, smoke and
  wrecks.
- **Wanted & police**: one to five stars driven by witness reports; patrol
  cars pursue and ram, officers deploy and shoot at high heat, a bust meter
  fills when you are boxed in, and staying unseen cools the trail.
- **Missions**: a six-mission story chain (talk, drive, fight and deliver
  steps with gold markers and distance readouts) plus repeatable timed
  courier runs.
- **Combat**: fists, pistol and SMG against Vantrek gunmen who strafe and
  shoot back.
- **HUD & minimap**: cash, day/night clock, health, weapon and ammo, wanted
  stars — and a live minimap with streets, water, police, pedestrians and
  your objective.
- **Save system**: localStorage saves with autosave, a safehouse save point,
  and Continue on the title screen.
- **Polish**: a full day cycle with dusk and lit windows at night, particles,
  skid marks, screen shake, and procedural WebAudio — engine, sirens,
  gunshots and UI, all synthesized, no audio files.

## Development hooks

- `?shot=cover|chase|combat|drive&seed=1` — deterministic scenes used for the
  screenshots in `screenshots/`.
- `?test=1&seed=1` — a scripted playability self-test that logs
  `SELFTEST ALL PASS` when movement, car entry/exit, driving, the wanted
  system, save/load, mission start and pause all check out.

## Hand-in

`node main.ts` (with `MAKEFUN_OUTPUT_DIR` set outside the grader) copies
`game/` and `screenshots/` to the output directory and writes `dossier.json`
there using the kit's `buildDossier`.
