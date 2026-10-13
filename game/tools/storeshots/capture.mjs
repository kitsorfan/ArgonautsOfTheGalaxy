// Takes the Google Play screenshots: headless Edge over CDP on a virtual clock (the trailer tool's
// approach, game/tools/trailer.mjs), phone landscape 960x540 CSS px at device scale 2 = 1920x1080.
//
//   node capture.mjs --site <dir with index.html> --lang en|el --out <dir> [--only a,b] [--probe]
//
// --probe saves every `probe` frame of each shot as <id>-<frame>.jpg; otherwise saves the `pick`
// frame as <NN>-<slug>.jpg.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createReadStream, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';

const argv = process.argv.slice(2);
const option = (n) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const flag = (n) => argv.includes(`--${n}`);
const SITE = option('site');
const LANG = option('lang') === 'el' ? 'el' : 'en';
const OUT = option('out');
const ONLY = option('only')?.split(',');
const PROBE = flag('probe');
const QUALITY = Number(option('quality') ?? 85);
const { SHOTS } = await import(new URL(option('shots') ?? './shots.mjs', import.meta.url));
mkdirSync(OUT, { recursive: true });

const BROWSER = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);

async function serve() {
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^[/\\]+/, '') || 'index.html';
    const file = join(SITE, path);
    if (!existsSync(file) || !statSync(file).isFile()) return res.writeHead(404).end();
    res.writeHead(200, { 'content-type': extname(file) === '.html' ? 'text/html; charset=utf-8' : 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { url: `http://127.0.0.1:${server.address().port}/`, close: () => new Promise((r) => server.close(r)) };
}

// The trailer's virtual clock, verbatim apart from the seed.
const CLOCK = `(() => {
  const EPOCH = Date.UTC(2026, 9, 13, 9, 0, 0)
  let now = 0
  const RealDate = Date
  class VirtualDate extends RealDate {
    constructor(...args) { if (args.length) super(...args); else super(EPOCH + now) }
    static now() { return EPOCH + now }
  }
  globalThis.Date = VirtualDate
  performance.now = () => now
  let seed = 0x2417
  Math.random = () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const call = (fn, args) => { try { typeof fn === 'function' ? fn(...args) : (0, eval)(String(fn)) } catch (e) { console.error(e) } }
  let ids = 0
  const timers = new Map()
  let until = -1
  const add = (fn, ms, args, every) => {
    const id = ++ids
    let at = now + Math.max(0, Number(ms) || 0)
    if (at <= until && !every) at = until + 0.001
    timers.set(id, { fn, args, at, every })
    return id
  }
  globalThis.setTimeout = (fn, ms, ...args) => add(fn, ms, args, 0)
  globalThis.setInterval = (fn, ms, ...args) => add(fn, ms, args, Math.max(1, Number(ms) || 0))
  globalThis.clearTimeout = globalThis.clearInterval = (id) => { timers.delete(id) }
  let frames = new Map()
  globalThis.requestAnimationFrame = (fn) => { const id = ++ids; frames.set(id, fn); return id }
  globalThis.cancelAnimationFrame = (id) => { frames.delete(id) }
  const held = new WeakSet()
  globalThis.__clock = {
    advance(ms) {
      until = now + ms
      for (;;) {
        let next = null
        for (const entry of timers) if (entry[1].at <= until && (!next || entry[1].at < next[1].at)) next = entry
        if (!next) break
        const [id, timer] = next
        now = Math.max(now, timer.at)
        if (timer.every) timer.at += timer.every
        else timers.delete(id)
        call(timer.fn, timer.args)
      }
      now = until
      until = -1
      for (const animation of document.getAnimations()) {
        if (!held.has(animation)) { held.add(animation); animation.pause(); animation.currentTime = 0 }
        else animation.currentTime = (Number(animation.currentTime) || 0) + ms
      }
      const due = frames
      frames = new Map()
      for (const fn of due.values()) call(fn, [now])
    },
  }
})()`;

// Helpers the shots call in the page.
const HELPERS = `(() => {
  const H = {}
  H.ground = (w, x, z) => w.grid.cell(Math.floor(x / 2), Math.floor(z / 2)).h
  H.place = (x, z, face) => {
    const w = __game.world
    w.player.teleport(x, H.ground(w, x, z) + 0.05, z)
    w.player.facing = Math.atan2(face[0] - x, face[1] - z)
    w.cameraYaw = w.player.facing + Math.PI
    w.snapCamera()
  }
  H.fight = (at) => {
    const w = __game.world
    w.player.hurt = () => {}
    for (const h of (w.heroes || [])) if (h && h !== w.player) h.hurt = () => {}
    const b = w.boss
    const c = b ? b.where : { x: at[0], z: at[1] - 10 }
    H.place(at[0], at[1], [c.x, c.z])
    if (b) b.engage()
  }
  H.rig = (pos, look, fov) => {
    const w = __game.world
    const p = w.camera.position.clone().set(...pos)
    const l = w.camera.position.clone().set(...look)
    w.setCameraRig({ pos: p, look: l, fov }, 0)
  }
  let down = []
  H.tap = (b) => { __game.input.press(b, true); down.push(b) }
  H.release = () => { for (const b of down) __game.input.press(b, false); down = [] }
  H.faceBoss = () => {
    const w = __game.world, b = w && w.boss, p = w && w.player
    if (b && p) p.facing = Math.atan2(b.where.x - p.body.x, b.where.z - p.body.z)
  }
  H.every = (t, period, at = 0) => Math.floor((t - at) / period) !== Math.floor((t - at - 1 / 60) / period)
  window.__H = H
})()`;

async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  let next = 0;
  const waiting = new Map();
  const listeners = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(String(e.data));
    if (m.id !== undefined) {
      const c = waiting.get(m.id);
      waiting.delete(m.id);
      if (m.error) c?.reject(new Error(m.error.message));
      else c?.resolve(m.result);
    } else for (const fn of listeners.get(m.method) ?? []) fn(m.params);
  });
  return {
    send: (method, params = {}) =>
      new Promise((resolve, reject) => {
        const id = ++next;
        waiting.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      }),
    on: (ev, fn) => listeners.set(ev, [...(listeners.get(ev) ?? []), fn]),
    close: () => ws.close(),
  };
}

