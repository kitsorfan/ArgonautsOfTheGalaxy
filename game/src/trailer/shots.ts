import * as THREE from 'three';

import { PlanetScene } from '../cinema/planetScene';
import { CELL } from '../core/constants';
import type { World } from '../game/world';
import type { DeckId, HeroId } from '../world/levelTypes';
import type { Card } from './cards';
import { follow, glide, mix, orbit, watch, type Move, type Subject } from './moves';
import type { DeckSet, StageKind, Take } from './stage';

/**
 * The trailer, shot by shot, and the words that go with it.
 *
 * Everything is measured in bars of the music (see cut.ts). The first eleven bars are quiet, and tell
 * the story a chapter at a time: the colony ship, Gaia Nova, the Argo. The drums come in on bar 11 with
 * the logo, over the Argo threading the Clashing Rocks, and from there it is a boss a bar, spelling out
 * the game's own tagline as it goes, with the biggest three on the music's big hits (20, 24 and 28).
 *
 * A shot sets its level or stage up the way it wants it, from a clean slate, and then either flies its
 * own camera or leaves the lens to the game.
 */

export interface Shot {
  /** Names it in the recorder's log and on its stills. */
  id: string;
  /** How long it holds, in bars of the music. */
  bars: number;
  /** What it is filmed on: a level, or one of the cinematic stages. */
  set: DeckSet | StageKind;
  /** Puts the level or stage in order for it, once, before the lead. */
  setup?: (k: Take) => void;
  /** Seconds the set runs before the shot is recorded, so it opens on something already moving. */
  lead?: number;
  /** A move of the director's, or nothing to leave the lens to the game. */
  camera?: Move;
  /** What the camera keeps in shot, when it is not the hero. */
  subject?: (k: Take) => Subject;
  /** Every frame: seconds into the shot (negative through the lead). */
  act?: (time: number, k: Take) => void;
}

/* ------------------------------- staging ------------------------------- */

const ground = (w: World, x: number, z: number) => w.grid.cell(Math.floor(x / CELL), Math.floor(z / CELL)).h;

/** Puts the hero on a spot, facing a point, with the game's camera straight behind. */
function place(w: World, x: number, z: number, face: [number, number]) {
  w.player.teleport(x, ground(w, x, z) + 0.05, z);
  w.player.facing = Math.atan2(face[0] - x, face[1] - z);
  w.snapCamera();
}

/** True on the frames a repeating beat of `every` seconds falls on (starting at `at`). */
const every = (time: number, period: number, at = 0) => Math.floor((time - at) / period) !== Math.floor((time - at - 1 / 60) / period);

/** The boss, as something a camera can follow. */
const boss = (k: Take): Subject => {
  const b = k.world.boss;
  const p = b ? b.where : new THREE.Vector3();
  return { x: p.x, y: p.y, z: p.z, facing: 0 };
};

/** The vehicle on a flight or a dive level. */
const craft = (k: Take): Subject => {
  const v = k.world.vehicle;
  return v ? { x: v.pos.x, y: v.pos.y, z: v.pos.z, facing: Math.PI } : { x: 0, y: 0, z: 0, facing: 0 };
};

type Fighting = 'blast' | 'flame' | 'hold';

/**
 * A boss fight already under way. The hero stands at `at`, turned to the boss, and fights: taps BLAST
 * (or keeps the flamethrower going), and hops now and then. The boss is woken up without its entrance,
 * so it is at full tilt by the time the shot rolls.
 */
