import * as THREE from 'three';

import { audio } from '../../core/audio';
import { tr } from '../../core/i18n';
import { damp } from '../../core/math';
import { addBolts } from '../../core/save';
import type { World } from '../../game/world';
import { Grid } from '../../world/grid';
import { Enemy } from '../enemies';
import type { HitKind } from '../entity';
import { makeHarpyModel } from './harpyModel';

/**
 * A HARPY DRONE, one of Aeëtes's gold thief birds (chapter 3). It circles above Jason, flashes its
 * red eye and screeches (the warning), then swoops in a straight line and snatches a handful of
 * bolts, and flies home with them in its sack. Blast it (or arrow it) and it drops everything it
 * carries. A spin or kick bats it away mid-swoop. It never hurts unless there are no bolts to take.
 */
export const HARPY_TUNING = {
  hp: 2,
  /** Height above Jason while circling, and the circle's radius. */
  hover: 3.2,
  orbit: 5.5,
  /** The red-eye warning before a swoop, the swoop's speed and longest time, and the rest between swoops. */
  warn: 0.85,
  swoop: 13,
  swoopTime: 1.1,
  rest: 3.2,
  /** Bolts snatched per swoop, and the most one drone will carry. */
  grab: 5,
  carry: 25,
};

type Mode = 'idle' | 'circle' | 'warn' | 'swoop' | 'climb' | 'flee';

const v = new THREE.Vector3();

let HarpyClass: (new (world: World, id: string, x: number, y: number, z: number) => Enemy) | null = null;

/** Builds a harpy drone (the class extends `Enemy`, so it is defined on first use, like the robots). */
export function makeHarpy(world: World, id: string, x: number, y: number, z: number): Enemy {
  HarpyClass ??= harpyClass();
  return new HarpyClass(world, id, x, y, z);
}

