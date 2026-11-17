import * as THREE from 'three';

import { CELL } from '../src/core/constants';
import { enemyIcon, type BadgeKind } from '../src/entities/badges';
import { makeEnemy, type Enemy } from '../src/entities/enemies';
import type { Entity } from '../src/entities/entity';
import { ROBOT_KINDS, ROBOT_TUNING } from '../src/entities/robots';
import { INTEL } from '../src/game/story';
import type { World } from '../src/game/world';
import { CHAPTER_DECKS, LEVEL_ORDER, LEVELS } from '../src/levels';
import { Grid, parseLevel } from '../src/world/grid';
import type { EnemyKind, LevelDef } from '../src/world/levelTypes';
import { makeBody } from '../src/world/physics';

const ALL_KINDS: EnemyKind[] = ['sporeling', 'snapper', 'buzzer', 'sentry', 'turret', 'brute', ...ROBOT_KINDS];
const CHAPTER2 = ['plains', 'desert', 'snow', 'rockies', 'jungle', 'volcano'] as const;

/** A stand-in for the browser canvas: every 2D call is counted and does nothing. */
let drawCalls = 0;
const anything = (): unknown =>
  new Proxy(() => undefined, {
    get: (_t, k) => (k === Symbol.toPrimitive ? () => 0 : anything()),
    apply: () => anything(),
    set: () => true,
  });
const ctx = new Proxy({}, { get: () => () => ((drawCalls += 1), anything()), set: () => true });
beforeAll(() => {
  (globalThis as { document?: unknown }).document = {
    createElement: () => ({ width: 0, height: 0, getContext: () => ctx, toDataURL: () => 'data:' }),
  };
});

function grid(): Grid {
  const row = (s: string) => s.padEnd(21, s.at(-1));
  const rows = ['#'.repeat(21), row('#@' + '.'.repeat(18) + '#'), ...Array.from({ length: 18 }, () => row('#' + '.'.repeat(19) + '#')), '#'.repeat(21)];
  const def: LevelDef = { id: 'plains', index: 7, name: 'test', subtitle: '', music: 'plains', map: `\n${rows.join('\n')}\n`, legend: {}, objectives: [], shardIds: [], dialogues: {} };
  const p = parseLevel(def);
  return new Grid(p.width, p.depth, p.cells);
}

/** Just enough of a World for robots to think, move, shoot and blow up in. */
function fakeWorld() {
  const at = (c: number) => c * CELL + CELL / 2;
  const added: Entity[] = [];
  const w = {
    scene: new THREE.Scene(),
    grid: grid(),
    boxes: [],
    cutscene: false,
    difficulty: { tier: 6, hp: 2.3, speed: 1.36, rate: 1.6, aggro: 15 },
    player: { body: makeBody(at(10), 0, at(10), 0.42, 1.7), hearts: 5, pounding: false, dashing: false, spinning: false, reloading: false, hurt: jest.fn() },
    shots: { fire: jest.fn(() => true) },
    particles: { emit: () => undefined },
    rings: { burst: () => undefined },
    hooks: { toast: jest.fn() },
    explode: jest.fn(),
    soundAt: () => undefined,
    shake: () => undefined,
    meetEnemy: () => undefined,
    alertNear: () => undefined,
    dropBolts: () => undefined,
    dropHeart: () => undefined,
    dropEnergy: () => undefined,
    enemyDied: () => undefined,
    forget: () => undefined,
    addEntity: (e: Entity) => (added.push(e), e),
    added,
  };
  return w;
}

function run(w: ReturnType<typeof fakeWorld>, e: Enemy, seconds: number) {
  for (let t = 0; t < seconds; t += 1 / 60) {
    if (e.alive) e.update(1 / 60);
    for (const x of [...w.added]) if (x.alive) x.update(1 / 60);
  }
}

describe('enemy roster', () => {
  it('gives every enemy kind a codex entry and a badge glyph', () => {
    for (const k of ALL_KINDS) {
      const kind = k as BadgeKind;
      expect(INTEL[kind]?.name).toBeTruthy();
      expect(INTEL[kind]?.tip).toBeTruthy();
      const before = drawCalls;
      enemyIcon(kind);
      // The round frame alone is a handful of calls; a glyph adds many more.
      expect(drawCalls - before).toBeGreaterThan(14);
    }
  });

  it('builds every robot, scaled to the deck, with 2-5 base hits', () => {
    for (const kind of ROBOT_KINDS) {
      const w = fakeWorld();
      const e = makeEnemy(w as unknown as World, `t-${kind}`, kind, 5, 5, 0);
      expect(e.kind).toBe(kind);
      expect(e.maxHp).toBeGreaterThanOrEqual(ROBOT_TUNING[kind].hp);
      expect(ROBOT_TUNING[kind].hp).toBeGreaterThanOrEqual(2);
      expect(ROBOT_TUNING[kind].hp).toBeLessThanOrEqual(5);
    }
  });
});

