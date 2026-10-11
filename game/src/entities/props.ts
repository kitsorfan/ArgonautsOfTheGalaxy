import * as THREE from 'three';

import { audio } from '../core/audio';
import { haptic } from '../core/bridge';
import { CELL, PLAYER } from '../core/constants';
import { tr } from '../core/i18n';
import { damp, dampAngle } from '../core/math';
import type { PuzzleKind } from '../game/puzzles';
import type { World } from '../game/world';
import { chapterOf } from '../levels';
import type { Cond, HoloSpeaker, Spec } from '../world/levelTypes';
import type { Box } from '../world/physics';
import { stripeTexture } from '../world/textures';
import { Entity, type HitKind, type Interactable, type Target } from './entity';
import { boxG, cyl, glowSprite, makeBolt, makeColonist, mat, mesh, ownMat, sphere, torus, type BoltModel } from './models';
import { makeIris } from './companionModels';
import { holoMaterial, holoUniforms, makeHoloFigure, makeHoloProjector, type HoloFigure, type HoloProjector, type HoloUniforms } from './holoModels';
import { makeHauler, makeOreCart, railSegment } from './mineModels';
import type { CompanionSkin } from '../game/companions';
import type { Player } from './player';

export interface FloorFx {
  stand?(p: Player, dt: number): void;
  land?(p: Player): void;
  unsafe?: boolean;
}

/** Hazards that LUX's force pulse can short out. Returns true if it was in range. */
export interface Overloadable {
  overload(at: THREE.Vector3, radius: number, seconds: number): boolean;
}

/** Sparks and a stuttering flicker while an overloaded emitter is dead. */
function overloadSparks(world: World, x: number, y: number, z: number) {
  if (Math.random() < 0.12) world.particles.emit(x, y, z, { count: 2, color: '#bff4ff', speed: 3, up: 2, life: 0.3, size: 0.3 });
}

const cx2x = (c: number) => c * CELL + CELL / 2;

function hashId(id: string) {
  let h = 7;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 100003;
  return h / 100003;
}

function makeBox(x: number, z: number, hw: number, hd: number, bottom: number, top: number, owner?: unknown): Box {
  return { minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd, bottom, top, solid: true, dx: 0, dy: 0, dz: 0, owner };
}

/**
 * How high a door's (or cracked wall's) collider reaches above its floor. Walls are infinitely tall,
 * so anything that plugs a gap in them must be too: otherwise a double jump or an air dash carries
 * Jason straight over the top of a closed door.
 */
const PLUG_H = 60;

/* ---------------- crates ---------------- */

export class Crate extends Entity implements Target {
  readonly aim: THREE.Vector3;
  radius = 0.95;
  aimable = false;
  private box: Box;

  constructor(
    world: World,
    id: string,
    cx: number,
    cz: number,
    h: number,
    private loot: 'bolts' | 'heart' | 'big' = 'bolts',
    private metal = false,
  ) {
    super(world, id);
    const x = cx2x(cx);
    const z = cx2x(cz);
    const S = 1.4;
    const body = metal ? mat('#5b6272', { metal: 0.7, rough: 0.35 }) : mat('#c98a4a', { rough: 0.7 });
    const frame = metal ? new THREE.MeshStandardMaterial({ map: stripeTexture('#ffd166', '#2a2f3a'), roughness: 0.5 }) : mat('#8a5a2c', { rough: 0.8 });
    const g = new THREE.Group();
    g.add(mesh(boxG(S, S, S), frame));
    g.add(mesh(boxG(S * 0.8, S * 1.01, S * 0.8), body, 0, 0, 0));
    g.add(mesh(boxG(S * 1.01, S * 0.8, S * 0.8), body));
    g.add(mesh(boxG(S * 0.8, S * 0.8, S * 1.01), body));
    if (!metal) g.add(mesh(boxG(0.5, 0.5, S * 1.02), mat('#ffd166', { emissive: '#ffb020', ei: 0.4 })));
    g.position.set(x, h + S / 2, z);
    this.obj.add(g);
    this.box = makeBox(x, z, S / 2, S / 2, h, h + S, this);
    world.boxes.push(this.box);
    world.addTarget(this);
    this.aim = new THREE.Vector3(x, h + 0.7, z);
  }

  hit(_dmg: number, kind: HitKind): boolean {
    if (!this.alive) return false;
    if (this.metal && kind !== 'pound' && kind !== 'blast' && kind !== 'dash' && kind !== 'pulse') {
      audio.play('zap', 2);
      return true;
    }
    this.smash();
    return true;
  }

  private smash() {
    const w = this.world;
    audio.play('break');
    haptic('light');
    w.particles.emit(this.aim.x, this.aim.y, this.aim.z, { count: 20, color: this.metal ? '#aab4c4' : '#e0a060', speed: 7, life: 0.7, size: 0.5, up: 3 });
    w.boxes.splice(w.boxes.indexOf(this.box), 1);
    w.removeTarget(this);
    if (this.loot === 'heart') w.dropHeart(this.aim);
    w.dropBolts(this.aim, this.loot === 'big' ? 14 : 4);
    w.markTaken(this.id);
    this.remove();
  }
}

/* ---------------- checkpoints ---------------- */

export class Checkpoint extends Entity {
  active = false;
  readonly spot: THREE.Vector3;
  private ring: THREE.Mesh;
  private ringMat: THREE.MeshStandardMaterial;
  private beam: THREE.Sprite;
  private t = 0;

  constructor(world: World, id: string, cx: number, cz: number, h: number) {
    super(world, id);
    const x = cx2x(cx);
    const z = cx2x(cz);
    this.spot = new THREE.Vector3(x, h, z);
    const base = mat('#3a4458', { metal: 0.5, rough: 0.4 });
    this.obj.add(mesh(cyl(0.9, 1, 0.25, 24), base, x, h + 0.12, z));
    this.ringMat = ownMat('#8a93a6', { emissive: '#8a93a6', ei: 0.3 });
    this.ring = mesh(torus(0.75, 0.08), this.ringMat, x, h + 0.3, z, false);
    this.ring.rotation.x = Math.PI / 2;
    this.obj.add(this.ring);
    this.obj.add(mesh(cyl(0.12, 0.16, 2.2, 10), base, x - 0.85, h + 1.1, z), mesh(cyl(0.12, 0.16, 2.2, 10), base, x + 0.85, h + 1.1, z));
    this.beam = glowSprite('#3dff8a', 0.01, 0.6);
    this.beam.position.set(x, h + 1.4, z);
    this.obj.add(this.beam);
  }

  setActive(on: boolean) {
    this.active = on;
    this.ringMat.color.set(on ? '#3dff8a' : '#8a93a6');
    this.ringMat.emissive.set(on ? '#3dff8a' : '#8a93a6');
    this.ringMat.emissiveIntensity = on ? 1.2 : 0.3;
  }

  update(dt: number) {
    this.t += dt;
    this.ring.rotation.z += dt * (this.active ? 2 : 0.4);
    this.beam.scale.setScalar(this.active ? 2.2 + Math.sin(this.t * 3) * 0.3 : 0.01);
    const pl = this.world.player;
    const p = pl.body;
    const on = (p.x - this.spot.x) ** 2 + (p.z - this.spot.z) ** 2 < 2 && Math.abs(p.y - this.spot.y) < 1.5;
    if (!on) return;
    if (!this.active) this.world.activateCheckpoint(this);
    else if (this.world.save.abilities.includes('dash') && pl.gainEnergy(99)) {
      // Standing on a checkpoint tops the dash energy back up.
      audio.play('charged', 1.2);
      this.world.particles.emit(this.spot.x, this.spot.y + 1, this.spot.z, { count: 16, color: '#b58cff', speed: 3, up: 3, life: 0.6, size: 0.45 });
    }
  }
}

/* ---------------- doors ---------------- */

const COND_COLOR = (c: Cond): string => ('flag' in c ? '#ffd166' : 'clear' in c ? '#ff5e6a' : 'boss' in c ? '#c77dff' : '#ffb347');

export class Door extends Entity {
  private box: Box;
  private slab: THREE.Group;
  private t = 0;
  private baseY: number;
  private wasOpen = false;
  private lampMat: THREE.MeshStandardMaterial;

  constructor(
    world: World,
    id: string,
    cx: number,
    cz: number,
    h: number,
    private cond: Cond,
  ) {
    super(world, id);
    const x = cx2x(cx);
    const z = cx2x(cz);
    const g = world.grid;
    const alongX = g.cell(cx - 1, cz).kind === 'wall' || g.cell(cx + 1, cz).kind === 'wall';
    const w = alongX ? CELL : 0.5;
    const d = alongX ? 0.5 : CELL;
    this.baseY = h;
    this.slab = new THREE.Group();
    const color = COND_COLOR(cond);
    const metal = ownMat('#4a5468', { metal: 0.5, rough: 0.4 });
    const seam = ownMat('#2a3242');
    this.lampMat = ownMat(color, { emissive: color, ei: 1.3 });
    this.slab.add(mesh(boxG(w, 3.2, d), metal, 0, 1.6, 0));
    this.slab.add(mesh(boxG(alongX ? w * 0.9 : d * 0.1 + 0.52, 0.18, alongX ? d + 0.04 : d * 0.9), this.lampMat, 0, 1.9, 0, false));
    this.slab.add(mesh(boxG(alongX ? 0.12 : 0.54, 2.8, alongX ? d + 0.02 : 0.12), seam, 0, 1.5, 0, false));
    this.slab.position.set(x, h, z);
    this.obj.add(this.slab);
    this.box = makeBox(x, z, w / 2, d / 2, h - 1, h + PLUG_H, this);
    world.boxes.push(this.box);
  }

