import * as THREE from 'three';

import { audio } from '../core/audio';
import { haptic } from '../core/bridge';
import { addBolts } from '../core/save';
import { CELL, MECH, PLAYER } from '../core/constants';
import { findKind } from '../game/collectibles';
import { heartCap } from '../game/shop';
import type { World } from '../game/world';
import { chapterOf } from '../levels';
import { Grid } from '../world/grid';
import type { Ability } from '../world/levelTypes';
import { Entity } from './entity';
import { blobShadow, boxG, cone, cyl, glowSprite, mat, mesh, ownMat, sphere, torus } from './models';

interface BoltItem {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  loose: boolean;
  alive: boolean;
  t: number;
  life: number;
  pull: boolean;
}

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const up = new THREE.Vector3(0, 1, 0);
const one = new THREE.Vector3(1, 1, 1);
const p3 = new THREE.Vector3();
const STONE_HUE = new THREE.Color();

/** Every bolt on the deck, drawn as one instanced mesh. */
export class BoltField {
  private mesh: THREE.InstancedMesh;
  private items: BoltItem[] = [];
  private combo = 0;
  private comboT = 0;

  constructor(private world: World) {
    const hex = new THREE.CylinderGeometry(0.26, 0.26, 0.14, 6);
    hex.rotateX(Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(hex, mat('#ffd166', { emissive: '#ffb020', ei: 0.55, metal: 0.8, rough: 0.25 }), 700);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    world.scene.add(this.mesh);
  }

  add(x: number, y: number, z: number, loose = false) {
    const item: BoltItem = { x, y, z, vx: 0, vy: 0, vz: 0, loose, alive: true, t: Math.random() * 6, life: 14, pull: false };
    if (loose) {
      const a = Math.random() * Math.PI * 2;
      const s = 2 + Math.random() * 2.5;
      item.vx = Math.cos(a) * s;
      item.vz = Math.sin(a) * s;
      item.vy = 6 + Math.random() * 3;
    }
    this.items.push(item);
  }

  update(dt: number) {
    const w = this.world;
    const p = w.player.body;
    const magnet = PLAYER.magnetRange + (w.save.upgrades.magnet ?? 0) * 1.6;
    this.comboT -= dt;
    if (this.comboT <= 0) this.combo = 0;
    let n = 0;
    for (const it of this.items) {
      if (!it.alive) continue;
      it.t += dt;
      if (it.loose) {
        it.life -= dt;
        if (it.life <= 0) {
          it.alive = false;
          continue;
        }
        it.vy -= 22 * dt;
        it.x += it.vx * dt;
        it.y += it.vy * dt;
        it.z += it.vz * dt;
        const c = w.grid.cell(Grid.toCell(it.x), Grid.toCell(it.z));
        const floor = c.kind === 'void' || c.kind === 'wall' ? -99 : c.h;
        if (c.kind === 'wall') {
          it.x -= it.vx * dt;
          it.z -= it.vz * dt;
          it.vx *= -0.4;
          it.vz *= -0.4;
        } else if (it.y < floor + 0.3) {
          it.y = floor + 0.3;
          it.vy = Math.abs(it.vy) > 2 ? -it.vy * 0.35 : 0;
          it.vx *= 0.7;
          it.vz *= 0.7;
        }
        if (it.y < -20) it.alive = false;
      }
      const dx = p.x - it.x;
      const dy = p.y + 0.9 - it.y;
      const dz = p.z - it.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < magnet * magnet || it.pull) {
        it.pull = true;
        const d = Math.sqrt(d2) || 1;
        const sp = 16 * dt;
        it.x += (dx / d) * Math.min(d, sp);
        it.y += (dy / d) * Math.min(d, sp);
        it.z += (dz / d) * Math.min(d, sp);
        it.loose = false;
      }
      if (d2 < 0.8) {
        it.alive = false;
        addBolts(w.save, 1);
        this.combo += 1;
        this.comboT = 0.5;
        audio.play('bolt', 1 + Math.min(this.combo, 12) * 0.035);
        w.hooks.hud();
        continue;
      }
      const bob = it.loose ? 0 : Math.sin(it.t * 3) * 0.12;
      q.setFromAxisAngle(up, it.t * 3);
      p3.set(it.x, it.y + bob, it.z);
      m4.compose(p3, q, one);
      this.mesh.setMatrixAt(n++, m4);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.items.length > 400 && this.items.length - n > 200) this.items = this.items.filter((i) => i.alive);
  }
}