function fight(o: {
  id: string;
  bars: number;
  deck: DeckId;
  hero?: HeroId;
  heroes?: HeroId[];
  at: [number, number];
  camera: Move;
  subject?: (k: Take) => Subject;
  lead?: number;
  fighting?: Fighting;
  setup?: (k: Take) => void;
}): Shot {
  return {
    id: o.id,
    bars: o.bars,
    set: { deck: o.deck, hero: o.hero, heroes: o.heroes ?? (o.hero ? [o.hero] : undefined) },
    lead: o.lead ?? 1.4,
    camera: o.camera,
    subject: o.subject,
    setup: (k) => {
      const w = k.world;
      const b = w.boss;
      const c = b ? b.where : new THREE.Vector3(o.at[0], 0, o.at[1] - 10);
      place(w, o.at[0], o.at[1], [c.x, c.z]);
      o.setup?.(k);
      b?.engage();
    },
    act: (time, k) => {
      const w = k.world;
      const b = w.boss;
      const p = w.player;
      if (b) p.facing = Math.atan2(b.where.x - p.body.x, b.where.z - p.body.z);
      const how = o.fighting ?? 'blast';
      if (how === 'flame') k.hold('shoot');
      else if (how === 'blast' && every(time, 0.32)) k.tap('shoot');
      if (how !== 'hold' && every(time, 2.3, 0.9)) k.tap('jump');
    },
  };
}

/* -------------------------------- the cut ------------------------------ */