  update(dt: number) {
    const open = this.world.cond(this.cond);
    if (open !== this.wasOpen) {
      this.wasOpen = open;
      this.world.soundAt('door', this.slab.position.x, this.slab.position.z, 1, 24);
      if (open) this.world.particles.emit(this.slab.position.x, this.baseY + 2, this.slab.position.z, { count: 12, color: '#ffffff', speed: 3, life: 0.5 });
    }
    this.t = damp(this.t, open ? 1 : 0, 5, dt);
    this.slab.position.y = this.baseY - this.t * 3.3;
    this.box.solid = this.t < 0.6;
    this.lampMat.emissiveIntensity = open ? 0.3 : 1 + Math.sin(this.world.time * 4) * 0.3;
  }
}

/* ---------------- switches, terminals, sockets ---------------- */

/** A red floor switch for ground pounds. The world keeps the time for timed ones (`World.pressSwitch`). */
export class FloorSwitch extends Entity implements Target {
  readonly aim: THREE.Vector3;
  radius = 1.3;
  aimable = false;
  pressed = false;
  private cap: THREE.Mesh;
  private capMat: THREE.MeshStandardMaterial;
  private arrow: THREE.Mesh;

  constructor(
    world: World,
    id: string,
    cx: number,
    cz: number,
    private h: number,
    readonly flag: string,
    readonly timed?: number,
    readonly together = false,
  ) {
    super(world, id);
    const x = cx2x(cx);
    const z = cx2x(cz);
    this.aim = new THREE.Vector3(x, h + 0.3, z);
    this.obj.add(mesh(cyl(0.85, 0.95, 0.16, 24), mat('#3a4458', { metal: 0.5 }), x, h + 0.08, z));
    this.capMat = ownMat('#ff5e6a', { emissive: '#ff5e6a', ei: 0.8 });
    this.cap = mesh(cyl(0.62, 0.66, 0.24, 24), this.capMat, x, h + 0.28, z);
    this.obj.add(this.cap);
    const arrow = mesh(new THREE.ConeGeometry(0.28, 0.5, 4), mat('#ffffff', { emissive: '#ffffff', ei: 0.6 }), x, h + 1.6, z, false);
    arrow.rotation.x = Math.PI;
    this.obj.add(arrow);
    this.arrow = arrow;
    world.addTarget(this);
  }

  hit(_dmg: number, kind: HitKind): boolean {
    // A timed switch on its own can be pounded again to restart its clock; a group's clock runs once.
    if (kind !== 'pound' || (this.pressed && (!this.timed || this.together))) return false;
    this.setDown(true);
    haptic('medium');
    this.world.pressSwitch(this);
    return true;
  }

  /** Down and green, or up and red with the arrow bobbing over it. */
  setDown(down: boolean) {
    this.pressed = down;
    const color = down ? '#3dff8a' : '#ff5e6a';
    this.capMat.color.set(color);
    this.capMat.emissive.set(color);
  }

  update() {
    this.cap.position.y = this.h + (this.pressed ? 0.1 : 0.28);
    this.arrow.visible = !this.pressed;
    this.arrow.position.y = this.h + 1.6 + Math.sin(this.world.time * 4) * 0.2;
  }
}

export class Terminal extends Entity implements Interactable {
  readonly spot: THREE.Vector3;
  range = 2.6;
  private done = false;
  private screen: THREE.MeshStandardMaterial;

  constructor(
    world: World,
    id: string,
    cx: number,
    cz: number,
    h: number,
    private flag: string,
    private length = 4,
    private puzzle: PuzzleKind = 'memory',
  ) {
    super(world, id);
    const x = cx2x(cx);
    const z = cx2x(cz);
    this.spot = new THREE.Vector3(x, h, z);
    const base = mat('#3a4458', { metal: 0.5, rough: 0.4 });
    this.obj.add(mesh(boxG(1.2, 1.1, 0.8), base, x, h + 0.55, z));
    this.screen = ownMat('#5ee0ff', { emissive: '#5ee0ff', ei: 1.4 });
    const scr = mesh(boxG(1, 0.7, 0.08), this.screen, x, h + 1.4, z, false);
    scr.rotation.x = -0.4;
    this.obj.add(scr);
    this.obj.add(glowSprite('#5ee0ff', 2.2, 0.35).translateX(x).translateY(h + 1.4).translateZ(z));
    world.boxes.push(makeBox(x, z, 0.6, 0.4, h, h + 1.1));
    world.addInteractable(this);
    if (world.hasFlag(flag)) this.finish(true);
  }

  label() {
    if (this.done) return null;
    return this.world.canHack ? 'HACK' : null;
  }

  interact() {
    this.world.hooks.hack(
      this.length,
      (ok) => {
        if (ok) this.finish(false);
      },
      this.puzzle,
    );
  }

  private finish(silent: boolean) {
    this.done = true;
    this.world.setFlag(this.flag);
    this.screen.color.set('#3dff8a');
    this.screen.emissive.set('#3dff8a');
    if (!silent) audio.play('success');
  }
}

export class Socket extends Entity implements Interactable {
  readonly spot: THREE.Vector3;
  range = 2.6;
  private filled = false;
  private core: THREE.Mesh;

  constructor(
    world: World,
    id: string,
    cx: number,
    cz: number,
    h: number,
    private flag: string,
  ) {
    super(world, id);
    const x = cx2x(cx);
    const z = cx2x(cz);
    this.spot = new THREE.Vector3(x, h, z);
    this.obj.add(mesh(cyl(0.6, 0.75, 1, 18), mat('#3a4458', { metal: 0.5 }), x, h + 0.5, z));
    this.obj.add(mesh(torus(0.4, 0.07), mat('#3dff8a', { emissive: '#3dff8a', ei: 0.7 }), x, h + 1.02, z).rotateX(Math.PI / 2));
    this.core = mesh(cyl(0.26, 0.26, 0.7, 16), mat('#bfffd0', { emissive: '#3dff8a', ei: 1.6 }), x, h + 1.3, z);
    this.core.visible = false;
    this.obj.add(this.core);
    world.boxes.push(makeBox(x, z, 0.6, 0.6, h, h + 1));
    world.addInteractable(this);
    if (world.hasFlag(flag)) this.fill(true);
  }

  label() {
    if (this.filled) return null;
    return this.world.player.carrying ? 'PLACE CELL' : null;
  }

  interact() {
    const cell = this.world.heldCell();
    if (!cell) return;
    cell.place();
    this.fill(false);
  }

  private fill(silent: boolean) {
    this.filled = true;
    this.core.visible = true;
    this.world.setFlag(this.flag);
    if (!silent) {
      audio.play('success');
      haptic('success');
      this.world.particles.emit(this.spot.x, this.spot.y + 1.3, this.spot.z, { count: 30, color: '#3dff8a', speed: 6, life: 0.7 });
    }
  }
}

/* ---------------- puzzles ---------------- */

/** A glowing floor pad in a code puzzle. Step on the pads of a group in the right order. */
export class Rune extends Entity {
  readonly spot: THREE.Vector3;
  lit = false;
  private padMat: THREE.MeshStandardMaterial;
  private ringMat: THREE.MeshStandardMaterial;
  private onIt = false;
  private base: THREE.Color;
  private pulse = 0;

  constructor(
    world: World,
    id: string,
    readonly cx: number,
    readonly cz: number,
    h: number,
    readonly group: string,
    readonly order: number,
    color: string,
  ) {
    super(world, id);
    const x = cx2x(cx);
    const z = cx2x(cz);
    this.spot = new THREE.Vector3(x, h, z);
    this.base = new THREE.Color(color);
    this.obj.add(mesh(cyl(0.95, 1, 0.12, 6), mat('#252a36', { metal: 0.6, rough: 0.4 }), x, h + 0.06, z));
    this.padMat = ownMat(color, { emissive: color, ei: 0.25, rough: 0.3 });
    this.obj.add(mesh(cyl(0.72, 0.72, 0.08, 6), this.padMat, x, h + 0.14, z, false));
    this.ringMat = ownMat(color, { emissive: color, ei: 0.8 });
    const ring = mesh(torus(0.86, 0.05), this.ringMat, x, h + 0.16, z, false);
    ring.rotation.x = Math.PI / 2;
    this.obj.add(ring);
  }

  setLit(on: boolean) {
    this.lit = on;
    this.pulse = on ? 1 : 0;
  }

  update(dt: number) {
    const p = this.world.player;
    const b = p.body;
    const on = b.grounded && p.cellX === this.cx && p.cellZ === this.cz && Math.abs(b.y - this.spot.y) < 0.7;
    if (on && !this.onIt) this.world.stepRune(this);
    this.onIt = on;
    this.pulse = Math.max(0, this.pulse - dt * 1.5);
    const solved = this.world.hasFlag(this.group);
    this.padMat.emissiveIntensity = this.lit || solved ? 1.6 + this.pulse * 2 : 0.25 + Math.sin(this.world.time * 3 + this.order) * 0.12;
    this.ringMat.emissiveIntensity = this.lit || solved ? 2 : 0.8;
  }
}

/** A golden vault chest. Opening it gives a free upgrade (or a pile of bolts). */
export class Prize extends Entity implements Interactable {
  readonly spot: THREE.Vector3;
  range = 2.6;
  private lid: THREE.Group;
  private glow: THREE.Sprite;
  private opened: boolean;
  private openT = 0;

