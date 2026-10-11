// Draws the app icon, the Android adaptive icon layers, the favicon, the Play Store icon and the native
// splash image from the game's brand art (src/ui/emblem.ts), and rasterizes them with a headless Chrome or
// Edge (set CHROME to its path if it isn't found).
// Run: npm run gen:icons
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { emblemSvg, luxArt } from '../src/ui/emblem';

const ROOT = process.cwd();
const IMAGES = join(ROOT, 'assets', 'images');

function browser(): string {
  const found = [
    process.env.CHROME,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/microsoft-edge',
  ].find((p) => p && existsSync(p));
  if (!found) throw new Error('No Chrome or Edge found: set CHROME to a Chromium-based browser.');
  return found;
}

/** A sky of stars, the same every run. */
function stars(n: number, seed: number, maxR: number): string {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  let out = '';
  for (let i = 0; i < n; i++) {
    const r = (0.3 + rnd() ** 3 * 0.7) * maxR;
    out += `<circle cx="${(rnd() * 1024).toFixed(1)}" cy="${(rnd() * 1024).toFixed(1)}" r="${r.toFixed(2)}" fill="#fff" opacity="${(0.35 + rnd() * 0.65).toFixed(2)}"/>`;
  }
  return out;
}

/** Deep space with a cyan and a pink nebula, in a 1024 box. */
const SPACE = `<defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="80%"><stop offset="0" stop-color="#1b2a66"/><stop offset=".55" stop-color="#0c1436"/><stop offset="1" stop-color="#04060f"/></radialGradient>
    <radialGradient id="n1" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ff6fcf" stop-opacity=".45"/><stop offset="1" stop-color="#ff6fcf" stop-opacity="0"/></radialGradient>
    <radialGradient id="n2" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#5ee0ff" stop-opacity=".4"/><stop offset="1" stop-color="#5ee0ff" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <ellipse cx="850" cy="860" rx="380" ry="300" fill="url(#n1)"/>
  <ellipse cx="150" cy="170" rx="360" ry="280" fill="url(#n2)"/>
  ${stars(110, 7, 4.2)}`;

/** LUX's place in the icon, and the golden orbit around him (the voyage of the Argonauts): its far half and near half. */
const LUX_AT = 'translate(512 540) scale(3.9) translate(-100 -104)';
const ORBIT_BACK = 'M160 644 A370 120 -18 0 1 864 416';
const ORBIT_FRONT = 'M864 416 A370 120 -18 0 1 160 644';
const SPARK = 'M864 380 L872 408 L900 416 L872 424 L864 452 L856 424 L828 416 L856 408 Z';

/** LUX with his golden orbit, scaled about the centre (adaptive icons keep to the middle two thirds). */
function luxOrbit(scale: number): string {
  return `<defs>
      <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffe7a3"/><stop offset=".5" stop-color="#ffc94a"/><stop offset="1" stop-color="#e09a2a"/></linearGradient>
      <radialGradient id="under" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#5ee0ff" stop-opacity=".55"/><stop offset="1" stop-color="#5ee0ff" stop-opacity="0"/></radialGradient>
    </defs>
    <g transform="translate(512 512) scale(${scale}) translate(-512 -512)">
      <circle cx="512" cy="560" r="380" fill="url(#under)"/>
      <path d="${ORBIT_BACK}" fill="none" stroke="url(#gold)" stroke-width="22" stroke-linecap="round" opacity=".55"/>
      <g transform="${LUX_AT}">${luxArt('ic', false)}</g>
      <path d="${ORBIT_FRONT}" fill="none" stroke="url(#gold)" stroke-width="22" stroke-linecap="round"/>
      <path d="${SPARK}" fill="#fff6d6"/>
    </g>`;
}

