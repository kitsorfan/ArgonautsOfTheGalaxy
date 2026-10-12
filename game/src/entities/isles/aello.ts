import * as THREE from 'three';

import { audio } from '../../core/audio';
import { haptic } from '../../core/bridge';
import { tr } from '../../core/i18n';
import { damp } from '../../core/math';
import { addBolts } from '../../core/save';
import type { World } from '../../game/world';
import { Grid } from '../../world/grid';
import { Boss, bossHp } from '../bossBase';
import type { Enemy } from '../enemies';
import type { HitKind, Target } from '../entity';
import { Shockwave, Strike } from '../hazards';
import { cone, glowSprite, mat, mesh, ownMat, sphere, torus } from '../models';
import { makeHarpyModel } from './harpyModel';

/**
 * AELLO, THE HARPY QUEEN (chapter 3, level 2): Aeëtes's biggest thief, a gold mechanical harpy as big
 * as a shuttle. She needs BOTH heroes:
 * - In the air her gold armour shrugs off everything except Atalanta's charged POWER ARROW, which
 *   knocks her clean out of the sky.
 * - On the ground she lies dizzy for a few seconds with her glowing core open, and only Jason's
 *   blaster and ground pound can crack it (arrows and kicks just bounce off the core's crystal).
 * Between knock-downs she circles the nest and takes turns: a WIND GUST (she flaps and shoves you
 * toward the edge: walk into it, or spin to dig in), a DIVE (a gold ring marks the spot, then she
 * swoops through it and snatches bolts), and a FEATHER STORM (gold feathers drop on glowing circles).
 * Below half health she calls two harpy drones to help and dives twice in a row. Getting up, she
 * flaps a shockwave ring across the nest: jump it. Every bolt she snatched falls out when she drops.
 */

const HP = 36;
/** Radius of her flight around the nest, and her height above the floor. */
const RING = 8.5;
const FLY = 5;
/** Seconds she lies dizzy on the ground (less once she's angry). */
const DOWN = 7;
const DOWN_ANGRY = 6;
const GUST = { warn: 0.9, time: 2.4, push: 6 };
const DIVE = { warn: 1.1, time: 0.9, grab: 6 };

type State = 'perch' | 'circle' | 'gustWarn' | 'gust' | 'diveWarn' | 'dive' | 'feathers' | 'fall' | 'down' | 'rise';

const tmp = new THREE.Vector3();

/** A gold ring on the floor that closes in: "she dives through here". */
class DiveMark {
  readonly group = new THREE.Group();
  private ring: THREE.Mesh;
  private disc: THREE.Mesh;
  private ringMat = new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  private discMat = new THREE.MeshBasicMaterial({ color: '#ff9a3a', transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });

  constructor() {
    this.ring = new THREE.Mesh(new THREE.RingGeometry(1.7, 2, 40).rotateX(-Math.PI / 2), this.ringMat);
    this.disc = new THREE.Mesh(new THREE.CircleGeometry(2, 32).rotateX(-Math.PI / 2), this.discMat);
    this.ring.renderOrder = 3;
    this.disc.renderOrder = 2;
    this.group.add(this.disc, this.ring);
    this.group.visible = false;
  }

  show(p: THREE.Vector3, k: number, t: number) {
    this.group.visible = true;
    this.group.position.set(p.x, p.y + 0.07, p.z);
    this.ring.scale.setScalar(1 + (1 - k) * 1.2);
    const blink = k > 0.7 ? 0.5 + 0.5 * Math.sin(t * 30) : 1;
    this.ringMat.opacity = 0.9 * blink;
    this.discMat.opacity = (0.15 + k * 0.3) * blink;
  }

  hide() {
    this.group.visible = false;
  }
}

export class Aello extends Boss implements Target {
  readonly title = 'AELLO';
  protected focusHeight = 1.6;
  readonly aim = new THREE.Vector3();
  radius = 2.2;
  aimable = false;
  private m = makeHarpyModel(4);
  private core: THREE.MeshStandardMaterial;
  private coreGlow: THREE.Sprite;
  private dizzy = new THREE.Group();
  private mark = new DiveMark();
  private state: State = 'perch';
  private stateT = 0;
  private pos = new THREE.Vector3();
  private angle = 0;
  private yaw = 0;
  private floorY: number;
  private turn = 0;
  private dives = 0;
  private diveFrom = new THREE.Vector3();
  private diveTo = new THREE.Vector3();
  private diveHit = false;
  private fallFrom = new THREE.Vector3();
  /** Bolts she has snatched (they fall out every time she is knocked down). */
  private stolen = 0;
  private downs = 0;
  private hinted = { fly: false, ata: false };
  /** Harpy drones she called in. */
  private helpers: Enemy[] = [];

