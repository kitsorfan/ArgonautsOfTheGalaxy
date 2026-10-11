import * as THREE from 'three';

import { newSave } from '../src/core/save';
import { deckQuests, payQuests } from '../src/game/quests';
import { FLYOVER, TRANSITIONS } from '../src/game/story';
import {
  CHAPTERS,
  CHAPTER_DECKS,
  CHAPTER_PLAN,
  LEVELS,
  LEVEL_ORDER,
  catchUpChapters,
  chapterIndex,
  chapterOf,
  chapterSize,
  comingSoon,
  isFinale,
  isVehicleLevel,
  nextChapterStart,
} from '../src/levels';
import { CLASH, FLIGHT, ROW_GAP, clashRows, clashState, goNow, inCorridor, laneAt, type Clash, type FlightCourse } from '../src/vehicles/course';
import { makeArgo } from '../src/vehicles/argoModel';
import { Flight, type FlightEvents } from '../src/vehicles/flight';
import { flightGoals, flightTotals, recordFlight } from '../src/vehicles/quests';
import { parseLevel } from '../src/world/grid';
import type { DeckId } from '../src/world/levelTypes';

// three is ESM-only, which Jest's module loader can't read; Node's own require can, so load it with that.
jest.mock('three', () => process.getBuiltinModule('node:module').createRequire(__filename)('three'));

// newSave() reads navigator for its quality default; give Jest a stand-in.
beforeAll(() => {
  (globalThis as { navigator?: unknown }).navigator ??= { hardwareConcurrency: 8 };
});

// The Argo's flights (the submarine's dive has its own tests in sirens.test.ts).
const FLIGHTS = LEVEL_ORDER.filter((id) => isVehicleLevel(id) && LEVELS[id].vehicle === 'argo');

describe('three chapters', () => {
  it('splits the levels into the ship, Gaia Nova and the Argonauts', () => {
    expect(CHAPTERS).toEqual([1, 2, 3]);
    expect(chapterOf('cryo')).toBe(1);
    expect(chapterOf('volcano')).toBe(2);
    expect(chapterOf('rocks')).toBe(3);
    expect(chapterIndex('rocks')).toBe(1);
    expect(chapterSize(3)).toBe(10);
    expect(CHAPTER_PLAN[3][0]).toBe(LEVELS.rocks.name);
    expect(comingSoon(3)).toHaveLength(10 - CHAPTER_DECKS[3].length);
  });

  it('leads each chapter on to the next, and keeps chapter 3’s finale for its last level', () => {
    expect(nextChapterStart('bridge')).toBe('plains');
    expect(nextChapterStart('volcano')).toBe('rocks');
    expect(nextChapterStart('rocks')).toBeNull();
    expect(isFinale('bridge')).toBe(true);
    expect(isFinale('volcano')).toBe(true);
    // The Clashing Rocks is level 1 of 10: it ends with the Argo sailing on, not a finale.
    expect(isFinale('rocks')).toBe(false);
    expect(TRANSITIONS.rocks.length).toBeGreaterThan(0);
    expect(FLYOVER.rocks).not.toBe('');
  });

  it('opens chapter 3 for an old save that already saw chapter 2’s ending', () => {
    const old = newSave();
    old.unlocked = 12;
    old.endings = ['saved', 'freed'];
    old.completed = [...CHAPTER_DECKS[1], ...CHAPTER_DECKS[2]];
    old.resume = null;
    expect(catchUpChapters(old)).toBe(true);
    expect(old.unlocked).toBe(LEVELS.rocks.index);
    expect((old.resume as { deck: string } | null)?.deck).toBe('rocks');
    // Nothing more to do the second time, and a save mid-way through chapter 2 is left alone.
    expect(catchUpChapters(old)).toBe(false);
    const mid = newSave();
    mid.unlocked = 9;
    mid.endings = ['saved'];
    mid.resume = { deck: 'snow', checkpoint: 'cp1', flags: [], taken: [], dead: [] };
    expect(catchUpChapters(mid)).toBe(false);
    expect(mid.resume?.deck).toBe('snow');
  });

  it('keeps a save from before chapter 2 working (it opens Gaia Nova)', () => {
    const old = newSave();
    old.unlocked = 6;
    old.endings = ['friends'];
    catchUpChapters(old);
    expect(old.unlocked).toBe(LEVELS.plains.index);
    expect((old.resume as { deck: string } | null)?.deck).toBe('plains');
  });
});

