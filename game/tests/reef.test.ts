import * as THREE from 'three';

import { CELL, PLAYER } from '../src/core/constants';
import { makeEnemy } from '../src/entities/enemies';
import type { Entity } from '../src/entities/entity';
import { CHARYBDIS, whirlPhase } from '../src/entities/reef/charybdis';
import { CRAB_TUNING } from '../src/entities/reef/crab';
import { JELLY_TUNING } from '../src/entities/reef/jelly';
import { Scylla } from '../src/entities/reef/scylla';
import { BOSS_CARD, FLYOVER, INTEL, TRANSITIONS } from '../src/game/story';
import type { World } from '../src/game/world';
import { CHAPTER_DECKS, CHAPTER_PLAN, LEVELS, isFinale } from '../src/levels';
import { PANEL_IDS, panelSvg } from '../src/ui/panels';
import { Grid, parseLevel } from '../src/world/grid';
import type { LevelDef, ParsedLevel } from '../src/world/levelTypes';
import { makeBody } from '../src/world/physics';
import { FLOOD, RAFT_TOP, TIDE_WARN, isTidal, tideLevel, tidePeriod, tidePhase } from '../src/world/tides';
import { isCollectible, reach } from '../tools/reach';

/** A stand-in for the browser canvas: every 2D call does nothing and returns something callable. */
const anything = (): unknown =>
  new Proxy(() => undefined, {
    get: (_t, k) => (k === Symbol.toPrimitive ? () => 0 : anything()),
    apply: () => anything(),
    set: () => true,
  });
const ctx = new Proxy({}, { get: () => () => anything(), set: () => true });
beforeAll(() => {
  (globalThis as { document?: unknown }).document = {
    createElement: () => ({ width: 0, height: 0, getContext: () => ctx, toDataURL: () => 'data:' }),
  };
});

const def = LEVELS.reef;
const level = parseLevel(def);
const tide = def.tide!;
const ALL = ['doubleJump', 'dash', 'glide', 'pulse', 'grapple'] as const;
const one = (type: string, id?: string) => level.entities.find((e) => e.spec.type === type && (!id || ('id' in e.spec && e.spec.id === id)))!;
const without = (pred: (e: ParsedLevel['entities'][number]) => boolean): ParsedLevel => ({ ...level, entities: level.entities.filter((e) => !pred(e)) });

describe('Scylla’s Reef', () => {
  it('comes after Aeëtes’s Mine in chapter 3, with its story beats', () => {
    expect(CHAPTER_DECKS[3]).toContain('reef');
    expect(CHAPTER_DECKS[3].indexOf('reef')).toBeGreaterThan(CHAPTER_DECKS[3].indexOf('mine'));
    expect(CHAPTER_PLAN[3]).toContain(def.name);
    expect(isFinale('reef')).toBe(false);
    expect(def.heroes).toEqual(['jason', 'atalanta']);
    expect(FLYOVER.reef).toContain('Scylla');
    // It ends sailing on toward Talos's bronze island.
    expect(TRANSITIONS.reef.some((l) => l.text.includes('bronze'))).toBe(true);
    expect(BOSS_CARD.scylla.sub).toBeTruthy();
    for (const k of ['crab', 'jelly'] as const) expect(INTEL[k].tip).toBeTruthy();
    for (const key of ['intro', 'tides', 'lighthouse', 'lit', 'log', 'boss', 'bossDown', 'colonist:c1', 'colonist:c2', 'colonist:c3']) expect(def.dialogues[key]?.length).toBeGreaterThan(0);
    expect(def.stories?.rock?.[0].panel).toBe('ch3-scylla');
    expect(def.stories?.strait?.[0].panel).toBe('ch3-strait');
  });

  it('draws its two storybook panels', () => {
    for (const id of ['ch3-scylla', 'ch3-strait'] as const) {
      expect(PANEL_IDS).toContain(id);
      expect(panelSvg(id).length).toBeGreaterThan(3000);
    }
  });

  it('has the whirlpool in the arena, three checkpoints, a shop and 25-40 enemies', () => {
    const c = one('marker', 'charybdis');
    expect(level.cells[c.cz * level.width + c.cx].kind).toBe('void');
    const boss = one('boss');
    expect(Math.hypot(c.cx - boss.cx, c.cz - boss.cz) * CELL).toBeLessThan(16);
    expect(level.entities.filter((e) => e.spec.type === 'checkpoint')).toHaveLength(3);
    expect(level.entities.filter((e) => e.spec.type === 'vendor')).toHaveLength(1);
    const enemies = level.entities.filter((e) => e.spec.type === 'enemy');
    expect(enemies.length).toBeGreaterThanOrEqual(25);
    expect(enemies.length).toBeLessThanOrEqual(40);
    for (const kind of ['crab', 'jelly']) expect(enemies.some((e) => e.spec.type === 'enemy' && e.spec.enemy === kind)).toBe(true);
  });
});

