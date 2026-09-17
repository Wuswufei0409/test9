// Render layer: builds Three.js chunk meshes (opaque + water passes) from the
// pure mesher output, and manages GPU objects as chunks load/unload.

import * as THREE from '../../vendor/three.module.js';
import { meshChunk } from '../world/mesher.js';

export class WorldRenderer {
  constructor(scene, world, atlas) {
    this.scene = scene;
    this.world = world;
    this.atlas = atlas;
    this.materials = {
      opaque: new THREE.MeshBasicMaterial({
        map: atlas.texture,
        vertexColors: true,
        alphaTest: 0.5,
      }),
      water: new THREE.MeshBasicMaterial({
        map: atlas.texture,
        vertexColors: true,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
      }),
    };
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.meshes = new Map(); // chunkKey -> THREE.Group
    this.meshCount = 0;
    this.triCount = 0;
  }

  _geometry(res) {
    const atlas = this.atlas;
    const geo = new THREE.BufferGeometry();
    const posArr = new Float32Array(res.positions);
    const colArr = new Float32Array(res.positions.length);
    const nVerts = res.positions.length / 3;
    for (let i = 0; i < nVerts; i++) {
      const l = res.light[i];
      colArr[i * 3] = l;
      colArr[i * 3 + 1] = l;
      colArr[i * 3 + 2] = l;
    }
    const uSize = atlas.TILE / atlas.atlasWidth;
    const vSize = atlas.TILE / atlas.atlasHeight;
    const uvArr = new Float32Array(res.uvs.length);
    for (let i = 0, vi = 0; i < res.uvs.length; i += 2, vi++) {
      const tile = res.tex[vi];
      const u = res.uvs[i];
      const v = res.uvs[i + 1];
      uvArr[i] = (tile * uSize) + u * uSize;
      uvArr[i + 1] = 1 - v * vSize;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
    geo.setIndex(new THREE.BufferAttribute(new Uint32Array(res.indices), 1));
    geo.computeVertexNormals();
    return geo;
  }

  updateChunk(chunk) {
    const key = chunk.cx + ',' + chunk.cz;
    const old = this.meshes.get(key);
    if (old) {
      this.group.remove(old);
      this.meshes.delete(key);
      this.meshCount--;
    }
    const res = meshChunk(chunk, (wx, wy, wz) => this.world.getBlock(wx, wy, wz));
    const group = new THREE.Group();
    group.userData = { cx: chunk.cx, cz: chunk.cz };

    if (res.opaque.indices.length > 0) {
      const mesh = new THREE.Mesh(this._geometry(res.opaque), this.materials.opaque);
      group.add(mesh);
      this.triCount += res.opaque.indices.length / 3;
    }
    if (res.water.indices.length > 0) {
      const mesh = new THREE.Mesh(this._geometry(res.water), this.materials.water);
      group.add(mesh);
      this.triCount += res.water.indices.length / 3;
    }
    if (group.children.length > 0) {
      this.group.add(group);
      this.meshes.set(key, group);
      this.meshCount++;
    }
    return res;
  }

  removeChunk(chunk) {
    const key = chunk.cx + ',' + chunk.cz;
    const m = this.meshes.get(key);
    if (m) {
      this.group.remove(m);
      this.meshes.delete(key);
      this.meshCount--;
    }
  }
}
