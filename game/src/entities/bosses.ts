import * as THREE from 'three';

import { audio } from '../core/audio';
import { tr } from '../core/i18n';
import { damp, dampAngle } from '../core/math';
import type { World } from '../game/world';
import { Grid } from '../world/grid';
import type { BossKind } from '../world/levelTypes';
import { makeBody, moveBody, type Body, type Box } from '../world/physics';
import { Enemy } from './enemies';
import { Entity, type HitKind, type Interactable, type Target } from './entity';
import { makeGooBlob } from './aliens';
import { Boss, bossHp } from './bossBase';
import { Boreas } from './gaia/boreas';
import { Colossus } from './gaia/colossus';
import { Driller } from './gaia/driller';
import { Hydra } from './gaia/hydra';
import { RogueLux } from './gaia/rogue';
import { Excavator } from './ch3/excavator';
import { Talos } from './forge/talos';
import { GoldenRam } from './stand/goldenRam';
import { GoldenKing } from './ch3/goldenKing';
import { Stheno } from './gaia/stheno';
import { Thresher } from './gaia/thresher';
import { Shockwave, Strike } from './hazards';
import { Aello } from './isles/aello';
import { Scylla } from './reef/scylla';
import { Medusa } from './labyrinth/medusa';
import { Dragon } from './ch3/dragon';
import { blobShadow, boxG, capsule, cone, cyl, glowSprite, mat, mesh, ownMat, sphere, torus } from './models';

export { Boss };

const tmp = new THREE.Vector3();

/* ---------------- 1. Frost Warden ---------------- */

/** The Warden's ring lasers are red-hot so they stand out on the pale ice. */
const WARDEN_LASER = '#ff2f55';

class Warden extends Boss implements Target {
  protected focusHeight = 2.4;
  readonly title = 'FROST WARDEN';
  readonly aim = new THREE.Vector3();
  radius = 1.1;
  aimable = true;
  private state: 'idle' | 'ring' | 'rain' | 'vent' = 'idle';
  private stateT = 2;
  private count = 0;
  private yaw = 0;
  private model = new THREE.Group();
  private core: THREE.MeshStandardMaterial;
  private coreMesh: THREE.Mesh;
  private hatch: THREE.Mesh;

  constructor(world: World, id: string, cx: number, cz: number, h: number) {
    super(world, id, cx, cz, h, bossHp(world, 20));
    const steel = mat('#8a98ad', { metal: 0.6, rough: 0.35 });
    const dark = mat('#2a3242', { rough: 0.5 });
    const ice = mat('#dff6ff', { emissive: '#7fe6ff', ei: 0.5, rough: 0.1 });
    const m = this.model;
    m.add(mesh(cyl(1.6, 2, 1, 20), dark, 0, 0.5, 0));
    const body = mesh(sphere(1.6, 24), steel, 0, 2.4, 0);
    body.scale.set(1, 1.2, 0.9);
    m.add(body);
    for (const sx of [-1, 1]) {
      m.add(mesh(cyl(0.45, 0.45, 2.2, 14), ice, sx * 1.4, 2.8, -0.8));
      const arm = mesh(capsule(0.35, 1.4), steel, sx * 1.9, 2.1, 0.3);
      arm.rotation.z = sx * 0.5;
      m.add(arm);
      m.add(mesh(cone(0.4, 0.8, 4), ice, sx * 2.35, 1.1, 0.5));
    }
    m.add(mesh(sphere(0.35, 14), mat('#bff4ff', { emissive: '#7fe6ff', ei: 1.8 }), 0, 3.6, 1.2, false));
    this.core = ownMat('#ff8a3d', { emissive: '#ff5e1a', ei: 0.3 });
    this.coreMesh = mesh(sphere(0.55, 18), this.core, 0, 2.3, 1.2);
    m.add(this.coreMesh);
    this.hatch = mesh(boxG(1.3, 1.3, 0.2), steel, 0, 2.3, 1.45);
    m.add(this.hatch);
    m.add(blobShadow(5));
    m.position.copy(this.center);
    this.obj.add(m);
    world.addTarget(this);
    const box: Box = { minX: this.center.x - 1.6, maxX: this.center.x + 1.6, minZ: this.center.z - 1.6, maxZ: this.center.z + 1.6, bottom: h, top: h + 4, solid: true, dx: 0, dy: 0, dz: 0 };
    world.boxes.push(box);
  }

  hit(dmg: number, kind: HitKind): boolean {
    if (!this.started) return true;
    if (this.state !== 'vent') {
      audio.play('zap', 2);
      return true;
    }
    this.damage(kind === 'zap' ? Math.min(1, dmg) : dmg);
    this.core.emissiveIntensity = 3;
    audio.play('hit');
    return true;
  }

  reset() {
    this.hp = this.maxHp;
    this.state = 'idle';
    this.stateT = 2;
    this.count = 0;
  }

  update(dt: number) {
    this.t += dt;
    if (!this.started) {
      if (this.playerDist() < 11) this.begin();
      return;
    }
    if (this.defeated) {
      this.model.rotation.z = damp(this.model.rotation.z, 0.5, 2, dt);
      this.model.position.y = damp(this.model.position.y, this.center.y - 1.5, 1, dt);
      return;
    }
    const p = this.player.body;
    this.yaw = dampAngle(this.yaw, Math.atan2(p.x - this.center.x, p.z - this.center.z), 2.5, dt);
    this.model.rotation.y = this.yaw;
    const angry = this.hp < this.maxHp / 2;
    this.stateT -= dt;
    const c = this.center;
    switch (this.state) {
      case 'idle':
        if (this.stateT <= 0) {
          this.count += 1;
          this.state = this.count % 3 === 0 ? 'vent' : this.count % 3 === 1 ? 'ring' : 'rain';
          this.stateT = this.state === 'vent' ? 3.6 : 1;
          if (this.state === 'ring') {
            audio.play('roar');
            this.model.position.y = c.y + 0.6;
          }
          if (this.state === 'vent') {
            audio.play('vent');
            this.world.hooks.toast('Its core is open! Blast it!', 'bolt');
          }
        }
        break;
      case 'ring':
        this.model.position.y = damp(this.model.position.y, c.y, 12, dt);
        if (this.stateT <= 0.6 && this.stateT + dt > 0.6) {
          this.world.addEntity(new Shockwave(this.world, c.x, c.y, c.z, 16, angry ? 10 : 8, WARDEN_LASER));
          audio.play('pound');
          this.world.shake(0.4);
        }
        if (angry && this.stateT <= 0.05 && this.stateT + dt > 0.05) this.world.addEntity(new Shockwave(this.world, c.x, c.y, c.z, 16, 8, WARDEN_LASER));
        if (this.stateT <= 0) {
          this.state = 'idle';
          this.stateT = 1.4;
        }
        break;
      case 'rain':
        if (this.stateT <= 0.9 && this.stateT + dt > 0.9) {
          const n = angry ? 7 : 5;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + Math.random();
            const r = i === 0 ? 0 : 2 + Math.random() * 3;
            this.world.addEntity(new Strike(this.world, p.x + Math.cos(a) * r, this.floorAt(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r), p.z + Math.sin(a) * r, 1.2, 1.2, '#7fe6ff', 'ice'));
          }
        }
        if (this.stateT <= 0) {
          this.state = 'idle';
          this.stateT = 1.8;
        }
        break;
      case 'vent':
        if (Math.random() < 0.5) this.world.particles.emit(c.x + Math.sin(this.yaw) * 1.3, c.y + 2.3, c.z + Math.cos(this.yaw) * 1.3, { count: 2, color: '#f4f0ea', speed: 2, up: 3, life: 0.6, size: 1, gravity: 0 });
        if (this.stateT <= 0) {
          this.state = 'idle';
          this.stateT = 1.5;
        }
        break;
    }
    const open = this.state === 'vent';
    this.hatch.position.y = damp(this.hatch.position.y, open ? 3.5 : 2.3, 8, dt);
    this.core.emissiveIntensity = damp(this.core.emissiveIntensity, open ? 1.6 + Math.sin(this.t * 10) * 0.4 : 0.3, 6, dt);
    this.aimable = open;
    this.aim.set(c.x + Math.sin(this.yaw) * 1.3, c.y + 2.3, c.z + Math.cos(this.yaw) * 1.3);
    this.touch();
  }

  private floorAt(x: number, z: number) {
    const cell = this.world.grid.cell(Grid.toCell(x), Grid.toCell(z));
    return cell.kind === 'void' || cell.kind === 'wall' ? this.center.y : cell.h;
  }

  private touch() {
    const p = this.player.body;
    if (Math.hypot(p.x - this.center.x, p.z - this.center.z) < 2.2 && p.y < this.center.y + 4) this.player.hurt(1, this.center.x, this.center.z);
  }
}