describe('the tide', () => {
  it('runs low, rising, high, falling, about every half minute', () => {
    expect(tidePeriod(tide)).toBeGreaterThanOrEqual(28);
    expect(tidePeriod(tide)).toBeLessThanOrEqual(40);
    expect(tidePhase(tide, 1).phase).toBe('low');
    expect(tideLevel(tide, 1)).toBe(tide.low);
    expect(tidePhase(tide, tide.phases[0] + 1).phase).toBe('rising');
    expect(tideLevel(tide, tide.phases[0] + tide.phases[1] + 1)).toBe(tide.high);
    expect(tidePhase(tide, tidePeriod(tide) - 1).phase).toBe('falling');
    // It wraps around, and it rises smoothly.
    expect(tideLevel(tide, 1 + tidePeriod(tide))).toBe(tide.low);
    let last = -Infinity;
    for (let t = tide.phases[0]; t <= tide.phases[0] + tide.phases[1]; t += 0.25) {
      const lv = tideLevel(tide, t);
      expect(lv).toBeGreaterThanOrEqual(last);
      last = lv;
    }
  });

  it('floods the sandy flats and leaves the coral, the plaza and the arena dry', () => {
    const at = (e: { cx: number; cz: number }) => level.cells[e.cz * level.width + e.cx];
    expect(isTidal(tide, 0)).toBe(true);
    expect(tide.high - 0).toBeGreaterThan(FLOOD);
    for (const id of ['cp1', 'cp2', 'cp3']) expect(isTidal(tide, at(one('checkpoint', id)).h)).toBe(false);
    expect(isTidal(tide, level.spawn.h)).toBe(false);
    expect(isTidal(tide, one('boss').h)).toBe(false);
    expect(isTidal(tide, one('vendor').h)).toBe(false);
    // At low tide even the lowest flats are above the sea.
    expect(tide.low).toBeLessThan(-0.3);
  });

  it('always leaves time to reach dry ground after the gauge starts blinking', () => {
    // From the warning to the moment the sea is too deep over a flat.
    const [, rise] = tide.phases;
    let t = 0;
    while (tideLevel(tide, tide.phases[0] + t) <= 0 + FLOOD && t < rise) t += 0.05;
    const window = TIDE_WARN + t;
    // Walking distance (4-way, through walkable cells) from every flat to the nearest dry floor.
    const W = level.width;
    const walk = (i: number) => ['floor', 'grate', 'ice'].includes(level.cells[i]?.kind);
    const dist = new Map<number, number>();
    const queue: number[] = [];
    level.cells.forEach((c, i) => {
      if (walk(i) && !isTidal(tide, c.h)) {
        dist.set(i, 0);
        queue.push(i);
      }
    });
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q];
      for (const j of [i - 1, i + 1, i - W, i + W]) {
        if (dist.has(j) || !walk(j)) continue;
        dist.set(j, dist.get(i)! + 1);
        queue.push(j);
      }
    }
    let worst = 0;
    level.cells.forEach((c, i) => {
      if (walk(i) && isTidal(tide, c.h)) worst = Math.max(worst, dist.get(i) ?? Infinity);
    });
    expect(worst).toBeLessThan(Infinity);
    // Even walking (not running or dashing), with a margin to spare.
    expect((worst * CELL) / PLAYER.speed).toBeLessThanOrEqual(window * 0.8);
  });
});

describe('heroes and rafts on the reef', () => {
  it('needs both heroes: a bullseye only Atalanta hits, a switch only Jason reaches', () => {
    const jason = reach(level, [...ALL], ['jason']).missing.filter((e) => !isCollectible(e.spec)).map((e) => e.spec.type);
    const atalanta = reach(level, [...ALL], ['atalanta']).missing.filter((e) => !isCollectible(e.spec)).map((e) => e.spec.type);
    expect(jason).toContain('target');
    expect(atalanta).toContain('switch');
    expect(reach(level, [...ALL]).missing).toEqual([]);
  });

  it('hides a light-stone for the raft, one for Atalanta’s wall-jump and one for Jason’s grapple', () => {
    const missing = (l: ParsedLevel, heroes?: ('jason' | 'atalanta')[]) => reach(l, [...ALL], heroes).missing.map((e) => e.id);
    expect(missing(without((e) => e.spec.type === 'raft'))).toContain('reef.s1');
    expect(missing(level, ['jason'])).toContain('reef.s2');
    expect(missing(level, ['atalanta'])).not.toContain('reef.s2');
    expect(missing(level, ['atalanta'])).toContain('reef.s3');
    expect(missing(level, ['jason'])).not.toContain('reef.s3');
    // The heart canister is behind a crawl hole.
    expect(missing(level, ['jason'])).toContain('reef.hc');
  });

  it('floats rafts from the sand up to the high tide', () => {
    expect(RAFT_TOP).toBeGreaterThan(0);
    expect(tide.high + 0.2 - RAFT_TOP).toBeGreaterThanOrEqual(1.5);
  });
});

