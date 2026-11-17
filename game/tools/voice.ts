/// <reference types="node" />
/**
 * Records the game's voices: `npm run voice` (node game/tools/run.mjs voice).
 *
 *   npm run voice                       records every line that is new, or whose words, voice or effect changed
 *   npm run voice -- --only lux,1a2b3c4d  fresh takes of those lines (a trailer line's id, or a recording's name)
 *   npm run voice -- --force            fresh takes of everything
 *   npm run voice -- --dry              says what it would record, and records nothing
 *
 * Two sets of lines:
 *   - the trailer's narration (game/src/trailer/narration.ts), kept as assets/voice/trailer/<id>.wav;
 *   - the story's voice-over: every line the game speaks (`everything` below), in the voices
 *     game/src/core/cast.ts gives each speaker, kept as assets/voice/game/<key>.mp3 (the key is
 *     core/voice.ts's `voiceKey`), with an index.json the game reads to know which lines it can speak,
 *     and for how long.
 * Each set's lines.json says which engine, voice, effect and words every recording was made with; that
 * is how this tool, the trailer recorder and the tests know a recording is out of date. The recordings
 * are committed, so only whoever changes a line needs the speech engine.
 *
 * The speaking is done in Python (game/tools/voice/speak.py). The two engines want different versions of
 * the same libraries, so each has an interpreter of its own: Pocket TTS the one in VOICE_PYTHON or else
 * ~/.argonauts-voice (game/tools/voice/requirements.txt says how to set it up), Chatterbox the one in
 * CHATTERBOX_PYTHON or else ~/.argonauts-chatterbox (requirements-chatterbox.txt).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

import { SHIP } from '../src/core/brand';
import { CAST, SAY_AS, engineOf, type Engine } from '../src/core/cast';
import { voiceKey, type Voice } from '../src/core/voice';
import { DRAGON_NODDING, DRAGON_VERSES } from '../src/entities/ch3/gardenData';
import * as STORY from '../src/game/story';
import { LEVELS } from '../src/levels';
import { NARRATION, NARRATOR, VOICE_DIR } from '../src/trailer/narration';

/** The story's captions, which the narrator reads (cinema/director.ts `caption`). */
const CAPTIONS: unknown[] = [STORY.PROLOGUE, STORY.PROLOGUE2, STORY.PROLOGUE3, STORY.FLYOVER, STORY.ENDING_CAPTIONS];

/**
 * Every line the game speaks, wherever it keeps them: each level's dialogues and storybook scenes (and
 * their captions), and the signs LUX reads out; the story's scenes and captions; and the dragon fight's
 * lines. A line whose words depend on the game (a count of shards, say) is not here: it stays silent.
 */
function everything(): { who: Voice; text: string }[] {
  const found: { who: Voice; text: string }[] = [];
  const walk = (x: unknown, narrated: boolean): void => {
    if (typeof x === 'string') {
      if (narrated) found.push({ who: 'narrator', text: x });
    } else if (Array.isArray(x)) {
      for (const y of x) walk(y, narrated);
    } else if (x && typeof x === 'object') {
      const o = x as Record<string, unknown>;
      if (typeof o.who === 'string' && typeof o.text === 'string') found.push({ who: o.who as Voice, text: o.text });
      else if (o.type === 'sign' && typeof o.text === 'string') found.push({ who: 'bolt', text: o.text });
      else for (const [k, v] of Object.entries(o)) walk(v, narrated || k === 'caption');
    }
  };
  for (const level of Object.values(LEVELS)) walk(level, false);
  for (const x of Object.values(STORY)) walk(x, CAPTIONS.includes(x));
  walk([DRAGON_VERSES, DRAGON_NODDING], false);
  return found;
}

/** One recording: what it is called, who says what, and how. */
interface Take {
  id: string;
  who?: string;
  engine: Engine;
  voice: string;
  fx?: string;
  say: string;
}

/** A set's lines.json. */
interface Made {
  lines: Record<string, Omit<Take, 'id'> & { seconds: number }>;
}

interface LineSet {
  name: string;
  /** From the project root. */
  dir: string;
  ext: 'wav' | 'mp3';
  takes: Take[];
  /** Also writes index.json, the recordings' lengths, for the game. */
  index?: boolean;
}