/* ---------------- floating collectibles ---------------- */

abstract class Floater extends Entity {
  protected baseY: number;
  protected t = Math.random() * 5;
  protected radius = 1.1;

  constructor(world: World, id: string, cx: number, cz: number, h: number, lift = 1) {
    super(world, id);
    this.baseY = h + lift;
    this.obj.position.set(cx * CELL + CELL / 2, this.baseY, cz * CELL + CELL / 2);
  }

  protected abstract collect(): void;

  update(dt: number) {
    this.t += dt;
    this.obj.position.y = this.baseY + Math.sin(this.t * 2.4) * 0.15;
    this.obj.rotation.y += dt * 1.8;
    const p = this.world.player.body;
    const dx = p.x - this.obj.position.x;
    const dz = p.z - this.obj.position.z;
    const dy = p.y + 0.8 - this.obj.position.y;
    if (dx * dx + dz * dz < this.radius * this.radius && Math.abs(dy) < 1.6 && !this.world.player.down) this.collect();
  }
}

/**
 * A heart: one heart back. While the heroes ride the bronze mech, which has STRENGTH instead of hearts,
 * it shows as a bronze gear instead and mends a slice of the mech's STRENGTH.
 */
export class HeartPickup extends Floater {
  private heart = new THREE.Group();
  private gear = new THREE.Group();

  constructor(world: World, id: string, cx: number, cz: number, h: number, private persistId?: string) {
    super(world, id, cx, cz, h, 0.9);
    this.build();
    this.buildGear();
    this.showAs(world.player.aboard);
  }

  static at(world: World, pos: THREE.Vector3) {
    const h = new HeartPickup(world, `drop${Math.random()}`, Grid.toCell(pos.x), Grid.toCell(pos.z), pos.y - 0.9);
    h.obj.position.set(pos.x, pos.y, pos.z);
    h.baseY = Math.max(pos.y - 0.2, h.baseY);
    return h;
  }

  private build() {
    const red = mat('#ff4d6d', { emissive: '#ff2d55', ei: 0.7, rough: 0.3 });
    const g = new THREE.Group();
    g.add(mesh(sphere(0.2, 14), red, -0.13, 0.08, 0), mesh(sphere(0.2, 14), red, 0.13, 0.08, 0));
    const c = mesh(cone(0.29, 0.42, 16), red, 0, -0.16, 0);
    c.rotation.z = Math.PI;
    g.add(c);
    g.scale.setScalar(1.25);
    this.heart.add(g, glowSprite('#ff4d6d', 1.6, 0.45));
    this.obj.add(this.heart);
  }