/* ---------------- The reef robots and SCYLLA, in a small stand-in world ---------------- */

function grid(): Grid {
  const rows = ['#'.repeat(25), ...Array.from({ length: 23 }, (_, i) => (i === 0 ? '#@' + '.'.repeat(22) + '#' : '#' + '.'.repeat(23) + '#')), '#'.repeat(25)];
  const d: LevelDef = { id: 'reef', index: 16, name: 'test', subtitle: '', music: 'reef', map: `\n${rows.join('\n')}\n`, legend: {}, objectives: [], shardIds: [], dialogues: {} };
  const p = parseLevel(d);
  return new Grid(p.width, p.depth, p.cells);
}

const at = (c: number) => c * CELL + CELL / 2;

function fakeWorld(px: number, pz: number) {
  const added: Entity[] = [];
  const targets: unknown[] = [];
  const w = {
    scene: new THREE.Scene(),
    grid: grid(),
    boxes: [] as unknown[],
    cutscene: false,
    time: 0,
    tide: null,
    theme: { accent: '#3fe0d0' },
    difficulty: { tier: 4, hp: 1.8, speed: 1.2, rate: 1.3, aggro: 15 },
    player: { body: makeBody(at(px), 0, at(pz), 0.42, 1.7), hero: 'jason', hearts: 5, pounding: false, dashing: false, spinning: false, zipping: false, down: false, invuln: 0, hurt: jest.fn() },
    shots: { fire: jest.fn(() => true) },
    particles: { emit: () => undefined },
    rings: { burst: () => undefined },
    hooks: { toast: jest.fn(), bossBar: jest.fn() },
    soundAt: () => undefined,
    shake: () => undefined,
    hitStop: () => undefined,
    flash: () => undefined,
    marker: () => null,
    meetEnemy: () => undefined,
    dropBolts: () => undefined,
    dropHeart: () => undefined,
    dropEnergy: () => undefined,
    enemyDied: () => undefined,
    forget: () => undefined,
    addTarget: (t: unknown) => targets.push(t),
    removeTarget: () => undefined,
    bossStarted: jest.fn(),
    bossDefeated: jest.fn(),
    addEntity: (e: Entity) => (added.push(e), e),
    added,
  };
  return w;
}

function step(w: ReturnType<typeof fakeWorld>, e: Entity, seconds: number, until?: () => boolean) {
  for (let t = 0; t < seconds; t += 1 / 60) {
    w.time += 1 / 60;
    if (e.alive) e.update(1 / 60);
    for (const x of [...w.added]) if (x.alive) x.update(1 / 60);
    if (until?.()) return true;
  }
  return false;
}

describe('reef robots', () => {
  it('a crab-drone guards its front with its claws, then snaps', () => {
    const w = fakeWorld(10, 14);
    const e = makeEnemy(w as unknown as World, 'crab', 'crab', 10, 10, 0);
    expect(e.kind).toBe('crab');
    // Let it wake up and turn to face Jason (south of it), but stop before it snaps.
    step(w, e, 0.6);
    const hp = e.hp;
    const front = new THREE.Vector3(e.body.x, 0, e.body.z + 4);
    const back = new THREE.Vector3(e.body.x, 0, e.body.z - 4);
    e.hit(1, 'shot', front);
    expect(e.hp).toBe(hp);
    e.hit(1, 'shot', back);
    expect(e.hp).toBe(hp - 1);
    // Standing next to it, Jason gets snapped at (after the warning).
    w.player.body.x = e.body.x;
    w.player.body.z = e.body.z + 2;
    step(w, e, CRAB_TUNING.rest + CRAB_TUNING.warn + 2, () => w.player.hurt.mock.calls.length > 0);
    expect(w.player.hurt).toHaveBeenCalled();
  });

  it('a jellyfish-drone zaps a ring around itself, and only close by', () => {
    const near = fakeWorld(10, 11);
    const a = makeEnemy(near as unknown as World, 'jelly-a', 'jelly', 10, 10, 0);
    expect(a.kind).toBe('jelly');
    step(near, a, JELLY_TUNING.every * 2, () => near.player.hurt.mock.calls.length > 0);
    expect(near.player.hurt).toHaveBeenCalled();
    const far = fakeWorld(10, 18);
    const b = makeEnemy(far as unknown as World, 'jelly-b', 'jelly', 10, 10, 0);
    // Pinned in place: drifting toward Jason is its job, zapping from afar is not.
    for (let i = 0; i < 4; i++) {
      step(far, b, JELLY_TUNING.every);
      b.body.x = at(10);
      b.body.z = at(10);
    }
    expect(far.player.hurt).not.toHaveBeenCalled();
  });
});

