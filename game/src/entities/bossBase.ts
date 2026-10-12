import * as THREE from 'three';

import { audio, type Track } from '../core/audio';
import { haptic } from '../core/bridge';
import { CELL } from '../core/constants';
import type { World } from '../game/world';
import type { BossKind } from '../world/levelTypes';
import { Entity, type Target } from './entity';

const tmp = new THREE.Vector3();

/** How much tougher a boss gets for each level of Blaster Power (each level adds a whole shot's damage). */
export const BOSS_TOUGHNESS_PER_POWER = 0.6;

/**
 * A boss's health for this save. Every level of Blaster Power makes each shot hit as hard again, and
 * auto-aim puts nearly every shot on the weak spot the moment it opens, so a boss with fixed health fell
 * in a handful of hits. Its health grows too, a bit slower than the damage: upgrades still help.
 */
export function bossHp(world: World, base: number): number {
  return Math.round(base * (1 + BOSS_TOUGHNESS_PER_POWER * (world.save.upgrades.blaster ?? 0)));
}

/* ---------------- base ---------------- */

export abstract class Boss extends Entity {
  abstract readonly title: string;
  hp: number;
  maxHp: number;
  started = false;
  defeated = false;
  protected t = 0;
  readonly center: THREE.Vector3;

  constructor(
    world: World,
    id: string,
    cx: number,
    cz: number,
    h: number,
    hp: number,
  ) {
    super(world, id);
    this.hp = hp;
    this.maxHp = hp;
    this.center = new THREE.Vector3(cx * CELL + CELL / 2, h, cz * CELL + CELL / 2);
  }

  protected get player() {
    return this.world.player;
  }

  protected playerDist() {
    const p = this.player.body;
    return Math.hypot(p.x - this.center.x, p.z - this.center.z);
  }

  /** True once the entrance cutscene has played; retries after a knock-out skip straight to the fight. */
  introSeen = false;
  private introPlaying = false;

  begin() {
    if (this.started || this.defeated || this.introPlaying) return;
    this.introPlaying = true;
    this.onIntro();
    void this.world.bossIntro(this).then(() => {
      this.introPlaying = false;
      this.engage();
    });
  }

  /** Starts the fight right away (used after a cutscene that already introduced the boss). */
  engage() {
    this.introSeen = true;
    if (this.defeated || this.started) return;
    this.started = true;
    this.onStart();
    this.world.bossStarted(this);
  }

  /** Called as the entrance begins (before the cutscene). */
  protected onIntro() {}

  /** Called when the fight actually begins, after the entrance. */
  protected onStart() {}

  /** Roughly how big the boss is, for framing cutscene shots. */
  get size() {
    return this.focusHeight;
  }

  /** How high the boss's "face" is, for cutscene cameras. */
  protected focusHeight = 2.6;

  /** Where the boss stands right now (bosses that walk override this). */
  get where(): THREE.Vector3 {
    return this.center;
  }

  /**
   * A point the fight camera keeps in view along with the hero (a boss that stays far away, like
   * MEDUSA on her plinth), or null to just follow the hero.
   */
  get frame(): THREE.Vector3 | null {
    return null;
  }

  /** Where cutscene cameras look: the boss's face. */
  get focus(): THREE.Vector3 {
    const w = this.where;
    return new THREE.Vector3(w.x, w.y + this.focusHeight, w.z);
  }

  get kind(): BossKind {
    return this.bossKind;
  }

  bossKind: BossKind = 'warden';

  /** Where the fight changes phase, as shares of health (notches on the boss bar), highest first. */
  phaseMarks: number[] = [];

  /** The music the fight plays to: the track named after its kind (core/music.ts maps it to a recording). */
  get music(): Track {
    return this.bossKind;
  }

  /** How far (0..1) the fight's camera leans from the hero toward the boss (0: it just follows the hero). */
  readonly camPull: number = 0;

  /** Frost Ray: bosses shrug most of the cold off. A chill only slows them a little, and never freezes them. */
  private chillT = 0;
  private chillSlow = 1;

  chill(seconds: number, _freeze = false, slow = 0.75) {
    if (this.defeated || !this.started) return;
    this.chillT = Math.max(this.chillT, seconds);
    this.chillSlow = Math.max(slow, 0.6);
  }

  /** Flamethrower: bosses burn only briefly (and their own rules decide whether the burn hurts). */
  private burnT = 0;
  private burnDps = 0;
  private burnTick = 0;

  ignite(seconds: number, dps: number) {
    if (this.defeated || !this.started) return;
    if (this.burnT <= 0) this.burnTick = 0.5;
    this.burnT = Math.max(this.burnT, seconds);
    this.burnDps = dps;
    // Fire melts the frost.
    this.chillT = 0;
  }

  get burning() {
    return this.burnT > 0;
  }

  /** Burning: little flames and a sting every half second, passed through the boss's own hit rules. */
  private updateBurn(dt: number) {
    if (this.burnT <= 0) return;
    this.burnT -= dt;
    this.burnTick -= dt;
    const w = this.where;
    if (Math.random() < dt * 14) {
      const a = Math.random() * Math.PI * 2;
      this.world.particles.emit(w.x + Math.cos(a) * 1.3, w.y + 0.6 + Math.random() * this.focusHeight, w.z + Math.sin(a) * 1.3, { count: 1, color: Math.random() < 0.5 ? '#ffb030' : '#ff5a1a', speed: 0.8, life: 0.5, size: 0.6, gravity: -4 });
    }
    if (this.burnTick <= 0) {
      this.burnTick = 0.5;
      (this as Partial<Target>).hit?.(this.burnDps * 0.5, 'burn', tmp.set(w.x, w.y + 1, w.z));
    }
  }

  /** How fast the boss acts right now (the world scales its time by this); counts the chill (and any burning) down. */
  tempo(dt: number): number {
    this.updateBurn(dt);
    if (this.chillT <= 0) return 1;
    this.chillT -= dt;
    if (Math.random() < dt * 10) {
      const w = this.where;
      const a = Math.random() * Math.PI * 2;
      this.world.particles.emit(w.x + Math.cos(a) * 1.4, w.y + 1 + Math.random() * this.focusHeight, w.z + Math.sin(a) * 1.4, { count: 1, color: '#dff6ff', speed: 0.8, life: 0.7, size: 0.45, gravity: 1.5 });
    }
    return this.chillSlow;
  }

  damage(n: number) {
    if (this.defeated || !this.started) return;
    this.hp = Math.max(0, this.hp - n);
    this.world.hooks.bossBar(this.title, this.hp / this.maxHp);
    if (this.hp <= 0) this.finish();
  }

  protected finish() {
    this.defeated = true;
    const c = this.center;
    audio.play('explode');
    haptic('heavy');
    this.world.shake(0.8);
    for (let i = 0; i < 4; i++) this.world.particles.emit(c.x, c.y + 2 + i, c.z, { count: 40, color: i % 2 ? '#ffffff' : this.world.theme.accent, speed: 10, life: 1.2, size: 0.9 });
    this.world.dropBolts(tmp.set(c.x, c.y + 2, c.z), 40);
    this.world.bossDefeated(this);
  }

  /** Resets the fight after Jason is knocked out. */
  abstract reset(): void;
}