  /** A chunky bronze cog with a teal Gardener light in its hub, standing on edge so it rolls round as it spins. */
  private buildGear() {
    const bronze = mat('#c8862e', { emissive: '#7a4a12', ei: 0.35, rough: 0.35, metal: 0.6 });
    const g = new THREE.Group();
    const ring = mesh(torus(0.34, 0.11), bronze, 0, 0, 0);
    g.add(ring);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const tooth = mesh(boxG(0.16, 0.17, 0.18), bronze, Math.cos(a) * 0.48, Math.sin(a) * 0.48, 0);
      tooth.rotation.z = a;
      g.add(tooth);
    }
    const hub = mesh(cyl(0.13, 0.13, 0.2, 14), mat('#5eead4', { emissive: '#2dd4bf', ei: 1.4 }), 0, 0, 0, false);
    hub.rotation.x = Math.PI / 2;
    g.add(hub);
    g.scale.setScalar(1.2);
    this.gear.add(g, glowSprite('#ffc46b', 1.7, 0.45));
    this.obj.add(this.gear);
  }

  private showAs(gear: boolean) {
    this.heart.visible = !gear;
    this.gear.visible = gear;
  }

  update(dt: number) {
    const mech = this.world.player.aboard ? this.world.player.mech : null;
    this.showAs(!!mech);
    // The mech is far wider than a hero: it picks things up from further out.
    this.radius = mech ? Math.max(1.1, mech.radius + 0.6) : 1.1;
    super.update(dt);
  }

  protected collect() {
    const w = this.world;
    const mech = w.player.aboard ? w.player.mech : null;
    if (mech) {
      if (mech.mendGear()) {
        audio.play('heart');
        haptic('light');
      } else {
        addBolts(w.save, 5);
        audio.play('bolt');
      }
      w.particles.emit(this.obj.position.x, this.obj.position.y, this.obj.position.z, { count: 16, color: '#ffc46b', speed: 4, life: 0.5, size: 0.5 });
      if (this.persistId) w.markTaken(this.persistId);
      w.hooks.hud();
      this.remove();
      return;
    }
    if (w.player.hearts >= w.save.maxHearts) {
      addBolts(w.save, 5);
      audio.play('bolt');
    } else {
      w.player.heal(1);
      audio.play('heart');
    }
    w.particles.emit(this.obj.position.x, this.obj.position.y, this.obj.position.z, { count: 16, color: '#ff8aa0', speed: 4, life: 0.5, size: 0.5 });
    if (this.persistId) w.markTaken(this.persistId);
    w.hooks.hud();
    this.remove();
  }
}

/** Violet dash energy: the colour of the DASH button. */
export const ENERGY_COLOR = '#b58cff';

/**
 * A cell of dash energy. Enemies sometimes drop one; the ones placed in a deck sit on a little
 * charger and grow back a few seconds after Jason takes them, so a missed dash jump never strands him.
 */
export class EnergyPickup extends Floater {
  private cell = new THREE.Group();
  private charger: THREE.Group | null = null;
  private regrowT = 0;

  constructor(
    world: World,
    id: string,
    cx: number,
    cz: number,
    h: number,
    private station = false,
  ) {
    super(world, id, cx, cz, h, 1);
    const glass = mat('#e4d6ff', { emissive: ENERGY_COLOR, ei: 1.1, rough: 0.15, opacity: 0.9 });
    const cap = mat('#dfe6f0', { metal: 0.7, rough: 0.3 });
    const c = this.cell;
    c.add(mesh(cyl(0.2, 0.2, 0.46, 16), glass), mesh(cyl(0.23, 0.23, 0.08, 16), cap, 0, 0.27, 0), mesh(cyl(0.23, 0.23, 0.08, 16), cap, 0, -0.27, 0));
    c.add(mesh(cyl(0.08, 0.08, 0.06, 10), cap, 0, 0.34, 0));
    // A lightning flash across the cell.
    const bolt = new THREE.Shape([new THREE.Vector2(0.04, 0.2), new THREE.Vector2(-0.1, -0.02), new THREE.Vector2(0.01, -0.02), new THREE.Vector2(-0.04, -0.2), new THREE.Vector2(0.1, 0.03), new THREE.Vector2(-0.01, 0.03)]);
    const zap = mat('#ffffff', { emissive: '#ffffff', ei: 1.2 });
    for (const s of [1, -1]) {
      const m = mesh(new THREE.ShapeGeometry(bolt), zap, 0, 0, s * 0.205, false);
      if (s < 0) m.rotation.y = Math.PI;
      c.add(m);
    }
    c.add(glowSprite(ENERGY_COLOR, 1.7, 0.5));
    this.obj.add(c);
    if (station) {
      // The charger stays put while the cell above it bobs and spins.
      const g = new THREE.Group();
      g.add(mesh(cyl(0.5, 0.62, 0.22, 20), mat('#3a4458', { metal: 0.5, rough: 0.4 }), 0, 0.11, 0));
      g.add(mesh(torus(0.42, 0.04), mat(ENERGY_COLOR, { emissive: ENERGY_COLOR, ei: 1.2 }), 0, 0.23, 0, false).rotateX(Math.PI / 2));
      g.position.set(this.obj.position.x, h, this.obj.position.z);
      world.scene.add(g);
      this.charger = g;
    }
  }