  constructor(world: World, id: string, cx: number, cz: number, h: number) {
    super(world, id, cx, cz, h, bossHp(world, HP));
    this.floorY = h;
    this.pos.set(this.center.x, h + 1.9, this.center.z);
    const body = this.m.body;
    // Her crown and the crystal core in her chest (the weak spot once she's down).
    const crown = mat('#ffe08a', { emissive: '#ffb020', ei: 0.4, metal: 0.8, rough: 0.2 });
    for (let i = 0; i < 5; i++) {
      const a = (i - 2) * 0.32;
      const spike = mesh(cone(0.04, 0.2, 6), crown, Math.sin(a) * 0.17, 0.44, 0.36 + Math.cos(a) * 0.05 - 0.1, false);
      spike.rotation.z = -a * 0.6;
      body.add(spike);
    }
    body.add(mesh(torus(0.16, 0.02), crown, 0, 0.36, 0.33, false).rotateX(Math.PI / 2));
    this.core = ownMat('#bff4ff', { emissive: '#5ee0ff', ei: 0.3, rough: 0.1, metal: 0.2 });
    const gem = mesh(sphere(0.12, 14), this.core, 0, -0.04, 0.3, false);
    gem.scale.set(1, 1.2, 0.7);
    body.add(gem);
    this.coreGlow = glowSprite('#7fe6ff', 1, 0);
    this.coreGlow.position.set(0, -0.04, 0.42);
    body.add(this.coreGlow);
    // Little stars that circle her head while she's dizzy.
    for (let i = 0; i < 4; i++) {
      const s = mesh(sphere(0.18, 8), mat('#fff6c0', { emissive: '#ffd166', ei: 2 }), Math.cos(i * 1.57) * 1.4, 0, Math.sin(i * 1.57) * 1.4, false);
      this.dizzy.add(s);
    }
    this.dizzy.visible = false;
    this.obj.add(this.m.root, this.dizzy, this.mark.group);
    world.addTarget(this);
    this.sync(0);
  }

  get where(): THREE.Vector3 {
    return this.pos.clone().setY(this.floorY);
  }

  get size() {
    return 2.6;
  }

  private get angry() {
    return this.hp <= this.maxHp / 2;
  }

  private set(state: State, t: number) {
    this.state = state;
    this.stateT = t;
  }

  /** In the air (where only a power arrow can touch her). */
  private get flying() {
    return this.state !== 'perch' && this.state !== 'fall' && this.state !== 'down' && this.state !== 'rise';
  }

  protected onStart() {
    this.set('circle', 3);
    this.angle = Math.atan2(this.pos.z - this.center.z, this.pos.x - this.center.x);
    audio.play('roar', 0.8);
  }

  reset() {
    this.hp = this.maxHp;
    this.pos.set(this.center.x, this.floorY + 1.9, this.center.z);
    // Back on her nest until Jason comes near again (the world restarts the fight).
    this.set('perch', 0);
    this.mark.hide();
    this.dizzy.visible = false;
    this.dives = 0;
    this.turn = 0;
  }

  /** Atalanta's power arrow: in the air it knocks her straight down. */
  powerArrow(dmg: number): boolean {
    if (!this.started || this.defeated) return true;
    if (!this.flying) return this.hit(dmg, 'shot');
    this.knockDown();
    return true;
  }

  hit(dmg: number, kind: HitKind): boolean {
    if (!this.started || this.defeated) return true;
    const w = this.world;
    if (this.state !== 'down') {
      // Gold armour: everything pings off while she flies.
      audio.play('zap', 1.7);
      w.particles.emit(this.aim.x, this.aim.y, this.aim.z, { count: 6, color: '#ffe08a', speed: 3, life: 0.25, size: 0.35 });
      // (Only the hero's own hits explain it, not the droid's zaps.)
      if (!this.hinted.fly && this.flying && kind !== 'zap') {
        this.hinted.fly = true;
        w.hooks.toast('Her gold armour is too tough while she flies! Switch to Atalanta and knock her down with a POWER ARROW: hold BOW.', 'bolt');
      }
      return true;
    }
    if (w.player.hero !== 'jason') {
      // The core's crystal is too hard for arrows and kicks.
      audio.play('zap', 2);
      w.particles.emit(this.aim.x, this.aim.y, this.aim.z, { count: 8, color: '#bff4ff', speed: 3, life: 0.3, size: 0.4 });
      if (!this.hinted.ata) {
        this.hinted.ata = true;
        w.hooks.toast('Her core is too hard for arrows! Switch to Jason: BLAST it, or jump and GROUND-POUND it!', 'atalanta');
      }
      return true;
    }
    this.damage(kind === 'pound' ? dmg + 4 : dmg);
    this.core.emissiveIntensity = 4;
    w.flash(this.aim.x, this.aim.y, this.aim.z, '#7fe6ff', 30, 0.2);
    audio.play('hit');
    if (kind === 'pound') {
      w.shake(0.35);
      w.hitStop(0.06);
    }
    return true;
  }