describe('robot behaviour', () => {
  const spawn = (kind: EnemyKind, cx: number, cz: number) => {
    const w = fakeWorld();
    const e = makeEnemy(w as unknown as World, `b-${kind}`, kind, cx, cz, 0);
    return { w, e };
  };

  it('trooper warns, then fires a three-shot burst', () => {
    const { w, e } = spawn('trooper', 10, 4);
    run(w, e, ROBOT_TUNING.trooper.aim + 2.5);
    expect(w.shots.fire.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('minebot rolls up and pops, hurting Jason and anything near', () => {
    const { w, e } = spawn('minebot', 10, 6);
    run(w, e, 4);
    expect(e.alive).toBe(false);
    expect(w.explode).toHaveBeenCalled();
    expect(w.player.hurt).toHaveBeenCalled();
  });

  it('minebot blasted before it beeps fizzles harmlessly', () => {
    const { w, e } = spawn('minebot', 10, 3);
    while (e.alive) e.hit(1, 'shot', new THREE.Vector3(10 * CELL, 1, 10 * CELL));
    expect(w.explode).not.toHaveBeenCalled();
  });

  it('bulwark blocks shots from the front but not from behind', () => {
    const { w, e } = spawn('bulwark', 10, 6);
    // It faces +z (toward Jason) after a moment.
    run(w, e, 3.5);
    const front = new THREE.Vector3(e.body.x, 1, e.body.z + 3);
    const hp = e.hp;
    e.hit(1, 'shot', front);
    expect(e.hp).toBe(hp);
    expect(w.hooks.toast).toHaveBeenCalledTimes(1);
    e.hit(1, 'shot', new THREE.Vector3(e.body.x, 1, e.body.z - 3));
    expect(e.hp).toBeLessThan(hp);
    // A ground pound knocks the shield down: now the front is open too.
    const after = e.hp;
    e.hit(1, 'pound', front);
    e.hit(1, 'shot', front);
    expect(e.hp).toBeLessThan(after - 1);
  });

  it('mortar lobs shells that land on their circles after a warning', () => {
    const { w, e } = spawn('mortar', 10, 4);
    run(w, e, 3.5);
    expect(w.added.length).toBeGreaterThan(0);
    run(w, e, ROBOT_TUNING.mortar.flight + 0.2);
    expect(w.player.hurt).toHaveBeenCalled();
  });
});

describe('robots on Gaia Nova', () => {
  const robotsIn = (id: string) =>
    Object.values(LEVELS[id as keyof typeof LEVELS].legend)
      .filter((s) => s.type === 'enemy' && (ROBOT_KINDS as readonly string[]).includes(s.enemy))
      .map((s) => (s.type === 'enemy' ? s.enemy : ''));

  it('appear in every chapter 2 region and never on the ship (in chapter 3, Aeëtes runs the ones he bought as scrap)', () => {
    for (const id of CHAPTER2) expect(robotsIn(id).length).toBeGreaterThan(0);
    for (const id of CHAPTER_DECKS[1]) expect(robotsIn(id)).toEqual([]);
    expect(robotsIn('harpies').length).toBeGreaterThan(0);
    // On General Brennus's own levels, Aeëtes has painted every one of them gold.
    const brennus = (x: string) => LEVELS[x as keyof typeof LEVELS].heroes?.includes('brennus');
    for (const id of LEVEL_ORDER.filter(brennus)) {
      const legend = Object.values(LEVELS[id].legend);
      expect(legend.filter((s) => s.type === 'enemy' && (ROBOT_KINDS as readonly string[]).includes(s.enemy)).every((s) => s.type === 'enemy' && s.variant === 'gold')).toBe(true);
    }
  });

  it('are introduced gradually: troopers and mines first, mortars in the desert, bulwarks in the snow', () => {
    expect(new Set(robotsIn('plains'))).toEqual(new Set(['trooper', 'minebot']));
    expect(robotsIn('desert')).toContain('mortar');
    expect(robotsIn('desert')).not.toContain('bulwark');
    expect(robotsIn('snow')).toContain('bulwark');
  });
});
