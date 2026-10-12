import * as THREE from 'three';

import { CELL } from '../src/core/constants';
import { enemyIcon } from '../src/entities/badges';
import { makeEnemy, type Enemy } from '../src/entities/enemies';
import type { Entity } from '../src/entities/entity';
import { argoBar, argoPace, Hold } from '../src/entities/stand/holds';
import { GoldenRam, RAM_TUNING } from '../src/entities/stand/goldenRam';
import { RAMLING_TUNING } from '../src/entities/stand/ramling';
import { companionPlan, helperOf } from '../src/game/companions';
import { BOSS_CARD, FLYOVER, INTEL, TRANSITIONS } from '../src/game/story';
import type { World } from '../src/game/world';
import { CHAPTER_DECKS, LEVELS, chapterOf, isFinale } from '../src/levels';
import { PANEL_IDS, panelSvg } from '../src/ui/panels';
import { Grid, parseLevel } from '../src/world/grid';
import type { LevelDef, PlacedEntity, Spec } from '../src/world/levelTypes';
import { makeBody } from '../src/world/physics';
import { isCollectible, reach } from '../tools/reach';

// three is ESM-only, which Jest's module loader can't read; Node's own require can, so load it with that.
jest.mock('three', () => process.getBuiltinModule('node:module').createRequire(__filename)('three'));

/** A stand-in for the browser canvas: every 2D call does nothing. */
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

const level = parseLevel(LEVELS.stand);
const find = (pred: (e: PlacedEntity) => boolean) => level.entities.filter(pred);
const at = (c: number) => c * CELL + CELL / 2;

/** A walled 31 x 21 yard of floor, with stone pillars wherever `pillars` says. */
function yard(pillars: [number, number][] = []) {
  const rows = Array.from({ length: 21 }, (_, z) => Array.from({ length: 31 }, (_, x): string => (x === 0 || z === 0 || x === 30 || z === 20 ? '#' : '.')));
  rows[18][2] = '@';
  for (const [x, z] of pillars) rows[z][x] = '|';
  const def: LevelDef = {
    id: 'stand',
    index: 16,
    name: 'test',
    subtitle: '',
    music: 'stand',
    map: `\n${rows.map((r) => r.join('')).join('\n')}\n`,
    legend: { '|': { type: 'decor', kind: 'pillar' } },
    objectives: [],
    shardIds: [],
    dialogues: {},
  };
  return parseLevel(def);
}

/** Just enough of a World for the ram, the ramlings and a hold to run in. */
function fakeWorld(pillars: [number, number][] = []) {
  const parsed = yard(pillars);
  const added: Entity[] = [];
  const flags = new Set<string>();
  let shield = false;
  const w = {
    scene: new THREE.Scene(),
    level: parsed,
    grid: new Grid(parsed.width, parsed.depth, parsed.cells),
    boxes: [],
    time: 0,
    cutscene: false,
    vehicle: null,
    difficulty: { tier: 0, hp: 1, speed: 1, rate: 1, aggro: 15 },
    save: { upgrades: {} },
    player: {
      body: makeBody(at(15), 0, at(15), 0.42, 1.7),
      hearts: 5,
      pounding: false,
      dashing: false,
      spinning: false,
      hurt: jest.fn(),
      shieldBlocks: () => shield,
    },
    setShield: (on: boolean) => (shield = on),
    shots: { fire: jest.fn(() => true), clear: () => undefined },
    particles: { emit: () => undefined },
    rings: { burst: () => undefined },
    hooks: { toast: jest.fn(), bossBar: jest.fn(), checkpoint: jest.fn() },
    targets: [] as unknown[],
    addTarget(t: unknown) {
      this.targets.push(t);
    },
    soundAt: () => undefined,
    shake: () => undefined,
    flash: () => undefined,
    hitStop: () => undefined,
    meetEnemy: () => undefined,
    dropBolts: () => undefined,
    dropHeart: () => undefined,
    dropEnergy: () => undefined,
    enemyDied: () => undefined,
    forget: () => undefined,
    bossIntro: () => Promise.resolve(),
    bossStarted: jest.fn(),
    bossDefeated: jest.fn(),
    hasFlag: (f: string) => flags.has(f),
    setFlag: (f: string) => flags.add(f),
    cond: (c: { flag: string }) => flags.has(c.flag),
    spawnEnemy: jest.fn((kind, cx: number, cz: number, variant?: string) => {
      const e = makeEnemy(w as unknown as World, `spawn${Math.random()}`, kind, cx, cz, 0, variant);
      added.push(e);
      return e;
    }),
    addEntity: (e: Entity) => (added.push(e), e),
    added,
    flags,
  };
  return w;
}
type Fake = ReturnType<typeof fakeWorld>;

