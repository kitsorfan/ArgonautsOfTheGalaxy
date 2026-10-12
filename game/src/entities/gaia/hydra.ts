import * as THREE from 'three';

import { audio } from '../../core/audio';
import { haptic } from '../../core/bridge';
import { damp, dampAngle } from '../../core/math';
import type { World } from '../../game/world';
import { Grid } from '../../world/grid';
import { Boss, bossHp } from '../bossBase';
import { Entity, type HitKind, type Target } from '../entity';
import { Shockwave, Strike } from '../hazards';
import { blobShadow, cone, glowSprite, mat, mesh, ownMat, sphere, torus } from '../models';

/**
 * THE THORN HYDRA — a thorny vine monster that grew out of the pollen in the swamp. A bulb-shaped
 * body sits in the middle of the pool, its glowing heart hidden behind a shell of thorny petals,
 * and three long necks reach out over the planks. Each head can bite (it rears back first), spit
 * arcing pollen globs, or rise up and slam down (a laser ring to hop over). Knock all three heads
 * down and the shell opens for a few seconds: the heart takes extra damage. Then the heads grow
 * back (weaker each time). Below half health, roots burst out of the floor around Jason too.
 */

const PINK = '#ff6fcf';
const HP = 42;
/** Health of each head the first time, and after they grow back. */
const HEAD_HP = 8;
const REGROW_HP = 3;
/** The open heart takes this much more from every hit (not double: it fell in one window). */
const HEART_BONUS = 1.5;
/** Seconds the heart stays open once all three heads are down. */
const OPEN_TIME = 4.5;
/** How far from the middle a bite or a slam can reach (world units). */
const REACH = 12.5;
const BEADS = 12;
/** Petal tilt when the shell is shut (leaning in over the heart). */
const SHUT = -0.32;

type HeadState = 'idle' | 'rear' | 'bite' | 'spit' | 'lift' | 'slam' | 'recover' | 'down' | 'grow';

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

/** One head on its long thorny neck: a sub-target that passes its damage on to the Hydra. */
class HydraHead extends Entity implements Target {
  readonly aim = new THREE.Vector3();
  radius = 1.05;
  aimable = false;
  hp = HEAD_HP;
  state: HeadState = 'idle';
  stateT = 0;
  /** 0 = a stump in the swamp, 1 = fully grown. */
  grow = 1;
  readonly pos = new THREE.Vector3();
  readonly base = new THREE.Vector3();
  /** Where a bite or a slam will land (locked in when the head winds up). */
  readonly strike = new THREE.Vector3();
  private goal = new THREE.Vector3();
  private beads: THREE.Mesh[] = [];
  private head = new THREE.Group();
  private jaw = new THREE.Group();
  private skin: THREE.MeshStandardMaterial;
  private eyes: THREE.MeshStandardMaterial;
  private mouth: THREE.MeshStandardMaterial;
  private flashT = 0;
  private bit = false;

