// Shared by record.mjs and shoot.mjs: a headless Chrome over CDP (Playwright's own
// launch is unreliable on some Macs), the page setup every scene gets, and the
// CSS that keeps screenshots identical between runs.
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtempSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright-core';

export const DIR = new URL('.', import.meta.url).pathname;
export const CONFIG = JSON.parse(readFileSync(join(DIR, 'config.json'), 'utf8'));
export const FIXTURES = join(DIR, 'fixtures');
// where shoot.mjs runs the release image; recorded URLs are rewritten to it
export const REPLAY_ORIGIN = 'http://127.0.0.1:18081';

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const freePort = () => new Promise((resolve) => {
  const srv = createServer().listen(0, '127.0.0.1', () => { const {port} = srv.address(); srv.close(() => resolve(port)); });
});

async function startOnce() {
  const port = await freePort();
  const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, '--no-first-run',
    '--hide-scrollbars', '--font-render-hinting=none', '--force-color-profile=srgb',
    // same pixels every run: software raster, no GPU / threaded paths
    '--disable-gpu', '--disable-lcd-text', '--force-device-scale-factor=1', '--disable-partial-raster',
    '--disable-checker-imaging', '--disable-threaded-animation', '--disable-threaded-scrolling',
    '--run-all-compositor-stages-before-draw',
    `--user-data-dir=${mkdtempSync(join(tmpdir(), 'oc-shots-'))}`, 'about:blank'], {stdio: 'ignore'});
  const exited = new Promise((r) => proc.once('exit', r));
  for (let i = 0; i < 150; i++) {
    try {
      const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
      return {browser, close: async () => { await browser.close().catch(() => {}); proc.kill(); await exited; }};
    } catch { await new Promise((r) => setTimeout(r, 200)); }
  }
  proc.kill();
  throw new Error(`Chrome did not start (${CHROME}); set CHROME_PATH`);
}

// Chrome now and then fails to come up on a busy machine; try three times.
export async function startBrowser() {
  for (let i = 1; ; i++) {
    try { return await startOnce(); } catch (e) { if (i === 3) throw e; }
  }
}

// localStorage the app reads on start.
export function initStorage({token, theme, locale, extra = {}}) {
  return {
    ...(token ? {authToken: token} : {}),
    'theme-mode': theme,
    uiLocale: locale,
    dashboardViewMode: 'list',
    ...extra,
  };
}

export async function preparePage(context, storage) {
  await context.addInitScript((s) => {
    if (sessionStorage.getItem('__oc_seeded')) return;
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
    sessionStorage.setItem('__oc_seeded', '1');
  }, storage);
}

// No transitions, animations, blinking carets or cursors.
export const STILL_CSS = `*, *::before, *::after {
  transition: none !important; animation: none !important; caret-color: transparent !important; }
.xterm-cursor-layer, .xterm-cursor { visibility: hidden !important; }`;

export async function settle(page) {
  await page.addStyleTag({content: STILL_CSS}).catch(() => {});
  // load every declared font face, not only the ones already requested
  await page.evaluate(() => Promise.all([...document.fonts].map((f) => f.load().catch(() => null)))).catch(() => {});
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await page.waitForTimeout(600);
}
