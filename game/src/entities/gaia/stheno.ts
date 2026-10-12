import * as THREE from 'three';

import { audio } from '../../core/audio';
import { haptic } from '../../core/bridge';
import { CELL } from '../../core/constants';
import { tr } from '../../core/i18n';
import { damp } from '../../core/math';
import type { World } from '../../game/world';
import { Grid } from '../../world/grid';
import { Boss, bossHp } from '../bossBase';
import { Entity, type HitKind, type Target } from '../entity';
import { Strike } from '../hazards';
import { boxG, cone, cyl, glowSprite, mat, mesh, ownMat, sphere, torus } from '../models';

/**
 * STHENO, the Gorgon's last flying gunship. It hovers over the drop beside the mountain pass and
 * takes turns: strafing runs along the edge, missile volleys (red circles on the floor) and a
 * searchlight laser that sweeps across the whole pass (jump it). Jason zips up to the rings at the
 * edge to get close and shoots its three glowing engines; with all three gone it lists to one side
 * and its armoured core opens for the last few hits.
 */

/** Hit points of each engine pod; all three together are 24 of STHENO's 40 (both grow with Blaster Power). */
const ENGINE_HP = 8;
const HP = 40;
/** How far out over the drop STHENO hovers (world units from the edge of the pass). */
const STANDOFF = 6.5;
/** Height above the arena floor. */
const HOVER = 3.6;
const SWEEP_SPEED = 4.2;

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

/** One of STHENO's three engine pods: a target of its own that passes its damage on to the gunship. */
class Engine extends Entity implements Target {
  readonly aim = new THREE.Vector3();
  radius = 1;
  aimable = true;
  hp: number;
  down = false;
  private flash = 0;

  constructor(
    world: World,
    id: string,
    private ship: Stheno,
    /** The pod in the ship's model (it moves with the ship). */
    readonly pod: THREE.Group,
    private heat: THREE.MeshStandardMaterial,
    private glow: THREE.Sprite,
  ) {
    super(world, id);
    this.hp = ship.engineHp;
    world.addTarget(this);
  }

  hit(dmg: number, _kind: HitKind): boolean {
    if (this.down || !this.ship.started || this.ship.defeated) return false;
    const n = Math.min(dmg, this.hp);
    this.hp -= dmg;
    this.flash = 1;
    audio.play('hit');
    this.ship.damage(n);
    if (this.hp <= 0) this.blowUp();
    return true;
  }

  private blowUp() {
    this.down = true;
    this.aimable = false;
    this.world.removeTarget(this);
    const w = this.world;
    audio.play('explode');
    haptic('heavy');
    w.shake(0.45);
    w.flash(this.aim.x, this.aim.y, this.aim.z, '#ffb347', 70, 0.4);
    w.particles.emit(this.aim.x, this.aim.y, this.aim.z, { count: 40, color: '#ffb347', speed: 9, life: 0.8, size: 0.8 });
    w.particles.emit(this.aim.x, this.aim.y, this.aim.z, { count: 20, color: '#3a3430', speed: 4, life: 1.2, size: 1, up: 2 });
    this.pod.scale.set(0.8, 0.8, 0.6);
    this.heat.color.set('#2a2622');
    this.heat.emissiveIntensity = 0;
    this.glow.visible = false;
    this.ship.engineDown();
  }

  revive() {
    if (this.down) this.world.addTarget(this);
    this.hp = this.ship.engineHp;
    this.down = false;
    this.aimable = true;
    this.pod.scale.set(1, 1, 1);
    this.heat.color.set('#ffd08a');
    this.glow.visible = true;
  }

  update(dt: number) {
    this.pod.getWorldPosition(this.aim);
    this.flash = Math.max(0, this.flash - dt * 5);
    if (this.down) {
      // A broken engine trails smoke.
      if (Math.random() < 0.3) this.world.particles.emit(this.aim.x, this.aim.y, this.aim.z, { count: 1, color: '#4a4440', speed: 0.6, life: 1.2, size: 0.9, up: 1.5, gravity: 0 });
      return;
    }
    this.heat.emissiveIntensity = 1.6 + Math.sin(this.ship.time * 9 + this.pod.id) * 0.3 + this.flash * 3;
    this.glow.scale.setScalar(2.6 + this.flash * 1.6 + Math.sin(this.ship.time * 12 + this.pod.id) * 0.2);
  }
}

type State = 'idle' | 'strafe' | 'missiles' | 'sweep';