/* ---------------- 2. Vine Queen ---------------- */

class Bulb extends Entity implements Target {
  readonly aim = new THREE.Vector3();
  radius = 0.8;
  aimable = true;
  hp: number;
  shielded = false;
  readonly g = new THREE.Group();
  private m: THREE.MeshStandardMaterial;

  constructor(
    world: World,
    id: string,
    private queen: Queen,
    private angle: number,
  ) {
    super(world, id);
    this.hp = queen.bulbHp;
    this.m = ownMat('#ffd166', { emissive: '#ffb020', ei: 1.2, rough: 0.3 });
    this.g.add(mesh(sphere(0.7, 18), this.m));
    this.g.add(glowSprite('#ffd166', 2.6, 0.5));
    this.obj.add(this.g);
    world.addTarget(this);
  }

  hit(dmg: number): boolean {
    if (!this.alive || !this.queen.started) return false;
    if (this.shielded) {
      audio.play('zap', 2);
      return true;
    }
    // Only the bulb's own health reaches the Queen: a big hit can't burst through to the next one.
    this.queen.damage(Math.min(dmg, this.hp));
    this.hp -= dmg;
    this.g.scale.setScalar(1.25);
    audio.play('hit');
    if (this.hp <= 0) {
      audio.play('pop');
      this.world.particles.emit(this.aim.x, this.aim.y, this.aim.z, { count: 30, color: '#ffd166', speed: 8, life: 0.8, size: 0.7 });
      this.world.removeTarget(this);
      this.remove();
    }
    return true;
  }

  place(t: number, c: THREE.Vector3) {
    const a = this.angle + t * 0.25;
    const r = 4.2;
    this.aim.set(c.x + Math.cos(a) * r, c.y + 2.6 + Math.sin(t * 2 + this.angle) * 0.4, c.z + Math.sin(a) * r);
    this.g.position.copy(this.aim);
    this.g.scale.setScalar(damp(this.g.scale.x, 1, 8, 1 / 60));
    this.m.emissiveIntensity = this.shielded ? 0.2 : 1.2;
    this.m.color.set(this.shielded ? '#6f8f4a' : '#ffd166');
  }
}

class Queen extends Boss {
  protected focusHeight = 3.8;
  readonly title = 'VINE QUEEN';
  private bulbs: Bulb[] = [];
  private model = new THREE.Group();
  private petals: THREE.Mesh[] = [];
  private state: 'idle' | 'slam' | 'volley' | 'guard' = 'idle';
  private stateT = 2;
  private count = 0;
  private slamLine: THREE.Mesh;
  private slamDir = new THREE.Vector3();
  private summoned = 0;
  private cx: number;
  private cz: number;
  /** Health of each of her three bulbs (together, all of hers). */
  readonly bulbHp: number;

  constructor(world: World, id: string, cx: number, cz: number, h: number) {
    const bulbHp = bossHp(world, 6);
    super(world, id, cx, cz, h, 3 * bulbHp);
    this.bulbHp = bulbHp;
    this.cx = cx;
    this.cz = cz;
    const stem = mat('#3fae4a', { rough: 0.5 });
    const petal = mat('#ff6fcf', { emissive: '#ff6fcf', ei: 0.25, rough: 0.4 });
    const m = this.model;
    m.add(mesh(cyl(0.9, 1.4, 3.2, 16), stem, 0, 1.6, 0));
    const head = mesh(sphere(1.5, 24), mat('#8a2f75', { emissive: '#ff5fc8', ei: 0.3 }), 0, 3.8, 0);
    m.add(head);
    for (let i = 0; i < 8; i++) {
      const p = mesh(sphere(1.1, 14), petal, 0, 0, 0);
      p.scale.set(0.5, 0.15, 1.2);
      const a = (i / 8) * Math.PI * 2;
      p.position.set(Math.cos(a) * 1.8, 3.8, Math.sin(a) * 1.8);
      p.rotation.y = -a;
      this.petals.push(p);
      m.add(p);
    }
    for (let i = 0; i < 6; i++) {
      const leaf = mesh(cone(0.6, 3, 5), stem, Math.cos(i) * 2.2, 0.6, Math.sin(i) * 2.2);
      leaf.rotation.z = Math.cos(i) * 1.1;
      leaf.rotation.x = -Math.sin(i) * 1.1;
      m.add(leaf);
    }
    m.add(glowSprite('#ff6fcf', 8, 0.25).translateY(3.8));
    m.position.copy(this.center);
    this.obj.add(m);
    for (let i = 0; i < 3; i++) this.bulbs.push(world.addEntity(new Bulb(world, `${id}.bulb${i}`, this, (i / 3) * Math.PI * 2)));
    this.slamLine = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff5e6a', transparent: true, opacity: 0, depthWrite: false }));
    this.obj.add(this.slamLine);
    world.boxes.push({ minX: this.center.x - 1.4, maxX: this.center.x + 1.4, minZ: this.center.z - 1.4, maxZ: this.center.z + 1.4, bottom: h, top: h + 5, solid: true, dx: 0, dy: 0, dz: 0 });
  }

  reset() {
    this.hp = this.maxHp;
    this.state = 'idle';
    this.stateT = 2;
    for (const b of this.bulbs) {
      if (!b.alive) continue;
      b.hp = this.bulbHp;
    }
  }

  update(dt: number) {
    this.t += dt;
    const c = this.center;
    for (const b of this.bulbs) if (b.alive) b.place(this.t, c);
    if (!this.started) {
      if (this.playerDist() < 12) this.begin();
      return;
    }
    if (this.defeated) {
      this.model.scale.y = damp(this.model.scale.y, 0.2, 1.5, dt);
      return;
    }
    if (this.bulbs.every((b) => !b.alive) && !this.defeated) {
      this.hp = 0;
      this.finish();
      return;
    }
    this.model.rotation.y += dt * 0.3;
    this.stateT -= dt;
    const p = this.player.body;
    switch (this.state) {
      case 'idle':
        if (this.stateT <= 0) {
          this.count += 1;
          this.state = this.count % 4 === 0 ? 'guard' : this.count % 2 ? 'slam' : 'volley';
          this.stateT = this.state === 'slam' ? 1.3 : this.state === 'guard' ? 2.5 : 1;
          if (this.state === 'slam') {
            this.slamDir.set(p.x - c.x, 0, p.z - c.z).normalize();
            audio.play('roar');
          }
          if (this.state === 'guard') {
            for (const b of this.bulbs) b.shielded = true;
            this.spawnHelpers();
          }
        }
        break;
      case 'slam': {
        const len = 16;
        const mid = tmp.copy(this.slamDir).multiplyScalar(len / 2 + 1.5).add(c);
        this.slamLine.position.set(mid.x, c.y + 0.06, mid.z);
        this.slamLine.rotation.y = Math.atan2(this.slamDir.x, this.slamDir.z);
        this.slamLine.scale.set(1, 1, len);
        const mm = this.slamLine.material as THREE.MeshBasicMaterial;
        mm.opacity = this.stateT > 0.4 ? 0.25 + Math.sin(this.t * 25) * 0.1 : 0.7;
        if (this.stateT <= 0.4 && this.stateT + dt > 0.4) {
          audio.play('pound');
          this.world.shake(0.35);
          const rx = p.x - c.x;
          const rz = p.z - c.z;
          const along = rx * this.slamDir.x + rz * this.slamDir.z;
          const side = Math.abs(rx * this.slamDir.z - rz * this.slamDir.x);
          if (along > 0 && along < len + 2 && side < 1.2 && p.y < c.y + 1.2) this.player.hurt(1, c.x, c.z);
          for (let k = 2; k < len; k += 2) this.world.particles.emit(c.x + this.slamDir.x * k, c.y + 0.4, c.z + this.slamDir.z * k, { count: 3, color: '#3fae4a', speed: 3, up: 3, life: 0.5 });
        }
        if (this.stateT <= 0) {
          mm.opacity = 0;
          this.state = 'idle';
          this.stateT = 1.2;
        }
        break;
      }
      case 'volley':
        if (this.stateT <= 0.5 && this.stateT + dt > 0.5) {
          for (let i = 0; i < 4; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = i === 0 ? 0 : 1.5 + Math.random() * 3;
            this.world.addEntity(new Strike(this.world, p.x + Math.cos(a) * r, c.y, p.z + Math.sin(a) * r, 1.2, 1.1, '#c6ff7a', 'rock'));
          }
          audio.play('enemyShoot', 0.6);
        }
        if (this.stateT <= 0) {
          this.state = 'idle';
          this.stateT = 1.6;
        }
        break;
      case 'guard':
        for (const pe of this.petals) pe.rotation.x = damp(pe.rotation.x, -1.1, 6, dt);
        if (this.stateT <= 0) {
          for (const b of this.bulbs) b.shielded = false;
          this.state = 'idle';
          this.stateT = 1;
        }
        break;
    }
    if (this.state !== 'guard') for (const pe of this.petals) pe.rotation.x = damp(pe.rotation.x, 0, 6, dt);
    if (Math.hypot(p.x - c.x, p.z - c.z) < 2 && p.y < c.y + 5) this.player.hurt(1, c.x, c.z);
  }

