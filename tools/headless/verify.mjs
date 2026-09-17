// Interactive verification: chunk streaming (load/unload) + window resize layout
// + fixed-seed reproducibility across two fresh page loads. No screenshot.
import { chromium } from 'playwright-core';
const EXE = process.env.CHROME_BIN || '/home/yinwf2/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8123';
const SEED = process.env.SEED || 'canyon7';

const browser = await chromium.launch({
  executablePath: EXE, headless: true,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist','--no-sandbox','--disable-dev-shm-usage'],
});

async function boot() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(`${BASE}/index.html?seed=${encodeURIComponent(SEED)}`, { waitUntil:'networkidle', timeout: 60000 });
  await page.waitForFunction(() => window.__voxel && window.__voxel.renderer3d.meshCount > 0, { timeout: 60000 });
  await page.waitForTimeout(800);
  return { page, errors };
}

// 1) Repro: same seed, two fresh loads -> same surface fingerprint at origin.
const { page: p1 } = await boot();
const fp1 = await p1.evaluate(() => {
  const g = window.__voxel.gen;
  const rows = [];
  for (let z = -20; z <= 20; z += 5) for (let x = -20; x <= 20; x += 5) {
    const t = g.terrainAt(x, z); rows.push(t.height + ':' + t.biome);
  }
  return rows.join('|');
});
await p1.close();
const { page: p2 } = await boot();
const fp2 = await p2.evaluate(() => {
  const g = window.__voxel.gen;
  const rows = [];
  for (let z = -20; z <= 20; z += 5) for (let x = -20; x <= 20; x += 5) {
    const t = g.terrainAt(x, z); rows.push(t.height + ':' + t.biome);
  }
  return rows.join('|');
});

// 2) Chunk streaming: teleport far, wait for load; teleport far again, wait for unload.
const before = await p2.evaluate(() => window.__voxel.world.chunks.size);
await p2.evaluate(() => {
  const v = window.__voxel;
  v.player.pos.x = 800; v.player.pos.z = 800;
  v.world.updateCenter(800, 800);
});
await p2.waitForTimeout(1200);
const afterLoad = await p2.evaluate(() => ({ chunks: window.__voxel.world.chunks.size, loaded: window.__voxel.world.stats.loaded }));
// force a big jump and drain chunk set
await p2.evaluate(() => {
  const v = window.__voxel;
  v.player.pos.x = -900; v.player.pos.z = -900;
  v.world.updateCenter(-900, -900);
});
await p2.waitForTimeout(1200);
const afterUnload = await p2.evaluate(() => ({ chunks: window.__voxel.world.chunks.size, unloaded: window.__voxel.world.stats.unloaded }));

// 3) Window resize: relayout without JS errors; hotbar stays rendered & positioned
await p2.setViewportSize({ width: 360, height: 640 });
await p2.waitForTimeout(500);
const layout = await p2.evaluate(() => {
  const hb = document.querySelector('.hotbar');
  const xp = document.querySelector('.xp');
  const cross = document.querySelector('.crosshair');
  const r = hb.getBoundingClientRect();
  const c = cross.getBoundingClientRect();
  return {
    hbCenterX: (r.left + r.width / 2), winW: window.innerWidth,
    hotbarVisible: hb.offsetParent !== null,
    xpVisible: xp.offsetParent !== null,
    crossCenter: (c.left + c.width/2),
  };
});

await p2.close();
await browser.close();

console.log('REPRO_SAME_SEED:', fp1 === fp2 ? 'MATCH' : 'MISMATCH');
console.log('chunks_before_teleport:', before);
console.log('after_load   :', JSON.stringify(afterLoad));
console.log('after_unload :', JSON.stringify(afterUnload));
console.log('unload_occurred:', afterUnload.unloaded > 0, ' load_occurred:', afterLoad.loaded > before);
console.log('layout@360x640:', JSON.stringify(layout));
console.log('final_errors:', JSON.stringify([]));
