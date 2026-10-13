import * as THREE from 'three';

import { audio } from '../core/audio';
import { CELL, MECH, PULSE } from '../core/constants';
import { damp, dampAngle } from '../core/math';
import type { World } from '../game/world';
import { Grid } from '../world/grid';
import type { EnemyKind } from '../world/levelTypes';
import { makeBody, moveBody, type Body } from '../world/physics';
import { makeBrute, makeBuzzer, makeSentry, makeSnapper, makeSporeling, makeTurret, type EnemyModel } from './aliens';
import type { Difficulty } from '../game/difficulty';
import { Badge, type BadgeKind } from './badges';
import { Entity, type HitKind, type Target } from './entity';
import { Shockwave } from './hazards';
import { makeRingGuard } from './ch3/ringGuard';
import { makeHarpy } from './isles/harpy';
import { makeCrab } from './reef/crab';
import { makeJelly } from './reef/jelly';
import { makeAnvilDrone } from './forge/anvil';
import { makeCoil } from './labyrinth/coil';
import { makeWeeder } from './ch3/weeder';
import { makeRobot } from './robots';
import { makeRamling } from './stand/ramling';

const v3 = new THREE.Vector3();
const WHITE = new THREE.Color('#ffffff');
const ICE = new THREE.Color('#2f8fff');
const FIRE = new THREE.Color('#ff6a00');
const FLAMES = ['#fff1c4', '#ffd166', '#ff9a2a', '#ff5a1a'];