  private spawnHelpers() {
    if (this.summoned >= 4) return;
    for (let i = 0; i < 2; i++) {
      this.summoned += 1;
      const a = Math.random() * Math.PI * 2;
      const e = this.world.spawnEnemy('sporeling', this.cx + Math.round(Math.cos(a) * 3), this.cz + Math.round(Math.sin(a) * 3), 'toxic');
      e.room = undefined;
    }
  }
}

/* ---------------- 3. Magma Golem ---------------- */

class Golem extends Boss implements Target {
  protected focusHeight = 2.4;
  readonly title = 'MAGMA GOLEM';
  readonly aim = new THREE.Vector3();
  radius = 1.4;
  aimable = true;
  private body: Body;
  private box: Box;
  private model = new THREE.Group();
  private skin: THREE.MeshStandardMaterial;
  private legs: THREE.Mesh[] = [];
  private state: 'chase' | 'stomp' | 'throw' | 'cool' = 'chase';
  private stateT = 2.5;
  private count = 0;
  private yaw = 0;

  constructor(world: World, id: string, cx: number, cz: number, h: number) {
    super(world, id, cx, cz, h, bossHp(world, 18));
    this.body = makeBody(this.center.x, h, this.center.z, 1.5, 3);
    this.skin = ownMat('#4a3228', { emissive: '#ff5e1a', ei: 0.9, rough: 0.8 });
    const m = this.model;
    const torso = mesh(new THREE.DodecahedronGeometry(1.7, 0), this.skin, 0, 2.2, 0);
    torso.scale.set(1.1, 0.9, 1);
    m.add(torso);
    m.add(mesh(new THREE.DodecahedronGeometry(0.8, 0), this.skin, 0, 3.8, 0.2));
    const eye = mat('#ffe066', { emissive: '#ffd166', ei: 2 });
    m.add(mesh(sphere(0.16, 10), eye, -0.3, 3.9, 0.85, false), mesh(sphere(0.16, 10), eye, 0.3, 3.9, 0.85, false));
    for (const sx of [-1, 1]) {
      const arm = mesh(new THREE.DodecahedronGeometry(0.75, 0), this.skin, sx * 2, 2.2, 0.4);
      arm.scale.set(0.8, 1.4, 0.8);
      m.add(arm);
      const leg = mesh(new THREE.DodecahedronGeometry(0.7, 0), this.skin, sx * 0.8, 0.7, 0);
      this.legs.push(leg);
      m.add(leg);
    }
    m.add(blobShadow(5));
    this.obj.add(m);
    this.box = { minX: 0, maxX: 0, minZ: 0, maxZ: 0, bottom: h, top: h + 1.4, solid: false, dx: 0, dy: 0, dz: 0, owner: this };
    world.boxes.push(this.box);
    world.addTarget(this);
  }

  reset() {
    this.hp = this.maxHp;
    this.body.x = this.center.x;
    this.body.z = this.center.z;
    this.state = 'chase';
    this.stateT = 2.5;
  }

  get where(): THREE.Vector3 {
    return new THREE.Vector3(this.body.x, this.body.y, this.body.z);
  }

  hit(dmg: number, kind: HitKind): boolean {
    if (!this.started) return true;
    if (this.state !== 'cool') {
      audio.play('zap', 1.6);
      return true;
    }
    this.damage(kind === 'pound' ? 4 : dmg);
    audio.play('hit');
    return true;
  }

  update(dt: number) {
    this.t += dt;
    const b = this.body;
    if (!this.started) {
      this.sync(0);
      if (this.playerDist() < 11) this.begin();
      return;
    }
    if (this.defeated) {
      this.model.scale.setScalar(damp(this.model.scale.x, 0.3, 1.2, dt));
      this.box.solid = false;
      return;
    }
    const p = this.player.body;
    this.stateT -= dt;
    const dx = p.x - b.x;
    const dz = p.z - b.z;
    const d = Math.hypot(dx, dz) || 1;
    let walk = 0;
    switch (this.state) {
      case 'chase':
        this.yaw = dampAngle(this.yaw, Math.atan2(dx, dz), 3, dt);
        if (d > 3) {
          b.vx = (dx / d) * 2.6;
          b.vz = (dz / d) * 2.6;
          walk = 1;
        } else {
          b.vx = b.vz = 0;
        }
        if (this.stateT <= 0) {
          this.count += 1;
          this.state = this.count % 3 === 0 ? 'cool' : this.count % 3 === 1 ? 'stomp' : 'throw';
          this.stateT = this.state === 'cool' ? 5 : 1.2;
          b.vx = b.vz = 0;
          if (this.state === 'cool') {
            audio.play('vent');
            this.world.hooks.toast('It cooled down! Jump on its back and POUND!', 'bolt');
          }
        }
        break;
      case 'stomp':
        b.vx = b.vz = 0;
        this.model.position.y = b.y + Math.max(0, Math.sin(((1.2 - this.stateT) / 0.7) * Math.PI)) * 0.8;
        if (this.stateT <= 0.5 && this.stateT + dt > 0.5) {
          this.world.addEntity(new Shockwave(this.world, b.x, b.y, b.z, 15, 8, '#ff9a3d'));
          audio.play('pound');
          this.world.shake(0.5);
        }
        if (this.stateT <= 0) {
          this.state = 'chase';
          this.stateT = 2.2;
        }
        break;
      case 'throw':
        b.vx = b.vz = 0;
        if (this.stateT <= 0.6 && this.stateT + dt > 0.6) {
          for (let i = 0; i < 3; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = i === 0 ? 0 : 2 + Math.random() * 2.5;
            this.world.addEntity(new Strike(this.world, p.x + Math.cos(a) * r, b.y, p.z + Math.sin(a) * r, 1.3, 1.3, '#ff7a1a', 'rock'));
          }
        }
        if (this.stateT <= 0) {
          this.state = 'chase';
          this.stateT = 2.4;
        }
        break;
      case 'cool':
        b.vx = b.vz = 0;
        if (Math.random() < 0.3) this.world.particles.emit(b.x, b.y + 2.5, b.z, { count: 1, color: '#f4f0ea', speed: 1, up: 2, life: 0.8, size: 1.2, gravity: 0 });
        if (this.stateT <= 0) {
          this.state = 'chase';
          this.stateT = 2.5;
        }
        break;
    }
    moveBody(b, dt, this.world.grid, [], { stepUp: 0.6 });
    const cool = this.state === 'cool';
    this.skin.emissiveIntensity = damp(this.skin.emissiveIntensity, cool ? 0.05 : 0.9 + Math.sin(this.t * 6) * 0.2, 3, dt);
    this.skin.color.set(cool ? '#6a6a70' : '#4a3228');
    this.aimable = cool;
    // While cooled it crouches into a platform you can stand on.
    this.box.solid = cool;
    this.box.minX = b.x - 1.4;
    this.box.maxX = b.x + 1.4;
    this.box.minZ = b.z - 1.4;
    this.box.maxZ = b.z + 1.4;
    this.box.bottom = b.y;
    this.box.top = b.y + 1.5;
    this.sync(walk);
    if (!cool && d < 2.2 && p.y < b.y + 3.5) this.player.hurt(1, b.x, b.z);
  }

  private sync(walk: number) {
    const b = this.body;
    const cool = this.state === 'cool';
    if (this.state !== 'stomp') this.model.position.set(b.x, b.y - (cool ? 0.9 : 0), b.z);
    else this.model.position.x = b.x;
    this.model.position.z = b.z;
    this.model.rotation.y = this.yaw;
    const s = Math.sin(this.t * 6) * walk;
    this.legs[0].position.y = 0.7 + Math.max(0, s) * 0.4;
    this.legs[1].position.y = 0.7 + Math.max(0, -s) * 0.4;
    this.aim.set(b.x, b.y + (cool ? 1.4 : 2.2), b.z);
  }
}