describe('flight levels', () => {
  it('declare a vehicle and a course, and still parse as a level', () => {
    expect(FLIGHTS).toContain('rocks');
    for (const id of FLIGHTS) {
      const def = LEVELS[id];
      expect(def.vehicle).toBe('argo');
      expect(def.flight?.things.length).toBeGreaterThan(100);
      const level = parseLevel(def);
      expect(level.spawn).toBeTruthy();
      expect(def.dialogues[def.intro ?? 'intro']?.length).toBeGreaterThan(0);
    }
  });

  it('have every dialogue their course and cutscenes use', () => {
    for (const id of FLIGHTS) {
      const def = LEVELS[id];
      const keys = new Set(['intro', 'finish']);
      for (const t of def.flight?.things ?? []) {
        if (t.kind === 'radio') keys.add(t.dialogue);
        if (t.kind === 'dove') keys.add('dove').add('doveSafe');
      }
      for (const k of keys) expect([k, (def.dialogues[k]?.length ?? 0) > 0]).toEqual([k, true]);
    }
  });

  it('have their own side quests: rings, drones and the dove', () => {
    const save = newSave();
    const qs = deckQuests('rocks', save);
    expect(qs.map((q) => q.id.split(':')[1])).toEqual(['rings', 'drones', 'dove']);
    expect(qs.every((q) => !q.done)).toBe(true);
    const goal = flightGoals(LEVELS.rocks);
    expect(goal.rings).toBeGreaterThan(20);
    expect(goal.drones).toBeLessThanOrEqual(flightTotals(LEVELS.rocks).drones);
    recordFlight(save, 'rocks', { rings: goal.rings, drones: 3 });
    expect(payQuests('rocks', save)).toHaveLength(1);
    expect(save.bolts).toBe(60);
    expect(payQuests('rocks', save)).toHaveLength(0);
    // Best results only ever go up.
    expect(recordFlight(save, 'rocks', { rings: 1, drones: 1 })).toBe(false);
    recordFlight(save, 'rocks', { clean: true });
    expect(payQuests('rocks', save)).toHaveLength(1);
  });
});