/** One-colour LUX for Android's themed icons: white, with his eye, band and the orbit's crossing cut out. */
function luxMono(scale: number): string {
  return `<defs><mask id="cut"><rect width="1024" height="1024" fill="#fff"/>
      <g transform="${LUX_AT}"><circle cx="100" cy="100" r="32"/><path d="M40 116 Q100 134 160 116 L160 120 Q100 138 40 120 Z"/></g>
      <path d="${ORBIT_FRONT}" fill="none" stroke="#000" stroke-width="54" stroke-linecap="round"/>
    </mask>
    <mask id="glint"><rect width="1024" height="1024" fill="#fff"/><g transform="${LUX_AT}"><circle cx="91" cy="90" r="6"/></g></mask></defs>
    <g transform="translate(512 512) scale(${scale}) translate(-512 -512)" fill="#fff">
      <path d="${ORBIT_BACK}" fill="none" stroke="#fff" stroke-width="22" stroke-linecap="round"/>
      <g mask="url(#cut)"><g transform="${LUX_AT}">
        <ellipse cx="44" cy="108" rx="13" ry="22"/><ellipse cx="156" cy="108" rx="13" ry="22"/>
        <path d="M114 56 L128 26" stroke="#fff" stroke-width="5" stroke-linecap="round"/><circle cx="129" cy="24" r="8"/>
        <circle cx="100" cy="106" r="56"/>
      </g></g>
      <g mask="url(#glint)"><g transform="${LUX_AT}"><circle cx="100" cy="100" r="22"/></g></g>
      <path d="${ORBIT_FRONT}" fill="none" stroke="#fff" stroke-width="22" stroke-linecap="round"/>
    </g>`;
}

const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${body}</svg>`;

/** Each output: where it goes, its size in pixels, and its picture. */
const OUTPUTS: { file: string; size: number; svg: string }[] = [
  { file: join(IMAGES, 'icon.png'), size: 1024, svg: svg(SPACE + luxOrbit(1)) },
  { file: join(IMAGES, 'android-icon-background.png'), size: 1024, svg: svg(SPACE) },
  { file: join(IMAGES, 'android-icon-foreground.png'), size: 1024, svg: svg(luxOrbit(0.78)) },
  { file: join(IMAGES, 'android-icon-monochrome.png'), size: 1024, svg: svg(luxMono(0.78)) },
  { file: join(IMAGES, 'favicon.png'), size: 48, svg: svg(SPACE + luxOrbit(1.08)) },
  // The native splash: the emblem alone, on a transparent background (app.json gives the colour behind it).
  { file: join(IMAGES, 'splash-icon.png'), size: 1024, svg: emblemSvg(1024) },
  { file: join(ROOT, 'docs', 'store', 'icon-512.png'), size: 512, svg: svg(SPACE + luxOrbit(1)) },
];

const exe = browser();
const tmp = mkdtempSync(join(tmpdir(), 'icons-'));
try {
  for (const o of OUTPUTS) {
    const page = join(tmp, 'page.html');
    const sized = o.svg.replace('<svg ', `<svg width="${o.size}" height="${o.size}" `);
    writeFileSync(page, `<!doctype html><html><body style="margin:0;background:transparent;overflow:hidden">${sized}</body></html>`);
    const started = Date.now();
    const args = ['--headless=new', '--hide-scrollbars', '--no-first-run', '--disable-extensions', `--user-data-dir=${join(tmp, 'profile')}`];
    try {
      execFileSync(exe, [...args, '--default-background-color=00000000', `--window-size=${o.size},${o.size}`, `--screenshot=${o.file}`, pathToFileURL(page).href], { stdio: 'ignore', timeout: 30000 });
    } catch (e) {
      // Edge sometimes writes the picture and then never exits: that's fine, anything else isn't.
      if (!existsSync(o.file) || statSync(o.file).mtimeMs < started) throw e;
    }
    console.log(`${o.file.slice(ROOT.length + 1)} ${o.size}x${o.size}`);
  }
  writeFileSync(join(IMAGES, 'splash-emblem.svg'), emblemSvg(1024));
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