/* ---------------- 4. King Bloblin ---------------- */

class Blob extends Enemy {
  private hopT = 1.2;

  constructor(
    world: World,
    id: string,
    x: number,
    y: number,
    z: number,
    readonly size: number,
    private king: King,
  ) {
    super(world, id, x, y, z, size >= 3 ? 10 : size >= 2 ? 5 : 3, 0.55 * size, makeGooBlob(size));
    this.bolts = size >= 3 ? 0 : size >= 2 ? 4 : 2;
    this.heartChance = size < 2 ? 0.25 : 0;
    this.aimHeight = 0.5 * size;
    this.badgeY = 1.35;
    this.kind = 'blob';
    this.aggro = true;
  }

  hit(dmg: number, kind: HitKind, from: THREE.Vector3): boolean {
    const before = this.hp;
    const ok = super.hit(kind === 'pound' ? dmg + 2 : dmg, kind, from);
    this.king.damage(Math.max(0, before - Math.max(0, this.hp)));
    return ok;
  }

  die() {
    if (!this.alive) return;
    const pos = this.aim.clone();
    super.die();
    if (this.size > 1.2) {
      const next = this.size >= 3 ? 2 : 1.2;
      for (const s of [-1, 1]) this.king.spawn(pos.x + s * 1.2, this.body.y + 1, pos.z, next);
      this.world.addEntity(new Shockwave(this.world, pos.x, this.body.y, pos.z, 6, 7, '#ff9ae0'));
    }
  }

  protected think(dt: number) {
    const b = this.body;
    this.hopT -= dt;
    if (b.grounded) {
      b.vx = damp(b.vx, 0, 10, dt);
      b.vz = damp(b.vz, 0, 10, dt);
      if (this.hopT <= 0) {
        this.hopT = this.size >= 3 ? 1.6 : this.size >= 2 ? 1.1 : 0.7;
        const p = this.player.body;
        const dx = p.x - b.x;
        const dz = p.z - b.z;
        const d = Math.hypot(dx, dz) || 1;
        b.vy = this.size >= 3 ? 12 : 9;
        const sp = Math.min(d * 0.8, this.size >= 3 ? 5 : 5.5);
        if (this.safeAhead(dx, dz)) {
          b.vx = (dx / d) * sp;
          b.vz = (dz / d) * sp;
        }
        this.yaw = Math.atan2(dx, dz);
      }
    }
    this.model.body.scale.set(1, b.grounded ? 0.9 : 1.1, 1);
  }

  private landed = true;

  update(dt: number) {
    const wasAir = !this.body.grounded;
    super.update(dt);
    if (!this.alive) return;
    if (wasAir && this.body.grounded && !this.landed && this.size >= 3) {
      this.world.addEntity(new Shockwave(this.world, this.body.x, this.body.y, this.body.z, 9, 8, '#ff9ae0'));
      audio.play('pound', 0.7);
      this.world.shake(0.4);
    }
    this.landed = this.body.grounded;
  }
}

/** How close Jason must get to King Bloblin's throne: anywhere on his island starts the fight. */
const KING_WAKE = 13;

class King extends Boss {
  protected focusHeight = 1.8;
  readonly title = 'KING BLOBLIN';
  private blobs: Blob[] = [];
  private crown: THREE.Group;
  private seq = 0;
  /** The King lounging on his island before the fight, so Jason can see where to go. */
  private idle: THREE.Group;
  private idleBody: THREE.Object3D;
  /** A column of light over the island, visible from anywhere on the Ring. */
  private beacon: THREE.Group;
  private beaconMat: THREE.MeshBasicMaterial;

  constructor(world: World, id: string, cx: number, cz: number, h: number) {
    super(world, id, cx, cz, h, 10 + 5 * 2 + 3 * 4);
    this.crown = new THREE.Group();
    const gold = mat('#ffd166', { emissive: '#ffb020', ei: 0.6, metal: 0.7, rough: 0.25 });
    this.crown.add(mesh(cyl(0.7, 0.8, 0.4, 12), gold));
    for (let i = 0; i < 5; i++) this.crown.add(mesh(cone(0.18, 0.5, 6), gold, Math.cos((i / 5) * Math.PI * 2) * 0.62, 0.4, Math.sin((i / 5) * Math.PI * 2) * 0.62));
    this.obj.add(this.crown);
    this.crown.visible = false;

    const king = makeGooBlob(3.2);
    this.idle = new THREE.Group();
    this.idle.add(king.root);
    const idleCrown = this.crown.clone();
    idleCrown.visible = true;
    idleCrown.position.y = 3.2 * 0.95 + 0.2;
    this.idle.add(idleCrown);
    this.idleBody = king.body;
    this.idle.position.copy(this.center);
    this.obj.add(this.idle);

    this.beacon = new THREE.Group();
    this.beaconMat = new THREE.MeshBasicMaterial({ color: '#ff7fd0', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const column = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 2.2, 36, 20, 1, true), this.beaconMat);
    column.position.y = 18;
    this.beacon.add(column);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.5, 36, 10, 1, true), this.beaconMat);
    core.position.y = 18;
    this.beacon.add(core);
    const top = glowSprite('#ff9ae0', 7, 0.55);
    top.position.y = 14;
    this.beacon.add(top);
    this.beacon.position.copy(this.center);
    this.obj.add(this.beacon);
  }

  /** The camera follows the big crowned blob while it's around. */
  get where(): THREE.Vector3 {
    const king = this.blobs.find((b) => b.alive && b.size >= 3);
    return king ? new THREE.Vector3(king.body.x, king.body.y, king.body.z) : this.center;
  }

  spawn(x: number, y: number, z: number, size: number) {
    this.seq += 1;
    const b = this.world.addEntity(new Blob(this.world, `${this.id}.b${this.seq}`, x, y, z, size, this));
    this.world.registerEnemy(b);
    this.blobs.push(b);
    return b;
  }

  protected onIntro() {
    // The lounging King leaps up out of sight and drops back in, ready to fight.
    this.idle.visible = false;
    this.beacon.visible = false;
    this.spawn(this.center.x, this.center.y + 6, this.center.z, 3.2);
  }

  protected onStart() {
    this.crown.visible = true;
  }

  reset() {
    for (const b of this.blobs) if (b.alive) b.remove();
    this.blobs = [];
    this.hp = this.maxHp;
    this.started = false;
    this.crown.visible = false;
    this.idle.visible = true;
    this.beacon.visible = true;
  }

  update(dt: number) {
    this.t += dt;
    if (!this.started) {
      if (this.idle.visible) {
        // Snoozing and wobbling on the throne, under a beacon that says "over here!".
        const s = Math.sin(this.t * 2.2);
        this.idleBody.scale.set(1 + s * 0.05, 1 - s * 0.06, 1 + s * 0.05);
        this.idle.rotation.y = Math.sin(this.t * 0.4) * 0.5;
        this.beaconMat.opacity = 0.18 + Math.sin(this.t * 2.6) * 0.06;
      }
      const p = this.player.body;
      if (this.playerDist() < KING_WAKE && p.grounded && Math.abs(p.y - this.center.y) < 1.5) this.begin();
      return;
    }
    if (this.defeated) return;
    const king = this.blobs.find((b) => b.alive && b.size >= 3);
    if (king) {
      this.crown.position.set(king.body.x, king.body.y + 3.2 * 0.95 + 0.2, king.body.z);
      this.crown.rotation.y += dt;
    } else {
      this.crown.visible = false;
    }
    if (this.blobs.length && this.blobs.every((b) => !b.alive)) {
      this.hp = 0;
      this.finish();
    }
  }
}

/* ---------------- 5. CERBERUS ---------------- */

class Pylon extends Entity implements Interactable {
  readonly spot: THREE.Vector3;
  range = 2.8;
  hacked = false;
  private light: THREE.MeshStandardMaterial;

  constructor(
    world: World,
    id: string,
    x: number,
    y: number,
    z: number,
    private dog: Wardog,
  ) {
    super(world, id);
    this.spot = new THREE.Vector3(x, y, z);
    this.obj.add(mesh(cyl(0.5, 0.7, 2.4, 12), mat('#3a404c', { metal: 0.6 }), x, y + 1.2, z));
    this.light = ownMat('#5ecbff', { emissive: '#3fb6ff', ei: 1.6 });
    this.obj.add(mesh(sphere(0.45, 16), this.light, x, y + 2.7, z, false));
    world.boxes.push({ minX: x - 0.6, maxX: x + 0.6, minZ: z - 0.6, maxZ: z + 0.6, bottom: y, top: y + 2.4, solid: true, dx: 0, dy: 0, dz: 0 });
    world.addInteractable(this);
  }

