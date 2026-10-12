import * as THREE from 'three';

import { audio } from '../../core/audio';
import { haptic } from '../../core/bridge';
import { damp, dampAngle } from '../../core/math';
import type { World } from '../../game/world';
import { Grid } from '../../world/grid';
import { makeBody, moveBody, type Body } from '../../world/physics';
import { Boss, bossHp } from '../bossBase';
import type { HitKind, Target } from '../entity';
import { Shockwave, Strike } from '../hazards';
import { blobShadow, boxG, cyl, glowSprite, mat, mesh, ownMat, sphere, torus } from '../models';

type State = 'drive' | 'rev' | 'charge' | 'stuck' | 'bales';

/** Top speed of a charge, and how close counts as running Jason over. */
const CHARGE_SPEED = 13;
const REACH = 2.5;

/**
 * THE THRESHER, region 1's boss: Brennus's giant harvester, gone wild with Celestia's vines. It drives
 * around the field with its blade reel spinning, then revs up and charges at Jason. If it rams a
 * rock pillar or the arena wall it gets stuck, and the glowing engine on its back is open to attack.
 * In between it tosses hay bales. Below half health it charges twice in a row.
 */
export class Thresher extends Boss implements Target {
  readonly title = 'THE THRESHER';
  protected focusHeight = 2.6;
  readonly aim = new THREE.Vector3();
  radius = 1.3;
  aimable = false;
  private body: Body;
  private model = new THREE.Group();
  private reel = new THREE.Group();
  private engine: THREE.MeshStandardMaterial;
  private lamps: THREE.MeshStandardMaterial;
  private engineGlow: THREE.Sprite;
  private state: State = 'drive';
  private stateT = 3;
  private count = 0;
  private yaw = 0;
  private dir = new THREE.Vector2();
  /** Charges left in the current run (two when it is angry). */
  private charges = 0;
  /** Angle around the arena while it drives in a circle. */
  private orbit = 0;
  private home: THREE.Vector3;

