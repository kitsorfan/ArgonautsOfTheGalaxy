import * as THREE from 'three';

import { audio } from '../../core/audio';
import { haptic } from '../../core/bridge';
import { damp } from '../../core/math';
import type { World } from '../../game/world';
import { Grid } from '../../world/grid';
import { Boss, bossHp } from '../bossBase';
import type { Enemy } from '../enemies';
import { Entity, type HitKind, type Target } from '../entity';
import { InstancedParts } from '../instanced';
import { mat, mesh, sphere } from '../models';
import { pointBlocked } from '../../world/physics';
import { BeamFx, labWorld, traceBeam, type BeamCatcher } from './beams';
import { LAB } from './gaze';
import { makeMedusaModel, MEDUSA_EYE_Y } from './medusaModel';

/**
 * MEDUSA (chapter 3, Medusa's Labyrinth): Aeëtes's security AI, a giant gold mask with one great
 * green eye and a crown of cable snakes, watching over the gate to Colchis. She needs BOTH heroes:
 * - Her GAZE sweeps across the hall (the eye glows and hums first). It turns whoever it touches to
 *   stone for a moment. Hide behind a pillar... or, as Jason, raise the MIRROR SHIELD and face her:
 *   the gaze bounces straight back into her own eye and she is DAZZLED, eye wide open and wobbly.
 *   Only then does her eye take hits (blaster, fireballs and arrows).
 * - Between glares her CABLE SNAKES strike: a green ring on the floor, a snake rears over it, then
 *   slams down. Keep moving.
 * - From under 60% health she ties her snakes in a KNOT over her eye after every glare and calls cable
 *   snakes from the walls. Only Atalanta's POWER ARROW unties the knot, and that makes her so cross she
 *   glares at once: switch to Jason and bounce it back!
 */

const HP = 30;
const DAZE = 6;
const CHARGE = 2;
const SWEEP = 3.2;
const SWEEP_ANGRY = 2.5;
/** How far either side of straight ahead her gaze sweeps (radians). */
const ARC = 1.05;

type State = 'idle' | 'snakes' | 'charge' | 'gaze' | 'dazed' | 'wake' | 'tie';

const tmp = new THREE.Vector3();
const NO_BOXES: never[] = [];
/** A strike's floor ring and its beads (one sphere, scaled per bead), shared by every strike. */
const RING_GEO = new THREE.RingGeometry(0.2, 1.3, 32).rotateX(-Math.PI / 2);
const BEAD_R = 0.34;

/** A cable snake striking from MEDUSA's head: a green ring on the floor, the snake rears over it, then slams down. */
class SnakeStrike extends Entity {
  private t = 0;
  private beads: THREE.Mesh[] = [];
  private disc: THREE.Mesh;
  /** The beads are drawn as a few instanced meshes (a strike has 26 of them, and there are often four strikes at once). */
  private parts: InstancedParts;
  private hitDone = false;
  private from: THREE.Vector3;
  private to: THREE.Vector3;

  constructor(
    world: World,
    from: THREE.Vector3,
    to: THREE.Vector3,
    private delay: number,
  ) {
    super(world, `strike${Math.random()}`);
    this.from = from.clone();
    this.to = to.clone();
    this.disc = new THREE.Mesh(RING_GEO, new THREE.MeshBasicMaterial({ color: LAB.gaze, transparent: true, opacity: 0.4, depthWrite: false, toneMapped: false }));
    this.disc.position.set(to.x, to.y + 0.06, to.z);
    this.obj.add(this.disc);
    const gold = mat(LAB.gold, { metal: 0.7, rough: 0.3 });
    const dark = mat('#3a3a2a', { metal: 0.5, rough: 0.5 });
    for (let i = 0; i < 26; i++) {
      const b = mesh(sphere(BEAD_R, 8), i % 3 === 2 ? dark : gold, 0, 0, 0, false);
      b.scale.setScalar((BEAD_R - i * 0.004) / BEAD_R);
      this.beads.push(b);
      this.obj.add(b);
    }
    const head = this.beads[this.beads.length - 1];
    // The eyes are placed as on a plain bead of the head's size, before it is stretched into a head.
    const k = 1 / head.scale.x;
    head.scale.multiply(tmp.set(1.5, 1.1, 1.9));
    const eye = mat('#c8ffd8', { emissive: LAB.gaze, ei: 2.5 });
    for (const sx of [-1, 1]) {
      const e = mesh(sphere(0.07, 6), eye, sx * 0.13 * k, 0.09 * k, 0.14 * k, false);
      e.scale.setScalar(k);
      head.add(e);
    }
    this.parts = new InstancedParts(this.beads);
    this.obj.add(this.parts.group);
  }