  label() {
    return this.dog.started && !this.dog.defeated && !this.hacked ? 'HACK PYLON' : null;
  }

  interact() {
    this.world.hooks.hack(3, (ok) => {
      if (!ok) return;
      this.set(true);
      this.dog.pylonDown();
    });
  }

  set(h: boolean) {
    this.hacked = h;
    this.light.color.set(h ? '#3dff8a' : '#5ecbff');
    this.light.emissive.set(h ? '#3dff8a' : '#3fb6ff');
  }
}

class Wardog extends Boss implements Target {
  protected focusHeight = 2.6;
  readonly title = 'CERBERUS';
  readonly aim = new THREE.Vector3();
  radius = 1.6;
  aimable = true;
  private model = new THREE.Group();
  private shield: THREE.Mesh;
  private shieldUp = true;
  private downT = 0;
  private pylons: Pylon[] = [];
  private state: 'idle' | 'missiles' | 'sweep' = 'idle';
  private stateT = 2;
  private count = 0;
  private sweep: THREE.Mesh;
  private sweepA = 0;
  private yaw = 0;

  constructor(world: World, id: string, cx: number, cz: number, h: number) {
    super(world, id, cx, cz, h, bossHp(world, 24));
    const steel = mat('#5a6272', { metal: 0.6, rough: 0.35 });
    const red = mat('#ff3040', { emissive: '#ff3040', ei: 1.5 });
    const m = this.model;
    m.add(mesh(boxG(3, 1.4, 3.6), steel, 0, 2, 0));
    m.add(mesh(boxG(1.6, 1, 1.4), steel, 0, 3, 1.4));
    m.add(mesh(boxG(1.2, 0.2, 0.1), red, 0, 3.05, 2.12, false));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const leg = mesh(boxG(0.5, 2, 0.5), steel, sx * 1.4, 0.9, sz * 1.4);
      leg.rotation.z = sx * 0.2;
      m.add(leg);
    }
    m.add(mesh(cyl(0.25, 0.25, 1.8, 10), steel, 1.1, 2.8, 1.4).rotateX(Math.PI / 2));
    m.add(mesh(cyl(0.25, 0.25, 1.8, 10), steel, -1.1, 2.8, 1.4).rotateX(Math.PI / 2));
    m.add(mesh(sphere(0.4, 14), mat('#ffd166', { emissive: '#ffb020', ei: 1.4 }), 0, 2.6, 1.9, false));
    m.position.copy(this.center);
    this.obj.add(m);
    this.shield = new THREE.Mesh(
      new THREE.SphereGeometry(3.6, 28, 20),
      new THREE.MeshStandardMaterial({ color: '#5ecbff', emissive: '#3fb6ff', emissiveIntensity: 0.7, transparent: true, opacity: 0.25, depthWrite: false }),
    );
    this.shield.position.set(this.center.x, h + 2, this.center.z);
    this.obj.add(this.shield);
    const geo = new THREE.CylinderGeometry(0.12, 0.12, 13, 8).rotateZ(Math.PI / 2).translate(6.5, 0, 0);
    this.sweep = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#ff2238', transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false }));
    this.sweep.position.set(this.center.x, h + 0.45, this.center.z);
    this.sweep.visible = false;
    this.obj.add(this.sweep);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
      this.pylons.push(world.addEntity(new Pylon(world, `${id}.pylon${i}`, this.center.x + Math.cos(a) * 8, h, this.center.z + Math.sin(a) * 8, this)));
    }
    world.boxes.push({ minX: this.center.x - 1.8, maxX: this.center.x + 1.8, minZ: this.center.z - 2, maxZ: this.center.z + 2, bottom: h, top: h + 3.5, solid: true, dx: 0, dy: 0, dz: 0 });
    world.addTarget(this);
  }

  pylonDown() {
    if (this.pylons.every((p) => p.hacked)) {
      this.shieldUp = false;
      this.downT = 9;
      audio.play('explode');
      this.world.shake(0.4);
      this.world.hooks.toast('Shield down! Blast CERBERUS now!', 'bolt');
    } else {
      this.world.hooks.toast(tr('Pylon hacked! {n} to go.', { n: this.pylons.filter((p) => !p.hacked).length }), 'bolt');
    }
  }

  hit(dmg: number): boolean {
    if (!this.started) return true;
    if (this.shieldUp) {
      audio.play('shield');
      return true;
    }
    this.damage(dmg);
    audio.play('hit');
    return true;
  }

  reset() {
    this.hp = this.maxHp;
    this.shieldUp = true;
    for (const p of this.pylons) p.set(false);
    this.state = 'idle';
    this.stateT = 2;
  }

  update(dt: number) {
    this.t += dt;
    const c = this.center;
    if (!this.started) {
      if (this.playerDist() < 12) this.begin();
      return;
    }
    if (this.defeated) {
      this.model.position.y = damp(this.model.position.y, c.y - 1, 1, dt);
      this.shield.visible = false;
      this.sweep.visible = false;
      return;
    }
    const p = this.player.body;
    this.yaw = dampAngle(this.yaw, Math.atan2(p.x - c.x, p.z - c.z), 2, dt);
    this.model.rotation.y = this.yaw;
    if (!this.shieldUp) {
      this.downT -= dt;
      if (this.downT <= 0) {
        this.shieldUp = true;
        const reboot = this.pylons[Math.floor(Math.random() * 3)];
        reboot.set(false);
        audio.play('shield');
        this.world.hooks.toast('Shield is back! One pylon rebooted. Hack it again!', 'bolt');
      }
    }
    this.shield.visible = this.shieldUp;
    (this.shield.material as THREE.MeshStandardMaterial).opacity = 0.2 + Math.sin(this.t * 3) * 0.05;
    this.stateT -= dt;
    switch (this.state) {
      case 'idle':
        if (this.stateT <= 0) {
          this.count += 1;
          this.state = this.count % 2 ? 'missiles' : 'sweep';
          this.stateT = this.state === 'sweep' ? 4.5 : 1.2;
          this.sweepA = this.yaw - Math.PI / 2;
          if (this.state === 'sweep') this.world.hooks.toast('Laser sweep! JUMP over it!', 'bolt');
        }
        break;
      case 'missiles':
        if (this.stateT <= 0.7 && this.stateT + dt > 0.7) {
          for (let i = 0; i < 5; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = i === 0 ? 0 : 1.8 + Math.random() * 3.5;
            this.world.addEntity(new Strike(this.world, p.x + Math.cos(a) * r, c.y, p.z + Math.sin(a) * r, 1.3 + i * 0.1, 1.2, '#ff5e6a', 'missile'));
          }
          audio.play('enemyShoot', 0.8);
        }
        if (this.stateT <= 0) {
          this.state = 'idle';
          this.stateT = 2.2;
        }
        break;
      case 'sweep': {
        this.sweep.visible = true;
        this.sweepA += dt * 1.25;
        this.sweep.rotation.y = -this.sweepA;
        const ang = Math.atan2(p.z - c.z, p.x - c.x);
        let diff = Math.abs(((ang - this.sweepA) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        diff = Math.min(diff, Math.PI * 2 - diff);
        const r = Math.hypot(p.x - c.x, p.z - c.z);
        if (diff < 0.1 && r < 13.5 && r > 2 && p.y < c.y + 0.75) this.player.hurt(1, c.x, c.z);
        if (this.stateT <= 0) {
          this.sweep.visible = false;
          this.state = 'idle';
          this.stateT = 2;
        }
        break;
      }
    }
    this.aim.set(c.x + Math.sin(this.yaw) * 1.9, c.y + 2.6, c.z + Math.cos(this.yaw) * 1.9);
    this.aimable = !this.shieldUp;
  }
}

/* ---------------- 6. Heart of GaScu ---------------- */

class Pod extends Entity implements Target {
  readonly aim = new THREE.Vector3();
  radius = 0.9;
  aimable = true;
  hp: number;
  private m: THREE.MeshStandardMaterial;

  constructor(
    world: World,
    id: string,
    x: number,
    y: number,
    z: number,
    private heart: Heart,
  ) {
    super(world, id);
    this.hp = heart.podHp;
    this.aim.set(x, y + 1.3, z);
    this.m = ownMat('#8a2f75', { emissive: '#ff5fc8', ei: 0.6 });
    const pod = mesh(sphere(0.9, 18), this.m, x, y + 1.3, z);
    pod.scale.set(1, 1.3, 1);
    this.obj.add(pod);
    for (let i = 0; i < 6; i++) {
      const th = mesh(cone(0.18, 0.8, 5), mat('#5a1f3c'), x + Math.cos(i) * 0.8, y + 1.3 + Math.sin(i * 2) * 0.5, z + Math.sin(i) * 0.8);
      th.lookAt(x + Math.cos(i) * 3, y + 1.3, z + Math.sin(i) * 3);
      th.rotateX(Math.PI / 2);
      this.obj.add(th);
    }
    this.obj.add(mesh(cyl(0.2, 0.4, 1.4, 8), mat('#3fae4a'), x, y + 0.5, z));
    world.addTarget(this);
  }

  hit(dmg: number): boolean {
    if (!this.alive || !this.heart.started || this.heart.calm) return false;
    // Only the pod's own health reaches the Heart: a big hit can't burst through to the core's share.
    this.heart.damage(Math.min(dmg, this.hp));
    this.hp -= dmg;
    this.m.emissiveIntensity = 2.5;
    audio.play('hit');
    if (this.hp <= 0) {
      audio.play('pop');
      this.world.particles.emit(this.aim.x, this.aim.y, this.aim.z, { count: 30, color: '#ff5fc8', speed: 8, life: 0.8, size: 0.7 });
      this.world.removeTarget(this);
      this.remove();
    }
    return true;
  }

  update(dt: number) {
    this.m.emissiveIntensity = damp(this.m.emissiveIntensity, 0.6 + Math.sin(this.heart.time * 3) * 0.2, 6, dt);
  }
}

type HeartState = 'idle' | 'roots' | 'nova' | 'open';

export class Heart extends Boss implements Target, Interactable {
  protected focusHeight = 3.6;
  readonly title = 'THE HEART OF GASCU';
  readonly aim = new THREE.Vector3();
  radius = 1.8;
  aimable = false;
  readonly spot: THREE.Vector3;
  range = 9;
  calm = false;
  private pods: Pod[] = [];
  private model = new THREE.Group();
  private core: THREE.MeshStandardMaterial;
  private shell: THREE.Group;
  private phase: 1 | 2 = 1;
  private state: HeartState = 'idle';
  private stateT = 2.5;
  private count = 0;
  private cx: number;
  private cz: number;
  private summoned = 0;
  private speakTries = 0;
  /** Health of each of the four pods, and of the core once they're gone. */
  readonly podHp: number;
  private readonly coreHp: number;

  constructor(world: World, id: string, cx: number, cz: number, h: number) {
    const podHp = bossHp(world, 4);
    const coreHp = bossHp(world, 16);
    super(world, id, cx, cz, h, 4 * podHp + coreHp);
    this.podHp = podHp;
    this.coreHp = coreHp;
    // The pods first (half the bar), then the core.
    this.phaseMarks = [0.5];
    this.cx = cx;
    this.cz = cz;
    this.spot = this.center.clone();
    this.core = ownMat('#ffc6ef', { emissive: '#ff5fc8', ei: 1.2, rough: 0.2 });
    const m = this.model;
    m.add(mesh(cyl(1.4, 2.6, 2, 18), mat('#3a1f3c', { rough: 0.7 }), 0, 1, 0));
    const coreMesh = mesh(sphere(1.7, 28), this.core, 0, 3.6, 0);
    m.add(coreMesh);
    m.add(glowSprite('#ff6fcf', 11, 0.4).translateY(3.6));
    this.shell = new THREE.Group();
    const thorn = mat('#5a1f3c', { rough: 0.6 });
    for (let i = 0; i < 10; i++) {
      const petal = mesh(sphere(1.2, 16), thorn, 0, 0, 0);
      petal.scale.set(0.45, 1.3, 0.2);
      const a = (i / 10) * Math.PI * 2;
      petal.position.set(Math.cos(a) * 1.5, 3.6, Math.sin(a) * 1.5);
      petal.rotation.y = -a;
      petal.rotation.x = 0.3;
      this.shell.add(petal);
    }
    m.add(this.shell);
    for (let i = 0; i < 7; i++) {
      const vine = mesh(torus(3 + i * 0.6, 0.12), mat('#3fae4a', { rough: 0.6 }), 0, 0.2, 0);
      vine.rotation.x = Math.PI / 2 + (Math.random() - 0.5) * 0.2;
      m.add(vine);
    }
    m.position.copy(this.center);
    this.obj.add(m);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      this.pods.push(world.addEntity(new Pod(world, `${id}.pod${i}`, this.center.x + Math.cos(a) * 6.5, h, this.center.z + Math.sin(a) * 6.5, this)));
    }
    this.box = { minX: this.center.x - 2, maxX: this.center.x + 2, minZ: this.center.z - 2, maxZ: this.center.z + 2, bottom: h, top: h + 5.5, solid: true, dx: 0, dy: 0, dz: 0 };
    world.boxes.push(this.box);
    world.addTarget(this);
    world.addInteractable(this);
  }

  get time() {
    return this.t;
  }

  /** When the Heart leaves (its rebirth), its pods go with it. */
  private box: Box;

  remove() {
    for (const p of this.pods) if (p.alive) p.remove();
    const i = this.world.boxes.indexOf(this.box);
    if (i >= 0) this.world.boxes.splice(i, 1);
    super.remove();
  }

  /** The friendship ending: the Heart calms down, glows gold and opens up like a flower. */
  befriend(k: number) {
    this.calm = true;
    this.core.color.set('#ffc6ef').lerp(new THREE.Color('#fff0b0'), k);
    this.core.emissive.set('#ff5fc8').lerp(new THREE.Color('#ffb020'), k);
    for (const petal of this.shell.children) petal.rotation.x = 0.3 + k * 1.2;
  }

  /** The secret path: with every memory shard, LUX can speak GaScu's light-language. */
  label() {
    if (!this.started || this.defeated || this.calm) return null;
    return this.world.save.shards.length >= 18 ? 'SPEAK' : null;
  }

  interact() {
    this.calm = true;
    this.world.hooks.say(this.world.dialogue('speak'), () => {
      this.world.hooks.hack(4 + Math.min(2, this.speakTries), (ok) => {
        this.speakTries += 1;
        if (!ok) {
          this.calm = false;
          this.world.hooks.toast('The Heart flinched. Try again, gently!', 'bolt');
          return;
        }
        this.world.hooks.hack(5, (ok2) => {
          if (!ok2) {
            this.calm = false;
            this.world.hooks.toast('So close! Speak to it again.', 'bolt');
            return;
          }
          this.defeated = true;
          this.world.hooks.bossBar(null, 0);
          this.world.communed();
        });
      });
    });
  }

  hit(dmg: number): boolean {
    if (!this.started || this.calm) return true;
    if (this.phase === 1 || this.state !== 'open') {
      audio.play('zap', 1.8);
      return true;
    }
    this.damage(dmg);
    this.core.emissiveIntensity = 3;
    audio.play('hit');
    return true;
  }

  reset() {
    this.hp = Math.max(this.hp, this.phase === 2 ? this.coreHp : this.maxHp);
    this.state = 'idle';
    this.stateT = 2.5;
    this.calm = false;
  }

  update(dt: number) {
    this.t += dt;
    const c = this.center;
    this.core.emissiveIntensity = damp(this.core.emissiveIntensity, 1.2 + Math.sin(this.t * 2.5) * 0.4, 5, dt);
    this.model.scale.setScalar(1 + Math.sin(this.t * 2.5) * 0.02);
    if (!this.started) {
      if (this.playerDist() < 13) this.begin();
      return;
    }
    if (this.defeated) {
      this.shell.scale.setScalar(damp(this.shell.scale.x, 0.01, 1, dt));
      return;
    }
    if (this.calm) return;
    if (this.phase === 1 && this.pods.every((p) => !p.alive)) {
      this.phase = 2;
      audio.play('roar');
      this.world.shake(0.6);
      this.world.hooks.toast('The shell is cracking! Blast the Heart when it opens!', 'bolt');
    }
    const p = this.player.body;
    this.stateT -= dt;
    switch (this.state) {
      case 'idle':
        if (this.stateT <= 0) {
          this.count += 1;
          const cycle: HeartState[] = this.phase === 2 ? ['roots', 'open', 'nova', 'open'] : ['roots', 'nova'];
          const next = cycle[this.count % cycle.length];
          this.state = next;
          this.stateT = this.state === 'open' ? 3.5 : 1.3;
          if (this.state === 'nova') audio.play('roar');
          if (this.state === 'open' && this.summoned < 6) {
            this.summoned += 2;
            for (let i = 0; i < 2; i++) this.world.spawnEnemy('sporeling', this.cx + (i ? 4 : -4), this.cz + 3, 'goo');
          }
        }
        break;
      case 'roots':
        if (this.stateT <= 0.9 && this.stateT + dt > 0.9) {
          const n = this.phase === 2 ? 6 : 4;
          for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = i === 0 ? 0 : 1.5 + Math.random() * 3.5;
            this.world.addEntity(new Strike(this.world, p.x + Math.cos(a) * r, c.y, p.z + Math.sin(a) * r, 1.1, 1.2, '#ff6fcf', 'ice'));
          }
        }
        if (this.stateT <= 0) {
          this.state = 'idle';
          this.stateT = 1.5;
        }
        break;
      case 'nova':
        if (this.stateT <= 0.5 && this.stateT + dt > 0.5) {
          this.world.addEntity(new Shockwave(this.world, c.x, c.y, c.z, 18, 8, '#ff6fcf'));
          audio.play('pound');
        }
        if (this.stateT <= 0) {
          this.state = 'idle';
          this.stateT = 1.4;
        }
        break;
      case 'open':
        if (this.stateT <= 0) {
          this.state = 'idle';
          this.stateT = 1.2;
        }
        break;
    }
    const open = this.state === 'open' && this.phase === 2;
    for (const petal of this.shell.children) petal.rotation.x = damp(petal.rotation.x, open ? 1.3 : 0.3, 4, dt);
    this.aimable = open;
    this.aim.set(c.x, c.y + 3.6, c.z);
    if (Math.hypot(p.x - c.x, p.z - c.z) < 2.6 && p.y < c.y + 5.5) this.player.hurt(1, c.x, c.z);
  }
}

