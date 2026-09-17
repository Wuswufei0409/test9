// Headless capture driver: launches the game in a headless Chromium (WebGL via
// SwiftShader), waits for chunk meshes to build, positions the camera over a
// scenic land/ocean view and saves screenshots + console diagnostics.
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const EXE = process.env.CHROME_BIN || '/home/yinwf2/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8123';
const OUT = process.env.OUT_DIR || join(process.cwd(), 'evidence');
const SEED = process.env.SEED || 'w1-multica-20260917';
const VIEWPORT = { width: 1280, height: 720 };

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: EXE,
  headless: true,
  args: [
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox',
    '--disable-dev-shm-usage', '--window-size=1280,720',
  ],
});

const page = await browser.newPage({ viewport: VIEWPORT });
const consoleErrors = [];
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));

const url = `${BASE}/index.html?seed=${encodeURIComponent(SEED)}`;
console.log('open', url);
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

// Wait until world meshes exist (renderer built opaque geometry).
await page.waitForFunction(() => {
  const v = window.__voxel;
  return v && v.renderer3d && v.renderer3d.meshCount > 0;
}, { timeout: 60000 });
// let a few more frames render
await page.waitForTimeout(1500);

// Position camera for a cinematic shot over land with ocean visible.
await page.evaluate(() => {
  const v = window.__voxel;
  // look slightly downward and yaw for a nice view
  v.player.yaw = 0.9;
  v.player.pitch = -0.12;
});

// Capture full screen + a second angle / night shot.
await page.screenshot({ path: join(OUT, 'overview-day.png') });

// alternate time-of-day (dusk) for a second visual
await page.evaluate(() => { window.__voxel.sky.setTime(0.72); });
await page.waitForTimeout(400);
await page.screenshot({ path: join(OUT, 'overview-dusk.png') });

// A closer ground-level shot
await page.evaluate(() => { window.__voxel.player.pitch = -0.35; });
await page.waitForTimeout(300);
await page.screenshot({ path: join(OUT, 'ground-level.png') });

const diag = await page.evaluate(() => {
  const v = window.__voxel;
  return {
    seed: v.getSeed(),
    player: { x: v.player.pos.x, y: v.player.pos.y, z: v.player.pos.z },
    meshCount: v.renderer3d.meshCount,
    loadedChunks: v.world.chunks.size,
    stats: v.world.stats,
  };
});
console.log('DIAG', JSON.stringify(diag));
console.log('CONSOLE_ERRORS', JSON.stringify(consoleErrors));

await browser.close();