  constructor(
    world: World,
    id: string,
    cx: number,
    cz: number,
    h: number,
    readonly reward: string,
  ) {
    super(world, id);
    const x = cx2x(cx);
    const z = cx2x(cz);
    this.spot = new THREE.Vector3(x, h, z);
    this.opened = (world.save.prizes ?? []).includes(id);
    const gold = mat('#e8b440', { metal: 0.8, rough: 0.28 });
    const dark = mat('#5a3a14', { rough: 0.6 });
    const g = new THREE.Group();
    g.position.set(x, h, z);
    g.add(mesh(boxG(1.4, 0.8, 0.9), dark, 0, 0.4, 0));
    for (const sx of [-0.62, 0, 0.62]) g.add(mesh(boxG(0.14, 0.84, 0.94), gold, sx, 0.42, 0));
    this.lid = new THREE.Group();
    this.lid.position.set(0, 0.8, -0.45);
    const top = mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.4, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2), dark, 0, 0, 0.45);
    this.lid.add(top);
    for (const sx of [-0.62, 0, 0.62]) this.lid.add(mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.14, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2), gold, sx, 0, 0.45));
    this.lid.add(mesh(boxG(0.24, 0.3, 0.1), mat('#ffd166', { emissive: '#ffb020', ei: 0.8 }), 0, -0.05, 0.94, false));
    g.add(this.lid);
    this.obj.add(g);
    this.glow = glowSprite('#ffd166', 3, this.opened ? 0 : 0.5);
    this.glow.position.set(x, h + 1.2, z);
    this.obj.add(this.glow);
    if (this.opened) this.lid.rotation.x = -1.9;
    world.boxes.push(makeBox(x, z, 0.7, 0.45, h, h + 1));
    world.addInteractable(this);
  }

  label() {
    return this.opened ? null : 'OPEN VAULT';
  }

  interact() {
    if (this.opened) return;
    this.opened = true;
    this.openT = 0.001;
    this.world.openPrize(this);
  }

  update(dt: number) {
    if (this.openT > 0 && this.openT < 1) {
      this.openT = Math.min(1, this.openT + dt * 1.6);
      this.lid.rotation.x = -1.9 * (1 - (1 - this.openT) ** 3);
      if (Math.random() < 0.6) this.world.particles.emit(this.spot.x, this.spot.y + 0.9, this.spot.z, { count: 2, color: '#ffd166', speed: 2, up: 4, life: 0.8, size: 0.45, gravity: 2 });
    }
    this.glow.material.opacity = this.opened ? Math.max(0, this.glow.material.opacity - dt) : 0.45 + Math.sin(this.world.time * 3) * 0.12;
  }
}

/* ---------------- platforms ---------------- */

export class Platform extends Entity {
  readonly box: Box;
  private points: THREE.Vector3[];
  private idx = 0;
  private dir = 1;
  private waitT = 0;
  private pos: THREE.Vector3;
  private mesh: THREE.Group;
  private half: number;

  constructor(
    world: World,
    id: string,
    cx: number,
    cz: number,
    h: number,
    spec: Extract<Spec, { type: 'platform' }>,
  ) {
    super(world, id);
    const size = spec.size ?? 1;
    this.half = (CELL * size) / 2 - 0.05;
    const x0 = cx2x(cx) + (size - 1) * (CELL / 2);
    const z0 = cx2x(cz) + (size - 1) * (CELL / 2);
    this.points = [new THREE.Vector3(x0, h, z0), ...spec.path.map(([dx, dz, dy]) => new THREE.Vector3(x0 + dx * CELL, h + (dy ?? 0) * 0.5, z0 + dz * CELL))];
    this.pos = this.points[0].clone();
    this.speed = spec.speed ?? 3;
    this.wait = spec.wait ?? 0.7;
    this.needs = spec.needs;
    const hw = this.half;
    this.mesh = new THREE.Group();
    const outdoor = world.theme.outdoor;
    if (spec.look === 'cart') {
      // Aeëtes's Mine: an ore cart, with its rails laid along the whole run.
      this.mesh.add(makeOreCart(hw));
      for (let i = 1; i < this.points.length; i++) this.obj.add(railSegment(this.points[i - 1], this.points[i]));
    } else if (spec.look === 'hauler') {
      // One of General Brennus's old Legion haulers: it only flies once he gives the order.
      const hauler = makeHauler(hw);
      this.mesh.add(hauler.group);
      this.lens = hauler.lens;
    } else if (outdoor) {
      // On Gaia Nova: a raft of logs lashed together (stone slabs over lava, so they don't burn).
      const stone = outdoor.ground === 'basalt';
      const logs = Math.max(2, Math.round((hw * 2) / 0.62));
      const step = (hw * 2) / logs;
      const wood = mat(stone ? '#4a4044' : '#8a5a32', { rough: 0.85 });
      const dark = mat(stone ? '#2a2224' : '#5a3a20', { rough: 0.9 });
      for (let i = 0; i < logs; i++) {
        const log = mesh(cyl(step / 2, step / 2, hw * 2, 10), i % 2 ? wood : dark, -hw + step * (i + 0.5), -step / 2, 0);
        log.rotation.x = Math.PI / 2;
        this.mesh.add(log);
      }
      for (const z of [-hw * 0.6, hw * 0.6]) this.mesh.add(mesh(boxG(hw * 2 + 0.1, 0.1, 0.16), mat('#c8a060', { rough: 0.9 }), 0, -0.02, z));
      if (stone) this.mesh.add(glowSprite('#ff6a12', 2.4, 0.35).translateY(-0.8));
    } else {
      this.mesh.add(mesh(boxG(hw * 2, 0.5, hw * 2), mat('#5a6478', { metal: 0.55, rough: 0.35 }), 0, -0.25, 0));
      const trim = new THREE.MeshStandardMaterial({ map: stripeTexture('#ffd166', '#2a2f3a'), roughness: 0.5 });
      // The hazard band wraps the sides just below the deck. Its top must not share the deck's plane:
      // two coplanar faces z-fight, and on a moving platform that shimmers as a constant flicker.
      this.mesh.add(mesh(boxG(hw * 2 + 0.08, 0.14, hw * 2 + 0.08), trim, 0, -0.13, 0));
      this.mesh.add(mesh(cyl(0.2, 0.3, 0.3, 10), mat(world.theme.accent, { emissive: world.theme.accent, ei: 1.4 }), 0, -0.6, 0, false));
      this.mesh.add(glowSprite(world.theme.accent, 1.4, 0.5).translateY(-0.8));
    }
    this.obj.add(this.mesh);
    this.box = makeBox(this.pos.x, this.pos.z, hw, hw, h - 0.5, h, this);
    world.boxes.push(this.box);
  }

  private speed: number;
  private wait: number;
  private needs?: Cond;

  update(dt: number) {
    const before = this.pos.clone();
    const running = !this.needs || this.world.cond(this.needs);
    if (running && this.points.length > 1) {
      if (this.waitT > 0) this.waitT -= dt;
      else {
        const next = this.idx + this.dir;
        const target = this.points[next];
        const to = target.clone().sub(this.pos);
        const d = to.length();
        const step = this.speed * dt;
        if (d <= step) {
          this.pos.copy(target);
          this.idx = next;
          if (this.idx === this.points.length - 1 || this.idx === 0) {
            this.dir = -this.dir;
            this.waitT = this.wait;
          }
        } else {
          this.pos.addScaledVector(to, step / d);
        }
      }
    }
    this.box.dx = this.pos.x - before.x;
    this.box.dy = this.pos.y - before.y;
    this.box.dz = this.pos.z - before.z;
    this.box.minX = this.pos.x - this.half;
    this.box.maxX = this.pos.x + this.half;
    this.box.minZ = this.pos.z - this.half;
    this.box.maxZ = this.pos.z + this.half;
    this.box.top = this.pos.y;
    this.box.bottom = this.pos.y - 0.5;
    this.mesh.position.copy(this.pos);
    if (this.lens) {
      // A hauler's lens turns green once it has its orders, and it bobs a little as it hovers.
      const go = running;
      this.lens.color.set(go ? '#3dff8a' : '#ff3a3a');
      this.lens.emissive.set(go ? '#3dff8a' : '#ff3a3a');
      this.mesh.position.y += Math.sin(this.world.time * 3) * 0.04;
    }
  }

  /** A Legion hauler's lens (red until Brennus gives the order). */
  private lens: THREE.MeshStandardMaterial | null = null;
}

export class Faller extends Entity {
  readonly box: Box;
  private state: 'idle' | 'shake' | 'fall' | 'gone' = 'idle';
  private t = 0;
  private y: number;
  private vy = 0;
  private mesh: THREE.Group;
  private home: THREE.Vector3;

  constructor(world: World, id: string, cx: number, cz: number, h: number) {
    super(world, id);
    const x = cx2x(cx);
    const z = cx2x(cz);
    this.home = new THREE.Vector3(x, h, z);
    this.y = h;
    this.mesh = new THREE.Group();
    this.mesh.add(mesh(boxG(CELL - 0.1, 0.45, CELL - 0.1), mat('#8a6a4a', { rough: 0.8 }), 0, -0.22, 0));
    this.mesh.add(mesh(boxG(CELL - 0.3, 0.05, CELL - 0.3), mat('#ffb347', { emissive: '#ff8a1a', ei: 0.3 }), 0, 0.01, 0));
    this.mesh.position.copy(this.home);
    this.obj.add(this.mesh);
    this.box = makeBox(x, z, CELL / 2 - 0.05, CELL / 2 - 0.05, h - 0.45, h, this);
    world.boxes.push(this.box);
  }