describe.each(FLIGHTS)('%s course', (id: DeckId) => {
  const course = LEVELS[id].flight as FlightCourse;
  const things = [...course.things].sort((a, b) => a.s - b.s);
  const end = things.find((t) => t.kind === 'gate')?.s ?? 0;

  it('ends at the gate, with checkpoints along the way and everything inside the corridor', () => {
    expect(things.filter((t) => t.kind === 'gate')).toHaveLength(1);
    expect(things[things.length - 1].kind).toBe('gate');
    const beacons = things.filter((t) => t.kind === 'checkpoint');
    expect(beacons.length).toBeGreaterThanOrEqual(2);
    for (const t of things) {
      if (t.kind === 'ring' || t.kind === 'bolt' || t.kind === 'crystal') expect([t.kind, t.s, inCorridor(t.x, t.y, 1)]).toEqual([t.kind, t.s, true]);
    }
    for (const [s, x, y] of course.guide) expect([s, inCorridor(x, y, 1)]).toEqual([s, true]);
  });

  it('takes about three to five minutes at cruising speed', () => {
    const minutes = end / FLIGHT.cruise / 60;
    expect(minutes).toBeGreaterThan(2.4);
    expect(minutes).toBeLessThan(4.5);
  });

  it('keeps the guide route steerable and clear of every asteroid', () => {
    for (let s = 0; s < end; s += 1) {
      const [x0, y0] = laneAt(course.guide, s);
      const [x1, y1] = laneAt(course.guide, s + 1);
      // Never steeper than the Argo can steer at cruising speed (with room to spare).
      expect(Math.hypot(x1 - x0, y1 - y0) * FLIGHT.cruise).toBeLessThan(FLIGHT.steer * 0.7);
    }
    for (const t of things) {
      if (t.kind !== 'rock' && t.kind !== 'crystal') continue;
      const r = t.kind === 'rock' ? t.r : 1.3;
      const [gx, gy] = laneAt(course.guide, t.s);
      expect([t.kind, t.s, Math.hypot(t.x - gx, t.y - gy) > r + FLIGHT.radius + 0.5]).toEqual([t.kind, t.s, true]);
    }
  });

  it('never hides a crystal inside an asteroid', () => {
    const rocks = things.filter((t) => t.kind === 'rock');
    for (const c of things) {
      if (c.kind !== 'crystal') continue;
      const inside = rocks.filter((r) => r.kind === 'rock' && Math.hypot(r.x - c.x, r.y - c.y, r.s - c.s) < r.r + 1.6);
      expect([c.s, inside.length]).toEqual([c.s, 0]);
    }
  });

  it('puts a clear run-up before every row of Clashing Rocks, with nothing in the way', () => {
    const clashes = things.filter((t): t is Clash => t.kind === 'clash');
    expect(clashes.length).toBeGreaterThanOrEqual(5);
    for (const c of clashes) {
      // The pair sits in the middle of the guide route, and no asteroid floats inside its rocks.
      const [gx, gy] = laneAt(course.guide, c.s);
      expect(Math.hypot(gx, gy)).toBeLessThan(0.5);
      const near = things.filter((t) => (t.kind === 'rock' || t.kind === 'ring' || t.kind === 'crystal') && Math.abs(t.s - c.s) < CLASH.depth);
      expect(near).toEqual([]);
    }
    // Room to ease off and wait in front of each row, and no checkpoint in the middle of one.
    const rows = clashRows(things);
    for (let i = 1; i < rows.length; i++) expect(rows[i][0].s - rows[i - 1][rows[i - 1].length - 1].s).toBeGreaterThanOrEqual(ROW_GAP);
    for (const row of rows) {
      const inside = things.filter((t) => t.kind === 'checkpoint' && t.s > row[0].s - CLASH.depth && t.s < row[row.length - 1].s + CLASH.depth);
      expect(inside).toEqual([]);
    }
  });

  it('can be flown start to finish by following the guide and waiting for each row of rocks to open, without a scratch', () => {
    const f = new Flight(course);
    const rows = clashRows(things);
    const hits = { bump: 0, crush: 0, rings: 0 };
    const ev: FlightEvents = {
      bump: () => (hits.bump += 1),
      crush: () => (hits.crush += 1),
      ring: () => (hits.rings += 1),
    };
    const dt = 1 / 60;
    let time = 0;
    let waited = 0;
    while (!f.finished && time < 600) {
      // Steer toward the guide a little way ahead.
      const [gx, gy] = laneAt(course.guide, f.s + 4);
      const steerX = Math.max(-1, Math.min(1, (gx - f.x) * 2));
      const steerY = Math.max(-1, Math.min(1, (gy - f.y) * 2));
      // Coming up to a row of rocks: ease right off, and push the lever all the way up once that gets through.
      const row = rows.find((r) => r[r.length - 1].s + CLASH.depth / 2 > f.s);
      let lever: number = FLIGHT.lever;
      if (row && f.s > row[0].s - 60) lever = goNow(row, f.s, f.v, f.t) ? 1 : 0;
      if (lever === 0) waited += dt;
      f.step(dt, { steerX, steerY, lever }, ev);
      time += dt;
    }
    expect(f.finished).toBe(true);
    expect(hits).toEqual({ bump: 0, crush: 0, rings: things.filter((t) => t.kind === 'ring').length });
    expect(f.hull).toBe(FLIGHT.hull);
    expect(waited).toBeGreaterThan(0);
    // Three to five minutes of flying, waits at the rocks included.
    expect(time / 60).toBeGreaterThan(2.5);
    expect(time / 60).toBeLessThan(5);
  });

  it('squishes the Argo if it goes while the rocks rumble, and spits it back out with the engines stopped', () => {
    const first = clashRows(things)[0][0];
    const f = new Flight(course);
    f.restart(first.s - 40);
    const dt = 1 / 60;
    let crushes = 0;
    // Hover in front of the pair until the rocks start to rumble, then go: too late.
    let go = false;
    for (let i = 0; i < 60 * 30 && !crushes; i++) {
      if (clashState(first, f.t).warn > 0.15) go = true;
      f.step(dt, { steerX: 0, steerY: 0, lever: go ? 1 : 0 }, { crush: () => (crushes += 1) });
    }
    expect(crushes).toBe(1);
    expect(f.s).toBe(first.s - CLASH.depth / 2 - FLIGHT.spit);
    expect([f.v, f.lever]).toEqual([0, 0]);
    expect(f.hull).toBe(FLIGHT.hull - 1);
  });

  it('gives a fair window to go at every row: over a second, from a standstill in front of it', () => {
    for (const row of clashRows(things)) {
      const P = row[0].period;
      let safe = 0;
      let agree = 0;
      const samples = 100;
      for (let k = 0; k < samples; k++) {
        const f = new Flight(course);
        f.restart(row[0].s - 30);
        f.v = 0;
        // Wait for this moment in the rhythm, then full speed through the whole row.
        const want = (k / samples) * P;
        const u = clashState(row[0], f.t).phase;
        f.t += (((want - u) % P) + P) % P;
        const called = goNow(row, f.s, f.v, f.t);
        let crushed = false;
        for (let i = 0; i < 60 * 6 && !crushed && f.s < row[row.length - 1].s + CLASH.depth; i++) f.step(1 / 60, { steerX: 0, steerY: 0, lever: 1 }, { crush: () => (crushed = true) });
        if (!crushed) safe += P / samples;
        // The "FULL SPEED NOW!" call-out agrees with what really happens (give or take a frame at the edges).
        if (called === !crushed) agree += 1;
      }
      expect([row[0].s, safe > 1.2, agree >= samples - 4]).toEqual([row[0].s, true, true]);
    }
  });
});