/* ---------------- 7. GaScu Reborn (the final, final battle) ---------------- */

type RebornState = 'idle' | 'storm' | 'sweep' | 'rain' | 'open';

/**
 * After the Heart of GaScu falls, every vine on the ship pulls back into it and it rises again: a
 * floating thorn titan with one great eye. It attacks in patterns that speed up as it weakens,
 * and it is only hurt while its eye is open.
 */
export class Reborn extends Boss implements Target, Interactable {
  readonly title = 'GASCU REBORN';
  protected focusHeight = 4.4;
  readonly aim = new THREE.Vector3();
  radius = 2.2;
  aimable = false;
  readonly spot: THREE.Vector3;
  range = 10;
  calm = false;
  private model = new THREE.Group();
  private core: THREE.MeshStandardMaterial;
  private iris: THREE.MeshStandardMaterial;
  private lidTop: THREE.Mesh;
  private lidBottom: THREE.Mesh;
  private thorns = new THREE.Group();
  private arms: THREE.Group[] = [];
  private beams: THREE.Mesh[] = [];
  private state: RebornState = 'idle';
  private stateT = 2;
  private count = 0;
  private wave = 0;
  private waveT = 0;
  private sweepA = 0;
  private summoned = 0;
  private yaw = 0;
  private open = 0;
  /** 0 while it rises out of the floor in its entrance, 1 when fully formed. */
  rise = 1;
  /** Lets a cutscene force the great eye open. */
  glare = 0;
  private cx: number;
  private cz: number;

