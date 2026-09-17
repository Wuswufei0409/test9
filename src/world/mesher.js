// Chunk mesher: converts chunk block data into a flat triangle soup split into
// an opaque pass and a water(transparent) pass. Each pass exposes positions,
// per-vertex UV (tile-relative), per-vertex atlas tile index and a light factor.
// Pure JS — the render layer turns these arrays into Three.js geometry.
//
// Face culling: a face is emitted when the neighbouring block does not occlude
// it (air, water or leaves do not occlude; opaque blocks do).

import { CHUNK_SIZE } from './chunk.js';
import { WORLD_HEIGHT } from './generator.js';
import { Block, blockById, occludes } from './blocks.js';

const FACES = [
  { dir: [1, 0, 0], normal: [1, 0, 0], key: 'side' },
  { dir: [-1, 0, 0], normal: [-1, 0, 0], key: 'side' },
  { dir: [0, 1, 0], normal: [0, 1, 0], key: 'top' },
  { dir: [0, -1, 0], normal: [0, -1, 0], key: 'bottom' },
  { dir: [0, 0, 1], normal: [0, 0, 1], key: 'side' },
  { dir: [0, 0, -1], normal: [0, 0, -1], key: 'side' },
];

function faceLight(nx, ny, nz) {
  if (ny > 0) return 1.0;
  if (ny < 0) return 0.45;
  return 0.8;
}

function faceCorners(dir) {
  const [dx, dy, dz] = dir;
  if (dx === 1)    return [[1, 0, 1], [1, 1, 1], [1, 1, 0], [1, 0, 0]];
  if (dx === -1)   return [[0, 0, 0], [0, 1, 0], [0, 1, 1], [0, 0, 1]];
  if (dy === 1)    return [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]];
  if (dy === -1)   return [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]];
  if (dz === 1)    return [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
  return            [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]];
}

const UVS = [[0, 0], [1, 0], [1, 1], [0, 1]];

function faceVisible(blockId, neighborId) {
  if (blockId === Block.WATER) {
    if (neighborId === Block.WATER) return false; // interior
    return true;                                   // air / solid edge visible
  }
  return !occludes(neighborId);
}

// Atlas tile index for a block's face texture name (resolved lazily).
const TILE = new Map();
export function registerTileMap(map) {
  for (const [k, v] of Object.entries(map)) TILE.set(k, v);
}
function tileIndex(texName) {
  const v = TILE.get(texName);
  return v === undefined ? 0 : v;
}

class Sink {
  constructor() {
    this.positions = [];
    this.uvs = [];
    this.tex = [];
    this.light = [];
    this.indices = [];
    this.base = 0;
  }
  push(px, py, pz, u, v, tile, l) {
    this.positions.push(px, py, pz);
    this.uvs.push(u, v);
    this.tex.push(tile);
    this.light.push(l);
  }
  addQuad(corners, uvOrder, lightF, tile) {
    const v0 = this.base;
    for (let c = 0; c < 4; c++) {
      const [ox, oy, oz] = corners[c];
      this.push(ox, oy, oz, UVS[uvOrder[c]][0], UVS[uvOrder[c]][1], tile, lightF);
    }
    this.indices.push(v0, v0 + 1, v0 + 2, v0, v0 + 2, v0 + 3);
    this.base += 4;
  }
}

/**
 * Mesh one chunk.
 * @returns {{opaque: Sink, water: Sink, waterCount:number}}
 */
export function meshChunk(chunk, getBlock) {
  const opaque = new Sink();
  const water = new Sink();
  let waterCount = 0;

  const x0 = chunk.cx * CHUNK_SIZE;
  const z0 = chunk.cz * CHUNK_SIZE;

  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let y = 0; y < WORLD_HEIGHT; y++) {
        const id = chunk.get(lx, y, lz);
        if (id === Block.AIR) continue;
        const wx = x0 + lx;
        const wz = z0 + lz;
        const def = blockById(id);

        for (const face of FACES) {
          const nId = getBlock(wx + face.dir[0], y + face.dir[1], wz + face.dir[2]);
          if (!faceVisible(id, nId)) continue;

          let texName;
          if (def.tex) {
            texName = face.key === 'top'
              ? (def.tex.top || def.tex.side)
              : face.key === 'bottom'
                ? (def.tex.bottom || def.tex.side)
                : def.tex.side;
          } else {
            texName = 'stone';
          }
          const tile = tileIndex(texName);
          const lightF = faceLight(...face.normal);
          const corners = faceCorners(face.dir).map(([a, b, c]) => [wx + a, y + b, wz + c]);

          const sink = id === Block.WATER ? water : opaque;
          sink.addQuad(corners, [0, 1, 2, 3], lightF, tile);
          if (id === Block.WATER) {
            // ensure water top face does not fight the surface; handled by
            // neighbor culling. Counter below is informational.
          }
        }
        if (id === Block.WATER) waterCount++;
      }
    }
  }

  return { opaque, water, waterCount };
}
