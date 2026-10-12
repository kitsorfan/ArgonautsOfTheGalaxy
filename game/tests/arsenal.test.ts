import * as THREE from 'three';

import { CELL } from '../src/core/constants';
import { migrateSave, newSave, type SaveData } from '../src/core/save';
import { healthColor, showsNumber } from '../src/entities/badges';
import { Boss, bossHp } from '../src/entities/bossBase';
import { makeEnemy } from '../src/entities/enemies';
import type { Entity, HitKind } from '../src/entities/entity';
import { inCone } from '../src/entities/flame';
import { Player } from '../src/entities/player';
import {
  FLAME,
  WEAPONS,
  WEAPON_ORDER,
  burnDps,
  chargedDamageOf,
  clipOf,
  cooldownOf,
  damageOf,
  reloadOf,
  stepTank,
  type Tank,
  type WeaponId,
} from '../src/entities/weapons';
import { buyWeapon, shopStock } from '../src/game/shop';
import type { World } from '../src/game/world';
import { CHAPTER_DECKS } from '../src/levels';
import { Grid, parseLevel } from '../src/world/grid';
import type { LevelDef } from '../src/world/levelTypes';
import { makeBody } from '../src/world/physics';

// three is ESM-only, which Jest's module loader can't read; Node's own require can, so load it with that.
jest.mock('three', () => process.getBuiltinModule('node:module').createRequire(__filename)('three'));

/** A stand-in for the browser: canvases that draw nothing, a window and a navigator. */
const anything = (): unknown =>
  new Proxy(() => undefined, {
    get: (_t, k) => (k === Symbol.toPrimitive ? () => 0 : anything()),
    apply: () => anything(),
    set: () => true,
  });
const ctx = new Proxy({}, { get: () => () => anything(), set: () => true });
beforeAll(() => {
  const g = globalThis as Record<string, unknown>;
  g.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx, toDataURL: () => 'data:' }) };
  g.window ??= {};
  g.navigator ??= { hardwareConcurrency: 8 };
});

const STATS = (id: WeaponId) => {
  const w = WEAPONS[id];
  return [w.range, w.power, w.speed, w.cooldown, w.clip, w.reload].join('|');
};

