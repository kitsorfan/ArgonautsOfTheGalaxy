import { GRAVITY, MECH, STEP_H } from '../src/core/constants';
import { newSave } from '../src/core/save';
import { HEROES, joinedRoster, parkedFlag } from '../src/entities/heroes/heroes';
import { drain, freshPower, hitCost, mend, spent } from '../src/entities/heroes/mechPower';
import { ANVIL_TUNING, TALOS_TUNING } from '../src/entities/forge/tuning';
import { ROBOT_TUNING } from '../src/entities/robots';
import { WEAPONS, damageOf, stepFuel, type Tank } from '../src/entities/weapons';
import { difficultyFor } from '../src/game/difficulty';
import { BOSS_CARD, FLYOVER, INTEL, TRANSITIONS } from '../src/game/story';
import { CHAPTER_DECKS, CHAPTER_PLAN, LEVELS, chapterOf } from '../src/levels';
import { PANEL_IDS, panelSvg } from '../src/ui/panels';
import { parseLevel } from '../src/world/grid';
import type { HeroId } from '../src/world/levelTypes';
import { footHeroes, isCollectible, levelHeroes, mechReach, reach, vehicleStart } from '../tools/reach';

// The robots' module builds three.js models; the test only needs its tuning, so give it the real module.
jest.mock('three', () => process.getBuiltinModule('node:module').createRequire(__filename)('three'));

const level = parseLevel(LEVELS.forge);
const ALL = ['doubleJump', 'dash', 'glide', 'pulse', 'grapple'] as const;
const find = (pred: (e: (typeof level.entities)[number]) => boolean) => level.entities.filter(pred);
const blocked = (heroes: HeroId[]) =>
  reach(level, [...ALL], heroes)
    .missing.filter((e) => !isCollectible(e.spec))
    .map((e) => e.spec.type);

describe('Talos’s Forge', () => {
  it('is a chapter 3 level after Aeëtes’s Mine, with its story beats', () => {
    expect(chapterOf('forge')).toBe(3);
    expect(CHAPTER_DECKS[3].indexOf('forge')).toBeGreaterThan(CHAPTER_DECKS[3].indexOf('mine'));
    expect(CHAPTER_PLAN[3]).toContain(LEVELS.forge.name);
    expect(LEVELS.forge.boss).toBe('talos');
    expect(FLYOVER.forge).toContain('Talos');
    // It ends at the labyrinth gate, looking ahead to Medusa.
    expect(TRANSITIONS.forge.some((l) => l.text.includes('MEDUSA'))).toBe(true);
    expect(BOSS_CARD.talos.sub).toContain('Aeëtes');
    expect(INTEL.anvil.name).toBe('Anvil Drone');
    for (const key of ['intro', 'log', 'boss', 'bossDown', 'meet:mech', 'joined:mech', 'shard:s1', 'shard:s2', 'shard:s3']) {
      expect(LEVELS.forge.dialogues[key]?.length).toBeGreaterThan(0);
    }
    expect(LEVELS.forge.stories?.['meet:mech']?.[0].panel).toBe('ch3-mech');
    expect(LEVELS.forge.stories?.talos?.[0].panel).toBe('ch3-talos');
  });

  it('paints its two storybook panels', () => {
    for (const id of ['ch3-mech', 'ch3-talos'] as const) {
      expect(PANEL_IDS).toContain(id);
      expect(panelSvg(id)).toContain('<svg');
    }
  });

  it('starts on foot with Jason and Atalanta, and parks the mech for them in the forge', () => {
    expect(LEVELS.forge.heroes).toEqual(['jason', 'atalanta', 'mech']);
    expect(LEVELS.forge.joins).toEqual({ mech: 'mech' });
    expect(HEROES.mech.vehicle).toBe(true);
    expect(footHeroes(level)).toEqual(['jason', 'atalanta']);
    expect(levelHeroes(level)).toContain('mech');
    const parked = find((e) => e.spec.type === 'marker' && e.spec.id === 'mech');
    expect(parked).toHaveLength(1);
    expect(vehicleStart(level, 'mech')).toEqual([parked[0].cx, parked[0].cz]);
    // The trigger that puts everyone aboard only works once the forge is awake.
    const board = find((e) => e.spec.type === 'trigger' && e.spec.event === 'join:mech');
    expect(board).toHaveLength(1);
    expect(board[0].spec).toMatchObject({ when: { flag: 'forgelit' } });
  });

  it('makes the mech the only hero once everyone has climbed in', () => {
    const cast: HeroId[] = ['jason', 'atalanta', 'mech'];
    expect(joinedRoster(cast, (h) => h !== 'mech')).toEqual(['jason', 'atalanta']);
    expect(joinedRoster(cast, () => true)).toEqual(['mech']);
    // Levels without a vehicle are untouched.
    expect(joinedRoster(['jason', 'atalanta'], () => true)).toEqual(['jason', 'atalanta']);
  });

  it('lets the heroes climb out (the mech waits, parked) and back in', () => {
    const cast: HeroId[] = ['jason', 'atalanta', 'mech'];
    // While the parked flag is set, the mech counts as not joined: Jason and Atalanta are on foot again.
    const flags = new Set(['mech', parkedFlag('mech')]);
    const joined = (h: HeroId) => (h === 'mech' ? flags.has('mech') && !flags.has(parkedFlag('mech')) : true);
    expect(joinedRoster(cast, joined)).toEqual(['jason', 'atalanta']);
    flags.delete(parkedFlag('mech'));
    expect(joinedRoster(cast, joined)).toEqual(['mech']);
    // The boarding scene teaches the new rules: strength, the flamethrower, getting out.
    const lines = LEVELS.forge.dialogues['joined:mech'].map((l) => l.text).join(' ');
    for (const word of ['STRENGTH', 'FLAMETHROWER', 'GET OUT', 'CLIMB back IN']) expect(lines).toContain(word);
  });

  it('needs Jason, Atalanta and the mech: each alone gets stuck', () => {
    // On foot: Atalanta's bullseye lowers the drawbridge, Jason's grapple reaches the ledge, her slide the terminal.
    expect(blocked(['jason'])).toEqual(expect.arrayContaining(['target', 'terminal', 'boss']));
    expect(blocked(['atalanta'])).toEqual(expect.arrayContaining(['terminal', 'boss']));
    // Nobody on foot gets through the bronze gate; the mech (from where it is parked) reaches the boss and the exit.
    const mech = blocked(['mech']);
    expect(mech).not.toContain('boss');
    expect(mech).not.toContain('exit');
    expect(blocked([...levelHeroes(level)])).toEqual([]);
  });

  it('has a bronze gate, cracked floor plates over a trench and a cellar, and red switches for the mech', () => {
    expect(find((e) => e.spec.type === 'bronzegate').length).toBeGreaterThan(0);
    const plates = find((e) => e.spec.type === 'brittle');
    expect(plates.length).toBeGreaterThanOrEqual(4);
    // Each plate sits over a cell well below its lid: the cellar the SLAM drops the mech into.
    for (const p of plates) if (p.spec.type === 'brittle') expect(p.spec.lid - p.h).toBeGreaterThanOrEqual(1.5);
    expect(find((e) => e.spec.type === 'switch')).toHaveLength(2);
    expect(find((e) => e.spec.type === 'shard')).toHaveLength(3);
    expect(find((e) => e.spec.type === 'canister')).toHaveLength(1);
    expect(find((e) => e.spec.type === 'prize' && e.spec.id === 'vault')).toHaveLength(1);
    const enemies = find((e) => e.spec.type === 'enemy');
    expect(enemies.length).toBeGreaterThanOrEqual(25);
    expect(enemies.filter((e) => e.spec.type === 'enemy' && e.spec.enemy === 'anvil').length).toBeGreaterThanOrEqual(6);
  });
});