function harpyClass() {
  const T = HARPY_TUNING;
  return class Harpy extends Enemy {
    private mode: Mode = 'idle';
    private modeT = 1 + Math.random() * 2;
    private orbitA = Math.random() * Math.PI * 2;
    private dir = new THREE.Vector3();
    private baseY: number;
    /** Bolts in the sack. */
    stolen = 0;
    private m: ReturnType<typeof makeHarpyModel>;

    constructor(world: World, id: string, x: number, y: number, z: number) {
      const model = makeHarpyModel();
      super(world, id, x, y + 2.8, z, T.hp, 0.5, model);
      this.m = model;
      this.flying = true;
      this.contact = false;
      this.kind = 'harpy';
      this.bolts = 3;
      this.aimHeight = 0;
      this.badgeY = 1.1;
      this.baseY = y + 2.8;
    }

    hit(dmg: number, kind: HitKind, from: THREE.Vector3): boolean {
      const ok = super.hit(dmg, kind, from);
      // Knocked out of a swoop: it tumbles back up.
      if (ok && this.alive && this.mode === 'swoop') this.setMode('climb', 1);
      return ok;
    }

    die() {
      if (!this.alive) return;
      if (this.stolen > 0) {
        this.world.dropBolts(this.aim, this.stolen);
        this.world.hooks.toast(tr('Got them back! The harpy drone dropped {n} bolts.', { n: this.stolen }), 'bolt');
        this.stolen = 0;
      }
      super.die();
    }

    private setMode(m: Mode, t: number) {
      this.mode = m;
      this.modeT = t;
    }

    /** Snatches bolts out of Jason's pocket (or, if he has none, gives him a peck). */
    private grab() {
      const w = this.world;
      const pl = this.player;
      if (pl.spinning) {
        // A spin (or Atalanta's kick) bats it away.
        this.hit(1, 'spin', new THREE.Vector3(pl.body.x, pl.body.y, pl.body.z));
        return;
      }
      // The tier can be a fraction (it grows with upgrades), but a sack only holds whole bolts.
      const n = Math.floor(Math.min(T.grab + this.tier, w.save.bolts, T.carry - this.stolen));
      if (n > 0) {
        addBolts(w.save, -n);
        this.stolen += n;
        this.m.sack.visible = true;
        audio.play('bolt', 0.7);
        audio.play('glide', 1.8);
        w.particles.emit(pl.body.x, pl.body.y + 1.2, pl.body.z, { count: 14, color: '#ffd166', speed: 4, life: 0.5, size: 0.4, up: 2 });
        w.hooks.toast(tr('A harpy drone snatched {n} bolts! Blast it before it gets away!', { n }), 'bolt');
        w.hooks.hud();
      } else {
        pl.hurt(1, this.body.x, this.body.z);
      }
    }

    protected think(dt: number) {
      const b = this.body;
      const p = this.player.body;
      const g = this.world.grid;
      this.modeT -= dt;
      let tx = this.home.x + Math.cos(this.t * 0.7) * 1.6;
      let tz = this.home.z + Math.sin(this.t * 0.7) * 1.6;
      let ty = this.baseY + Math.sin(this.t * 2) * 0.3;
      let follow = 1.6;
      const full = this.stolen >= T.carry;
      switch (this.mode) {
        case 'idle':
          if (this.aggro && !full && this.modeT <= 0) this.setMode('circle', T.rest / this.rate);
          break;
        case 'circle':
          this.orbitA += dt * 0.9 * this.spd;
          tx = p.x + Math.cos(this.orbitA) * T.orbit;
          tz = p.z + Math.sin(this.orbitA) * T.orbit;
          ty = p.y + T.hover + Math.sin(this.t * 3) * 0.2;
          if (!this.aggro) this.setMode('idle', 1);
          else if (this.modeT <= 0) {
            this.setMode('warn', T.warn);
            audio.play('roar', 2.2, 0.35);
          }
          break;
        case 'warn':
          // Hangs in the air, flapping hard, red eye blazing: "here I come!"
          tx = b.x;
          tz = b.z;
          ty = b.y;
          if (this.modeT <= 0) {
            this.setMode('swoop', T.swoopTime);
            this.dir.copy(this.lead(0.15)).sub(v.set(b.x, b.y, b.z)).normalize();
            audio.play('dash', 1.5, 0.6);
          }
          break;
        case 'swoop': {
          const s = T.swoop * this.spd * dt;
          const nx = b.x + this.dir.x * s;
          const nz = b.z + this.dir.z * s;
          if (g.cell(Grid.toCell(nx), Grid.toCell(nz)).kind !== 'wall') {
            b.x = nx;
            b.z = nz;
          }
          b.y = Math.max(p.y + 0.7, b.y + this.dir.y * s);
          const dx = p.x - b.x;
          const dz = p.z - b.z;
          if (dx * dx + dz * dz < 1.3 && Math.abs(p.y + 1 - b.y) < 1.6) {
            this.grab();
            if (this.alive) this.setMode(this.stolen > 0 ? 'flee' : 'climb', this.stolen > 0 ? 6 : 1);
          } else if (this.modeT <= 0) this.setMode('climb', 1);
          return this.pose(dt, true);
        }
        case 'climb':
          tx = b.x;
          tz = b.z;
          ty = p.y + T.hover;
          if (this.modeT <= 0) this.setMode('circle', T.rest / this.rate);
          break;
        case 'flee':
          // Off home with the loot, high up; it comes back for more after a while.
          ty = this.baseY + 1.5;
          follow = 1.2;
          if (this.modeT <= 0 && !full) this.setMode('circle', T.rest / this.rate);
          break;
      }
      const nx = damp(b.x, tx, follow, dt);
      const nz = damp(b.z, tz, follow, dt);
      if (g.cell(Grid.toCell(nx), Grid.toCell(nz)).kind !== 'wall') {
        b.x = nx;
        b.z = nz;
      }
      b.y = damp(b.y, ty, 2.5, dt);
      this.pose(dt, false);
    }

    private pose(dt: number, swooping: boolean) {
      const b = this.body;
      const warn = this.mode === 'warn';
      if (swooping) this.yaw = Math.atan2(this.dir.x, this.dir.z);
      else this.facePlayer(dt, 5);
      const speed = warn ? 30 : swooping ? 4 : 12;
      const flap = swooping ? 0.9 : Math.sin(this.t * speed) * 0.55;
      this.m.wings[0].rotation.z = flap;
      this.m.wings[1].rotation.z = -flap;
      this.m.body.rotation.x = swooping ? 0.7 : 0.1 + Math.sin(this.t * 2) * 0.05;
      for (const c of this.m.claws) c.rotation.x = swooping ? -0.9 : 0;
      this.m.eyeMat.emissiveIntensity = warn ? 3 + Math.sin(this.t * 40) * 2 : 2;
      this.m.sack.visible = this.stolen > 0;
      this.m.sack.scale.setScalar(0.7 + Math.min(1, this.stolen / T.carry) * 0.7);
      if (this.stolen > 0 && Math.random() < dt * 4) this.world.particles.emit(b.x, b.y - 0.5, b.z, { count: 1, color: '#ffd166', speed: 0.5, life: 0.5, size: 0.3, gravity: 2 });
      const shadow = this.m.parts.shadow;
      const c = this.world.grid.cell(Grid.toCell(b.x), Grid.toCell(b.z));
      shadow.visible = c.kind !== 'void';
      shadow.position.y = c.h - b.y + 0.03;
    }
  };
}
