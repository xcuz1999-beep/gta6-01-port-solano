# Port Solano

An original open-world crime game for the make.fun **gta6-01** bounty — built
in the spirit of the genre, with every name, place, character and line of
story its own.

You are **Reyes**, a wheelman new in the sun-soaked coastal city of Port
Solano. Fixer **Alba Ferrer** has six jobs that tell the whole story: steal a
coupe, run hot cargo, collect a debt at speed, outrun a three-star heat,
defend the chop shop from the Vantrek crew, and drive the Solano goodbye.

## What's in the world

- A full city grid — avenues, streets, plazas, a beach and marina — explored
  on foot and by car, with live traffic that drives the road network and
  pedestrians who stroll, chat and flee.
- Any car can be stolen (locked ones take a noisy break-in); arcade driving
  with drifting, damage, skid marks and wrecks.
- A five-star wanted system: police patrol cars pursue and ram, officers get
  out and shoot, and laying low decays the heat.
- Combat on foot: fists, a pistol and an unlockable Micro SMG, mouse-aimed.
- HUD with a live minimap (streets, water, police blips, objective marker),
  health, cash, wanted stars, speedometer and objective line.
- Start screen, pause, save/load via localStorage, busted/wasted respawns,
  courier jobs after the story, and 8 collectible postcards in free roam.
- All sound is synthesized with WebAudio — engine, sirens, shots, jingles.
  No audio files, no network: the game is static files under `game/`.

## Run it

```
node serve.ts          # serves game/ at http://localhost:8080
```

Or hand the entry in (what the grader runs):

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Layout

- `game/index.html` — the page shell
- `game/src/` — one module per job: `city` (the world), `vehicles`,
  `traffic`, `pedestrians`, `police` (wanted system), `player`, `combat`,
  `missions` (the story), `hud` (minimap + screens), `audio`, `effects`,
  `save`, `shots` (screenshot scenes), `main` (the loop)
- `main.ts` — copies `game/` + `screenshots/` to the output and writes the
  dossier with `vendor/makefun-game.ts`
- `screenshots/` — four real renders of the game, listed in `shots.json`

MIT licensed.