function run(w: Fake, things: { alive: boolean; update(dt: number): void }[], seconds: number, each?: () => void) {
  for (let t = 0; t < seconds; t += 1 / 60) {
    w.time += 1 / 60;
    for (const x of [...things, ...w.added]) if (x.alive) x.update(1 / 60);
    each?.();
  }
}

describe('Brennus’s Last Stand', () => {
  it('is a chapter 3 level for General Brennus alone, after Aeëtes’s Mine', () => {
    const d = LEVELS.stand;
    expect(chapterOf('stand')).toBe(3);
    expect(CHAPTER_DECKS[3]).toContain('stand');
    expect(CHAPTER_DECKS[3].indexOf('stand')).toBeGreaterThan(CHAPTER_DECKS[3].indexOf('mine'));
    expect(d.heroes).toEqual(['brennus']);
    expect(d.boss).toBe('ram');
    expect(isFinale('stand')).toBe(false);
    expect(FLYOVER.stand).toContain('sky-dock');
    expect(TRANSITIONS.stand.map((l) => l.who)).toContain('brennus');
    expect(TRANSITIONS.stand.some((l) => l.text.includes('Garden of Colchis'))).toBe(true);
    // He goes without the droids, with his old Legion wrist computer for the vault.
    const plan = companionPlan('stand', () => true, { chapter: 3, hero: 'brennus', atalanta: false });
    expect(plan).toEqual({ lead: null, tag: null });
    expect(helperOf('stand', plan)).toBe('wrist');
  });

  it('has two lines to hold, each woken by a command post, with Legion dock guns', () => {
    const holds = find((e) => e.spec.type === 'hold')
      .map((e) => e.spec as Extract<Spec, { type: 'hold' }>)
      .sort((a, b) => a.argo[0] - b.argo[0]);
    expect(holds).toHaveLength(2);
    const posts = find((e) => e.spec.type === 'post').map((e) => e.spec as Extract<Spec, { type: 'post' }>);
    const guns = find((e) => e.spec.type === 'dockgun').map((e) => e.spec as Extract<Spec, { type: 'dockgun' }>);
    for (const h of holds) {
      const start = 'flag' in h.start ? h.start.flag : '';
      expect(posts.some((p) => p.order === 'guns' && p.flag === start)).toBe(true);
      expect(guns.filter((g) => g.flag === start).length).toBeGreaterThanOrEqual(3);
      // A door further on opens once it is held.
      expect(find((e) => e.spec.type === 'door' && 'flag' in e.spec.open && e.spec.open.flag === h.flag)).toHaveLength(1);
    }
    // The Argo comes in over the two holds, one stretch after the other, and the Ram is the last stretch.
    expect(holds[0].argo[0]).toBe(0);
    expect(holds[0].argo[1]).toBe(holds[1].argo[0]);
    expect(holds[1].argo[1]).toBeLessThan(1);
    // The second line has a post that turns the gold Legion robots Aeëtes drops back to Brennus's side.
    expect(posts.some((p) => p.order === 'fight' && p.room === holds[1].room)).toBe(true);
  });

  it('has the puzzles, side quests and enemies of a full level', () => {
    const count = (t: string) => find((e) => e.spec.type === t).length;
    expect(count('cracked')).toBeGreaterThanOrEqual(3);
    expect(count('checkpoint')).toBeGreaterThanOrEqual(3);
    expect(count('vendor')).toBe(1);
    expect(count('shard')).toBe(3);
    expect(count('canister')).toBe(1);
    expect(count('plate')).toBe(1);
    expect(count('legionbot')).toBe(1);
    expect(find((e) => e.spec.type === 'prize' && e.spec.id === 'vault')).toHaveLength(1);
    expect(find((e) => e.spec.type === 'boss' && e.spec.boss === 'ram')).toHaveLength(1);
    // Placed enemies plus everything the dropships bring.
    const placed = count('enemy');
    const dropped = find((e) => e.spec.type === 'hold').reduce((n, e) => n + (e.spec as Extract<Spec, { type: 'hold' }>).drops.reduce((m, d) => m + d.n, 0), 0);
    expect(placed + dropped).toBeGreaterThanOrEqual(35);
    expect(find((e) => e.spec.type === 'enemy' && e.spec.enemy === 'ramling').length).toBeGreaterThanOrEqual(4);
    // The arena has stone pillars to shove the Ram into.
    const ram = find((e) => e.spec.type === 'boss')[0];
    expect(find((e) => e.spec.type === 'decor' && e.spec.kind === 'pillar' && Math.hypot(e.cx - ram.cx, e.cz - ram.cz) < 14).length).toBeGreaterThanOrEqual(4);
  });

  it('lets General Brennus reach everything with his own moves; the cracked walls and wide gaps are his', () => {
    expect(reach(level, [], ['brennus']).missing.filter((e) => !isCollectible(e.spec))).toEqual([]);
    expect(reach(level, [], ['brennus']).missing).toEqual([]);
    // Jason without his jet boots couldn't even get off the landing pier.
    expect(reach(level, [], ['jason']).missing.map((e) => e.spec.type)).toContain('boss');
  });

  it('paints the stand on the sky-dock and the salute to the Argo', () => {
    expect(LEVELS.stand.stories?.opening?.[0].panel).toBe('ch3-stand');
    expect(LEVELS.stand.stories?.salute?.[0].panel).toBe('ch3-salute');
    for (const id of ['ch3-stand', 'ch3-salute'] as const) {
      expect(PANEL_IDS).toContain(id);
      expect(panelSvg(id).startsWith('<svg')).toBe(true);
    }
    expect(BOSS_CARD.ram.sub).toBeTruthy();
    expect(INTEL.ramling.tip).toBeTruthy();
    expect(() => enemyIcon('ramling')).not.toThrow();
  });
});