export class Stheno extends Boss implements Target {
  readonly title = 'STHENO';
  protected focusHeight = 2.2;
  /** The armoured core: only open (and aimable) once every engine is down. */
  readonly aim = new THREE.Vector3();
  radius = 1.2;
  aimable = false;
  private model = new THREE.Group();
  private hull = new THREE.Group();
  private engines: Engine[] = [];
  private cannons: THREE.Object3D[] = [];
  private cannonMat: THREE.MeshStandardMaterial;
  private coreMat: THREE.MeshStandardMaterial;
  private core: THREE.Mesh;
  private hatches: THREE.Mesh[] = [];
  private lamp: THREE.Object3D;
  private sweepBar: THREE.Mesh;
  private sweepHalo: THREE.Mesh;
  private beam: THREE.Mesh;
  private beamPos: THREE.BufferAttribute;
  /** Where STHENO is right now, and where it likes to hover. */
  private pos = new THREE.Vector3();
  private home = new THREE.Vector3();
  private bank = 0;
  private list = 0;
  private state: State = 'idle';
  private stateT = 3;
  private count = 0;
  private told = new Set<string>();
  /** Missiles still on their way down (cleared when the fight ends or restarts). */
  private strikes: Strike[] = [];
  /** Arena bounds (world units): the edge of the pass on the west, and the walls around it. */
  private x0: number;
  private x1: number;
  private z0: number;
  private z1: number;
  private floorY: number;
  // Strafing run.
  private strafeTo = 0;
  private burstT = 0;
  private burstShots = 0;
  // Searchlight sweep.
  private sweepZ = 0;
  private sweepDir = 1;
  private sweepWarn = 0;

  /** Health of each engine pod. */
  readonly engineHp: number;