describe('The Clashing Rocks', () => {
  const course = LEVELS.rocks.flight as FlightCourse;
  const things = [...course.things].sort((a, b) => a.s - b.s);
  const rows = clashRows(things);

  /** Flies up to just in front of a row of rocks and stops there. */
  function arriveAt(row: Clash[]): Flight {
    const f = new Flight(course);
    f.restart(row[0].s - 60);
    for (let i = 0; i < 60 * 10 && f.s < row[0].s - 30; i++) f.step(1 / 60, { steerX: 0, steerY: 0 });
    for (let i = 0; i < 60 && f.v > 0; i++) f.step(1 / 60, { steerX: 0, steerY: 0, lever: 0 });
    return f;
  }

  it('has twenty pairs of rocks, in four checkpointed stretches', () => {
    expect(things.filter((t) => t.kind === 'clash')).toHaveLength(20);
    expect(things.filter((t) => t.kind === 'checkpoint')).toHaveLength(4);
  });

  it('sends the dove once, toward the first pair, after the second checkpoint', () => {
    const doves = things.filter((t) => t.kind === 'dove');
    expect(doves).toHaveLength(1);
    const cp2 = things.find((t) => t.kind === 'checkpoint' && t.id === 'cp2');
    expect(doves[0].s).toBeGreaterThan(cp2?.s ?? 0);
    // Far enough out for the dove to get there first and show the timing.
    expect(rows[0][0].s - doves[0].s).toBeGreaterThan(200);
  });

  it('never stops by itself: the lever sets the speed, from a standstill to full speed', () => {
    const f = new Flight(course);
    f.restart(100);
    for (let i = 0; i < 60; i++) f.step(1 / 60, { steerX: 0, steerY: 0, lever: 0 });
    const s0 = f.s;
    for (let i = 0; i < 60; i++) f.step(1 / 60, { steerX: 0, steerY: 0 });
    expect([f.v, f.s]).toEqual([0, s0]);
    // A held key pushes the lever up bit by bit, and the Argo picks up speed with it.
    for (let i = 0; i < 30; i++) f.step(1 / 60, { steerX: 0, steerY: 0, leverMove: 1 });
    expect(f.lever).toBeCloseTo(FLIGHT.leverRate * 0.5, 2);
    for (let i = 0; i < 60; i++) f.step(1 / 60, { steerX: 0, steerY: 0, lever: 1 });
    expect(f.v).toBe(FLIGHT.top);
    // Left alone, it keeps flying at whatever speed the lever is at.
    const v = f.v;
    for (let i = 0; i < 60 * 5; i++) f.step(1 / 60, { steerX: 0, steerY: 0 });
    expect(f.v).toBe(v);
  });

  it('fires one of three rockets at the nearest pair, which blows it up so the Argo flies straight through', () => {
    const row = rows[1];
    const f = arriveAt(row);
    const target = row[0];
    expect(f.rocketTarget()).toBe(target);
    let blasts = 0;
    let crushes = 0;
    expect(f.fireRocket()).toBe(true);
    expect(f.rockets).toBe(FLIGHT.rockets - 1);
    for (let i = 0; i < 60 * 3; i++) f.step(1 / 60, { steerX: 0, steerY: 0, lever: 1 }, { blast: () => (blasts += 1), crush: () => (crushes += 1) });
    expect(blasts).toBe(1);
    expect(f.broken.has(target)).toBe(true);
    expect(crushes).toBe(0);
    expect(f.s).toBeGreaterThan(target.s);
  });

  it('runs out after three rockets, and gives back the ones fired in a section that is lost', () => {
    const f = arriveAt(rows[rows.length - 1]);
    const empty: string[] = [];
    for (let k = 0; k < 4; k++) f.fireRocket({ noRocket: (why) => empty.push(why) });
    expect(f.rockets).toBe(0);
    expect(empty).toEqual(['empty']);
    const cp4 = things.find((t) => t.kind === 'checkpoint' && t.id === 'cp4');
    f.restart(cp4?.s ?? 0);
    expect(f.rockets).toBe(FLIGHT.rockets);
    expect(f.broken.size).toBe(0);
  });

  it('only locks on to rocks that are close enough', () => {
    const f = new Flight(course);
    const why: string[] = [];
    expect(f.fireRocket({ noRocket: (w) => why.push(w) })).toBe(false);
    expect(why).toEqual(['range']);
    expect(f.rockets).toBe(FLIGHT.rockets);
  });
});

