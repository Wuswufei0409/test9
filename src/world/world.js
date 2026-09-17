// World: manages loaded chunks (load around player, unload far ones) and
// provides global coordinate block access for meshing and collision.
//
// Pure JS, no Three dependency.

import { Chunk, CHUNK_SIZE } from './chunk.js';
import { WORLD_HEIGHT, WORLD_BOTTOM } from './generator.js';
import { Block } from './blocks.js';

const key = (cx, cz) => cx + ',' + cz;

export class World {
  constructor(gen, renderDistance = 4) {
    this.gen = gen;
    this.renderDistance = renderDistance;
    this.chunks = new Map(); // key -> Chunk
    this.lastCenter = null;
    this.stats = { loaded: 0, unloaded: 0 };
  }

  chunkAt(cx, cz) {
    const k = key(cx, cz);
    let c = this.chunks.get(k);
    if (!c) {
      c = new Chunk(cx, cz, this.gen).build();
      this.chunks.set(k, c);
    }
    return c;
  }

  // World-coordinate block id. Returns AIR for out-of-bounds.
  getBlock(wx, wy, wz) {
    if (wy < WORLD_BOTTOM || wy >= WORLD_HEIGHT) return Block.AIR;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const c = this.chunks.get(key(cx, cz));
    if (!c) return Block.AIR;
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return c.get(lx, wy, lz);
  }

  // Update loaded chunks to follow the player. Returns newly built chunk coords.
  updateCenter(wx, wz) {
    const ccx = Math.floor(wx / CHUNK_SIZE);
    const ccz = Math.floor(wz / CHUNK_SIZE);
    if (this.lastCenter && this.lastCenter[0] === ccx && this.lastCenter[1] === ccz) {
      return { added: [], removed: [] };
    }
    this.lastCenter = [ccx, ccz];

    const want = new Set();
    const rd = this.renderDistance;
    for (let dx = -rd; dx <= rd; dx++) {
      for (let dz = -rd; dz <= rd; dz++) {
        const cx = ccx + dx;
        const cz = ccz + dz;
        // circular-ish distance
        if (dx * dx + dz * dz > rd * rd + rd) continue;
        want.add(key(cx, cz));
      }
    }
    const added = [];
    for (const k of want) {
      if (!this.chunks.has(k)) {
        const [cx, cz] = k.split(',').map(Number);
        this.chunks.set(k, new Chunk(cx, cz, this.gen).build());
        this.stats.loaded++;
        added.push(k);
      }
    }
    // Unload chunks far away (double radius).
    const removed = [];
    const far = (rd + 2) * (rd + 2) + rd + 2;
    for (const [k, c] of this.chunks.entries()) {
      const dx = c.cx - ccx;
      const dz = c.cz - ccz;
      if (dx * dx + dz * dz > far) {
        this.chunks.delete(k);
        this.stats.unloaded++;
        removed.push(k);
      }
    }
    return { added, removed };
  }

  loadedChunks() {
    return Array.from(this.chunks.values());
  }
}
