import * as THREE from 'three';

import { audio } from '../../core/audio';
import { haptic } from '../../core/bridge';
import { damp } from '../../core/math';
import type { World } from '../../game/world';
import { Grid } from '../../world/grid';
import { Boss, bossHp } from '../bossBase';
import type { HitKind, Target } from '../entity';
import { Shockwave } from '../hazards';
import { boxG, cone, cyl, glowSprite, mat, mesh, ownMat, sphere, torus } from '../models';

/** Body segments behind the head, and the gap between their centres. */
const SEGS = 12;
const GAP = 1.5;
/** How deep under the sand the Driller swims. */
const DEEP = 3.8;
/** Bursts and dives stay this close to the middle of the pit (world units). */
const ARENA_R = 13;
/** Where it surfaces to spray sand: near the rim of the pit. */
const EDGE_R = 11;
/** Seconds the warning circle glows before it bursts up, and its size. */
const WARN_TIME = 1.05;
const WARN_R = 2.5;
/** Seconds it stays stuck with its drill in the sand (the only time it can be hurt). */
const STUCK_TIME = 3.2;
const SAND = '#e8c890';
const HOT = '#ff9a3a';

const UP = new THREE.Vector3(0, 1, 0);
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();

type State = 'roam' | 'track' | 'warn' | 'burst' | 'stuck' | 'swim' | 'rise' | 'spray' | 'spin' | 'sink' | 'intro';
type Attack = 'burst' | 'spray' | 'spin';

/**
 * DUNE DRILLER: Brennus's mining machine, a sand-worm train of armoured segments wrapped in Celestia
 * vines. It swims under the sand (only a moving mound and a trail of dust give it away), then bursts
 * up under Jason after a red warning circle, arcs over and plunges its drill back into the sand. The
 * drill gets stuck for a few seconds and its head glows: that's the moment to BLAST it. Between
 * bursts it rears up at the rim to spray fans of sand, or spins its drill in the middle to send out
 * a ring you hop over. Below half health it bursts up twice in a row. Every hit tears off some vines.
 */
export class Driller extends Boss implements Target {
  readonly title = 'DUNE DRILLER';
  protected focusHeight = 4;
  readonly aim = new THREE.Vector3();
  radius = 1.8;
  aimable = false;

  private state: State = 'roam';
  private stateT = 0;
  private count = 0;
  private burstsLeft = 0;
  private angry = false;
  private told = new Set<string>();

  /** The head's centre, and where it has been (newest first): the body follows this trail. */
  private head = new THREE.Vector3();
  private trail: THREE.Vector3[] = [];
  /** The head points along the trail, unless it turns to look at Jason while spraying. */
  private look = new THREE.Vector3(0, 1, 0);
  private lookAtJason = 0;

  /** Burst arc (a curve from under the sand, up over the top and down into the sand). */
  private arc: THREE.Vector3[] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private arcT = 0;
  private broke = false;
  private goal = new THREE.Vector3();
  private riseFrom = 0;
  private riseTo = 0;
  private fired = 0;
  private roamA = 0;
  private puff = 0;

  private headObj = new THREE.Group();
  private drill = new THREE.Group();
  private segs: THREE.Group[] = [];
  private vines: THREE.Object3D[] = [];
  private coreMat: THREE.MeshStandardMaterial;
  private drillMat: THREE.MeshStandardMaterial;
  private ventMat: THREE.MeshStandardMaterial;
  private glow: THREE.Sprite;
  private mound: THREE.Mesh;
  private warn: THREE.Mesh;
  private warnRing: THREE.Mesh;
  private sink = 0;

