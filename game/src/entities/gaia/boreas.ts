import * as THREE from 'three';

import { audio } from '../../core/audio';
import { CELL } from '../../core/constants';
import { damp, dampAngle } from '../../core/math';
import type { World } from '../../game/world';
import type { Box } from '../../world/physics';
import { Boss, bossHp } from '../bossBase';
import type { Enemy } from '../enemies';
import { Entity, type HitKind, type Target } from '../entity';
import { Shockwave } from '../hazards';
import { blobShadow, boxG, capsule, cone, cyl, glowSprite, mat, mesh, ownMat, sphere, torus } from '../models';

/** Danger telegraphs are red so they stand out on white snow; BOREAS's own frost is deep blue. */
const WARN = '#ff4f6a';
const FROST = '#3fb6ff';

/** Ice spikes that burst out of the floor one after another along a line, then sink back down. */
class IceSpikes extends Entity {
  private t = 0;
  private spikes: { mesh: THREE.Mesh; at: number; x: number; z: number }[] = [];
  private hitDone = false;

  constructor(
    world: World,
    x: number,
    private y: number,
    z: number,
    dir: THREE.Vector3,
    len: number,
  ) {
    super(world, `spikes${Math.random()}`);
    const ice = mat('#dff6ff', { emissive: '#7fe6ff', ei: 0.7, rough: 0.1 });
    const n = Math.floor(len / 1.1);
    for (let k = 0; k < n; k++) {
      const d = 1.8 + k * 1.1;
      const side = (k % 2 ? 1 : -1) * 0.25;
      const sx = x + dir.x * d + dir.z * side;
      const sz = z + dir.z * d - dir.x * side;
      const m = mesh(cone(0.42, 1.7, 6), ice, sx, y, sz);
      m.rotation.set((k % 3) * 0.12 - 0.12, k, (k % 2) * 0.2 - 0.1);
      m.scale.set(1, 0.01, 1);
      this.obj.add(m);
      this.spikes.push({ mesh: m, at: k * 0.045, x: sx, z: sz });
    }
  }

  update(dt: number) {
    this.t += dt;
    const p = this.world.player.body;
    let last = 0;
    for (const s of this.spikes) {
      const age = this.t - s.at;
      last = Math.max(last, s.at);
      if (age < 0) continue;
      // Shoot up fast, stay a moment, sink back slowly.
      const k = age < 0.12 ? age / 0.12 : age < 0.9 ? 1 : Math.max(0, 1 - (age - 0.9) / 0.4);
      s.mesh.scale.y = Math.max(0.01, k);
      s.mesh.position.y = this.y + 0.85 * k - 0.2;
      if (age < dt + 0.001) {
        this.world.particles.emit(s.x, this.y + 0.3, s.z, { count: 5, color: '#e8f8ff', speed: 4, up: 3, life: 0.5, size: 0.5 });
      }
      if (!this.hitDone && age < 0.6 && Math.hypot(p.x - s.x, p.z - s.z) < 0.95 + p.r && p.y < this.y + 1.2) {
        this.hitDone = true;
        this.world.player.hurt(1, s.x, s.z);
      }
    }
    if (this.t > last + 1.4) this.remove();
  }
}

type State = 'stalk' | 'crouch' | 'air' | 'stuck' | 'punch' | 'frost' | 'roar';
const CYCLE = ['leap', 'spikes', 'frost', 'leap', 'spikes', 'roar'] as const;

/**
 * BOREAS, Brennus's warden of the tundra prison camp: a hulking yeti robot in white armour and icy fur.
 * It leaps across the arena and lands with a shockwave, punches lines of ice spikes along the floor,
 * sweeps a low beam of frost breath around itself and roars for snow sporelings. Its armour blocks
 * everything from the front: only the glowing power core on its back can be hurt, except for a few
 * seconds after each big leap, when it is stuck in the snow and wide open. Below half health it moves
 * faster and leaps twice in a row.
 */
