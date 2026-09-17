# Voxelcraft — W1 World / Render Core

A Bedrock-1.4-style first-person 3D voxel world running in the browser
(WebGL via Three.js, no external build step, no Copied assets — all textures
are original procedural pixel art).

This is the **world/rendering core** (W1) used as a base by later player
interaction modules:

- **Reproducible seeded world generation** — column-based value/ridged noise
  (FNV-1a + mulberry32 PRNG), fully deterministic and independent of chunk
  boundaries. Same seed ⇒ identical terrain anywhere / anytime.
- **Biomes**: plains, forest, desert, mountains, snowy plains, beach, plus
  cold/warm × shallow/deep oceans.
- **Chunked load/unload streaming** around the first-person player.
- **First-person 3D rendering**: block world, day/night sky, fog, sun/moon,
  crosshair, hand-held block, original pixel textures, and a
  Bedrock-1.4-style HUD (hotbar, health/hunger, XP).
- **Responsive layout** that stays usable after window resize (C02).

## Run

```bash
npm install            # (dev) installs nothing extra for the core; only headless tooling uses deps
npx serve -l 8080 .    # or: npm run serve
# open http://localhost:8080/?seed=canyon7
```

Controls: click to lock mouse · WASD move · Space jump · Shift sneak · Ctrl sprint ·
T day/night toggle · R reset view.

## Verify

```bash
npm test                                       # node unit tests (world/gen/chunk/mesh determinism + biomes)
node tools/fingerprint.mjs canyon7 140 10      # fixed-seed terrain digest (reproducibility evidence)
```

Headless browser verification + screenshots:

```bash
cd tools/headless && npm install                # playwright-core for the driver
node serve.mjs ../../ 8123 &                    # static server (no deps needed)
SEED=canyon7 node verify.mjs                    # repro + chunk streaming + resize layout
SEED=canyon7 node shot.mjs                      # captures evidence/*.png + console error check
```

## Layout (W1)

```
index.html               page shell + HUD styles
src/main.js              browser bootstrapping, input, main loop, chunk-mesh sync
src/core/prng.js         FNV-1a hash, mulberry32 PRNG, value/ridged noise
src/world/               pure-JS world core (node-testable, no Three dependency)
  generator.js           seeded terrain + biome classification
  chunk.js               per-column storage + deterministic tree stamping
  world.js               chunk load/unload around player + global block access
  mesher.js              opaque/water triangle generation with face culling
  blocks.js              block registry
src/render/              Three.js web layer
  textures.js            procedural 16x16 pixel-art atlas
  worldrender.js         chunk meshes (opaque + water passes)
  sky.js                 day/night sky, sun/moon, fog
  hud.js                 Bedrock-style HUD (DOM canvas icons)
src/game/player.js       first-person controller (pointer-look, AABB collision)
vendor/three.module.js   vendored Three.js (r1xx, module build)
test/world.test.mjs      node unit tests
tools/fingerprint.mjs    fixed-seed terrain digest tool
tools/headless/          playwright-core capture/verify drivers
evidence/                fixed-seed + visual evidence (PNG, fingerprint)
```

## Acceptance-criteria evidence

- **C01 3D voxel render in browser**: `evidence/overview-day.png`,
  `evidence/overview-dusk.png`, `evidence/ground-level.png` (block world,
  sky, fog, crosshair, held block, HUD).
- **C02 resize layout**: `verify.mjs` relayouts to 360×640; hotbar/crosshair
  stay centered, no console/page errors (final_errors `[]`).
- **C03 reproducible seed + biomes + chunk load/unload**: `evidence/fixed-seed-fingerprint.txt`
  shows identical digest `f233c317` for seed `canyon7` across runs; unit
  tests assert plains/forest/desert/mountains + cold/warm/shallow/deep ocean;
  `verify.mjs` proves load/unload stream + same-seed match in-browser.
- **C04 fixed-seed consistency + screenshots**: fingerprint + PNGs above.

Fixed seed used everywhere: `canyon7`.