describe('the Argo as you see it', () => {
  // The model paints canvas textures (the sail, the glows): give Jest a stand-in canvas.
  beforeAll(() => {
    const g = globalThis as { document?: unknown };
    g.document ??= { createElement: () => ({ getContext: () => new Proxy({}, { get: (_t, k) => () => (String(k).endsWith('Gradient') ? { addColorStop() {} } : undefined) }) }) };
  });

  /** The box around the ship's visible meshes, in the root's space. */
  function drawnBox(root: THREE.Object3D): THREE.Box3 {
    root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    root.traverseVisible((o) => {
      if ((o as THREE.Mesh).isMesh) box.union(new THREE.Box3().setFromObject(o));
    });
    // Back into the root's own space (it may be scaled).
    return box.applyMatrix4(root.matrixWorld.clone().invert());
  }

  it('is flown by the middle of the whole ship, not by the hull under its tall sail', () => {
    const plain = makeArgo();
    // Cutscenes keep the hull at the root; the sail lifts the middle of the ship well above it.
    expect(plain.centre).toBeGreaterThan(1);
    expect(drawnBox(plain.root).getCenter(new THREE.Vector3()).y).toBeCloseTo(plain.centre, 5);
    const flown = makeArgo(true);
    flown.root.scale.setScalar(0.72);
    const mid = drawnBox(flown.root).getCenter(new THREE.Vector3());
    expect(Math.abs(mid.x)).toBeLessThan(0.01);
    expect(Math.abs(mid.y)).toBeLessThan(0.01);
  });

  it('flies through a ring, and picks up a bolt, when the middle of the drawn ship goes through it', () => {
    const ring = { kind: 'ring', s: 40, x: 2, y: 1.5 } as const;
    const bolt = { kind: 'bolt', s: 60, x: -1, y: -2 } as const;
    const course: FlightCourse = { things: [ring, bolt, { kind: 'gate', s: 200 }], guide: [[0, 0, 0]], belt: 0 };
    const f = new Flight(course);
    const got: string[] = [];
    const ev: FlightEvents = { ring: () => got.push('ring'), bolt: () => got.push('bolt') };
    // The flight draws the centred model at (x, y): put the ship's middle right on each one in turn.
    const model = makeArgo(true);
    model.root.scale.setScalar(0.72);
    for (const at of [ring, bolt]) {
      while (f.s < at.s + 0.5) {
        [f.x, f.y] = [at.x, at.y];
        model.root.position.set(f.x, f.y, 0);
        const mid = drawnBox(model.root).applyMatrix4(model.root.matrixWorld).getCenter(new THREE.Vector3());
        expect(Math.hypot(mid.x - at.x, mid.y - at.y)).toBeLessThan(0.01);
        f.step(1 / 60, { steerX: 0, steerY: 0 }, ev);
      }
    }
    expect(got).toEqual(['ring', 'bolt']);
  });
});