  constructor(world: World, id: string, cx: number, cz: number, h: number) {
    super(world, id, cx, cz, h, bossHp(world, 34));
    const rust = mat('#b0552e', { metal: 0.35, rough: 0.55 });
    const armour = mat('#8a7458', { metal: 0.5, rough: 0.45 });
    const steel = mat('#3e3840', { metal: 0.7, rough: 0.35 });
    const vine = mat('#9a2a66', { emissive: '#ff4fb8', ei: 0.35, rough: 0.7 });
    const thorn = mat('#3a2030', { rough: 0.6 });
    const bloom = mat('#ffb0e0', { emissive: '#ff6fcf', ei: 1.4 });
    this.coreMat = ownMat('#ffe0a0', { emissive: HOT, ei: 0.5 });
    this.drillMat = ownMat('#d0c8bc', { metal: 0.85, rough: 0.25, emissive: '#ff5a1a', ei: 0 });
    this.ventMat = ownMat('#ffc890', { emissive: '#ff7a1a', ei: 0.8 });

    const ring = (r: number, t: number, m: THREE.Material, y: number, tilt = 0) => {
      const o = mesh(torus(r, t), m, 0, y, 0);
      o.rotation.x = Math.PI / 2 + tilt;
      return o;
    };
    /** A vine wrapped round a part, with a couple of thorns and a little pink bloom. */
    const vineWrap = (r: number, y: number, tilt: number) => {
      const g = new THREE.Group();
      g.add(ring(r, 0.1, vine, y, tilt));
      for (const a of [0.6, 2.6, 4.4]) {
        const t = mesh(cone(0.08, 0.38, 5), thorn, Math.cos(a) * (r + 0.12), y + Math.sin(a) * tilt * r, Math.sin(a) * (r + 0.12));
        t.rotation.z = -Math.cos(a) * 1.3;
        t.rotation.x = Math.sin(a) * 1.3;
        g.add(t);
      }
      g.add(mesh(sphere(0.16, 8), bloom, Math.cos(1.6) * (r + 0.1), y, Math.sin(1.6) * (r + 0.1), false));
      this.vines.push(g);
      return g;
    };

    // The head: an armoured cab with a glowing core band, lamps, and a big spinning drill bit (local +Y is forward).
    const hd = this.headObj;
    hd.add(mesh(cyl(1.25, 1.4, 1.8, 18), rust, 0, 0, 0));
    hd.add(ring(1.4, 0.16, steel, -0.85));
    hd.add(ring(1.32, 0.22, this.coreMat, 0.2));
    hd.add(mesh(cyl(1.0, 1.25, 0.4, 18), steel, 0, 0.95, 0));
    for (const s of [-1, 1]) {
      const lamp = mesh(sphere(0.24, 10), mat('#fff4c0', { emissive: '#ffd166', ei: 2.2 }), s * 1.0, 0.55, 0.75, false);
      hd.add(lamp);
      const fin = mesh(boxG(0.18, 1.2, 0.7), armour, s * 1.35, -0.3, 0);
      hd.add(fin);
    }
    hd.add(vineWrap(1.46, -0.35, 0.35));
    const bit = mesh(cone(1.1, 2.6, 14), this.drillMat, 0, 1.3, 0);
    this.drill.add(bit);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const flute = mesh(boxG(0.14, 2.0, 0.42), steel, Math.cos(a) * 0.55, 1.05, Math.sin(a) * 0.55);
      flute.rotation.y = -a;
      flute.rotation.z = 0.42 * Math.cos(a);
      flute.rotation.x = -0.42 * Math.sin(a);
      this.drill.add(flute);
    }
    this.drill.position.y = 1.15;
    hd.add(this.drill);
    this.glow = glowSprite(HOT, 6, 0);
    hd.add(this.glow);
    this.obj.add(hd);

    // The body: a train of armoured drums with plates, glowing vents and vines, getting smaller to the tail.
    for (let i = 0; i < SEGS; i++) {
      const g = new THREE.Group();
      g.add(mesh(cyl(1.05, 1.05, 1.3, 16), i % 2 ? armour : rust, 0, 0, 0));
      g.add(ring(1.1, 0.13, steel, 0.62), ring(1.1, 0.13, steel, -0.62));
      for (const s of [-1, 1]) g.add(mesh(boxG(0.14, 0.62, 0.42), this.ventMat, s * 1.08, 0, 0, false));
      g.add(mesh(boxG(0.5, 0.9, 0.16), steel, 0, 0, 1.06));
      if (i % 2 === 0) g.add(vineWrap(1.16, 0.1, i % 4 ? -0.4 : 0.4));
      if (i === SEGS - 1) {
        const tail = mesh(cone(0.7, 1.4, 10), steel, 0, -1.2, 0);
        tail.rotation.x = Math.PI;
        g.add(tail);
      }
      g.scale.setScalar(1 - i * 0.035);
      this.segs.push(g);
      this.obj.add(g);
    }

