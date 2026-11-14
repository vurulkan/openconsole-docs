// Replays the recorded fixtures and writes every scene in every theme and locale to
// static/img/screens/<id>.<locale>.<theme>.webp, plus static/img/screens/screens.json
// (sizes). No cluster needed: the web UI comes from the release image in a local
// container (docker), the API and WebSockets from fixtures/, the clock is fixed to
// the recording time. Same fixtures → same pixels. Usage: node shoot.mjs [scene-id ...]
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import sharp from 'sharp';
import {CONFIG, DIR, FIXTURES, REPLAY_ORIGIN, initStorage, preparePage, settle, startBrowser} from './lib.mjs';
import {SCENES, setLocale} from './scenes.mjs';

const OUT = join(DIR, '../static/img/screens');
const only = process.argv.slice(2);
mkdirSync(OUT, {recursive: true});
const manifestPath = join(OUT, 'screens.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};

const PORT = new URL(REPLAY_ORIGIN).port;

// share of pixels (max channel difference > 24) below which an image counts as unchanged
const MIN_CHANGE = Number(process.env.MIN_CHANGE ?? 0.005);
async function changed(oldWebp, newWebp) {
  const a = await sharp(oldWebp).raw().toBuffer({resolveWithObject: true});
  const b = await sharp(newWebp).raw().toBuffer({resolveWithObject: true});
  if (a.info.width !== b.info.width || a.info.height !== b.info.height) return 1;
  let n = 0;
  for (let i = 0; i < a.data.length; i += a.info.channels) {
    if (Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2])) > 24) n++;
  }
  return n / (a.info.width * a.info.height);
}
const image = `ghcr.io/vurulkan/kubernetes-openconsole:${CONFIG.version}`;
const container = execFileSync('docker', ['run', '-d', '--rm', '-p', `127.0.0.1:${PORT}:8080`, image]).toString().trim();
const base = REPLAY_ORIGIN;
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(base + '/readyz')).ok) break; } catch { /* starting */ }
  await new Promise((r) => setTimeout(r, 500));
}

let missing = 0;
const failed = [];
try {
  for (const scene of SCENES.filter((s) => !only.length || only.includes(s.id))) {
    // a fresh browser per scene: text rendering depends on what the browser drew before,
    // so a scene must not depend on which scenes ran ahead of it
    const {browser, close} = await startBrowser();
    const har = join(FIXTURES, `${scene.id}.har`);
    const {time, sockets} = JSON.parse(readFileSync(join(FIXTURES, `${scene.id}.json`), 'utf8'));
    for (const locale of CONFIG.locales) {
      for (const theme of CONFIG.themes) {
        const context = await browser.newContext({viewport: scene.viewport || CONFIG.viewport, reducedMotion: 'reduce', colorScheme: theme});
        await context.routeFromHAR(har, {url: /\/api\//, notFound: 'abort'});
        await context.routeWebSocket(/\/ws\//, (ws) => {
          const rec = sockets.find((s) => s.path === new URL(ws.url()).pathname);
          for (const f of rec?.frames ?? []) ws.send(f.s ?? Buffer.from(f.b, 'base64'));
        });
        await preparePage(context, initStorage({token: scene.as && 'replay', theme, locale, extra: scene.storage}));
        const page = await context.newPage();
        page.on('requestfailed', (r) => {
          if (/\/api\//.test(r.url())) { missing++; console.warn(`  ${scene.id} ${locale}/${theme}: no recording for ${r.method()} ${r.url()}`); }
        });
        await page.clock.setFixedTime(time);
        setLocale(locale);
        await page.goto(base + (scene.path || '/'));
        try {
          await scene.run(page, {mode: 'shoot', locale});
        } catch (e) {
          await page.screenshot({path: join(DIR, '.work', `failed-${scene.id}.${locale}.${theme}.png`)}).catch(() => {});
          failed.push(`${scene.id} ${locale}/${theme}: ${e.message.split('\n')[0]}`);
          await context.close();
          continue;
        }
        await settle(page);
        const clip = scene.clip ? await scene.clip(page) : undefined;
        const png = await page.screenshot({clip});
        if (process.env.KEEP_PNG) writeFileSync(join(DIR, '.work', `${scene.id}.${locale}.${theme}.${process.env.KEEP_PNG}.png`), png);
        const webp = await sharp(png).webp({quality: 82, effort: 6}).toBuffer();
        const file = join(OUT, `${scene.id}.${locale}.${theme}.webp`);
        const change = existsSync(file) ? await changed(readFileSync(file), webp) : 1;
        // A few scenes render a handful of pixels differently from run to run (asynchronous
        // UI timing, anti-aliasing). Keep the committed image unless the screen really changed.
        if (change >= (process.env.MIN_CHANGE ? MIN_CHANGE : scene.tolerance ?? MIN_CHANGE)) {
          writeFileSync(file, webp);
          if (change < 1) console.log(`  ${scene.id}.${locale}.${theme}: ${(change * 100).toFixed(2)} % of pixels changed`);
        }
        const {width, height} = await sharp(png).metadata();
        manifest[scene.id] = {width, height};
        await context.close();
      }
    }
    await close();
    console.log('shot', scene.id);
  }
} finally {
  execFileSync('docker', ['rm', '-f', container]);
  writeFileSync(manifestPath, JSON.stringify(Object.fromEntries(Object.entries(manifest).sort()), null, 1) + '\n');
}
if (missing) console.warn(`${missing} API requests had no recording; re-record those scenes`);
if (failed.length) {
  console.error(`failed (see .work/failed-*.png):\n  ${failed.join('\n  ')}`);
  process.exit(1);
}
