import * as THREE from 'three';

import { hush, speak } from '../core/voice';
import type { PanelId } from '../ui/panels';
import type { UI } from '../ui/ui';
import type { Line, StoryBeat } from '../world/levelTypes';

/** Where a cutscene camera sits and what it looks at. */
export interface Rig {
  pos: THREE.Vector3;
  look: THREE.Vector3;
  fov: number;
}

export const ease = {
  linear: (k: number) => k,
  in: (k: number) => k * k * k,
  out: (k: number) => 1 - (1 - k) ** 3,
  inOut: (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2),
};

type Ease = (k: number) => number;

interface Tween {
  start: number;
  dur: number;
  fn: (k: number) => void;
  ease: Ease;
  resolve: () => void;
}

/**
 * Runs a cutscene written as an async script. Every step (camera moves, waits, dialogue, captions)
 * is driven by the game clock, and skipping jumps each step straight to its end state so the world
 * is left exactly as if the scene had played out.
 */
export class Director {
  skipping = false;
  /** World time multiplier: below 1 for slow motion. The director's own clock always runs at real speed. */
  timeScale = 1;
  private clock = 0;
  private waits: { at: number; resolve: () => void }[] = [];
  private tweens: Tween[] = [];
  private cancelSpeech: (() => void) | null = null;
  private tapWaiters: (() => void)[] = [];

  constructor(
    private ui: UI,
    readonly rig: Rig,
  ) {}

  update(dt: number) {
    this.clock += dt;
    for (const t of [...this.tweens]) {
      const k = Math.min(1, (this.clock - t.start) / t.dur);
      t.fn(t.ease(k));
      if (k >= 1) {
        this.tweens.splice(this.tweens.indexOf(t), 1);
        t.resolve();
      }
    }
    for (const w of [...this.waits]) {
      if (this.clock >= w.at) {
        this.waits.splice(this.waits.indexOf(w), 1);
        w.resolve();
      }
    }
  }

  get time() {
    return this.clock;
  }

  wait(seconds: number): Promise<void> {
    if (this.skipping || seconds <= 0) return Promise.resolve();
    return new Promise((resolve) => this.waits.push({ at: this.clock + seconds, resolve }));
  }

  /** Calls fn(k) every frame with k going 0 → 1 over the given time. */
  tween(seconds: number, fn: (k: number) => void, e: Ease = ease.inOut): Promise<void> {
    if (this.skipping || seconds <= 0) {
      fn(1);
      return Promise.resolve();
    }
    fn(0);
    return new Promise((resolve) => this.tweens.push({ start: this.clock, dur: seconds, fn, ease: e, resolve }));
  }

  /** Glides the camera to a new pose. */
  cam(pos: THREE.Vector3, look: THREE.Vector3, seconds: number, e: Ease = ease.inOut, fov?: number): Promise<void> {
    const p0 = this.rig.pos.clone();
    const l0 = this.rig.look.clone();
    const f0 = this.rig.fov;
    const p1 = pos.clone();
    const l1 = look.clone();
    const f1 = fov ?? f0;
    return this.tween(
      seconds,
      (k) => {
        this.rig.pos.lerpVectors(p0, p1, k);
        this.rig.look.lerpVectors(l0, l1, k);
        this.rig.fov = f0 + (f1 - f0) * k;
      },
      e,
    );
  }

  /** Flies the camera smoothly through a list of poses (a spline, no stops in between). */
  fly(poses: { pos: THREE.Vector3; look: THREE.Vector3 }[], seconds: number, e: Ease = ease.inOut): Promise<void> {
    const pos = new THREE.CatmullRomCurve3([this.rig.pos.clone(), ...poses.map((p) => p.pos)], false, 'centripetal');
    const look = new THREE.CatmullRomCurve3([this.rig.look.clone(), ...poses.map((p) => p.look)], false, 'centripetal');
    return this.tween(
      seconds,
      (k) => {
        pos.getPoint(k, this.rig.pos);
        look.getPoint(k, this.rig.look);
      },
      e,
    );
  }

  /** Jumps the camera to a pose. */
  cut(pos: THREE.Vector3, look: THREE.Vector3, fov?: number) {
    this.rig.pos.copy(pos);
    this.rig.look.copy(look);
    if (fov) this.rig.fov = fov;
  }

  /** Shows lines of dialogue until the player has read them all; `onLine` hears each one as it comes up. */
  say(lines: Line[], onLine?: (line: Line) => void): Promise<void> {
    if (this.skipping || !lines.length) return Promise.resolve();
    return new Promise((resolve) => {
      this.cancelSpeech = this.ui.dialogue(
        lines,
        () => {
          this.cancelSpeech = null;
          resolve();
        },
        onLine,
      );
    });
  }

  /**
   * Shows a line of narration until it has been on screen long enough to read, or the player taps. When
   * the narrator reads it (core/voice.ts) it stays up until he has finished.
   */
  async caption(text: string, seconds = Math.max(2.8, text.length * 0.06)) {
    if (this.skipping) return;
    this.ui.caption(text);
    const read = speak('narrator', text);
    await Promise.race([this.wait(Math.max(seconds, read + 0.5)), this.tapped()]);
    if (read) hush();
    this.ui.caption(null);
    await this.wait(0.25);
  }

  /**
   * Shows a storybook illustration while its lines are spoken (or its caption is read, or for a few
   * seconds), then fades it away.
   */
  async panel(id: PanelId, opts: { lines?: Line[]; caption?: string; seconds?: number } = {}) {
    if (this.skipping) return;
    this.ui.storyPanel(id);
    await this.wait(0.5);
    if (opts.lines?.length) await this.say(opts.lines);
    else if (opts.caption) await this.caption(opts.caption, opts.seconds);
    else await Promise.race([this.wait(opts.seconds ?? 3.5), this.tapped()]);
    this.ui.storyPanel(null);
    await this.wait(0.45);
  }

  /** A run of storybook panels, each with its own lines or caption. */
  async story(beats: StoryBeat[]) {
    for (const b of beats) await this.panel(b.panel, { lines: b.lines, caption: b.caption });
  }

  /** A boss's big entrance name card. */
  async title(name: string, sub: string, color: string) {
    if (this.skipping) return;
    this.ui.bossCard(name, sub, color);
    await this.wait(2.6);
  }

  fade(color: string, to: number, seconds: number): Promise<void> {
    this.ui.fade(color, to, this.skipping ? 0 : seconds);
    return this.wait(seconds);
  }

  glitch(seconds: number) {
    if (!this.skipping) this.ui.glitch(seconds);
  }

  /** Called when the player taps the screen (not the skip button). */
  tap() {
    const waiters = this.tapWaiters;
    this.tapWaiters = [];
    for (const w of waiters) w();
  }

  private tapped(): Promise<void> {
    return new Promise((resolve) => this.tapWaiters.push(resolve));
  }

  skip() {
    if (this.skipping) return;
    this.skipping = true;
    this.timeScale = 1;
    for (const t of this.tweens) {
      t.fn(1);
      t.resolve();
    }
    this.tweens = [];
    for (const w of this.waits) w.resolve();
    this.waits = [];
    this.tap();
    this.cancelSpeech?.();
    this.ui.caption(null);
    hush();
  }
}
