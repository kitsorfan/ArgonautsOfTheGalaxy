import * as THREE from 'three';

import { CELL, GRAPPLE, OUTDOOR } from '../core/constants';
import { damp } from '../core/math';
import type { World } from '../game/world';
import { Entity, type Interactable } from './entity';
import { cyl, glowSprite, mat, mesh, ownMat, sphere, torus } from './models';
import type { Player } from './player';
import type { FloorFx } from './props';

/**
 * Gadgets of the Gaia Nova regions: grapple anchors, wind gusts, quicksand and rolling boulders.
 */

const cx2x = (c: number) => c * CELL + CELL / 2;

/** A glowing ring on a post. With the GRAPPLE hook, Jason zips over to it from far away and lands on its cell. */
export class Anchor extends Entity implements Interactable {
  readonly spot: THREE.Vector3;
  range = GRAPPLE.range * CELL;
  reachY = GRAPPLE.rise;
  /** Anchors are picked by where Jason is facing, not just by distance. */
  aimed = true;
  private ring: THREE.Mesh;
  private ringMat: THREE.MeshStandardMaterial;
  private glow: THREE.Sprite;
  private t = Math.random() * 5;

  constructor(world: World, id: string, cx: number, cz: number, h: number) {
    super(world, id);
    const x = cx2x(cx);
    const z = cx2x(cz);
    this.spot = new THREE.Vector3(x, h, z);
    const post = world.theme.outdoor?.ground === 'sand' ? '#c8a478' : '#5a5250';
    this.obj.add(mesh(cyl(0.12, 0.18, 2.4, 8), mat(post, { rough: 0.7 }), x - 0.7, h + 1.2, z - 0.7));
    this.obj.add(mesh(cyl(0.45, 0.55, 0.16, 12), mat(post, { rough: 0.7 }), x - 0.7, h + 0.08, z - 0.7));
    this.ringMat = ownMat('#7fe6ff', { emissive: '#3fb6ff', ei: 0.6 });
    this.ring = mesh(torus(0.42, 0.08), this.ringMat, x - 0.7, h + 2.75, z - 0.7, false);
    this.obj.add(this.ring);
    this.glow = glowSprite('#7fe6ff', 2.2, 0);
    this.glow.position.copy(this.ring.position);
    this.obj.add(this.glow);
    world.addInteractable(this);
  }

  /** Where the rope hooks on. */
  get hook() {
    return this.ring.position;
  }

  /** True once Jason owns the grapple hook. */
  private get hooked() {
    return this.world.save.abilities.includes('grapple');
  }

  label() {
    const w = this.world;
    const p = w.player;
    if (!this.hooked || p.zipping) return null;
    const b = p.body;
    if (Math.hypot(b.x - this.spot.x, b.z - this.spot.z) < 2.6 && Math.abs(b.y - this.spot.y) < 1) return null;
    return w.canGrapple(this.spot) ? 'GRAPPLE' : null;
  }

  interact() {
    if (this.label()) this.world.player.grappleTo(this.spot, this.hook);
  }

  update(dt: number) {
    this.t += dt;
    // Grapple Range (a Gaia Nova upgrade) lets Jason reach rings from a little farther away.
    this.range = this.world.player.grappleRange * CELL;
    const has = this.hooked;
    const focused = this.world.focus === this;
    // Within reach (but not yet faced) it pulses, so Jason can tell from afar that this ring is one to turn to.
    const b = this.world.player.body;
    const near = has && Math.hypot(b.x - this.spot.x, b.z - this.spot.z) <= this.range && Math.abs(b.y - this.spot.y) <= this.reachY;
    this.ring.rotation.y += dt * (focused ? 4 : near ? 2 : 1);
    const lit = !has ? 0.3 : focused ? 3 + Math.sin(this.t * 8) * 0.6 : near ? 2 + Math.sin(this.t * 4) * 0.8 : 1.2;
    this.ringMat.emissiveIntensity = damp(this.ringMat.emissiveIntensity, lit, 8, dt);
    this.glow.material.opacity = damp(this.glow.material.opacity, focused ? 0.7 : near ? 0.5 + Math.sin(this.t * 4) * 0.15 : has ? 0.25 : 0, 6, dt);
  }
}

