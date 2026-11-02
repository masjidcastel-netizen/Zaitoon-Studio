// Loads the app page in a real browser (with a fake Android voice bridge) and reports what works.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('app/src/main/assets');
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.glb': 'model/gltf-binary' };
const srv = http.createServer((q, r) => {
  let p = new URL(q.url, 'http://x').pathname; if (p === '/') p = '/index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f)) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
}).listen(0);
const port = srv.address().port;

const results = [], log = [];
const rec = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext();
await ctx.addInitScript(() => {
  window.__tts = [];
  window.Android = {
    begin() {}, chunk() {}, end() {},
    ttsVoices: () => JSON.stringify([{ name: 'fr-fr-x-test', lang: 'fr-FR', local: true }, { name: 'en-us-x-test', lang: 'en-US', local: true }]),
    ttsSpeak: (id, t, v, l) => { window.__tts.push({ t, v, l }); setTimeout(() => window.__ttsEnd && window.__ttsEnd(id), 50); },
    ttsStop() {},
  };
  window.confirm = () => true;
});
const pg = await ctx.newPage();
pg.on('console', m => { if (['error', 'warning'].includes(m.type())) log.push(`console.${m.type()}: ${m.text()}`); });
pg.on('pageerror', e => log.push('PAGEERROR: ' + e.message));
pg.on('requestfailed', r => log.push('REQFAIL: ' + r.url()));
pg.on('response', r => { if (r.status() >= 400) log.push(`HTTP ${r.status()}: ${r.url()}`); });

const step = async (name, fn) => { try { const d = await fn(); rec(name, d !== false, typeof d === 'string' ? d : ''); } catch (e) { rec(name, false, String(e.message).split('\n')[0]); } };
const st = () => pg.evaluate(() => document.querySelector('#st')?.textContent);

await pg.goto(`http://localhost:${port}/index.html`);
await pg.waitForTimeout(3500);
await step('engine loaded (THREE, loader, ToonTools)', () => pg.evaluate(() => typeof THREE !== 'undefined' && !!THREE.GLTFLoader && typeof ToonTools !== 'undefined'));
await step('3D scene renders', () => pg.evaluate(() => document.querySelector('#cv')?.dataset.sceneReady === 'true'));
await step('phone voices listed', async () => { const n = await pg.evaluate(() => document.querySelector('#v0').options.length); return n > 1 ? n + ' options' : false; });
await step('Test voices speaks', async () => { await pg.click('#tv'); await pg.waitForTimeout(2500); const n = await pg.evaluate(() => window.__tts.length); return n >= 1 ? n + ' utterances' : false; });
await step('Play with voice speaks the story', async () => { const b = await pg.evaluate(() => window.__tts.length); await pg.click('#pv'); await pg.waitForTimeout(7000); const a = await pg.evaluate(() => window.__tts.length); return a > b ? (a - b) + ' utterances; status: ' + await st() : false; });
await step('music engine runs', () => pg.evaluate(() => typeof AC !== 'undefined' && AC && AC.state));
await pg.click('#sp').catch(() => {});
await step('paste-story tool', async () => { await pg.fill('#ps', 'Amina: Salam!\nOmar: Salam Amina, how are you?'); await pg.click('#us'); return pg.evaluate(() => S.scenes.length === 2 ? 'ok' : false); });
await step('AI buttons disabled with reason', () => pg.evaluate(() => ['ai', 'am', 'aie'].every(i => document.getElementById(i).disabled)));
await step('character library loads model', async () => { await pg.click('#libitems button'); await pg.waitForTimeout(6000); const s = await st(); return /ready/i.test(s) ? s : false; });
await step('export 3D pack', async () => { await pg.click('#x3'); await pg.waitForTimeout(3000); const s = await st(); return /Saved/i.test(s) ? s : false; });

await browser.close(); srv.close();
const out = ['SMOKE TEST REPORT', ...results, '', 'LOG (first 60):', ...[...new Set(log)].slice(0, 60)].join('\n');
fs.writeFileSync('smoke-report.txt', out); console.log(out);