describe('weapon stats', () => {
  it('gives every weapon its own range, power, speed and ammo', () => {
    expect(new Set(WEAPON_ORDER.map(STATS)).size).toBe(WEAPON_ORDER.length);
    for (const id of WEAPON_ORDER) {
      const w = WEAPONS[id];
      expect(w.special.length).toBeGreaterThan(10);
      for (const v of [w.range, w.power, w.speed, w.cooldown, w.clip, w.reload, w.aim]) expect(v).toBeGreaterThan(0);
      for (const b of Object.values(w.bars)) {
        expect(Number.isInteger(b)).toBe(true);
        expect(b).toBeGreaterThanOrEqual(1);
        expect(b).toBeLessThanOrEqual(5);
      }
    }
  });

  it('matches the brief: short shotgun, long seeker, tiny thunder clip, very short flames', () => {
    const r = (id: WeaponId) => WEAPONS[id].range;
    expect(r('flame')).toBeLessThan(r('spread'));
    expect(r('spread')).toBeLessThan(r('blaster'));
    expect(r('frost')).toBeLessThan(r('blaster'));
    expect(r('thunder')).toBeLessThan(r('blaster'));
    expect(r('seeker')).toBe(Math.max(...WEAPON_ORDER.map(r)));
    expect(WEAPONS.spread.pellets).toBeGreaterThanOrEqual(3);
    expect(WEAPONS.spread.clip).toBeGreaterThan(WEAPONS.blaster.clip);
    expect(WEAPONS.frost.power).toBeLessThan(WEAPONS.blaster.power);
    expect(WEAPONS.thunder.clip).toBeLessThan(WEAPONS.blaster.clip);
    expect(WEAPONS.thunder.cooldown).toBeGreaterThan(WEAPONS.blaster.cooldown);
    expect(WEAPONS.seeker.speed).toBeLessThan(WEAPONS.blaster.speed);
    expect(WEAPONS.seeker.clip).toBeLessThan(WEAPONS.blaster.clip);
    expect(WEAPONS.flame.chargeCost).toBe(0);
    // Damage per second while firing up close: the Flamethrower (with the burning) out-burns everything.
    // That's what its tiny reach and its fuel tank pay for.
    const dps = (id: WeaponId) => (id === 'flame' ? WEAPONS.flame.power + FLAME.burnDps : (WEAPONS[id].power * WEAPONS[id].pellets) / WEAPONS[id].cooldown);
    for (const id of WEAPON_ORDER) if (id !== 'flame') expect(dps('flame')).toBeGreaterThan(dps(id));
  });

  it('draws longer RANGE bars for longer ranges and longer AMMO bars for bigger clips', () => {
    for (const a of WEAPON_ORDER) {
      for (const b of WEAPON_ORDER) {
        const [wa, wb] = [WEAPONS[a], WEAPONS[b]];
        if (wa.range > wb.range) expect(wa.bars.range).toBeGreaterThanOrEqual(wb.bars.range);
        if (a !== 'flame' && b !== 'flame' && wa.clip > wb.clip) expect(wa.bars.ammo).toBeGreaterThanOrEqual(wb.bars.ammo);
      }
    }
  });

  it('grows every weapon with the shop upgrades', () => {
    const up = { blaster: 2, clip: 3, rapid: 2 };
    for (const id of WEAPON_ORDER) {
      expect(clipOf(id, up)).toBeGreaterThan(clipOf(id));
      expect(reloadOf(id, up)).toBeLessThan(reloadOf(id));
      expect(cooldownOf(id, up)).toBeLessThan(cooldownOf(id));
      expect(damageOf(id, up)).toBeCloseTo(3 * damageOf(id));
    }
    expect(clipOf('blaster')).toBe(6);
    expect(clipOf('blaster', { clip: 2 })).toBe(10);
    expect(chargedDamageOf('blaster')).toBe(4);
    expect(burnDps({ blaster: 1 })).toBeCloseTo(2 * burnDps());
  });

  it('makes bosses tougher with Blaster Power, but slower than the damage grows', () => {
    const hpAt = (blaster: number) => bossHp({ save: { upgrades: { blaster } } } as unknown as World, 30);
    expect(hpAt(0)).toBe(30);
    for (const u of [1, 2, 3]) {
      const shots = hpAt(u) / damageOf('blaster', { blaster: u });
      // Fewer shots than with no upgrade (it's worth buying), but never less than half as many.
      expect(shots).toBeLessThan(hpAt(u - 1) / damageOf('blaster', { blaster: u - 1 }));
      expect(shots).toBeGreaterThanOrEqual(30 / 2);
    }
  });
});

describe('flamethrower fuel', () => {
  const full = (): Tank => ({ fuel: clipOf('flame'), dry: false, rest: 0 });
  const run = (t: Tank, firing: boolean, seconds: number) => {
    for (let s = 0; s < seconds; s += 0.05) t = stepTank(t, firing, 0.05);
    return t;
  };

  it('drains while burning and runs dry after a full tank', () => {
    const half = run(full(), true, clipOf('flame') / 2);
    expect(half.fuel).toBeGreaterThan(0);
    expect(half.dry).toBe(false);
    const empty = run(full(), true, clipOf('flame') + 0.2);
    expect(empty.fuel).toBe(0);
    expect(empty.dry).toBe(true);
  });

  it('rests a moment, then refills by itself; a dry tank unlocks once it is partly full again', () => {
    let t = stepTank(full(), true, clipOf('flame') + 0.01);
    expect(t.dry).toBe(true);
    t = run(t, false, FLAME.rest * 0.8);
    expect(t.fuel).toBe(0);
    t = run(t, false, reloadOf('flame') * (FLAME.dryAt - 0.1) + FLAME.rest);
    expect(t.dry).toBe(true);
    t = run(t, false, reloadOf('flame') * 0.25);
    expect(t.dry).toBe(false);
    t = run(t, false, reloadOf('flame'));
    expect(t.fuel).toBeCloseTo(clipOf('flame'));
  });

  it('holds more fuel and refills faster with the upgrades', () => {
    const up = { clip: 2, rapid: 2 };
    expect(clipOf('flame', up)).toBeGreaterThan(clipOf('flame'));
    const t = stepTank({ fuel: 0, dry: false, rest: 0 }, false, 1, up);
    const base = stepTank({ fuel: 0, dry: false, rest: 0 }, false, 1);
    expect(t.fuel).toBeGreaterThan(base.fuel);
  });

  it('reaches only what is inside its short cone', () => {
    // Facing +z from the origin.
    expect(inCone(0, 0, 0, 1, 0, 4, 5.5, FLAME.cone)).toBe(true);
    expect(inCone(0, 0, 0, 1, 1.5, 4, 5.5, FLAME.cone)).toBe(true);
    expect(inCone(0, 0, 0, 1, 4, 2, 5.5, FLAME.cone)).toBe(false);
    expect(inCone(0, 0, 0, 1, 0, -3, 5.5, FLAME.cone)).toBe(false);
    expect(inCone(0, 0, 0, 1, 0, 7, 5.5, FLAME.cone)).toBe(false);
    // A big target pokes into the cone sooner.
    expect(inCone(0, 0, 0, 1, 3.2, 4, 5.5, FLAME.cone, 1.5)).toBe(true);
  });
});