  update(dt: number) {
    const standing = this.world.player.body.grounded && this.world.player.body.ground?.box === this.box;
    this.t += dt;
    this.box.dy = 0;
    switch (this.state) {
      case 'idle':
        if (standing) {
          this.state = 'shake';
          this.t = 0;
          audio.play('break', 0.6);
        }
        this.mesh.position.set(this.home.x, this.home.y, this.home.z);
        break;
      case 'shake':
        this.mesh.position.x = this.home.x + Math.sin(this.t * 60) * 0.06;
        if (this.t > 0.55) {
          this.state = 'fall';
          this.t = 0;
          this.vy = 0;
        }
        break;
      case 'fall': {
        this.vy -= 20 * dt;
        const prev = this.y;
        this.y += this.vy * dt;
        this.box.dy = this.y - prev;
        this.box.top = this.y;
        this.box.bottom = this.y - 0.45;
        this.mesh.position.y = this.y;
        if (this.t > 0.5) this.box.solid = false;
        if (this.t > 1.2) {
          this.state = 'gone';
          this.t = 0;
          this.mesh.visible = false;
        }
        break;
      }
      case 'gone':
        if (this.t > 2.5) {
          this.state = 'idle';
          this.y = this.home.y;
          this.box.top = this.y;
          this.box.bottom = this.y - 0.45;
          this.box.solid = true;
          this.mesh.visible = true;
          this.mesh.position.copy(this.home);
        }
        break;
    }
  }
}

/* ---------------- floor gadgets ---------------- */

export class BouncePad extends Entity implements FloorFx {
  private spring: THREE.Group;
  private t = 1;

  constructor(world: World, id: string, cx: number, cz: number, h: number) {
    super(world, id);
    const x = cx2x(cx);
    const z = cx2x(cz);
    this.obj.add(mesh(cyl(0.9, 1, 0.2, 24), mat('#3a4458', { metal: 0.5 }), x, h + 0.1, z));
    this.spring = new THREE.Group();
    this.spring.add(mesh(cyl(0.75, 0.75, 0.16, 24), mat('#ff6fcf', { emissive: '#ff6fcf', ei: 0.9 }), 0, 0, 0));
    this.spring.add(mesh(torus(0.5, 0.06), mat('#ffffff', { emissive: '#ffffff', ei: 0.5 }), 0, 0.09, 0).rotateX(Math.PI / 2));
    this.spring.position.set(x, h + 0.3, z);
    this.obj.add(this.spring);
    world.registerFloor(cx, cz, this);
  }

  land(p: Player) {
    const v = p.pounding ? PLAYER.bounceV * 1.25 : PLAYER.bounceV;
    p.launch(v);
    this.t = 0;
    audio.play('bounce');
    haptic('light');
    this.world.particles.emit(p.body.x, p.body.y + 0.2, p.body.z, { count: 14, color: '#ff9ae0', speed: 5, life: 0.5, size: 0.5 });
  }

  stand(p: Player) {
    this.land(p);
  }

  update(dt: number) {
    this.t += dt;
    const k = this.t < 0.3 ? Math.sin((this.t / 0.3) * Math.PI) : 0;
    this.spring.scale.set(1 - k * 0.15, 1 + k * 3, 1 - k * 0.15);
  }
}

export class Vent extends Entity implements FloorFx {
  unsafe = true;
  private x: number;
  private z: number;
  private h: number;
  private glow: THREE.Sprite;
  private wasOn = false;

  constructor(
    world: World,
    id: string,
    cx: number,
    cz: number,
    h: number,
    private period = 3.2,
    private offset = 0,
  ) {
    super(world, id);
    this.x = cx2x(cx);
    this.z = cx2x(cz);
    this.h = h;
    if (world.theme.outdoor?.cloudSea) {
      // On the sky-islands an updraft is a ring of pale stones around a swirl of warm air.
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        this.obj.add(mesh(sphere(0.22, 8), mat('#d8d0c4', { rough: 0.9 }), this.x + Math.cos(a) * 0.9, h + 0.1, this.z + Math.sin(a) * 0.9));
      }
      const swirl = mesh(torus(0.55, 0.05), mat('#ffffff', { emissive: '#bff4ff', ei: 0.8 }), this.x, h + 0.12, this.z, false);
      swirl.rotation.x = Math.PI / 2;
      this.obj.add(swirl);
    } else {
      this.obj.add(mesh(cyl(0.85, 0.95, 0.14, 20), mat('#2a2f3a', { metal: 0.6 }), this.x, h + 0.07, this.z));
      for (let i = 0; i < 4; i++) {
        this.obj.add(mesh(boxG(1.2, 0.05, 0.12), mat('#ffb347', { emissive: '#ff8a1a', ei: 0.6 }), this.x, h + 0.15, this.z - 0.45 + i * 0.3, false));
      }
    }
    this.glow = glowSprite('#ffe0b0', 3, 0);
    this.glow.position.set(this.x, h + 1.5, this.z);
    this.obj.add(this.glow);
    world.registerFloor(cx, cz, this);
  }

  get on() {
    return (this.world.time + this.offset) % this.period < 1.5;
  }

  update(dt: number) {
    const on = this.on;
    const soon = !on && (this.world.time + this.offset) % this.period > this.period - 0.6;
    if (on && !this.wasOn) this.world.soundAt('vent', this.x, this.z, 1, 16);
    this.wasOn = on;
    this.glow.material.opacity = damp(this.glow.material.opacity, on ? 0.55 : 0, 8, dt);
    const w = this.world;
    if (on || (soon && Math.random() < 0.3)) {
      w.particles.emit(this.x + (Math.random() - 0.5), this.h + 0.3, this.z + (Math.random() - 0.5), {
        count: on ? 3 : 1,
        color: '#f4f0ea',
        speed: 1.5,
        up: on ? 13 : 3,
        life: on ? 0.8 : 0.4,
        size: on ? 1.3 : 0.6,
        gravity: 0,
        drag: 0.8,
      });
    }
    if (!on) return;
    const p = w.player.body;
    if (Math.abs(p.x - this.x) < 1.1 && Math.abs(p.z - this.z) < 1.1 && p.y < this.h + 8 && p.y > this.h - 0.5) {
      if (p.vy < PLAYER.ventV - 2) {
        w.player.launch(PLAYER.ventV);
        haptic('light');
      }
    }
  }
}

export class Laser extends Entity implements Overloadable {
  private beam: THREE.Mesh;
  private beamMat: THREE.MeshBasicMaterial;
  private a: THREE.Vector3;
  private b: THREE.Vector3;
  private y: number;
  private wasOn = false;
  /** Seconds left shorted out by LUX's force pulse. */
  private overT = 0;

  constructor(
    world: World,
    id: string,
    cx: number,
    cz: number,
    h: number,
    private spec: Extract<Spec, { type: 'laser' }>,
  ) {
    super(world, id);
    const x = cx2x(cx);
    const z = cx2x(cz);
    const len = spec.length * CELL;
    this.y = h + (spec.low ? 0.45 : 1);
    this.a = new THREE.Vector3(x, this.y, z);
    this.b = spec.axis === 'x' ? new THREE.Vector3(x + len, this.y, z) : new THREE.Vector3(x, this.y, z + len);
    const post = mat('#2a2f3a', { metal: 0.6 });
    const cap = mat('#ff4757', { emissive: '#ff4757', ei: 1.2 });
    for (const p of [this.a, this.b]) {
      this.obj.add(mesh(cyl(0.18, 0.24, this.y - h + 0.5, 10), post, p.x, h + (this.y - h + 0.5) / 2, p.z));
      this.obj.add(mesh(sphere(0.18, 10), cap, p.x, this.y + 0.25, p.z, false));
    }
    // A solid red core (additive would wash out to white over bright floors) inside a soft glow.
    this.beamMat = new THREE.MeshBasicMaterial({ color: '#ff2238', transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false });
    const geo = new THREE.CylinderGeometry(0.07, 0.07, len, 8);
    if (spec.axis === 'x') geo.rotateZ(Math.PI / 2);
    else geo.rotateX(Math.PI / 2);
    this.beam = new THREE.Mesh(geo, this.beamMat);
    this.beam.position.copy(this.a).lerp(this.b, 0.5);
    this.obj.add(this.beam);
    const halo = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#ff4757', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    halo.scale.set(spec.axis === 'x' ? 1 : 3, spec.axis === 'x' ? 3 : 3, spec.axis === 'x' ? 3 : 1);
    this.beam.add(halo);
  }

  get on() {
    if (this.overT > 0) return false;
    if (this.spec.off && this.world.cond(this.spec.off)) return false;
    if (this.spec.always) return true;
    const period = this.spec.period ?? 3;
    return (this.world.time + (this.spec.offset ?? 0)) % period < period * 0.55;
  }

  overload(at: THREE.Vector3, radius: number, seconds: number): boolean {
    if (this.spec.hardened || (this.spec.off && this.world.cond(this.spec.off))) return false;
    // Distance from the pulse to the nearest point of the beam.
    const abx = this.b.x - this.a.x;
    const abz = this.b.z - this.a.z;
    const k = Math.max(0, Math.min(1, ((at.x - this.a.x) * abx + (at.z - this.a.z) * abz) / (abx * abx + abz * abz || 1)));
    const d = Math.hypot(this.a.x + abx * k - at.x, this.a.z + abz * k - at.z);
    if (d > radius || Math.abs(at.y - this.y) > 5) return false;
    this.overT = seconds;
    return true;
  }