  static at(world: World, pos: THREE.Vector3) {
    const e = new EnergyPickup(world, `energy${Math.random()}`, Grid.toCell(pos.x), Grid.toCell(pos.z), pos.y - 1);
    e.obj.position.set(pos.x, pos.y, pos.z);
    e.baseY = Math.max(pos.y - 0.2, e.baseY);
    return e;
  }

  update(dt: number) {
    // Chargers only matter (and only show) once Jason owns the Dash Thrusters.
    const usable = this.world.save.abilities.includes('dash');
    if (this.charger) this.charger.visible = usable;
    if (this.regrowT > 0) {
      this.regrowT -= dt;
      const k = Math.max(0, 1 - this.regrowT / 1.2);
      this.cell.scale.setScalar(Math.max(0.001, k));
      if (this.regrowT > 0) return;
    }
    this.obj.visible = usable;
    if (!usable) return;
    super.update(dt);
  }

  protected collect() {
    const w = this.world;
    // Leave it be when Jason is already full.
    if (!w.player.gainEnergy(1)) return;
    audio.play('charged', 1.2);
    haptic('light');
    const o = this.obj.position;
    w.particles.emit(o.x, o.y, o.z, { count: 18, color: ENERGY_COLOR, speed: 4, life: 0.5, size: 0.5 });
    if (!this.station) {
      this.remove();
      return;
    }
    this.regrowT = 7;
    this.cell.scale.setScalar(0.001);
  }
}

/**
 * A memory shard on the ship (a pink crystal), a page of Brennus's journal on Gaia Nova (a glowing gold
 * page), or a Gardener light-stone in chapter 3 (a smooth stone glowing through the rainbow).
 */
export class Shard extends Floater {
  private spark: string;
  /** A light-stone's glow, which drifts through the colours of the rainbow. */
  private stone: THREE.MeshStandardMaterial | null = null;
  private stoneGlow: THREE.Sprite | null = null;