  constructor(world: World, id: string, cx: number, cz: number, h: number) {
    const engineHp = bossHp(world, ENGINE_HP);
    super(world, id, cx, cz, h, 3 * engineHp + bossHp(world, HP - 3 * ENGINE_HP));
    this.engineHp = engineHp;
    // Measure the arena: west to the drop, east to the wreck, north and south to the walls.
    const g = world.grid;
    const walk = (x: number, z: number) => {
      const k = g.cell(x, z).kind;
      return k === 'floor' || k === 'ice' || k === 'grate';
    };
    let wx = cx;
    while (wx > 0 && g.cell(wx - 1, cz).kind !== 'void') wx--;
    let ex = cx;
    while (walk(ex + 1, cz)) ex++;
    let nz = cz;
    while (walk(cx, nz - 1)) nz--;
    let sz = cz;
    while (walk(cx, sz + 1)) sz++;
    this.x0 = wx * CELL;
    this.x1 = (ex + 1) * CELL;
    this.z0 = nz * CELL;
    this.z1 = (sz + 1) * CELL;
    this.floorY = h;
    this.home.set(this.x0 - STANDOFF, h + HOVER, this.center.z);
    this.pos.copy(this.home);

    /* ---------- the gunship ---------- */
    const olive = mat('#6b6a3a', { rough: 0.55, metal: 0.35 });
    const bronze = mat('#9a7a3e', { rough: 0.4, metal: 0.6 });
    const dark = mat('#3a3630', { rough: 0.6, metal: 0.4 });
    const red = mat('#b81e2c', { rough: 0.5 });
    const gear = mat('#ff3a4c', { emissive: '#ff3a4c', ei: 1.2 });
    const vine = mat('#3f7a3a', { rough: 0.7 });
    const thorn = mat('#7a2a5a', { emissive: '#ff4fb8', ei: 0.3 });
    const s = this.hull;
    // Hull: long along z, its armed side (+x) facing the pass.
    s.add(mesh(boxG(2.8, 1.5, 5.6), olive, 0, 0, 0));
    s.add(mesh(boxG(2.2, 0.7, 4.6), bronze, 0, 0.95, 0.2));
    s.add(mesh(boxG(3, 0.18, 5.8), red, 0, -0.62, 0));
    const nose = mesh(cone(1.25, 2.2, 8), olive, 0, 0, -3.9);
    nose.rotation.x = -Math.PI / 2;
    nose.scale.set(1.15, 1, 0.75);
    s.add(nose);
    s.add(mesh(boxG(0.25, 1.6, 1.4), olive, 0, 1.4, 2.6));
    s.add(mesh(boxG(4.6, 0.16, 1.2), bronze, 0, 0.2, 2.5));
    // Cockpit glow.
    const glass = mesh(sphere(0.8, 16), mat('#ffe2a0', { emissive: '#ffb347', ei: 1.6, rough: 0.2 }), 0, 0.85, -2.3, false);
    glass.scale.set(1, 0.55, 1.3);
    s.add(glass);
    // Brennus's red gear emblem on the side facing the pass.
    const emblem = new THREE.Group();
    emblem.add(mesh(torus(0.42, 0.1), gear, 0, 0, 0, false));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      emblem.add(mesh(boxG(0.16, 0.2, 0.12), gear, Math.cos(a) * 0.55, Math.sin(a) * 0.55, 0, false).rotateZ(a));
    }
    emblem.rotation.y = Math.PI / 2;
    emblem.position.set(1.43, 0.1, 1.5);
    s.add(emblem);
    // Two side cannons, slung under the near side.
    this.cannonMat = ownMat('#5a2a20', { emissive: '#ff5e3a', ei: 0.2, metal: 0.5 });
    for (const z of [-1, 1]) {
      const c = mesh(cyl(0.22, 0.28, 1.6, 10), dark, 1.6, -0.88, z);
      c.rotation.z = Math.PI / 2;
      s.add(c);
      const muzzle = mesh(cyl(0.2, 0.2, 0.2, 10), this.cannonMat, 2.45, -0.88, z, false);
      muzzle.rotation.z = Math.PI / 2;
      s.add(muzzle);
      this.cannons.push(muzzle);
    }
    // The armoured core in the middle of the near side, behind two hatches.
    this.coreMat = ownMat('#ffd08a', { emissive: '#ff8a2a', ei: 1.2 });
    this.core = mesh(sphere(0.55, 18), this.coreMat, 1.1, 0.1, -0.4, false);
    s.add(this.core);
    for (const dz of [-1, 1]) {
      const hatch = mesh(boxG(0.18, 1.2, 0.72), bronze, 1.62, 0.1, -0.4 + dz * 0.36);
      this.hatches.push(hatch);
      s.add(hatch);
    }
    // The searchlight under the belly.
    this.lamp = mesh(sphere(0.32, 12), mat('#ffffff', { emissive: '#ff5e6a', ei: 2 }), 0, -0.95, -2.2, false);
    s.add(this.lamp);
    // Vines wrapped all round it (Celestia's pollen got here too).
    for (let i = 0; i < 4; i++) {
      const ring = mesh(torus(1.55, 0.09), vine, 0, 0.1, -1.8 + i * 1.3, false);
      ring.rotation.y = 0.15 * (i % 2 ? 1 : -1);
      ring.scale.set(1, 0.62, 1);
      s.add(ring);
      for (let k = 0; k < 3; k++) {
        const a = i * 1.7 + k * 2.1;
        const t = mesh(cone(0.08, 0.4, 5), thorn, Math.cos(a) * 1.5, 0.1 + Math.sin(a) * 0.95, -1.8 + i * 1.3, false);
        t.rotation.z = a - Math.PI / 2;
        s.add(t);
      }
    }
    // Three engine pods: front and back on the near side, and one on its back.
    const pods: [number, number, number][] = [
      [1.9, -0.35, 2.3],
      [1.9, -0.35, -2.5],
      [0.2, 1.75, 0.9],
    ];
    pods.forEach(([x, y, z], i) => {
      const pod = new THREE.Group();
      pod.position.set(x, y, z);
      const shell = mesh(cyl(0.55, 0.62, 1.7, 14), bronze, 0, 0, 0);
      shell.rotation.x = Math.PI / 2;
      pod.add(shell);
      pod.add(mesh(torus(0.6, 0.08), red, 0, 0, -0.55, false));
      const heat = ownMat('#ffd08a', { emissive: '#ffb347', ei: 1.6 });
      const exhaust = mesh(sphere(0.45, 14), heat, 0, 0, 0.85, false);
      exhaust.scale.set(1, 1, 0.5);
      pod.add(exhaust);
      const fire = glowSprite('#ffb347', 2.6, 0.75);
      fire.position.set(0, 0, 0.95);
      pod.add(fire);
      const wrap = mesh(torus(0.62, 0.07), vine, 0, 0, 0.2, false);
      wrap.rotation.y = 0.4;
      pod.add(wrap);
      s.add(pod);
      this.engines.push(world.addEntity(new Engine(world, `${id}.engine${i}`, this, pod, heat, fire)));
    });
    this.model.add(this.hull);
    this.model.add(glowSprite('#ffb347', 6, 0.12));
    this.obj.add(this.model);