  update(dt: number) {
    this.overT = Math.max(0, this.overT - dt);
    const on = this.on;
    if (on !== this.wasOn) {
      this.wasOn = on;
      if (on) this.world.soundAt('zap', (this.a.x + this.b.x) / 2, (this.a.z + this.b.z) / 2, 0.7, 14);
    }
    const period = this.spec.period ?? 3;
    const phase = (this.world.time + (this.spec.offset ?? 0)) % period;
    if (this.overT > 0) {
      // Shorted out: the posts spark, and in the last second the beam stutters back to life as a warning.
      overloadSparks(this.world, this.a.x, this.y + 0.25, this.a.z);
      overloadSparks(this.world, this.b.x, this.y + 0.25, this.b.z);
      this.beam.visible = this.overT < 1 && Math.sin(this.world.time * 40) > 0;
      this.beamMat.opacity = 0.3;
      return;
    }
    const warn = !on && !this.spec.always && phase > period - 0.5;
    this.beam.visible = on || warn;
    this.beamMat.opacity = on ? 0.9 : Math.sin(this.world.time * 40) > 0 ? 0.3 : 0.05;
    if (!on) return;
    const p = this.world.player.body;
    // The beam covers its end cells completely, so nobody can sneak past by hugging a wall.
    const minX = Math.min(this.a.x, this.b.x) - CELL / 2;
    const maxX = Math.max(this.a.x, this.b.x) + CELL / 2;
    const minZ = Math.min(this.a.z, this.b.z) - CELL / 2;
    const maxZ = Math.max(this.a.z, this.b.z) + CELL / 2;
    const inside = this.spec.axis === 'x' ? p.x > minX && p.x < maxX && Math.abs(p.z - this.a.z) < 0.5 : p.z > minZ && p.z < maxZ && Math.abs(p.x - this.a.x) < 0.5;
    if (inside && p.y < this.y + 0.15 && p.y + p.h > this.y - 0.15) {
      const fromX = this.spec.axis === 'x' ? p.x : this.a.x + (p.x < this.a.x ? 1 : -1);
      const fromZ = this.spec.axis === 'z' ? p.z : this.a.z + (p.z < this.a.z ? 1 : -1);
      this.world.player.hurt(1, fromX, fromZ, true);
    }
  }
}

export class ZapFloor extends Entity implements FloorFx, Overloadable {
  unsafe = true;
  private plateMat: THREE.MeshStandardMaterial;
  private x: number;
  private z: number;
  private h: number;
  private overT = 0;

  constructor(
    world: World,
    id: string,
    cx: number,
    cz: number,
    h: number,
    private period = 3,
    private offset = 0,
  ) {
    super(world, id);
    this.x = cx2x(cx);
    this.z = cx2x(cz);
    this.h = h;
    this.plateMat = ownMat('#3a4458', { emissive: '#6ec8ff', ei: 0, metal: 0.6 });
    this.obj.add(mesh(boxG(CELL - 0.15, 0.08, CELL - 0.15), this.plateMat, this.x, h + 0.04, this.z));
    world.registerFloor(cx, cz, this);
  }

  get on() {
    return this.overT <= 0 && (this.world.time + this.offset) % this.period < this.period * 0.45;
  }

  overload(at: THREE.Vector3, radius: number, seconds: number): boolean {
    if (Math.hypot(this.x - at.x, this.z - at.z) > radius || Math.abs(at.y - this.h) > 5) return false;
    this.overT = seconds;
    return true;
  }

  stand(p: Player) {
    if (this.on) p.hurt(1, this.x + (Math.random() - 0.5) * 0.1, this.z + (Math.random() - 0.5) * 0.1, true);
  }

  update(dt: number) {
    this.overT = Math.max(0, this.overT - dt);
    if (this.overT > 0) {
      overloadSparks(this.world, this.x + (Math.random() - 0.5) * 1.6, this.h + 0.15, this.z + (Math.random() - 0.5) * 1.6);
      this.plateMat.emissiveIntensity = this.overT < 1 && Math.sin(this.world.time * 30) > 0 ? 0.6 : 0;
      return;
    }
    const phase = (this.world.time + this.offset) % this.period;
    const on = this.on;
    const warn = !on && phase > this.period - 0.5;
    this.plateMat.emissiveIntensity = on ? 1.6 : warn ? (Math.sin(this.world.time * 30) > 0 ? 0.6 : 0) : 0;
    if (on && Math.random() < 0.25) {
      this.world.particles.emit(this.x + (Math.random() - 0.5) * 1.6, this.h + 0.2, this.z + (Math.random() - 0.5) * 1.6, { count: 2, color: '#bfe8ff', speed: 3, up: 2, life: 0.25, size: 0.35 });
    }
  }
}

function arrowTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.fillStyle = '#2a2f3a';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#ffd166';
  g.beginPath();
  g.moveTo(16, 44);
  g.lineTo(32, 20);
  g.lineTo(48, 44);
  g.lineTo(40, 44);
  g.lineTo(32, 32);
  g.lineTo(24, 44);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export class Conveyor extends Entity implements FloorFx {
  private tex: THREE.Texture;

  constructor(
    world: World,
    id: string,
    cx: number,
    cz: number,
    h: number,
    private dx: number,
    private dz: number,
    private speed = 3.2,
  ) {
    super(world, id);
    this.tex = arrowTexture();
    const m = new THREE.MeshStandardMaterial({ map: this.tex, emissive: '#ffd166', emissiveMap: this.tex, emissiveIntensity: 0.35, roughness: 0.6 });
    const plane = mesh(new THREE.PlaneGeometry(CELL - 0.1, CELL - 0.1), m, cx2x(cx), h + 0.02, cx2x(cz), false);
    plane.rotation.x = -Math.PI / 2;
    plane.rotation.z = -Math.atan2(dx, -dz);
    plane.receiveShadow = true;
    this.obj.add(plane);
    world.registerFloor(cx, cz, this);
  }

  stand(p: Player, dt: number) {
    p.body.x += this.dx * this.speed * dt;
    p.body.z += this.dz * this.speed * dt;
  }

  update(dt: number) {
    this.tex.offset.y -= dt * this.speed * 0.5;
  }
}

/* ---------------- story props ---------------- */

export class Cocoon extends Entity implements Target {
  readonly aim: THREE.Vector3;
  radius = 1;
  aimable = true;
  private hp = 3;
  private pod: THREE.Group;
  private freedT = -1;
  private person: THREE.Group;

  constructor(
    world: World,
    id: string,
    cx: number,
    cz: number,
    h: number,
    private name: string,
    private line: string,
  ) {
    super(world, id);
    const x = cx2x(cx);
    const z = cx2x(cz);
    this.aim = new THREE.Vector3(x, h + 1.2, z);
    this.pod = new THREE.Group();
    const skin = mat('#ff8ad8', { emissive: '#ff5fc8', ei: 0.35, rough: 0.35, opacity: 0.92 });
    const pod = mesh(sphere(0.9, 22), skin, 0, 1.2, 0);
    pod.scale.set(0.9, 1.35, 0.9);
    this.pod.add(pod);
    for (let i = 0; i < 5; i++) {
      const vine = mesh(torus(0.9, 0.06), mat('#8a2f75', { rough: 0.6 }), 0, 0.6 + i * 0.35, 0);
      vine.rotation.x = Math.PI / 2 + (i % 2 ? 0.3 : -0.3);
      vine.scale.setScalar(0.85 + Math.sin(i) * 0.1);
      this.pod.add(vine);
    }
    this.pod.add(glowSprite('#ff6fcf', 3, 0.35).translateY(1.2));
    this.pod.position.set(x, h, z);
    this.obj.add(this.pod);
    this.person = makeColonist(hashId(id));
    this.person.position.set(x, h, z);
    this.person.visible = false;
    this.obj.add(this.person);
    world.addTarget(this);
    world.boxes.push(makeBox(x, z, 0.75, 0.75, h, h + 2.4, this));
  }

  hit(): boolean {
    if (this.hp <= 0) return false;
    this.hp -= 1;
    audio.play('hit');
    this.pod.scale.setScalar(1.12);
    if (this.hp <= 0) this.free();
    return true;
  }

  private free() {
    const w = this.world;
    audio.play('pop');
    audio.play('heart');
    w.particles.emit(this.aim.x, this.aim.y, this.aim.z, { count: 40, color: '#ff9ae0', speed: 7, life: 0.9, size: 0.6 });
    this.pod.visible = false;
    this.person.visible = true;
    this.freedT = 0;
    this.aimable = false;
    w.removeTarget(this);
    const box = w.boxes.find((b) => b.owner === this);
    if (box) w.boxes.splice(w.boxes.indexOf(box), 1);
    w.collect('colonist', this.id);
    // Story characters (Aunt Rosa, the Captain) get a proper conversation instead of a one-liner, and
    // some (Dr. Galen) tell their story over storybook pictures.
    const key = `colonist:${this.id.split('.')[1]}`;
    const lines = w.dialogue(key);
    if (w.def.stories?.[key]?.length) w.playStory(key);
    else if (lines.length) w.hooks.say(lines);
    else w.hooks.toast(tr('{name}: “{line}”', { name: tr(this.name), line: tr(this.line) }), 'colonist');
  }