  remove() {
    super.remove();
    this.parts.dispose();
    (this.disc.material as THREE.Material).dispose();
  }

  update(dt: number) {
    this.t += dt;
    const w = this.world;
    const k = Math.min(1, this.t / this.delay);
    const slam = this.t > this.delay ? Math.min(1, (this.t - this.delay) / 0.15) : 0;
    const back = this.t > this.delay + 0.5 ? Math.min(1, (this.t - this.delay - 0.5) / 0.5) : 0;
    (this.disc.material as THREE.MeshBasicMaterial).opacity = (0.25 + k * 0.5 + (k > 0.7 ? Math.sin(this.t * 30) * 0.15 : 0)) * (1 - back);
    // The snake arcs out of her hair, rears up over the ring, then slams down; then it pulls back.
    const reach = Math.min(1, k * 1.6) * (1 - back);
    const hover = tmp.copy(this.to).setY(this.to.y + 3.2 * (1 - slam) + 0.3);
    const n = this.beads.length;
    for (let i = 0; i < n; i++) {
      const f = ((i + 1) / n) * reach;
      const b = this.beads[i];
      b.position.lerpVectors(this.from, hover, f);
      b.position.y += Math.sin(f * Math.PI) * 2.5 + Math.sin(this.t * 8 + i) * 0.12 * (1 - slam);
      b.visible = reach > 0.02;
    }
    const head = this.beads[n - 1];
    head.lookAt(this.to);
    this.obj.updateMatrixWorld(true);
    this.parts.sync();
    if (slam >= 1 && !this.hitDone) {
      this.hitDone = true;
      const p = w.player.body;
      if (Math.hypot(p.x - this.to.x, p.z - this.to.z) < 1.3 + p.r && p.y < this.to.y + 1.8) w.player.hurt(1, this.to.x, this.to.z);
      audio.play('pound', 1.3);
      w.particles.emit(this.to.x, this.to.y + 0.3, this.to.z, { count: 20, color: LAB.gaze, speed: 6, up: 3, life: 0.5, size: 0.5 });
      w.shake(0.12);
    }
    if (back >= 1) this.remove();
  }
}

export class Medusa extends Boss implements Target, BeamCatcher {
  readonly title = 'MEDUSA';
  protected focusHeight = MEDUSA_EYE_Y;
  readonly aim = new THREE.Vector3();
  radius = 1.7;
  aimable = false;
  /** Her eye, as a beam catcher. */
  readonly pos = new THREE.Vector3();
  private m = makeMedusaModel();
  private beam = new BeamFx(LAB.gaze);
  /** While her eye charges: a faint aiming line where the glare will start. */
  private sight = new BeamFx(LAB.gaze);
  /** Her crown's hundred-odd snake beads, drawn as a few instanced meshes. */
  private crown: InstancedParts;
  private state: State = 'idle';
  private stateT = 0;
  private floorY: number;
  private yaw = 0;
  private sweepFrom = -ARC;
  private sweepTo = ARC;
  private strikes = 0;
  private strikeT = 0;
  /** Tied snakes over her eye (from the second half of the fight). */
  private hooded = false;
  private flashT = 0;
  private daze = 0;
  private hinted = { glare: false, daze: false, armour: false, knot: false };
  private helpers: Enemy[] = [];
  private dir = new THREE.Vector3();
  private origin = new THREE.Vector3();