  constructor(world: World, id: string, cx: number, cz: number, h: number) {
    super(world, id, cx, cz, h, bossHp(world, 30));
    this.home = this.center.clone();
    this.body = makeBody(this.center.x, h, this.center.z, 1.6, 2.6);
    const m = this.model;
    const paint = mat('#d8a830', { rough: 0.5, metal: 0.3 });
    const red = mat('#a8202a', { rough: 0.5, metal: 0.3 });
    const dark = mat('#2a2a30', { rough: 0.7, metal: 0.4 });
    const steel = mat('#9aa0aa', { rough: 0.35, metal: 0.7 });
    // Chassis on big wheels.
    m.add(mesh(boxG(2.6, 1.2, 3.6), paint, 0, 1.3, -0.2));
    m.add(mesh(boxG(2.7, 0.25, 3.7), red, 0, 1.95, -0.2));
    for (const sx of [-1, 1]) {
      for (const sz of [-1.2, 0.9]) m.add(mesh(cyl(0.75, 0.75, 0.5, 16), dark, sx * 1.45, 0.75, sz).rotateZ(Math.PI / 2));
    }
    // The cab, with a glass front, and Brennus's emblem on the door.
    m.add(mesh(boxG(1.6, 1.1, 1.3), paint, 0, 2.6, 0.4));
    m.add(mesh(boxG(1.5, 0.7, 0.05), mat('#5ee0ff', { emissive: '#3fb6ff', ei: 0.6, rough: 0.1 }), 0, 2.7, 1.06, false));
    m.add(mesh(torus(0.22, 0.06), mat('#ff3a4c', { emissive: '#ff3a4c', ei: 1 }), 1.31, 2.6, 0.4, false).rotateY(Math.PI / 2));
    // Headlights that flash red as it revs up.
    this.lamps = ownMat('#fff4c0', { emissive: '#ffd166', ei: 1 });
    for (const sx of [-0.8, 0.8]) m.add(mesh(sphere(0.18, 10), this.lamps, sx, 1.75, 1.62, false));
    // The blade reel across the front.
    this.reel.position.set(0, 1.1, 2.3);
    this.reel.add(mesh(cyl(0.25, 0.25, 3.4, 10), steel, 0, 0, 0).rotateZ(Math.PI / 2));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const blade = mesh(boxG(3.2, 0.08, 0.5), steel, 0, Math.cos(a) * 0.65, Math.sin(a) * 0.65);
      blade.rotation.x = a;
      this.reel.add(blade);
    }
    m.add(this.reel);
    for (const sx of [-1, 1]) m.add(mesh(boxG(0.2, 1, 1.6), red, sx * 1.75, 1.2, 1.9));
    // The engine on its back: the weak spot.
    this.engine = ownMat('#5a3a20', { emissive: '#ff8a1a', ei: 0.3 });
    m.add(mesh(boxG(1.8, 1.1, 1), this.engine, 0, 2.2, -1.8));
    m.add(mesh(cyl(0.18, 0.22, 1.4, 10), dark, 0.6, 3.2, -1.8));
    this.engineGlow = glowSprite('#ffb04a', 2.6, 0);
    this.engineGlow.position.set(0, 2.3, -2.4);
    m.add(this.engineGlow);
    // Celestia's vines, wrapped all over it.
    const vine = mat('#3fae4a', { rough: 0.6 });
    for (let i = 0; i < 4; i++) {
      const v = mesh(torus(1.4 + i * 0.1, 0.07), vine, 0, 1.4 + i * 0.25, -0.6 + i * 0.5, false);
      v.rotation.set(Math.PI / 2 + (i - 1.5) * 0.25, 0, i * 0.4);
      v.scale.set(1, 1.4, 1);
      m.add(v);
    }
    for (let i = 0; i < 5; i++) m.add(mesh(sphere(0.12, 8), mat('#ff6fcf', { emissive: '#ff6fcf', ei: 1.2 }), -1.2 + i * 0.6, 2.05, -1.6 + (i % 2) * 2.2, false));
    m.add(blobShadow(6));
    this.obj.add(m);
    world.addTarget(this);
    this.sync(0);
  }

  get where(): THREE.Vector3 {
    return new THREE.Vector3(this.body.x, this.body.y, this.body.z);
  }

  hit(dmg: number, kind: HitKind): boolean {
    if (!this.started || this.defeated) return true;
    if (this.state !== 'stuck') {
      audio.play('zap', 1.6);
      return true;
    }
    // A ground pound on the engine is a big hit.
    this.damage(kind === 'pound' ? dmg + 3 : dmg);
    this.engine.emissiveIntensity = 3;
    audio.play('hit');
    return true;
  }

  reset() {
    this.hp = this.maxHp;
    this.body.x = this.home.x;
    this.body.z = this.home.z;
    this.state = 'drive';
    this.stateT = 3;
    this.count = 0;
  }

  protected onStart() {
    this.orbit = Math.atan2(this.body.z - this.home.z, this.body.x - this.home.x);
  }

  /** True if the space just ahead of the Thresher's nose is a cliff or a rock pillar. */
  private blocked(dx: number, dz: number): boolean {
    const b = this.body;
    for (const ahead of [1.8, 2.6]) {
      const c = this.world.grid.cell(Grid.toCell(b.x + dx * ahead), Grid.toCell(b.z + dz * ahead));
      if (c.kind === 'wall' || c.kind === 'void' || c.h > b.y + 0.6) return true;
    }
    return false;
  }

  update(dt: number) {
    this.t += dt;
    const b = this.body;
    if (!this.started) {
      if (this.playerDist() < 12) this.begin();
      this.sync(0);
      return;
    }
    if (this.defeated) {
      this.model.rotation.z = damp(this.model.rotation.z, 0.25, 2, dt);
      this.engineGlow.material.opacity = damp(this.engineGlow.material.opacity, 0, 2, dt);
      if (Math.random() < 0.3) this.world.particles.emit(b.x, b.y + 3.2, b.z, { count: 1, color: '#3a3a40', speed: 1, up: 3, life: 1.2, size: 1.4, gravity: 0 });
      return;
    }
    const p = this.player.body;
    const angry = this.hp < this.maxHp / 2;
    const toX = p.x - b.x;
    const toZ = p.z - b.z;
    const dist = Math.hypot(toX, toZ) || 1;
    this.stateT -= dt;
    let speed = 0;
    let spin = 4;
    switch (this.state) {
      case 'drive': {
        // Circles the middle of the field, mowing everything in its path.
        this.orbit += dt * 0.55;
        const r = 8;
        const tx = this.home.x + Math.cos(this.orbit) * r - b.x;
        const tz = this.home.z + Math.sin(this.orbit) * r - b.z;
        const td = Math.hypot(tx, tz) || 1;
        this.yaw = dampAngle(this.yaw, Math.atan2(tx, tz), 4, dt);
        speed = Math.min(6, td * 2);
        if (this.stateT <= 0) {
          this.count += 1;
          if (this.count % 3 === 0) {
            this.state = 'bales';
            this.stateT = 1.6;
          } else {
            this.state = 'rev';
            this.stateT = angry ? 0.9 : 1.3;
            this.charges = angry ? 2 : 1;
            audio.play('roar', 0.6);
          }
        }
        break;
      }
      case 'rev': {
        // Stops, turns to face Jason and revs: headlights flash and smoke pours out.
        this.yaw = dampAngle(this.yaw, Math.atan2(toX, toZ), 6, dt);
        spin = 14;
        this.lamps.emissive.set(Math.sin(this.t * 20) > 0 ? '#ff3a4c' : '#ffd166');
        this.lamps.emissiveIntensity = 2.5;
        if (Math.random() < 0.6) this.world.particles.emit(b.x + 0.6, b.y + 3.8, b.z, { count: 1, color: '#4a4a50', speed: 1, up: 3, life: 0.8, size: 1, gravity: 0 });
        if (this.stateT <= 0) {
          this.state = 'charge';
          this.stateT = 3;
          this.dir.set(Math.sin(this.yaw), Math.cos(this.yaw));
          audio.play('dash', 0.5);
          haptic('medium');
        }
        break;
      }
      case 'charge': {
        speed = CHARGE_SPEED;
        spin = 18;
        this.yaw = Math.atan2(this.dir.x, this.dir.y);
        if (Math.random() < 0.7) this.world.particles.emit(b.x - this.dir.x * 2, b.y + 0.3, b.z - this.dir.y * 2, { count: 2, color: '#c8b070', speed: 2, up: 1, life: 0.5, size: 0.9 });
        if (this.blocked(this.dir.x, this.dir.y) || this.stateT <= 0) {
          // CRASH. It is stuck, and its engine is wide open.
          speed = 0;
          this.state = 'stuck';
          this.stateT = angry ? 3.2 : 3.8;
          audio.play('explode');
          haptic('heavy');
          this.world.shake(0.7);
          this.world.flash(b.x, b.y + 2, b.z, '#ffb04a', 50, 0.4);
          this.world.particles.emit(b.x + this.dir.x * 2.4, b.y + 1.2, b.z + this.dir.y * 2.4, { count: 30, color: '#c8b8a0', speed: 7, life: 0.7, size: 0.8 });
          if (this.count < 2) this.world.hooks.toast('It crashed! Hit the glowing engine on its back!', 'bolt');
        }
        break;
      }
      case 'stuck':
        spin = 0;
        if (Math.random() < 0.2) this.world.particles.emit(b.x, b.y + 3.2, b.z, { count: 1, color: '#ffd166', speed: 2, up: 2, life: 0.4, size: 0.5, gravity: 2 });
        if (this.stateT <= 0) {
          this.charges -= 1;
          if (this.charges > 0) {
            this.state = 'rev';
            this.stateT = 0.8;
            // Back up a little first, so it doesn't charge the same wall again.
            b.x -= this.dir.x * 1.5;
            b.z -= this.dir.y * 1.5;
          } else {
            this.state = 'drive';
            this.stateT = angry ? 2.2 : 3;
            this.world.addEntity(new Shockwave(this.world, b.x, b.y, b.z, 12, 7, '#ffd166'));
            audio.play('pound');
            this.orbit = Math.atan2(b.z - this.home.z, b.x - this.home.x);
          }
        }
        break;
      case 'bales':
        // Tosses hay bales where Jason is standing (and where he might run).
        if (this.stateT <= 1 && this.stateT + dt > 1) {
          const n = angry ? 5 : 3;
          for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = i === 0 ? 0 : 2 + Math.random() * 3;
            this.world.addEntity(new Strike(this.world, p.x + Math.cos(a) * r, b.y, p.z + Math.sin(a) * r, 1.2, 1.2, '#e8c860', 'rock'));
          }
          audio.play('pound', 1.4);
        }
        if (this.stateT <= 0) {
          this.state = 'drive';
          this.stateT = 2.6;
        }
        break;
    }
    b.vx = Math.sin(this.yaw) * speed;
    b.vz = Math.cos(this.yaw) * speed;
    moveBody(b, dt, this.world.grid, [], { stepUp: 0.6 });
    this.reel.rotation.x += dt * spin;
    this.lamps.emissiveIntensity = damp(this.lamps.emissiveIntensity, 1, 4, dt);
    if (this.state !== 'rev') this.lamps.emissive.set('#ffd166');
    const open = this.state === 'stuck';
    this.aimable = open;
    this.engine.emissiveIntensity = damp(this.engine.emissiveIntensity, open ? 2.2 + Math.sin(this.t * 10) * 0.6 : 0.3, 6, dt);
    this.engineGlow.material.opacity = damp(this.engineGlow.material.opacity, open ? 0.85 : 0, 6, dt);
    this.sync(speed);
    // Running into the reel (or the wheels) hurts; standing behind it while it's stuck is safe.
    const fx = b.x + Math.sin(this.yaw) * 2;
    const fz = b.z + Math.cos(this.yaw) * 2;
    if (p.y < b.y + 2.8 && !open && (Math.hypot(p.x - fx, p.z - fz) < REACH || dist < 2)) this.player.hurt(1, b.x, b.z);
  }

  private sync(speed: number) {
    const b = this.body;
    this.model.position.set(b.x, b.y + (speed > 8 ? Math.sin(this.t * 30) * 0.05 : 0), b.z);
    this.model.rotation.y = this.yaw;
    // The weak spot sits on its back.
    this.aim.set(b.x - Math.sin(this.yaw) * 1.9, b.y + 2.3, b.z - Math.cos(this.yaw) * 1.9);
  }
}
