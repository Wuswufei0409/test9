// W1 main: browser entry that boots the voxel world, first-person view, HUD,
// day/night sky and the chunk load/unload loop.

import * as THREE from '../vendor/three.module.js';
import { WorldGenerator, SEA_LEVEL } from './world/generator.js';
import { World } from './world/world.js';
import { Player } from './game/player.js';
import { buildTextureAtlas } from './render/textures.js';
import { registerTileMap } from './world/mesher.js';
import { WorldRenderer } from './render/worldrender.js';
import { Sky } from './render/sky.js';
import { createHUD } from './render/hud.js';
import { Block } from './world/blocks.js';

// ---- Seed from URL ?seed= or hash fallback ----
const params = new URLSearchParams(location.search);
let seed = params.get('seed') || 'bedrock14';
const gen = new WorldGenerator(seed);

// ---- Renderer / scene / camera ----
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const container = document.getElementById('app');
function resize() {
  const w = container.clientWidth;
  const h = container.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 1000);
camera.rotation.order = 'YXZ';
scene.add(camera);

// ---- Atlas + mesher tile map ----
const atlas = buildTextureAtlas();
const TILE_BY_NAME = atlas.TILE_BY_NAME;
registerTileMap(TILE_BY_NAME);

// ---- World ----
const RENDER_DIST = 4;
const world = new World(gen, RENDER_DIST);
const sky = new Sky(scene);

// ---- Spawn on land near origin ----
function findSpawn() {
  for (let r = 0; r < 80; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let y = 58; y >= 1; y--) {
          const b = world.getBlock(dx, y, dz);
          if (b === Block.GRASS || b === Block.SAND || b === Block.SNOW || b === Block.DIRT) {
            return { x: dx + 0.5, y: y + 1, z: dz + 0.5 };
          }
        }
      }
    }
  }
  return { x: 0.5, y: SEA_LEVEL + 2, z: 0.5 };
}

// ---- Player ----
const player = new Player((x, y, z) => world.getBlock(x, y, z), findSpawn());
document.getElementById('seedlabel').textContent = 'Seed: ' + gen.seed;

// ---- HUD ----
const hud = createHUD(document.getElementById('hud'), {
  TILE_BY_NAME: atlas.TILE_BY_NAME,
  canvas: atlas.canvas,
});

// ---- World renderer ----
const renderer3d = new WorldRenderer(scene, world, atlas);

// ---- First-person held block ----
const heldGroup = new THREE.Group();
// a small cube drawn from a tile copy
const heldTexCanvas = document.createElement('canvas');
heldTexCanvas.width = 16;
heldTexCanvas.height = 16;
{
  const g = heldTexCanvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, 16, 16);
  g.drawImage(atlas.canvas, TILE_BY_NAME['cobblestone'] * 16, 0, 16, 16, 0, 0, 16, 16);
}
const heldTex = new THREE.CanvasTexture(heldTexCanvas);
heldTex.magFilter = THREE.NearestFilter;
heldTex.minFilter = THREE.NearestFilter;
const heldMat = [
  new THREE.MeshBasicMaterial({ map: heldTex }),
  new THREE.MeshBasicMaterial({ map: heldTex }),
  new THREE.MeshBasicMaterial({ map: heldTex }),
  new THREE.MeshBasicMaterial({ map: heldTex }),
  new THREE.MeshBasicMaterial({ map: heldTex }),
  new THREE.MeshBasicMaterial({ map: heldTex }),
];
const heldMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), heldMat);
heldMesh.position.set(0.55, -0.5, -0.9);
heldGroup.add(heldMesh);
camera.add(heldGroup);
heldGroup.visible = true;

// ---- Input ----
const keys = {};
let locked = false;
let dayNightToggle = true;

document.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'KeyT') {
    dayNightToggle = !dayNightToggle;
    hud.showHelp(false);
  }
  if (e.code === 'KeyR') { player.yaw = 0; player.pitch = 0; }
});
document.addEventListener('keyup', (e) => { keys[e.code] = false; });

canvas.addEventListener('click', () => {
  if (!locked) { canvas.requestPointerLock && canvas.requestPointerLock(); }
});
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  hud.showHelp(!locked);
});
document.addEventListener('mousemove', (e) => {
  if (!locked) return;
  player.addLook(e.movementX * 0.0026, e.movementY * 0.0026);
});
// Prevent context menu on right click
document.addEventListener('contextmenu', (e) => e.preventDefault());

// ---- Main loop ----
const clock = new THREE.Clock();
let time = 0.3; // start near morning
let frame = 0;

// Rebuild neighbor meshes when a chunk is loaded/unloaded (face-cull correctness)
function syncChunkMeshes(changes) {
  const toUpdate = new Set(changes.added);
  for (const k of changes.added) {
    const [cx, cz] = k.split(',').map(Number);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nk = (cx + dx) + ',' + (cz + dz);
      if (world.chunks.has(nk)) toUpdate.add(nk);
    }
  }
  for (const k of toUpdate) {
    const [cx, cz] = k.split(',').map(Number);
    const chunk = world.chunkAt(cx, cz);
    renderer3d.updateChunk(chunk);
  }
}

function tick() {
  requestAnimationFrame(tick);
  frame++;
  const dt = Math.min(clock.getDelta(), 0.05);

  // chunk streaming
  const changes = world.updateCenter(player.pos.x, player.pos.z);
  if (frame % 10 === 1) syncChunkMeshes(changes);

  // remove far meshes
  for (const [key, grp] of renderer3d.meshes) {
    if (!world.chunks.has(key)) renderer3d.removeChunk({ cx: Number(key.split(',')[0]), cz: Number(key.split(',')[1]) });
  }

  // input
  const fwd = (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 1 : 0);
  const strafe = (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0);
  const input = {
    fwd, strafe,
    jump: keys['Space'],
    sneaking: keys['ShiftLeft'] || keys['ShiftRight'],
    sprinting: keys['ControlLeft'] || keys['ControlRight'],
  };
  player.step(dt, input);

  // camera
  const eye = player.eye();
  camera.position.copy(new THREE.Vector3(eye.x, eye.y, eye.z));
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;

  // day/night + sun
  if (dayNightToggle) time = (time + dt / 600) % 1;
  sky.setTime(time);
  skyUpdateBrightness();

  // static lighting: modulate world material color by ambient brightness
  renderer3d.materials.opaque.color.setRGB(brightness, brightness, brightness);
  renderer3d.materials.water.color.setRGB(brightness, brightness, brightness);

  // HUD
  hud.update({
    health: 10,
    hunger: 10,
    xp: 0.5,
    sprinting: input.sprinting && fwd > 0,
  });

  statsUpdate();

  renderer.render(scene, camera);
}

// brightness shared with loop
let brightness = 0.7;
function skyUpdateBrightness() { brightness = sky.brightness; }

// simple FPS/stat readout
function statsUpdate() {
  document.getElementById('stat-face').textContent = 'chunks: ' + renderer3d.meshCount;
  document.getElementById('stat-fps').textContent = 'pos: ' +
    player.pos.x.toFixed(1) + ',' + player.pos.y.toFixed(1) + ',' + player.pos.z.toFixed(1);
}

// ---- boot ----
resize();
window.addEventListener('resize', resize);
hud.showHelp(true);
tick();

// expose for the test harness (headless screenshots / REPL assertions)
window.__voxel = { world, player, gen, renderer, camera, sky, renderer3d, atlas, TILE_BY_NAME, getSeed: () => gen.seed };