  constructor(world: World, id: string, cx: number, cz: number, h: number) {
    super(world, id, cx, cz, h, 1.2);
    const kind = findKind(chapterOf(world.def.id));
    const page = kind === 'page';
    this.spark = page ? '#ffe08a' : kind === 'stone' ? '#ffffff' : '#ff9ae0';
    if (kind === 'stone') {
      // A smooth river stone with a glowing Gardener rune band around it.
      this.stone = ownMat('#e8e4ff', { emissive: '#ff5e6a', ei: 1.3, rough: 0.25, metal: 0.1 });
      const rock = mesh(new THREE.DodecahedronGeometry(0.36, 1), this.stone);
      rock.scale.set(1, 0.72, 0.86);
      this.obj.add(rock);
      this.obj.add(mesh(torus(0.37, 0.035), mat('#ffffff', { emissive: '#ffffff', ei: 1.4 }), 0, 0, 0, false).rotateX(Math.PI / 2));
      this.stoneGlow = glowSprite('#ffffff', 2.8, 0.55);
      this.obj.add(this.stoneGlow);
    } else if (page) {
      // A slightly curled page, its lines of handwriting glowing, with a red wax seal.
      const paper = mat('#fff4d6', { emissive: '#ffcf5a', ei: 0.7, rough: 0.6 });
      const sheet = mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.9, 12, 1, true, -0.28, 0.56), paper, 0, 0, -1.3, false);
      sheet.material = paper;
      (sheet.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
      this.obj.add(sheet);
      const ink = mat('#c88a2a', { emissive: '#ffb020', ei: 1.2 });
      for (let i = 0; i < 4; i++) this.obj.add(mesh(new THREE.BoxGeometry(0.5 - (i === 3 ? 0.2 : 0), 0.04, 0.02), ink, -0.04, 0.24 - i * 0.14, 0.1, false));
      this.obj.add(mesh(sphere(0.08, 10), mat('#c8202a', { emissive: '#ff3a4c', ei: 0.6 }), 0.2, -0.3, 0.12, false));
      this.obj.add(glowSprite('#ffd166', 2.8, 0.55));
    } else {
      const pink = mat('#ffc6ef', { emissive: '#ff5fc8', ei: 1.4, rough: 0.1, metal: 0.3 });
      const crystal = mesh(new THREE.OctahedronGeometry(0.42), pink);
      crystal.scale.set(0.7, 1.25, 0.7);
      this.obj.add(crystal, glowSprite('#ff6fcf', 2.8, 0.55));
    }
    const ring = mesh(torus(0.62, 0.03), mat('#ffffff', { emissive: page ? '#ffe08a' : kind === 'stone' ? '#ffffff' : '#ffc6ef', ei: 1 }), 0, 0, 0, false);
    ring.rotation.x = Math.PI / 2;
    this.obj.add(ring);
  }

  update(dt: number) {
    super.update(dt);
    if (this.stone && this.stoneGlow) {
      // Red, orange, yellow, green, blue, violet... and round again.
      STONE_HUE.setHSL((this.world.time * 0.12) % 1, 0.95, 0.6);
      this.stone.emissive.copy(STONE_HUE);
      this.stoneGlow.material.color.copy(STONE_HUE);
      this.spark = '#' + STONE_HUE.getHexString();
    }
    if (Math.random() < 0.15) {
      const o = this.obj.position;
      this.world.particles.emit(o.x, o.y, o.z, { count: 1, color: this.spark, speed: 1.5, life: 0.8, size: 0.35, gravity: -1 });
    }
  }

  protected collect() {
    const w = this.world;
    audio.play('shard');
    haptic('success');
    const o = this.obj.position;
    w.particles.emit(o.x, o.y, o.z, { count: 40, color: this.spark, speed: 7, life: 0.9, size: 0.6 });
    w.collect('shard', this.id);
    this.remove();
  }
}

export class Canister extends Floater {
  constructor(world: World, id: string, cx: number, cz: number, h: number) {
    super(world, id, cx, cz, h, 1.1);
    const glass = mat('#ffd0da', { emissive: '#ff4d6d', ei: 0.6, rough: 0.1, opacity: 0.85 });
    const cap = mat('#e6edf7', { metal: 0.6, rough: 0.3 });
    this.obj.add(mesh(cyl(0.34, 0.34, 0.6, 18), glass), mesh(cyl(0.38, 0.38, 0.12, 18), cap, 0, 0.36, 0), mesh(cyl(0.38, 0.38, 0.12, 18), cap, 0, -0.36, 0));
    const red = mat('#ff2d55', { emissive: '#ff2d55', ei: 1 });
    const heart = new THREE.Group();
    heart.add(mesh(sphere(0.12, 10), red, -0.08, 0.05, 0), mesh(sphere(0.12, 10), red, 0.08, 0.05, 0));
    const c = mesh(cone(0.17, 0.26, 12), red, 0, -0.1, 0);
    c.rotation.z = Math.PI;
    heart.add(c);
    this.obj.add(heart, glowSprite('#ff4d6d', 2.4, 0.5));
  }

  protected collect() {
    const w = this.world;
    audio.play('upgrade');
    haptic('success');
    const o = this.obj.position;
    w.particles.emit(o.x, o.y, o.z, { count: 40, color: '#ff8aa0', speed: 7, life: 0.9, size: 0.6 });
    w.collect('canister', this.id);
    w.save.maxHearts = Math.min(heartCap(w.save), w.save.maxHearts + 1);
    w.player.heal(99);
    w.hooks.toast('Heart Canister! Max hearts +1', 'bolt');
    this.remove();
  }
}

const ABILITY_LOOK: Record<Ability, { color: string; name: string }> = {
  doubleJump: { color: '#7fe6ff', name: 'Jet Boots' },
  dash: { color: '#ffd166', name: 'Dash Thrusters' },
  glide: { color: '#c6ff7a', name: 'Hover Pack' },
  pulse: { color: '#8ab4ff', name: 'Force Pulse' },
  grapple: { color: '#7fe6ff', name: 'Grapple Hook' },
  mirror: { color: '#bff4ff', name: 'Mirror Shield' },
};