    // The sand mound that shows where it is swimming, and the warning circle before a burst.
    this.mound = mesh(sphere(1.5, 16), mat('#d9b67a', { rough: 1 }), 0, h, 0, false);
    this.mound.scale.set(1, 0.32, 1);
    this.obj.add(this.mound);
    this.warn = new THREE.Mesh(
      new THREE.CircleGeometry(WARN_R, 36).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#ff4a3a', transparent: true, opacity: 0.35, depthWrite: false }),
    );
    this.warnRing = new THREE.Mesh(
      new THREE.RingGeometry(WARN_R - 0.18, WARN_R, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#ffe0a0', transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.warn.visible = this.warnRing.visible = false;
    this.obj.add(this.warn, this.warnRing);

    this.place(this.center.x, this.center.z + 6);
    this.pose();
    world.addTarget(this);
  }

  /* ---------------- helpers ---------------- */

  private get ground() {
    return this.center.y;
  }

  /** Puts the whole Driller under the sand at (x, z), lying flat. */
  private place(x: number, z: number) {
    const y = this.ground - DEEP;
    this.head.set(x, y, z);
    this.trail = [];
    for (let i = 1; i <= 50; i++) this.trail.push(new THREE.Vector3(x - i * 0.5, y, z));
  }

  /** Moves the head and remembers where it went, so the body can follow. */
  private moveHead(x: number, y: number, z: number) {
    this.head.set(x, y, z);
    const last = this.trail[0];
    if (!last || last.distanceToSquared(this.head) > 0.09) {
      this.trail.unshift(this.head.clone());
      let len = 0;
      for (let i = 1; i < this.trail.length; i++) {
        len += this.trail[i].distanceTo(this.trail[i - 1]);
        if (len > SEGS * GAP + 14) {
          this.trail.length = i + 1;
          break;
        }
      }
    }
  }

  /** Pulls the head back along its own trail (it slides back down its hole). */
  private retract(d: number) {
    while (d > 0 && this.trail.length > 2) {
      const p = this.trail[0];
      const dd = this.head.distanceTo(p);
      if (dd > d) {
        this.head.lerp(p, d / dd);
        return;
      }
      this.head.copy(p);
      this.trail.shift();
      d -= dd;
    }
  }

  /** The point `dist` behind the head along the trail. */
  private sample(dist: number, out: THREE.Vector3) {
    let prev = this.head;
    let left = dist;
    for (const p of this.trail) {
      const d = prev.distanceTo(p);
      if (d >= left && d > 0) return out.copy(prev).lerp(p, left / d);
      left -= d;
      prev = p;
    }
    return out.copy(prev).setY(prev.y - left);
  }

  /** Swims toward (x, z) under the sand, diving down first if it is up in the air. */
  private swim(x: number, z: number, speed: number, dt: number) {
    const h = this.head;
    tmpA.set(x - h.x, this.ground - DEEP - h.y, z - h.z);
    const d = tmpA.length();
    const step = Math.min(d, speed * dt);
    if (d > 0.001) tmpA.multiplyScalar(step / d);
    this.moveHead(h.x + tmpA.x, h.y + tmpA.y, h.z + tmpA.z);
    return d;
  }

  /** Keeps a point inside the pit and off the rock pillars. */
  private inside(v: THREE.Vector3, r = ARENA_R) {
    const c = this.center;
    const dx = v.x - c.x;
    const dz = v.z - c.z;
    const d = Math.hypot(dx, dz);
    if (d > r) v.set(c.x + (dx / d) * r, v.y, c.z + (dz / d) * r);
    for (let i = 0; i < 8; i++) {
      const cell = this.world.grid.cell(Grid.toCell(v.x), Grid.toCell(v.z));
      if (cell.kind !== 'wall' && cell.kind !== 'void') break;
      v.lerp(c, 0.25);
    }
    return v;
  }

  private underground() {
    return this.head.y < this.ground - 0.6;
  }

  /** True the first time each tip comes up in a fight. */
  private first(key: string) {
    if (this.told.has(key)) return false;
    this.told.add(key);
    return true;
  }

  /* ---------------- fight ---------------- */

  protected onIntro() {
    if (this.introSeen) return;
    // It bursts up in the middle of the pit and rears up tall for the cutscene.
    this.place(this.center.x, this.center.z);
    this.state = 'intro';
    this.riseFrom = this.head.y;
    this.riseTo = this.ground + 7;
    this.stateT = 1.3;
    this.look.copy(UP);
  }

  protected onStart() {
    if (this.state === 'intro' || this.state === 'rise') {
      this.state = 'sink';
      this.stateT = 0.9;
    } else {
      this.state = 'roam';
      this.stateT = 1.2;
    }
  }

  reset() {
    this.hp = this.maxHp;
    this.state = 'roam';
    this.stateT = 1.5;
    this.count = 0;
    this.burstsLeft = 0;
    this.angry = false;
    this.aimable = false;
    this.lookAtJason = 0;
    this.warn.visible = this.warnRing.visible = false;
    for (const v of this.vines) v.visible = true;
    this.place(this.center.x, this.center.z + 6);
  }

  get where(): THREE.Vector3 {
    if (!this.started && !this.defeated) return this.center;
    return new THREE.Vector3(this.head.x, Math.max(this.ground, this.head.y - 2), this.head.z);
  }

  hit(dmg: number, kind: HitKind): boolean {
    if (!this.started || this.defeated) return true;
    if (this.state !== 'stuck') {
      if (!this.underground()) {
        audio.play('zap', 1.8);
        this.world.particles.emit(this.aim.x, this.aim.y, this.aim.z, { count: 4, color: '#ffffff', speed: 4, life: 0.25, size: 0.3 });
      }
      return true;
    }
    this.damage(kind === 'pound' ? 4 : kind === 'zap' ? Math.min(1, dmg) : dmg);
    this.coreMat.emissiveIntensity = 5;
    this.world.particles.emit(this.aim.x, this.aim.y, this.aim.z, { count: 10, color: HOT, speed: 6, life: 0.4, size: 0.5 });
    audio.play('hit');
    this.unwrap();
    if (!this.angry && this.hp <= this.maxHp / 2 && !this.defeated) {
      this.angry = true;
      this.world.shake(0.4);
      audio.play('roar', 0.8);
      this.world.hooks.toast('It’s angry! Now it bursts up TWICE in a row!', 'bolt');
    }
    return true;
  }

  /** Hits tear the Celestia vines off, one wrap at a time. */
  private unwrap() {
    const keep = Math.ceil((this.vines.length * this.hp) / this.maxHp);
    this.vines.forEach((v, i) => {
      if (i < keep || !v.visible) return;
      v.visible = false;
      v.getWorldPosition(tmpB);
      this.world.particles.emit(tmpB.x, tmpB.y, tmpB.z, { count: 16, color: '#ff6fcf', speed: 5, up: 2, life: 0.7, size: 0.5 });
    });
  }

  /** Picks the next move once it has dived back under the sand. */
  private next() {
    const pattern: Attack[] = this.angry ? ['burst', 'spin', 'burst', 'spray'] : ['burst', 'spray', 'burst', 'spin'];
    const a = pattern[this.count % pattern.length];
    this.count += 1;
    const c = this.center;
    const p = this.player.body;
    if (a === 'burst') {
      this.state = 'track';
      this.stateT = 1.5;
      this.burstsLeft = this.angry ? 2 : 1;
      if (this.first('burst')) this.world.hooks.toast('Watch the sand mound! RUN out of the red circle before it bursts up!', 'bolt');
      return;
    }
    // Spray from the rim (a little to one side of Jason), or spin in the middle of the pit.
    if (a === 'spray') {
      const ang = Math.atan2(p.x - c.x, p.z - c.z) + (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.6);
      this.goal.set(c.x + Math.sin(ang) * EDGE_R, 0, c.z + Math.cos(ang) * EDGE_R);
    } else {
      const ang = Math.random() * Math.PI * 2;
      this.goal.set(c.x + Math.sin(ang) * 2.5, 0, c.z + Math.cos(ang) * 2.5);
    }
    this.inside(this.goal, EDGE_R);
    this.state = 'swim';
    this.stateT = 4;
    this.fired = a === 'spray' ? 0 : 1;
  }

  /** Starts a burst under the locked-on spot: up out of the sand, an arc over the top, and down again. */
  private launch() {
    const c = this.center;
    const from = this.goal;
    let ang = Math.atan2(c.x - from.x, c.z - from.z);
    if (Math.hypot(c.x - from.x, c.z - from.z) < 4) ang = Math.random() * Math.PI * 2;
    ang += (Math.random() - 0.5) * 0.8;
    const to = this.inside(tmpA.set(from.x + Math.sin(ang) * 8, 0, from.z + Math.cos(ang) * 8));
    const g = this.ground;
    this.arc[0].set(from.x, g - DEEP, from.z);
    this.arc[1].set(from.x, g + 7.5, from.z);
    this.arc[2].set(to.x, g + 7.5, to.z);
    this.arc[3].set(to.x, g + 1.4, to.z);
    this.moveHead(from.x, g - DEEP, from.z);
    this.arcT = 0;
    this.broke = false;
    this.state = 'burst';
  }

  /** Where the burst arc is at `t` (0..1). */
  private bezier(t: number, out: THREE.Vector3) {
    const [a, b, c, d] = this.arc;
    const u = 1 - t;
    return out
      .copy(a)
      .multiplyScalar(u * u * u)
      .addScaledVector(b, 3 * u * u * t)
      .addScaledVector(c, 3 * u * t * t)
      .addScaledVector(d, t * t * t);
  }

  /** Bursting out of the sand: a spray of sand, a thump, and it hurts if Jason is standing right there. */
  private erupt(x: number, z: number, r: number) {
    const w = this.world;
    const g = this.ground;
    w.particles.emit(x, g + 0.4, z, { count: 40, color: SAND, speed: 9, up: 6, life: 0.9, size: 0.8 });
    w.particles.emit(x, g + 0.4, z, { count: 14, color: '#a07a4a', speed: 5, up: 4, life: 0.7, size: 1.1 });
    w.rings.burst(x, g, z, r * 2.4, SAND, 0.5);
    w.shake(0.45);
    audio.play('explode', 0.8);
    haptic('medium');
    const p = this.player.body;
    if (Math.hypot(p.x - x, p.z - z) < r + p.r && p.y < g + 2.6) this.player.hurt(1, x, z);
  }

  update(dt: number) {
    this.t += dt;
    const w = this.world;
    const g = this.ground;
    const p = this.player.body;
    const c = this.center;

    if (this.defeated) {
      // It shudders to a stop, smoke puffing from its vents, and settles into the sand.
      this.sink = Math.min(1.6, this.sink + dt * 0.25);
      this.obj.position.y = -this.sink;
      this.aimable = false;
      this.mound.visible = this.warn.visible = this.warnRing.visible = false;
      this.coreMat.emissiveIntensity = damp(this.coreMat.emissiveIntensity, 0, 1.5, dt);
      this.ventMat.emissiveIntensity = damp(this.ventMat.emissiveIntensity, 0, 1.5, dt);
      this.glow.material.opacity = damp(this.glow.material.opacity, 0, 2, dt);
      if (Math.random() < 0.15) {
        const s = this.segs[Math.floor(Math.random() * SEGS)];
        if (s.position.y > g - this.sink) w.particles.emit(s.position.x, s.position.y - this.sink + 1, s.position.z, { count: 2, color: '#6a6060', speed: 1, up: 2, life: 1.2, size: 1.2, gravity: 0 });
      }
      for (const v of this.vines) {
        if (v.visible && Math.random() < dt * 1.5) {
          v.visible = false;
          v.getWorldPosition(tmpB);
          w.particles.emit(tmpB.x, tmpB.y, tmpB.z, { count: 12, color: '#ff6fcf', speed: 4, up: 2, life: 0.8, size: 0.5 });
        }
      }
      this.pose();
      return;
    }

    if (!this.started && this.state !== 'intro') {
      // Before the fight it circles under the sand: only the mound gives it away.
      this.roamA += dt * 0.5;
      this.swim(c.x + Math.sin(this.roamA) * 7, c.z + Math.cos(this.roamA) * 7, 6, dt);
      if (this.playerDist() < 15 && p.y < g + 3) this.begin();
      this.pose();
      return;
    }

    this.stateT -= dt;
    const speed = this.angry ? 9.5 : 7.5;
    switch (this.state) {
      case 'intro': {
        const k = 1 - Math.max(0, this.stateT) / 1.3;
        const was = this.head.y;
        this.moveHead(c.x, this.riseFrom + (this.riseTo - this.riseFrom) * (1 - (1 - k) * (1 - k)), c.z);
        if (was < g && this.head.y >= g) {
          w.particles.emit(c.x, g + 0.4, c.z, { count: 60, color: SAND, speed: 10, up: 7, life: 1.1, size: 0.9 });
          w.shake(0.8);
          audio.play('roar', 0.7);
        }
        break;
      }
      case 'roam': {
        // Dives back down and drifts around under the sand for a moment.
        const ang = this.t * 0.7;
        this.swim(c.x + Math.sin(ang) * 6, c.z + Math.cos(ang) * 6, speed, dt);
        if (this.stateT <= 0 && this.underground()) this.next();
        break;
      }
      case 'track': {
        // Follows Jason under the sand...
        this.goal.set(p.x, 0, p.z);
        this.inside(this.goal);
        this.swim(this.goal.x, this.goal.z, speed, dt);
        if (this.stateT <= 0 && this.underground()) {
          // ...then locks on and shows the warning circle.
          this.state = 'warn';
          this.stateT = WARN_TIME;
          this.warn.position.set(this.goal.x, g + 0.06, this.goal.z);
          this.warnRing.position.copy(this.warn.position);
          this.warn.visible = this.warnRing.visible = true;
          audio.play('alarm', 1.4);
        }
        break;
      }
      case 'warn': {
        this.swim(this.goal.x, this.goal.z, 16, dt);
        const k = 1 - this.stateT / WARN_TIME;
        (this.warn.material as THREE.MeshBasicMaterial).opacity = 0.2 + k * 0.4 + (k > 0.6 ? Math.sin(this.t * 32) * 0.15 : 0);
        this.warnRing.scale.setScalar(1 + (1 - k) * 0.6);
        if (Math.random() < 0.5) w.particles.emit(this.goal.x + (Math.random() - 0.5) * 3, g + 0.2, this.goal.z + (Math.random() - 0.5) * 3, { count: 1, color: SAND, speed: 2, up: 3, life: 0.5, size: 0.5 });
        if (this.stateT <= 0) {
          this.warn.visible = this.warnRing.visible = false;
          this.launch();
        }
        break;
      }
      case 'burst': {
        this.arcT = Math.min(1, this.arcT + dt / 1.45);
        // Fast out of the sand, slower over the top.
        const k = 1 - (1 - this.arcT) ** 1.6;
        this.bezier(k, tmpA);
        this.moveHead(tmpA.x, tmpA.y, tmpA.z);
        if (!this.broke && this.head.y > g - 0.5) {
          this.broke = true;
          this.erupt(this.arc[0].x, this.arc[0].z, WARN_R);
          audio.play('roar', 1.1);
        }
        if (this.arcT >= 1) {
          this.erupt(this.head.x, this.head.z, 1.6);
          this.burstsLeft -= 1;
          if (this.burstsLeft > 0) {
            // Angry: straight back down and up again under Jason.
            this.state = 'track';
            this.stateT = 0.9;
          } else {
            this.state = 'stuck';
            this.stateT = STUCK_TIME;
            audio.play('sputter');
            if (this.first('stuck')) this.world.hooks.toast('Its drill is stuck in the sand! BLAST the glowing head!', 'bolt');
          }
        }
        break;
      }
      case 'stuck': {
        // The drill bit grinds and sparks; the head glows hot.
        if (Math.random() < 0.4) w.particles.emit(this.head.x, g + 0.2, this.head.z, { count: 2, color: Math.random() < 0.5 ? '#ffd166' : SAND, speed: 4, up: 3, life: 0.4, size: 0.4 });
        this.puff -= dt;
        if (this.puff <= 0) {
          this.puff = 0.5;
          const s = this.segs[1 + Math.floor(Math.random() * 4)];
          w.particles.emit(s.position.x, s.position.y + 1, s.position.z, { count: 3, color: '#f4f0ea', speed: 1.5, up: 2.5, life: 0.8, size: 1, gravity: 0 });
        }
        if (this.stateT <= 0) {
          this.state = 'roam';
          this.stateT = this.angry ? 1 : 1.6;
          audio.play('vent', 0.7);
        }
        break;
      }
      case 'swim': {
        const d = this.swim(this.goal.x, this.goal.z, speed + 2, dt);
        if ((d < 0.3 && this.underground()) || this.stateT <= 0) {
          this.state = 'rise';
          this.riseFrom = this.head.y;
          this.riseTo = g + 4.4;
          this.stateT = 0.7;
          this.broke = false;
        }
        break;
      }
      case 'rise': {
        const k = 1 - Math.max(0, this.stateT) / 0.7;
        this.moveHead(this.goal.x, this.riseFrom + (this.riseTo - this.riseFrom) * (1 - (1 - k) * (1 - k)), this.goal.z);
        if (!this.broke && this.head.y > g - 0.5) {
          this.broke = true;
          this.erupt(this.goal.x, this.goal.z, 2);
        }
        if (this.stateT <= 0) {
          this.state = this.fired === 0 ? 'spray' : 'spin';
          this.stateT = this.state === 'spray' ? (this.angry ? 3 : 2.4) : this.angry ? 2.4 : 1.8;
          this.fired = 0;
          if (this.state === 'spray') {
            if (this.first('spray')) this.world.hooks.toast('Sand spray! Hide behind a rock pillar, or SPIN to block it!', 'bolt');
          } else if (this.first('spin')) {
            this.world.hooks.toast('Drill quake! JUMP over the ring!', 'bolt');
          }
        }
        break;
      }
      case 'spray': {
        this.lookAtJason = damp(this.lookAtJason, 1, 4, dt);
        const total = this.angry ? 3 : 2.4;
        const shots = this.angry ? 3 : 2;
        const due = Math.floor((total - this.stateT - 0.7) / 0.75) + 1;
        if (this.fired < shots && due > this.fired) {
          this.fired += 1;
          this.spray(this.angry ? 7 : 5);
        }
        if (this.stateT <= 0) this.sinkDown();
        break;
      }
      case 'spin': {
        const total = this.angry ? 2.4 : 1.8;
        const el = total - this.stateT;
        this.drillMat.emissiveIntensity = Math.min(2, el * 1.6);
        if (Math.random() < 0.6) w.particles.emit(this.head.x, g + 0.2, this.head.z, { count: 2, color: SAND, speed: 6, up: 1, life: 0.5, size: 0.6 });
        const waves = this.angry ? 2 : 1;
        if (this.fired < waves && el > 0.9 + this.fired * 0.7) {
          this.fired += 1;
          w.addEntity(new Shockwave(w, this.head.x, g, this.head.z, 17, 8, HOT));
          w.shake(0.5);
          audio.play('pound', 0.7);
        }
        if (this.stateT <= 0) this.sinkDown();
        break;
      }
      case 'sink': {
        this.lookAtJason = damp(this.lookAtJason, 0, 6, dt);
        this.retract(dt * 11);
        if (this.stateT <= 0 || this.head.y < g - DEEP + 0.3) {
          this.state = 'roam';
          this.stateT = this.angry ? 0.8 : 1.3;
        }
        break;
      }
    }
    this.drill.rotation.y += dt * (this.state === 'spin' ? 30 : this.state === 'stuck' ? 22 : this.state === 'burst' ? 16 : 7);
    this.aimable = this.state === 'stuck';
    this.mound.visible = this.underground();
    this.mound.position.set(this.head.x, g, this.head.z);
    const s = 1 + Math.sin(this.t * 9) * 0.08;
    this.mound.scale.set(s, 0.32 + Math.sin(this.t * 7) * 0.05, s);
    if (this.mound.visible && Math.random() < 0.5) {
      w.particles.emit(this.head.x + (Math.random() - 0.5) * 2, g + 0.3, this.head.z + (Math.random() - 0.5) * 2, { count: 1, color: SAND, speed: 1.5, up: 2.5, life: 0.6, size: 0.6 });
    }
    this.pose();
    this.glowUpdate(dt);
    this.touch();
  }

  /** Back down the hole it came out of. */
  private sinkDown() {
    this.state = 'sink';
    this.stateT = 1.2;
    this.drillMat.emissiveIntensity = 0;
    audio.play('vent', 0.6);
  }

  /** A fan of sand blobs spat at Jason. */
  private spray(n: number) {
    const w = this.world;
    const p = this.player.body;
    const from = tmpA.copy(this.head).addScaledVector(this.look, 1.6);
    const base = Math.atan2(p.x - from.x, p.z - from.z);
    const dist = Math.hypot(p.x - from.x, p.z - from.z);
    const drop = Math.atan2(from.y - (p.y + 0.9), Math.max(1, dist));
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.2;
      const dir = tmpB.set(Math.sin(a) * Math.cos(drop), -Math.sin(drop), Math.cos(a) * Math.cos(drop));
      w.shots.fire('enemy', from, dir, 11, 1);
    }
    w.particles.emit(from.x, from.y, from.z, { count: 18, color: SAND, speed: 5, life: 0.5, size: 0.6 });
    w.soundAt('enemyShoot', from.x, from.z, 0.7, 30);
  }

