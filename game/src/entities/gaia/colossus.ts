import * as THREE from 'three';

import { audio } from '../../core/audio';
import { haptic } from '../../core/bridge';
import { tr } from '../../core/i18n';
import { damp, dampAngle, lerp } from '../../core/math';
import type { World } from '../../game/world';
import { inChapter } from '../../levels';
import type { Box } from '../../world/physics';
import { Boss, bossHp } from '../bossBase';
import type { Enemy } from '../enemies';
import { Entity, type HitKind, type Interactable, type Target } from '../entity';
import { Shockwave, Strike } from '../hazards';
import { blobShadow, boxG, capsule, cone, cyl, glowSprite, mat, mesh, ownMat, sphere, torus } from '../models';

/* ---------------- THE COLOSSUS: the final boss of chapter 2 ---------------- */

const FIRE = '#ff6a2a';
const RED = '#ff3a4c';
const PINK = '#ff5fc8';
const GOLD = '#ffb020';
/** Seconds the shield stays down once all three generators are knocked out. */
const SHIELD_DOWN = 8;
/** Hits a generator takes before it pops. */
const GEN_HP = 3;
/** How far the floor beams reach from the Colossus's feet (world units). */
const SWEEP_LEN = 18;
const SWEEP_IN = 2.6;
/** Journal pages Jason needs to talk Brennus down. */
const ALL_PAGES = 18;

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/** Stretches a unit-tall cylinder mesh between two points (cables and energy tethers). */
function span(m: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) {
  tmp2.subVectors(b, a);
  const len = tmp2.length();
  m.position.copy(a).addScaledVector(tmp2, 0.5);
  m.scale.set(1, Math.max(0.01, len), 1);
  if (len > 1e-4) m.quaternion.setFromUnitVectors(UP, tmp2.multiplyScalar(1 / len));
}

/**
 * One of the three shield generators on the crater floor. BLAST it a few times or walk up and HACK it;
 * when all three are out, the Colossus's shield drops for a few seconds.
 */
class Generator extends Entity implements Target, Interactable {
  readonly aim: THREE.Vector3;
  readonly spot: THREE.Vector3;
  radius = 0.9;
  range = 2.8;
  aimable = false;
  down = false;
  private hp = GEN_HP;
  private light: THREE.MeshStandardMaterial;
  private ring: THREE.Mesh;
  private glow: THREE.Sprite;
  private tether: THREE.Mesh;
  private t = Math.random() * 5;

  constructor(
    world: World,
    id: string,
    x: number,
    y: number,
    z: number,
    private boss: Colossus,
  ) {
    super(world, id);
    this.spot = new THREE.Vector3(x, y, z);
    this.aim = new THREE.Vector3(x, y + 2.3, z);
    const steel = mat('#3a3236', { metal: 0.6, rough: 0.4 });
    this.obj.add(mesh(cyl(0.8, 1, 0.5, 14), steel, x, y + 0.25, z));
    this.obj.add(mesh(cyl(0.38, 0.55, 1.8, 12), steel, x, y + 1.3, z));
    for (let i = 0; i < 3; i++) {
      const fin = mesh(boxG(0.12, 1.2, 0.7), mat(RED, { emissive: RED, ei: 0.4 }), x, y + 1.1, z);
      fin.rotation.y = (i / 3) * Math.PI * 2;
      fin.translateZ(0.55);
      this.obj.add(fin);
    }
    this.light = ownMat('#ffd0a0', { emissive: FIRE, ei: 1.8 });
    this.obj.add(mesh(sphere(0.48, 16), this.light, x, y + 2.3, z, false));
    this.ring = mesh(torus(0.78, 0.07), this.light, x, y + 2.3, z, false);
    this.ring.rotation.x = Math.PI / 2;
    this.obj.add(this.ring);
    this.glow = glowSprite(FIRE, 3.2, 0.5);
    this.glow.position.set(x, y + 2.3, z);
    this.obj.add(this.glow);
    // A crackling energy line from the generator up into the shield.
    this.tether = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 1, 6),
      new THREE.MeshBasicMaterial({ color: '#ffb070', transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false }),
    );
    const c = boss.center;
    span(this.tether, this.aim, new THREE.Vector3(c.x, c.y + 3.8, c.z));
    this.obj.add(this.tether);
    world.boxes.push({ minX: x - 0.75, maxX: x + 0.75, minZ: z - 0.75, maxZ: z + 0.75, bottom: y, top: y + 2.1, solid: true, dx: 0, dy: 0, dz: 0 });
    world.addTarget(this);
    world.addInteractable(this);
  }

  private get live() {
    return this.boss.wantsGenerators && !this.down;
  }

  label() {
    return this.live ? 'HACK' : null;
  }

  interact() {
    this.world.hooks.hack(3, (ok) => {
      if (ok && this.live) this.knockOut();
    });
  }

  hit(dmg: number): boolean {
    if (!this.live) return false;
    this.hp -= dmg;
    this.light.emissiveIntensity = 5;
    audio.play('hit');
    if (this.hp <= 0) this.knockOut();
    return true;
  }

  private knockOut() {
    this.down = true;
    const a = this.aim;
    audio.play('explode');
    this.world.particles.emit(a.x, a.y, a.z, { count: 36, color: FIRE, speed: 8, life: 0.8, size: 0.7 });
    this.world.flash(a.x, a.y, a.z, FIRE, 50, 0.3);
    this.world.shake(0.25);
    this.boss.generatorDown();
  }

  /** Back online, ready to be knocked out again. */
  reboot() {
    this.down = false;
    this.hp = GEN_HP;
  }

  update(dt: number) {
    this.t += dt;
    this.aimable = this.live;
    const live = this.boss.powered && !this.down;
    this.tether.visible = live && Math.sin(this.t * 40) > -0.6;
    this.ring.rotation.z += dt * (live ? 3 : 0.3);
    const want = live ? 1.6 + Math.sin(this.t * 5) * 0.4 : 0.08;
    this.light.emissiveIntensity = damp(this.light.emissiveIntensity, want, 6, dt);
    this.light.color.set(live ? '#ffd0a0' : '#4a4044');
    this.glow.material.opacity = damp(this.glow.material.opacity, live ? 0.5 : 0, 6, dt);
    if (this.down && this.boss.wantsGenerators && Math.random() < 0.15) {
      this.world.particles.emit(this.aim.x, this.aim.y, this.aim.z, { count: 1, color: '#6a6066', speed: 1, up: 2, life: 1, size: 0.8, gravity: -0.5 });
    }
  }
}