export class UpgradePickup extends Floater {
  private ped: THREE.Group;

  constructor(
    world: World,
    id: string,
    cx: number,
    cz: number,
    h: number,
    private ability: Ability,
  ) {
    super(world, id, cx, cz, h, 1.4);
    const look = ABILITY_LOOK[ability];
    const core = mat(look.color, { emissive: look.color, ei: 1.3, rough: 0.2 });
    const shell = mat('#e6edf7', { metal: 0.6, rough: 0.25 });
    this.obj.add(mesh(sphere(0.38, 20), core), mesh(torus(0.5, 0.07), shell), glowSprite(look.color, 3.4, 0.6));
    const ped = new THREE.Group();
    ped.add(mesh(cyl(0.7, 0.9, 0.5, 20), mat('#3a4458', { metal: 0.5, rough: 0.4 }), 0, 0.25, 0));
    ped.add(mesh(cyl(0.72, 0.72, 0.06, 24), mat(look.color, { emissive: look.color, ei: 1 }), 0, 0.52, 0, false));
    ped.position.set(this.obj.position.x, h, this.obj.position.z);
    world.scene.add(ped);
    this.ped = ped;
  }

  protected collect() {
    const w = this.world;
    audio.play('upgrade');
    haptic('success');
    const o = this.obj.position;
    w.particles.emit(o.x, o.y, o.z, { count: 60, color: ABILITY_LOOK[this.ability].color, speed: 8, life: 1, size: 0.7 });
    w.unlock(this.ability, this.id);
    this.ped.children[1].visible = false;
    this.remove();
  }
}

export class PowerCell extends Entity {
  private t = 0;
  private held = false;
  readonly model: THREE.Group;
  private home: THREE.Vector3;

  constructor(world: World, id: string, cx: number, cz: number, h: number) {
    super(world, id);
    this.model = new THREE.Group();
    this.model.add(mesh(cyl(0.26, 0.26, 0.7, 16), mat('#bfffd0', { emissive: '#3dff8a', ei: 1.3, rough: 0.1, opacity: 0.9 })));
    this.model.add(mesh(cyl(0.3, 0.3, 0.12, 16), mat('#e6edf7', { metal: 0.6 }), 0, 0.4, 0), mesh(cyl(0.3, 0.3, 0.12, 16), mat('#e6edf7', { metal: 0.6 }), 0, -0.4, 0));
    this.model.add(glowSprite('#3dff8a', 2, 0.5));
    this.home = new THREE.Vector3(cx * CELL + CELL / 2, h + 1, cz * CELL + CELL / 2);
    this.model.position.copy(this.home);
    this.obj.add(this.model);
    this.obj.add(blobShadow(1).translateX(this.home.x).translateZ(this.home.z).translateY(h + 0.03));
  }

  get isHeld() {
    return this.held;
  }

  place() {
    this.held = false;
    this.world.player.carrying = null;
    this.world.markTaken(this.id);
    this.remove();
  }

  update(dt: number) {
    this.t += dt;
    const pl = this.world.player;
    if (!this.held) {
      this.model.position.y = this.home.y + Math.sin(this.t * 2) * 0.15;
      this.model.rotation.y += dt;
      const dx = pl.body.x - this.home.x;
      const dz = pl.body.z - this.home.z;
      if (dx * dx + dz * dz < 1.4 && Math.abs(pl.body.y + 1 - this.home.y) < 1.6 && !pl.carrying) {
        this.held = true;
        pl.carrying = this.model;
        this.obj.children[1].visible = false;
        audio.play('upgrade');
        this.world.hooks.toast('Power cell! Bring it to an empty socket.', 'bolt');
      }
    } else {
      this.model.position.set(pl.body.x, pl.body.y + 2.35 + Math.sin(this.t * 3) * 0.08, pl.body.z);
      this.model.rotation.y += dt * 2;
    }
  }
}

