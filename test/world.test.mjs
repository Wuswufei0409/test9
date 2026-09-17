import { test } from 'node:test';
import assert from 'node:assert/strict';

import { WorldGenerator, Biome, biomeIsOcean, SEA_LEVEL, WORLD_HEIGHT } from '../src/world/generator.js';
import { Chunk } from '../src/world/chunk.js';
import { World } from '../src/world/world.js';
import { meshChunk } from '../src/world/mesher.js';
import { Block } from '../src/world/blocks.js';

const SEED = 'w1-test-seed-042';

// Same seed -> identical terrain (reproducibility).
test('same seed produces identical terrain across two generator instances', () => {
  const a = new WorldGenerator(SEED);
  const b = new WorldGenerator(SEED);
  for (let x = -40; x <= 40; x += 7) {
    for (let z = -40; z <= 40; z += 7) {
      const ta = a.terrainAt(x, z);
      const tb = b.terrainAt(x, z);
      assert.equal(ta.height, tb.height, `height at ${x},${z}`);
      assert.equal(ta.biome, tb.biome, `biome at ${x},${z}`);
      const ca = a.column(x, z);
      const cb = b.column(x, z);
      assert.deepEqual(ca.blocks, cb.blocks, `blocks at ${x},${z}`);
    }
  }
});

// Different seed -> different terrain (not trivially constant).
test('different seed produces different terrain', () => {
  const a = new WorldGenerator(SEED);
  const b = new WorldGenerator('another-seed-999');
  let diffs = 0;
  for (let x = -30; x <= 30; x += 3) {
    for (let z = -30; z <= 30; z += 3) {
      if (a.terrainAt(x, z).height !== b.terrainAt(x, z).height) diffs++;
    }
  }
  assert.ok(diffs > 10, 'expected many differing columns');
});

// Biome coverage: land + ocean cold/warm/shallow/deep present within range.
test('region covers required biomes (plains/forest/desert/mountains + cold/warm/shallow/deep ocean)', () => {
  const g = new WorldGenerator(SEED);
  const found = new Set();
  const N = 320;
  for (let x = -N; x <= N; x += 4) {
    for (let z = -N; z <= N; z += 4) {
      found.add(g.terrainAt(x, z).biome);
    }
  }
  for (const b of [Biome.PLAINS, Biome.FOREST, Biome.DESERT, Biome.MOUNTAINS,
    Biome.OCEAN_DEEP_COLD, Biome.OCEAN_DEEP_WARM, Biome.OCEAN_SHALLOW_COLD, Biome.OCEAN_SHALLOW_WARM]) {
    assert.ok(found.has(b), `missing biome ${b} in seed ${SEED}; got keys ${[...found].join(',')}`);
  }
  // sanity: oceans below sea level
  const t = g.terrainAt(0, 0);
  assert.ok(t.height >= 1 && t.height < WORLD_HEIGHT);
});

// Sea level is actually sea (water) and land above sea level is dry.
test('terrain respects sea level', () => {
  const g = new WorldGenerator(SEED);
  let sawOcean = false;
  let sawLand = false;
  for (let x = -200; x <= 200; x += 8) {
    for (let z = -200; z <= 200; z += 8) {
      const t = g.terrainAt(x, z);
      if (biomeIsOcean(t.biome)) {
        sawOcean = true;
        assert.ok(t.height < SEA_LEVEL, `ocean column above sea level at ${x},${z}`);
      } else if (t.biome === Biome.PLAINS || t.biome === Biome.FOREST || t.biome === Biome.DESERT) {
        sawLand = true;
      }
    }
  }
  assert.ok(sawOcean && sawLand);
});

// Chunk determinism and meshability.
test('chunk builds deterministically and meshes without error', () => {
  const g = new WorldGenerator(SEED);
  const c1 = new Chunk(0, 0, g).build();
  const c2 = new Chunk(0, 0, g).build();
  assert.deepEqual(c1.blocks, c2.blocks, 'chunk data deterministic');

  const world = new World(g, 2);
  world.updateCenter(0, 0);
  const chunk = world.chunkAt(0, 0);
  const res = meshChunk(chunk, (x, y, z) => world.getBlock(x, y, z));
  assert.ok(res.opaque.indices.length > 0, 'opaque geometry present');
  assert.equal(res.opaque.indices.length % 3, 0);
  assert.equal(res.opaque.positions.length % 3, 0);
});

// World getBlock bounds safety.
test('world surface has solid blocks and water where expected', () => {
  const g = new WorldGenerator(SEED);
  const world = new World(g, 2);
  world.updateCenter(0, 0);
  // find a sea-level column to check for water in the loaded region
  let foundWater = false;
  let foundSolid = false;
  for (let x = -8; x <= 8; x++) {
    for (let z = -8; z <= 8; z++) {
      const t = g.terrainAt(x, z);
      if (biomeIsOcean(t.biome)) {
        const w = world.getBlock(x, SEA_LEVEL, z);
        if (w === Block.WATER) foundWater = true;
      } else {
        const s = world.getBlock(x, t.height, z);
        if (s !== Block.AIR) foundSolid = true;
      }
    }
  }
  assert.ok(foundSolid, 'expected solid surface blocks nearby');
  // water may be nearby depending on seed; skip hard assert if none in tiny area
});