  constructor(
    world: World,
    id: string,
    private hydra: Hydra,
    readonly slot: number,
  ) {
    super(world, id);
    this.skin = ownMat('#3f6a2a', { emissive: '#ff4fb8', ei: 0.08, rough: 0.6 });
    const thorn = mat('#5a1f3c', { rough: 0.6 });
    const vein = mat('#2f5a22', { rough: 0.7 });
    for (let i = 0; i < BEADS; i++) {
      const r = 0.62 - (i / BEADS) * 0.28;
      const b = mesh(sphere(r, 12), i % 3 === 1 ? vein : this.skin);
      // A ring of thorns on every other bead of the neck.
      if (i % 2 === 0) {
        for (let k = 0; k < 3; k++) {
          const a = (k / 3) * Math.PI * 2 + i;
          const th = mesh(cone(0.12, 0.55, 5), thorn, Math.cos(a) * r, Math.sin(a) * r, 0, false);
          th.rotation.z = a - Math.PI / 2;
          b.add(th);
        }
      }
      b.rotation.set(i * 0.7, i * 1.3, 0);
      this.beads.push(b);
      this.obj.add(b);
    }
    // The head is built facing +z so lookAt points the snout at Jason.
    const skull = mesh(sphere(0.75, 16), this.skin, 0, 0.1, 0);
    skull.scale.set(0.95, 0.75, 1.2);
    this.head.add(skull);
    const snout = mesh(cone(0.55, 1.3, 8), this.skin, 0, 0.12, 1.0);
    snout.rotation.x = Math.PI / 2;
    this.head.add(snout);
    this.mouth = ownMat('#ffd0f0', { emissive: PINK, ei: 1.2 });
    this.head.add(mesh(sphere(0.32, 10), this.mouth, 0, -0.12, 0.85, false));
    const lower = mesh(cone(0.45, 1.2, 8), vein, 0, 0, 0.6);
    lower.rotation.x = Math.PI / 2;
    this.jaw.add(lower);
    for (const sx of [-0.22, 0, 0.22]) {
      const fang = mesh(cone(0.07, 0.3, 4), mat('#fff4e8'), sx, 0.16, 0.9, false);
      this.jaw.add(fang);
    }
    this.jaw.position.set(0, -0.3, 0.1);
    this.head.add(this.jaw);
    this.eyes = ownMat('#fff0b0', { emissive: '#ffd166', ei: 1.4 });
    for (const sx of [-0.42, 0.42]) this.head.add(mesh(sphere(0.13, 8), this.eyes, sx, 0.35, 0.55, false));
    // A crown of pink-tipped thorns.
    for (let k = 0; k < 5; k++) {
      const th = mesh(cone(0.13, 0.75, 5), thorn, (k - 2) * 0.22, 0.55, -0.2 - Math.abs(k - 2) * 0.12, false);
      th.rotation.x = -0.7;
      this.head.add(th);
    }
    this.head.add(glowSprite(PINK, 2.4, 0.35));
    this.obj.add(this.head);
    world.addTarget(this);
  }

  /** True while the head is grown and can be hit. */
  get up() {
    return this.state !== 'down' && this.grow > 0.6;
  }

  hit(dmg: number, kind: HitKind): boolean {
    const h = this.hydra;
    if (!this.alive || !h.started || h.defeated || !this.up) return false;
    const d = Math.min(this.hp, kind === 'zap' ? Math.min(1, dmg) : dmg);
    this.hp -= d;
    h.damage(d);
    this.flashT = 0.15;
    audio.play('hit');
    if (this.hp <= 0 && !h.defeated) this.knockDown();
    return true;
  }

  private knockDown() {
    this.state = 'down';
    this.stateT = 0;
    audio.play('pop');
    this.world.particles.emit(this.pos.x, this.pos.y, this.pos.z, { count: 34, color: PINK, speed: 8, life: 0.9, size: 0.7 });
    this.world.particles.emit(this.pos.x, this.pos.y, this.pos.z, { count: 16, color: '#7dff9a', speed: 5, life: 0.7, size: 0.5 });
    this.world.hitStop(0.06);
    this.hydra.headDown();
  }

  /** Back to full health (after a knock-out, or to start the fight over). */
  restore() {
    this.hp = HEAD_HP;
    this.state = 'idle';
    this.stateT = 0;
    this.grow = 1;
    this.bit = false;
  }

  regrow() {
    this.hp = REGROW_HP;
    this.state = 'grow';
    this.stateT = 0;
  }

  /** Winds up an attack; the boss decides which. */
  start(kind: 'bite' | 'spit' | 'slam', target: THREE.Vector3) {
    this.state = kind === 'bite' ? 'rear' : kind === 'spit' ? 'spit' : 'lift';
    this.stateT = 0;
    this.bit = false;
    this.strike.copy(target);
    if (kind !== 'spit') audio.play('roar', kind === 'slam' ? 0.7 : 1.3);
  }

  get busy() {
    return this.state !== 'idle';
  }