type State = 'idle' | 'roar' | 'volley' | 'slam' | 'sweep' | 'claw' | 'punch' | 'stuck' | 'retract' | 'storm' | 'open';

/** Attack order in each phase (an idle pause follows every one). */
const CYCLE: Record<1 | 2 | 3, State[]> = {
  1: ['volley', 'slam', 'volley', 'slam'],
  2: ['claw', 'sweep', 'claw', 'volley', 'claw', 'slam'],
  // Every lava storm ends with the chest swinging open (see `storm`).
  3: ['storm', 'claw', 'sweep', 'storm', 'volley', 'claw'],
};

/**
 * THE COLOSSUS: General Brennus's war machine, four times as tall as Jason, with Celestia caged in its
 * chest and Brennus in the cockpit on top. Three phases, by health:
 * 1. SHIELD: an energy shield blocks everything; knock out its three generators (blast or hack) to drop
 *    it for a few seconds. It fires cannon volleys and stomps out shockwaves.
 * 2. ARMS: its arm sweeps a beam across the floor, and its rocket claw slams down where Jason stands,
 *    then sticks in the ground: hit the glowing wrist joint.
 * 3. OVERHEAT: lava-bomb storms and ash sporelings, and after every storm its chest cage opens and the
 *    power core can be hit. Everything gets a little faster.
 * With all 18 journal pages, Jason can TALK to Brennus instead.
 */
export class Colossus extends Boss implements Target, Interactable {
  readonly title = 'THE COLOSSUS';
  protected focusHeight = 7;
  readonly aim = new THREE.Vector3();
  radius = 1.3;
  aimable = false;
  readonly spot: THREE.Vector3;
  range = 10;
  calm = false;
  /** Set once Jason has talked Brennus round: the cutscene drives the power-down from then on. */
  private redeemed = false;
  private model = new THREE.Group();
  private armC = new THREE.Group();
  private armK = new THREE.Group();
  private cannonTip = new THREE.Object3D();
  private hand = new THREE.Object3D();
  private fist = new THREE.Group();
  private cable: THREE.Mesh;
  private doors: THREE.Group[] = [];
  private lights: THREE.MeshStandardMaterial;
  private joints: THREE.MeshStandardMaterial;
  private wrist: THREE.MeshStandardMaterial;
  private muzzle: THREE.MeshStandardMaterial;
  private core: THREE.MeshStandardMaterial;
  private gascu: THREE.MeshStandardMaterial;
  private petals: THREE.MeshStandardMaterial;
  private gascuGlow: THREE.Sprite;
  private shield: THREE.Mesh;
  private beams: THREE.Mesh[] = [];
  private warn: THREE.Group;
  private warnMat: THREE.MeshBasicMaterial;
  private gens: Generator[] = [];
  private minions: Enemy[] = [];
  private shieldUp = true;
  private downT = 0;
  private state: State = 'idle';
  private stateT = 2.5;
  private count = 0;
  private lastPhase: 1 | 2 | 3 = 1;
  private yaw = 0;
  private sweepA = 0;
  private sweepDir = 1;
  private sweepWarn = 0;
  private burst = 0;
  private waves = 0;
  private target = new THREE.Vector3();
  private fistOut = 0;
  private cageOpen = 0;
  private lean = 0;
  /** True once LUX has warned about the claw. */
  private told = false;
  private cx: number;
  private cz: number;
  private readonly t1: number;
  private readonly t2: number;