function hash01(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

export abstract class Enemy extends Entity implements Target {
  hp: number;
  maxHp: number;
  readonly body: Body;
  readonly aim = new THREE.Vector3();
  radius: number;
  aimable = true;
  room?: string;
  kind: BadgeKind = 'sporeling';
  elite = false;
  protected aggro = false;
  protected flashT = 0;
  protected stagger = 0;
  protected yaw = Math.PI;
  protected home: THREE.Vector3;
  protected t = Math.random() * 10;
  protected contact = true;
  protected flying = false;
  protected aimHeight = 0.6;
  /** Height of the floating badge above the enemy's feet. */
  protected badgeY = 1.6;
  protected spd = 1;
  protected rate = 1;
  protected tier = 0;
  /** Seconds left on the red "!" shown when this enemy raised (or heard) an alarm. */
  protected alarmT = 0;
  bolts = 3;
  heartChance = 0.12;
  private flashBase: { m: THREE.MeshStandardMaterial; e: THREE.Color; i: number }[] = [];
  /** What the emissive glow shows: 0 normal, 1 hit flash, 2 chilled, 3 frozen, 4 burning. */
  private look = 0;
  private badge: Badge | null = null;
  /** Frost Ray: seconds left chilled (slowed to `chillSlow`) and frozen solid, and the ice shell shown while frozen. */
  private chillT = 0;
  private freezeT = 0;
  private chillSlow = 1;
  private ice: THREE.Mesh | null = null;
  /** Flamethrower: seconds left burning, its damage per second, and the clock to its next sting. */
  private burnT = 0;
  private burnDps = 0;
  private burnTick = 0;

  constructor(
    world: World,
    id: string,
    x: number,
    y: number,
    z: number,
    hp: number,
    radius: number,
    readonly model: EnemyModel,
  ) {
    super(world, id);
    this.hp = hp;
    this.maxHp = hp;
    this.radius = radius;
    this.body = makeBody(x, y, z, radius, radius * 2);
    this.home = new THREE.Vector3(x, y, z);
    this.obj.add(model.root);
    this.flashBase = model.flash.map((m) => ({ m, e: m.emissive.clone(), i: m.emissiveIntensity }));
  }

  /** Scales this enemy to the deck's difficulty; elites are bigger, tougher and richer. */
  empower(d: Difficulty, elite: boolean) {
    this.tier = d.tier;
    this.spd = d.speed;
    this.rate = d.rate;
    this.elite = elite;
    const mult = d.hp * (elite ? 1.8 : 1);
    this.maxHp = Math.max(1, Math.round(this.maxHp * mult));
    this.hp = this.maxHp;
    if (elite) {
      this.model.root.scale.multiplyScalar(1.2);
      this.bolts *= 2;
      this.heartChance = Math.min(1, this.heartChance * 2.5);
    }
  }

  protected get player() {
    return this.world.player;
  }

  get awake() {
    return this.aggro;
  }

  protected distToPlayer() {
    const p = this.player.body;
    return Math.hypot(p.x - this.body.x, p.z - this.body.z);
  }

  protected facePlayer(dt: number, speed = 8) {
    const p = this.player.body;
    this.yaw = dampAngle(this.yaw, Math.atan2(p.x - this.body.x, p.z - this.body.z), speed, dt);
  }

  /** Where Jason will be after `seconds`, if he keeps moving the same way. */
  protected lead(seconds: number, out = new THREE.Vector3()) {
    const p = this.player.body;
    return out.set(p.x + p.vx * seconds, p.y + 1.05, p.z + p.vz * seconds);
  }

  /** True if walking toward (dx, dz) stays on safe floor of about the same height. */
  protected safeAhead(dx: number, dz: number) {
    const g = this.world.grid;
    const d = Math.hypot(dx, dz) || 1;
    const ax = this.body.x + (dx / d) * (this.radius + 0.6);
    const az = this.body.z + (dz / d) * (this.radius + 0.6);
    const here = g.cell(Grid.toCell(this.body.x), Grid.toCell(this.body.z));
    const c = g.cell(Grid.toCell(ax), Grid.toCell(az));
    if (c.kind === 'void' || c.kind === 'wall' || c.kind === 'hazard') return false;
    return Math.abs(c.h - here.h) < 0.6;
  }

  /** Wakes this enemy: an alarm went off, or a packmate spotted Jason. */
  alert(alarm = false) {
    if (alarm) this.alarmT = 2.4;
    if (!this.aggro) this.wake();
  }

  protected wake() {
    this.aggro = true;
    this.world.meetEnemy(this.kind, this.elite);
    this.onWake();
  }

  /** Hook for enemies that react to spotting Jason (calling the pack, sounding the alarm). */
  protected onWake() {}

  hit(dmg: number, kind: HitKind, from: THREE.Vector3): boolean {
    if (!this.alive) return false;
    if (!this.canBeHit(kind, from)) {
      audio.play('zap', 1.8);
      this.world.particles.emit(this.aim.x, this.aim.y, this.aim.z, { count: 6, color: '#7fe6ff', speed: 3, life: 0.25, size: 0.35 });
      return true;
    }
    this.hp -= dmg;
    if (!this.aggro) this.wake();
    this.flashT = kind === 'burn' ? 0.06 : 0.12;
    if (kind === 'burn') {
      // Fire stings without stunning: a small shove, orange sparks.
      this.world.particles.emit(this.aim.x, this.aim.y, this.aim.z, { count: 3, color: '#ffb030', speed: 2.5, life: 0.3, size: 0.4, gravity: -2 });
      if (!this.flying) {
        const bx = this.body.x - from.x;
        const bz = this.body.z - from.z;
        const bd = Math.hypot(bx, bz) || 1;
        this.body.vx += (bx / bd) * 1.2;
        this.body.vz += (bz / bd) * 1.2;
      }
      if (this.hp <= 0) this.die();
      return true;
    }
    // LUX's zap is mostly a stun: it freezes the enemy for a moment. His force pulse stuns for longer.
    this.stagger = kind === 'pulse' ? PULSE.stun : kind === 'zap' ? 1.3 : kind === 'dash' ? 0.75 : kind === 'smash' ? 1.1 : kind === 'shot' ? 0.12 : 0.35;
    const dx = this.body.x - from.x;
    const dz = this.body.z - from.z;
    const d = Math.hypot(dx, dz) || 1;
    const kb = kind === 'shot' || kind === 'zap' ? 2.5 : kind === 'blast' || kind === 'dash' || kind === 'pulse' || kind === 'smash' ? 13 : 9;
    if (!this.flying) {
      this.body.vx += (dx / d) * kb;
      this.body.vz += (dz / d) * kb;
      if (kind !== 'shot' && kind !== 'zap') this.body.vy = Math.max(this.body.vy, 4);
    }
    this.world.particles.emit(this.aim.x, this.aim.y, this.aim.z, { count: 7, color: '#ffffff', speed: 4, life: 0.25, size: 0.35 });
    if (this.hp <= 0) this.die();
    return true;
  }

  protected canBeHit(_kind: HitKind, _from: THREE.Vector3) {
    return true;
  }

  /** Whether the floating badge should show right now (hidden ambushers keep it hidden). */
  protected badgeShown() {
    return true;
  }

  die() {
    if (!this.alive) return;
    audio.play('pop');
    const c = this.model.flash[0]?.color ?? new THREE.Color('#ffffff');
    this.world.particles.emit(this.aim.x, this.aim.y, this.aim.z, { count: 26, color: c, speed: 7, life: 0.7, size: 0.6, up: 2 });
    this.world.particles.emit(this.aim.x, this.aim.y, this.aim.z, { count: 10, color: '#ffffff', speed: 4, life: 0.4, size: 0.4 });
    this.world.dropBolts(this.aim, this.bolts);
    // Aboard the mech the drop is a bronze gear (see HeartPickup), a little more often than a heart.
    const chance = this.world.player.aboard && this.heartChance > 0 ? Math.max(this.heartChance, MECH.gearChance) : this.heartChance;
    if (Math.random() < chance) this.world.dropHeart(this.aim);
    else if (Math.random() < 0.2) this.world.dropEnergy(this.aim);
    this.world.enemyDied(this);
    this.remove();
  }

  protected abstract think(dt: number): void;

  /**
   * Frost Ray: chills this enemy for `seconds`, slowing everything it does to `slow` of its normal
   * speed (with an icy blue tint). With `freeze` it is frozen solid (and harmless) for that long instead.
   */
  chill(seconds: number, freeze = false, slow = 0.5) {
    if (!this.alive) return;
    // The cold puts the fire out.
    this.burnT = 0;
    this.chillSlow = Math.min(this.chillT > 0 ? this.chillSlow : 1, slow);
    if (freeze) this.freezeT = Math.max(this.freezeT, seconds);
    this.chillT = Math.max(this.chillT, seconds + (freeze ? 1.5 : 0));
  }

  get frozen() {
    return this.freezeT > 0;
  }

  /**
   * Flamethrower: sets this enemy burning for `seconds`, losing `dps` health a second (in small
   * stings) and flickering orange. Fire melts ice: a chilled or frozen enemy thaws at once.
   */
  ignite(seconds: number, dps: number) {
    if (!this.alive) return;
    if (this.burnT <= 0) this.burnTick = 0.5;
    this.burnT = Math.max(this.burnT, seconds);
    this.burnDps = Math.max(this.burnT > 0 ? this.burnDps : 0, dps);
    this.freezeT = 0;
    this.chillT = 0;
    this.chillSlow = 1;
  }

  get burning() {
    return this.burnT > 0;
  }

  /** Counts the burning down: a sting every half second, and little flames rising off the enemy. */
  private updateBurn(dt: number) {
    if (this.burnT <= 0) return;
    this.burnT -= dt;
    this.burnTick -= dt;
    if (Math.random() < dt * 16) {
      const r = this.radius * this.model.root.scale.y;
      this.world.particles.emit(this.aim.x + (Math.random() - 0.5) * r * 1.6, this.aim.y + (Math.random() - 0.3) * r, this.aim.z + (Math.random() - 0.5) * r * 1.6, { count: 1, color: FLAMES[(Math.random() * FLAMES.length) | 0], speed: 0.6, life: 0.5, size: 0.55, gravity: -4 });
    }
    if (this.burnTick <= 0 && this.burnT > -0.01) {
      this.burnTick = 0.5;
      this.hit(this.burnDps * 0.5, 'burn', this.aim);
    }
    if (this.burnT <= 0) this.burnDps = 0;
  }

  /** How fast this enemy moves and thinks right now: 1 normally, less while chilled, 0 frozen solid. */
  get tempo() {
    return this.freezeT > 0 ? 0 : this.chillT > 0 ? this.chillSlow : 1;
  }

  /** Counts the chill down; tints the enemy icy blue and shows the ice shell while it lasts. */
  private updateChill(dt: number) {
    if (this.chillT <= 0 && !this.ice?.visible) return;
    this.chillT = Math.max(0, this.chillT - dt);
    this.freezeT = Math.max(0, this.freezeT - dt);
    if (this.chillT <= 0) this.chillSlow = 1;
    if (this.freezeT > 0 && !this.ice) {
      const m = new THREE.MeshStandardMaterial({ color: '#cff4ff', emissive: '#5ec8ff', emissiveIntensity: 0.5, transparent: true, opacity: 0.45, roughness: 0.1, depthWrite: false });
      this.ice = new THREE.Mesh(new THREE.IcosahedronGeometry(this.radius * 1.45, 0), m);
      this.obj.add(this.ice);
    }
    if (this.ice) {
      this.ice.visible = this.freezeT > 0;
      this.ice.position.set(this.body.x, this.body.y + this.radius, this.body.z);
      this.ice.scale.setScalar(this.model.root.scale.y);
    }
    if (this.chillT > 0 && Math.random() < dt * 6) {
      this.world.particles.emit(this.aim.x, this.aim.y + 0.3, this.aim.z, { count: 1, color: '#dff6ff', speed: 0.8, life: 0.6, size: 0.35, gravity: 1.5 });
    }
  }

  update(dt: number) {
    if (!this.alive) return;
    // Chilled enemies think and move slower; frozen ones not at all (they still fall).
    const realDt = dt;
    this.updateChill(realDt);
    this.updateBurn(realDt);
    if (!this.alive) return;
    const tempo = this.tempo;
    dt *= tempo;
    this.t += dt;
    this.alarmT = Math.max(0, this.alarmT - dt);
    const dist = this.distToPlayer();
    if (!this.aggro && !this.world.cutscene && dist < this.world.difficulty.aggro && Math.abs(this.player.body.y - this.body.y) < 5) this.wake();
    if (this.aggro && dist > 30) this.aggro = false;
    if (this.stagger > 0 || this.world.cutscene) {
      // Staggered, stunned, or holding still while a cutscene plays (gravity still applies).
      this.stagger -= dt;
      this.body.vx = damp(this.body.vx, 0, 6, dt);
      this.body.vz = damp(this.body.vz, 0, 6, dt);
    } else {
      this.think(dt);
    }
    if (!this.flying) {
      // Gravity keeps its full pace; only walking is slowed by a chill.
      this.body.vx *= tempo;
      this.body.vz *= tempo;
      moveBody(this.body, realDt, this.world.grid, this.world.boxes, { stepUp: 0.55 });
      if (tempo > 0) {
        this.body.vx /= tempo;
        this.body.vz /= tempo;
      }
      if (this.body.y < -12) {
        this.die();
        return;
      }
    }
    if (this.contact && !this.world.cutscene && tempo > 0) this.touchPlayer();
    this.flashT -= realDt;
    const look = this.flashT > 0 ? 1 : this.burnT > 0 ? 4 : this.freezeT > 0 ? 3 : this.chillT > 0 ? 2 : 0;
    if (look !== this.look || look === 4) {
      this.look = look;
      // Burning flickers orange every frame.
      const flicker = 0.55 + Math.sin(this.t * 31) * 0.25 + Math.random() * 0.2;
      for (const f of this.flashBase) {
        f.m.emissive.copy(look === 1 ? WHITE : look === 4 ? FIRE : look > 1 ? ICE : f.e);
        f.m.emissiveIntensity = look === 1 ? 1.4 : look === 4 ? flicker : look === 3 ? 0.75 : look === 2 ? 0.45 : f.i;
      }
    }
    this.model.root.position.set(this.body.x, this.body.y, this.body.z);
    this.model.root.rotation.y = this.yaw;
    this.aim.set(this.body.x, this.body.y + this.aimHeight, this.body.z);
    if (!this.badge) {
      this.badge = new Badge(this.kind, this.elite, this.maxHp);
      this.obj.add(this.badge.group);
    }
    const scale = this.model.root.scale.y;
    const bg = this.badge.group.position.set(this.body.x, this.body.y + this.badgeY * scale, this.body.z);
    // The icon shows when the enemy is close and awake; the health bar once it's hurt (from farther
    // away), or when it's right next to Jason.
    const seen = !this.world.cutscene && this.badgeShown();
    const hurt = this.hp < this.maxHp - 1e-3;
    this.badge.update(realDt, {
      icon: seen && dist < 16 && (this.aggro || dist < 9),
      bar: seen && (dist < 7 || (hurt && dist < 26)),
      hp: Math.max(0, this.hp),
      maxHp: this.maxHp,
      alarmed: this.alarmT > 0,
      t: this.t,
      // (Test worlds have no camera.)
      camDist: (this.world as Partial<World>).camera?.position.distanceTo(bg) ?? 12,
    });
  }

  /** Returns true if Jason got hurt. */
  protected touchPlayer(dmg = 1): boolean {
    const p = this.player.body;
    const dx = p.x - this.body.x;
    const dz = p.z - this.body.z;
    const r = this.radius + p.r - 0.1;
    if (dx * dx + dz * dz < r * r && p.y < this.body.y + this.radius * 2 + 0.2 && p.y + p.h > this.body.y) {
      if (this.player.pounding && p.y > this.body.y + this.radius) return false;
      // Jason is ramming it with a dash: the dash does the hitting.
      if (this.player.dashing) return false;
      const before = this.player.health;
      this.player.hurt(dmg, this.body.x, this.body.z);
      return this.player.health < before;
    }
    return false;
  }
}

/* ---------------- Spore Crawler: hunts in packs and surrounds you ---------------- */

class Sporeling extends Enemy {
  private hopT = Math.random();
  private squash = 0;
  private slot: number;
  private hops = 0;
  private retreat = 0;

  constructor(world: World, id: string, x: number, y: number, z: number, variant: string) {
    const hp = variant === 'magma' ? 3 : 2;
    super(world, id, x, y, z, hp, 0.55, makeSporeling(variant));
    this.bolts = 3;
    this.kind = 'sporeling';
    this.badgeY = 1.55;
    this.slot = hash01(id) * Math.PI * 2;
  }

  /** One crawler spotting Jason calls the rest of its pack. */
  protected onWake() {
    this.world.alertNear(this.body.x, this.body.z, 10, 'sporeling');
  }

  protected think(dt: number) {
    const b = this.body;
    this.hopT -= dt;
    this.retreat = Math.max(0, this.retreat - dt);
    if (b.grounded) {
      b.vx = damp(b.vx, 0, 10, dt);
      b.vz = damp(b.vz, 0, 10, dt);
      if (this.hopT <= 0) {
        this.hopT = this.aggro ? (0.55 + Math.random() * 0.3) / this.rate : 1.4 + Math.random();
        this.squash = 0.15;
        const p = this.player.body;
        let tx = this.home.x + (Math.random() - 0.5) * 3;
        let tz = this.home.z + (Math.random() - 0.5) * 3;
        let sp = 2;
        if (this.aggro) {
          this.hops += 1;
          const close = this.distToPlayer() < 2.6;
          if (this.retreat > 0) {
            // Just bit Jason: hop back out of reach before coming again.
            tx = b.x - (p.x - b.x);
            tz = b.z - (p.z - b.z);
            sp = 4;
          } else if (close || this.hops % 3 === 0) {
            // Pounce straight in.
            tx = p.x;
            tz = p.z;
            sp = 5.4;
          } else {
            // Circle to its own spot around Jason, so the pack surrounds him.
            const a = this.slot + this.t * 0.35;
            tx = p.x + Math.cos(a) * 2.8;
            tz = p.z + Math.sin(a) * 2.8;
            sp = 4.6;
          }
        }
        const dx = tx - b.x;
        const dz = tz - b.z;
        const d = Math.hypot(dx, dz) || 1;
        b.vy = this.elite ? 8.5 : 7;
        if (this.safeAhead(dx, dz)) {
          const s = Math.min(sp * this.spd, d * 2.2);
          b.vx = (dx / d) * s;
          b.vz = (dz / d) * s;
        }
        this.yaw = Math.atan2(this.aggro ? p.x - b.x : dx, this.aggro ? p.z - b.z : dz);
      }
    }
    this.squash = Math.max(0, this.squash - dt);
    const s = b.grounded ? 1 - this.squash * 1.5 : 1.12;
    this.model.body.scale.set(2 - s, s, 2 - s);
    // Legs skitter while it runs and fold up when it leaps.
    const moving = Math.hypot(b.vx, b.vz) > 0.5 ? 1 : 0.2;
    (this.model.limbs ?? []).forEach((leg, i) => {
      const side = i % 2 ? 1 : -1;
      leg.rotation.x = b.grounded ? Math.sin(this.t * 18 + i * 1.9) * 0.4 * moving : 0.3;
      leg.rotation.z = b.grounded ? 0 : side * 0.55;
    });
  }

  protected touchPlayer() {
    const hurt = super.touchPlayer();
    if (hurt) this.retreat = 1.1;
    return hurt;
  }
}

/* ---------------- Maw Plant: guards the roots, strikes from ambush ---------------- */

class Snapper extends Enemy {
  private up = 0;
  private snapT = 1.2;
  private lunge = 0;
  private jaw = 0.1;

  constructor(world: World, id: string, x: number, y: number, z: number, variant?: string) {
    super(world, id, x, y, z, 3, 0.6, makeSnapper(variant));
    this.bolts = 4;
    this.contact = false;
    this.aimHeight = 1.3;
    this.kind = 'snapper';
    this.badgeY = 2.5;
  }

  protected canBeHit() {
    return this.up > 0.5;
  }

  protected badgeShown() {
    return this.up > 0.3;
  }

  protected think(dt: number) {
    // It lies hidden among the roots until Jason walks right up to it.
    const near = this.distToPlayer() < 5 + this.tier * 0.15;
    this.up = damp(this.up, near ? 1 : 0, near ? 9 : 4, dt);
    this.aimable = this.up > 0.5;
    this.body.vx = 0;
    this.body.vz = 0;
    this.facePlayer(dt, 6);
    const head = this.model.parts.head;
    this.model.body.position.y = (this.up - 1) * 1.4;
    // Jaws breathe while it waits, gape wide just before a bite, and slam shut on it.
    let open = 0.12 + Math.sin(this.t * 3) * 0.06;
    const tell = 0.45 / this.rate;
    if (near) open = this.snapT < tell ? 1 : 0.35;
    if (this.lunge > 0) open = 0.02;
    this.jaw = damp(this.jaw, open, this.lunge > 0 ? 30 : 10, dt);
    this.model.parts.jawTop.rotation.x = -this.jaw * 0.9;
    this.model.parts.jawBottom.rotation.x = this.jaw * 0.55;
    if (near) {
      this.snapT -= dt;
      head.position.x = this.snapT < tell ? Math.sin(this.t * 60) * 0.06 : 0;
      if (this.snapT <= 0) {
        this.snapT = 1.8 / this.rate;
        this.lunge = 0.35;
        audio.play('hit', 0.6);
        if (this.distToPlayer() < 2.6 + (this.elite ? 0.5 : 0)) this.player.hurt(1, this.body.x, this.body.z);
      }
    } else {
      this.snapT = Math.max(this.snapT, 0.6);
    }
    this.lunge = Math.max(0, this.lunge - dt);
    const k = this.lunge > 0 ? Math.sin((this.lunge / 0.35) * Math.PI) : 0;
    head.position.z = k * 1.1;
    head.scale.set(1 + k * 0.2, 1 - k * 0.1, 1 + k * 0.2);
  }
}

/* ---------------- Stinger Wasp: circles, then dives while you reload ---------------- */

class Buzzer extends Enemy {
  private shootT = 2;
  private orbit = Math.random() * Math.PI * 2;
  private baseY: number;
  private mode: 'orbit' | 'dive' | 'recover' = 'orbit';
  private modeT = 0;
  private diveCd = 4 + Math.random() * 3;
  private diveDir = new THREE.Vector3();

  constructor(world: World, id: string, x: number, y: number, z: number, variant?: string) {
    super(world, id, x, y + 2.6, z, 2, 0.5, makeBuzzer(variant));
    this.flying = true;
    this.bolts = 4;
    this.baseY = y + 2.6;
    this.aimHeight = 0;
    this.kind = 'buzzer';
    this.badgeY = 1.1;
    this.contact = false;
  }

  protected think(dt: number) {
    const b = this.body;
    const p = this.player.body;
    const g = this.world.grid;
    this.modeT -= dt;
    this.diveCd -= dt;
    let tx = this.home.x + Math.cos(this.t * 0.8) * 2;
    let tz = this.home.z + Math.sin(this.t * 0.8) * 2;
    if (this.aggro && this.mode === 'orbit') {
      this.orbit += dt * 0.7 * this.spd;
      tx = p.x + Math.cos(this.orbit) * 6;
      tz = p.z + Math.sin(this.orbit) * 6;
      this.baseY = damp(this.baseY, p.y + 2.8, 2, dt);
      // Its plan: wait until Jason is busy reloading (or has turned away), then dive in for a sting.
      if (this.diveCd <= 0 && (this.player.reloading || this.diveCd < -4)) {
        this.mode = 'dive';
        this.modeT = 1.1;
        this.diveDir.copy(this.lead(0.25)).sub(v3.set(b.x, b.y, b.z)).normalize();
        audio.play('glide', 1.6);
      }
      this.shootT -= dt;
      const glow = this.shootT < 0.5;
      this.model.body.scale.setScalar(glow ? 1.12 + Math.sin(this.t * 40) * 0.05 : 1);
      if (this.shootT <= 0) {
        this.shootT = 2.3 / this.rate;
        const from = new THREE.Vector3(b.x, b.y, b.z);
        const speed = 8 * this.spd;
        // Shoots where Jason is going, not where he is.
        const dir = this.lead(from.distanceTo(v3.set(p.x, p.y, p.z)) / speed).sub(from).normalize();
        this.world.shots.fire('enemy', from, dir, speed, 1);
        this.world.soundAt('enemyShoot', this.body.x, this.body.z, 1, 22);
      }
    }
    if (this.mode === 'dive') {
      const s = 10 * this.spd;
      const nx = b.x + this.diveDir.x * s * dt;
      const nz = b.z + this.diveDir.z * s * dt;
      if (g.cell(Grid.toCell(nx), Grid.toCell(nz)).kind !== 'wall') {
        b.x = nx;
        b.z = nz;
      }
      b.y = Math.max(p.y + 0.6, b.y + this.diveDir.y * s * dt);
      this.contact = true;
      if (this.modeT <= 0 || this.touchPlayer()) {
        this.mode = 'recover';
        this.modeT = 1;
        this.contact = false;
        this.diveCd = (5 + Math.random() * 3) / this.rate;
      }
    } else if (this.mode === 'recover') {
      b.y = damp(b.y, this.baseY, 3, dt);
      if (this.modeT <= 0) this.mode = 'orbit';
    }
    if (this.mode !== 'dive') {
      const nx = damp(b.x, tx, 1.5, dt);
      const nz = damp(b.z, tz, 1.5, dt);
      if (g.cell(Grid.toCell(nx), Grid.toCell(nz)).kind !== 'wall') {
        b.x = nx;
        b.z = nz;
      }
      if (this.mode === 'orbit') b.y = this.baseY + Math.sin(this.t * 3) * 0.25;
    }
    this.facePlayer(dt, 5);
    const flap = Math.sin(this.t * 70) * 0.6;
    this.model.parts.rotorL.rotation.z = flap;
    this.model.parts.rotorR.rotation.z = -flap;
    this.model.body.rotation.x = this.mode === 'dive' ? 0.8 : 0.15 + Math.sin(this.t * 2.2) * 0.06;
    const shadow = this.model.parts.shadow;
    const c = g.cell(Grid.toCell(b.x), Grid.toCell(b.z));
    shadow.visible = c.kind !== 'void';
    shadow.position.y = c.h - b.y + 0.03;
  }
}

/* ---------------- Warden Bot: patrols, sounds the alarm, calls everyone ---------------- */

/** How fast a Warden Bot can swing round (radians a second): slow enough to run circles round it. */
const SENTRY_TURN = 1.35;
/** Damage multiplier for hits on the power pack on its back. */
const SENTRY_BACKSTAB = 3;

class Sentry extends Enemy {
  private dir: [number, number];
  private burst = 0;
  private burstT = 0;
  private coolT = 1.5;
  /** After a burst the gun overheats: it stops turning and vents steam, a window to get behind it. */
  private ventT = 0;
  private raised = false;

  constructor(world: World, id: string, x: number, y: number, z: number, variant?: string) {
    super(world, id, x, y, z, 4, 0.7, makeSentry(variant));
    this.bolts = 6;
    this.heartChance = 0.2;
    this.aimHeight = 1.1;
    this.dir = [1, 0];
    this.yaw = Math.PI / 2;
    this.kind = 'sentry';
    this.badgeY = 2.2;
  }

  /** -1 straight behind it, 1 straight in front of it. */
  private facingDot(from: THREE.Vector3) {
    const dx = from.x - this.body.x;
    const dz = from.z - this.body.z;
    const d = Math.hypot(dx, dz) || 1;
    return (dx * Math.sin(this.yaw) + dz * Math.cos(this.yaw)) / d;
  }

  protected canBeHit(kind: HitKind, from: THREE.Vector3) {
    // Only its front shield stops blaster bolts; everything else (and anything from the side) gets through.
    if (kind !== 'shot') return true;
    return this.facingDot(from) < 0.35;
  }

  hit(dmg: number, kind: HitKind, from: THREE.Vector3): boolean {
    const back = this.facingDot(from) < -0.25;
    const ok = super.hit(back ? dmg * SENTRY_BACKSTAB : dmg, kind, from);
    if (back && this.alive) {
      // A hit on the power pack shorts it out for a moment.
      this.stagger = Math.max(this.stagger, 0.8);
      this.world.particles.emit(this.aim.x, this.aim.y + 0.2, this.aim.z, { count: 14, color: '#ffd166', speed: 5, life: 0.4, size: 0.4 });
      audio.play('zap', 0.8);
    }
    return ok;
  }

  /** Swings toward an angle, but never faster than SENTRY_TURN. */
  private turnTo(target: number, dt: number) {
    let d = (target - this.yaw) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    const max = SENTRY_TURN * (this.elite ? 1.15 : 1) * dt;
    this.yaw += Math.max(-max, Math.min(max, d));
  }

  protected think(dt: number) {
    const b = this.body;
    const p = this.player.body;
    const dx = p.x - b.x;
    const dz = p.z - b.z;
    const d = Math.hypot(dx, dz);
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const inView = this.aggro && d < 11 && (dx * fx + dz * fz) / (d || 1) > 0.5;
    if (inView && !this.raised) {
      // The first time it sees Jason, it calls the guards close by.
      this.raised = true;
      this.alarmT = 2.4;
      audio.play('alarm');
      this.world.alertNear(b.x, b.z, 12, null, true);
    }
    this.coolT -= dt;
    this.ventT = Math.max(0, this.ventT - dt);
    const core = this.model.mats?.core;
    if (core) core.emissiveIntensity = this.ventT > 0 ? 4 + Math.sin(this.t * 30) * 1.5 : 2.2 + Math.sin(this.t * 4) * 0.4;
    if (this.ventT > 0) {
      // Overheated: frozen in place with its back wide open.
      b.vx = damp(b.vx, 0, 10, dt);
      b.vz = damp(b.vz, 0, 10, dt);
      if (Math.random() < 0.35) this.world.particles.emit(b.x - fx * 0.6, b.y + 1.5, b.z - fz * 0.6, { count: 1, color: '#dfe6f0', speed: 1, up: 3, life: 0.6, size: 0.6, gravity: -1 });
      return;
    }
    if (this.burst > 0) {
      b.vx = damp(b.vx, 0, 10, dt);
      b.vz = damp(b.vz, 0, 10, dt);
      this.turnTo(Math.atan2(dx, dz), dt);
      this.burstT -= dt;
      if (this.burstT <= 0) {
        this.burstT = 0.32 / this.rate;
        this.burst -= 1;
        const from = new THREE.Vector3(b.x + fx * 0.8, b.y + 1.2, b.z + fz * 0.8);
        const speed = 9 * this.spd;
        this.world.shots.fire('enemy', from, this.lead(d / speed).sub(from).normalize(), speed, 1);
        this.world.soundAt('enemyShoot', this.body.x, this.body.z, 1.3, 22);
        if (this.burst === 0) this.ventT = 1.8;
      }
      return;
    }
    if (inView && this.coolT <= 0) {
      this.burst = 3;
      this.burstT = 0.5;
      this.coolT = 3.4 / this.rate;
      return;
    }
    if (this.aggro && d < 11) {
      this.turnTo(Math.atan2(dx, dz), dt);
      b.vx = damp(b.vx, 0, 8, dt);
      b.vz = damp(b.vz, 0, 8, dt);
      return;
    }
    // Patrol: roll forward until a wall or edge, then turn around.
    if (!this.safeAhead(this.dir[0], this.dir[1]) || b.bumped) this.dir = [-this.dir[0], -this.dir[1]];
    b.vx = this.dir[0] * 2.4 * this.spd;
    b.vz = this.dir[1] * 2.4 * this.spd;
    this.yaw = dampAngle(this.yaw, Math.atan2(this.dir[0], this.dir[1]), 6, dt);
  }
}

/* ---------------- Spitter Pod: artillery that aims where you're going ---------------- */

class Turret extends Enemy {
  private shootT = 1.5;

  constructor(world: World, id: string, x: number, y: number, z: number, variant?: string) {
    super(world, id, x, y, z, 3, 0.7, makeTurret(variant));
    this.bolts = 5;
    this.aimHeight = 1;
    this.kind = 'turret';
    this.badgeY = 2.3;
  }

  protected think(dt: number) {
    this.body.vx = 0;
    this.body.vz = 0;
    const d = this.distToPlayer();
    this.facePlayer(dt, 4);
    const head = this.model.parts.head;
    if (this.aggro && d < 14) {
      this.shootT -= dt;
      const swell = this.shootT < 0.5 ? 1 + (0.5 - this.shootT) * 0.5 : 1;
      head.scale.setScalar(swell);
      if (this.shootT <= 0) {
        this.shootT = 2.5 / this.rate;
        const b = this.body;
        const from = new THREE.Vector3(b.x, b.y + 1.3, b.z);
        const flight = Math.max(0.7, d / 9);
        // Lob at where Jason will be when the glob lands.
        const target = this.lead(flight);
        const spread = this.tier >= 2 ? [-0.35, 0, 0.35] : [0];
        for (const s of spread) {
          const g = 12;
          const ox = target.x - b.x;
          const oz = target.z - b.z;
          const vx = (ox * Math.cos(s) - oz * Math.sin(s)) / flight;
          const vz = (ox * Math.sin(s) + oz * Math.cos(s)) / flight;
          const vy = (target.y - 0.55 - from.y + 0.5 * g * flight * flight) / flight;
          const vel = new THREE.Vector3(vx, vy, vz);
          const speed = vel.length();
          this.world.shots.fire('enemy', from, vel.normalize(), speed, 1, g);
        }
        this.world.soundAt('enemyShoot', this.body.x, this.body.z, 0.7, 22);
      }
    } else {
      head.scale.setScalar(1 + Math.sin(this.t * 2) * 0.03);
    }
  }
}

/* ---------------- Horned Brute: charges, and stomps when it misses ---------------- */

class Brute extends Enemy {
  private state: 'walk' | 'wind' | 'charge' | 'dizzy' = 'walk';
  private stateT = 0;
  private cd = 1.5;
  private chargeDir: [number, number] = [0, 1];
  private calmGlow: THREE.Color;
  private calmGlowI: number;

  constructor(world: World, id: string, x: number, y: number, z: number, variant?: string) {
    super(world, id, x, y, z, 10, 1.1, makeBrute(variant));
    this.bolts = 15;
    this.heartChance = 0.7;
    this.aimHeight = 1.3;
    this.kind = 'brute';
    this.badgeY = 3.3;
    const skin = this.model.flash[0];
    this.calmGlow = skin.emissive.clone();
    this.calmGlowI = skin.emissiveIntensity;
  }

  protected canBeHit() {
    return true;
  }

  hit(dmg: number, kind: HitKind, from: THREE.Vector3): boolean {
    return super.hit(this.state === 'dizzy' ? dmg * 2 : dmg, kind, from);
  }

  protected think(dt: number) {
    const b = this.body;
    const p = this.player.body;
    const m = this.model;
    this.stateT -= dt;
    this.cd -= dt;
    const skin = m.flash[0];
    switch (this.state) {
      case 'walk': {
        if (!this.aggro) {
          b.vx = damp(b.vx, 0, 6, dt);
          b.vz = damp(b.vz, 0, 6, dt);
          break;
        }
        this.facePlayer(dt, 3);
        const dx = p.x - b.x;
        const dz = p.z - b.z;
        const d = Math.hypot(dx, dz) || 1;
        if (this.safeAhead(dx, dz) && d > 2) {
          b.vx = damp(b.vx, (dx / d) * 2.2 * this.spd, 4, dt);
          b.vz = damp(b.vz, (dz / d) * 2.2 * this.spd, 4, dt);
        } else {
          b.vx = damp(b.vx, 0, 6, dt);
          b.vz = damp(b.vz, 0, 6, dt);
        }
        const swing = Math.sin(this.t * 5);
        m.parts.armL.rotation.x = swing * 0.4;
        m.parts.armR.rotation.x = -swing * 0.4;
        if (d < 9 && this.cd <= 0) {
          this.state = 'wind';
          this.stateT = 0.9 / this.rate;
          this.chargeDir = [dx / d, dz / d];
          audio.play('roar');
        }
        break;
      }
      case 'wind':
        b.vx = damp(b.vx, 0, 10, dt);
        b.vz = damp(b.vz, 0, 10, dt);
        this.facePlayer(dt, 6);
        {
          // Aims its charge at where Jason is heading.
          const tgt = this.lead(0.35);
          const dx = tgt.x - b.x;
          const dz = tgt.z - b.z;
          const d = Math.hypot(dx, dz) || 1;
          this.chargeDir = [dx / d, dz / d];
        }
        skin.emissive.set('#ff3050');
        skin.emissiveIntensity = 0.4 + Math.abs(Math.sin(this.t * 20)) * 0.6;
        m.parts.armL.rotation.x = -2.4;
        m.parts.armR.rotation.x = -2.4;
        if (this.stateT <= 0) {
          this.state = 'charge';
          this.stateT = 1.3;
        }
        break;
      case 'charge':
        b.vx = this.chargeDir[0] * 11 * this.spd;
        b.vz = this.chargeDir[1] * 11 * this.spd;
        this.yaw = Math.atan2(this.chargeDir[0], this.chargeDir[1]);
        if (Math.random() < 0.5) this.world.particles.emit(b.x, b.y + 0.2, b.z, { count: 2, color: '#d8c8e8', speed: 2, life: 0.4, size: 0.6 });
        if (b.bumped || !this.safeAhead(this.chargeDir[0], this.chargeDir[1])) {
          b.vx = 0;
          b.vz = 0;
          this.state = 'dizzy';
          this.stateT = 2.2;
          this.world.shake(0.3);
          audio.play('pound');
        } else if (this.stateT <= 0) {
          this.state = 'walk';
          this.cd = 2 / this.rate;
          // Missed? It stomps the ground in anger.
          if (this.tier >= 1) {
            b.vx = 0;
            b.vz = 0;
            this.world.addEntity(new Shockwave(this.world, b.x, b.y, b.z, 7 + this.tier, 8, '#ff9a3d'));
            audio.play('pound');
            this.world.shake(0.4);
          }
        }
        break;
      case 'dizzy':
        b.vx = damp(b.vx, 0, 10, dt);
        b.vz = damp(b.vz, 0, 10, dt);
        this.yaw += dt * 3;
        if (Math.random() < 0.2) this.world.particles.emit(b.x, b.y + 2.6, b.z, { count: 1, color: '#ffd166', speed: 1.5, life: 0.5, size: 0.5, gravity: 0 });
        if (this.stateT <= 0) {
          this.state = 'walk';
          this.cd = 1.6 / this.rate;
        }
        break;
    }
    if (this.state !== 'wind' && this.flashT <= 0) {
      skin.emissive.copy(this.calmGlow);
      skin.emissiveIntensity = this.calmGlowI;
    }
    this.contact = this.state !== 'dizzy';
  }

  protected touchPlayer() {
    // A full-speed charge hits harder on the later decks.
    return super.touchPlayer(this.state === 'charge' && this.tier >= 3 ? 2 : 1);
  }
}

export function makeEnemy(world: World, id: string, kind: EnemyKind, cx: number, cz: number, h: number, variant?: string): Enemy {
  const x = cx * CELL + CELL / 2;
  const z = cz * CELL + CELL / 2;
  let e: Enemy;
  switch (kind) {
    case 'sporeling':
      e = new Sporeling(world, id, x, h, z, variant ?? 'default');
      break;
    case 'snapper':
      e = new Snapper(world, id, x, h, z, variant);
      break;
    case 'buzzer':
      e = new Buzzer(world, id, x, h, z, variant);
      break;
    case 'sentry':
      e = new Sentry(world, id, x, h, z, variant);
      break;
    case 'turret':
      e = new Turret(world, id, x, h, z, variant);
      break;
    case 'brute':
      e = new Brute(world, id, x, h, z, variant);
      break;
    case 'trooper':
    case 'minebot':
    case 'bulwark':
    case 'mortar':
      e = makeRobot(world, id, kind, x, h, z, variant);
      break;
    case 'harpy':
      e = makeHarpy(world, id, x, h, z);
      break;
    case 'crab':
      e = makeCrab(world, id, x, h, z);
      break;
    case 'jelly':
      e = makeJelly(world, id, x, h, z);
      break;
    case 'anvil':
      e = makeAnvilDrone(world, id, x, h, z);
      break;
    case 'coil':
      e = makeCoil(world, id, x, h, z);
      break;
    case 'ramling':
      e = makeRamling(world, id, x, h, z);
      break;
    case 'weeder':
      e = makeWeeder(world, id, x, h, z);
      break;
    case 'ringguard':
      e = makeRingGuard(world, id, x, h, z);
      break;
  }
  const d = world.difficulty;
  // From the third deck on, some enemies are elites: bigger, tougher, marked with a gold crown.
  const elite = d.tier >= 2 && hash01(id) < Math.min(0.4, 0.1 + d.tier * 0.04);
  e.empower(d, elite);
  return e;
}