  /** Moves the head and its neck; `idleGoal` is where it sways when it isn't attacking. */
  step(dt: number, base: THREE.Vector3, idleGoal: THREE.Vector3, playerAt: THREE.Vector3) {
    this.base.copy(base);
    this.stateT += dt;
    const h = this.hydra;
    let rate = 4;
    let open = 0.15;
    let glow = 1.2;
    switch (this.state) {
      case 'idle':
        this.goal.copy(idleGoal);
        break;
      case 'rear':
        // Pull back and up, mouth wide open: the bite is coming!
        this.goal.copy(idleGoal).lerp(base, 0.35).setY(idleGoal.y + 1.6);
        open = 0.9;
        glow = 2.5 + Math.sin(this.stateT * 30) * 0.8;
        rate = 6;
        if (this.stateT > 0.85) {
          this.state = 'bite';
          this.stateT = 0;
          audio.play('enemyShoot', 0.5);
        }
        break;
      case 'bite':
        this.goal.copy(this.strike);
        rate = 16;
        open = this.stateT < 0.25 ? 0.9 : 0;
        if (!this.bit && this.stateT > 0.22) {
          this.bit = true;
          const p = h.jason;
          if (Math.hypot(p.x - this.pos.x, p.z - this.pos.z) < 1.6 && Math.abs(p.y + 0.9 - this.pos.y) < 1.7) h.jasonHurt(this.pos);
          this.world.particles.emit(this.pos.x, this.pos.y - 0.5, this.pos.z, { count: 12, color: '#7dff9a', speed: 4, up: 2, life: 0.5 });
          this.world.shake(0.15);
        }
        // Stuck for a moment after the bite: a good time to blast it or SPIN it!
        if (this.stateT > 1.15) {
          this.state = 'recover';
          this.stateT = 0;
        }
        break;
      case 'spit':
        this.goal.copy(idleGoal).lerp(base, 0.2).setY(idleGoal.y + 0.8);
        open = this.stateT > 0.5 ? 1 : 0.3;
        glow = 1.5 + this.stateT * 3;
        if (!this.bit && this.stateT > 0.65) {
          this.bit = true;
          this.spit(playerAt);
        }
        if (this.stateT > 1.05) {
          this.state = 'recover';
          this.stateT = 0;
        }
        break;
      case 'lift':
        // Rise high above the spot it is going to slam (the pink circle on the floor).
        this.goal.copy(this.strike).setY(this.strike.y + 7);
        rate = 3.5;
        glow = 2 + Math.sin(this.stateT * 20) * 0.6;
        h.warn(this.slot, this.strike, Math.min(1, this.stateT / 1.1));
        if (this.stateT > 1.25) {
          this.state = 'slam';
          this.stateT = 0;
        }
        break;
      case 'slam':
        this.goal.copy(this.strike).setY(this.strike.y + 0.7);
        rate = 22;
        open = 0.6;
        if (!this.bit && this.stateT > 0.18) {
          this.bit = true;
          h.warn(this.slot, this.strike, 0);
          h.slammed(this.strike);
        }
        if (this.stateT > 1) {
          this.state = 'recover';
          this.stateT = 0;
        }
        break;
      case 'recover':
        this.goal.copy(idleGoal);
        rate = 3;
        if (this.stateT > 0.7) this.state = 'idle';
        break;
      case 'down':
        // A wilted stump that sinks into the swamp.
        this.goal.copy(base).lerp(idleGoal, 0.45).setY(h.water - 0.6);
        rate = 3;
        open = 0.6;
        glow = 0.1;
        this.grow = damp(this.grow, 0.12, 2.5, dt);
        break;
      case 'grow':
        this.goal.copy(idleGoal);
        rate = 2.5;
        this.grow = Math.min(1, this.grow + dt / 1.6);
        if (this.grow >= 1) this.state = 'idle';
        break;
    }
    if (h.defeated) {
      this.goal.copy(base).lerp(idleGoal, 0.6).setY(h.water - 1);
      this.grow = damp(this.grow, 0.05, 1.2, dt);
      rate = 1.5;
      glow = 0;
    }
    this.pos.x = damp(this.pos.x, this.goal.x, rate, dt);
    this.pos.y = damp(this.pos.y, this.goal.y, rate, dt);
    this.pos.z = damp(this.pos.z, this.goal.z, rate, dt);
    this.layout(open, glow, playerAt, dt);
    this.aim.copy(this.pos);
    this.aimable = h.started && !h.defeated && this.up;
  }

