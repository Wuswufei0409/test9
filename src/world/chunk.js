// Chunk storage + generation. A chunk is a 16x16 horizontal column of
// WORLD_HEIGHT vertical blocks. Trees are stamped deterministically per column
// so the world is consistent regardless of chunk subdivision.
//
// Pure JS, no Three dependency (node-testable).

import { WORLD_HEIGHT, WORLD_BOTTOM } from './generator.js';
import { Block } from './blocks.js';

export const CHUNK_SIZE = 16;

export class Chunk {
  constructor(cx, cz, gen) {
    this.cx = cx;
    this.cz = cz;
    this.gen = gen;
    this.blocks = null; // Uint8Array(CHUNK*CHUNK*WORLD_HEIGHT)
    this.built = false;
  }

  localIndex(x, y, z) {
    return (y * CHUNK_SIZE + z) * CHUNK_SIZE + x;
  }

  get(x, y, z) {
    return this.blocks[this.localIndex(x, y, z)];
  }

  set(x, y, z, id) {
    this.blocks[this.localIndex(x, y, z)] = id;
  }

  // Build the block data for this chunk (column generation + trees).
  build() {
    const n = CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT;
    this.blocks = new Uint8Array(n);
    const x0 = this.cx * CHUNK_SIZE;
    const z0 = this.cz * CHUNK_SIZE;

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = x0 + lx;
        const wz = z0 + lz;
        const col = this.gen.column(wx, wz);
        for (let y = WORLD_BOTTOM; y < WORLD_HEIGHT; y++) {
          this.set(lx, y, lz, col.blocks[y]);
        }
        if (col.terrain.hasTree && col.terrain.height >= 20) {
          this._placeTree(lx, col.terrain.height, lz);
        }
      }
    }
    this.built = true;
    return this;
  }

  // Deterministic oak tree stamped on a column. May write into surrounding
  // columns of this chunk; trunk+canopy stay inside the chunk.
  _placeTree(lx, groundY, lz) {
    const h = 4 + ((this.gen._treeHash(lx * 31 + lz * 17, lx)) % 2);
    const baseY = groundY + 1;
    const topY = baseY + h;
    if (topY >= WORLD_HEIGHT - 1) return;

    // Trunk
    for (let y = baseY; y < topY; y++) {
      if (this.get(lx, y, lz) === Block.AIR) this.set(lx, y, lz, Block.LOG);
    }
    // Leaves: 5x5 canopy around trunk top.
    const leafY0 = topY - 2;
    const leafY1 = topY + 1;
    for (let y = leafY0; y <= leafY1; y++) {
      const r = y === leafY1 ? 1 : 2;
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (dx === 0 && dz === 0 && y < topY) continue; // keep trunk column
          const tx = lx + dx;
          const tz = lz + dz;
          if (tx < 0 || tx >= CHUNK_SIZE || tz < 0 || tz >= CHUNK_SIZE) continue;
          // Roughly spherical-ish canopy.
          const dist = Math.abs(dx) + Math.abs(dz);
          if (y === leafY1 && dist > 1) continue;
          if (this.get(tx, y, tz) === Block.AIR) this.set(tx, y, tz, Block.LEAVES);
        }
      }
    }
  }
}