/**
 * A gust zone: every `period` seconds the wind (sand, snow or ash) blows across it for a moment and
 * shoves Jason along. Streaks of dust warn of the gust just before it starts.
 */
export class Wind extends Entity {
  private x0: number;
  private x1: number;
  private z0: number;
  private z1: number;
  private y: number;
  private dir: THREE.Vector2;

  constructor(
    world: World,
    id: string,
    cx: number,
    cz: number,
    h: number,
    dx: number,
    dz: number,
    w = 5,
    d = 5,
    private period = 4,
    private offset = 0,
    private strength = OUTDOOR.wind,
  ) {
    super(world, id);
    this.x0 = (cx - Math.floor(w / 2)) * CELL;
    this.x1 = (cx + Math.ceil(w / 2)) * CELL;
    this.z0 = (cz - Math.floor(d / 2)) * CELL;
    this.z1 = (cz + Math.ceil(d / 2)) * CELL;
    this.y = h;
    this.dir = new THREE.Vector2(dx, dz).normalize();
  }

  /** 0 = calm, between 0 and 1 = the warning, 1 = blowing. */
  private phase(): number {
    const t = (this.world.time + this.offset) % this.period;
    const start = this.period - OUTDOOR.gust;
    if (t >= start) return 1;
    if (t >= start - OUTDOOR.gustWarn) return 0.5;
    return 0;
  }

  update(dt: number) {
    const w = this.world;
    const ph = this.phase();
    const color = w.theme.outdoor?.ground === 'snow' ? '#ffffff' : w.theme.outdoor?.ground === 'basalt' ? '#6a4a40' : '#f0d8a8';
    if (ph > 0 && Math.random() < (ph === 1 ? 0.9 : 0.3)) {
      // Streaks start on the upwind side and race across the zone.
      const along = Math.random();
      const sx = this.dir.x > 0 ? this.x0 : this.dir.x < 0 ? this.x1 : this.x0 + along * (this.x1 - this.x0);
      const sz = this.dir.y > 0 ? this.z0 : this.dir.y < 0 ? this.z1 : this.z0 + along * (this.z1 - this.z0);
      const px = this.dir.x !== 0 ? sx : this.x0 + Math.random() * (this.x1 - this.x0);
      const pz = this.dir.y !== 0 ? sz : this.z0 + Math.random() * (this.z1 - this.z0);
      w.particles.emit(px, this.y + 0.4 + Math.random() * 2.2, pz, {
        count: ph === 1 ? 3 : 1,
        color,
        speed: 0.3,
        life: 0.9,
        size: 0.35,
        gravity: 0,
        drag: 0,
        vel: [this.dir.x * 16, 0, this.dir.y * 16],
      });
    }
    if (ph < 1) return;
    const p = w.player;
    const b = p.body;
    if (p.zipping || b.x < this.x0 || b.x > this.x1 || b.z < this.z0 || b.z > this.z1 || b.y < this.y - 1 || b.y > this.y + 6) return;
    // Spinning digs in and halves the push, so there's always a way to hold your ground.
    const k = p.spinning ? 0.5 : 1;
    b.x += this.dir.x * this.strength * k * dt;
    b.z += this.dir.y * this.strength * k * dt;
  }
}

/** Soft sand (or deep snow, or bog): Jason wades slowly, and sinks if he stands in it too long. */
export class Quicksand extends Entity implements FloorFx {
  unsafe = true;
  private disc: THREE.Mesh;

  constructor(world: World, id: string, cx: number, cz: number, h: number) {
    super(world, id);
    const g = world.theme.outdoor?.ground;
    const color = g === 'snow' ? '#c8d8ec' : g === 'jungle' ? '#3a3a18' : g === 'basalt' ? '#4a2a20' : '#b08a52';
    const m = new THREE.MeshStandardMaterial({ color, roughness: 1, transparent: true, opacity: 0.85 });
    this.disc = mesh(new THREE.CircleGeometry(CELL * 0.62, 20), m, cx2x(cx), h + 0.03, cx2x(cz), false);
    this.disc.rotation.x = -Math.PI / 2;
    this.disc.receiveShadow = true;
    this.obj.add(this.disc);
    // A slow swirl in the middle so it reads as "do not stand here".
    const swirl = mesh(torus(0.5, 0.05), mat(color === '#b08a52' ? '#8a6a3a' : color, { rough: 1 }), cx2x(cx), h + 0.05, cx2x(cz), false);
    swirl.rotation.x = Math.PI / 2;
    swirl.scale.set(1, 1, 0.2);
    this.obj.add(swirl);
    world.registerFloor(cx, cz, this);
  }