  constructor(world: World, id: string, cx: number, cz: number, h: number) {
    super(world, id, cx, cz, h, bossHp(world, HP));
    this.floorY = h;
    this.m.root.position.set(this.center.x, h, this.center.z);
    this.crown = new InstancedParts(this.m.snakes.map((s) => s.group));
    this.obj.add(this.m.root, this.beam.group, this.sight.group, this.crown.group);
    world.boxes.push({ minX: this.center.x - 2.2, maxX: this.center.x + 2.2, minZ: this.center.z - 2.2, maxZ: this.center.z + 2.2, bottom: h, top: h + 2.8, solid: true, dx: 0, dy: 0, dz: 0, owner: this });
    world.addTarget(this);
    labWorld(world).catchers.push(this);
    this.sync(0);
  }

  get size() {
    return 3;
  }

  /** She never leaves her plinth: the fight camera keeps her head in view. */
  get frame(): THREE.Vector3 {
    return this.focus;
  }

  private get angry() {
    return this.hp <= this.maxHp * 0.6;
  }

  /** Her eye catches beams only while it is open and glaring. */
  get catching() {
    return this.started && !this.defeated && (this.state === 'gaze' || this.state === 'charge');
  }

  private set(state: State, t: number) {
    const was = this.state;
    this.state = state;
    this.stateT = t;
    if (state !== 'charge') this.sight.hide();
    // The on-screen warning stays up from the first glow of her eye to the end of the glare.
    const glaring = state === 'charge' || state === 'gaze';
    if (glaring === (was === 'charge' || was === 'gaze')) return;
    if (glaring) this.world.hooks.warn?.('MEDUSA’S GAZE! Hide behind a pillar, or raise the MIRROR SHIELD!');
    else this.world.hooks.warn?.(null);
  }

  protected onStart() {
    this.set('snakes', 1);
    this.strikes = 2;
    this.strikeT = 0.6;
    audio.play('roar', 0.6);
  }

  reset() {
    this.hp = this.maxHp;
    this.hooded = false;
    this.set('idle', 0);
    this.beam.hide();
    this.world.hooks.warn?.(null);
    for (const e of this.helpers) if (e.alive) e.die();
    this.helpers = [];
  }

  /** Her own gaze bounced back into her eye: dazzled! */
  catchBeam(_dt: number, bounced: boolean) {
    if (!bounced || this.state !== 'gaze') return;
    const w = this.world;
    this.set('dazed', DAZE);
    this.beam.hide();
    audio.play('explode', 1.4);
    audio.play('roar', 1.6, 0.7);
    haptic('heavy');
    w.shake(0.5);
    w.hitStop(0.08);
    w.flash(this.pos.x, this.pos.y, this.pos.z, '#ffffff', 70, 0.5);
    w.particles.emit(this.pos.x, this.pos.y, this.pos.z, { count: 50, color: '#e6ffe8', speed: 9, life: 0.8, size: 0.7 });
    if (!this.hinted.daze) {
      this.hinted.daze = true;
      w.hooks.toast('Dazzled by her own gaze! Her eye is open: hit it, quick!', 'bolt');
    }
  }

  powerArrow(dmg: number): boolean {
    if (!this.started || this.defeated) return true;
    if (this.hooded && this.state !== 'dazed') {
      this.untie();
      return true;
    }
    return this.hit(dmg * 1.5, 'shot');
  }

  hit(dmg: number, kind: HitKind): boolean {
    if (!this.started || this.defeated) return true;
    const w = this.world;
    if (this.state !== 'dazed') {
      audio.play('zap', 1.6);
      w.particles.emit(this.aim.x, this.aim.y, this.aim.z, { count: 6, color: '#ffe08a', speed: 3, life: 0.25, size: 0.35 });
      if (kind === 'zap') return true;
      if (this.hooded && !this.hinted.knot) {
        this.hinted.knot = true;
        w.hooks.toast('Her snakes are tied in a knot over her eye! Only Atalanta’s POWER ARROW can untie it: hold BOW!', 'iris');
      } else if (!this.hooded && !this.hinted.armour) {
        this.hinted.armour = true;
        w.hooks.toast('Her eye is too tough! Bounce her own gaze back at her with the MIRROR SHIELD first.', 'bolt');
      }
      return true;
    }
    this.damage(kind === 'blast' ? dmg + 2 : dmg);
    this.flashT = 0.15;
    w.flash(this.aim.x, this.aim.y, this.aim.z, LAB.gaze, 30, 0.2);
    audio.play('hit');
    return true;
  }