describe('the bronze mech', () => {
  it('jumps four floor steps, and needs its THRUST for wide lava channels', () => {
    const apex = (MECH.jumpV * MECH.jumpV) / (2 * GRAVITY);
    expect(apex - 0.3).toBeGreaterThanOrEqual(4 * STEP_H);
    // A channel three cells wide is four cells centre to centre: the jump alone falls short, jump + thrust makes it.
    const plain = ((MECH.speed * ((2 * MECH.jumpV) / GRAVITY)) * 0.9 + 1.6) / 2;
    expect(plain).toBeLessThan(4);
    expect(mechReach(0)).toBeGreaterThanOrEqual(4);
    // But it is no Jason: nowhere near the nine cells his double jump and glide cover.
    expect(mechReach(0)).toBeLessThan(6);
  });

  it('is big and heavy, but still fits through a one-cell door', () => {
    expect(MECH.height).toBeGreaterThan(HEROES.jason.height);
    expect(MECH.radius * 2).toBeLessThan(2);
    expect(MECH.slamSpeed).toBeGreaterThan(MECH.heavyLanding);
  });

  it('walks slowly: clearly slower than Jason, and even than General Brennus', () => {
    expect(MECH.speed).toBeLessThanOrEqual(HEROES.jason.speed * 0.75);
    expect(MECH.speed).toBeLessThan(HEROES.brennus.speed);
    expect(HEROES.mech.speed).toBe(MECH.speed);
  });

  it('hits far harder than anyone on foot: small robots and drones go down in one or two punches', () => {
    const d = difficultyFor(LEVELS.forge.index, newSave());
    const punch = MECH.punchDamage * d.hp;
    for (const hp of [ROBOT_TUNING.trooper.hp, ROBOT_TUNING.minebot.hp, ROBOT_TUNING.mortar.hp, ANVIL_TUNING.hp]) {
      // An ordinary one in one punch; a big gold-crowned elite in two.
      expect(punch).toBeGreaterThanOrEqual(Math.round(hp * d.hp));
      expect(punch * 2).toBeGreaterThanOrEqual(Math.round(hp * d.hp * 1.8));
    }
    // The flames burn much hotter, farther and wider than Jason's Flamethrower...
    expect(MECH.flameDps * d.hp).toBeGreaterThan(damageOf('flame') * 2);
    expect(MECH.flameRange).toBeGreaterThan(WEAPONS.flame.range);
    // ...and reach up to an anvil drone hovering over the mech (the fire leaves its fist 2.2 up).
    expect(MECH.flameReachY + 2.2).toBeGreaterThanOrEqual(ANVIL_TUNING.hover);
    expect(MECH.slamRadius).toBeGreaterThan(2.8);
  });

  it('has a flamethrower tank that runs dry and fills back up by itself', () => {
    let t: Tank = { fuel: MECH.flameFuel, dry: false, rest: 0 };
    for (let s = 0; s < MECH.flameFuel + 0.1; s += 0.05) t = stepFuel(t, true, 0.05, MECH.flameFuel, MECH.flameRefill);
    expect(t.fuel).toBe(0);
    expect(t.dry).toBe(true);
    for (let s = 0; s < MECH.flameRefill + 1; s += 0.05) t = stepFuel(t, false, 0.05, MECH.flameFuel, MECH.flameRefill);
    expect(t.fuel).toBeCloseTo(MECH.flameFuel);
    expect(t.dry).toBe(false);
  });
});