  constructor(world: World, id: string, cx: number, cz: number, h: number) {
    // The final boss of chapter 2 is a long fight.
    super(world, id, cx, cz, h, bossHp(world, 110));
    this.cx = cx;
    this.cz = cz;
    this.t1 = Math.round((this.maxHp * 2) / 3);
    this.t2 = Math.round(this.maxHp / 3);
    this.phaseMarks = [this.t1 / this.maxHp, this.t2 / this.maxHp];
    this.spot = this.center.clone();
    const c = this.center;

    const steel = mat('#4a4248', { metal: 0.65, rough: 0.35 });
    const dark = mat('#2a2428', { metal: 0.5, rough: 0.5 });
    const trim = mat('#8a2a30', { metal: 0.4, rough: 0.45 });
    const vine = mat('#3fae4a', { rough: 0.6 });
    this.lights = ownMat('#ff8080', { emissive: RED, ei: 1.6 });
    this.joints = ownMat('#ffb070', { emissive: FIRE, ei: 1.1 });
    this.wrist = ownMat('#ffd0a0', { emissive: FIRE, ei: 0.8 });
    this.muzzle = ownMat('#ffd0a0', { emissive: FIRE, ei: 0.4 });
    this.core = ownMat('#ffb070', { emissive: FIRE, ei: 0.5 });
    this.gascu = ownMat('#ffc6ef', { emissive: PINK, ei: 1.6, rough: 0.25 });
    this.petals = ownMat('#ff9ae0', { emissive: PINK, ei: 0.8, rough: 0.35 });
    const m = this.model;

    // Heavy legs planted in the crater.
    for (const sx of [-1, 1]) {
      m.add(mesh(boxG(1.6, 0.6, 2.3), dark, sx * 1.35, 0.3, 0.2));
      m.add(mesh(boxG(1.05, 1.6, 1.15), steel, sx * 1.35, 1.4, 0));
      m.add(mesh(sphere(0.55, 16), this.joints, sx * 1.35, 2.2, 0.2, false));
      m.add(mesh(boxG(1.15, 1.1, 1.25), steel, sx * 1.25, 2.85, 0));
    }
    m.add(mesh(boxG(3.5, 0.9, 2.1), dark, 0, 3.35, 0));
    // Brennus's red gear on the belt buckle.
    const gear = new THREE.Group();
    gear.add(mesh(cyl(0.45, 0.45, 0.14, 18), this.lights, 0, 0, 0, false).rotateX(Math.PI / 2));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      gear.add(mesh(boxG(0.2, 0.2, 0.14), this.lights, Math.cos(a) * 0.52, Math.sin(a) * 0.52, 0, false));
    }
    gear.add(mesh(cyl(0.16, 0.16, 0.18, 10), dark, 0, 0, 0.02, false).rotateX(Math.PI / 2));
    gear.position.set(0, 3.35, 1.1);
    m.add(gear);
    // The torso, with a glass cage in its chest.
    m.add(mesh(boxG(4.4, 2.9, 2.5), steel, 0, 5.15, -0.15));
    m.add(mesh(boxG(4.6, 0.3, 2.7), trim, 0, 6.65, -0.15));
    m.add(mesh(boxG(3.2, 0.14, 0.06), this.lights, 0, 6.25, 1.12, false));
    m.add(mesh(boxG(0.12, 2.4, 0.06), this.lights, -1.9, 5.1, 1.12, false));
    m.add(mesh(boxG(0.12, 2.4, 0.06), this.lights, 1.9, 5.1, 1.12, false));
    const cage = new THREE.Group();
    cage.position.set(0, 5.05, 1.15);
    const glass = new THREE.MeshStandardMaterial({ color: '#cfeaff', transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.2, depthWrite: false, side: THREE.DoubleSide });
    const bars = mat('#8a8088', { metal: 0.7, rough: 0.3 });
    cage.add(new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14, Math.PI, Math.PI), glass));
    for (const side of [0, 1]) {
      // Two quarter-shells make the front door; they swing round the back when the cage opens.
      const door = new THREE.Group();
      door.add(new THREE.Mesh(new THREE.SphereGeometry(1.01, 12, 14, side * (Math.PI / 2), Math.PI / 2), glass));
      for (const k of [0.33, 0.66]) {
        const bar = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.04, 6, 16, Math.PI), bars);
        bar.rotation.set(0, Math.PI / 2 - (side + k) * (Math.PI / 2), Math.PI / 2);
        door.add(bar);
      }
      cage.add(door);
      this.doors.push(door);
    }
    cage.add(mesh(torus(1.03, 0.05), bars, 0, 0, 0, false).rotateX(Math.PI / 2));
    cage.add(mesh(torus(1.25, 0.12), this.core, 0, 0, -0.1, false));
    // Celestia inside: a glowing pink bud with petals, wrapped in Brennus's vines.
    cage.add(mesh(sphere(0.4, 18), this.gascu, 0, 0, 0, false));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const petal = mesh(sphere(0.24, 12), this.petals, Math.cos(a) * 0.42, Math.sin(a) * 0.42, 0.05, false);
      petal.scale.set(1, 0.45, 1.5);
      petal.rotation.z = a;
      cage.add(petal);
    }
    this.gascuGlow = glowSprite(PINK, 3.4, 0.55);
    cage.add(this.gascuGlow);
    for (let i = 0; i < 3; i++) {
      const v = mesh(torus(1.08 + i * 0.07, 0.06), vine, 0, 0, 0, false);
      v.rotation.set(0.6 + i * 0.9, i * 0.7, 0.3 * i);
      cage.add(v);
    }
    m.add(cage);
    // Shoulders, exhaust stacks and the cockpit dome with Brennus inside.
    for (const sx of [-1, 1]) {
      m.add(mesh(sphere(0.85, 18), steel, sx * 2.55, 6.0, 0));
      m.add(mesh(boxG(1.5, 0.5, 1.7), trim, sx * 2.6, 6.8, 0));
      m.add(mesh(cyl(0.3, 0.36, 1.8, 10), dark, sx * 1.25, 7.0, -1.15));
      m.add(mesh(cyl(0.32, 0.32, 0.12, 10), this.lights, sx * 1.25, 7.92, -1.15, false));
    }
    m.add(mesh(boxG(1.3, 0.4, 1.1), dark, 0, 6.95, 0.05));
    const uniform = mat('#3e4a2e', { rough: 0.7 });
    m.add(mesh(boxG(0.75, 0.45, 0.45), uniform, 0, 7.35, 0.1));
    m.add(mesh(sphere(0.3, 16), mat('#f0c8a0', { rough: 0.6 }), 0, 7.8, 0.15));
    m.add(mesh(boxG(0.34, 0.07, 0.07), mat('#f4f0ea'), 0, 7.72, 0.44, false));
    m.add(mesh(cyl(0.32, 0.32, 0.14, 14), uniform, 0, 8.05, 0.15, false));
    m.add(mesh(boxG(0.44, 0.05, 0.22), mat('#2a2a20'), 0, 8.0, 0.42, false));
    m.add(mesh(sphere(0.07, 8), this.lights, 0, 8.07, 0.47, false));
    m.add(new THREE.Mesh(new THREE.SphereGeometry(0.95, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), glass).translateY(7.15).translateZ(0.1));
    // The cannon arm (its left, on +x) and the claw arm (on -x), hanging from the shoulders.
    this.armC.position.set(2.55, 6.0, 0);
    this.armK.position.set(-2.55, 6.0, 0);
    for (const arm of [this.armC, this.armK]) {
      arm.add(mesh(capsule(0.42, 1.3), steel, 0, -1.0, 0));
      arm.add(mesh(sphere(0.5, 14), this.joints, 0, -1.95, 0, false));
      arm.add(mesh(torus(0.5, 0.07), vine, 0, -0.8, 0, false).rotateX(Math.PI / 2 - 0.3));
      m.add(arm);
    }
    this.armC.add(mesh(cyl(0.5, 0.56, 1.6, 12), steel, 0, -2.9, 0));
    this.armC.add(mesh(cyl(0.34, 0.4, 1.1, 12), dark, 0, -4.0, 0));
    this.armC.add(mesh(torus(0.36, 0.09), this.muzzle, 0, -4.55, 0, false).rotateX(Math.PI / 2));
    this.cannonTip.position.set(0, -4.7, 0);
    this.armC.add(this.cannonTip);
    this.armK.add(mesh(cyl(0.5, 0.6, 1.4, 12), steel, 0, -2.8, 0));
    this.armK.add(mesh(cyl(0.45, 0.45, 0.4, 12), dark, 0, -3.65, 0));
    this.hand.position.set(0, -4.4, 0);
    this.armK.add(this.hand);
    m.add(blobShadow(7));
    m.position.copy(c);
    this.obj.add(m);

    // The rocket claw lives in world space so it can fly off the arm.
    this.fist.add(mesh(sphere(0.8, 16), steel, 0, 0, 0));
    this.fist.add(mesh(torus(0.55, 0.1), this.wrist, 0, 0.62, 0, false).rotateX(Math.PI / 2));
    this.fist.add(mesh(sphere(0.3, 12), this.wrist, 0, 0.75, 0, false));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const claw = mesh(cone(0.2, 1, 6), dark, Math.cos(a) * 0.5, -0.75, Math.sin(a) * 0.5);
      claw.rotation.set(Math.PI + Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
      this.fist.add(claw);
    }
    this.obj.add(this.fist);
    this.cable = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1, 6), dark);
    this.cable.visible = false;
    this.obj.add(this.cable);

    // The energy shield (phase 1).
    this.shield = new THREE.Mesh(
      new THREE.SphereGeometry(4.6, 28, 20),
      new THREE.MeshStandardMaterial({ color: '#ffb070', emissive: FIRE, emissiveIntensity: 0.7, transparent: true, opacity: 0.22, depthWrite: false }),
    );
    this.shield.position.set(c.x, h + 3.8, c.z);
    this.obj.add(this.shield);
    // The floor beams of the arm sweeps.
    const len = SWEEP_LEN - SWEEP_IN;
    const bgeo = new THREE.CylinderGeometry(0.16, 0.16, len, 8).rotateZ(Math.PI / 2).translate(SWEEP_IN + len / 2, 0, 0);
    const hgeo = new THREE.CylinderGeometry(0.42, 0.42, len, 8).rotateZ(Math.PI / 2).translate(SWEEP_IN + len / 2, 0, 0);
    for (let i = 0; i < 2; i++) {
      const b = new THREE.Mesh(bgeo, new THREE.MeshBasicMaterial({ color: '#ff5a1a', transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false }));
      b.add(new THREE.Mesh(hgeo, new THREE.MeshBasicMaterial({ color: FIRE, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));
      b.position.set(c.x, h + 0.45, c.z);
      b.visible = false;
      this.obj.add(b);
      this.beams.push(b);
    }
    // The red circle where the claw is about to land.
    this.warn = new THREE.Group();
    this.warnMat = new THREE.MeshBasicMaterial({ color: RED, transparent: true, opacity: 0.35, depthWrite: false });
    this.warn.add(new THREE.Mesh(new THREE.CircleGeometry(1.9, 32).rotateX(-Math.PI / 2), this.warnMat));
    this.warn.add(new THREE.Mesh(new THREE.RingGeometry(1.8, 2, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd0a0', transparent: true, opacity: 0.8, depthWrite: false })));
    this.warn.visible = false;
    this.obj.add(this.warn);

    // Three shield generators round the crater: behind it, and to either side in front.
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 3;
      this.gens.push(world.addEntity(new Generator(world, `${id}.gen${i}`, c.x + Math.cos(a) * 10, h, c.z + Math.sin(a) * 10, this)));
    }
    const box: Box = { minX: c.x - 1.9, maxX: c.x + 1.9, minZ: c.z - 1.9, maxZ: c.z + 1.9, bottom: h, top: h + 6.4, solid: true, dx: 0, dy: 0, dz: 0 };
    world.boxes.push(box);
    world.addTarget(this);
    world.addInteractable(this);
    this.placeFist(1);
  }

  /* ---------------- phases ---------------- */

  private get phase(): 1 | 2 | 3 {
    return this.hp > this.t1 ? 1 : this.hp > this.t2 ? 2 : 3;
  }

  /** True while the generators matter: the fight is on, in phase 1, with the shield up. */
  get wantsGenerators() {
    return this.started && this.powered;
  }

  /** True while the shield (and so the generators) is powered. */
  get powered() {
    return !this.defeated && !this.calm && this.phase === 1 && this.shieldUp;
  }

  generatorDown() {
    const left = this.gens.filter((g) => !g.down).length;
    if (left > 0) {
      this.world.hooks.toast(tr('Generator down! {n} to go.', { n: left }), 'bolt');
      return;
    }
    this.shieldUp = false;
    this.downT = SHIELD_DOWN;
    this.state = 'idle';
    this.stateT = 1;
    this.hideBeams();
    audio.play('explode');
    haptic('heavy');
    this.world.shake(0.5);
    this.world.flash(this.center.x, this.center.y + 4, this.center.z, FIRE, 80, 0.5);
    this.world.hooks.toast('The shield is down! BLAST the Colossus!', 'bolt');
  }

  private enterPhase(ph: 2 | 3) {
    this.state = 'roar';
    this.stateT = 2.4;
    this.hideBeams();
    this.warn.visible = false;
    this.fistOut = 0;
    audio.play('roar');
    haptic('heavy');
    this.world.shake(0.8);
    const c = this.center;
    this.world.rings.burst(c.x, c.y, c.z, 9, FIRE, 0.7);
    if (ph === 2) {
      this.shieldUp = false;
      for (const g of this.gens) g.down = true;
      this.world.hooks.toast('The shield is gone for good! Now watch out for its giant arms!', 'bolt');
    } else {
      this.world.hooks.toast('It’s overheating! When its chest opens, BLAST the glowing core!', 'bolt');
    }
  }

  /* ---------------- talking Brennus down ---------------- */

  private get pages() {
    return inChapter(this.world.save.shards, 2);
  }

  /** Jason can talk while the fight is on, if he has read every page of Brennus's journal. */
  private get canTalk() {
    return this.started && !this.defeated && !this.calm && this.pages >= ALL_PAGES;
  }

  label() {
    return this.canTalk ? 'TALK' : null;
  }

  interact() {
    if (!this.canTalk) return;
    this.calm = true;
    this.state = 'idle';
    this.stateT = 2;
    this.hideBeams();
    this.warn.visible = false;
    this.world.hooks.say(this.world.dialogue('talk'), () => {
      this.world.hooks.hack(
        5,
        (ok) => {
          if (!ok) {
            this.calm = false;
            this.world.hooks.toast('He is not ready to listen yet... try again!', 'bolt');
            return;
          }
          this.redeemed = true;
          this.clearMinions();
          this.defeated = true;
          this.world.hooks.bossBar(null, 0);
          this.world.communed();
        },
        'pattern',
      );
    });
  }

  /** The secret ending: the machine powers down, its arms drop, the cage opens and Celestia glows gold. */
  surrender(k: number) {
    this.calm = true;
    this.redeemed = true;
    this.lights.emissiveIntensity = lerp(1.6, 0.04, k);
    this.joints.emissiveIntensity = lerp(1.1, 0, k);
    this.muzzle.emissiveIntensity = lerp(0.4, 0, k);
    this.core.emissiveIntensity = lerp(0.5, 0, k);
    this.wrist.emissiveIntensity = lerp(0.8, 0, k);
    this.setCage(k);
    this.setGlow(k);
    this.armC.rotation.set(0.35 * k, 0, 0.12 * (1 - k));
    this.armK.rotation.set(0.35 * k, 0, -0.12 * (1 - k));
    this.model.position.y = this.center.y - 0.35 * k;
    this.model.rotation.x = 0.08 * k;
    this.shield.visible = false;
    this.hideBeams();
    this.warn.visible = false;
    this.fistOut = 0;
    this.placeFist(1);
  }

  /* ---------------- taking hits ---------------- */

  private get vulnerable() {
    if (this.state === 'stuck') return true;
    const ph = this.phase;
    return (ph === 1 && !this.shieldUp) || (ph === 3 && this.state === 'open');
  }

  hit(dmg: number, kind: HitKind): boolean {
    if (!this.started || this.calm || this.defeated) return true;
    if (!this.vulnerable) {
      audio.play(this.phase === 1 && this.shieldUp ? 'shield' : 'zap', 1.4);
      return true;
    }
    // A phase can't be skipped: the health bar stops at the next third until the new phase begins.
    const floor = this.phase === 1 ? this.t1 : this.phase === 2 ? this.t2 : 0;
    const n = Math.min(kind === 'blast' ? Math.round(dmg * 1.5) : dmg, this.hp - floor);
    if (n > 0) this.damage(n);
    if (this.state === 'stuck') this.wrist.emissiveIntensity = 5;
    else this.core.emissiveIntensity = 5;
    audio.play('hit');
    return true;
  }

  protected finish() {
    this.clearMinions();
    this.hideBeams();
    this.warn.visible = false;
    super.finish();
  }

  reset() {
    this.hp = this.maxHp;
    this.lastPhase = 1;
    this.shieldUp = true;
    this.downT = 0;
    for (const g of this.gens) g.reboot();
    this.state = 'idle';
    this.stateT = 2.5;
    this.count = 0;
    this.calm = false;
    this.hideBeams();
    this.warn.visible = false;
    this.fistOut = 0;
    this.lean = 0;
    this.model.rotation.x = 0;
    this.armC.rotation.set(0, 0, 0.12);
    this.armK.rotation.set(0, 0, -0.12);
    this.setCage(0);
    this.clearMinions();
  }

  protected onStart() {
    this.state = 'idle';
    this.stateT = 2.5;
    this.world.hooks.toast('Knock out the three shield generators! BLAST them, or walk up and HACK them.', 'bolt');
  }

  private clearMinions() {
    for (const e of this.minions) if (e.alive) e.remove();
    this.minions = [];
  }

  private hideBeams() {
    for (const b of this.beams) b.visible = false;
  }

  /* ---------------- looks ---------------- */

  private setCage(k: number) {
    this.cageOpen = k;
    this.doors[0].rotation.y = -k * 1.5;
    this.doors[1].rotation.y = k * 1.5;
  }

  /** Celestia's glow, from frightened pink (0) to happy gold (1). */
  private setGlow(k: number) {
    this.gascu.color.set('#ffc6ef').lerp(new THREE.Color('#fff0b0'), k);
    this.gascu.emissive.set(PINK).lerp(new THREE.Color(GOLD), k);
    this.petals.color.set('#ff9ae0').lerp(new THREE.Color('#ffe08a'), k);
    this.petals.emissive.set(PINK).lerp(new THREE.Color(GOLD), k);
    this.gascuGlow.material.color.set(PINK).lerp(new THREE.Color('#ffd166'), k);
  }

  /** Puts the claw on its arm (k = 1 ... 0 means flying out toward `target`). */
  private placeFist(attached: number) {
    this.model.updateMatrixWorld(true);
    this.hand.getWorldPosition(tmp);
    if (attached >= 1) {
      this.fist.position.copy(tmp);
      this.hand.getWorldQuaternion(this.fist.quaternion);
      this.cable.visible = false;
      return;
    }
    const k = 1 - attached;
    this.fist.position.lerpVectors(tmp, this.target, k);
    this.fist.position.y += Math.sin(Math.PI * k) * 2.5 + 0.8 * k;
    this.fist.rotation.set(0, this.yaw, 0);
    span(this.cable, tmp, this.fist.position);
    this.cable.visible = true;
  }

  private pose(arm: THREE.Group, x: number, z: number, dt: number, speed = 5) {
    arm.rotation.x = damp(arm.rotation.x, x, speed, dt);
    arm.rotation.z = damp(arm.rotation.z, z, speed, dt);
  }

  /* ---------------- the fight ---------------- */

  update(dt: number) {
    this.t += dt;
    const c = this.center;
    const p = this.player.body;
    // Ambient life: Celestia flickers in its cage, the shield shimmers.
    this.gascu.emissiveIntensity = 1.4 + Math.sin(this.t * 3) * 0.4;
    this.shield.visible = this.powered;
    (this.shield.material as THREE.MeshStandardMaterial).opacity = 0.18 + Math.sin(this.t * 3) * 0.05;
    this.shield.rotation.y += dt * 0.3;

    if (!this.started) {
      this.model.position.y = c.y + Math.sin(this.t * 1.2) * 0.05;
      this.placeFist(1);
      if (this.playerDist() < 17) this.begin();
      return;
    }
    if (this.defeated) {
      this.hideBeams();
      this.warn.visible = false;
      if (this.redeemed) return;
      // Beaten: the machine sags to its knees, the lights die and the cage swings open.
      this.model.position.y = damp(this.model.position.y, c.y - 0.9, 1.2, dt);
      this.model.rotation.x = damp(this.model.rotation.x, 0.18, 1.2, dt);
      this.pose(this.armC, 0.4, 0.05, dt, 2);
      this.pose(this.armK, 0.4, -0.05, dt, 2);
      this.lights.emissiveIntensity = damp(this.lights.emissiveIntensity, 0.05, 2, dt);
      this.joints.emissiveIntensity = damp(this.joints.emissiveIntensity, 0, 2, dt);
      this.setCage(damp(this.cageOpen, 1, 2, dt));
      this.fistOut = damp(this.fistOut, 0, 4, dt);
      this.placeFist(1 - this.fistOut);
      return;
    }
    if (this.calm) {
      // Listening: arms down, no attacks.
      this.pose(this.armC, 0.1, 0.12, dt, 3);
      this.pose(this.armK, 0.1, -0.12, dt, 3);
      this.fistOut = 0;
      this.placeFist(1);
      return;
    }

    const ph = this.phase;
    if (ph !== this.lastPhase) {
      this.lastPhase = ph;
      if (ph > 1) this.enterPhase(ph as 2 | 3);
    }
    const pace = ph === 3 ? 0.85 : 1;
    if (ph === 1 && !this.shieldUp) {
      this.downT -= dt;
      if (this.downT <= 0) {
        this.shieldUp = true;
        for (const g of this.gens) g.reboot();
        audio.play('shield');
        this.state = 'idle';
        this.stateT = 1.4;
        this.world.hooks.toast('The shield is back up! Knock out the generators again!', 'bolt');
      }
    }
    const stunned = ph === 1 && !this.shieldUp;

    // Turn to face Jason (except while sweeping, when the beam steers).
    if (this.state !== 'sweep') {
      this.yaw = dampAngle(this.yaw, Math.atan2(p.x - c.x, p.z - c.z), this.state === 'stuck' ? 0.8 : 1.6, dt);
      this.model.rotation.y = this.yaw;
    }
    let armCx = Math.sin(this.t * 1.1) * 0.06;
    let armCz = 0.12;
    let armKx = -Math.sin(this.t * 1.1) * 0.06;
    let armKz = -0.12;
    let lean = stunned ? 0.12 : 0;
    let open = this.state === 'open' ? 1 : 0;

    this.stateT -= dt;
    const was = this.stateT + dt;
    const at = (s: number) => this.stateT <= s && was > s;
    switch (this.state) {
      case 'idle':
        if (!stunned && this.stateT <= 0) this.next(ph, pace);
        break;
      case 'roar':
        lean = -0.1;
        if (ph === 3 && Math.random() < 0.6) this.vent();
        if (this.stateT <= 0) this.rest(0.8);
        break;
      case 'volley': {
        armCx = -1.35;
        armCz = 0.05;
        this.muzzle.emissiveIntensity = damp(this.muzzle.emissiveIntensity, 3, 3, dt);
        const shots = ph === 3 ? 4 : 3;
        if (this.burst < shots && this.stateT <= 1.2 - this.burst * 0.32) {
          this.burst += 1;
          this.fire(ph);
        }
        if (this.stateT <= 0) this.rest(1.5 * pace);
        break;
      }
      case 'slam':
        lean = this.stateT > 1.1 ? -0.14 : 0.05;
        if (at(1.1)) this.stomp(ph);
        if (ph >= 2 && at(0.3)) this.stomp(ph);
        if (this.stateT <= 0) this.rest(1.4 * pace);
        break;
      case 'sweep': {
        armCz = 1.3;
        armCx = 0;
        if (ph === 3) {
          armKz = -1.3;
          armKx = 0;
        }
        this.sweepWarn -= dt;
        const live = this.sweepWarn <= 0;
        if (live) this.sweepA += dt * (ph === 3 ? 1.35 : 1.15) * this.sweepDir;
        this.model.rotation.y = dampAngle(this.model.rotation.y, -this.sweepA, 10, dt);
        this.yaw = this.model.rotation.y;
        this.beams.forEach((b, i) => {
          b.visible = i === 0 || ph === 3;
          const mt = b.material as THREE.MeshBasicMaterial;
          mt.opacity = live ? 0.95 : 0.2 + Math.max(0, Math.sin(this.t * 30)) * 0.4;
          const a = this.sweepA + i * Math.PI;
          b.rotation.y = -a;
          if (!live || !b.visible) return;
          const ux = Math.cos(a);
          const uz = Math.sin(a);
          const along = (p.x - c.x) * ux + (p.z - c.z) * uz;
          const perp = Math.abs((p.x - c.x) * uz - (p.z - c.z) * ux);
          if (along > SWEEP_IN && along < SWEEP_LEN && perp < 0.4 + p.r && p.y < c.y + 0.8) this.player.hurt(1, c.x, c.z);
        });
        if (this.stateT <= 0) {
          this.hideBeams();
          this.rest(1.2 * pace);
        }
        break;
      }
      case 'claw':
        armKx = -1.5;
        armKz = -0.05;
        if (this.stateT > 0.55) this.target.set(damp(this.target.x, p.x, 6, dt), c.y, damp(this.target.z, p.z, 6, dt));
        this.warn.visible = true;
        this.warn.position.set(this.target.x, c.y + 0.05, this.target.z);
        this.warn.scale.setScalar(0.6 + 0.4 * Math.min(1, 1.3 - this.stateT));
        this.warnMat.opacity = 0.25 + (this.stateT < 0.5 ? Math.abs(Math.sin(this.t * 25)) * 0.35 : 0.15);
        if (this.stateT <= 0) {
          this.state = 'punch';
          this.stateT = 0.3;
          audio.play('dash', 0.6);
        }
        break;
      case 'punch':
        armKx = -1.5;
        this.fistOut = 1 - Math.max(0, this.stateT) / 0.3;
        if (this.stateT <= 0) this.smash(ph);
        break;
      case 'stuck':
        armKx = -1.5;
        this.wrist.emissiveIntensity = damp(this.wrist.emissiveIntensity, 2 + Math.sin(this.t * 10) * 0.8, 8, dt);
        if (Math.random() < 0.2) this.world.particles.emit(this.fist.position.x, this.fist.position.y + 0.8, this.fist.position.z, { count: 1, color: FIRE, speed: 1.5, up: 1, life: 0.5, size: 0.5, gravity: 0 });
        if (this.stateT <= 0) {
          this.state = 'retract';
          this.stateT = 0.5;
        }
        break;
      case 'retract':
        armKx = -1.5;
        this.fistOut = Math.max(0, this.stateT) / 0.5;
        if (this.stateT <= 0) {
          this.fistOut = 0;
          this.rest(1.1 * pace);
        }
        break;
      case 'storm':
        lean = -0.08;
        if (Math.random() < 0.7) this.vent();
        if (at(1.9)) this.lavaBombs();
        if (this.stateT <= 0) {
          // Every lava storm ends with the chest swinging open.
          this.state = 'open';
          this.stateT = 3.4 * pace;
          audio.play('vent', 0.7);
          this.world.hooks.toast('Its chest is open! BLAST the glowing core!', 'bolt');
        }
        break;
      case 'open':
        open = 1;
        if (Math.random() < 0.3) this.world.particles.emit(this.aim.x, this.aim.y, this.aim.z, { count: 1, color: '#ffd166', speed: 1.5, life: 0.5, size: 0.5, gravity: 0 });
        if (this.stateT <= 0) this.rest(1 * pace);
        break;
    }
    if (this.state !== 'volley') this.muzzle.emissiveIntensity = damp(this.muzzle.emissiveIntensity, 0.4, 4, dt);
    if (this.state !== 'claw' && this.state !== 'punch') this.warn.visible = false;
    if (this.state !== 'stuck') this.wrist.emissiveIntensity = damp(this.wrist.emissiveIntensity, 0.8, 4, dt);
    this.core.emissiveIntensity = damp(this.core.emissiveIntensity, open ? 2.5 + Math.sin(this.t * 12) * 0.6 : ph === 3 ? 1 : 0.5, 6, dt);
    this.lights.emissiveIntensity = stunned ? 0.3 + Math.abs(Math.sin(this.t * 9)) * 1.2 : 1.6;
    this.setCage(damp(this.cageOpen, open, 6, dt));
    this.pose(this.armC, armCx, armCz, dt);
    this.pose(this.armK, armKx, armKz, dt);
    this.lean = damp(this.lean, lean, 5, dt);
    this.model.rotation.x = this.lean;
    this.model.position.y = damp(this.model.position.y, c.y + (this.state === 'slam' && this.stateT > 1.1 ? 0.5 : 0) - (stunned ? 0.3 : 0), 8, dt);
    if (stunned && Math.random() < 0.25) {
      this.world.particles.emit(c.x + (Math.random() - 0.5) * 4, c.y + 3 + Math.random() * 3, c.z + (Math.random() - 0.5) * 3, { count: 2, color: '#ffd166', speed: 4, life: 0.4, size: 0.4 });
    }
    this.placeFist(1 - this.fistOut);

    // Aim: the wrist joint while the claw is stuck, otherwise the chest.
    if (this.state === 'stuck') {
      this.aim.set(this.fist.position.x, this.fist.position.y + 0.75, this.fist.position.z);
    } else {
      this.aim.set(c.x + Math.sin(this.yaw) * 1.6, this.model.position.y + 5.05, c.z + Math.cos(this.yaw) * 1.6);
    }
    this.aimable = this.vulnerable;
    // Its giant feet hurt to bump into.
    if (Math.hypot(p.x - c.x, p.z - c.z) < 2.5 && p.y < c.y + 3) this.player.hurt(1, c.x, c.z);
  }

  private rest(t: number) {
    this.state = 'idle';
    this.stateT = t;
  }

  /** Starts the next attack of this phase's cycle. */
  private next(ph: 1 | 2 | 3, pace: number) {
    this.count += 1;
    const cycle = CYCLE[ph];
    this.state = cycle[this.count % cycle.length];
    this.burst = 0;
    this.waves = 0;
    const c = this.center;
    const p = this.player.body;
    switch (this.state) {
      case 'volley':
        this.stateT = 2 * pace;
        audio.play('charge', 0.6);
        break;
      case 'slam':
        this.stateT = 1.8;
        audio.play('roar', 1.3);
        break;
      case 'sweep':
        this.sweepWarn = 1.1;
        this.sweepDir = this.count % 2 ? 1 : -1;
        this.sweepA = Math.atan2(p.z - c.z, p.x - c.x) + Math.PI / 2 * -this.sweepDir;
        this.stateT = this.sweepWarn + (ph === 3 ? 3.6 : 5);
        this.world.hooks.toast('Its arm is sweeping the floor! JUMP over the beam!', 'bolt');
        break;
      case 'claw':
        this.stateT = 1.3 * pace;
        this.target.set(p.x, c.y, p.z);
        audio.play('alarm', 1.2);
        if (!this.told) this.world.hooks.toast('Its claw is coming! Get out of the red circle!', 'bolt');
        this.told = true;
        break;
      case 'storm':
        this.stateT = 2.6 * pace;
        audio.play('roar');
        this.world.hooks.toast('Lava bombs! Keep moving!', 'bolt');
        break;
      default:
        this.stateT = 1;
    }
  }

  /** A burst of cannon fire at Jason. */
  private fire(ph: number) {
    this.model.updateMatrixWorld(true);
    const from = this.cannonTip.getWorldPosition(new THREE.Vector3());
    const p = this.player.body;
    const dir = new THREE.Vector3(p.x - from.x, p.y + 0.9 - from.y, p.z - from.z).normalize();
    const spread = ph === 3 ? [-0.36, -0.12, 0.12, 0.36] : [-0.25, 0, 0.25];
    for (const a of spread) this.world.shots.fire('enemy', from.clone(), dir.clone().applyAxisAngle(UP, a), 10 + ph, 1);
    audio.play('enemyShoot', 0.7);
    this.world.particles.emit(from.x, from.y, from.z, { count: 10, color: FIRE, speed: 4, life: 0.3, size: 0.6 });
  }

  /** A giant stomp: a ring of fire races across the floor. Hop over it! */
  private stomp(ph: number) {
    const c = this.center;
    this.waves += 1;
    this.world.addEntity(new Shockwave(this.world, c.x, c.y, c.z, 22, 7.5 + ph * 0.8, FIRE));
    audio.play('pound');
    haptic('medium');
    this.world.shake(0.45);
    this.world.particles.emit(c.x, c.y + 0.3, c.z, { count: 30, color: '#6a4a40', speed: 7, up: 2, life: 0.7, size: 0.9 });
  }

  /** The claw lands: it hurts if Jason is still in the circle, then it sticks in the ground. */
  private smash(ph: number) {
    const w = this.world;
    const tgt = this.target;
    const p = this.player.body;
    this.fistOut = 1;
    this.warn.visible = false;
    if (Math.hypot(p.x - tgt.x, p.z - tgt.z) < 1.9 + p.r && p.y < tgt.y + 1.6) this.player.hurt(1, tgt.x, tgt.z);
    audio.play('explode');
    haptic('heavy');
    w.shake(0.55);
    w.hitStop(0.05);
    w.particles.emit(tgt.x, tgt.y + 0.3, tgt.z, { count: 34, color: FIRE, speed: 8, up: 3, life: 0.7, size: 0.8 });
    w.rings.burst(tgt.x, tgt.y, tgt.z, 3.5, FIRE, 0.5);
    if (ph === 3) w.addEntity(new Shockwave(w, tgt.x, tgt.y, tgt.z, 7, 8, FIRE));
    this.state = 'stuck';
    this.stateT = ph === 3 ? 2.8 : 3.3;
    w.hooks.toast('The claw is stuck! Hit its glowing joint!', 'bolt');
  }

  /** Lava bombs rain all around Jason, and a couple of ash sporelings crawl out of the vents. */
  private lavaBombs() {
    const c = this.center;
    const p = this.player.body;
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = i === 0 ? 0 : 2 + Math.random() * 4.5;
      this.world.addEntity(new Strike(this.world, p.x + Math.cos(a) * r, c.y, p.z + Math.sin(a) * r, 1.1 + i * 0.07, 1.25, FIRE, 'rock'));
    }
    this.minions = this.minions.filter((e) => e.alive);
    if (this.minions.length < 4) {
      for (const s of [-1, 1]) this.minions.push(this.world.spawnEnemy('sporeling', this.cx + s * 4, this.cz + 4, 'ash'));
    }
  }

  /** Lava smoke from the exhaust stacks. */
  private vent() {
    const c = this.center;
    const s = Math.random() < 0.5 ? -1 : 1;
    const a = this.model.rotation.y;
    const lx = s * 1.25;
    const lz = -1.15;
    const x = c.x + lx * Math.cos(a) + lz * Math.sin(a);
    const z = c.z - lx * Math.sin(a) + lz * Math.cos(a);
    this.world.particles.emit(x, this.model.position.y + 8, z, { count: 2, color: Math.random() < 0.5 ? FIRE : '#4a3a38', speed: 1.5, up: 6, life: 0.9, size: 1.1, gravity: -1 });
  }
}