/* ---------------- burning ---------------- */

function grid(): Grid {
  const row = (s: string) => s.padEnd(21, s.at(-1));
  const rows = ['#'.repeat(21), row('#@' + '.'.repeat(18) + '#'), ...Array.from({ length: 18 }, () => row('#' + '.'.repeat(19) + '#')), '#'.repeat(21)];
  const def: LevelDef = { id: 'plains', index: 7, name: 'test', subtitle: '', music: 'plains', map: `\n${rows.join('\n')}\n`, legend: {}, objectives: [], shardIds: [], dialogues: {} };
  const p = parseLevel(def);
  return new Grid(p.width, p.depth, p.cells);
}

const at = (c: number) => c * CELL + CELL / 2;

/** Just enough of a World for an enemy (or a boss) to stand, burn and freeze in. */
function fakeWorld() {
  const added: Entity[] = [];
  return {
    scene: new THREE.Scene(),
    grid: grid(),
    boxes: [],
    cutscene: false,
    difficulty: { tier: 0, hp: 1, speed: 1, rate: 1, aggro: 11 },
    // Jason stands far away, so nothing attacks him.
    player: { body: makeBody(at(18), 0, at(18), 0.42, 1.7), hearts: 5, pounding: false, dashing: false, spinning: false, reloading: false, hurt: jest.fn() },
    shots: { fire: jest.fn(() => true) },
    particles: { emit: () => undefined },
    rings: { burst: () => undefined },
    hooks: { toast: jest.fn(), bossBar: jest.fn(), hud: jest.fn() },
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
    bossStarted: () => undefined,
    addEntity: (e: Entity) => (added.push(e), e),
    added,
  };
}

function sporeling() {
  const w = fakeWorld();
  const e = makeEnemy(w as unknown as World, 'e1', 'sporeling', 3, 3, 0.5);
  e.maxHp = e.hp = 20;
  return e;
}

const tick = (e: { update(dt: number): void; alive: boolean }, seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 60) if (e.alive) e.update(1 / 60);
};

describe('burning', () => {
  it('stings a burning enemy every half second for as long as it burns, then stops', () => {
    const e = sporeling();
    e.ignite(FLAME.burn, 2);
    expect(e.burning).toBe(true);
    tick(e, FLAME.burn + 0.1);
    expect(e.burning).toBe(false);
    // About 2 health a second for the whole burn.
    expect(20 - e.hp).toBeGreaterThan(2 * FLAME.burn - 1.2);
    expect(20 - e.hp).toBeLessThan(2 * FLAME.burn + 1.2);
    const after = e.hp;
    tick(e, 2);
    expect(e.hp).toBe(after);
  });

  it('melts frost: fire thaws a frozen enemy, and cold puts the fire out', () => {
    const e = sporeling();
    e.chill(3, true);
    expect(e.frozen).toBe(true);
    e.ignite(FLAME.burn, 1);
    expect(e.frozen).toBe(false);
    expect(e.tempo).toBe(1);
    e.chill(2);
    expect(e.burning).toBe(false);
  });

  it('never stuns: a burning enemy keeps moving', () => {
    const e = sporeling();
    e.hit(1, 'burn', new THREE.Vector3(at(2), 0, at(3)));
    expect((e as unknown as { stagger: number }).stagger).toBeLessThanOrEqual(0);
  });

  class TestBoss extends Boss {
    readonly title = 'TEST BOSS';
    hits: [number, HitKind][] = [];
    hit(dmg: number, kind: HitKind) {
      this.hits.push([dmg, kind]);
      return true;
    }
    reset() {}
  }

  it('lets bosses burn only briefly, through their own hit rules', () => {
    const b = new TestBoss(fakeWorld() as unknown as World, 'boss', 5, 5, 0, 50);
    b.ignite(FLAME.burn, 2);
    expect(b.burning).toBe(false); // not before the fight starts
    b.started = true;
    b.ignite(FLAME.burn * FLAME.bossBurn, 2);
    for (let t = 0; t < 3; t += 1 / 60) b.tempo(1 / 60);
    expect(FLAME.bossBurn).toBeLessThan(0.5);
    expect(b.hits.length).toBeGreaterThan(0);
    expect(b.hits.length).toBeLessThanOrEqual(Math.ceil((FLAME.burn * FLAME.bossBurn) / 0.5) + 1);
    expect(b.hits.every(([, k]) => k === 'burn')).toBe(true);
  });
});

