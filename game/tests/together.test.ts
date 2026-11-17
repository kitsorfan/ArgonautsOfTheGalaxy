import * as THREE from 'three';

import { CELL, HERO_SWITCH, STEP_H } from '../src/core/constants';
import { newSave } from '../src/core/save';
import { Follower } from '../src/entities/heroes/follower';
import { canCopy, type TrailMove } from '../src/entities/heroes/heroes';
import { LOWGAP_CLEAR } from '../src/entities/heroes/heroProps';
import type { HeroModel } from '../src/entities/models';
import type { Player } from '../src/entities/player';
import type { World } from '../src/game/world';
import { LEVELS, LEVEL_ORDER } from '../src/levels';
import { Grid, parseLevel } from '../src/world/grid';
import type { HeroId, Spec } from '../src/world/levelTypes';
import { makeBody, type Box } from '../src/world/physics';
import { togetherCheck } from '../tools/reach';

// The follower's "..." bubble draws itself on a canvas: a canvas that draws nothing is enough here.
const g = globalThis as unknown as { document?: unknown };
g.document ??= { createElement: () => ({ getContext: () => new Proxy({}, { get: () => () => undefined }) }) };

const at = (c: number) => c * CELL + CELL / 2;

/** A grid from rows of '.' (floor), '#' (wall) and digits (floor that many steps high). */
function grid(rows: string[]): Grid {
  const width = Math.max(...rows.map((r) => r.length));
  const cells = rows.flatMap((r) =>
    Array.from({ length: width }, (_, x) => {
      const ch = r[x] ?? '#';
      return ch === '#' ? { kind: 'wall' as const, h: 0, dark: false } : { kind: 'floor' as const, h: ch === '.' ? 0 : Number(ch) * STEP_H, dark: false };
    }),
  );
  return new Grid(width, rows.length, cells);
}

/** A hero model with just the joints the follower poses (the last child of the root is its shadow). */
function model(): HeroModel {
  const root = new THREE.Group();
  const parts = { body: new THREE.Group(), legL: new THREE.Group(), legR: new THREE.Group(), armL: new THREE.Group(), armR: new THREE.Group() };
  root.add(parts.body, new THREE.Mesh());
  return { root, ...parts } as unknown as HeroModel;
}

/** Just enough of a World and a playing hero for a follower to walk after. */
function setup(rows: string[], follower: HeroId, leader: HeroId, boxes: Box[] = []) {
  const world = { scene: new THREE.Scene(), grid: grid(rows), boxes, save: newSave(), particles: { emit: () => undefined }, cutscene: false };
  world.save.abilities = ['doubleJump', 'dash', 'glide', 'pulse', 'grapple'];
  const body = makeBody(at(1), 0, at(0), 0.42, 1.7);
  body.grounded = true;
  const lead = {
    body,
    hero: leader,
    landSeq: 0,
    landMoves: new Set<TrailMove>(),
    ata: { crawling: false },
    vx: 0,
    vz: 0,
    facing: Math.PI / 2,
    down: false,
    busyHelping: false,
    stoneLeft: () => 0,
    lendHand: jest.fn((f: Follower | null) => {
      lead.busyHelping = f !== null;
    }),
  };
  const f = new Follower(world as unknown as World, model(), follower);
  f.place(at(0), 0, at(0), Math.PI / 2);
  const p = lead as unknown as Player;
  const step = (seconds: number, move?: () => void) => {
    for (let t = 0; t < seconds; t += 1 / 60) {
      move?.();
      f.update(1 / 60, p);
    }
  };
  /** The leader walks east along row 0 to cell `cx`, crawling where `crawl` says, at a run. */
  const walkTo = (cx: number, crawl: (x: number) => boolean = () => false, frame?: () => void) => {
    while (body.x < at(cx)) {
      body.x = Math.min(at(cx), body.x + 7 / 60);
      lead.ata.crawling = crawl(body.x);
      f.update(1 / 60, p);
      frame?.();
    }
    lead.ata.crawling = false;
  };
  return { world, lead, f, body, step, walkTo };
}

describe('which moves a follower can copy', () => {
  it('lets each hero copy only their own special moves', () => {
    expect(canCopy('jason', ['crawl'])).toBe(false);
    expect(canCopy('jason', ['climb'])).toBe(false);
    expect(canCopy('jason', ['wallrun'])).toBe(false);
    expect(canCopy('atalanta', ['crawl', 'climb', 'walljump'])).toBe(true);
    expect(canCopy('atalanta', ['grapple'])).toBe(false);
    expect(canCopy('atalanta', ['double'])).toBe(false);
    expect(canCopy('brennus', ['leap'])).toBe(true);
    expect(canCopy('jason', ['leap'])).toBe(false);
  });

  it('lets anyone ride a bounce pad or an updraft', () => {
    for (const h of ['jason', 'atalanta', 'brennus'] as HeroId[]) expect(canCopy(h, ['launch'])).toBe(true);
  });

  it('needs Jason to have found the ability before he copies it', () => {
    expect(canCopy('jason', ['double'], (m) => m !== 'doubleJump')).toBe(false);
    expect(canCopy('jason', ['double'])).toBe(true);
  });
});