    /* ---------- the searchlight sweep ---------- */
    const width = this.x1 - this.x0;
    this.sweepBar = new THREE.Mesh(boxG(width, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: '#ff2238', transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false }));
    this.sweepHalo = new THREE.Mesh(
      new THREE.PlaneGeometry(width, 1.4).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#ff5e6a', transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    );
    const g2 = new THREE.BufferGeometry();
    this.beamPos = new THREE.BufferAttribute(new Float32Array(9), 3);
    this.beamPos.setUsage(THREE.DynamicDrawUsage);
    g2.setAttribute('position', this.beamPos);
    this.beam = new THREE.Mesh(
      g2,
      new THREE.MeshBasicMaterial({ color: '#ff8a8a', transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false }),
    );
    this.beam.frustumCulled = false;
    for (const m of [this.sweepBar, this.sweepHalo, this.beam]) {
      m.visible = false;
      this.obj.add(m);
    }
    this.place(0);
    world.addTarget(this);
  }

  /** World time, for the engines' flicker. */
  get time() {
    return this.t;
  }

  get where(): THREE.Vector3 {
    return new THREE.Vector3(this.pos.x, this.pos.y - 1.2, this.pos.z);
  }

  private get enginesLeft() {
    return this.engines.filter((e) => !e.down).length;
  }

  engineDown() {
    const left = this.enginesLeft;
    if (left > 0) {
      this.world.hooks.toast(tr('Engine down! {n} to go.', { n: left }), 'bolt');
      return;
    }
    // All three gone: it lurches, lists to one side and its core opens.
    this.world.shake(0.7);
    audio.play('roar', 0.7);
    this.world.hooks.toast('All engines down! Its core is open. BLAST it!', 'bolt');
    this.state = 'idle';
    this.stateT = 2.4;
    this.hideSweep();
  }

  hit(dmg: number, _kind: HitKind): boolean {
    if (!this.started || this.defeated) return true;
    if (this.enginesLeft > 0) {
      audio.play('shield', 1.4);
      return true;
    }
    this.damage(dmg);
    this.coreMat.emissiveIntensity = 4;
    audio.play('hit');
    return true;
  }

  reset() {
    this.hp = this.maxHp;
    for (const e of this.engines) e.revive();
    this.state = 'idle';
    this.stateT = 2.5;
    this.count = 0;
    this.pos.copy(this.home);
    this.bank = 0;
    this.list = 0;
    this.hideSweep();
    this.clearStrikes();
  }

  private clearStrikes() {
    for (const s of this.strikes) if (s.alive) s.remove();
    this.strikes = [];
  }

  protected onStart() {
    this.stateT = 2;
    this.world.hooks.toast('Shoot its three glowing engines!', 'bolt');
  }

  protected finish() {
    this.defeated = true;
    this.hideSweep();
    // Nothing still in the air may land on Jason once it's over.
    this.clearStrikes();
    this.world.shots.clear();
    const p = this.pos;
    audio.play('explode');
    haptic('heavy');
    this.world.shake(0.8);
    for (let i = 0; i < 4; i++) this.world.particles.emit(p.x, p.y + i * 0.5, p.z, { count: 40, color: i % 2 ? '#ffffff' : '#ffb347', speed: 10, life: 1.2, size: 0.9 });
    this.world.dropBolts(tmp.set(this.x0 + 3, this.floorY + 2, THREE.MathUtils.clamp(p.z, this.z0 + 2, this.z1 - 2)), 40);
    this.world.bossDefeated(this);
  }

  /** Moves the model to `pos`, banking into turns and listing once its engines are gone. */
  private place(dt: number) {
    const bob = Math.sin(this.t * 1.6) * 0.3;
    this.model.position.set(this.pos.x, this.pos.y + bob, this.pos.z);
    this.hull.rotation.set(this.bank * 0.5, 0, Math.sin(this.t * 0.9) * 0.05 - this.list * 0.35 + this.bank * 0.1);
    void dt;
    this.model.updateMatrixWorld(true);
    this.core.getWorldPosition(this.aim);
  }

  private hideSweep() {
    this.sweepBar.visible = false;
    this.sweepHalo.visible = false;
    this.beam.visible = false;
  }

  update(dt: number) {
    this.t += dt;
    const open = !this.defeated && this.started && this.enginesLeft === 0;
    this.list = damp(this.list, open || this.defeated ? 1 : 0, 2, dt);
    for (const [i, h] of this.hatches.entries()) h.position.z = -0.4 + (i ? 1 : -1) * (0.36 + this.list * 0.45);
    this.coreMat.emissiveIntensity = damp(this.coreMat.emissiveIntensity, open ? 2.4 + Math.sin(this.t * 8) * 0.6 : 0.6, 6, dt);
    this.aimable = open;

    if (this.defeated) {
      // Down it goes, trailing smoke, into the clouds below the pass.
      this.pos.y -= dt * (2 + (this.pos.y < this.floorY ? 6 : 0));
      this.pos.x -= dt * 1.5;
      this.bank = damp(this.bank, -0.6, 1, dt);
      if (Math.random() < 0.6) this.world.particles.emit(this.pos.x, this.pos.y + 0.5, this.pos.z, { count: 2, color: '#3a3430', speed: 1, life: 1.4, size: 1.2, up: 2, gravity: 0 });
      this.model.visible = this.pos.y > this.floorY - 30;
      this.place(dt);
      return;
    }
    if (!this.started) {
      this.place(dt);
      if (this.playerDist() < 14) this.begin();
      return;
    }
    // Never attack while a cutscene is playing.
    if (this.world.cutscene) {
      this.place(dt);
      return;
    }

    const p = this.player.body;
    this.stateT -= dt;
    let goalX = this.home.x + (open ? 2 : 0);
    let goalZ = this.pos.z;
    this.cannonMat.emissiveIntensity = damp(this.cannonMat.emissiveIntensity, 0.2, 4, dt);
    switch (this.state) {
      case 'idle': {
        // Drift to stay level with Jason along the edge of the pass.
        goalZ = THREE.MathUtils.clamp(p.z, this.z0 + 3, this.z1 - 3);
        if (this.stateT <= 0) this.nextAttack(open);
        break;
      }
      case 'strafe': {
        goalX = this.home.x + 1.2;
        const dir = Math.sign(this.strafeTo - this.pos.z);
        this.pos.z += dir * 5 * dt;
        this.bank = damp(this.bank, dir * 0.5, 3, dt);
        goalZ = this.pos.z;
        this.burstT -= dt;
        // The cannons glow for a moment before each burst: that's the warning.
        if (this.burstT < 0.5) this.cannonMat.emissiveIntensity = 1 + (0.5 - this.burstT) * 6;
        if (this.burstT <= 0) {
          this.fireShot();
          this.burstShots += 1;
          this.burstT = this.burstShots % 3 === 0 ? 1.3 : 0.14;
        }
        if (Math.abs(this.strafeTo - this.pos.z) < 0.3 || this.stateT <= 0) {
          this.state = 'idle';
          this.stateT = 2.2;
        }
        break;
      }
      case 'missiles': {
        if (this.stateT <= 0.9 && this.stateT + dt > 0.9) this.launchMissiles(open ? 3 : 4);
        if (this.stateT <= 0) {
          this.state = 'idle';
          this.stateT = 2;
        }
        break;
      }
      case 'sweep':
        this.updateSweep(dt);
        break;
    }
    if (this.state !== 'strafe') this.bank = damp(this.bank, 0, 3, dt);
    this.pos.x = damp(this.pos.x, goalX, 2, dt);
    this.pos.z = damp(this.pos.z, goalZ, this.state === 'strafe' ? 20 : 0.8, dt);
    this.pos.y = damp(this.pos.y, this.home.y - this.list * 0.8, 2, dt);
    this.place(dt);

    // Flying into the gunship hurts.
    tmp.set(p.x, p.y + 0.9, p.z);
    if (tmp.distanceTo(this.model.position) < 2.6) this.player.hurt(1, this.pos.x, this.pos.z);
  }

  private nextAttack(open: boolean) {
    this.count += 1;
    // With its engines gone it can't make strafing runs any more.
    const order: State[] = open ? ['missiles', 'sweep'] : ['strafe', 'missiles', 'strafe', 'sweep'];
    this.state = order[this.count % order.length];
    if (this.state === 'strafe') {
      const mid = (this.z0 + this.z1) / 2;
      this.strafeTo = this.pos.z < mid ? this.z1 - 2 : this.z0 + 2;
      this.stateT = 7;
      this.burstT = 0.9;
      this.burstShots = 0;
      audio.play('roar', 1.3);
      if (this.first('strafe')) this.world.hooks.toast('Strafing run! Keep moving!', 'bolt');
    } else if (this.state === 'missiles') {
      this.stateT = 1.8;
      audio.play('alarm', 1.2);
      if (this.first('missiles')) this.world.hooks.toast('Missiles! Run out of the red circles!', 'bolt');
    } else {
      // The sweep starts at the end of the pass farther from Jason, so he always sees it coming.
      const p = this.player.body;
      const mid = (this.z0 + this.z1) / 2;
      this.sweepDir = p.z < mid ? -1 : 1;
      this.sweepZ = this.sweepDir > 0 ? this.z0 + 0.6 : this.z1 - 0.6;
      this.sweepWarn = 1.2;
      this.stateT = 99;
      this.world.hooks.toast('Laser sweep! JUMP over it!', 'bolt');
    }
  }

  /** True the first time each attack comes, so its hint isn't repeated over and over. */
  private first(key: string) {
    if (this.told.has(key)) return false;
    this.told.add(key);
    return true;
  }

  private fireShot() {
    const p = this.player.body;
    if (Math.hypot(p.x - this.pos.x, p.z - this.pos.z) > 30) return;
    const muzzle = this.cannons[this.burstShots % 2];
    muzzle.getWorldPosition(tmp);
    tmp2.set(p.x + (Math.random() - 0.5) * 1.2, p.y + 0.9, p.z + (Math.random() - 0.5) * 1.2).sub(tmp).normalize();
    this.world.shots.fire('enemy', tmp.clone(), tmp2.clone(), 12, 1);
    this.world.particles.emit(tmp.x, tmp.y, tmp.z, { count: 6, color: '#ffb347', speed: 3, life: 0.25, size: 0.5 });
    audio.play('enemyShoot', 0.8);
  }

  private launchMissiles(n: number) {
    const p = this.player.body;
    const w = this.world;
    this.strikes = this.strikes.filter((s) => s.alive);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = i === 0 ? 0 : 2 + Math.random() * 3;
      const x = p.x + Math.cos(a) * r;
      const z = p.z + Math.sin(a) * r;
      const c = w.grid.cell(Grid.toCell(x), Grid.toCell(z));
      if (c.kind === 'void' || c.kind === 'wall') continue;
      this.strikes.push(w.addEntity(new Strike(w, x, c.h, z, 1.6 + i * 0.15, 1.3, '#ff5e6a', 'missile')));
    }
    // A puff from the launcher on its back.
    w.particles.emit(this.pos.x, this.pos.y + 2, this.pos.z, { count: 16, color: '#d8d0c0', speed: 3, life: 0.6, size: 0.7, up: 3 });
    audio.play('enemyShoot', 0.6);
  }

  private updateSweep(dt: number) {
    const y = this.floorY + 0.35;
    const midX = (this.x0 + this.x1) / 2;
    this.sweepBar.visible = true;
    this.sweepHalo.visible = true;
    this.beam.visible = true;
    const barMat = this.sweepBar.material as THREE.MeshBasicMaterial;
    if (this.sweepWarn > 0) {
      // A blinking line first, where the sweep will start.
      this.sweepWarn -= dt;
      barMat.opacity = Math.sin(this.t * 30) > 0 ? 0.8 : 0.15;
    } else {
      barMat.opacity = 0.95;
      this.sweepZ += this.sweepDir * SWEEP_SPEED * dt;
      const p = this.player.body;
      if (Math.abs(p.z - this.sweepZ) < 0.4 + p.r && p.x > this.x0 - 0.5 && p.x < this.x1 && p.y < this.floorY + 0.55) {
        this.player.hurt(1, p.x, this.sweepZ + this.sweepDir);
      }
      if (this.sweepZ < this.z0 || this.sweepZ > this.z1) {
        this.hideSweep();
        this.state = 'idle';
        this.stateT = 2;
        return;
      }
    }
    this.sweepBar.position.set(midX, y, this.sweepZ);
    this.sweepHalo.position.set(midX, this.floorY + 0.04, this.sweepZ);
    // The searchlight's beam fans out from the lamp to both ends of the line.
    this.lamp.getWorldPosition(tmp);
    const a = this.beamPos.array as Float32Array;
    a.set([tmp.x, tmp.y, tmp.z, this.x0, y, this.sweepZ, this.x1, y, this.sweepZ]);
    this.beamPos.needsUpdate = true;
    this.beam.geometry.computeBoundingSphere();
  }
}