  constructor(world: World, id: string, cx: number, cz: number, h: number) {
    // The last fight should be a long one.
    super(world, id, cx, cz, h, bossHp(world, 80));
    this.phaseMarks = [0.66, 0.33];
    this.cx = cx;
    this.cz = cz;
    this.spot = this.center.clone();
    this.core = ownMat('#3a0a1a', { emissive: '#ff2a5a', ei: 0.7, rough: 0.35 });
    this.iris = ownMat('#fff0c0', { emissive: '#ffb030', ei: 2.5 });
    const m = this.model;
    const body = mesh(sphere(2, 32), this.core, 0, 0, 0);
    body.scale.set(1, 0.92, 1);
    m.add(body);
    // The great eye, with lids that open when it is vulnerable.
    m.add(mesh(sphere(0.95, 24), mat('#1a0610'), 0, 0.1, 1.45, false));
    const pupil = mesh(sphere(0.62, 20), this.iris, 0, 0.1, 1.72, false);
    pupil.scale.set(0.55, 1, 0.4);
    m.add(pupil);
    const lidMat = mat('#4a0c22', { emissive: '#ff2a5a', ei: 0.25, rough: 0.4 });
    this.lidTop = mesh(new THREE.SphereGeometry(1.02, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), lidMat, 0, 0.1, 1.45, false);
    this.lidBottom = mesh(new THREE.SphereGeometry(1.02, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), lidMat, 0, 0.1, 1.45, false);
    this.lidTop.rotation.x = Math.PI / 2;
    this.lidBottom.rotation.x = Math.PI / 2;
    m.add(this.lidTop, this.lidBottom);
    // A crown of glowing thorns.
    const thorn = mat('#2a0616', { rough: 0.5 });
    const glow = mat('#ff4fd8', { emissive: '#ff4fd8', ei: 2 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const t = mesh(cone(0.32, 2.2 + (i % 3) * 0.6, 6), thorn, Math.cos(a) * 1.6, 0.4, Math.sin(a) * 1.6);
      t.lookAt(Math.cos(a) * 4, 1.6, Math.sin(a) * 4);
      t.rotateX(Math.PI / 2);
      this.thorns.add(t);
      this.thorns.add(mesh(sphere(0.16, 8), glow, Math.cos(a) * 2.2, 0.9, Math.sin(a) * 2.2, false));
    }
    m.add(this.thorns);
    // Four vine arms reaching down to the floor.
    const vine = mat('#3a1030', { emissive: '#ff2a5a', ei: 0.15, rough: 0.6 });
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Group();
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      arm.position.set(Math.cos(a) * 1.3, -1.2, Math.sin(a) * 1.3);
      arm.rotation.y = -a;
      let parent: THREE.Object3D = arm;
      for (let k = 0; k < 5; k++) {
        const seg = new THREE.Group();
        seg.position.set(k === 0 ? 0 : 0.85, k === 0 ? 0 : -0.25, 0);
        seg.add(mesh(capsule(0.28 - k * 0.04, 0.7), vine, 0.42, 0, 0).rotateZ(Math.PI / 2));
        parent.add(seg);
        parent = seg;
      }
      m.add(arm);
      this.arms.push(arm);
    }
    m.add(glowSprite('#ff2a5a', 14, 0.35));
    m.position.copy(this.center);
    this.obj.add(m);
    // Two sweeping vine-beams along the floor.
    const bgeo = new THREE.CylinderGeometry(0.16, 0.16, 15, 8).rotateZ(Math.PI / 2).translate(7.5, 0, 0);
    for (let i = 0; i < 2; i++) {
      const b = new THREE.Mesh(bgeo, new THREE.MeshBasicMaterial({ color: '#ff2a8a', transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false }));
      b.position.set(this.center.x, h + 0.45, this.center.z);
      b.visible = false;
      this.obj.add(b);
      this.beams.push(b);
    }
    world.addTarget(this);
    world.addInteractable(this);
  }

  get time() {
    return this.t;
  }

  /** The secret path still works here: with every memory shard, LUX can talk it down. */
  label() {
    if (!this.started || this.defeated || this.calm) return null;
    return this.world.save.shards.length >= 18 ? 'SPEAK' : null;
  }

  interact() {
    this.calm = true;
    this.world.hooks.say(this.world.dialogue('speak'), () => {
      this.world.hooks.hack(6, (ok) => {
        if (!ok) {
          this.calm = false;
          this.world.hooks.toast('It is too angry to listen... try again!', 'bolt');
          return;
        }
        this.defeated = true;
        this.world.hooks.bossBar(null, 0);
        this.world.communed();
      });
    });
  }

  befriend(k: number) {
    this.calm = true;
    this.core.color.set('#3a0a1a').lerp(new THREE.Color('#fff0b0'), k);
    this.core.emissive.set('#ff2a5a').lerp(new THREE.Color('#ffb020'), k);
    this.open = Math.max(this.open, k);
  }

  hit(dmg: number, kind: HitKind): boolean {
    if (!this.started || this.calm) return true;
    if (this.state !== 'open') {
      audio.play('zap', 1.6);
      return true;
    }
    this.damage(kind === 'blast' ? Math.round(dmg * 1.5) : dmg);
    this.iris.emissiveIntensity = 5;
    audio.play('hit');
    return true;
  }

  reset() {
    this.hp = this.maxHp;
    this.state = 'idle';
    this.stateT = 2.5;
    this.count = 0;
    this.calm = false;
    for (const b of this.beams) b.visible = false;
  }