  update(dt: number) {
    this.pod.scale.setScalar(damp(this.pod.scale.x, 1 + Math.sin(this.world.time * 2) * 0.03, 8, dt));
    if (this.freedT >= 0) {
      this.freedT += dt;
      this.person.rotation.y = Math.atan2(this.world.player.body.x - this.person.position.x, this.world.player.body.z - this.person.position.z);
      const arm = this.person.userData.arm as THREE.Object3D;
      arm.rotation.z = 2.4 + Math.sin(this.freedT * 10) * 0.5;
      if (this.freedT > 4) {
        this.person.scale.setScalar(Math.max(0.01, 1 - (this.freedT - 4) * 2));
        if (this.freedT > 4.5) {
          this.world.particles.emit(this.person.position.x, this.person.position.y + 1, this.person.position.z, { count: 20, color: '#7fe6ff', speed: 4, life: 0.6 });
          this.remove();
        }
      }
    }
  }
}

type VendyMood = 'idle' | 'blink' | 'happy';

/** PANDORA's face on her little screen: two rounded eyes and a mouth, drawn in light. */
function vendyFace(mood: VendyMood): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 96;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const bg = g.createLinearGradient(0, 0, 0, 96);
  bg.addColorStop(0, '#2a0b24');
  bg.addColorStop(1, '#12040f');
  g.fillStyle = bg;
  g.fillRect(0, 0, 128, 96);
  g.fillStyle = '#ffb0e6';
  g.strokeStyle = '#ffb0e6';
  g.lineCap = 'round';
  g.lineWidth = 7;
  g.shadowColor = '#ff5fc8';
  g.shadowBlur = 10;
  for (const x of [42, 86]) {
    g.beginPath();
    if (mood === 'blink') {
      g.moveTo(x - 10, 38);
      g.lineTo(x + 10, 38);
      g.stroke();
    } else if (mood === 'happy') {
      g.arc(x, 42, 11, Math.PI * 1.1, Math.PI * 1.9);
      g.stroke();
    } else {
      g.roundRect(x - 8, 26, 16, 24, 8);
      g.fill();
    }
  }
  g.beginPath();
  g.arc(64, mood === 'happy' ? 58 : 62, mood === 'happy' ? 16 : 11, Math.PI * 0.15, Math.PI * 0.85);
  g.stroke();
  // Faint scanlines, like a real little display.
  g.shadowBlur = 0;
  g.fillStyle = 'rgba(0,0,0,0.22)';
  for (let y = 0; y < 96; y += 3) g.fillRect(0, y, 128, 1);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** The neon marquee across the top of the machine. */
function vendySign(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.fillStyle = '#16060f';
  g.fillRect(0, 0, 256, 64);
  g.font = '800 34px Orbitron, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = '#ff3fb8';
  g.shadowBlur = 14;
  g.fillStyle = '#ffd0ee';
  g.fillText('PANDORA', 128, 34, 196);
  g.shadowBlur = 0;
  g.fillStyle = '#ffd166';
  for (const x of [18, 238]) {
    g.beginPath();
    g.arc(x, 32, 6, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * PANDORA, the travelling vending machine: a glass front with shelves of glowing upgrades, a neon
 * marquee, a control panel whose little screen shows her face (she blinks, and smiles when Jason comes
 * close), a keypad, a pickup tray and a spinning holographic bolt on top.
 */
export class Vendor extends Entity implements Interactable {
  readonly spot: THREE.Vector3;
  range = 2.8;
  private t = 0;
  private screen: THREE.MeshBasicMaterial;
  private faces: Record<VendyMood, THREE.CanvasTexture>;
  private mood: VendyMood = 'idle';
  private blinkT = 2;
  private signMat: THREE.MeshBasicMaterial;
  private holo: THREE.Group;
  /** The hologram bolt is drawn in the same light as the hologram logs. */
  private holoU: HoloUniforms;
  private scanner: THREE.Mesh;
  private items: THREE.Object3D[] = [];
  private scanTop = 0;
  private scanSpan = 1;

  constructor(world: World, id: string, cx: number, cz: number, h: number) {
    super(world, id);
    const x = cx2x(cx);
    const z = cx2x(cz);
    this.spot = new THREE.Vector3(x, h, z);
    const g = new THREE.Group();
    g.position.set(x, h, z);
    const W = 1.5;
    const H = 2.5;
    const D = 1;
    const shell = mat('#262b38', { metal: 0.6, rough: 0.35 });
    const trim = mat('#c0368f', { metal: 0.3, rough: 0.35 });
    const dark = mat('#0e1118', { rough: 0.6 });
    const chrome = mat('#cfd6e2', { metal: 0.85, rough: 0.2 });
    const neon = mat('#ff6fcf', { emissive: '#ff4fc0', ei: 1.6 });
    const base = 0.08;
    // The front is recessed: a shallower body, then frame bands around a lit window.
    const R = 0.3;
    const front = D / 2;
    const inner = front - R;
    const band = (w: number, h: number, x: number, y: number, m: THREE.Material = shell) => g.add(mesh(boxG(w, h, R), m, x, y, front - R / 2));
    g.add(mesh(boxG(W, H, D - R), shell, 0, base + H / 2, -R / 2));
    const px = 0.52;
    const winL = -W / 2 + 0.07;
    const winR = px - 0.2;
    const winB = base + 0.62;
    const winT = base + H - 0.5;
    band(W, 0.5, 0, winT + 0.25);
    band(W, 0.62, 0, base + 0.31);
    band(0.07, winT - winB, winL - 0.035, (winT + winB) / 2);
    band(W / 2 - winR, winT - winB, (winR + W / 2) / 2, (winT + winB) / 2);
    for (const sx of [-1, 1]) {
      g.add(mesh(boxG(0.06, H - 0.3, D - 0.2), trim, sx * (W / 2 + 0.03), base + H / 2, 0));
      // Neon strips running up the front corners.
      g.add(mesh(boxG(0.05, H - 0.2, 0.05), neon, sx * (W / 2 - 0.03), base + H / 2, front + 0.01, false));
      g.add(mesh(boxG(0.22, 0.08, 0.3), dark, sx * 0.5, 0.04, 0.2), mesh(boxG(0.22, 0.08, 0.3), dark, sx * 0.5, 0.04, -0.2));
    }
    const cap = mesh(new THREE.CylinderGeometry(D / 2, D / 2, W, 20, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), shell, 0, base + H, 0);
    cap.scale.y = 0.35;
    g.add(cap);
    // Marquee.
    this.signMat = new THREE.MeshBasicMaterial({ map: vendySign(), toneMapped: false });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.14, 0.34), this.signMat);
    sign.position.set(0, winT + 0.25, front + 0.012);
    g.add(sign);
    // The window: a softly lit back wall and three shelves of upgrades behind glass.
    const gx = (winL + winR) / 2;
    const gw = winR - winL;
    const gy = (winB + winT) / 2;
    const gh = winT - winB;
    g.add(mesh(new THREE.PlaneGeometry(gw, gh), new THREE.MeshStandardMaterial({ color: '#3a1030', emissive: '#ff5fc8', emissiveIntensity: 0.28, roughness: 0.8 }), gx, gy, inner + 0.002, false));
    const colors = ['#ff4d6d', '#5ee0ff', '#ffd166', '#b58cff', '#7dff9a'];
    for (let r = 0; r < 3; r++) {
      const sy = winB + 0.06 + r * 0.46;
      g.add(mesh(boxG(gw - 0.02, 0.03, R - 0.04), chrome, gx, sy, inner + R / 2, false));
      // Price strip along the shelf edge.
      g.add(mesh(boxG(gw - 0.04, 0.035, 0.01), mat('#ffe0f4', { emissive: '#ffb0e0', ei: 1.2 }), gx, sy + 0.01, front - 0.035, false));
      for (let i = 0; i < 4; i++) {
        const col = colors[(r * 4 + i) % colors.length];
        const ix = gx - gw / 2 + 0.14 + i * ((gw - 0.28) / 3);
        const can = mesh(cyl(0.075, 0.075, 0.22, 14), mat(col, { emissive: col, ei: 0.7, rough: 0.25, metal: 0.4 }), ix, sy + 0.13, inner + R / 2, false);
        g.add(mesh(cyl(0.078, 0.078, 0.03, 14), chrome, ix, sy + 0.25, inner + R / 2, false));
        this.items.push(can);
        g.add(can);
      }
    }
    const glass = new THREE.MeshStandardMaterial({ color: '#dff4ff', roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.12, depthWrite: false });
    g.add(mesh(new THREE.PlaneGeometry(gw, gh), glass, gx, gy, front - 0.01, false));
    // A scanning light that sweeps down the shelves.
    this.scanner = mesh(new THREE.PlaneGeometry(gw, 0.04), new THREE.MeshBasicMaterial({ color: '#ff9ae0', transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }), gx, gy, front - 0.005, false);
    g.add(this.scanner);
    this.scanTop = winT - 0.05;
    this.scanSpan = gh - 0.1;
    // Control column: face screen, keypad and coin slot.
    g.add(mesh(boxG(0.36, 1.5, 0.02), dark, px, gy, front + 0.005, false));
    this.faces = { idle: vendyFace('idle'), blink: vendyFace('blink'), happy: vendyFace('happy') };
    this.screen = new THREE.MeshBasicMaterial({ map: this.faces.idle, toneMapped: false });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.24), this.screen);
    screen.position.set(px, gy + 0.5, front + 0.018);
    g.add(screen);
    const key = mat('#3a4150', { metal: 0.4, rough: 0.4 });
    const lit = mat('#ffd166', { emissive: '#ffb020', ei: 1.2 });
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) g.add(mesh(boxG(0.075, 0.055, 0.03), r === 3 && c === 2 ? lit : key, px - 0.09 + c * 0.09, gy + 0.2 - r * 0.075, front + 0.02, false));
    g.add(mesh(boxG(0.12, 0.03, 0.03), mat('#ffd166', { emissive: '#ffd166', ei: 0.8 }), px, gy - 0.22, front + 0.02, false));
    g.add(mesh(boxG(0.2, 0.12, 0.03), mat('#16202e', { emissive: '#3fd0ff', ei: 0.5 }), px, gy - 0.45, front + 0.02, false));
    // Pickup tray.
    g.add(mesh(boxG(1.05, 0.3, 0.04), chrome, -0.1, base + 0.3, front + 0.02, false));
    g.add(mesh(boxG(0.95, 0.2, 0.04), dark, -0.1, base + 0.3, front + 0.03, false));
    // The hologram bolt spinning above her, so the shop is easy to spot across a room.
    this.holo = new THREE.Group();
    this.holoU = holoUniforms('#ffd166');
    this.holoU.build.value = 1;
    this.holoU.base.value = -1e3;
    this.holoU.top.value = 1e3;
    const holoMat = holoMaterial(this.holoU, { fill: 0.45, dim: 0 });
    const hex = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 6).rotateX(Math.PI / 2), holoMat);
    this.holo.add(hex, new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.018, 6, 6).rotateZ(Math.PI / 6), holoMat));
    this.holo.add(glowSprite('#ffd166', 0.9, 0.18));
    this.holo.position.set(0, base + H + 0.6, 0);
    g.add(this.holo);
    // Face the room: turn toward the open side of the cell.
    const open = [
      [0, 1, 0],
      [1, 0, Math.PI / 2],
      [0, -1, Math.PI],
      [-1, 0, -Math.PI / 2],
    ].find(([dx, dz]) => {
      const c = world.grid.cell(cx + dx, cz + dz);
      return c.kind !== 'wall' && c.kind !== 'void';
    });
    g.rotation.y = open ? open[2] : 0;
    this.obj.add(g);
    world.boxes.push(makeBox(x, z, 0.8, 0.8, h, h + H));
    world.addInteractable(this);
  }

  label() {
    return 'SHOP';
  }

  interact() {
    this.setMood('happy');
    this.world.hooks.shop();
  }

  private setMood(m: VendyMood) {
    if (m === this.mood) return;
    this.mood = m;
    this.screen.map = this.faces[m];
  }

  update(dt: number) {
    this.t += dt;
    const p = this.world.player.body;
    const near = Math.hypot(p.x - this.spot.x, p.z - this.spot.z) < 4.5;
    this.blinkT -= dt;
    if (this.blinkT < 0) {
      this.setMood('blink');
      if (this.blinkT < -0.14) this.blinkT = 2.5 + Math.random() * 3;
    } else {
      this.setMood(near ? 'happy' : 'idle');
    }
    this.holo.rotation.y += dt * 1.6;
    this.holoU.time.value = this.t;
    this.holoU.opacity.value = 0.85 + (Math.random() < 0.03 ? -0.4 : 0);
    this.holoU.glitch.value = Math.random() < 0.02 ? 0.8 : Math.max(0.03, this.holoU.glitch.value - dt * 3);
    this.holo.position.y = 0.08 + 2.5 + 0.6 + Math.sin(this.t * 2) * 0.08;
    // The marquee flickers now and then, like old neon.
    const flick = Math.random() < 0.01 ? 0.45 : 1;
    this.signMat.color.setScalar(flick);
    const k = (this.t * 0.45) % 1;
    this.scanner.position.y = this.scanTop - k * this.scanSpan;
    (this.scanner.material as THREE.MeshBasicMaterial).opacity = 0.45 * Math.sin(k * Math.PI);
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      it.rotation.y += dt * (0.6 + (i % 3) * 0.2);
    }
  }
}