  stand(p: Player, dt: number) {
    p.wade(dt);
  }

  update(dt: number) {
    this.disc.rotation.z += dt * 0.4;
  }
}

/**
 * A lane that a boulder rolls down every `period` seconds: rocks in the mountains and the desert,
 * snowballs in the tundra, lava bombs on the volcano. A rumble and a puff of dust give a moment's warning.
 */
export class Boulder extends Entity {
  private rock: THREE.Group;
  private from: THREE.Vector3;
  private to: THREE.Vector3;
  private len: number;
  private rolling = false;
  private warned = false;

  constructor(
    world: World,
    id: string,
    cx: number,
    cz: number,
    h: number,
    axis: 'x' | 'z',
    length: number,
    private period = 4,
    private offset = 0,
  ) {
    super(world, id);
    const x = cx2x(cx);
    const z = cx2x(cz);
    this.from = new THREE.Vector3(x, h + OUTDOOR.boulderRadius, z);
    const dx = axis === 'x' ? Math.sign(length) : 0;
    const dz = axis === 'z' ? Math.sign(length) : 0;
    this.to = new THREE.Vector3(x + dx * Math.abs(length) * CELL, h + OUTDOOR.boulderRadius, z + dz * Math.abs(length) * CELL);
    this.len = this.from.distanceTo(this.to);
    const g = world.theme.outdoor?.ground;
    const color = g === 'snow' ? '#f4f8ff' : g === 'basalt' ? '#3a2220' : world.theme.outdoor?.rock ?? '#8a7a68';
    this.rock = new THREE.Group();
    const body = mesh(new THREE.DodecahedronGeometry(OUTDOOR.boulderRadius, g === 'snow' ? 2 : 0), mat(color, { rough: 0.9 }), 0, 0, 0);
    this.rock.add(body);
    if (g === 'basalt') this.rock.add(mesh(sphere(OUTDOOR.boulderRadius * 0.7, 10), mat('#ff6a12', { emissive: '#ff6a12', ei: 1.6 }), 0, 0, 0, false));
    this.rock.visible = false;
    this.obj.add(this.rock);
  }

  update(dt: number) {
    const w = this.world;
    const travel = this.len / OUTDOOR.boulderSpeed;
    const t = (w.time + this.offset) % this.period;
    if (t > this.period - 0.8 && !this.warned) {
      this.warned = true;
      w.soundAt('roar', this.from.x, this.from.z, 0.5, 20);
      w.particles.emit(this.from.x, this.from.y - 0.8, this.from.z, { count: 16, color: '#c8b89a', speed: 3, life: 0.6, size: 0.6, up: 2 });
    }
    const on = t < travel;
    if (on && !this.rolling) this.warned = false;
    this.rolling = on;
    this.rock.visible = on;
    if (!on) return;
    const k = t / travel;
    this.rock.position.lerpVectors(this.from, this.to, k);
    const axis = new THREE.Vector3().subVectors(this.to, this.from).normalize();
    this.rock.rotateOnWorldAxis(new THREE.Vector3(axis.z, 0, -axis.x), (OUTDOOR.boulderSpeed / OUTDOOR.boulderRadius) * dt);
    if (Math.random() < 0.3) w.particles.emit(this.rock.position.x, this.from.y - OUTDOOR.boulderRadius + 0.1, this.rock.position.z, { count: 1, color: '#c8b89a', speed: 1, life: 0.5, size: 0.5 });
    const b = w.player.body;
    const r = OUTDOOR.boulderRadius + b.r;
    const dy = b.y - (this.rock.position.y - OUTDOOR.boulderRadius);
    if ((b.x - this.rock.position.x) ** 2 + (b.z - this.rock.position.z) ** 2 < r * r && dy < OUTDOOR.boulderRadius * 1.7) {
      w.player.hurt(1, this.rock.position.x, this.rock.position.z);
    }
  }
}
