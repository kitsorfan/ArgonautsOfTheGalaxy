import type * as THREE from 'three';

import type { ButtonName } from '../core/input';
import { BADGES } from '../entities/badges';
import type { MoonScene } from '../cinema/moonScene';
import type { PlanetScene } from '../cinema/planetScene';
import type { ShipScene } from '../cinema/shipScene';
import type { TitleScene } from '../game/title';
import type { World } from '../game/world';
import { Cards } from './cards';
import { FPS, MUSIC, barFrame, layout, presence } from './cut';
import type { Pose, Subject } from './moves';
import { CARDS, SHOTS, type Shot } from './shots';
import type { Tally, Take, TrailerHost } from './stage';

/** Seconds of title screen before the first shot, while fonts load and shaders compile. */
const WARMUP = 1;

/** Seconds a shot runs unrecorded before its first frame, unless it says, so it opens on something already moving. */
const LEAD = 0.75;

/** Frames the trailer fades up out of black, and back down into it. */
const FADE_UP = 30;
const FADE_DOWN = 50;

/** Frames a card takes to come up, and to go. */
const RISE = 14;
const FALL = 12;

const SLOTS = layout(SHOTS.map((s) => s.bars));
const TOTAL = SLOTS[SLOTS.length - 1].to;
const CARD_SLOTS = CARDS.map((card) => ({ id: card.id, slot: { from: barFrame(card.from), to: barFrame(card.to) } }));

/**
 * Runs the trailer: shot after shot, each one set up from a clean slate, given a moment to get going,
 * and then rolled for exactly its length in bars.
 *
 * The game calls `frame` once a frame after reading its input (so the buttons a shot presses count that
 * very frame) and `aim` just before it draws, after everything on screen has moved, so a camera that
 * tracks a running hero is aimed at where he is rather than where he was a frame ago.
 */
export class Trailer {
  private shot = -1;
  /** Frames into the current shot: negative through its lead. */
  private n = 0;
  private warm = 0;
  private due = true;
  /** Buttons the shot held down last frame, and the ones it has pressed this frame. */
  private held = new Set<ButtonName>();
  private pressing = new Set<ButtonName>();
  private world: World | null = null;
  private scene: ShipScene | PlanetScene | MoonScene | TitleScene | null = null;
  private memo: Record<string, unknown> = {};
  private cards: Cards;
  readonly tally: Tally = {
    phase: 'warmup',
    take: false,
    frame: 0,
    total: TOTAL,
    shot: '',
    shots: SHOTS.map((s, i) => ({ id: s.id, ...SLOTS[i] })),
    music: { ...MUSIC },
  };

  constructor(private host: TrailerHost) {
    this.cards = new Cards(CARDS);
    document.body.classList.add('trailer');
    // The fights play without the enemies' floating icons and health bars.
    BADGES.hidden = true;
    window.__trailer = this.tally;
    host.stage('title');
  }

  private take(): Take {
    const self = this;
    const need = <T>(what: T | null, name: string): T => {
      if (!what) throw new Error(`The shot "${SHOTS[self.shot]?.id}" has no ${name}.`);
      return what;
    };
    const press = (b: ButtonName) => {
      if (this.pressing.has(b)) return;
      this.pressing.add(b);
      this.host.input.press(b, true);
    };
    return {
      input: this.host.input,
      save: this.host.save,
      memo: this.memo,
      get world() {
        return need(self.world, 'level');
      },
      get ship() {
        return need(self.scene as ShipScene | null, 'ship stage');
      },
      get planet() {
        return need(self.scene as PlanetScene | null, 'planet stage');
      },
      get moon() {
        return need(self.scene as MoonScene | null, 'moon stage');
      },
      get title() {
        return need(self.scene as TitleScene | null, 'title stage');
      },
      steer: (bearing, push = 1) => {
        const w = need(this.world, 'level');
        const wx = Math.sin(bearing);
        const wz = Math.cos(bearing);
        const c = Math.cos(w.cameraYaw);
        const s = Math.sin(w.cameraYaw);
        this.host.input.moveX = (c * wx - s * wz) * push;
        this.host.input.moveZ = (s * wx + c * wz) * push;
      },
      toward(x, z, push = 1, near = 0.4) {
        const p = need(self.world, 'level').player.body;
        if (Math.hypot(x - p.x, z - p.z) < near) return;
        this.steer(Math.atan2(x - p.x, z - p.z), push);
      },
      tap: press,
      hold: press,
    };
  }

