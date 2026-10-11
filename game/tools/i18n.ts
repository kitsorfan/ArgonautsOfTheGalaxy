/// <reference types="node" />
/**
 * Translation check: `node game/tools/run.mjs i18n [--json out.json]`.
 *
 * Collects every English string the player can see (deck data, story text, and the strings in the
 * code that go to the screen) and lists the ones the Greek table is missing, plus Greek entries whose
 * {placeholders} don't match their English key. `--json` writes the missing ones to a file.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { GAME_NAME, SHIP } from '../src/core/brand';
import { HINTS } from '../src/game/quests';
import { AEETES_INTRO, ARGO_BUILT, BOSS_CARD, BROADCAST, ENDING_CAPTIONS, FLEECE, FLYOVER, INTEL, PROLOGUE, PROLOGUE2, PROLOGUE3, STOLEN, TRANSITIONS } from '../src/game/story';
import { EL } from '../src/i18n/el';
import { CHAPTERS, CHAPTER_PLAN, LEVELS, LEVEL_ORDER } from '../src/levels';

/** The game's sources, from the project root (where npm scripts and Jest run). */
const SRC = join(process.cwd(), 'game/src');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });
}

const unescape = (s: string) => s.replace(/\\n/g, '\n').replace(/\\(['"`\\])/g, '$1');
const lit = `(['"\`])((?:\\\\.|(?!\\1)[^\\\\])*)\\1`;

/** Code patterns whose first string argument ends up on screen. */
const PATTERNS = [
  new RegExp(`\\b(?:tr|toast|reward|warn|confirm|label|caption)(?:\\?\\.)?\\(\\s*${lit}`, 'g'),
  new RegExp(`\\btext:\\s*${lit}`, 'g'),
  new RegExp(`\\breadonly title = ${lit}`, 'g'),
];
/** Only these files hold on-screen strings in object fields (the shop, upgrade and outfit names, credits). */
const FIELD_FILES: Record<string, RegExp[]> = {
  'ui.ts': [new RegExp(`\\b(?:name|desc):\\s*${lit}`, 'g')],
  'shop.ts': [new RegExp(`\\b(?:name|desc):\\s*${lit}`, 'g')],
  'outfits.ts': [new RegExp(`\\b(?:name|desc):\\s*${lit}`, 'g')],
  'weapons.ts': [new RegExp(`\\b(?:name|desc|special):\\s*${lit}`, 'g')],
  'quests.ts': [new RegExp(`^\\s+\\w+:\\s*${lit},?$`, 'gm')],
  'story.ts': [new RegExp(`\\b(?:p|head)\\(\\s*${lit}`, 'g')],
};

export function englishStrings(): Set<string> {
  const out = new Set<string>();
  const add = (s: string | undefined) => {
    if (s && /[A-Za-z]/.test(s) && !s.includes('${')) out.add(s);
  };
  add(GAME_NAME);
  add(SHIP);
  for (const id of LEVEL_ORDER) {
    const d = LEVELS[id];
    add(d.name);
    add(d.subtitle);
    for (const o of d.objectives) add(o.text);
    for (const lines of Object.values(d.dialogues)) for (const l of lines) (add(l.text), add(l.name));
    for (const beats of Object.values(d.stories ?? {})) {
      for (const b of beats) {
        add(b.caption);
        for (const l of b.lines ?? []) (add(l.text), add(l.name));
      }
    }
    for (const s of Object.values(d.legend)) {
      if (s.type === 'sign') add(s.text);
      if (s.type === 'cocoon') (add(s.name), add(s.line));
    }
  }
  Object.values(PROLOGUE).forEach(add);
  Object.values(PROLOGUE2).forEach(add);
  Object.values(PROLOGUE3).forEach(add);
  for (const l of [...BROADCAST, ...STOLEN, ...FLEECE, ...ARGO_BUILT, ...AEETES_INTRO]) add(l.text);
  // The names of levels still being built show in the level select as "coming soon".
  for (const ch of CHAPTERS) CHAPTER_PLAN[ch].forEach(add);
  Object.values(FLYOVER).forEach(add);
  for (const lines of Object.values(TRANSITIONS)) for (const l of lines) add(l.text);
  for (const c of Object.values(BOSS_CARD)) add(c.sub);
  for (const i of Object.values(INTEL)) (add(i.name), add(i.tip));
  for (const list of Object.values(ENDING_CAPTIONS)) list.forEach(add);
  Object.values(HINTS).forEach(add);
  for (const f of files(SRC)) {
    if (f.includes('i18n')) continue;
    const src = readFileSync(f, 'utf8');
    const name = f.split(/[\\/]/).pop() as string;
    for (const re of [...PATTERNS, ...(FIELD_FILES[name] ?? [])]) {
      for (const m of src.matchAll(re)) add(unescape(m[2]));
    }
    // What the LUX button says next to things he can use: the strings returned by `label()`.
    for (const body of src.matchAll(/\n {2}label\(\)[^{]*\{([\s\S]*?)\n {2}\}/g)) {
      for (const m of body[1].matchAll(/'([^']+)'/g)) add(m[1]);
    }
  }
  // Speaker names come from a table rather than a call.
  for (const m of readFileSync(join(SRC, 'ui/icons.ts'), 'utf8').split('SPEAKER_NAME')[1].split('};')[0].matchAll(new RegExp(`:\\s*${lit}`, 'g'))) add(m[2]);
  return out;
}

const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

export function checkGreek() {
  const en = englishStrings();
  const missing = [...en].filter((s) => !(s in EL));
  const badVars = Object.entries(EL).filter(([k, v]) => holes(k) !== holes(v)).map(([k]) => k);
  const unused = Object.keys(EL).filter((k) => !en.has(k));
  return { total: en.size, missing, badVars, unused };
}

if (process.argv[1]?.includes('i18n')) {
  const r = checkGreek();
  console.log(`${r.total} strings, ${r.missing.length} missing in Greek, ${r.badVars.length} with mismatched placeholders, ${r.unused.length} unused Greek entries`);
  for (const k of r.badVars) console.log(`  placeholders differ: ${k}`);
  for (const k of r.unused) console.log(`  unused: ${k}`);
  const i = process.argv.indexOf('--json');
  if (i > 0) writeFileSync(process.argv[i + 1], JSON.stringify(r.missing, null, 1));
  else for (const k of r.missing.slice(0, 40)) console.log(`  missing: ${k}`);
}
