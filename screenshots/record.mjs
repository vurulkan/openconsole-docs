// Records the API answers (HAR) and WebSocket frames of every scene from a running
// OpenConsole filled by seed.mjs. Usage: node record.mjs [scene-id ...]
// Output: fixtures/<id>.har, fixtures/<id>.json (WebSocket frames, record time).
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {CONFIG, DIR, FIXTURES, REPLAY_ORIGIN, initStorage, preparePage, settle, startBrowser} from './lib.mjs';
import {SCENES, setLocale} from './scenes.mjs';

setLocale('en');

const state = JSON.parse(readFileSync(join(DIR, '.work/state.json'), 'utf8'));
const only = process.argv.slice(2);
mkdirSync(FIXTURES, {recursive: true});
mkdirSync(join(DIR, '.work/record'), {recursive: true});

const {browser, close} = await startBrowser();
try {
  for (const scene of SCENES.filter((s) => !only.length || only.includes(s.id))) {
    const context = await browser.newContext({
      viewport: scene.viewport || CONFIG.viewport, reducedMotion: 'reduce', colorScheme: 'light',
      recordHar: {path: join(FIXTURES, `${scene.id}.har`), content: 'embed', urlFilter: /\/api\//},
    });
    await preparePage(context, initStorage({token: state.tokens[scene.as], theme: 'light', locale: 'en', extra: scene.storage}));
    const page = await context.newPage();
    const sockets = [];
    page.on('websocket', (ws) => {
      const rec = {path: new URL(ws.url()).pathname, frames: []};
      sockets.push(rec);
      ws.on('framereceived', (f) => rec.frames.push(typeof f.payload === 'string'
        ? {s: f.payload} : {b: Buffer.from(f.payload).toString('base64')}));
    });
    const time = Date.now();
    await page.goto(state.base + (scene.path || '/'));
    try {
      await scene.run(page, {mode: 'record'});
    } catch (e) {
      await page.screenshot({path: join(DIR, '.work', `failed-${scene.id}.png`)}).catch(() => {});
      throw e;
    }
    await settle(page);
    await page.screenshot({path: join(DIR, '.work/record', `${scene.id}.png`)});
    await context.close();
    // shoot.mjs serves the UI on REPLAY_ORIGIN; HAR URLs must match it
    // and no credentials in the repository: drop the request headers that carry them
    const harPath = join(FIXTURES, `${scene.id}.har`);
    const har = JSON.parse(readFileSync(harPath, 'utf8').split(state.base).join(REPLAY_ORIGIN));
    for (const e of har.log.entries) {
      e.request.headers = e.request.headers.filter((h) => !/^(authorization|cookie)$/i.test(h.name));
    }
    writeFileSync(harPath, JSON.stringify(har));
    writeFileSync(join(FIXTURES, `${scene.id}.json`), JSON.stringify({time, sockets}, null, 1));
    console.log('recorded', scene.id);
  }
} finally {
  await close();
}
