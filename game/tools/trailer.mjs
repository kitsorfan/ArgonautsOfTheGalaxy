// Records the trailer: about a minute of the game, cut to its own music.
//
//   npm run trailer                      builds, records, writes trailer/argonauts-trailer.mp4
//   npm run trailer -- --lang el         the Greek one: trailer/argonauts-trailer-el.mp4
//   npm run trailer -- --stills          three pictures from every shot (trailer/stills), to check the cut
//   npm run trailer -- --only argo,end   just those shots' stills (with --stills)
//   npm run trailer -- --no-build        records the game/dist already there
//
// The shots themselves are in game/src/trailer/shots.ts. Opening game/dist/index.html#trailer plays them
// live in any desktop browser, which is the quick way to look at a change; this is the slow way, and the
// one that comes out smooth.
//
// Smooth because the page runs on a clock of our own. Timers, animation frames, performance.now(), the
// date and every CSS animation are stood still and stepped forward exactly a sixtieth of a second at a
// time, and each frame is photographed before the next is asked for, so a frame that took the machine
// half a second to draw is still a sixtieth long in the film, and nothing in the game knows the difference.
//
// Needs a Chromium (Edge or Chrome; or set TRAILER_BROWSER) and ffmpeg (or set FFMPEG).
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createReadStream, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { homedir, tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const DIST = join(ROOT, 'game', 'dist');
const FPS = 60;
/**
 * What the page is laid out at: a laptop's worth of CSS pixels, drawn at one and a half to the pixel
 * (the game's High setting draws at up to twice the screen's pixels, so it takes all of it).
 */
const VIEW = { width: 1280, height: 720, ratio: 1.5 };

/* ------------------------------- options ------------------------------- */

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const option = (name) => {
  const at = argv.indexOf(`--${name}`);
  return at >= 0 ? argv[at + 1] : undefined;
};

const STILLS = flag('stills');
const HEADED = flag('headed');
const LANG = option('lang') === 'el' ? 'el' : 'en';
const ONLY = option('only')?.split(',');
const OUT = option('out') ?? join(ROOT, 'trailer', LANG === 'el' ? 'argonauts-trailer-el.mp4' : 'argonauts-trailer.mp4');
const STILLS_DIR = join(ROOT, 'trailer', 'stills');

/* ------------------------------- the tools ----------------------------- */

function findBrowser() {
  const found = [
    process.env.TRAILER_BROWSER,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/microsoft-edge',
  ].find((p) => p && existsSync(p));
  if (!found) {
    console.error('The trailer needs a Chromium browser (Edge or Chrome); set TRAILER_BROWSER to one.');
    process.exit(1);
  }
  return found;
}

/** The PATH first, then where winget and the other installers leave ffmpeg without putting it on the PATH. */
function findFfmpeg() {
  const winget = [];
  const local = process.env.LOCALAPPDATA;
  if (local) {
    winget.push(join(local, 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe'));
    const packages = join(local, 'Microsoft', 'WinGet', 'Packages');
    if (existsSync(packages)) {
      for (const name of readdirSync(packages).filter((n) => n.toLowerCase().includes('ffmpeg'))) {
        for (const build of readdirSync(join(packages, name)).sort().reverse()) winget.push(join(packages, name, build, 'bin', 'ffmpeg.exe'));
      }
    }
  }
  const found = [process.env.FFMPEG, 'ffmpeg', ...winget, 'C:/ProgramData/chocolatey/bin/ffmpeg.exe', join(homedir(), 'scoop', 'shims', 'ffmpeg.exe'), '/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg'].find(
    (p) => p && spawnSync(p, ['-version'], { stdio: 'ignore' }).status === 0,
  );
  if (!found) {
    console.error('The trailer needs ffmpeg (winget install Gyan.FFmpeg, brew install ffmpeg); set FFMPEG to one it cannot find.');
    process.exit(1);
  }
  return found;
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.mp3': 'audio/mpeg', '.js': 'text/javascript', '.png': 'image/png' };

/** game/dist, served on a port of its own. */
async function serve() {
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^[/\\]+/, '') || 'index.html';
    const file = join(DIST, path);
    if (!file.startsWith(DIST) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { url: `http://127.0.0.1:${server.address().port}/`, close: () => new Promise((r) => server.close(r)) };
}

/* ------------------------------- the clock ----------------------------- */

/**
 * Put into the page before anything of its own runs. Everything that tells the time is replaced with
 * something that only moves when we say so. Math.random is seeded too, so two recordings of the same
 * cut are the same film.
 */
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

  let seed = 0x1517
  Math.random = () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const call = (fn, args) => {
    try { typeof fn === 'function' ? fn(...args) : (0, eval)(String(fn)) }
    catch (e) { console.error(e) }
  }

  let ids = 0
  const timers = new Map()
  // While a frame's timers are running, one that asks to run again straight away waits for the next
  // frame: on a clock that only moves when it is told to, a timeout that keeps setting itself for now
  // never lets it.
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
        for (const entry of timers) {
          if (entry[1].at <= until && (!next || entry[1].at < next[1].at)) next = entry
        }
        if (!next) break
        const [id, timer] = next
        now = Math.max(now, timer.at)
        if (timer.every) timer.at += timer.every
        else timers.delete(id)
        call(timer.fn, timer.args)
      }
      now = until
      until = -1
      // CSS animations and transitions run on the compositor's clock, so each is caught the first
      // time it shows up and wound on by hand.
      for (const animation of document.getAnimations()) {
        if (!held.has(animation)) {
          held.add(animation)
          animation.pause()
          animation.currentTime = 0
        } else {
          animation.currentTime = (Number(animation.currentTime) || 0) + ms
        }
      }
      const due = frames
      frames = new Map()
      for (const fn of due.values()) call(fn, [now])
    },
  }
})()`;

/* ------------------------------ devtools ------------------------------- */

/** How long any one request to the browser may take. */
const PATIENCE = 120_000;

async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  let next = 0;
  const waiting = new Map();
  const listeners = new Map();
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(String(event.data));
    if (msg.id !== undefined) {
      const call = waiting.get(msg.id);
      waiting.delete(msg.id);
      if (msg.error) call?.reject(new Error(msg.error.message));
      else call?.resolve(msg.result);
    } else {
      for (const fn of listeners.get(msg.method) ?? []) fn(msg.params);
    }
  });
  ws.addEventListener('close', () => {
    for (const call of waiting.values()) call.reject(new Error('closed'));
  });
  return {
    send: (method, params = {}) =>
      new Promise((resolve, reject) => {
        const id = ++next;
        // A page that has stopped answering says so, rather than leaving the recording waiting on it for ever.
        const timer = setTimeout(() => {
          waiting.delete(id);
          reject(new Error(`${method} got no answer in ${PATIENCE / 1000}s.`));
        }, PATIENCE);
        waiting.set(id, {
          resolve: (v) => {
            clearTimeout(timer);
            resolve(v);
          },
          reject: (e) => {
            clearTimeout(timer);
            reject(e);
          },
        });
        ws.send(JSON.stringify({ id, method, params }));
      }),
    on: (event, fn) => listeners.set(event, [...(listeners.get(event) ?? []), fn]),
    close: () => ws.close(),
  };
}

/** Runs an expression in the page and hands back its value. */
async function evaluate(page, expression) {
  const { result, exceptionDetails } = await page.send('Runtime.evaluate', { expression, returnByValue: true });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  return result.value;
}

async function launch(browser, profile) {
  const args = [
    ...(HEADED ? [] : ['--headless=new']),
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    '--mute-audio',
    '--autoplay-policy=no-user-gesture-required',
    `--window-size=${VIEW.width},${VIEW.height}`,
    '--force-device-scale-factor=1',
    // A real GPU, not the software rasteriser headless falls back to.
    '--enable-gpu',
    '--ignore-gpu-blocklist',
    // Nothing on this page is ever in the background, whatever the OS thinks.
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    'about:blank',
  ];
  const child = spawn(browser, args, { stdio: 'ignore' });
  const portFile = join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 200 && !existsSync(portFile); i++) await new Promise((r) => setTimeout(r, 100));
  if (!existsSync(portFile)) throw new Error('The browser never opened a port.');
  const [port] = readFileSync(portFile, 'utf8').split('\n');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target = targets.find((t) => t.type === 'page');
  if (!target) throw new Error('The browser opened no page.');
  return { child, page: await connect(target.webSocketDebuggerUrl) };
}

/* ------------------------------- recording ----------------------------- */

const STEP = `(() => {
  __clock.advance(${1000 / FPS})
  const t = window.__trailer
  return t ? { take: t.take, frame: t.frame, phase: t.phase, shot: t.shot } : { take: false, frame: -1, phase: 'loading', shot: '' }
})()`;

const seconds = (frames) => (frames / FPS).toFixed(2);

async function record() {
  const browser = findBrowser();
  const ffmpeg = STILLS ? '' : findFfmpeg();
  if (!flag('no-build')) {
    console.log('Building the game…');
    const built = spawnSync(process.execPath, [join(ROOT, 'game', 'build.mjs')], { stdio: 'inherit' });
    if (built.status !== 0) throw new Error('The game did not build.');
  }
  const site = await serve();
  const profile = mkdtempSync(join(tmpdir(), 'trailer-profile-'));
  const { child, page } = await launch(browser, profile);

  try {
    page.on('Runtime.exceptionThrown', (p) => console.error('[page]', p.exceptionDetails.exception?.description ?? p.exceptionDetails.text));
    page.on('Runtime.consoleAPICalled', (p) => {
      const args = p.args.map((a) => a.value ?? a.description);
      if (p.type === 'error') console.error('[page]', ...args);
      else if (String(args[0]).startsWith('[trailer]')) console.log(...args);
    });
    await page.send('Runtime.enable');
    await page.send('Page.enable');
    await page.send('Emulation.setDeviceMetricsOverride', { width: VIEW.width, height: VIEW.height, deviceScaleFactor: VIEW.ratio, mobile: false });
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: CLOCK });
    const extra = option('hash') ? `&${option('hash')}` : '';
    const url = `${site.url}index.html#trailer${LANG === 'el' ? '&lang=el' : ''}${extra}`;
    console.log(`Opening ${url}`);
    await page.send('Page.navigate', { url });

    // Wind the clock while the game loads, until the director has it.
    const started = Date.now();
    let step = { take: false, frame: -1, phase: 'loading', shot: '' };
    for (;;) {
      try {
        step = await evaluate(page, STEP);
      } catch {
        // The page is still between documents; ask again in a moment.
        await new Promise((r) => setTimeout(r, 100));
      }
      if (step.phase !== 'loading' && step.phase !== 'warmup') break;
      if (Date.now() - started > 120_000) throw new Error(`The game never got going (stuck at ${step.phase}).`);
    }
    const { total, shots, music } = await evaluate(page, '({ total: __trailer.total, shots: __trailer.shots, music: __trailer.music })');
    console.log(`${shots.length} shots, ${total} frames, ${seconds(total)}s`);

    let encoder = null;
    /** For the stills: the frames to keep, and what to call each. */
    const wants = new Map();
    if (STILLS) {
      if (!ONLY) rmSync(STILLS_DIR, { recursive: true, force: true });
      mkdirSync(STILLS_DIR, { recursive: true });
      shots.forEach((s, i) => {
        if (ONLY && !ONLY.includes(s.id)) return;
        const name = `${String(i + 1).padStart(2, '0')}-${s.id}`;
        // Near the start, the middle, and the very last frame (the one the cut lands on), which is
        // enough to see what a move does without watching it.
        wants.set(Math.floor(s.from + (s.to - s.from) * 0.1), `${name}-a`);
        wants.set(Math.floor((s.from + s.to) / 2), `${name}-b`);
        wants.set(s.to - 1, `${name}-c`);
      });
    } else {
      mkdirSync(join(OUT, '..'), { recursive: true });
      const length = total / FPS;
      const song = join(ROOT, 'assets', 'music', `${music.file}.mp3`);
      encoder = spawn(
        ffmpeg,
        [
          ...['-y', '-loglevel', 'error'],
          ...['-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-'],
          ...['-ss', String(music.from), '-i', song],
          '-af',
          `loudnorm=I=-14:TP=-1.5:LRA=11,afade=t=in:d=0.6,afade=t=out:st=${(length - 2.5).toFixed(3)}:d=2.5`,
          ...['-map', '0:v', '-map', '1:a'],
          ...['-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-profile:v', 'high', '-pix_fmt', 'yuv420p'],
          ...['-c:a', 'aac', '-b:a', '192k', '-ar', '48000'],
          ...['-t', length.toFixed(3), '-movflags', '+faststart'],
          OUT,
        ],
        { stdio: ['pipe', 'inherit', 'inherit'] },
      );
    }

    let expected = 0;
    let shot = '';
    const rolling = Date.now();
    const last = Math.max(...wants.keys(), -1);
    for (;;) {
      if (step.take) {
        if (step.frame !== expected) console.warn(`  frame ${step.frame} where ${expected} was expected`);
        expected = step.frame + 1;
        if (step.shot !== shot) {
          shot = step.shot;
          const at = shots.findIndex((s) => s.id === shot);
          const elapsed = (Date.now() - rolling) / 1000;
          const left = step.frame > 0 ? (elapsed / step.frame) * (total - step.frame) : 0;
          console.log(`  ${String(at + 1).padStart(2)}/${shots.length} ${shot.padEnd(22)} ${seconds(step.frame)}s` + (left ? `   ~${Math.ceil(left / 60)} min to go` : ''));
        }
        if (encoder || wants.has(step.frame)) {
          const { data } = await page.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: !STILLS });
          const png = Buffer.from(data, 'base64');
          if (encoder) {
            if (!encoder.stdin.write(png)) await once(encoder.stdin, 'drain');
          } else {
            writeFileSync(join(STILLS_DIR, `${wants.get(step.frame)}.png`), png);
          }
        }
        if (!encoder && step.frame >= last) break;
      }
      if (step.phase === 'done') break;
      step = await evaluate(page, STEP);
    }

    if (encoder) {
      encoder.stdin.end();
      const [code] = await once(encoder, 'exit');
      if (code !== 0) throw new Error(`ffmpeg stopped with ${code}.`);
      console.log(`Wrote ${OUT}`);
    } else {
      console.log(`Wrote ${wants.size} stills to ${STILLS_DIR}`);
    }
  } finally {
    page.close();
    child.kill();
    await site.close();
    // The browser takes a moment to let go of its profile on Windows.
    await new Promise((r) => setTimeout(r, 500));
    rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
  }
}

await record();