  /** Atalanta's power arrow pulls the knot apart, and MEDUSA glares at once in a rage. */
  private untie() {
    const w = this.world;
    this.hooded = false;
    audio.play('charged', 1.2);
    audio.play('roar', 1.3);
    w.particles.emit(this.aim.x, this.aim.y, this.aim.z, { count: 30, color: '#5fe0c8', speed: 7, life: 0.6, size: 0.55 });
    w.rings.burst(this.center.x, this.floorY + 0.05, this.center.z, 6, '#5fe0c8', 0.4);
    this.startCharge(1.3);
    w.hooks.toast('Knot untied! Now she’s glaring: switch to Jason and bounce it back!', 'atalanta');
  }

  private startCharge(t = CHARGE) {
    this.set('charge', t);
    audio.play('charge', 0.6);
    audio.play('alarm', 0.8);
    haptic('warning');
    // Sweep from one side to the other, starting on the side away from the hero.
    const p = this.player.body;
    const side = Math.sign(p.x - this.center.x) || 1;
    this.sweepFrom = side > 0 ? -ARC : ARC;
    this.sweepTo = -this.sweepFrom;
    const w = this.world;
    if (!this.hinted.glare) {
      this.hinted.glare = true;
      w.hooks.toast('Her eye is glowing: she’s about to GLARE! Hide behind a pillar, or HOLD SPIN as Jason and face her with the Mirror Shield!', 'bolt');
    }
  }

  /** Below 60% she ties her snakes over her eye after a glare, and calls cable snakes out of the walls. */
  private tie() {
    this.hooded = true;
    this.set('tie', 1);
    audio.play('shield', 0.7);
    const w = this.world;
    if (!this.hinted.knot) {
      this.hinted.knot = true;
      w.hooks.toast('Her snakes are tied in a knot over her eye! Only Atalanta’s POWER ARROW can untie it: hold BOW!', 'iris');
    }
    this.helpers = this.helpers.filter((e) => e.alive);
    for (let i = this.helpers.length; i < 2; i++) {
      const sx = i % 2 ? 1 : -1;
      const cx = Grid.toCell(this.center.x + sx * 6);
      const cz = Grid.toCell(this.center.z + 4);
      this.helpers.push(w.spawnEnemy('coil', cx, cz));
    }
  }