describe('the mech’s STRENGTH (instead of hearts)', () => {
  it('loses only a small slice to a hit that would cost a hero a whole heart', () => {
    expect(hitCost(1, false)).toBeLessThanOrEqual(MECH.strength * 0.15);
    expect(hitCost(1, true)).toBeGreaterThan(hitCost(1, false));
    let s = freshPower();
    let hits = 0;
    while (!spent(s)) {
      s = drain(s, 1);
      hits += 1;
    }
    expect(hits).toBeGreaterThanOrEqual(8);
    expect(s.strength).toBe(0);
  });

  it('never mends by itself, like hearts: only bronze gears and checkpoints bring it back', () => {
    for (const k of ['regen', 'regenDelay', 'cool']) expect(MECH).not.toHaveProperty(k);
    const hurt = drain(drain(freshPower(), 1), 1);
    expect(hurt).toEqual({ strength: MECH.strength - 2 * MECH.hitCost });
    expect(freshPower().strength).toBe(MECH.strength);
  });

  it('gets a quarter back from a bronze gear, never more than full', () => {
    expect(MECH.gearMend).toBe(MECH.strength / 4);
    const low = { strength: 10 };
    expect(mend(low)).toEqual({ strength: 10 + MECH.gearMend });
    expect(mend({ strength: MECH.strength - 5 })).toEqual({ strength: MECH.strength });
    // Robots drop gears often enough to matter (at least one time in five).
    expect(MECH.gearChance).toBeGreaterThanOrEqual(0.2);
  });
});

describe('TALOS and the anvil drones', () => {
  it('takes three rounds: three ankle plates and a pull of the plug each', () => {
    expect(TALOS_TUNING.rounds).toBe(3);
    expect(TALOS_TUNING.plates).toBe(3);
    // Every round's numbers exist, and he only gets a little quicker.
    for (const list of [TALOS_TUNING.raise, TALOS_TUNING.stuck, TALOS_TUNING.walkSpeed]) expect(list).toHaveLength(3);
    expect(Math.min(...TALOS_TUNING.raise)).toBeGreaterThanOrEqual(1);
    // Generous windows: time to step out of the circle, walk over and punch three times.
    expect(Math.min(...TALOS_TUNING.stuck)).toBeGreaterThanOrEqual(3 * (MECH.punchTime + MECH.punchCooldown) + 1.5);
    expect(TALOS_TUNING.kneel).toBeGreaterThanOrEqual(6);
  });

  it('only fights the mech: its flames heat an ankle plate off in a second or so, and LUX explains on foot', () => {
    expect(TALOS_TUNING.plateHeat * MECH.flameTick).toBeLessThanOrEqual(1.5);
    expect(TALOS_TUNING.plateHeat * MECH.flameTick).toBeGreaterThanOrEqual(0.8);
    // The "only the mech" reminder comes at most every few seconds.
    expect(TALOS_TUNING.footHint).toBeGreaterThanOrEqual(3);
    expect(LEVELS.forge.legend.F).toMatchObject({ type: 'sign' });
    const sign = LEVELS.forge.legend.F;
    if (sign.type === 'sign') expect(sign.text).toContain('only the mech');
  });

  it('warns before every anvil, and comes down low enough to punch', () => {
    expect(ANVIL_TUNING.warn).toBeGreaterThanOrEqual(1);
    expect(ANVIL_TUNING.low + 1.6).toBeLessThan(MECH.height + 1);
    expect(ANVIL_TUNING.radius).toBeGreaterThan(MECH.radius);
  });
});