  /** Out of the sky! She tumbles onto the nest, drops everything she stole and lies there dizzy. */
  private knockDown() {
    const w = this.world;
    this.mark.hide();
    this.fallFrom.copy(this.pos);
    this.set('fall', 0.7);
    this.downs += 1;
    audio.play('explode', 1.3);
    audio.play('roar', 1.4, 0.7);
    haptic('heavy');
    w.shake(0.5);
    w.hitStop(0.08);
    w.flash(this.pos.x, this.pos.y, this.pos.z, '#ffffff', 60, 0.4);
    w.particles.emit(this.pos.x, this.pos.y, this.pos.z, { count: 40, color: '#ffe08a', speed: 9, life: 0.8, size: 0.7 });
    if (this.stolen > 0) {
      w.dropBolts(tmp.copy(this.pos), this.stolen);
      this.stolen = 0;
    }
    if (this.downs === 1) w.hooks.toast('She’s down! Quick, Jason: BLAST her glowing core, or jump and GROUND-POUND it!', 'atalanta');
  }

  /** Where she should land: on the nest, never over the edge. */
  private landSpot(out: THREE.Vector3) {
    const dx = this.pos.x - this.center.x;
    const dz = this.pos.z - this.center.z;
    const d = Math.hypot(dx, dz);
    const k = d > 5 ? 5 / d : 1;
    return out.set(this.center.x + dx * k, this.floorY + 1.7, this.center.z + dz * k);
  }

  /** The next attack in her rotation: gust, dive, feathers (dives come in pairs once she's angry). */
  private nextAttack() {
    const pick = this.turn % 3;
    this.turn += 1;
    if (pick === 0) {
      this.set('gustWarn', GUST.warn);
      audio.play('glide', 0.6);
    } else if (pick === 1) {
      this.dives = this.angry ? 2 : 1;
      this.startDive();
    } else {
      this.set('feathers', 1.6);
    }
  }

  private startDive() {
    const p = this.player.body;
    this.diveTo.set(p.x, this.floorY, p.z);
    this.set('diveWarn', DIVE.warn);
    audio.play('roar', 1.8, 0.5);
  }

