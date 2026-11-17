import { ATALANTA, BRENNUS, CELL, PLAYER } from '../src/core/constants';
import { HERO_IDS, HEROES, heroCan, heroRoster, nextHero, parseHeroes, switchBlock, type SwitchState } from '../src/entities/heroes/heroes';
import { heroCourse } from '../src/entities/heroes/course';
import { LOWGAP_CLEAR } from '../src/entities/heroes/heroProps';
import { LEVELS, LEVEL_ORDER } from '../src/levels';
import { Grid, parseLevel } from '../src/world/grid';
import type { HeroId, LevelDef, Spec } from '../src/world/levelTypes';
import { makeBody, moveBody, type Box } from '../src/world/physics';
import { atalantaReach, brennusReach, jumpReach, reach, wallRunStrips } from '../tools/reach';
import { voiceOf } from '../src/game/companions';

describe('hero table', () => {
  it('describes every hero, keyed by its own id', () => {
    for (const id of HERO_IDS) {
      expect(HEROES[id].id).toBe(id);
      expect(HEROES[id].moves.length).toBeGreaterThan(0);
      expect(HEROES[id].speed).toBeGreaterThan(0);
      expect(HEROES[id].color).toMatch(/^#[0-9a-f]{6}$/);
    }
    // The bronze mech of Talos's Forge is a hero too (a vehicle the others ride inside).
    expect(HERO_IDS).toEqual(['jason', 'atalanta', 'brennus', 'mech']);
  });

  it('makes all three heroes playable', () => {
    expect(HEROES.jason.playable).toBe(true);
    expect(HEROES.atalanta.playable).toBe(true);
    expect(HEROES.brennus.playable).toBe(true);
  });

  it('gives each hero moves of their own', () => {
    for (const m of ['grapple', 'pound', 'weapons', 'doubleJump', 'dash'] as const) {
      expect(heroCan('jason', m)).toBe(true);
      expect(heroCan('atalanta', m)).toBe(false);
    }
    for (const m of ['sprint', 'wallJump', 'wallRun', 'slide', 'bow', 'kick'] as const) {
      expect(heroCan('atalanta', m)).toBe(true);
      expect(heroCan('jason', m)).toBe(false);
    }
    // Brennus: slow and strong, with his own buttons and no jet boots, glider or grapple.
    expect(HEROES.brennus.speed).toBeLessThan(HEROES.jason.speed);
    for (const m of ['cannon', 'shield', 'smash', 'stomp', 'command'] as const) {
      expect(heroCan('brennus', m)).toBe(true);
      expect(heroCan('jason', m)).toBe(false);
    }
    for (const m of ['doubleJump', 'glide', 'grapple', 'dash', 'wallJump'] as const) expect(heroCan('brennus', m)).toBe(false);
    expect(HEROES.brennus.buttons).toEqual({ shoot: 'CANNON', spin: 'SHIELD', dash: 'CHARGE' });
  });

  it('makes Brennus the slow, heavy one: a low jump, but a charge-leap and a cannon that overheats', () => {
    const apex = (v: number) => (v * v) / 64;
    expect(apex(BRENNUS.jumpV)).toBeLessThan(apex(PLAYER.jumpV));
    // He can climb two steps (1 unit) with a jump, but not three.
    expect(apex(BRENNUS.jumpV) - 0.3).toBeGreaterThan(1);
    expect(apex(BRENNUS.jumpV) - 0.3).toBeLessThan(1.5);
    expect(BRENNUS.shieldSpeed).toBeLessThan(BRENNUS.speed);
    expect(BRENNUS.leapSpeed).toBeGreaterThan(BRENNUS.speed);
    expect(BRENNUS.chargeSpeed).toBeGreaterThan(BRENNUS.leapSpeed);
    // A few shells in a row are fine; a long burst (or two big blasts and a shell) overheats.
    expect(BRENNUS.heatShell * 3).toBeLessThan(1);
    expect(BRENNUS.heatShell * 6).toBeGreaterThanOrEqual(1);
    expect(BRENNUS.heatBlast * 2 + BRENNUS.heatShell).toBeGreaterThanOrEqual(1);
    expect(BRENNUS.blastDamage).toBeGreaterThan(BRENNUS.shellDamage);
  });

  it('makes Atalanta the quicker runner with the higher single jump', () => {
    expect(ATALANTA.speed).toBeGreaterThan(PLAYER.speed);
    expect(ATALANTA.sprintSpeed).toBeGreaterThan(ATALANTA.speed);
    expect(ATALANTA.jumpV).toBeGreaterThan(PLAYER.jumpV);
    // But Jason's jet boots still take him higher than her single jump.
    const apex = (v: number) => (v * v) / 64;
    expect(apex(PLAYER.jumpV) + apex(PLAYER.doubleJumpV)).toBeGreaterThan(apex(ATALANTA.jumpV));
    // Her bow outranges his blaster, and a slide fits under a low gap while standing doesn't.
    expect(ATALANTA.arrowRange).toBeGreaterThan(PLAYER.shotRange);
    expect(ATALANTA.crouchHeight).toBeLessThan(LOWGAP_CLEAR);
    expect(PLAYER.height).toBeGreaterThan(LOWGAP_CLEAR);
  });
});

describe('hero roster and switching', () => {
  it('defaults to Jason alone', () => {
    expect(heroRoster()).toEqual(['jason']);
    expect(heroRoster([])).toEqual(['jason']);
  });

  it('uses the level list, dropping unplayable heroes and repeats', () => {
    expect(heroRoster(['atalanta', 'jason'])).toEqual(['atalanta', 'jason']);
    expect(heroRoster(['jason', 'brennus', 'jason'])).toEqual(['jason', 'brennus']);
    expect(heroRoster(['brennus'])).toEqual(['brennus']);
  });

  it('lets the developer hash override the list and the starting hero', () => {
    expect(heroRoster(['jason'], { heroes: ['jason', 'atalanta'] })).toEqual(['jason', 'atalanta']);
    expect(heroRoster(['jason', 'atalanta'], { hero: 'atalanta' })).toEqual(['atalanta', 'jason']);
    expect(heroRoster(undefined, { hero: 'atalanta' })).toEqual(['atalanta', 'jason']);
    expect(parseHeroes('Jason, atalanta,bolt,,')).toEqual(['jason', 'atalanta']);
    expect(parseHeroes(null)).toEqual([]);
  });

  it('cycles through the roster', () => {
    expect(nextHero(['jason'], 'jason')).toBeNull();
    expect(nextHero(['jason', 'atalanta'], 'jason')).toBe('atalanta');
    expect(nextHero(['jason', 'atalanta'], 'atalanta')).toBe('jason');
    const three: HeroId[] = ['jason', 'atalanta', 'brennus'];
    expect(nextHero(three, 'atalanta')).toBe('brennus');
    expect(nextHero(three, 'brennus')).toBe('jason');
  });

  const ok: SwitchState = { roster: ['jason', 'atalanta'], current: 'jason', cooldown: 0, grounded: true, locked: false, busy: false, cramped: false };

  it('switches only on the ground, between moves, with room to stand and after the cooldown', () => {
    expect(switchBlock(ok)).toBeNull();
    expect(switchBlock({ ...ok, roster: ['jason'] })).toBe('alone');
    expect(switchBlock({ ...ok, locked: true })).toBe('locked');
    expect(switchBlock({ ...ok, busy: true })).toBe('busy');
    expect(switchBlock({ ...ok, grounded: false })).toBe('air');
    expect(switchBlock({ ...ok, cramped: true })).toBe('cramped');
    expect(switchBlock({ ...ok, cooldown: 0.2 })).toBe('cooldown');
  });

  it('leaves the first two chapters to Jason, lets Atalanta join on the Harpy Isles, and gives Brennus his own levels', () => {
    for (const id of LEVEL_ORDER.slice(0, 13)) expect(heroRoster(LEVELS[id].heroes)).toEqual(['jason']);
    expect(heroRoster(LEVELS.harpies.heroes)).toEqual(['jason', 'atalanta']);
    // She only joins when Jason meets her by her skiff.
    expect(LEVELS.harpies.joins?.atalanta).toBe('atalanta');
    // General Brennus is never switched with anyone on his own levels; on the Golden Fleece all three play.
    for (const id of LEVEL_ORDER) {
      const roster = heroRoster(LEVELS[id].heroes);
      if (roster.includes('brennus') && id !== 'fleece') expect(roster).toEqual(['brennus']);
    }
    expect(heroRoster(LEVELS.fleece.heroes)).toEqual(['jason', 'atalanta', 'brennus']);
    expect(heroRoster(LEVELS.mine.heroes)).toEqual(['brennus']);
    expect(nextHero(['brennus'], 'brennus')).toBeNull();
  });
});

describe('slide under a low gap', () => {
  // A corridor with a low gap's box over cell 3: its bottom is LOWGAP_CLEAR above the floor.
  const grid = new Grid(7, 1, Array.from({ length: 7 }, () => ({ kind: 'floor' as const, h: 0, dark: false })));
  const gap: Box = { minX: 3 * CELL, maxX: 4 * CELL, minZ: 0, maxZ: CELL, bottom: LOWGAP_CLEAR, top: 60, solid: true, dx: 0, dy: 0, dz: 0 };
  const run = (h: number) => {
    const b = makeBody(CELL * 1.5, 0, CELL / 2, PLAYER.radius, h);
    b.grounded = true;
    for (let i = 0; i < 120; i++) {
      b.vx = 8;
      moveBody(b, 1 / 60, grid, [gap]);
    }
    return b.x;
  };

  it('stops a standing hero and lets a sliding one through', () => {
    expect(run(PLAYER.height)).toBeLessThan(3 * CELL);
    expect(run(ATALANTA.crouchHeight)).toBeGreaterThan(4 * CELL);
  });
});

/** A test level: the map plus a legend, with both heroes unless told otherwise. */
function level(map: string[], legend: Record<string, Spec> = {}, heroes: HeroId[] = ['jason', 'atalanta']) {
  const def: LevelDef = { id: 'plains', index: 13, name: 'test', subtitle: '', music: 'plains', map: `\n${map.join('\n')}\n`, legend, objectives: [], shardIds: [], dialogues: {}, heroes };
  return parseLevel(def);
}
const missingWith = (lv: ReturnType<typeof level>, heroes: HeroId[]) => reach(lv, [], heroes).missing.map((e) => e.spec.type);

describe('reach checker with heroes', () => {
  it('works out jump envelopes for Atalanta', () => {
    // A sprint jump goes farther than a standing one, and farther than Jason's single jump.
    expect(atalantaReach(0, ATALANTA.sprintSpeed, false)).toBeGreaterThan(atalantaReach(0, ATALANTA.speed, false));
    expect(atalantaReach(0, ATALANTA.speed, false)).toBeGreaterThan(jumpReach(0, []));
    // A wall-jump reaches ledges her single jump can't.
    expect(atalantaReach(3.5, ATALANTA.speed, false)).toBe(0);
    expect(atalantaReach(3.5, ATALANTA.speed, true)).toBeGreaterThan(1);
  });

  it('lets only Atalanta crawl through a low gap', () => {
    const lv = level(['#########', '#@..L..C#', '#########'], { L: { type: 'lowgap' }, C: { type: 'checkpoint', id: 'cp' } });
    expect(missingWith(lv, ['jason'])).toEqual(['checkpoint']);
    expect(missingWith(lv, ['atalanta'])).toEqual([]);
    expect(missingWith(lv, ['jason', 'atalanta'])).toEqual([]);
  });

  it('lets her sprint-jump a gap only with a run-up', () => {
    // A four-cell jump (centre to centre) over a three-cell gap.
    const runUp = level(['@....   .C'], { C: { type: 'checkpoint', id: 'cp' } });
    expect(missingWith(runUp, ['jason'])).toEqual(['checkpoint']);
    expect(missingWith(runUp, ['atalanta'])).toEqual([]);
    const noRoom = level(['@', '.   .C'].map((r) => r.padEnd(6, ' ')), { C: { type: 'checkpoint', id: 'cp' } });
    expect(missingWith(noRoom, ['atalanta'])).toEqual(['checkpoint']);
  });

  it('runs along wall-run strips', () => {
    // Eight cells from ledge to ledge, along a stripe on the wall above the gap.
    const lv = level(['WWWWWWWWWWW', '@.       .C', '..       ..'], { W: { type: 'wallrun' }, C: { type: 'checkpoint', id: 'cp' } });
    expect(wallRunStrips(lv)).toContainEqual({ nx: 0, nz: 1, line: 1, from: 0, to: 10 });
    expect(missingWith(lv, ['jason'])).toEqual(['checkpoint']);
    expect(missingWith(lv, ['atalanta'])).toEqual([]);
    // The same gap along a plain wall is too far for her.
    const plain = level(['###########', '@.       .C', '..       ..'], { C: { type: 'checkpoint', id: 'cp' } });
    expect(missingWith(plain, ['atalanta'])).toEqual(['checkpoint']);
  });

  it('needs a clear shot from Atalanta for an arrow target', () => {
    const open = level(['@...          T'], { T: { type: 'target', flag: 'gate' } });
    expect(missingWith(open, ['jason'])).toEqual(['target']);
    expect(missingWith(open, ['jason', 'atalanta'])).toEqual([]);
    const walled = level(['@...    #     T'], { T: { type: 'target', flag: 'gate' } });
    expect(missingWith(walled, ['atalanta'])).toEqual(['target']);
  });

  it('lets the heroes take turns: her crawl, then his double jump', () => {
    // Through the low gap (Atalanta only), then up a ledge too high for her jump with no wall to kick off (Jason's jet boots).
    const lv = level(['####    ', '#@.L..6C', '####    '], { L: { type: 'lowgap' }, C: { type: 'checkpoint', id: 'cp' } });
    const both = reach(lv, ['doubleJump'], ['jason', 'atalanta']).missing.map((e) => e.spec.type);
    expect(both).toEqual([]);
    expect(reach(lv, ['doubleJump'], ['jason']).missing.map((e) => e.spec.type)).toEqual(['checkpoint']);
    expect(reach(lv, ['doubleJump'], ['atalanta']).missing.map((e) => e.spec.type)).toEqual(['checkpoint']);
  });
});

describe('the dev practice course', () => {
  const lv = parseLevel(heroCourse('plains', 'Course', 'plains'));

  it('is all reachable when you can switch, and needs Atalanta', () => {
    expect(reach(lv, []).missing.map((e) => e.id)).toEqual([]);
    expect(reach(lv, [], ['jason']).missing.map((e) => e.spec.type)).toContain('checkpoint');
  });
});

describe('reach checker with General Brennus', () => {
  it('works out his jumps: short on foot, much longer as a charge-leap', () => {
    expect(brennusReach(0, false)).toBeLessThan(jumpReach(0, []));
    expect(brennusReach(0, false)).toBeLessThan(3);
    expect(brennusReach(0, true)).toBeGreaterThanOrEqual(3);
    expect(brennusReach(0, true)).toBeLessThan(4);
    expect(brennusReach(1.5, true)).toBe(0);
  });

  it('crosses a two-cell gap only with a charge-leap, and never a three-cell one', () => {
    const two = level(['@..  .C'], { C: { type: 'checkpoint', id: 'cp' } }, ['brennus']);
    expect(missingWith(two, ['brennus'])).toEqual([]);
    const three = level(['@..   .C'], { C: { type: 'checkpoint', id: 'cp' } }, ['brennus']);
    expect(missingWith(three, ['brennus'])).toEqual(['checkpoint']);
  });

  it('climbs two steps with a jump, not three', () => {
    const two = level(['@.2C'], { C: { type: 'checkpoint', id: 'cp', h: 1 } }, ['brennus']);
    expect(missingWith(two, ['brennus'])).toEqual([]);
    const three = level(['@.3C'], { C: { type: 'checkpoint', id: 'cp', h: 1.5 } }, ['brennus']);
    expect(missingWith(three, ['brennus'])).toEqual(['checkpoint']);
  });

  it('lets only him smash through a cracked wall', () => {
    const lv = level(['#########', '#@..%..C#', '#########'], { '%': { type: 'cracked' }, C: { type: 'checkpoint', id: 'cp' } }, ['brennus']);
    expect(missingWith(lv, ['brennus'])).toEqual([]);
    expect(missingWith(lv, ['jason'])).toEqual(['checkpoint']);
    expect(missingWith(lv, ['atalanta'])).toEqual(['checkpoint']);
  });

  it('has him say the lines LUX would (signs and hints) on his own levels', () => {
    const alone = { lead: null, tag: null };
    expect(voiceOf('bolt', alone, true, 'brennus')).toBe('brennus');
    expect(voiceOf('bolt', alone, false, 'brennus')).toBe('brennus');
    expect(voiceOf('bolt', alone, true)).toBe('halcyon');
    expect(voiceOf('aeetes', alone, false, 'brennus')).toBe('aeetes');
  });
});

describe('Aeëtes’s Mine (General Brennus’s level)', () => {
  const lv = parseLevel(LEVELS.mine);
  const specs = lv.entities.map((e) => e.spec);

  it('is his alone, and Jason could not get through it', () => {
    expect(LEVELS.mine.heroes).toEqual(['brennus']);
    expect(reach(lv, []).missing.map((e) => e.id)).toEqual([]);
    expect(reach(lv, ['doubleJump', 'dash', 'glide', 'pulse', 'grapple'], ['jason']).missing.map((e) => e.spec.type)).toContain('boss');
  });

  it('builds its puzzles on his moves: cracked walls, plates, posts, haulers and a fight post', () => {
    expect(specs.filter((s) => s.type === 'cracked').length).toBeGreaterThan(0);
    const posts = specs.flatMap((s) => (s.type === 'post' ? [s] : []));
    expect(posts.map((p) => p.order).sort()).toEqual(['carry', 'fight', 'plate']);
    for (const p of posts) {
      if (p.order === 'plate') {
        expect(specs.some((s) => s.type === 'legionbot' && s.flag === p.flag)).toBe(true);
        expect(specs.some((s) => s.type === 'plate')).toBe(true);
      }
      if (p.order === 'carry') expect(specs.some((s) => s.type === 'platform' && s.look === 'hauler' && s.needs && 'flag' in s.needs && s.needs.flag === p.flag)).toBe(true);
      if (p.order === 'fight') expect(specs.filter((s) => s.type === 'enemy' && s.room === p.room && s.variant === 'gold').length).toBeGreaterThan(2);
    }
    // The heavy plate's gate opens on the plate's flag.
    const plate = specs.find((s) => s.type === 'plate');
    expect(specs.some((s) => s.type === 'door' && plate?.type === 'plate' && 'flag' in s.open && s.open.flag === plate.flag)).toBe(true);
  });

  it('needs a charge-leap to get into the mine', () => {
    // Without the leap (his walking jump only), the hall past the gap is out of reach.
    const hall = lv.entities.find((e) => e.id === 'mine.cp1');
    expect(hall).toBeDefined();
    expect(brennusReach(0, false)).toBeLessThan(3);
  });

  it('ends with the Gold Excavator and an exit to the lifeboat', () => {
    expect(LEVELS.mine.boss).toBe('excavator');
    expect(LEVELS.mine.dialogues.command?.length).toBeGreaterThan(0);
    expect(LEVELS.mine.stories?.opening?.[0].panel).toBe('ch3-brennus');
    expect(LEVELS.mine.stories?.map?.[0].panel).toBe('ch3-map');
  });
});