describe('ramlings', () => {
  const spawn = (cx: number, cz: number) => {
    const w = fakeWorld();
    const e = makeEnemy(w as unknown as World, 'r1', 'ramling', cx, cz, 0);
    return { w, e };
  };

  it('paw the ground, then charge and hurt Brennus', () => {
    const { w, e } = spawn(15, 11);
    run(w, [e], RAMLING_TUNING.paw + 3.5);
    expect(w.player.hurt).toHaveBeenCalled();
  });

  it('bonk their heads on his raised shield and get dizzy (double damage)', () => {
    const { w, e } = spawn(15, 11);
    w.setShield(true);
    let bonked = false;
    run(w, [e], RAMLING_TUNING.paw + 3.5, () => {
      if (w.hooks.toast.mock.calls.some((c) => String(c[0]).startsWith('BONK'))) bonked = true;
    });
    expect(bonked).toBe(true);
    const before = e.hp;
    e.hit(1, 'shot', new THREE.Vector3(e.body.x, 1, e.body.z + 5));
    expect(before - e.hp).toBe(2);
  });

  it('shrug off plain shots on their gold forehead, but not a big blast', () => {
    const { e } = spawn(15, 11);
    const front = new THREE.Vector3(e.body.x + Math.sin(Math.PI) * 4, 1, e.body.z + Math.cos(Math.PI) * 4);
    const hp = e.hp;
    e.hit(1, 'shot', front);
    expect(e.hp).toBe(hp);
    e.hit(2, 'blast', front);
    expect(e.hp).toBe(hp - 2);
  });
});

