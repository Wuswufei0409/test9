// Fixed-seed terrain fingerprint tool (reproducibility evidence, no browser).
//
// For a given seed it samples key terrain columns (heights/biomes/surface
// blocks) across a visible region and prints a stable digest. Running the same
// seed twice — or on two machines — yields the identical digest, demonstrating
// reproducible seed world generation (AC "same seed -> same key terrain").
//
// Usage: node tools/fingerprint.mjs [seed] [region|sample]
//   - [seed]    default: bedrock14
//   - [region]  half-width in blocks to sample, default 64
//   - [sample]  step between samples, default 8
import { WorldGenerator, biomeIsOcean } from '../src/world/generator.js';
import { Block } from '../src/world/blocks.js';

const seed = process.argv[2] || 'bedrock14';
const R = Number(process.argv[3] || 64);
const STEP = Number(process.argv[4] || 8);

const gen = new WorldGenerator(seed);

// deterministic hash of a string (matches core/prng hashString)
function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const rows = [];
const counts = {};
const heights = [];
for (let z = -R; z <= R; z += STEP) {
  for (let x = -R; x <= R; x += STEP) {
    const t = gen.terrainAt(x, z);
    const col = gen.column(x, z);
    const surface = col.blocks[t.height];
    counts[t.biome] = (counts[t.biome] || 0) + 1;
    heights.push(t.height);
    rows.push([x, z, t.height, t.biome, Block[surface] || surface]);
  }
}

// canonical digest over sorted rows and the biome histogram + height stats
heights.sort((a, b) => a - b);
const payload = JSON.stringify({
  seed,
  steps: rows.length,
  biomeHistogram: Object.entries(counts).sort(),
  height: { min: heights[0], max: heights[heights.length - 1], median: heights[Math.floor(heights.length / 2)] },
  rows,
});
const digest = ('0000000' + (hashString(payload) >>> 0).toString(16)).slice(-8);

console.log('FINGERPRINT_V1');
console.log('seed    :', seed);
console.log('region  :', `-${R}..${R} step ${STEP}`);
console.log('samples :', rows.length);
console.log('biomes  :', JSON.stringify(Object.entries(counts).sort()));
console.log('height  :', JSON.stringify({ min: heights[0], max: heights[heights.length - 1], median: heights[Math.floor(heights.length / 2)] }));
console.log('digest  :', digest);