describe('the follower', () => {
  it('walks along behind the leader, never teleporting', () => {
    const { f, step, walkTo } = setup(['..............'], 'atalanta', 'jason');
    let jumps = 0;
    let last = f.spot.x;
    const watch = () => {
      if (Math.abs(f.spot.x - last) > 1) jumps++;
      last = f.spot.x;
    };
    walkTo(12, undefined, watch);
    step(2, watch);
    expect(jumps).toBe(0);
    expect(f.spot.x).toBeGreaterThan(at(9));
    expect(f.waiting).toBe(false);
  });

  // A corridor with a low gap over cell 5: Atalanta crawls through, Jason can't.
  const gap: Box = { minX: 5 * CELL, maxX: 6 * CELL, minZ: 0, maxZ: CELL, bottom: LOWGAP_CLEAR, top: 60, solid: true, dx: 0, dy: 0, dz: 0 };

  it('waits at a low gap it can’t crawl through', () => {
    const { f, step, walkTo } = setup(['..............'], 'jason', 'atalanta', [gap]);
    walkTo(10, (x) => x > 4.6 * CELL && x < 6.4 * CELL);
    step(3);
    expect(f.waiting).toBe(true);
    expect(f.spot.x).toBeLessThan(5 * CELL);
  });

  it('follows a crawling Atalanta through it if it is Atalanta too', () => {
    const { f, step, walkTo } = setup(['..............'], 'atalanta', 'atalanta', [gap]);
    walkTo(10, (x) => x > 4.6 * CELL && x < 6.4 * CELL);
    step(4);
    expect(f.waiting).toBe(false);
    expect(f.spot.x).toBeGreaterThan(6 * CELL);
  });

  it('finds the way round once the leader opens it', () => {
    // Two corridors: the low gap along row 0, and a door across row 2.
    const door: Box = { minX: 5 * CELL, maxX: 6 * CELL, minZ: 2 * CELL, maxZ: 3 * CELL, bottom: 0, top: 4, solid: true, dx: 0, dy: 0, dz: 0 };
    const boxes = [gap, door];
    const { f, step, walkTo } = setup(['..............', '.....#........', '..............'], 'jason', 'atalanta', boxes);
    walkTo(10, (x) => x > 4.6 * CELL && x < 6.4 * CELL);
    step(2);
    expect(f.waiting).toBe(true);
    // The leader hits the switch: the door opens.
    boxes.splice(boxes.indexOf(door), 1);
    step(6);
    expect(f.waiting).toBe(false);
    expect(Math.abs(f.spot.x - at(10))).toBeLessThan(HERO_SWITCH.followDist + 1.5);
  });

  it('gets pulled up a cliff by a leader standing at the top', () => {
    // A cliff (8 steps high) from cell 3 on.
    const { f, lead, body, step, walkTo } = setup(['...8888888'], 'jason', 'atalanta');
    walkTo(2);
    // Atalanta climbs up and stands at the lip, right above Jason.
    body.x = at(3) - 0.3;
    body.y = 8 * STEP_H;
    lead.landSeq++;
    lead.landMoves = new Set(['climb']);
    step(0.3);
    lead.landMoves = new Set();
    step(5);
    expect(lead.lendHand).toHaveBeenCalled();
    expect(lead.busyHelping).toBe(false);
    expect(f.spot.y).toBeCloseTo(8 * STEP_H, 1);
    expect(f.waiting).toBe(false);
  });

  it('grabs on when Jason grapples close by, and zips along', () => {
    const { f, body, lead, step } = setup(['..............'], 'atalanta', 'jason');
    body.x = at(1);
    const to = new THREE.Vector3(at(11), 0, at(0));
    f.tandem(to, to.clone().add(new THREE.Vector3(0, 2.5, 0)), 0.5, lead as unknown as Player);
    expect(f.busy).toBe(true);
    // Jason zips over too.
    body.x = to.x;
    step(0.7);
    expect(f.busy).toBe(false);
    expect(Math.abs(f.spot.x - at(11))).toBeLessThan(1.5);
  });
});

describe('travelling together through the levels', () => {
  it('never leaves a hero behind for good, on any level', () => {
    for (const id of LEVEL_ORDER) {
      const level = parseLevel(LEVELS[id]);
      const all = ['doubleJump', 'dash', 'glide', 'pulse', 'grapple', 'mirror'] as const;
      expect([id, togetherCheck(level, [...all])]).toEqual([id, []]);
    }
  });

  /** A test level with both heroes. */
  const level = (map: string[], legend: Record<string, Spec> = {}) =>
    parseLevel({ id: 'plains', index: 13, name: 'test', subtitle: '', music: 'plains', map: `\n${map.join('\n')}\n`, legend, objectives: [], shardIds: [], dialogues: {}, heroes: ['jason', 'atalanta'] });

  it('spots a crawl hole with no way round for the other hero', () => {
    const lv = level(['@...l...E'], { l: { type: 'lowgap', axis: 'x' }, E: { type: 'exit' } });
    expect(togetherCheck(lv, []).map((p) => `${p.hero} ${p.why} ${p.what}`)).toEqual(['jason apart exit']);
  });

  it('lets Atalanta climb a cliff and help Jason up after her', () => {
    const lv = level(['@...&999E'], { '&': { type: 'climb', h: 4.5 }, E: { type: 'exit' } });
    expect(togetherCheck(lv, [])).toEqual([]);
  });
});
