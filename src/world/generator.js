// Seeded deterministic world generation (column-based so it is independent of
// chunk boundaries and therefore reproducible for any seed).
//
// Pure JS / no Three dependency so it is testable under node.

import { makeValueNoise2D, makeRidgedNoise2D, hashString, mulberry32 } from '../core/prng.js';
import { Block } from './blocks.js';

export const WORLD_HEIGHT = 64;
export const WORLD_BOTTOM = 0;
export const SEA_LEVEL = 28;

// Biomes identified by generator. Categories are used for AC coverage tests.
export const Biome = {
  OCEAN_DEEP_COLD: 'ocean_deep_cold',
  OCEAN_DEEP_WARM: 'ocean_deep_warm',
  OCEAN_SHALLOW_COLD: 'ocean_shallow_cold',
  OCEAN_SHALLOW_WARM: 'ocean_shallow_warm',
  BEACH: 'beach',
  PLAINS: 'plains',
  FOREST: 'forest',
  DESERT: 'desert',
  MOUNTAINS: 'mountains',
  SNOWY_PLAINS: 'snowy_plains',
};

export function biomeIsOcean(b) {
  return b === Biome.OCEAN_DEEP_COLD || b === Biome.OCEAN_DEEP_WARM ||
    b === Biome.OCEAN_SHALLOW_COLD || b === Biome.OCEAN_SHALLOW_WARM;
}

export class WorldGenerator {
  constructor(seedStr) {
    this.seed = String(seedStr);
    this.seedInt = hashString(this.seed);
    // Fixed per-seed noise instances (independent scales).
    this.continental = makeValueNoise2D('continental:' + this.seedInt);
    this.hills = makeValueNoise2D('hills:' + this.seedInt);
    this.ridge = makeRidgedNoise2D('ridge:' + this.seedInt);
    this.temperature = makeValueNoise2D('temperature:' + this.seedInt);
    this.moisture = makeValueNoise2D('moisture:' + this.seedInt);
  }

  // Deterministic tree RNG value for a cell (grid-aligned so it is
  // independent of scanning order / chunk boundaries).
  _treeHash(cx, cz) {
    let h = (this.seedInt ^ Math.imul(cx, 0x27d4eb2d) ^ Math.imul(cz, 0x165667b1)) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h = (h ^ (h >>> 16)) >>> 0;
    return h / 4294967296;
  }

  // Evaluate terrain at a single (x, z) column. Deterministic and
  // chunk-independent (noise evaluated per column coordinate).
  terrainAt(x, z) {
    // Continental shape -> large scale land/sea.
    const cont = this.continental(x * 0.0035, z * 0.0035, 4);
    // Smaller-scale rolling hills.
    const hill = this.hills(x * 0.02, z * 0.02, 3);
    // Ridges -> mountains.
    const ridgeN = this.ridge(x * 0.012, z * 0.012, 4);

    // Base height around sea level. cont in [-1,1].
    let height = SEA_LEVEL + cont * 26 + hill * 3.5;
    if (ridgeN > 0.52) {
      height += (ridgeN - 0.52) * 120;
    }
    height = Math.max(WORLD_BOTTOM + 1, Math.min(Math.floor(height), WORLD_HEIGHT - 2));

    // Temperature [-1,1] and moisture [-1,1].
    const temp = this.temperature(x * 0.0042 + 31.7, z * 0.0042 - 17.3, 3);
    const moist = this.moisture(x * 0.0042 - 9.1, z * 0.0042 + 5.5, 3);

    // Classify biome from height + climate.
    let biome;
    if (height < SEA_LEVEL - 3) {
      const deep = height < SEA_LEVEL - 8;
      const cold = temp < 0;
      biome = deep
        ? (cold ? Biome.OCEAN_DEEP_COLD : Biome.OCEAN_DEEP_WARM)
        : (cold ? Biome.OCEAN_SHALLOW_COLD : Biome.OCEAN_SHALLOW_WARM);
    } else if (height <= SEA_LEVEL + 1) {
      biome = Biome.BEACH;
    } else if (temp > 0.35 && moist < 0) {
      biome = Biome.DESERT;
    } else if (temp < -0.25) {
      biome = height > SEA_LEVEL + 18 ? Biome.MOUNTAINS : Biome.SNOWY_PLAINS;
    } else if (height > SEA_LEVEL + 26) {
      biome = Biome.MOUNTAINS;
    } else if (moist > 0.1) {
      biome = Biome.FOREST;
    } else {
      biome = Biome.PLAINS;
    }

    const treeChance =
      biome === Biome.FOREST ? 0.012 :
      biome === Biome.PLAINS ? 0.003 : 0;

    return {
      x, z,
      height,
      biome,
      temp,
      moist,
      hasTree: treeChance > 0 && this._treeHash(Math.floor(x / 4), Math.floor(z / 4)) < treeChance,
    };
  }

  // Determine the surface (top) block id for a column.
  _surfaceBlock(t) {
    switch (t.biome) {
      case Biome.DESERT:
        return Block.SAND;
      case Biome.MOUNTAINS:
      case Biome.SNOWY_PLAINS:
        return t.height > SEA_LEVEL + 22 ? Block.SNOW_BLOCK : Block.SNOW;
      case Biome.BEACH:
        return Block.SAND;
      default:
        return Block.GRASS;
    }
  }

  // Fill a 3D block array for a vertical column at (x, z).
  // Returns { blocks: Uint8Array(WORLD_HEIGHT), terrain }.
  column(x, z) {
    const t = this.terrainAt(x, z);
    const arr = new Uint8Array(WORLD_HEIGHT);
    arr[WORLD_BOTTOM] = Block.BEDROCK;

    const h = t.height;
    if (biomeIsOcean(t.biome)) {
      // Ocean floor
      arr[h] = t.biome.startsWith('ocean_shallow') ? Block.SAND : Block.GRAVEL;
      for (let y = h - 1; y > WORLD_BOTTOM; y--) arr[y] = Block.STONE;
      // Water from floor+1 up to sea level.
      for (let y = h + 1; y <= SEA_LEVEL; y++) arr[y] = Block.WATER;
    } else {
      // Land: surface + dirt + stone.
      arr[h] = this._surfaceBlock(t);
      for (let y = h - 1; y > WORLD_BOTTOM; y--) {
        arr[y] = (h - y) >= 3 ? Block.STONE : Block.DIRT;
      }
    }
    return { blocks: arr, terrain: t };
  }
}