  update(dt: number) {
    this.t += dt;
    const w = this.world;
    if (!this.started) {
      if (!this.defeated && this.playerDist() < 24 && Math.abs(this.player.body.y - this.floorY) < 4) this.begin();
      this.sync(dt);
      return;
    }
    if (this.defeated) {
      if (this.state !== 'idle') this.set('idle', 0);
      this.beam.hide();
      this.hooded = false;
      // Her cable snakes go to sleep with her.
      for (const e of this.helpers) if (e.alive) e.die();
      this.helpers = [];
      this.sync(dt);
      return;
    }
    this.stateT -= dt;
    const p = this.player.body;
    switch (this.state) {
      case 'idle':
        break;
      case 'snakes': {
        // A few cable snakes strike where the hero is (and is going).
        this.strikeT -= dt;
        if (this.strikes > 0 && this.strikeT <= 0) {
          this.strikes -= 1;
          this.strikeT = this.angry ? 0.45 : 0.6;
          const lead = this.strikes % 2 ? 0.5 : 0;
          tmp.set(p.x + p.vx * lead, this.floorY, p.z + p.vz * lead);
          this.clampToArena(tmp);
          const a = (Math.random() - 0.5) * 2.4;
          const from = new THREE.Vector3(this.center.x + Math.sin(a) * 1.4, this.floorY + MEDUSA_EYE_Y + 1.6, this.center.z + 0.4);
          w.addEntity(new SnakeStrike(w, from, tmp, this.angry ? 0.85 : 1.05));
          audio.play('vent', 2, 0.4);
        }
        if (this.strikes <= 0 && this.strikeT <= -1.2) {
          if (this.hooded) {
            // Tied up: more strikes (and the odd helper) until Atalanta unties the knot.
            this.strikes = this.angry ? 4 : 3;
            this.strikeT = 1.4;
            if (Math.random() < 0.4) this.tie();
          } else this.startCharge();
        }
        break;
      }
      case 'charge':
        this.yaw = damp(this.yaw, this.sweepFrom, 4, dt);
        this.aimSight();
        if (this.stateT <= 0) this.set('gaze', this.angry ? SWEEP_ANGRY : SWEEP);
        break;
      case 'gaze': {
        const total = this.angry ? SWEEP_ANGRY : SWEEP;
        const k = 1 - Math.max(0, this.stateT) / total;
        this.yaw = this.sweepFrom + (this.sweepTo - this.sweepFrom) * (0.5 - Math.cos(k * Math.PI) / 2);
        this.glare(dt);
        if (this.state === 'gaze' && this.stateT <= 0) {
          this.beam.hide();
          this.afterGlare();
        }
        break;
      }
      case 'dazed':
        this.yaw = damp(this.yaw, Math.sin(this.t * 2) * 0.25, 3, dt);
        if (this.stateT <= 0) {
          this.set('wake', 1);
          audio.play('roar', 1.1);
        }
        break;
      case 'wake':
        this.yaw = damp(this.yaw, 0, 4, dt);
        if (this.stateT <= 0) this.afterGlare();
        break;
      case 'tie':
        if (this.stateT <= 0) {
          this.set('snakes', 0);
          this.strikes = this.angry ? 4 : 3;
          this.strikeT = 0.5;
        }
        break;
    }
    this.sync(dt);
  }

  /** After a glare (or waking from a daze): back to the snakes, tying the knot first once she's angry. */
  private afterGlare() {
    if (this.angry && !this.hooded) {
      this.tie();
      return;
    }
    this.set('snakes', 0);
    this.strikes = this.angry ? 4 : 3;
    this.strikeT = 0.6;
  }

  /** Keeps a strike spot inside the hall (not on her plinth). */
  private clampToArena(v: THREE.Vector3) {
    const dz = v.z - this.center.z;
    if (Math.abs(v.x - this.center.x) < 3.2 && dz < 3.2) v.z = this.center.z + 3.2;
  }