  /** Places the neck beads on a curve from the body to the head, and points the snout. */
  private layout(open: number, glow: number, playerAt: THREE.Vector3, dt: number) {
    const g = Math.max(0.05, this.grow);
    const b = this.base;
    // A shrunken neck pulls the head back toward the body.
    const head = tmp.copy(b).lerp(this.pos, g);
    const ctrl = tmp2.set(b.x + (head.x - b.x) * 0.25, Math.max(b.y, head.y) + 2.2 * g, b.z + (head.z - b.z) * 0.25);
    for (let i = 0; i < BEADS; i++) {
      const t = (i + 0.5) / BEADS;
      const u = 1 - t;
      const bead = this.beads[i];
      bead.position.set(u * u * b.x + 2 * u * t * ctrl.x + t * t * head.x, u * u * b.y + 2 * u * t * ctrl.y + t * t * head.y, u * u * b.z + 2 * u * t * ctrl.z + t * t * head.z);
      bead.scale.setScalar(0.35 + 0.65 * g);
    }
    this.head.position.copy(head);
    this.head.scale.setScalar(0.3 + 0.7 * g);
    if (this.state === 'down' || this.hydra.defeated) this.head.lookAt(head.x, head.y - 3, head.z + 0.01);
    else this.head.lookAt(this.state === 'bite' || this.state === 'slam' ? this.strike : playerAt);
    this.jaw.rotation.x = damp(this.jaw.rotation.x, open * 0.8, 12, dt);
    this.flashT -= dt;
    this.skin.emissiveIntensity = this.flashT > 0 ? 1.6 : 0.08;
    this.eyes.emissiveIntensity = damp(this.eyes.emissiveIntensity, glow, 8, dt);
    this.mouth.emissiveIntensity = damp(this.mouth.emissiveIntensity, glow, 8, dt);
  }

  /** Lobs a glob of pollen (three when the Hydra is angry) at where Jason is going. */
  private spit(playerAt: THREE.Vector3) {
    const h = this.hydra;
    const from = this.pos.clone();
    const p = h.jason;
    const d = Math.hypot(p.x - from.x, p.z - from.z);
    const flight = Math.max(0.8, d / 9);
    const g = 12;
    const tx = p.x + p.vx * flight * 0.8;
    const tz = p.z + p.vz * flight * 0.8;
    const spread = h.angry ? [-0.3, 0, 0.3] : [0];
    for (const s of spread) {
      const ox = tx - from.x;
      const oz = tz - from.z;
      const vx = (ox * Math.cos(s) - oz * Math.sin(s)) / flight;
      const vz = (ox * Math.sin(s) + oz * Math.cos(s)) / flight;
      const vy = (playerAt.y - 0.2 - from.y + 0.5 * g * flight * flight) / flight;
      const vel = new THREE.Vector3(vx, vy, vz);
      const speed = vel.length();
      this.world.shots.fire('enemy', from, vel.normalize(), speed, 1, g);
    }
    this.world.soundAt('enemyShoot', from.x, from.z, 0.6, 30);
    this.world.particles.emit(from.x, from.y, from.z, { count: 10, color: '#ffe066', speed: 3, life: 0.5, size: 0.5 });
  }
}

type HydraState = 'fight' | 'open';