describe('THE GOLDEN RAM', () => {
  /** The Ram in the middle of the yard, Brennus south of it, a pillar far to the north. */
  function fight() {
    const w = fakeWorld([[15, 2], [3, 10], [27, 10]]);
    const ram = new GoldenRam(w as unknown as World, 'ram', 15, 9, 0);
    ram.engage();
    w.player.body.z = at(15);
    return { w, ram };
  }
  type Peek = { state: string; body: { x: number; z: number } };
  const state = (r: GoldenRam) => (r as unknown as Peek).state;

  it('is armoured until it crashes: its horns lock in the shield, a charge shoves it into a pillar, and its engine opens', () => {
    const { w, ram } = fight();
    expect(ram.pillarCount).toBe(3);
    ram.hit(5, 'blast', new THREE.Vector3(at(15), 1, at(15)));
    expect(ram.hp).toBe(RAM_TUNING.hp);
    // Brennus holds up his shield: sooner or later it charges, and its horns lock in it.
    w.setShield(true);
    let locked = false;
    let shoved = false;
    let crashed = false;
    run(w, [ram], 20, () => {
      if (!shoved && state(ram) === 'locked') {
        locked = true;
        // ...and a CHARGE from the south shoves it north, toward the pillar there.
        shoved = true;
        const b = (ram as unknown as Peek).body;
        ram.hit(3, 'smash', new THREE.Vector3(b.x, 1, b.z + 3));
        expect(state(ram)).toBe('shoved');
      }
      if (state(ram) === 'open') crashed = true;
    });
    expect(locked).toBe(true);
    expect(crashed).toBe(true);
    expect(w.hooks.toast.mock.calls.some((c) => String(c[0]).startsWith('CRASH'))).toBe(true);
    // Shots bounce off its gold sides until then; into the open engine, a big blast hurts.
    expect(ram.hp).toBeLessThanOrEqual(RAM_TUNING.hp);
  });

  it('only takes damage while its engine is open, and lies down for a nap at zero', () => {
    const { w, ram } = fight();
    (ram as unknown as { state: string; stateT: number }).state = 'open';
    (ram as unknown as { state: string; stateT: number }).stateT = 99;
    run(w, [ram], 0.1);
    expect(ram.aimable).toBe(true);
    while (ram.hp > 0) ram.hit(5, 'blast', new THREE.Vector3(at(15), 4, at(9)));
    expect(ram.defeated).toBe(false);
    run(w, [ram], 3);
    expect(ram.defeated).toBe(true);
    expect(w.bossDefeated).toHaveBeenCalledWith(ram);
  });
});

describe('holding a line', () => {
  const spec: Extract<Spec, { type: 'hold' }> = {
    type: 'hold',
    start: { flag: 'guns' },
    flag: 'held',
    argo: [0, 0.5],
    time: 10,
    w: 21,
    d: 15,
    room: 'wave',
    drops: [
      { enemy: 'ramling', n: 1 },
      { enemy: 'ramling', n: 1 },
    ],
  };

  it('slows the Argo while Aeëtes’s robots crowd the line', () => {
    expect(argoPace(0)).toBe(1);
    expect(argoPace(2)).toBe(1);
    expect(argoPace(3)).toBeLessThan(1);
    expect(argoPace(6)).toBeLessThan(argoPace(3));
  });

  it('waits for the guns, brings its dropships, and is held once the Argo gets through', () => {
    const w = fakeWorld();
    const hold = new Hold(w as unknown as World, 'h1', 15, 10, 0, spec);
    expect(argoBar(w as unknown as World)).toEqual({ frac: 0, slowed: false });
    run(w, [hold], 2);
    expect(hold.active).toBe(false);
    w.flags.add('guns');
    run(w, [hold], 1);
    expect(hold.active).toBe(true);
    // While a robot is on the line, the Argo slows down (and the bar says so).
    const robots = () => w.added.filter((e): e is Enemy => (e as Enemy).room === 'wave' && e.alive && 'hp' in e);
    run(w, [hold], 6);
    expect(robots().length).toBeGreaterThan(0);
    // Then Brennus beats every robot as soon as it lands.
    run(w, [hold], 40, () => {
      for (const e of robots()) e.remove();
    });
    expect(w.spawnEnemy).toHaveBeenCalledTimes(2);
    expect(w.flags.has('held')).toBe(true);
    expect(argoBar(w as unknown as World)?.frac).toBe(0.5);
  });
});