  /** Where her gaze points this frame: from her eye, down to chest height where the hero is. */
  private aimGaze() {
    const p = this.player.body;
    const dist = THREE.MathUtils.clamp(Math.hypot(p.x - this.pos.x, p.z - this.pos.z), 4, 30);
    const drop = this.pos.y - (this.floorY + 1.2);
    const pitch = Math.atan2(drop, dist);
    this.dir.set(Math.sin(this.yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(this.yaw) * Math.cos(pitch));
    this.origin.copy(this.pos).addScaledVector(this.dir, 0.4);
  }

  /** While her eye charges, a faint flickering line shows where the glare will start (it does nothing yet). */
  private aimSight() {
    this.aimGaze();
    const g = this.world.grid;
    const end = tmp.copy(this.origin);
    for (let d = 0; d < 30; d += 0.5) {
      end.addScaledVector(this.dir, 0.5);
      if (pointBlocked(g, NO_BOXES, end.x, end.y, end.z)) break;
    }
    const k = 1 - Math.max(0, this.stateT) / CHARGE;
    this.sight.alpha = (0.15 + k * 0.45) * (0.75 + Math.sin(this.t * 24) * 0.25);
    this.sight.show([this.origin, end]);
  }

  /** One frame of her gaze: a beam from her eye, sweeping across the hall at chest height. */
  private glare(dt: number) {
    const w = this.world;
    this.aimGaze();
    const r = traceBeam(w, this.origin, this.dir, this, dt);
    if (this.state === 'gaze') this.beam.show(r.points, r.shielded ? 1 : 0.4);
    if (Math.random() < 0.3) audio.play('zap', 0.4, 0.25);
  }

  private sync(dt: number) {
    const m = this.m;
    const st = this.state;
    const open = st === 'charge' || st === 'gaze' || st === 'dazed';
    const lid = this.defeated ? 0 : open ? (st === 'dazed' ? 0.75 : 1.25) : 0.55;
    m.lidTop.rotation.x = damp(m.lidTop.rotation.x, -lid, 8, dt);
    m.lidBottom.rotation.x = damp(m.lidBottom.rotation.x, Math.PI + lid * 0.7, 8, dt);
    m.head.rotation.y = damp(m.head.rotation.y, this.defeated ? 0 : this.yaw * 0.85, 10, dt);
    m.head.rotation.x = damp(m.head.rotation.x, this.defeated ? 0.35 : st === 'dazed' ? 0.15 : 0.12, 3, dt);
    m.head.rotation.z = st === 'dazed' ? Math.sin(this.t * 3) * 0.12 : damp(m.head.rotation.z, 0, 4, dt);
    m.head.position.y = MEDUSA_EYE_Y + (this.defeated ? -0.4 : Math.sin(this.t * 1.2) * 0.08);
    // The eye: a hum of green while charging, wide and blazing while glaring, dim and wobbly while dazzled.
    const charge = st === 'charge' ? 1 - Math.max(0, this.stateT) / CHARGE : 0;
    this.daze = damp(this.daze, st === 'dazed' ? 1 : 0, 6, dt);
    const ei = this.defeated ? 0.3 : st === 'gaze' ? 4 : st === 'charge' ? 1.5 + charge * 3 + Math.sin(this.t * 30) * 0.5 : st === 'dazed' ? 0.5 + Math.sin(this.t * 5) * 0.3 : 1.2;
    m.iris.emissiveIntensity = ei;
    if (this.defeated) m.iris.emissive.set('#5ec8ff');
    m.eyeGlow.material.opacity = this.defeated ? 0.15 : st === 'gaze' ? 0.95 : st === 'charge' ? 0.3 + charge * 0.6 : 0.25;
    m.eye.rotation.z = st === 'dazed' ? this.t * 4 : 0;
    m.stars.visible = st === 'dazed' && !this.defeated;
    m.stars.rotation.y = this.t * 3;
    m.gold.emissive.set(this.flashT > 0 ? '#ffffff' : '#3a2a00');
    this.flashT -= dt;
    // The snakes wave (wildly while she glares), droop while she's dazzled, and lie still when she's done.
    const wild = st === 'gaze' || st === 'charge' ? 1.6 : st === 'tie' ? 2 : 1;
    m.snakes.forEach((s, i) => {
      const droop = this.defeated ? 1 : this.daze;
      s.group.rotation.x = s.base.x + droop * 1.1 + Math.sin(this.t * 1.7 * wild + i) * 0.15 * (1 - droop);
      s.group.rotation.z = s.base.z + Math.sin(this.t * 1.3 * wild + i * 2) * 0.18 * (1 - droop);
      s.beads.forEach((b, j) => {
        b.position.x = Math.sin(this.t * 2.4 * wild + i + j * 0.8) * 0.12 * j * (1 - droop);
      });
    });
    m.knot.visible = this.hooded && !this.defeated;
    if (m.knot.visible) {
      m.knot.rotation.z += dt * 1.5;
      m.knotRing.opacity = 0.6 + Math.sin(this.t * 6) * 0.3;
    }
    // Her eye (the beam catcher) and where shots aim: the eye, or the knot over it.
    m.root.updateMatrixWorld(true);
    m.eye.getWorldPosition(this.pos);
    if (this.hooded) m.knot.getWorldPosition(this.aim);
    else this.aim.copy(this.pos);
    this.crown.sync();
    this.aimable = this.started && !this.defeated;
  }
}