async function evaluate(page, expression) {
  const { result, exceptionDetails } = await page.send('Runtime.evaluate', { expression, returnByValue: true });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  return result.value;
}

async function launch(profile) {
  const child = spawn(
    BROWSER,
    [
      '--headless=new',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      '--mute-audio',
      '--window-size=960,540',
      '--enable-gpu',
      '--ignore-gpu-blocklist',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  const portFile = join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 200 && !existsSync(portFile); i++) await new Promise((r) => setTimeout(r, 100));
  const [port] = readFileSync(portFile, 'utf8').split('\n');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  return { child, page: await connect(targets.find((t) => t.type === 'page').webSocketDebuggerUrl) };
}

const site = await serve();
const profile = mkdtempSync(join(tmpdir(), 'storeshots-'));
const { child, page } = await launch(profile);
try {
  page.on('Runtime.exceptionThrown', (p) => console.error('[page]', p.exceptionDetails.exception?.description ?? p.exceptionDetails.text));
  page.on('Runtime.consoleAPICalled', (p) => {
    if (p.type === 'error') console.error('[page]', ...p.args.map((a) => a.value ?? a.description));
  });
  await page.send('Runtime.enable');
  await page.send('Page.enable');
  await page.send('Emulation.setDeviceMetricsOverride', { width: 960, height: 540, deviceScaleFactor: 2, mobile: true });
  await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: CLOCK });

  // A fresh save from the game itself, with the language, High graphics and no sound.
  const go = async (url) => {
    await page.send('Page.navigate', { url: 'about:blank' });
    await page.send('Page.navigate', { url });
    for (let i = 0; i < 400; i++) {
      try {
        if (await evaluate(page, '!!window.__game')) return;
      } catch {}
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error('no game');
  };
  await go(`${site.url}index.html`);
  const save = JSON.parse(await evaluate(page, 'JSON.stringify(__game.save)'));
  save.settings = { ...save.settings, lang: LANG, langChosen: true, quality: 'high', autoQuality: false, music: 0, sfx: 0 };
  save.playSeconds = 999999;
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__SAVE__ = ${JSON.stringify(JSON.stringify(save))}; try { localStorage.clear() } catch {}` });
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: HELPERS });

  for (const [index, shot] of SHOTS.entries()) {
    if (ONLY && !ONLY.includes(shot.id)) continue;
    const save2 = shot.save ? shot.save(structuredClone(save)) : null;
    let extra = null;
    if (save2) extra = (await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__SAVE__ = ${JSON.stringify(JSON.stringify(save2))}` })).identifier;
    const t0 = Date.now();
    const view = shot.view ?? { width: 960, height: 540 };
    await page.send('Emulation.setDeviceMetricsOverride', { ...view, deviceScaleFactor: 2, mobile: true });
    await go(`${site.url}index.html#${shot.hash}`);
    if (shot.css) await evaluate(page, `(() => { const s = document.createElement('style'); s.textContent = ${JSON.stringify(shot.css)}; document.head.appendChild(s) })()`);
    const probes = new Set(PROBE ? shot.probe : [shot.pick]);
    const last = Math.max(...probes);
    const setups = shot.setups ?? [];
    for (let f = 0; f <= last; f++) {
      const t = f / 60;
      let js = '';
      for (const s of setups) if (s.at === f) js += `;(() => { const H = __H; ${s.js} })();`;
      if (shot.act && f >= (shot.actFrom ?? 0)) js += `;(() => { const H = __H, t = ${t - (shot.actFrom ?? 0) / 60}; ${shot.act} })();`;
      await evaluate(page, `(() => { __H.release(); ${js}; __clock.advance(1000 / 60); })()`);
      if (probes.has(f)) {
        if (shot.before) await evaluate(page, `(() => { const H = __H; ${shot.before} })()`);
        const { data } = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: QUALITY });
        const name = PROBE ? `${shot.id}-${f}.jpg` : (shot.file ?? `${String(index + 1).padStart(2, '0')}-${shot.slug}.jpg`);
        writeFileSync(join(OUT, name), Buffer.from(data, 'base64'));
        console.log(`  ${name}`);
      }
    }
    if (extra) await page.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: extra });
    console.log(`${shot.id}: ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
} finally {
  page.close();
  child.kill();
  await site.close();
  await new Promise((r) => setTimeout(r, 500));
  rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
}