  update(dt: number) {
    this.t += dt;
    const w = this.world;
    if (!this.started) {
      if (!this.defeated && this.playerDist() < 13) this.begin();
      this.pos.y = this.floorY + 1.9 + Math.sin(this.t * 1.5) * 0.08;
      this.sync(dt);
      return;
    }
    if (this.defeated) {
      // Grounded for good: she sags, and her wings droop.
      this.pos.y = damp(this.pos.y, this.floorY + 1.2, 2, dt);
      this.mark.hide();
      this.dizzy.visible = false;
      this.aimable = false;
      if (Math.random() < 0.2) w.particles.emit(this.pos.x, this.pos.y + 1.5, this.pos.z, { count: 1, color: '#6a6470', speed: 1, up: 3, life: 1.2, size: 1.2, gravity: 0 });
      this.sync(dt);
      return;
    }
    const p = this.player.body;
    this.stateT -= dt;
    const ringPos = (a: number, out: THREE.Vector3) => out.set(this.center.x + Math.cos(a) * RING, this.floorY + FLY, this.center.z + Math.sin(a) * RING);
    switch (this.state) {
      case 'perch':
        this.set('circle', 2);
        break;
      case 'circle': {
        this.angle += dt * (this.angry ? 0.55 : 0.42);
        ringPos(this.angle, tmp);
        this.pos.x = damp(this.pos.x, tmp.x, 2, dt);
        this.pos.z = damp(this.pos.z, tmp.z, 2, dt);
        this.pos.y = damp(this.pos.y, tmp.y + Math.sin(this.t * 2) * 0.4, 2, dt);
        if (this.stateT <= 0) this.nextAttack();
        break;
      }
      case 'gustWarn':
      case 'gust': {
        // She hangs in the air at the edge, wings wide, and flaps a gale across the nest.
        this.pos.y = damp(this.pos.y, this.floorY + FLY + 0.6, 3, dt);
        if (this.state === 'gustWarn') {
          if (this.stateT <= 0) {
            this.set('gust', GUST.time);
            audio.play('vent', 0.7);
          }
          break;
        }
        const dx = p.x - this.pos.x;
        const dz = p.z - this.pos.z;
        const d = Math.hypot(dx, dz) || 1;
        const push = GUST.push * (this.player.spinning ? 0.5 : 1);
        if (!this.player.zipping && d < 22) {
          p.x += (dx / d) * push * dt;
          p.z += (dz / d) * push * dt;
        }
        for (let i = 0; i < 3; i++) {
          const s = (Math.random() - 0.5) * 10;
          w.particles.emit(this.pos.x - (dz / d) * s, this.floorY + 0.5 + Math.random() * 3, this.pos.z + (dx / d) * s, {
            count: 1,
            color: '#ffffff',
            speed: 0,
            life: 0.8,
            size: 0.35,
            gravity: 0,
            drag: 0,
            vel: [(dx / d) * 18, 0, (dz / d) * 18],
          });
        }
        if (this.stateT <= 0) this.set('circle', this.angry ? 2.6 : 3.4);
        break;
      }
      case 'diveWarn': {
        // Rears up over her target spot while the gold ring closes in.
        const k = 1 - Math.max(0, this.stateT) / DIVE.warn;
        this.mark.show(this.diveTo, k, this.t);
        const back = tmp.copy(this.pos).sub(this.diveTo).setY(0).normalize();
        this.pos.x = damp(this.pos.x, this.diveTo.x + back.x * 9, 2.5, dt);
        this.pos.z = damp(this.pos.z, this.diveTo.z + back.z * 9, 2.5, dt);
        this.pos.y = damp(this.pos.y, this.floorY + FLY + 1, 3, dt);
        if (this.stateT <= 0) {
          this.diveFrom.copy(this.pos);
          this.diveHit = false;
          this.set('dive', DIVE.time);
          audio.play('dash', 0.7);
        }
        break;
      }
      case 'dive': {
        // Straight through the ring and out the other side, claws first.
        const k = 1 - Math.max(0, this.stateT) / DIVE.time;
        tmp.copy(this.diveTo).sub(this.diveFrom).setY(0);
        this.pos.x = this.diveFrom.x + tmp.x * k * 2;
        this.pos.z = this.diveFrom.z + tmp.z * k * 2;
        this.pos.y = this.floorY + 1.3 + (this.diveFrom.y - this.floorY - 1.3) * Math.abs(1 - k * 2);
        this.mark.show(this.diveTo, 1, this.t);
        if (!this.diveHit && Math.hypot(p.x - this.pos.x, p.z - this.pos.z) < 2.3 && p.y < this.pos.y + 0.5) {
          this.diveHit = true;
          this.snatch();
        }
        if (this.stateT <= 0) {
          this.mark.hide();
          this.dives -= 1;
          if (this.dives > 0) this.startDive();
          else {
            this.set('circle', this.angry ? 2.6 : 3.4);
            this.angle = Math.atan2(this.pos.z - this.center.z, this.pos.x - this.center.x);
          }
        }
        break;
      }
      case 'feathers':
        // A storm of gold feathers: glowing circles under Jason and around him, then they land.
        if (this.stateT <= 1.2 && this.stateT + dt > 1.2) {
          const n = this.angry ? 6 : 4;
          for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = i === 0 ? 0 : 2.4 + Math.random() * 3;
            w.addEntity(new Strike(w, p.x + Math.cos(a) * r, this.floorY, p.z + Math.sin(a) * r, 1.2, 1.3, '#ffd166', 'missile'));
          }
          audio.play('enemyShoot', 0.7);
        }
        if (this.stateT <= 0) this.set('circle', this.angry ? 2.4 : 3.2);
        break;
      case 'fall': {
        const k = 1 - Math.max(0, this.stateT) / 0.7;
        this.landSpot(tmp);
        this.pos.lerpVectors(this.fallFrom, tmp, k * k);
        if (this.stateT <= 0) {
          this.set('down', this.angry ? DOWN_ANGRY : DOWN);
          w.shake(0.6);
          audio.play('pound', 0.8);
          w.particles.emit(this.pos.x, this.floorY + 0.3, this.pos.z, { count: 30, color: '#d8d0b0', speed: 7, up: 2, life: 0.6, size: 0.8 });
        }
        break;
      }
      case 'down':
        if (this.stateT <= 0) {
          this.set('rise', 1);
          audio.play('roar', 1.1);
        }
        break;
      case 'rise':
        this.pos.y = damp(this.pos.y, this.floorY + FLY, 2.5, dt);
        if (this.stateT <= 0) {
          // She shakes it off with a great flap: a ring of wind rolls across the nest (jump it).
          w.addEntity(new Shockwave(w, this.pos.x, this.floorY, this.pos.z, 13, 8, '#ffd166'));
          audio.play('pound');
          this.set('circle', 2.4);
          this.angle = Math.atan2(this.pos.z - this.center.z, this.pos.x - this.center.x);
          if (this.angry) this.callHelpers();
        }
        break;
    }
    this.sync(dt);
  }

  /** Claws out: a hit, and a handful of bolts gone (she drops them when she is knocked down). */
  private snatch() {
    const w = this.world;
    const pl = this.player;
    const before = pl.hearts;
    pl.hurt(1, this.pos.x, this.pos.z);
    if (pl.hearts >= before) return;
    const n = Math.floor(Math.min(DIVE.grab, w.save.bolts));
    if (n <= 0) return;
    addBolts(w.save, -n);
    this.stolen += n;
    w.hooks.hud();
    w.hooks.toast(tr('AELLO snatched {n} bolts! Knock her down to get them back.', { n }), 'bolt');
  }

  /** Below half health she screeches for two harpy drones (never more than three around at once). */
  private callHelpers() {
    const w = this.world;
    this.helpers = this.helpers.filter((e) => e.alive);
    const near = this.helpers.length;
    for (let i = near; i < Math.min(3, near + 2); i++) {
      const a = Math.random() * Math.PI * 2;
      this.helpers.push(w.spawnEnemy('harpy', Grid.toCell(this.center.x + Math.cos(a) * 5), Grid.toCell(this.center.z + Math.sin(a) * 5)));
    }
    if (near < 3) w.hooks.toast('She called her harpy drones! Watch your bolts!', 'bolt');
  }

  private sync(dt: number) {
    const m = this.m;
    const p = this.player.body;
    const down = this.state === 'down' || this.state === 'fall';
    m.root.position.copy(this.pos);
    // Face where she flies (or Jason, while she hovers to attack).
    const face =
      this.state === 'circle' ? this.angle + Math.PI / 2 : this.state === 'dive' ? Math.atan2(this.diveTo.x - this.diveFrom.x, this.diveTo.z - this.diveFrom.z) : Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
    this.yaw = this.state === 'circle' ? face : damp(this.yaw, face, 5, dt);
    m.root.rotation.y = this.yaw;
    const gust = this.state === 'gust' || this.state === 'gustWarn';
    const speed = gust ? 16 : this.state === 'dive' ? 3 : 7;
    const flap = down || this.state === 'perch' ? (this.defeated ? -0.5 : 0.25) : this.state === 'dive' ? 0.9 : Math.sin(this.t * speed) * (gust ? 0.8 : 0.5);
    m.wings[0].rotation.z = flap;
    m.wings[1].rotation.z = -flap;
    m.body.rotation.x = this.state === 'dive' ? 0.6 : down ? -0.35 : gust ? -0.3 : 0.08;
    m.body.rotation.z = down ? Math.sin(this.t * 3) * 0.12 : 0;
    for (const c of m.claws) c.rotation.x = this.state === 'dive' ? -1 : down ? 0.6 : 0;
    m.sack.visible = this.stolen > 0;
    m.eyeMat.emissiveIntensity = this.state === 'diveWarn' || this.state === 'gustWarn' ? 3 + Math.sin(this.t * 30) * 2 : down ? 0.4 : 2;
    // The core blazes while it is open to Jason.
    const open = this.state === 'down';
    this.core.emissiveIntensity = damp(this.core.emissiveIntensity, open ? 2.4 + Math.sin(this.t * 8) * 0.6 : 0.3, 6, dt);
    this.coreGlow.material.opacity = damp(this.coreGlow.material.opacity, open ? 0.9 : 0, 6, dt);
    this.dizzy.visible = open;
    this.dizzy.position.set(this.pos.x, this.pos.y + 2.4, this.pos.z);
    this.dizzy.rotation.y = this.t * 3;
    this.aimable = this.started && !this.defeated && this.state !== 'fall';
    // The weak spot: her chest (in the air, the arrow only has to hit her body).
    this.aim.set(this.pos.x + Math.sin(this.yaw) * 1.1, this.pos.y - 0.2, this.pos.z + Math.cos(this.yaw) * 1.1);
    const shadow = m.parts.shadow;
    const c = this.world.grid.cell(Grid.toCell(this.pos.x), Grid.toCell(this.pos.z));
    shadow.visible = c.kind !== 'void';
    shadow.position.y = c.h - this.pos.y + 0.03;
  }
}