/* ---------------- Jason's clips ---------------- */

function jason(save: SaveData) {
  const w = { save, def: { id: 'plains', heroes: undefined, joins: {} }, scene: new THREE.Scene(), hooks: { hud: jest.fn() }, particles: { emit: () => undefined }, refreshCompanions: () => undefined };
  return new Player(w as unknown as World, 2, 0, 2, 0);
}

describe('clips', () => {
  it('keeps a clip per weapon when Jason switches, sized for each weapon', () => {
    const s = newSave();
    s.weapons = ['blaster', 'thunder', 'frost'];
    const p = jason(s);
    expect(p.ammo).toBe(WEAPONS.blaster.clip);
    p.ammo = 2;
    p.cycleWeapon();
    expect(p.weapon).toBe('frost');
    expect(p.clipSize).toBe(WEAPONS.frost.clip);
    expect(p.ammo).toBe(WEAPONS.frost.clip);
    p.ammo = 5;
    p.cycleWeapon();
    expect(p.weapon).toBe('thunder');
    expect(p.ammo).toBe(WEAPONS.thunder.clip);
    p.cycleWeapon();
    expect(p.weapon).toBe('blaster');
    expect(p.ammo).toBe(2);
    p.cycleWeapon();
    expect(p.ammo).toBe(5);
  });

  it('refills every clip and the tank on a revive', () => {
    const s = newSave();
    s.weapons = ['blaster', 'flame'];
    const p = jason(s);
    p.ammo = 0;
    p.tank = { fuel: 0, dry: true, rest: 0 };
    p.revive();
    expect(p.ammo).toBe(WEAPONS.blaster.clip);
    expect(p.fuel).toBe(1);
    expect(p.tank.dry).toBe(false);
  });
});

/* ---------------- shop and saves ---------------- */

function onGaia(): SaveData {
  const s = newSave();
  s.unlocked = CHAPTER_DECKS[1].length + 1;
  return s;
}

describe('flamethrower in the shop and in saves', () => {
  it('is sold on Gaia Nova as the priciest weapon', () => {
    const offer = shopStock(onGaia()).weapons.find((o) => o.weapon.id === 'flame');
    expect(offer?.price).toBe(WEAPONS.flame.price);
    expect(WEAPONS.flame.price).toBeGreaterThan(WEAPONS.seeker.price);
    expect(shopStock(newSave(), 'bridge').weapons).toEqual([]);
    const s = onGaia();
    s.bolts = WEAPONS.flame.price;
    expect(buyWeapon(s, 'flame')).toBe(true);
    expect(s.weapons).toEqual(['blaster', 'flame']);
    expect(s.weapon).toBe('flame');
    expect(s.bolts).toBe(0);
  });

  it('keeps a saved Flamethrower (and the old weapons) through migration', () => {
    const s = migrateSave({ ...newSave(), weapons: ['flame', 'seeker', 'plasmaSword'], weapon: 'flame' });
    expect(s.weapons).toEqual(['blaster', 'seeker', 'flame']);
    expect(s.weapon).toBe('flame');
    const old = migrateSave({ ...newSave(), weapons: ['blaster', 'spread'], weapon: 'spread' });
    expect(old.weapons).toEqual(['blaster', 'spread']);
    expect(old.weapon).toBe('spread');
  });
});

describe('enemy health bars', () => {
  it('fades from green through yellow to red', () => {
    const full = healthColor(1);
    const half = healthColor(0.5);
    const low = healthColor(0.05);
    expect(full.g).toBeGreaterThan(full.r);
    expect(half.r).toBeGreaterThan(0.8);
    expect(half.g).toBeGreaterThan(0.5);
    expect(low.r).toBeGreaterThan(low.g * 4);
  });

  it('shows a number only for tough enemies', () => {
    expect(showsNumber(3, false)).toBe(false);
    expect(showsNumber(3, true)).toBe(true);
    expect(showsNumber(12, false)).toBe(true);
  });
});