const FILM: Shot[] = [
  /* ---- Chapter 1: the colony ship ---- */
  {
    // The Syracusia, overgrown with pink vines, sliding past against the star it is falling towards.
    id: 'syracusia',
    bars: 2,
    set: 'ship',
    lead: 0.2,
    setup: (k) => {
      k.ship.setChapter(0);
      k.ship.setStar(1300);
      k.ship.ship.setGrowth(0.85);
      k.ship.ship.group.rotation.y = -0.25;
    },
    camera: glide({ from: { position: [-110, 16, 64], target: [-30, 2, 0] }, to: { position: [-44, 10, 46], target: [14, 2, 0] }, fov: 40, softness: 0.2 }),
  },
  {
    // Inside, in the Cryo Deck, one sleeper wakes: Jason, crouched in the cold mist, gets up and looks round.
    id: 'wake',
    bars: 2,
    set: { deck: 'cryo' },
    lead: 0.3,
    setup: (k) => {
      const p = k.world.player;
      k.memo.spot = { x: p.body.x, y: p.body.y, z: p.body.z, facing: p.facing };
      k.memo.crouch = 1;
      k.memo.look = 0;
      p.pose = (m) => {
        const c = k.memo.crouch as number;
        m.body.position.y = -0.38 * c;
        m.body.rotation.x = 0.4 * c;
        m.head.rotation.x = 0.25 * c;
        m.head.rotation.y = k.memo.look as number;
        m.armL.rotation.set(-1.1 * c, 0, -0.4 * c);
        m.armR.rotation.set(-1.1 * c, 0, 0.4 * c);
        m.legL.rotation.x = -0.9 * c;
        m.legR.rotation.x = -0.9 * c;
      };
    },
    act: (time, k) => {
      const e = (x: number) => 1 - (1 - Math.max(0, Math.min(1, x))) ** 3;
      k.memo.crouch = 1 - e((time - 0.7) / 0.9);
      k.memo.look = time < 1.7 ? 0 : 0.7 * Math.sin((time - 1.7) * 2.6);
      const { x, y, z } = k.memo.spot as Subject;
      const a = Math.random() * Math.PI * 2;
      if (Math.random() < 0.5) k.world.particles.emit(x + Math.cos(a) * 1.6, y + 0.1, z + Math.sin(a) * 1.6, { count: 1, color: '#9fb8c8', speed: 0.6, up: 1.6, life: 1.2, size: 0.8, gravity: -0.3, drag: 1 });
    },
    // Off the spot he wakes on, in front of him and a little to one side, pushing in as he gets up.
    subject: (k) => k.memo.spot as Subject,
    camera: follow({ distance: [4.9, 3.7], height: [0.85, 1.1], angle: [0.37, 0.29], relative: true, aim: [0.8, 1.0], fov: 44 }),
  },
  /* ---- Chapter 2: Gaia Nova ---- */
  {
    // The shuttle comes down through the clouds towards the plains.
    id: 'descent',
    bars: 2,
    set: 'planet',
    lead: 0.2,
    setup: (k) => {
      const land = PlanetScene.region('plains', 6);
      const high = land.clone().add(new THREE.Vector3(-320, 420, 160));
      k.memo.land = land;
      k.memo.high = high;
      k.planet.aim(k.planet.shuttle, high, land);
    },
    act: (time, k) => {
      const land = k.memo.land as THREE.Vector3;
      const high = k.memo.high as THREE.Vector3;
      const s = k.planet.shuttle;
      const e = 0.6 + Math.max(0, time) * 0.095;
      s.position.lerpVectors(high, land, e);
      s.rotation.z = -0.35 * (1 - e);
      if (Math.random() < 0.7) k.planet.particles.emit(s.position.x - 3, s.position.y, s.position.z, { count: 1, color: '#ffffff', speed: 1, life: 1.2, size: 4, gravity: 0 });
    },
    subject: (k) => ({ ...k.planet.shuttle.position, facing: 0 }),
    camera: (t, s) => ({ position: [s.x - 15 + t * 4, s.y + 6 + t * 2, s.z + 19 - t * 4], target: [s.x + 7, s.y - 5, s.z - 2], fov: 46 }),
  },
  {
    // The jungle region: a slow crane down over the Hydra's pond.
    id: 'jungle',
    bars: 2,
    set: { deck: 'jungle' },
    lead: 1.5,
    setup: (k) => {
      place(k.world, 48.6, 41, [51, 31]);
      k.world.boss?.engage();
    },
    act: (time, k) => {
      if (every(time, 0.4)) k.tap('shoot');
    },
    camera: orbit({ center: [50, 1, 34], radius: [24, 17], height: [13, 6.5], from: -0.75, to: -0.35, aim: [1, 2.2], fov: 44 }),
  },
  /* ---- Chapter 3: the Argonauts ---- */
  {
    // The Argo rows out past the ringed giant.
    id: 'argo',
    bars: 2,
    set: 'moon',
    lead: 0.4,
    setup: (k) => {
      k.moon.thrust = 0.75;
      k.moon.argo.root.rotation.set(0, 0.25, 0);
    },
    act: (time, k) => k.moon.argo.root.position.set(0, 0, -(time + 0.4) * 9),
    subject: (k) => ({ ...k.moon.argo.root.position, facing: 0 }),
    camera: (t, s) => ({ position: [s.x + mix(-17, 9, t), s.y + mix(5, 3.5, t), s.z + mix(19, 13, t)], target: [s.x + mix(0, -4, t), s.y + 1, s.z - 5], fov: 46 }),
  },
  {
    // And out of the dark, Aeëtes's golden fleet.
    id: 'fleet',
    bars: 1,
    set: 'moon',
    lead: 0.2,
    setup: (k) => {
      k.memo.ships = k.moon.fleet.map((f, i) => {
        f.visible = true;
        f.rotation.y = -0.9;
        const end = new THREE.Vector3(70 + i * 55, -10 + i * 22, -170 - i * 70);
        return { f, end, start: end.clone().add(new THREE.Vector3(260, 40, 120)) };
      });
    },
    act: (time, k) => {
      const e = 0.35 + Math.max(0, time) * 0.2;
      for (const s of k.memo.ships as { f: THREE.Group; start: THREE.Vector3; end: THREE.Vector3 }[]) s.f.position.lerpVectors(s.start, s.end, 1 - (1 - e) ** 2);
    },
    camera: glide({ from: { position: [-30, 14, 30], target: [120, 18, -200] }, to: { position: [-26, 12, 24], target: [100, 10, -210] }, fov: 44 }),
  },
  /* ---- The drop ---- */
  {
    // The drums come in, and the logo with them: the Argo through the Clashing Rocks.
    id: 'rocks',
    bars: 2,
    set: { deck: 'rocks' },
    lead: 1,
    setup: (k) => k.world.vehicle?.skipTo?.(330),
    subject: craft,
    camera: (t, s) => ({ position: [s.x + mix(6.5, 4.5, t), s.y + mix(1.6, 2.4, t), s.z + mix(-10, -8, t)], target: [s.x, s.y + 0.8, s.z + 2], fov: 50 }),
  },
  // Three chapters...
  fight({
    id: 'golem',
    bars: 1,
    deck: 'engine',
    at: [31, 31],
    camera: glide({ from: { position: [35.5, 0.9, 34.5], target: [31, 2.2, 23] }, to: { position: [34.6, 1.1, 33], target: [31, 2.4, 23] }, fov: 46 }),
  }),
  fight({
    id: 'boreas',
    bars: 1,
    deck: 'snow',
    at: [50.9, 36],
    camera: orbit({ center: [49.8, 0, 31], radius: 12.5, height: [2.4, 3.2], from: 1.05, to: 0.75, aim: 2.4, fov: 46 }),
  }),
  // ...three heroes...
  fight({
    id: 'aello',
    bars: 1,
    deck: 'harpies',
    hero: 'atalanta',
    heroes: ['atalanta', 'jason'],
    at: [34, 25.5],
    camera: orbit({ center: [33.5, 3, 21], radius: 10, height: [1.2, 1.8], from: -0.75, to: -0.45, aim: 3.2, fov: 48 }),
  }),
  fight({
    id: 'excavator',
    bars: 1,
    deck: 'mine',
    hero: 'brennus',
    at: [51, 31.5],
    camera: orbit({ center: [51, 2, 27], radius: 11, height: [2.6, 3.4], from: 0.95, to: 0.65, aim: 1.6, fov: 46 }),
  }),
  fight({
    id: 'mech',
    bars: 1,
    deck: 'forge',
    hero: 'mech',
    at: [43, 35],
    fighting: 'flame',
    camera: glide({ from: { position: [47.5, 3.2, 41.5], target: [43, 6.5, 24] }, to: { position: [46.2, 3.6, 40], target: [43, 7.5, 24] }, fov: 48 }),
  }),
  {
    id: 'dolphin',
    bars: 1,
    set: { deck: 'sirens' },
    lead: 1,
    setup: (k) => k.world.vehicle?.skipTo?.(260),
    act: (time, k) => {
      if (every(time, 0.3)) k.tap('shoot');
    },
    subject: craft,
    camera: (t, s) => ({ position: [s.x + mix(-5.5, -4, t), s.y + mix(1.2, 1.8, t), s.z + mix(-7, -6, t)], target: [s.x, s.y + 0.3, s.z + 1], fov: 52 }),
  },
  fight({
    id: 'scylla',
    bars: 1,
    deck: 'reef',
    at: [53, 19],
    camera: orbit({ center: [53, 3, 13], radius: 14, height: [4.5, 3.5], from: 0.85, to: 0.55, aim: 3, fov: 46 }),
  }),
  /* ---- The big three, on the music's hits ---- */
  fight({
    id: 'medusa',
    bars: 2,
    deck: 'labyrinth',
    hero: 'atalanta',
    heroes: ['atalanta', 'jason'],
    at: [47, 18],
    lead: 1.8,
    camera: orbit({ center: [47, 0, 12], radius: [7.5, 13], height: [2.2, 4.4], from: -0.55, to: -0.2, aim: [3.2, 2.2], fov: 46 }),
  }),
  fight({
    id: 'colossus',
    bars: 1,
    deck: 'volcano',
    at: [47, 37],
    camera: glide({ from: { position: [50.5, 5.4, 43], target: [47, 10, 23] }, to: { position: [49.6, 5.8, 41.5], target: [47, 11, 23] }, fov: 50 }),
  }),
  fight({
    id: 'heart',
    bars: 1,
    deck: 'bridge',
    at: [35, 28.5],
    camera: orbit({ center: [35, 4.5, 23], radius: 12, height: [2.5, 3.5], from: 0.6, to: 0.3, aim: 2.4, fov: 46 }),
  }),
  fight({
    id: 'ram',
    bars: 2,
    deck: 'stand',
    hero: 'brennus',
    at: [45, 37],
    lead: 1.6,
    camera: orbit({ center: [45, 0, 31], radius: [15, 11.5], height: [2.4, 2], from: 1.0, to: 0.45, aim: 1.8, fov: 46 }),
  }),
  fight({
    id: 'dragon',
    bars: 1,
    deck: 'garden',
    hero: 'atalanta',
    heroes: ['atalanta', 'jason'],
    at: [49, 38.5],
    camera: orbit({ center: [49, 0, 32], radius: 14, height: [3.5, 4.5], from: -0.85, to: -0.55, aim: 3.5, fov: 46 }),
  }),
  fight({
    id: 'talos',
    bars: 1,
    deck: 'forge',
    at: [42, 33],
    subject: boss,
    camera: watch({ from: [47.5, 2.4, 37], to: [47, 2.6, 35.8], aim: [6.2, 6.8], fov: 50 }),
  }),
  fight({
    id: 'king',
    bars: 2,
    deck: 'fleece',
    at: [51, 28.5],
    lead: 2,
    subject: boss,
    camera: watch({ from: [44.2, 1.5, 26.2], to: [45.4, 1.7, 25], aim: [2.3, 2.6], fov: 42 }),
  }),
  /* ---- ...and one very nervous robot ---- */
  {
    // On the title screen's balcony, under the colony ship: the camera then pulls back for the end card.
    id: 'lux',
    bars: 2,
    set: 'title',
    lead: 0.5,
    camera: glide({ from: { position: [2.2, 2.25, 3.3], target: [1.1, 2.0, 0.6] }, to: { position: [1.75, 2.15, 2.55], target: [1.1, 2.02, 0.6] }, fov: 40, softness: 0.3 }),
  },
  /* ---- The end card ---- */
  {
    id: 'end',
    bars: 3,
    set: 'title',
    lead: 0.5,
    camera: glide({ from: { position: [3.4, 2.3, 9.4], target: [3.6, 2.4, 0] }, to: { position: [3.1, 2.15, 8.6], target: [3.4, 2.3, 0] }, fov: 45, softness: 0.6 }),
  },
];