  private get phase() {
    const f = this.hp / this.maxHp;
    return f > 0.66 ? 1 : f > 0.33 ? 2 : 3;
  }

  update(dt: number) {
    this.t += dt;
    const c = this.center;
    const hover = c.y + 3.4 + Math.sin(this.t * 1.3) * 0.3;
    this.model.position.set(c.x, c.y - 6 + (hover - c.y + 6) * this.rise, c.z);
    this.thorns.rotation.y += dt * (0.4 + (this.started ? this.phase * 0.25 : 0));
    this.arms.forEach((arm, i) => {
      let seg: THREE.Object3D | undefined = arm.children.find((o) => o instanceof THREE.Group);
      let k = 0;
      while (seg) {
        seg.rotation.z = -0.25 - Math.sin(this.t * 1.6 + i * 1.3 + k * 0.7) * 0.18;
        seg = seg.children.find((o) => o instanceof THREE.Group);
        k += 1;
      }
    });
    const p = this.player.body;
    this.yaw = dampAngle(this.yaw, Math.atan2(p.x - c.x, p.z - c.z), 2.5, dt);
    this.model.rotation.y = this.yaw;
    const wantOpen = this.state === 'open' || this.calm ? 1 : Math.max(0.05, this.glare);
    this.open = damp(this.open, wantOpen, 8, dt);
    this.lidTop.rotation.x = Math.PI / 2 - this.open * 1.2;
    this.lidBottom.rotation.x = Math.PI / 2 + this.open * 1.2;
    this.iris.emissiveIntensity = damp(this.iris.emissiveIntensity, 2.5, 4, dt);
    const eye = new THREE.Vector3(Math.sin(this.yaw) * 1.7, 0.1, Math.cos(this.yaw) * 1.7);
    this.aim.copy(this.model.position).add(eye);
    this.aimable = this.state === 'open' && !this.calm;
    if (!this.started) {
      if (this.rise >= 1 && this.playerDist() < 13) this.begin();
      return;
    }
    if (this.defeated) {
      this.model.scale.setScalar(damp(this.model.scale.x, 0.25, 1.2, dt));
      for (const b of this.beams) b.visible = false;
      return;
    }
    if (this.calm) return;
    const ph = this.phase;
    const pace = ph === 3 ? 0.8 : 1;
    this.stateT -= dt;
    switch (this.state) {
      case 'idle':
        if (this.stateT <= 0) {
          this.count += 1;
          const cycle: RebornState[] = ph === 1 ? ['storm', 'open', 'rain', 'open'] : ph === 2 ? ['storm', 'sweep', 'open', 'rain', 'open'] : ['storm', 'sweep', 'rain', 'open'];
          this.state = cycle[this.count % cycle.length];
          this.stateT = { idle: 1, storm: 2.2, sweep: 5, rain: 1.6, open: ph === 3 ? 3 : 3.6 }[this.state] * pace;
          this.wave = 0;
          this.waveT = 0.3;
          if (this.state === 'sweep') {
            this.sweepA = this.yaw;
            this.world.hooks.toast('Vine beams! JUMP over them!', 'bolt');
            for (const b of this.beams) b.visible = true;
          }
          if (this.state === 'open') {
            audio.play('vent', 0.7);
            this.world.hooks.toast('Its eye is open! BLAST it! Charge a FIREBALL!', 'bolt');
          }
          if (this.state === 'storm' || this.state === 'rain') audio.play('roar');
        }
        break;
      case 'storm': {
        // Rings of glowing thorns: find a gap, or jump over them.
        this.waveT -= dt;
        if (this.waveT <= 0 && this.wave < 3) {
          this.waveT = 0.55 * pace;
          const n = 10 + ph * 3;
          const off = this.wave * 0.3 + Math.random() * 0.2;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + off;
            const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
            const from = new THREE.Vector3(c.x + dir.x * 2.6, c.y + 1, c.z + dir.z * 2.6);
            this.world.shots.fire('enemy', from, dir, 6 + ph, 1);
          }
          audio.play('enemyShoot', 0.6);
          this.wave += 1;
        }
        if (this.stateT <= 0) {
          this.state = 'idle';
          this.stateT = 0.9 * pace;
        }
        break;
      }
      case 'sweep': {
        const dir = this.count % 2 ? 1 : -1;
        this.sweepA += dt * (0.9 + ph * 0.25) * dir;
        const r = Math.hypot(p.x - c.x, p.z - c.z);
        const ang = Math.atan2(p.z - c.z, p.x - c.x);
        this.beams.forEach((b, i) => {
          const a = this.sweepA + i * Math.PI;
          b.rotation.y = -a;
          let diff = Math.abs((((ang - a) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2));
          diff = Math.min(diff, Math.PI * 2 - diff);
          if (diff < 0.11 && r < 15 && r > 2.4 && p.y < c.y + 0.8) this.player.hurt(1, c.x, c.z);
        });
        if (this.stateT <= 0) {
          for (const b of this.beams) b.visible = false;
          this.state = 'idle';
          this.stateT = 1 * pace;
        }
        break;
      }
      case 'rain':
        if (this.stateT <= 1.1 * pace && this.stateT + dt > 1.1 * pace) {
          const n = 5 + ph * 2;
          for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = i === 0 ? 0 : 1.6 + Math.random() * 4;
            this.world.addEntity(new Strike(this.world, p.x + Math.cos(a) * r, c.y, p.z + Math.sin(a) * r, 1.1, 1.2, '#ff2a8a', 'ice'));
          }
          if (ph >= 2 && this.summoned < 6) {
            this.summoned += 2;
            for (const s of [-1, 1]) this.world.spawnEnemy('sporeling', this.cx + s * 4, this.cz + 3, 'default');
          }
        }
        if (this.stateT <= 0) {
          this.state = 'idle';
          this.stateT = 1.2 * pace;
        }
        break;
      case 'open':
        if (Math.random() < 0.3) this.world.particles.emit(this.aim.x, this.aim.y, this.aim.z, { count: 1, color: '#ffd166', speed: 1.5, life: 0.5, size: 0.5, gravity: 0 });
        if (this.stateT <= 0) {
          this.state = 'idle';
          this.stateT = 1 * pace;
        }
        break;
    }
    if (Math.hypot(p.x - c.x, p.z - c.z) < 2.6 && p.y < c.y + 5) this.player.hurt(1, c.x, c.z);
  }
}

function build(world: World, id: string, kind: BossKind, cx: number, cz: number, h: number): Boss {
  switch (kind) {
    case 'warden':
      return new Warden(world, id, cx, cz, h);
    case 'queen':
      return new Queen(world, id, cx, cz, h);
    case 'golem':
      return new Golem(world, id, cx, cz, h);
    case 'bloblin':
      return new King(world, id, cx, cz, h);
    case 'wardog':
      return new Wardog(world, id, cx, cz, h);
    case 'heart':
      return new Heart(world, id, cx, cz, h);
    case 'reborn':
      return new Reborn(world, id, cx, cz, h);
    // Gaia Nova.
    case 'thresher':
      return new Thresher(world, id, cx, cz, h);
    case 'driller':
      return new Driller(world, id, cx, cz, h);
    case 'boreas':
      return new Boreas(world, id, cx, cz, h);
    case 'stheno':
      return new Stheno(world, id, cx, cz, h);
    case 'hydra':
      return new Hydra(world, id, cx, cz, h);
    case 'colossus':
      return new Colossus(world, id, cx, cz, h);
    case 'rogue':
      return new RogueLux(world, id, cx, cz, h);
    // Chapter 3.
    case 'aello':
      return new Aello(world, id, cx, cz, h);
    case 'scylla':
      return new Scylla(world, id, cx, cz, h);
    case 'excavator':
      return new Excavator(world, id, cx, cz, h);
    case 'organ':
      // The Siren Organ is fought from the submarine: see vehicles/sub (it never stands on a map).
      throw new Error('THE SIREN ORGAN is fought from the Dolphin submarine (vehicles/sub/organ.ts)');
    case 'talos':
      return new Talos(world, id, cx, cz, h);
    case 'medusa':
      return new Medusa(world, id, cx, cz, h);
    case 'ram':
      return new GoldenRam(world, id, cx, cz, h);
    case 'dragon':
      return new Dragon(world, id, cx, cz, h);
    case 'goldenking':
      return new GoldenKing(world, id, cx, cz, h);
  }
}

export function makeBoss(world: World, id: string, kind: BossKind, cx: number, cz: number, h: number): Boss {
  const b = build(world, id, kind, cx, cz, h);
  b.bossKind = kind;
  return b;
}

