// Procedural 16x16 pixel-art texture atlas, generated on a canvas at runtime.
// All textures are original procedural artwork (no Minecraft assets copied).
// Returns a Three.js CanvasTexture plus a name -> atlas-tile-index map that the
// mesher consumes for UV lookup.

import * as THREE from '../../vendor/three.module.js';
import { mulberry32 } from '../core/prng.js';

export const TILE = 16;

const NAMES = [
  'grass_top', 'grass_side', 'dirt', 'stone', 'bedrock', 'sand', 'water',
  'log_side', 'log_top', 'leaves', 'snow', 'snow_grass_side', 'gravel',
  'sandstone_top', 'sandstone_side', 'ice', 'cobblestone', 'plank',
];

export function buildTextureAtlas() {
  const W = NAMES.length * TILE;
  const H = TILE;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  const data = img.data;

  const rand = mulberry32(0x9E3779B9);

  // Deterministic per-cell jitter (same repro every run).
  const jitter = (i, j, amt = 6) => {
    const h = Math.imul((i * 73856093) ^ (j * 19349663), 2654435761);
    const f = ((h >>> 16) & 0xffff) / 0xffff;
    return Math.round((f * 2 - 1) * amt);
  };

  const painters = {
    grass_top: (x, y) => {
      const n = jitter(x, y, 14);
      return [106 + n, 168 + n, 62 + n, 255];
    },
    grass_side: (x, y) => {
      if (y < 3) {
        const n = jitter(x, y, 14);
        return [106 + n, 168 + n, 62 + n, 255];
      }
      const n = jitter(x, y, 10);
      return [134 + n, 96 + n, 67 + n, 255];
    },
    dirt: (x, y) => {
      const n = jitter(x, y, 12);
      return [134 + n, 96 + n, 67 + n, 255];
    },
    stone: (x, y) => {
      const n = jitter(x, y, 14);
      return [124 + n, 124 + n, 124 + n, 255];
    },
    bedrock: (x, y) => {
      const n = jitter(x, y, 22);
      return [75 + n, 75 + n, 75 + n, 255];
    },
    sand: (x, y) => {
      const n = jitter(x, y, 16);
      return [219 + n, 207 + n, 160 + n, 255];
    },
    water: (x, y) => {
      const n = jitter(x, y, 16);
      return [40 + n, 100 + n, 190 + n, 235];
    },
    log_side: (x, y) => {
      const n = jitter(x, y, 8);
      const stripe = Math.floor(y / 2) % 2 === 0 ? 0 : -14;
      return [104 + n + stripe, 82 + n + stripe, 50 + n + stripe, 255];
    },
    log_top: (x, y) => {
      const dx = x - 7.5;
      const dy = y - 7.5;
      const r = Math.sqrt(dx * dx + dy * dy);
      const ring = Math.floor(r / 1.6) % 2 === 0 ? 0 : -18;
      const n = jitter(x, y, 6);
      return [116 + n + ring, 90 + n + ring, 58 + n + ring, 255];
    },
    leaves: (x, y) => {
      const n = jitter(x, y, 18);
      const hole = jitter(x + 40, y + 7, 10) < -6 ? 0 : 1;
      if (hole === 0) return [0, 0, 0, 0];
      return [40 + n, 112 + n, 44 + n, 255];
    },
    snow: (x, y) => {
      const n = jitter(x, y, 8);
      return [235 + n, 244 + n, 250 + n, 255];
    },
    snow_grass_side: (x, y) => {
      if (y < 3) {
        const n = jitter(x, y, 8);
        return [235 + n, 244 + n, 250 + n, 255];
      }
      const n = jitter(x, y, 10);
      return [134 + n, 96 + n, 67 + n, 255];
    },
    gravel: (x, y) => {
      const n = jitter(x, y, 40);
      return [120 + n, 116 + n, 110 + n, 255];
    },
    sandstone_top: (x, y) => {
      const n = jitter(x, y, 10);
      return [218 + n, 205 + n, 158 + n, 255];
    },
    sandstone_side: (x, y) => {
      const n = jitter(x, y, 8);
      const line = Math.floor(y / 4) % 2 === 0 ? 0 : -16;
      return [218 + n + line, 206 + n + line, 158 + n + line, 255];
    },
    ice: (x, y) => {
      const n = jitter(x, y, 16);
      return [160 + n, 205 + n, 238 + n, 200];
    },
    cobblestone: (x, y) => {
      const n = jitter(x, y, 18);
      const cellX = Math.floor(x / 8);
      const cellY = Math.floor(y / 8);
      const edge = (x % 8 === 0) || (y % 8 === 0) ? -38 : 0;
      const off = ((cellX + cellY * 3) % 2 === 0) ? 0 : 12;
      return [124 + n + edge + off, 122 + n + edge + off, 120 + n + edge + off, 255];
    },
    plank: (x, y) => {
      const n = jitter(x, y, 10);
      const board = Math.floor(y / 4);
      const seam = (y % 4 === 0) ? -36 : 0;
      const vertical = (x === 0 || x === 8) ? -22 : 0;
      return [158 + n + seam + vertical, 128 + n + seam + vertical, 78 + n + seam + vertical, 255];
    },
  };

  const TILE_BY_NAME = {};
  NAMES.forEach((name, idx) => {
    TILE_BY_NAME[name] = idx;
    const painter = painters[name];
    const ox = idx * TILE;
    for (let j = 0; j < TILE; j++) {
      for (let i = 0; i < TILE; i++) {
        const [r, g, b, a] = painter(i, j);
        const p = ((j) * W + (ox + i)) * 4;
        data[p] = r;
        data[p + 1] = g;
        data[p + 2] = b;
        data[p + 3] = a;
      }
    }
  });
  ctx.putImageData(img, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  return { texture, TILE_BY_NAME, atlasWidth: W, atlasHeight: H, TILE, canvas };
}