/** A line's words as the engine should say them: no markup or quotation marks, the ship's name filled in, no shouting. */
function spoken(text: string): string {
  // Quotation marks are for the eye: a voice reading one ends a line with a made-up word, or garbles the
  // word inside (the Gardeners' “sky”).
  let s = text.replace(/\{ship\}/g, SHIP).replace(/<[^>]+>/g, '').replace(/[“”"]/g, '');
  // Capitals are shouting on screen, but an engine may spell them out letter by letter: say them as words
  // (AEËTES too, so letters beyond A to Z count).
  s = s.replace(/(?<!\p{L})\p{Lu}[\p{Lu}’']+(?!\p{L})/gu, (w) => w[0] + w.slice(1).toLowerCase());
  for (const [from, to] of Object.entries(SAY_AS)) s = s.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu'), to);
  return s.replace(/\s+/g, ' ').trim();
}

function storyTakes(): Take[] {
  const takes = new Map<string, Take>();
  const silent = new Map<string, number>();
  for (const { who, text } of everything()) {
    // Nothing to say (an empty caption, say).
    if (!/\p{L}/u.test(spoken(text))) continue;
    const part = CAST[who];
    if (!part) {
      silent.set(who, (silent.get(who) ?? 0) + 1);
      continue;
    }
    const id = voiceKey(who, text);
    takes.set(id, { id, who, engine: engineOf(part), voice: part.voice, ...(part.fx ? { fx: part.fx } : {}), say: spoken(text) });
  }
  for (const [who, n] of silent) console.warn(`  (nobody plays ${who} yet, so their ${n} lines stay silent)`);
  return [...takes.values()];
}

const SETS: LineSet[] = [
  {
    name: 'trailer narration',
    dir: VOICE_DIR,
    ext: 'wav',
    takes: NARRATION.map((l) => ({ id: l.id, engine: NARRATOR.engine, voice: NARRATOR.voice, say: l.say })),
  },
  { name: 'story voice-over', dir: 'assets/voice/game', ext: 'mp3', takes: storyTakes(), index: true },
];

const ROOT = process.cwd();
const argv = process.argv.slice(2);
const at = argv.indexOf('--only');
const only = at >= 0 ? (argv[at + 1] ?? '').split(',') : null;
const force = argv.includes('--force');
const dry = argv.includes('--dry');

const unknown = (only ?? []).filter((id) => !SETS.some((s) => s.takes.some((t) => t.id === id)));
if (unknown.length) {
  console.error(`No such line: ${unknown.join(', ')}. Name a trailer line (${NARRATION.map((l) => l.id).join(', ')}) or a recording in assets/voice/game.`);
  process.exit(1);
}

const venv = (name: string) => join(homedir(), name, ...(process.platform === 'win32' ? ['Scripts', 'python.exe'] : ['bin', 'python']));

/** Each engine's Python, and the file that says how to set it up. */
const PYTHON: Record<Engine, { path: string; setup: string; override: string }> = {
  'pocket-tts': { path: process.env.VOICE_PYTHON ?? venv('.argonauts-voice'), setup: 'requirements.txt', override: 'VOICE_PYTHON' },
  chatterbox: { path: process.env.CHATTERBOX_PYTHON ?? venv('.argonauts-chatterbox'), setup: 'requirements-chatterbox.txt', override: 'CHATTERBOX_PYTHON' },
};

/**
 * Speaks `takes` with `engine`, and returns how long each recording it made is, and whether it made them
 * all. (The engine reports each take as it finishes, so a run that stops halfway keeps what it made.)
 */
function speak(engine: Engine, takes: Take[], file: (id: string) => string): { seconds: Record<string, number>; done: boolean } {
  const python = PYTHON[engine];
  if (!existsSync(python.path)) {
    console.error(`Recording with ${engine} needs its Python, and there is none at ${python.path}.`);
    console.error(`Set it up as game/tools/voice/${python.setup} says, or point ${python.override} at one that has it.`);
    return { seconds: {}, done: false };
  }
  const scratch = mkdtempSync(join(tmpdir(), 'voice-'));
  const report = join(scratch, 'report.json');
  try {
    const job = { engine, report, lines: takes.map((t) => ({ id: t.id, text: t.say, voice: t.voice, fx: t.fx, file: file(t.id) })) };
    const run = spawnSync(python.path, [join(ROOT, 'game/tools/voice/speak.py')], {
      input: JSON.stringify(job),
      stdio: ['pipe', 'inherit', 'inherit'],
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });
    const seconds = existsSync(report) ? (JSON.parse(readFileSync(report, 'utf8')) as Record<string, number>) : {};
    const done = run.status === 0 && takes.every((t) => t.id in seconds);
    if (!done) console.error(`${engine} stopped after ${Object.keys(seconds).length} of ${takes.length} lines; those are kept, and the next run records the rest.`);
    return { seconds, done };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

/** What a run would record, by speaker, and roughly how long it would all be. */
function plan(set: LineSet, due: Take[]) {
  const by = new Map<string, { n: number; words: number }>();
  for (const t of due) {
    const b = by.get(t.who ?? 'narrator') ?? { n: 0, words: 0 };
    b.n++;
    b.words += t.say.split(/\s+/).length;
    by.set(t.who ?? 'narrator', b);
  }
  const words = [...by.values()].reduce((s, b) => s + b.words, 0);
  console.log(`${set.name}: would record ${due.length} of ${set.takes.length} lines, ${words} words (about ${Math.round(words / 150)} minutes of speech)`);
  for (const [who, b] of [...by].sort((a, b) => b[1].n - a[1].n)) console.log(`  ${who.padEnd(10)} ${String(b.n).padStart(4)} lines`);
}

function record(set: LineSet) {
  const dir = join(ROOT, set.dir);
  const list = join(dir, 'lines.json');
  mkdirSync(dir, { recursive: true });
  const before: Made = existsSync(list) ? JSON.parse(readFileSync(list, 'utf8')) : { lines: {} };
  const file = (id: string) => join(dir, `${id}.${set.ext}`);
  const current = (t: Take) => {
    const m = before.lines[t.id];
    return !!m && m.engine === t.engine && m.voice === t.voice && (m.fx ?? '') === (t.fx ?? '') && m.say === t.say && existsSync(file(t.id));
  };
  const due = set.takes.filter((t) => force || only?.includes(t.id) || !current(t));
  if (dry) return plan(set, due);

  // Recordings of lines that are gone.
  const keep = new Set(set.takes.map((t) => `${t.id}.${set.ext}`));
  for (const f of readdirSync(dir)) {
    if (f.endsWith(`.${set.ext}`) && !keep.has(f)) {
      rmSync(join(dir, f));
      console.log(`  removed ${set.dir}/${f}: its line is gone`);
    }
  }

  const seconds: Record<string, number> = Object.fromEntries(set.takes.filter((t) => !due.includes(t)).map((t) => [t.id, before.lines[t.id].seconds]));
  let done = true;
  if (due.length) {
    console.log(`${set.name}: recording ${due.length} of ${set.takes.length} lines…`);
    for (const engine of new Set(due.map((t) => t.engine))) {
      const got = speak(engine, due.filter((t) => t.engine === engine), file);
      Object.assign(seconds, got.seconds);
      done &&= got.done;
    }
  } else {
    console.log(`${set.name}: all ${set.takes.length} lines are recorded.`);
  }

  // In the script's order, so the file reads like it. A line still waiting for its take is left out, so
  // the game stays quiet for it and the next run records it.
  const ready = set.takes.filter((t) => t.id in seconds);
  const made: Made = { lines: Object.fromEntries(ready.map(({ id, ...t }) => [id, { ...t, seconds: seconds[id] }])) };
  writeFileSync(list, `${JSON.stringify(made, null, 2)}\n`);
  if (set.index) writeFileSync(join(dir, 'index.json'), `${JSON.stringify(seconds, Object.keys(made.lines), 2)}\n`);
  if (!done) process.exit(1);
}

for (const set of SETS) record(set);
if (!dry) console.log('Listen to any new takes; `--only <name>` asks for another.');
