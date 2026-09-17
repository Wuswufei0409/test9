import { chromium } from 'playwright-core';
const EXE = '/home/yinwf2/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8123';

const browser = await chromium.launch({
  executablePath: EXE, headless: true,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist','--no-sandbox','--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', m => console.log('CONSOLE', m.type(), m.text().slice(0,300)));
page.on('pageerror', e => console.log('PAGEERROR', e.message));
page.on('requestfailed', r => console.log('REQFAIL', r.url(), r.failure()?.errorText));
await page.goto(`${BASE}/index.html?seed=w1-multica-20260917`, { waitUntil:'networkidle', timeout: 30000 }).catch(e=>console.log('goto err', e.message));
await page.waitForTimeout(3000);
const state = await page.evaluate(() => ({
  hasVoxel: !!window.__voxel,
  meshCount: window.__voxel && window.__voxel.renderer3d ? window.__voxel.renderer3d.meshCount : null,
  worldChunks: window.__voxel && window.__voxel.world ? window.__voxel.world.chunks.size : null,
  bodyHtmlHead: document.body ? document.body.innerHTML.slice(0,100) : null,
}));
console.log('STATE', JSON.stringify(state));
await browser.close();