export class Hydra extends Boss implements Target {
  readonly title = 'THE THORN HYDRA';
  protected focusHeight = 3.6;
  readonly aim = new THREE.Vector3();
  radius = 1.7;
  aimable = false;
  private heads: HydraHead[] = [];
  private model = new THREE.Group();
  private petals: THREE.Object3D[] = [];
  private core: THREE.MeshStandardMaterial;
  private coreGlow: THREE.Sprite;
  private discs: THREE.Mesh[] = [];
  private state: HydraState = 'fight';
  private stateT = 0;
  private attackT = 2;
  private turn = 0;
  private yaw = 0;
  private regrows = 0;
  private warnedRoots = false;
  /** 0 = hidden under the swamp, 1 = risen (the entrance). */
  private rise = 0;
  private rising = false;
  private flowers = new THREE.Group();
  private readonly cx: number;
  private readonly cz: number;
  private readonly playerAt = new THREE.Vector3();
  private readonly bases = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private readonly goals = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];

  constructor(world: World, id: string, cx: number, cz: number, h: number) {
    super(world, id, cx, cz, h, bossHp(world, HP));
    this.cx = cx;
    this.cz = cz;
    const m = this.model;
    const bark = mat('#2f4a22', { rough: 0.75 });
    const moss = mat('#4a7a2a', { rough: 0.8 });
    const thorn = mat('#5a1f3c', { rough: 0.6 });
    // The bulb: a big mossy body half sunk in the swamp.
    const body = mesh(sphere(2.3, 22), bark, 0, 0.3, 0);
    body.scale.set(1, 0.8, 1);
    m.add(body);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const lump = mesh(sphere(0.8, 10), moss, Math.cos(a) * 1.9, 0.6 + (i % 2) * 0.5, Math.sin(a) * 1.9);
      lump.scale.set(1, 0.6, 1);
      m.add(lump);
      const th = mesh(cone(0.22, 1.1, 5), thorn, Math.cos(a + 0.3) * 2.1, 1.4, Math.sin(a + 0.3) * 2.1);
      th.lookAt(Math.cos(a + 0.3) * 6, 2.4, Math.sin(a + 0.3) * 6);
      th.rotateX(Math.PI / 2);
      m.add(th);
    }
    // Roots spreading out under the water.
    for (let i = 0; i < 5; i++) {
      const root = mesh(torus(2.8 + i * 0.5, 0.16), bark, 0, 0.15, 0);
      root.rotation.x = Math.PI / 2 + (i % 2 ? 0.08 : -0.08);
      root.rotation.y = i;
      m.add(root);
    }
    // The heart, hidden inside a shell of thorny petals.
    this.core = ownMat('#ffc6ef', { emissive: PINK, ei: 0.5, rough: 0.2 });
    m.add(mesh(sphere(1.05, 20), this.core, 0, 2.5, 0));
    this.coreGlow = glowSprite(PINK, 6, 0.2);
    this.coreGlow.position.set(0, 2.5, 0);
    m.add(this.coreGlow);
    const petal = mat('#4a1a3a', { emissive: '#ff4fb8', ei: 0.12, rough: 0.5 });
    for (let i = 0; i < 8; i++) {
      // Each petal hinges at its foot; its local +z points away from the heart.
      const pivot = new THREE.Group();
      const a = (i / 8) * Math.PI * 2;
      pivot.position.set(Math.cos(a) * 1.15, 1.5, Math.sin(a) * 1.15);
      pivot.rotation.y = -a + Math.PI / 2;
      const leaf = new THREE.Group();
      const p = mesh(sphere(1, 12), petal, 0, 1.1, 0);
      p.scale.set(0.6, 1.25, 0.18);
      leaf.add(p, mesh(cone(0.14, 0.7, 5), thorn, 0, 2.5, 0, false));
      leaf.rotation.x = SHUT;
      pivot.add(leaf);
      this.petals.push(leaf);
      m.add(pivot);
    }
    m.add(blobShadow(7));
    m.add(glowSprite(PINK, 10, 0.18).translateY(2.5));
    m.position.copy(this.center);
    this.obj.add(m);
    this.obj.add(this.flowers);
    // Warning circles for the slams (one per head).
    for (let i = 0; i < 3; i++) {
      const disc = new THREE.Mesh(new THREE.CircleGeometry(1.9, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: PINK, transparent: true, opacity: 0, depthWrite: false }));
      disc.visible = false;
      this.discs.push(disc);
      this.obj.add(disc);
    }
    for (let i = 0; i < 3; i++) this.heads.push(world.addEntity(new HydraHead(world, `${id}.head${i}`, this, i)));
    this.placeBases();
    for (let i = 0; i < 3; i++) {
      this.idleGoal(i, this.goals[i]);
      this.heads[i].pos.copy(this.goals[i]);
    }
    this.setRise(0);
    // The body fills the mud mound in the middle, so Jason can never stand on it.
    world.boxes.push({ minX: this.center.x - 1.1, maxX: this.center.x + 1.1, minZ: this.center.z - 1.1, maxZ: this.center.z + 1.1, bottom: h - 1, top: h + 3, solid: true, dx: 0, dy: 0, dz: 0 });
    world.addTarget(this);
  }

  /** The swamp's surface (the Hydra stands in it). */
  get water() {
    return this.center.y;
  }

  get jason() {
    return this.player.body;
  }

  get angry() {
    return this.hp <= this.maxHp / 2;
  }

  jasonHurt(from: THREE.Vector3) {
    this.player.hurt(1, from.x, from.z);
  }

  /** Called by a head when it gets knocked down. */
  headDown() {
    this.world.shake(0.3);
    if (this.heads.every((h) => h.state === 'down') && this.state === 'fight') {
      this.state = 'open';
      this.stateT = OPEN_TIME;
      audio.play('vent');
      haptic('medium');
      this.world.hooks.toast('All three heads are down! Its heart is open: blast it now!', 'bolt');
    }
  }

  /** Shows (or hides) a slam's warning circle. */
  warn(slot: number, at: THREE.Vector3, k: number) {
    const d = this.discs[slot];
    d.visible = k > 0;
    d.position.set(at.x, at.y + 0.06, at.z);
    (d.material as THREE.MeshBasicMaterial).opacity = 0.2 + k * 0.4 + (k > 0.7 ? Math.sin(this.t * 30) * 0.12 : 0);
  }

  /** A head crashes into the floor: a hit right there, and a ring of light that Jason hops over. */
  slammed(at: THREE.Vector3) {
    const p = this.jason;
    if (Math.hypot(p.x - at.x, p.z - at.z) < 1.9 + p.r && p.y < at.y + 1.6) this.player.hurt(1, at.x, at.z);
    this.world.addEntity(new Shockwave(this.world, at.x, at.y, at.z, 7.5, 8, PINK));
    audio.play('pound');
    this.world.shake(0.45);
    this.world.particles.emit(at.x, at.y + 0.3, at.z, { count: 26, color: '#7dff9a', speed: 7, up: 4, life: 0.7, size: 0.6 });
    this.world.rings.burst(at.x, at.y + 0.1, at.z, 3, PINK, 0.4);
  }

  hit(dmg: number, kind: HitKind): boolean {
    if (!this.started || this.defeated) return true;
    if (this.state !== 'open') {
      // The shell of thorny petals keeps the heart safe.
      audio.play('zap', 1.7);
      return true;
    }
    this.damage((kind === 'zap' ? Math.min(1, dmg) : dmg) * HEART_BONUS);
    this.core.emissiveIntensity = 4;
    this.world.flash(this.aim.x, this.aim.y, this.aim.z, PINK, 40, 0.2);
    audio.play('hit');
    return true;
  }

  reset() {
    this.hp = this.maxHp;
    this.state = 'fight';
    this.stateT = 0;
    this.attackT = 2;
    this.turn = 0;
    this.warnedRoots = false;
    for (const h of this.heads) h.restore();
    for (let i = 0; i < 3; i++) this.warn(i, this.center, 0);
  }

  protected onIntro() {
    this.rising = true;
    audio.play('roar', 0.6);
  }

  protected onStart() {
    this.rise = 1;
    this.setRise(1);
    this.world.hooks.toast('Blast its heads! When all three are down, its heart opens up.', 'bolt');
  }

  protected finish() {
    super.finish();
    for (let i = 0; i < 3; i++) this.warn(i, this.center, 0);
    // The jungle heals: the Hydra crumbles into a ring of flowers floating on the swamp.
    const colors = [PINK, '#ffd166', '#5ee0ff', '#7dff9a', '#ffffff'];
    const c = this.center;
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + Math.random() * 0.3;
      const r = 2 + Math.random() * 5.5;
      const f = new THREE.Group();
      f.add(mesh(new THREE.CircleGeometry(0.7, 12).rotateX(-Math.PI / 2), mat('#3f9a4a', { rough: 0.8 }), 0, 0.02, 0, false));
      const col = colors[i % colors.length];
      const petal = mat(col, { emissive: col, ei: 0.5 });
      for (let k = 0; k < 5; k++) {
        const pa = (k / 5) * Math.PI * 2;
        const pm = mesh(sphere(0.22, 8), petal, Math.cos(pa) * 0.25, 0.12, Math.sin(pa) * 0.25, false);
        pm.scale.set(1, 0.4, 1);
        f.add(pm);
      }
      f.add(mesh(sphere(0.12, 8), mat('#fff0b0', { emissive: '#ffd166', ei: 1 }), 0, 0.18, 0, false));
      f.position.set(c.x + Math.cos(a) * r, c.y + 0.05, c.z + Math.sin(a) * r);
      f.scale.setScalar(0.01);
      this.flowers.add(f);
    }
    for (let i = 0; i < 5; i++) this.world.particles.emit(c.x, c.y + 1 + i, c.z, { count: 30, color: colors[i], speed: 7, life: 1.4, size: 0.6 });
  }

  /** Where each neck grows out of the body (turning with the body). */
  private placeBases() {
    const c = this.center;
    const lift = (this.rise - 1) * 4;
    for (let i = 0; i < 3; i++) {
      const a = this.yaw + (i - 1) * 1.0;
      this.bases[i].set(c.x + Math.sin(a) * 1.5, c.y + 1.7 + lift, c.z + Math.cos(a) * 1.5);
    }
  }

  /** Where a head sways while it waits: fanned out in front of the body, toward Jason. */
  private idleGoal(i: number, out: THREE.Vector3) {
    const c = this.center;
    const a = this.yaw + (i - 1) * 0.95;
    const r = i === 1 ? 4.6 : 4.2;
    const lift = (this.rise - 1) * 6;
    return out.set(c.x + Math.sin(a) * r, c.y + (i === 1 ? 5.4 : 4.6) + Math.sin(this.t * 1.7 + i * 2) * 0.35 + lift, c.z + Math.cos(a) * r);
  }

  private setRise(k: number) {
    this.model.position.y = this.center.y - (1 - k) * 4.2;
    for (const h of this.heads) if (!h.busy) h.grow = Math.max(0.05, k);
  }

  /** Floor height at a point (planks and islands), for strikes and slams. */
  private floorAt(x: number, z: number) {
    const cell = this.world.grid.cell(Grid.toCell(x), Grid.toCell(z));
    return cell.kind === 'void' || cell.kind === 'wall' || cell.kind === 'hazard' ? 0 : cell.h;
  }

  /** Jason's spot pulled in to the heads' reach, on the floor. */
  private target(out: THREE.Vector3) {
    const c = this.center;
    const p = this.jason;
    let dx = p.x - c.x;
    let dz = p.z - c.z;
    const d = Math.hypot(dx, dz) || 1;
    if (d > REACH) {
      dx *= REACH / d;
      dz *= REACH / d;
    }
    const x = c.x + dx;
    const z = c.z + dz;
    return out.set(x, this.floorAt(x, z), z);
  }

  private attack() {
    const ready = this.heads.filter((h) => h.state === 'idle' && h.grow >= 1);
    if (!ready.length) return;
    this.turn += 1;
    const head = ready[this.turn % ready.length];
    const p = this.jason;
    const d = Math.hypot(p.x - this.center.x, p.z - this.center.z);
    const to = this.target(new THREE.Vector3());
    if (this.turn % 4 === 0) {
      head.start('slam', to);
    } else if (d < REACH + 0.5 && this.turn % 2 === 1) {
      head.start('bite', to.setY(to.y + 0.9));
    } else {
      head.start('spit', to);
    }
    if (this.angry && this.turn % 3 === 0) this.roots();
  }

  /** Below half health: thorny roots burst up around Jason (pink circles warn where). */
  private roots() {
    if (!this.warnedRoots) {
      this.warnedRoots = true;
      this.world.hooks.toast('Roots are bursting out of the ground! Keep moving!', 'bolt');
    }
    const p = this.jason;
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = i === 0 ? 0 : 2 + Math.random() * 2.5;
      const x = p.x + Math.cos(a) * r;
      const z = p.z + Math.sin(a) * r;
      this.world.addEntity(new Strike(this.world, x, this.floorAt(x, z), z, 1.25, 1.1, PINK, 'ice'));
    }
  }

  private spawnHelpers() {
    if (this.regrows > 2) return;
    // Two little sporelings crawl out onto the planks.
    for (const side of [-1, 1]) {
      const a = this.yaw + side * 1.6;
      for (let r = 5; r <= 7; r++) {
        const cx = this.cx + Math.round(Math.sin(a) * r);
        const cz = this.cz + Math.round(Math.cos(a) * r);
        const cell = this.world.grid.cell(cx, cz);
        if (cell.kind !== 'floor' && cell.kind !== 'grate') continue;
        const e = this.world.spawnEnemy('sporeling', cx, cz, 'jungle');
        e.room = undefined;
        break;
      }
    }
  }

  update(dt: number) {
    this.t += dt;
    const c = this.center;
    const p = this.jason;
    this.playerAt.set(p.x, p.y + 1.05, p.z);
    if (!this.defeated && (this.started || this.rising)) this.yaw = dampAngle(this.yaw, Math.atan2(p.x - c.x, p.z - c.z), this.state === 'open' ? 0.5 : 1.6, dt);
    this.model.rotation.y = this.yaw;
    if (!this.started && !this.defeated) {
      if (this.rising) {
        this.rise = Math.min(1, this.rise + dt / 2.6);
        this.setRise(this.rise);
        if (Math.random() < 0.6) this.world.particles.emit(c.x + (Math.random() - 0.5) * 6, c.y + 0.2, c.z + (Math.random() - 0.5) * 6, { count: 2, color: '#9dff3a', speed: 3, up: 3, life: 0.6, size: 0.6 });
      } else if (Math.random() < 0.08) {
        // Something big is bubbling under the swamp...
        this.world.particles.emit(c.x + (Math.random() - 0.5) * 5, c.y + 0.1, c.z + (Math.random() - 0.5) * 5, { count: 3, color: '#c6ff7a', speed: 1.5, up: 2, life: 0.8, size: 0.7, gravity: 0 });
      }
      this.stepHeads(dt);
      if (this.playerDist() < 17) this.begin();
      return;
    }
    this.stepHeads(dt);
    if (this.defeated) {
      this.model.position.y = damp(this.model.position.y, c.y - 3.6, 0.8, dt);
      this.model.scale.setScalar(damp(this.model.scale.x, 0.6, 0.8, dt));
      for (const pe of this.petals) pe.rotation.x = damp(pe.rotation.x, 1.6, 2, dt);
      for (const f of this.flowers.children) {
        f.scale.setScalar(damp(f.scale.x, 1, 2.5, dt));
        f.rotation.y += dt * 0.3;
      }
      return;
    }
    this.stateT -= dt;
    switch (this.state) {
      case 'fight':
        this.attackT -= dt;
        if (this.attackT <= 0) {
          this.attack();
          this.attackT = this.angry ? 1.5 : 2.1;
        }
        break;
      case 'open':
        if (Math.random() < 0.4) this.world.particles.emit(c.x, c.y + 2.6, c.z, { count: 2, color: '#ffe066', speed: 2.5, up: 3, life: 0.6, size: 0.5, gravity: 0 });
        if (this.stateT <= 0) {
          // The heads grow back, a little weaker each time.
          this.state = 'fight';
          this.attackT = 2.2;
          this.regrows += 1;
          for (const h of this.heads) h.regrow();
          audio.play('roar');
          this.world.shake(0.4);
          this.world.hooks.toast('The heads are growing back! Knock them down again!', 'bolt');
          this.spawnHelpers();
        }
        break;
    }
    const open = this.state === 'open';
    for (const pe of this.petals) pe.rotation.x = damp(pe.rotation.x, open ? 1.15 : SHUT, 5, dt);
    this.core.emissiveIntensity = damp(this.core.emissiveIntensity, open ? 1.8 + Math.sin(this.t * 10) * 0.5 : 0.5, 6, dt);
    this.coreGlow.material.opacity = damp(this.coreGlow.material.opacity, open ? 0.7 : 0.2, 5, dt);
    this.aimable = open;
    this.aim.set(c.x, this.model.position.y + 2.5, c.z);
    // Jason shouldn't be this close (it's the middle of the swamp), but just in case.
    if (Math.hypot(p.x - c.x, p.z - c.z) < 2.8 && p.y < c.y + 4) this.player.hurt(1, c.x, c.z);
  }

  private stepHeads(dt: number) {
    this.placeBases();
    for (let i = 0; i < 3; i++) this.heads[i].step(dt, this.bases[i], this.idleGoal(i, this.goals[i]), this.playerAt);
  }
}