export class Boreas extends Boss implements Target {
  readonly title = 'BOREAS';
  protected focusHeight = 3.8;
  readonly aim = new THREE.Vector3();
  radius = 1.15;
  aimable = false;
  private pos = new THREE.Vector3();
  private yaw = 0;
  private state: State = 'stalk';
  private stateT = 2.5;
  private count = 0;
  private model = new THREE.Group();
  private body = new THREE.Group();
  private arms: THREE.Group[] = [];
  private core: THREE.MeshStandardMaterial;
  private coreGlow: THREE.Sprite;
  private visor: THREE.MeshStandardMaterial;
  private box: Box;
  /** Leap: where it took off, where it lands, and how many leaps are left in this attack. */
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();
  private leaps = 0;
  private marker: THREE.Group;
  private markerMats: THREE.MeshBasicMaterial[] = [];
  /** Punch: the telegraphed line of ice spikes. */
  private line: THREE.Mesh;
  private lineDir = new THREE.Vector3();
  /** Frost breath: a low beam sweeping round it. */
  private beam: THREE.Mesh;
  private beamMat: THREE.MeshBasicMaterial;
  private sweepA = 0;
  private thrown = false;
  private helpers: Enemy[] = [];
  private angryToast = false;
  private blockedT = 0;
  /** Arena half-size (world units) it keeps to, measured from the grid on the first update. */
  private rx = 0;
  private rz = 0;

  constructor(world: World, id: string, cx: number, cz: number, h: number) {
    super(world, id, cx, cz, h, bossHp(world, 36));
    this.pos.copy(this.center);
    const armour = mat('#eef4fb', { metal: 0.3, rough: 0.4 });
    const joint = mat('#3a4658', { metal: 0.5, rough: 0.45 });
    const fur = mat('#dcecff', { emissive: '#7fe6ff', ei: 0.15, rough: 0.3 });
    const b = this.body;
    // Legs and big flat feet.
    for (const sx of [-1, 1]) {
      b.add(mesh(cyl(0.55, 0.68, 1.5, 12), joint, sx * 0.85, 1, 0));
      b.add(mesh(boxG(1.1, 0.45, 1.5), armour, sx * 0.85, 0.22, 0.2));
      b.add(mesh(sphere(0.62, 12), armour, sx * 0.85, 1.75, 0));
    }
    // A barrel chest under white plates.
    const torso = mesh(sphere(1.7, 22), armour, 0, 3, 0);
    torso.scale.set(1.18, 1, 0.95);
    b.add(torso);
    b.add(mesh(boxG(2.3, 1.2, 0.35), armour, 0, 3.2, 1.45));
    b.add(mesh(boxG(1.8, 0.7, 0.3), joint, 0, 2.2, 1.35));
    // Shaggy icy fur: cones bristling from the shoulders, sides and back.
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < 34; i++) {
      const a = (i / 34) * Math.PI * 2 * 3.7;
      const el = 0.15 + ((i * 7) % 11) / 14;
      const n = new THREE.Vector3(Math.sin(a) * Math.cos(el), Math.sin(el), Math.cos(a) * Math.cos(el));
      // Leave the chest plates and the back core bare.
      if (n.z > 0.55 || (n.z < -0.75 && n.y < 0.5)) continue;
      const spike = mesh(cone(0.2, 0.85 + (i % 3) * 0.2, 5), fur, n.x * 1.85, 3 + n.y * 1.6, n.z * 1.6);
      spike.quaternion.setFromUnitVectors(up, n);
      b.add(spike);
    }
    // Head with a blue visor and two icy horns.
    b.add(mesh(sphere(0.8, 18), armour, 0, 4.75, 0.45));
    this.visor = ownMat('#bff4ff', { emissive: '#3fb6ff', ei: 1.6 });
    b.add(mesh(boxG(1.2, 0.28, 0.3), this.visor, 0, 4.8, 1.12, false));
    for (const sx of [-1, 1]) {
      const horn = mesh(cone(0.18, 0.9, 6), fur, sx * 0.6, 5.4, 0.3);
      horn.rotation.z = -sx * 0.5;
      b.add(horn);
    }
    // Arms that hang from the shoulders, with huge fists.
    for (const sx of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(sx * 2.05, 3.8, 0.1);
      arm.add(mesh(sphere(0.7, 14), armour, 0, 0, 0));
      arm.add(mesh(capsule(0.42, 1.3), joint, 0, -1, 0.1));
      const fist = mesh(new THREE.DodecahedronGeometry(0.8, 0), armour, 0, -2.25, 0.25);
      arm.add(fist);
      for (let k = 0; k < 3; k++) arm.add(mesh(cone(0.14, 0.5, 5), fur, sx * 0.2, -1.2 + k * 0.4, -0.35).rotateX(-1.2));
      arm.rotation.z = sx * 0.12;
      this.arms.push(arm);
      b.add(arm);
    }
    // The glowing power core on its back: the weak spot.
    this.core = ownMat('#9fefff', { emissive: '#3fb6ff', ei: 0.8 });
    const ring = mesh(torus(0.62, 0.12), joint, 0, 3, -1.55);
    b.add(ring);
    b.add(mesh(sphere(0.55, 16), this.core, 0, 3, -1.62, false));
    this.coreGlow = glowSprite('#7fe6ff', 3.4, 0.35);
    this.coreGlow.position.set(0, 3, -1.9);
    b.add(this.coreGlow);
    this.model.add(b, blobShadow(6));
    this.obj.add(this.model);