export const SHOTS: Shot[] = FILM;

export const CARDS: Card[] = [
      { id: 'ch1', kind: 'caption', from: 0.2, to: 1.85, kicker: { en: 'CHAPTER 1 · THE COLONY SHIP', el: 'ΚΕΦΑΛΑΙΟ 1 · ΤΟ ΔΙΑΣΤΗΜΟΠΛΟΙΟ' }, text: { en: 'Wake up among the stars.', el: 'Ξύπνα ανάμεσα στα αστέρια.' } },
      { id: 'ch2', kind: 'caption', from: 4.2, to: 5.85, kicker: { en: 'CHAPTER 2 · GAIA NOVA', el: 'ΚΕΦΑΛΑΙΟ 2 · ΓΑΙΑ ΝΟΒΑ' }, text: { en: 'Explore a wild new world.', el: 'Εξερεύνησε έναν άγριο νέο κόσμο.' } },
      { id: 'ch3', kind: 'caption', from: 8.2, to: 9.85, kicker: { en: 'CHAPTER 3 · THE ARGONAUTS', el: 'ΚΕΦΑΛΑΙΟ 3 · ΟΙ ΑΡΓΟΝΑΥΤΕΣ' }, text: { en: 'Sail for the Golden Fleece.', el: 'Σάλπαρε για το Χρυσόμαλλο Δέρας.' } },
      { id: 'title', kind: 'title', from: 11, to: 12.9 },
      { id: 'chapters', kind: 'caption', from: 13.05, to: 14.92, text: { en: 'Three chapters.', el: 'Τρία κεφάλαια.' } },
      { id: 'heroes', kind: 'caption', from: 15.05, to: 16.92, text: { en: 'Three heroes.', el: 'Τρεις ήρωες.' } },
      { id: 'robot', kind: 'caption', from: 30.15, to: 31.92, text: { en: 'One very nervous robot.', el: 'Ένα πολύ αγχωμένο ρομπότ.' } },
      { id: 'end', kind: 'end', from: 32.1, to: 35, kicker: { en: 'COMING SOON TO ANDROID', el: 'ΣΥΝΤΟΜΑ ΣΤΟ ANDROID' } },
    ];