export class Sign extends Entity implements Interactable {
  readonly spot: THREE.Vector3;
  range = 2.4;
  private panel: THREE.Mesh;

  constructor(
    world: World,
    id: string,
    cx: number,
    cz: number,
    h: number,
    private text: string,
  ) {
    super(world, id);
    const x = cx2x(cx);
    const z = cx2x(cz);
    this.spot = new THREE.Vector3(x, h, z);
    this.obj.add(mesh(cyl(0.08, 0.1, 1.2, 8), mat('#3a4458', { metal: 0.5 }), x, h + 0.6, z));
    this.panel = mesh(boxG(1, 0.62, 0.05), mat(world.theme.accent, { emissive: world.theme.accent, ei: 0.9, opacity: 0.8 }), x, h + 1.45, z, false);
    this.obj.add(this.panel);
    world.addInteractable(this);
  }

  label() {
    return 'READ';
  }

  interact() {
    this.world.hooks.say([{ who: 'bolt', text: this.text }]);
  }

  update() {
    this.panel.rotation.y = this.world.time * 0.6;
  }
}

export class Trigger extends Entity {
  private done = false;

  constructor(
    world: World,
    id: string,
    private cx: number,
    private cz: number,
    private spec: Extract<Spec, { type: 'trigger' }>,
  ) {
    super(world, id);
    this.done = world.taken.has(id);
  }

  update() {
    if (this.done) return;
    const p = this.world.player;
    const w = this.spec.w ?? 1;
    const d = this.spec.d ?? 1;
    const inX = p.cellX >= this.cx - Math.floor((w - 1) / 2) && p.cellX <= this.cx + Math.ceil((w - 1) / 2);
    const inZ = p.cellZ >= this.cz - Math.floor((d - 1) / 2) && p.cellZ <= this.cz + Math.ceil((d - 1) / 2);
    if (!inX || !inZ || (this.spec.when && !this.world.cond(this.spec.when))) return;
    this.done = true;
    this.world.markTaken(this.id);
    if (this.spec.dialogue) this.world.hooks.say(this.world.dialogue(this.spec.dialogue));
    if (this.spec.event) this.world.event(this.spec.event);
  }
}

export class Exit extends Entity implements Interactable {
  readonly spot: THREE.Vector3;
  range = 2.8;
  /** The disc Jason stands on; it rises during the lift-ride cutscene. */
  readonly pad = new THREE.Group();
  /** How far above the pad's base the heroes stand: on top of the ship's lift disc, or down inside the skiff. */
  readonly floor: number;
  private ring: THREE.Mesh;
  private ringMat: THREE.MeshStandardMaterial;
  private used = false;

  constructor(world: World, id: string, cx: number, cz: number, h: number) {
    super(world, id);
    const x = cx2x(cx);
    const z = cx2x(cz);
    this.spot = new THREE.Vector3(x, h, z);
    this.pad.position.set(x, h, z);
    this.pad.add(mesh(cyl(1.3, 1.4, 0.3, 28), mat('#3a4458', { metal: 0.5 }), 0, 0.15, 0));
    this.ringMat = ownMat('#ff5e6a', { emissive: '#ff5e6a', ei: 1 });
    this.ring = mesh(torus(1.1, 0.1), this.ringMat, 0, 0.35, 0, false);
    this.ring.rotation.x = Math.PI / 2;
    this.pad.add(this.ring);
    this.obj.add(this.pad);
    this.floor = chapterOf(world.def.id) >= 2 ? 0 : 0.3;
    if (chapterOf(world.def.id) >= 2) {
      // Outdoors (Gaia Nova, and the Argonauts' moons) the way out is a hover skiff from the shuttle or the
      // Argo: Jason stands in it and it flies up and away.
      this.planet = true;
      const hull = mat('#e6edf7', { metal: 0.3, rough: 0.4 });
      const trim = mat('#ff8a3d', { rough: 0.5 });
      const boat = mesh(new THREE.CylinderGeometry(1.75, 1.2, 0.7, 20), hull, 0, -0.2, 0);
      boat.scale.set(1.15, 1, 0.85);
      this.pad.add(boat);
      const rail = mesh(torus(1.7, 0.08), trim, 0, 0.75, 0, false);
      rail.rotation.x = Math.PI / 2;
      rail.scale.set(1.15, 0.85, 1);
      this.pad.add(rail);
      for (const sx of [-1, 1]) {
        this.pad.add(mesh(cyl(0.32, 0.4, 1.1, 12), mat('#56637e', { metal: 0.6 }), sx * 1.95, 0.1, 0).rotateX(Math.PI / 2));
        const jet = glowSprite('#7fe6ff', 1.6, 0.8);
        jet.position.set(sx * 1.95, 0.1, -0.7);
        this.pad.add(jet);
      }
    } else {
      for (const sx of [-1, 1]) this.obj.add(mesh(boxG(0.3, 3.6, 0.3), mat('#56637e', { metal: 0.5 }), x + sx * 1.35, h + 1.8, z));
      this.obj.add(mesh(boxG(3, 0.3, 0.3), mat('#56637e', { metal: 0.5 }), x, h + 3.6, z));
    }
    world.addInteractable(this);
  }

  /** On Gaia Nova the exit is a hover skiff rather than a lift. */
  private planet = false;
  /** LUX has said that the bronze mech stays behind. */
  private mechHinted = false;

  label() {
    if (!this.world.canExit() || this.used) return null;
    // The bronze mech is far too big for the skiff: the heroes climb out and leave it behind.
    if (this.world.player.aboard) return null;
    // Not TAKE OFF: in Greek that is the outfit shop’s button for taking clothes off.
    return this.planet ? 'BOARD' : 'RIDE LIFT';
  }