  /** Sets a shot up from a clean slate: its level or stage, and whatever it does before its lead. */
  private begin(i: number) {
    const shot = SHOTS[i];
    this.shot = i;
    this.memo = {};
    this.world = null;
    this.scene = null;
    const set = shot.set;
    if (typeof set === 'string') this.scene = this.host.stage(set);
    else {
      const w = this.host.deck(set);
      this.world = w;
      // Nobody gets hurt in a trailer: the fights play out, but every hit glances off.
      w.player.hurt = () => {};
    }
    shot.setup?.(this.take());
    this.n = -Math.round((shot.lead ?? LEAD) * FPS);
  }

  /** Called once a frame, after the game reads its input and before anything moves. */
  frame() {
    const t = this.tally;
    t.take = false;
    this.pressing.clear();
    if (t.phase === 'done') return this.release();
    if (t.phase === 'warmup') {
      this.warm += 1 / FPS;
      if (this.warm < WARMUP) return;
    }
    if (this.due) {
      this.due = false;
      this.release();
      if (this.shot + 1 >= SHOTS.length) {
        t.phase = 'done';
        return;
      }
      this.begin(this.shot + 1);
    }
    const shot = SHOTS[this.shot];
    const slot = SLOTS[this.shot];
    shot.act?.(this.n / FPS, this.take());
    // A button the shot pressed last frame and not this one comes back up: one frame makes a tap.
    this.release();
    if (this.n >= 0) {
      t.phase = 'roll';
      t.take = true;
      t.frame = slot.from + this.n;
      t.shot = shot.id;
      this.paint(t.frame);
    } else {
      t.phase = 'lead';
    }
    this.n += 1;
    if (slot.from + this.n >= slot.to) this.due = true;
  }

  /** Lets go of every button held last frame that the shot has not pressed again this frame. */
  private release() {
    for (const b of this.held) if (!this.pressing.has(b)) this.host.input.press(b, false);
    this.held = new Set(this.pressing);
  }

  /** The words over the pictures, and the black at either end. */
  private paint(frame: number) {
    for (const { id, slot } of CARD_SLOTS) this.cards.show(id, presence(frame, slot, RISE, FALL));
    const up = Math.min(1, frame / FADE_UP);
    const down = Math.min(1, (TOTAL - 1 - frame) / FADE_DOWN);
    this.cards.slate(1 - Math.max(0, Math.min(up, down)));
  }

  /** What the current shot's camera keeps in frame. */
  private subject(shot: Shot): Subject {
    if (shot.subject) return shot.subject(this.take());
    const p = this.world?.player;
    if (p) return { x: p.body.x, y: p.body.y, z: p.body.z, facing: p.facing };
    return { x: 0, y: 0, z: 0, facing: 0 };
  }

  /** Called just before the game draws: puts the lens where the shot wants it. */
  aim(camera: THREE.PerspectiveCamera) {
    const shot = SHOTS[this.shot];
    if (!shot?.camera || this.tally.phase === 'warmup' || this.tally.phase === 'done') return;
    const span = SLOTS[this.shot].to - SLOTS[this.shot].from;
    // `n` has already moved on to the next frame.
    const pose: Pose = shot.camera(Math.max(0, this.n - 1) / span, this.subject(shot));
    camera.position.set(...pose.position);
    if (camera.fov !== pose.fov) {
      camera.fov = pose.fov;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(...pose.target);
    // The level's shadows follow its camera rig: keep the rig on the shot.
    const w = this.world;
    if (w) {
      const rig = { pos: camera.position.clone(), look: camera.position.clone().set(...pose.target), fov: pose.fov };
      w.setCameraRig(rig);
    }
  }
}