    // Where it is about to land: a red ring that tightens as it falls.
    this.marker = new THREE.Group();
    const mk = (g: THREE.BufferGeometry, opacity: number) => {
      const m = new THREE.MeshBasicMaterial({ color: WARN, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
      this.markerMats.push(m);
      return new THREE.Mesh(g, m);
    };
    this.marker.add(mk(new THREE.RingGeometry(2.4, 2.8, 40).rotateX(-Math.PI / 2), 0.8), mk(new THREE.CircleGeometry(2.8, 40).rotateX(-Math.PI / 2), 0.2));
    this.marker.visible = false;
    this.obj.add(this.marker);

    this.line = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: WARN, transparent: true, opacity: 0, depthWrite: false }));
    this.line.visible = false;
    this.obj.add(this.line);

    const geo = new THREE.CylinderGeometry(0.16, 0.16, 13, 8).rotateZ(Math.PI / 2).translate(6.5, 0, 0);
    this.beamMat = new THREE.MeshBasicMaterial({ color: FROST, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false });
    this.beam = new THREE.Mesh(geo, this.beamMat);
    const halo = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#bff4ff', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    halo.scale.set(1, 3, 3);
    this.beam.add(halo);
    this.beam.visible = false;
    this.obj.add(this.beam);

    this.box = { minX: 0, maxX: 0, minZ: 0, maxZ: 0, bottom: h, top: h + 3.4, solid: false, dx: 0, dy: 0, dz: 0, owner: this };
    world.boxes.push(this.box);
    world.addTarget(this);
    this.sync();
  }

  get where(): THREE.Vector3 {
    return this.pos;
  }

  private get angry() {
    return this.hp < this.maxHp / 2;
  }

  /** -1 when Jason stands straight behind it, 1 straight in front. */
  private facingDot() {
    const p = this.player.body;
    const dx = p.x - this.pos.x;
    const dz = p.z - this.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    return (dx * Math.sin(this.yaw) + dz * Math.cos(this.yaw)) / d;
  }

  private get open() {
    return this.state === 'stuck';
  }

  hit(dmg: number, kind: HitKind): boolean {
    if (!this.started || this.defeated) return true;
    if (!this.open && this.facingDot() > -0.2) {
      audio.play('shield', 1.3);
      this.world.particles.emit(this.aim.x, this.aim.y, this.aim.z, { count: 6, color: '#ffffff', speed: 4, life: 0.3, size: 0.4 });
      if (this.blockedT <= 0) {
        this.blockedT = 7;
        this.world.hooks.toast('Blocked! Get behind BOREAS and blast its glowing back!', 'bolt');
      }
      return true;
    }
    this.damage(kind === 'zap' ? Math.min(1, dmg) : kind === 'pound' ? 4 : dmg);
    this.core.emissiveIntensity = 4;
    audio.play('hit');
    this.world.particles.emit(this.aim.x, this.aim.y, this.aim.z, { count: 10, color: '#9fefff', speed: 5, life: 0.4, size: 0.5 });
    return true;
  }

  reset() {
    this.hp = this.maxHp;
    this.pos.copy(this.center);
    this.state = 'stalk';
    this.stateT = 2.5;
    this.count = 0;
    this.angryToast = false;
    this.marker.visible = false;
    this.line.visible = false;
    this.beam.visible = false;
    this.sync();
  }

  protected finish() {
    this.marker.visible = false;
    this.line.visible = false;
    this.beam.visible = false;
    this.box.solid = false;
    // The celebration (and the bolts) burst from wherever it fell.
    this.center.copy(this.pos);
    super.finish();
  }

  /** How far from the arena centre it may go, measured once from the walls around it. */
  private measure() {
    const g = this.world.grid;
    const cx = Math.floor(this.center.x / CELL);
    const cz = Math.floor(this.center.z / CELL);
    const reach = (dx: number, dz: number) => {
      let n = 0;
      while (n < 30 && g.cell(cx + dx * (n + 1), cz + dz * (n + 1)).kind !== 'wall') n += 1;
      return n;
    };
    this.rx = Math.max(2, Math.min(reach(1, 0), reach(-1, 0)) - 2.5) * CELL;
    this.rz = Math.max(2, Math.min(reach(0, 1), reach(0, -1)) - 2.5) * CELL;
  }

  /** Keeps a point inside the arena's oval. */
  private clamp(v: THREE.Vector3) {
    const dx = v.x - this.center.x;
    const dz = v.z - this.center.z;
    const k = Math.hypot(dx / this.rx, dz / this.rz);
    if (k > 1) v.set(this.center.x + dx / k, v.y, this.center.z + dz / k);
    return v;
  }

  update(dt: number) {
    this.t += dt;
    if (!this.rx) this.measure();
    if (!this.started) {
      this.sync();
      if (this.playerDist() < 12) this.begin();
      return;
    }
    if (this.defeated) {
      this.body.rotation.x = damp(this.body.rotation.x, 1.3, 1.6, dt);
      this.body.position.y = damp(this.body.position.y, -0.6, 1.2, dt);
      this.core.emissiveIntensity = damp(this.core.emissiveIntensity, 0, 2, dt);
      this.coreGlow.material.opacity = damp(this.coreGlow.material.opacity, 0, 2, dt);
      this.visor.emissiveIntensity = damp(this.visor.emissiveIntensity, 0, 2, dt);
      return;
    }
    const w = this.world;
    const c = this.pos;
    const p = this.player.body;
    const dx = p.x - c.x;
    const dz = p.z - c.z;
    const d = Math.hypot(dx, dz) || 1;
    const pace = this.angry ? 0.8 : 1;
    this.blockedT -= dt;
    this.stateT -= dt;
    if (this.angry && !this.angryToast) {
      this.angryToast = true;
      audio.play('roar', 0.8);
      w.hooks.toast('BOREAS is furious! Watch out for double leaps!', 'bolt');
    }
    let sink = 0;
    switch (this.state) {
      case 'stalk': {
        // Trudge after Jason, turning slowly: circle round it to reach the core on its back.
        this.yaw = dampAngle(this.yaw, Math.atan2(dx, dz), this.angry ? 1.6 : 1.1, dt);
        if (d > 4) {
          const speed = this.angry ? 2.8 : 2.1;
          c.x += (dx / d) * speed * dt;
          c.z += (dz / d) * speed * dt;
          this.clamp(c);
        }
        // Halfway through, it hurls a chunk of ice: SPIN to knock it away.
        if (!this.thrown && this.stateT < 1 * pace && d > 6) {
          this.thrown = true;
          const fist = new THREE.Vector3(c.x + Math.cos(this.yaw) * 2, c.y + 3.2, c.z - Math.sin(this.yaw) * 2);
          const aim = new THREE.Vector3(p.x - fist.x, p.y + 0.9 - fist.y, p.z - fist.z).normalize();
          w.shots.fire('enemy', fist, aim, 13, 1);
          audio.play('enemyShoot', 0.6);
        }
        this.arms[0].rotation.x = Math.sin(this.t * 4) * 0.25;
        this.arms[1].rotation.x = -Math.sin(this.t * 4) * 0.25;
        if (this.stateT <= 0) this.next();
        break;
      }
      case 'crouch': {
        this.yaw = dampAngle(this.yaw, Math.atan2(this.to.x - c.x, this.to.z - c.z), 6, dt);
        sink = 0.5;
        for (const a of this.arms) a.rotation.x = damp(a.rotation.x, 0.6, 8, dt);
        this.showMarker(0.25 + Math.sin(this.t * 20) * 0.1);
        if (this.stateT <= 0) {
          this.state = 'air';
          this.stateT = this.angry ? 0.85 : 1;
          this.from.copy(c);
          audio.play('jump', 0.5);
          w.particles.emit(c.x, c.y + 0.3, c.z, { count: 20, color: '#ffffff', speed: 6, up: 3, life: 0.6, size: 0.7 });
        }
        break;
      }
      case 'air': {
        const total = this.angry ? 0.85 : 1;
        const k = Math.min(1, 1 - this.stateT / total);
        c.lerpVectors(this.from, this.to, k);
        c.y = this.center.y + Math.sin(k * Math.PI) * 7;
        for (const a of this.arms) a.rotation.x = damp(a.rotation.x, -2.6, 6, dt);
        this.showMarker(0.4 + k * 0.5);
        this.marker.scale.setScalar(1.3 - k * 0.3);
        if (this.stateT <= 0) this.land();
        break;
      }
      case 'stuck': {
        // Knee-deep in snow and wide open, wriggling to get free.
        sink = 0.8;
        for (const a of this.arms) a.rotation.x = damp(a.rotation.x, -0.4 + Math.sin(this.t * 9) * 0.3, 6, dt);
        this.body.rotation.z = Math.sin(this.t * 14) * (this.stateT < 0.7 ? 0.08 : 0.03);
        if (Math.random() < 0.4) w.particles.emit(c.x + (Math.random() - 0.5) * 3, c.y + 0.2, c.z + (Math.random() - 0.5) * 3, { count: 1, color: '#ffffff', speed: 2, up: 2, life: 0.6, size: 0.6 });
        if (this.stateT <= 0) {
          this.body.rotation.z = 0;
          this.state = 'stalk';
          this.stateT = 1.6 * pace;
          this.thrown = true;
          audio.play('roar', 1.2);
          w.particles.emit(c.x, c.y + 0.5, c.z, { count: 24, color: '#ffffff', speed: 7, up: 4, life: 0.7, size: 0.8 });
        }
        break;
      }
      case 'punch': {
        // Wind up with a fist in the air while the red line shows where the spikes will run.
        const len = 18;
        const mid = new THREE.Vector3().copy(this.lineDir).multiplyScalar(len / 2 + 1.8).add(c);
        this.line.visible = this.stateT > 0;
        this.line.position.set(mid.x, c.y + 0.06, mid.z);
        this.line.rotation.y = Math.atan2(this.lineDir.x, this.lineDir.z);
        this.line.scale.set(1, 1, len);
        const lm = this.line.material as THREE.MeshBasicMaterial;
        lm.opacity = 0.3 + Math.sin(this.t * 22) * 0.12;
        this.yaw = dampAngle(this.yaw, Math.atan2(this.lineDir.x, this.lineDir.z), 8, dt);
        const fist = this.stateT > 0 ? -2.8 : 0.4;
        this.arms[1].rotation.x = damp(this.arms[1].rotation.x, fist, this.stateT > 0 ? 5 : 20, dt);
        this.arms[0].rotation.x = damp(this.arms[0].rotation.x, fist, this.stateT > 0 ? 5 : 20, dt);
        if (this.stateT <= 0 && this.stateT + dt > 0) {
          this.line.visible = false;
          w.addEntity(new IceSpikes(w, c.x, c.y, c.z, this.lineDir, len));
          audio.play('pound');
          w.shake(0.4);
          w.particles.emit(c.x + this.lineDir.x * 1.5, c.y + 0.3, c.z + this.lineDir.z * 1.5, { count: 20, color: '#ffffff', speed: 6, up: 3, life: 0.6, size: 0.7 });
        }
        if (this.stateT <= -0.8 * pace) {
          this.state = 'stalk';
          this.stateT = this.angry ? 1.3 : 2;
          this.thrown = false;
        }
        break;
      }
      case 'frost': {
        // A low beam of frost breath sweeps round: hop over it, then blast the core on its back.
        const warm = this.stateT > (this.angry ? 3.4 : 4.2) - 0.8;
        this.sweepA += dt * (warm ? 0.15 : this.angry ? 1.45 : 1.2);
        this.yaw = Math.PI / 2 - this.sweepA;
        this.beam.visible = true;
        this.beam.position.set(c.x + Math.sin(this.yaw) * 1.2, c.y + 0.45, c.z + Math.cos(this.yaw) * 1.2);
        this.beam.rotation.y = -this.sweepA;
        this.beamMat.opacity = warm ? (Math.sin(this.t * 30) > 0 ? 0.5 : 0.15) : 0.95;
        for (const a of this.arms) a.rotation.x = damp(a.rotation.x, 0.3, 6, dt);
        if (Math.random() < 0.5) w.particles.emit(c.x + Math.sin(this.yaw) * 1.3, c.y + 4.6, c.z + Math.cos(this.yaw) * 1.3, { count: 1, color: '#e8f8ff', speed: 1, life: 0.4, size: 0.7, gravity: 0, vel: [Math.sin(this.yaw) * 4, -6, Math.cos(this.yaw) * 4] });
        if (!warm) {
          const r = 2 + Math.random() * 11;
          w.particles.emit(c.x + Math.cos(this.sweepA) * r, c.y + 0.5, c.z + Math.sin(this.sweepA) * r, { count: 2, color: '#e8f8ff', speed: 1.5, up: 1, life: 0.5, size: 0.6, gravity: 0 });
          const ang = Math.atan2(dz, dx);
          let diff = Math.abs(((ang - this.sweepA) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
          diff = Math.min(diff, Math.PI * 2 - diff);
          if (diff < 0.1 && d < 14.2 && d > 2 && p.y < c.y + 0.75) this.player.hurt(1, c.x, c.z);
        }
        if (this.stateT <= 0) {
          this.beam.visible = false;
          this.state = 'stalk';
          this.stateT = 1.8 * pace;
          this.thrown = false;
        }
        break;
      }
      case 'roar': {
        this.yaw = dampAngle(this.yaw, Math.atan2(dx, dz), 3, dt);
        for (const a of this.arms) a.rotation.x = damp(a.rotation.x, -2.4, 6, dt);
        this.body.rotation.x = damp(this.body.rotation.x, -0.25, 6, dt);
        if (this.stateT <= 0) {
          this.body.rotation.x = 0;
          this.state = 'stalk';
          this.stateT = 1.6 * pace;
          this.thrown = false;
        }
        break;
      }
    }
    if (this.state !== 'roar') this.body.rotation.x = damp(this.body.rotation.x, 0, 6, dt);
    this.body.position.y = damp(this.body.position.y, -sink, 8, dt);
    // The core glows bright while it is stuck, and pulses gently the rest of the time.
    const glow = this.open ? 2.4 + Math.sin(this.t * 10) * 0.6 : 0.8 + Math.sin(this.t * 3) * 0.2;
    this.core.emissiveIntensity = damp(this.core.emissiveIntensity, glow, 5, dt);
    this.coreGlow.material.opacity = this.open ? 0.85 : 0.35;
    this.coreGlow.scale.setScalar(this.open ? 4.6 : 3.4);
    this.aimable = this.open || this.facingDot() < -0.2;
    this.sync();
    // Bumping into it hurts, except while it is stuck (then it is a big wall of snow and armour).
    if (this.state !== 'stuck' && this.state !== 'air' && d < 2.3 && p.y < c.y + 4.5) this.player.hurt(1, c.x, c.z);
  }

  /** Picks the next attack in the cycle. */
  private next() {
    const w = this.world;
    const c = this.pos;
    const p = this.player.body;
    const pick = CYCLE[this.count % CYCLE.length];
    this.count += 1;
    if (pick === 'leap') {
      this.leaps = this.angry ? 2 : 1;
      this.startLeap(0.8);
      audio.play('roar', 0.9);
    } else if (pick === 'spikes') {
      this.state = 'punch';
      this.stateT = this.angry ? 0.9 : 1.2;
      this.lineDir.set(p.x - c.x, 0, p.z - c.z).normalize();
      if (this.count <= 3) w.hooks.toast('Ice spikes! Step out of the red line!', 'bolt');
    } else if (pick === 'frost') {
      this.state = 'frost';
      this.stateT = this.angry ? 3.4 : 4.2;
      this.sweepA = Math.atan2(p.z - c.z, p.x - c.x) - Math.PI / 2;
      audio.play('vent', 0.7);
      if (this.count <= 3) w.hooks.toast('Frost breath! JUMP over it!', 'bolt');
    } else {
      this.state = 'roar';
      this.stateT = 1.4;
      audio.play('roar', 0.7);
      w.shake(0.5);
      this.summon();
    }
  }

  private startLeap(crouch: number) {
    const p = this.player.body;
    this.state = 'crouch';
    this.stateT = this.angry ? crouch * 0.7 : crouch;
    this.to.set(p.x, this.center.y, p.z);
    this.clamp(this.to);
    this.marker.position.set(this.to.x, this.center.y + 0.05, this.to.z);
    this.marker.scale.setScalar(1.3);
    this.marker.visible = true;
  }

  private land() {
    const w = this.world;
    const c = this.pos;
    c.copy(this.to);
    this.marker.visible = false;
    const p = this.player.body;
    if (Math.hypot(p.x - c.x, p.z - c.z) < 2.9 && p.y < c.y + 1.5) this.player.hurt(1, c.x, c.z);
    w.addEntity(new Shockwave(w, c.x, c.y, c.z, 15, this.angry ? 9.5 : 8, FROST));
    audio.play('pound');
    audio.play('explode', 0.6);
    w.shake(0.7);
    w.particles.emit(c.x, c.y + 0.4, c.z, { count: 36, color: '#ffffff', speed: 9, up: 4, life: 0.8, size: 0.9 });
    w.rings.burst(c.x, c.y + 0.1, c.z, 7, '#bff4ff', 0.4);
    this.leaps -= 1;
    if (this.leaps > 0) {
      this.startLeap(0.55);
      return;
    }
    this.state = 'stuck';
    this.stateT = this.angry ? 2.8 : 3.2;
    w.hooks.toast('BOREAS is stuck in the snow! Blast its glowing core!', 'bolt');
  }

  private summon() {
    this.helpers = this.helpers.filter((e) => e.alive);
    if (this.helpers.length > 2) return;
    this.world.hooks.toast('BOREAS called for backup!', 'bolt');
    const cx = Math.floor(this.center.x / CELL);
    const cz = Math.floor(this.center.z / CELL);
    for (const sx of [-1, 1]) {
      const e = this.world.spawnEnemy('sporeling', cx + sx * 5, cz + 2, 'snow');
      e.room = undefined;
      this.helpers.push(e);
    }
  }

  private showMarker(opacity: number) {
    this.markerMats[0].opacity = Math.min(1, opacity + 0.3);
    this.markerMats[1].opacity = opacity * 0.35;
  }

  /** Moves the model, the collider and the weak spot to where BOREAS stands. */
  private sync() {
    const c = this.pos;
    this.model.position.copy(c);
    this.model.rotation.y = this.yaw;
    const back = this.open ? 1.65 : 1.62;
    this.aim.set(c.x - Math.sin(this.yaw) * back, c.y + 3 + this.body.position.y, c.z - Math.cos(this.yaw) * back);
    const grounded = this.state !== 'air';
    this.box.solid = grounded && this.state !== 'stalk';
    this.box.minX = c.x - 1.5;
    this.box.maxX = c.x + 1.5;
    this.box.minZ = c.z - 1.5;
    this.box.maxZ = c.z + 1.5;
    this.box.bottom = c.y;
    this.box.top = c.y + 3.4;
  }
}