  interact() {
    if (this.used) return;
    this.used = true;
    this.world.rideLift(this);
  }

  update(dt: number) {
    const open = this.world.canExit();
    const b = this.world.player.body;
    if (open && !this.mechHinted && this.world.player.aboard && Math.hypot(b.x - this.spot.x, b.z - this.spot.z) < 9) {
      this.mechHinted = true;
      this.world.hooks.toast('The mech is far too big for the skiff! Press GET OUT and leave it here: it guards the forge now.', 'bolt');
    }
    this.ringMat.color.set(open ? '#3dff8a' : '#ff5e6a');
    this.ringMat.emissive.set(open ? '#3dff8a' : '#ff5e6a');
    this.ring.rotation.z += dt * (open ? 2 : 0.3);
    if (open && Math.random() < 0.2) {
      const p = this.pad.position;
      this.world.particles.emit(p.x + (Math.random() - 0.5) * 2, p.y + 0.3, p.z + (Math.random() - 0.5) * 2, { count: 1, color: '#3dff8a', speed: 0.5, up: 4, life: 0.8, size: 0.4, gravity: 0 });
    }
  }
}

/** A hologram projector that plays a recorded message the first time Jason walks by. */
const HOLO_COLOR: Record<HoloSpeaker, string> = { captain: '#7fe6ff', rosa: '#ff9a9a', hypatia: '#b8ffb0', brennus: '#ff7a6a', atalanta: '#8ff8e4', aeetes: '#ffd166' };
/** How high the figure stands above the floor: on the projector's top plate. */
const HOLO_FEET = 0.32;

export class Holo extends Entity implements Interactable {
  readonly spot: THREE.Vector3;
  range = 2.6;
  played: boolean;
  /** The translucent figure of whoever recorded the message. */
  readonly figure = new THREE.Group();
  /** Set by the log cutscene while this hologram's speaker has the line: they gesture as they talk. */
  talking = false;
  private model: HoloFigure;
  private projector: HoloProjector;
  private u: HoloUniforms;
  private shown = 0;
  private talk = 0;
  /** A burst of interference, fading away. */
  private burst = 0;
  private t = 0;

  constructor(
    world: World,
    id: string,
    cx: number,
    cz: number,
    h: number,
    readonly log: string,
    readonly who: HoloSpeaker,
  ) {
    super(world, id);
    const x = cx2x(cx);
    const z = cx2x(cz);
    this.spot = new THREE.Vector3(x, h, z);
    this.played = world.taken.has(id);
    this.u = holoUniforms(HOLO_COLOR[who]);
    this.projector = makeHoloProjector(this.u);
    this.projector.group.position.copy(this.spot);
    this.obj.add(this.projector.group);
    // A figure made of light, with the speaker's face and clothes, like a recording.
    this.model = makeHoloFigure(who, this.u);
    const f = this.figure;
    f.add(this.model.group);
    f.position.set(x, h + HOLO_FEET, z);
    f.visible = false;
    this.obj.add(f);
    this.u.base.value = h + HOLO_FEET;
    this.u.top.value = h + HOLO_FEET + this.model.height;
    world.addInteractable(this);
  }

  /** How high the figure's eyes are above the floor the projector stands on (for framing it). */
  get headHeight() {
    return HOLO_FEET + this.model.eyes;
  }

  label() {
    return this.played ? 'PLAY LOG' : null;
  }

  interact() {
    this.world.playLog(this);
  }

  /**
   * 0 = hidden, 1 = fully projected. On the way up the beam comes on first and the figure is built
   * from the feet up; on the way down it comes apart from the head, with a burst of interference.
   */
  show(k: number) {
    if (k < this.shown - 0.001 && this.shown > 0.98) this.burst = 1;
    this.shown = k;
  }

  update(dt: number) {
    this.t += dt;
    if (!this.played && !this.world.cutscene) {
      const p = this.world.player.body;
      if (Math.hypot(p.x - this.spot.x, p.z - this.spot.z) < 3.4 && Math.abs(p.y - this.spot.y) < 2) {
        this.played = true;
        this.world.markTaken(this.id);
        this.world.playLog(this);
      }
    }
    const u = this.u;
    const k = this.shown;
    const build = Math.max(0, Math.min(1, (k - 0.12) / 0.88));
    u.time.value = this.t;
    u.build.value = build;
    u.scale.value = window.innerHeight * 0.9;
    // An unplayed projector hums brightly to draw Jason over; a played one idles low.
    const idle = this.played ? 0.18 : 0.42 + Math.sin(this.t * 3) * 0.12;
    u.power.value = Math.max(idle, Math.min(1, k / 0.12));
    // The recording flickers, and now and then the signal breaks up for a moment.
    if (k > 0 && Math.random() < dt * 0.35) this.burst = Math.max(this.burst, 0.5 + Math.random() * 0.5);
    this.burst = Math.max(0, this.burst - dt * 2.5);
    const building = build > 0 && build < 1 ? 0.35 : 0;
    u.glitch.value = Math.min(1, 0.04 + building + this.burst);
    u.opacity.value = 0.9 + Math.sin(this.t * 37) * 0.04 + (Math.random() < 0.03 ? -0.35 : 0) - this.burst * 0.2;
    this.figure.visible = build > 0.001;
    this.talk = damp(this.talk, this.talking ? 1 : 0, 3, dt);
    this.model.pose(this.t, this.talk);
    // The figure turns to face Jason.
    const p = this.world.player.body;
    const face = Math.atan2(p.x - this.spot.x, p.z - this.spot.z);
    this.figure.rotation.y = k > 0.05 ? dampAngle(this.figure.rotation.y, face, 4, dt) : face;
    this.projector.update(this.t, dt, HOLO_FEET + (build * 1.25 - 0.12) * this.model.height);
  }
}

/** A droid switched off in the dark, waiting for someone to fix it: LUX on the ship, IRIS in the jungle. */
export class BoltFind extends Entity implements Interactable {
  readonly spot: THREE.Vector3;
  range = 2.8;
  readonly model: BoltModel;
  /** Set while the wake-up cutscene animates the droid; stops the idle sputtering. */
  waking = false;
  private t = 0;
  private busy = false;

  constructor(
    world: World,
    id: string,
    cx: number,
    cz: number,
    h: number,
    readonly who: CompanionSkin = 'lux',
  ) {
    super(world, id);
    this.model = who === 'iris' ? makeIris() : makeBolt();
    this.spot = new THREE.Vector3(cx2x(cx), h, cx2x(cz));
    this.model.root.position.set(this.spot.x, h + 0.35, this.spot.z);
    this.model.root.rotation.z = 0.9;
    this.model.iris.emissiveIntensity = 0.2;
    this.model.glow.visible = false;
    this.obj.add(this.model.root);
    world.addInteractable(this);
  }

  label() {
    if (this.busy) return null;
    return this.isLux ? 'FIX DRONE' : 'WAKE UP';
  }

  private get isLux() {
    return this.who === 'lux';
  }

  interact() {
    if (this.busy) return;
    this.busy = true;
    this.world.findBolt(this);
  }

  update(dt: number) {
    this.t += dt;
    if (this.waking) return;
    if (Math.random() < 0.015) {
      this.world.particles.emit(this.spot.x + 0.3, this.spot.y + 0.6, this.spot.z, { count: 3, color: '#ffd166', speed: 3, life: 0.3, size: 0.3 });
      this.world.soundAt('sputter', this.spot.x, this.spot.z, 1, 12);
    }
    this.model.iris.emissiveIntensity = Math.random() < 0.05 ? 1.2 : 0.2;
  }
}

export class BreakWall extends Entity implements Target {
  readonly aim: THREE.Vector3;
  radius = 1.2;
  aimable = false;
  private hp = 3;
  private box: Box;
  private block: THREE.Mesh;

  constructor(world: World, id: string, cx: number, cz: number, h: number) {
    super(world, id);
    const x = cx2x(cx);
    const z = cx2x(cz);
    this.aim = new THREE.Vector3(x, h + 1, z);
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const g = c.getContext('2d') as CanvasRenderingContext2D;
    g.fillStyle = world.theme.wall;
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = 4;
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.moveTo(64, 64);
      let px = 64;
      let py = 64;
      for (let k = 0; k < 4; k++) {
        px += (Math.random() - 0.5) * 60;
        py += (Math.random() - 0.5) * 60;
        g.lineTo(px, py);
      }
      g.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.block = mesh(boxG(CELL, 3.2, CELL), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }), x, h + 1.6, z);
    this.obj.add(this.block);
    this.box = makeBox(x, z, CELL / 2, CELL / 2, h - 1, h + PLUG_H, this);
    world.boxes.push(this.box);
    world.addTarget(this);
  }

  hit(): boolean {
    if (!this.alive) return false;
    this.hp -= 1;
    audio.play('break', 0.8);
    this.block.scale.setScalar(0.96);
    if (this.hp <= 0) {
      const w = this.world;
      audio.play('explode');
      w.shake(0.3);
      w.particles.emit(this.aim.x, this.aim.y, this.aim.z, { count: 40, color: w.theme.wall, speed: 8, life: 0.9, size: 0.8, up: 3 });
      w.boxes.splice(w.boxes.indexOf(this.box), 1);
      w.removeTarget(this);
      w.markTaken(this.id);
      w.hooks.toast('A secret passage!', 'bolt');
      this.remove();
    }
    return true;
  }

  update(dt: number) {
    this.block.scale.setScalar(damp(this.block.scale.x, 1, 10, dt));
  }
}