  /** The head glows hot while it is stuck (the moment to hit it), and flashes when hit. */
  private glowUpdate(dt: number) {
    const stuck = this.state === 'stuck';
    const target = stuck ? 2.2 + Math.sin(this.t * 10) * 0.6 : 0.4;
    this.coreMat.emissiveIntensity = damp(this.coreMat.emissiveIntensity, target, 6, dt);
    if (this.state !== 'spin') this.drillMat.emissiveIntensity = damp(this.drillMat.emissiveIntensity, stuck ? 1.4 : 0, 4, dt);
    this.glow.material.opacity = damp(this.glow.material.opacity, stuck ? 0.75 : 0, 6, dt);
    this.ventMat.emissiveIntensity = 0.7 + Math.sin(this.t * 6) * 0.3;
  }

  /** Lines the head and every segment up along the trail. */
  private pose() {
    const hd = this.headObj;
    hd.position.copy(this.head);
    // Forward is from the point just behind the head to the head.
    this.sample(1, tmpA);
    tmpB.subVectors(this.head, tmpA);
    if (tmpB.lengthSq() > 1e-6) {
      tmpB.normalize();
      if (this.lookAtJason > 0.01) {
        const p = this.player.body;
        tmpA.set(p.x - this.head.x, p.y + 1 - this.head.y, p.z - this.head.z).normalize().add(UP).normalize();
        tmpB.lerp(tmpA, this.lookAtJason).normalize();
      }
      this.look.copy(tmpB);
      hd.quaternion.setFromUnitVectors(UP, tmpB);
    }
    let prev = this.head;
    const at = new THREE.Vector3();
    for (let i = 0; i < SEGS; i++) {
      const s = this.segs[i];
      this.sample(1.55 + i * GAP, at);
      s.position.copy(at);
      tmpB.subVectors(prev, at);
      if (tmpB.lengthSq() > 1e-6) s.quaternion.copy(tmpQ.setFromUnitVectors(UP, tmpB.normalize()));
      prev = s.position;
    }
    this.aim.copy(this.head).addScaledVector(UP, 0.4);
  }

  /** Touching the head (or the drill) hurts, except while it is stuck and helpless. */
  private touch() {
    if (this.state === 'stuck' || this.underground() || this.state === 'intro') return;
    const p = this.player.body;
    const h = this.head;
    if (Math.hypot(p.x - h.x, p.z - h.z) < 1.9 && p.y + 0.9 > h.y - 1.9 && p.y < h.y + 1.6) this.player.hurt(1, h.x, h.z);
  }
}