describe('Charybdis', () => {
  it('pulls on a rhythm, gently enough to walk away from', () => {
    expect(whirlPhase(1)).toBe('calm');
    expect(whirlPhase(CHARYBDIS.calm + 0.1)).toBe('warn');
    expect(whirlPhase(CHARYBDIS.calm + CHARYBDIS.warn + 0.1)).toBe('pull');
    expect(CHARYBDIS.pull).toBeLessThan(PLAYER.speed * 0.75);
    expect(CHARYBDIS.warn).toBeGreaterThanOrEqual(1.2);
    expect(CHARYBDIS.period - CHARYBDIS.calm - CHARYBDIS.warn).toBeLessThan(CHARYBDIS.calm);
  });
});

interface ArmView {
  state: string;
  joint: { open: boolean; powerArrow(): boolean; hit(d: number, k: string, f: THREE.Vector3): boolean };
}
interface PlateView {
  open: number;
  crushed: boolean;
  hit(d: number, k: string, f: THREE.Vector3): boolean;
}
const parts = (s: Scylla) => s as unknown as { arms: ArmView[]; plates: PlateView[]; mode: string };

describe('SCYLLA', () => {
  const setup = () => {
    const w = fakeWorld(12, 14);
    const s = new Scylla(w as unknown as World, 'scylla', 12, 3, 0);
    s.engage();
    return { w, s, v: parts(s), from: new THREE.Vector3() };
  };
  /** Waits for an elbow to glow, then hits it with a power arrow. */
  const jamOne = (w: ReturnType<typeof fakeWorld>, s: Scylla) => {
    let arm: ArmView | undefined;
    step(w, s, 12, () => !!(arm = parts(s).arms.find((a) => a.joint.open && a.state !== 'jammed' && a.state !== 'broken')));
    expect(arm).toBeDefined();
    arm!.joint.powerArrow();
    return arm!;
  };

  it('takes no damage from shots, closed plates or dark elbows', () => {
    const { w, s, v, from } = setup();
    s.hit(10, 'shot');
    for (const p of v.plates) p.hit(10, 'pound', from);
    const dark = v.arms.find((a) => !a.joint.open)!;
    dark.joint.powerArrow();
    expect(dark.state).not.toBe('jammed');
    expect(s.hp).toBe(s.maxHp);
    // Plain shots bounce off a glowing elbow too.
    step(w, s, 12, () => v.arms.some((a) => a.joint.open));
    const lit = v.arms.find((a) => a.joint.open)!;
    lit.joint.hit(3, 'shot', from);
    expect(lit.state).not.toBe('jammed');
  });

  it('overloads after two jammed arms, and a pounded plate takes a third of her health', () => {
    const { w, s, v, from } = setup();
    expect(jamOne(w, s).state).toBe('jammed');
    expect(v.mode).toBe('fight');
    jamOne(w, s);
    expect(v.mode).toBe('overload');
    step(w, s, 0.6);
    expect(v.plates[1].open).toBeGreaterThan(0.5);
    v.plates[1].hit(2, 'pound', from);
    expect(s.hp).toBeCloseTo((s.maxHp * 2) / 3);
    expect(v.arms.filter((a) => a.state === 'broken')).toHaveLength(2);
    // A crushed plate can't be pounded again.
    v.plates[1].hit(2, 'pound', from);
    expect(s.hp).toBeCloseTo((s.maxHp * 2) / 3);
  });

  it('shakes it off if nobody pounds a plate in time', () => {
    const { w, s, v } = setup();
    jamOne(w, s);
    jamOne(w, s);
    step(w, s, 10);
    expect(v.mode).toBe('fight');
    expect(v.arms.some((a) => a.state === 'jammed')).toBe(false);
    expect(s.hp).toBe(s.maxHp);
  });

  it('is beaten after three rounds, with all six arms broken', () => {
    const { w, s, v, from } = setup();
    for (let round = 0; round < 3; round++) {
      jamOne(w, s);
      jamOne(w, s);
      step(w, s, 0.6);
      const plate = v.plates.find((p) => !p.crushed)!;
      plate.hit(2, 'pound', from);
      step(w, s, 2);
    }
    expect(s.defeated).toBe(true);
    expect(w.bossDefeated).toHaveBeenCalled();
    expect(v.arms.every((a) => a.state === 'broken')).toBe(true);
  });
});
