import * as THREE from 'three';

import { audio } from '../../core/audio';
import { haptic } from '../../core/bridge';
import { damp, dampAngle } from '../../core/math';
import type { World } from '../../game/world';
import { Grid } from '../../world/grid';
import { makeBody, moveBody, type Body } from '../../world/physics';
import { Boss, bossHp } from '../bossBase';
import type { HitKind, Interactable, Target } from '../entity';
import { Shockwave, Strike } from '../hazards';
import { blobShadow, boxG, cone, cyl, glowSprite, mat, mesh, ownMat, sphere, torus } from '../models';
import { gearEmblem } from '../robotModels';

type State = 'drive' | 'rev' | 'charge' | 'stunned' | 'dig' | 'kneel';

const CHARGE_SPEED = 12;
/** How close its drill has to be to bump into Brennus (or his shield). */
const REACH = 2.9;

/**
 * THE GOLD EXCAVATOR, the boss of Aeëtes's Mine: "Rumble", General Brennus's old Legion digging
 * machine from the Gorgon, painted gold, with Aeëtes's control box bolted onto its back. HP 24.
 *
 * - It drives round the arena, and now and then digs up ore and flings it: red circles show where
 *   the chunks land (and once it is angry, it also spits ore straight at Brennus: block that with the shield).
 * - It revs up and CHARGES. Hold the SHIELD toward it and it bounces off, dizzy; or step aside and let
 *   it crash into a rock pillar or the wall. Either way it's stunned, and the gold control box on its
 *   back is open: CANNON it (a big blast hurts most), or CHARGE into it.
 * - At zero health it doesn't blow up: it kneels, sparking, and Brennus walks up and COMMANDs it to
 *   stand down. It's his machine again.
 */
export class Excavator extends Boss implements Target, Interactable {
  readonly title = 'THE GOLD EXCAVATOR';
  protected focusHeight = 3;
  readonly aim = new THREE.Vector3();
  radius = 1.4;
  aimable = false;
  readonly spot = new THREE.Vector3();
  range = 5;
  reachY = 4;
  private body: Body;
  private model = new THREE.Group();
  private drill = new THREE.Group();
  private treads: THREE.Mesh[] = [];
  private box: THREE.MeshStandardMaterial;
  private boxGlow: THREE.Sprite;
  private lens: THREE.MeshStandardMaterial;
  private lamps: THREE.MeshStandardMaterial;
  private state: State = 'drive';
  private stateT = 3;
  private count = 0;
  private yaw = 0;
  private dir = new THREE.Vector2();
  private orbit = 0;
  private home: THREE.Vector3;
  private pillars: THREE.Vector3[] = [];
  private hinted = new Set<string>();
  private commanded = false;

  constructor(world: World, id: string, cx: number, cz: number, h: number) {
    super(world, id, cx, cz, h, bossHp(world, 24));
    this.home = this.center.clone();
    this.body = makeBody(this.center.x, h, this.center.z, 2, 3);
    // The rock pillars it can crash into: solid boulders near the arena.
    for (const e of world.level.entities) {
      if (e.spec.type === 'decor' && e.spec.kind === 'boulder' && Math.hypot(e.cx - cx, e.cz - cz) < 16) this.pillars.push(new THREE.Vector3(Grid.center(e.cx), e.h, Grid.center(e.cz)));
    }
    this.box = ownMat('#c89020', { emissive: '#ffb020', ei: 0.3, metal: 0.7, rough: 0.3 });
    this.lens = ownMat('#ff3a3a', { emissive: '#ff3a3a', ei: 1.6 });
    this.lamps = ownMat('#fff4c0', { emissive: '#ffd166', ei: 1 });
    this.boxGlow = glowSprite('#ffc23a', 3, 0);
    this.build();
    world.addTarget(this);
    world.addInteractable(this);
    this.sync(0);
  }

  private build() {
    const m = this.model;
    const gold = mat('#e2b236', { metal: 0.75, rough: 0.3 });
    const olive = mat('#4a5632', { rough: 0.55, metal: 0.35 });
    const dark = mat('#26221e', { rough: 0.7, metal: 0.4 });
    const steel = mat('#9aa0aa', { rough: 0.3, metal: 0.8 });
    // Tank treads on both sides.
    for (const sx of [-1, 1]) {
      const tread = mesh(boxG(0.9, 1.1, 4.4), dark, sx * 1.6, 0.55, 0);
      this.treads.push(tread);
      m.add(tread);
      for (const z of [-1.6, -0.5, 0.6, 1.7]) m.add(mesh(cyl(0.42, 0.42, 0.95, 12), olive, sx * 1.6, 0.55, z).rotateZ(Math.PI / 2));
    }
    // The body: gold paint over the Legion's olive (it shows at the scratches).
    m.add(mesh(boxG(2.6, 1.4, 3.8), gold, 0, 1.6, -0.1));
    m.add(mesh(boxG(2.7, 0.2, 3.9), olive, 0, 2.35, -0.1));
    for (const [x, z] of [
      [-0.9, 1.2],
      [0.7, -1.3],
      [1.1, 0.4],
    ]) {
      m.add(mesh(boxG(0.4, 0.3, 0.05), olive, x, 1.5, z > 0 ? 1.82 : -2.02, false));
    }
    // The cab, with the old Legion face: one big lens (red under Aeëtes's control).
    m.add(mesh(boxG(1.8, 1.3, 1.6), gold, 0, 3.0, 0.6));
    m.add(mesh(sphere(0.42, 16), olive, 0, 3.05, 1.45));
    m.add(mesh(sphere(0.26, 14), this.lens, 0, 3.08, 1.72, false));
    m.add(mesh(torus(0.28, 0.05), mat('#c9a24a', { metal: 0.8, rough: 0.3 }), 0, 3.08, 1.75, false));
    const emblem = gearEmblem(0.3, mat('#c8282e', { emissive: '#c8282e', ei: 0.5 }));
    emblem.position.set(1.33, 1.7, 0);
    emblem.rotation.y = Math.PI / 2;
    m.add(emblem);
    for (const sx of [-0.7, 0.7]) m.add(mesh(sphere(0.16, 10), this.lamps, sx, 2.2, 1.86, false));
    // The big drill on an arm at the front.
    this.drill.position.set(0, 1.4, 2.2);
    this.drill.add(mesh(cyl(0.7, 0.7, 0.5, 16), olive, 0, 0, 0).rotateX(Math.PI / 2));
    const bit = mesh(cone(0.68, 1.9, 16), steel, 0, 0, 1.2);
    bit.rotation.x = Math.PI / 2;
    this.drill.add(bit);
    for (let i = 0; i < 4; i++) {
      const ridge = mesh(torus(0.5 - i * 0.11, 0.05), gold, 0, 0, 0.55 + i * 0.4, false);
      this.drill.add(ridge);
    }
    m.add(this.drill);
    // Aeëtes's control box on its back: the weak spot, glowing when it's open.
    m.add(mesh(boxG(1.3, 1, 1), this.box, 0, 2.9, -1.5));
    m.add(mesh(cyl(0.05, 0.05, 1.2, 6), steel, 0.4, 3.9, -1.5));
    m.add(mesh(sphere(0.12, 8), mat('#ffd166', { emissive: '#ffd166', ei: 2 }), 0.4, 4.5, -1.5, false));
    this.boxGlow.position.set(0, 2.9, -2.1);
    m.add(this.boxGlow);
    m.add(blobShadow(6.5));
    this.obj.add(m);
  }

  get where(): THREE.Vector3 {
    return new THREE.Vector3(this.body.x, this.body.y, this.body.z);
  }

  private get kneeling() {
    return this.state === 'kneel';
  }

  /** COMMAND is only offered once it kneels at zero health. */
  label() {
    return this.kneeling && !this.commanded ? 'COMMAND' : null;
  }

  interact() {
    if (!this.kneeling || this.commanded) return;
    this.commanded = true;
    audio.play('alarm', 1.4, 0.5);
    this.world.rings.burst(this.body.x, this.body.y + 0.05, this.body.z, 9, '#3dff8a', 0.6);
    this.world.hooks.say(this.world.dialogue('command'), () => {
      this.lens.color.set('#3dff8a');
      this.lens.emissive.set('#3dff8a');
      this.finish();
    });
  }

  /** Standing down is not an explosion: a green flash, a happy beep, and the bolts Aeëtes stuffed inside it. */
  protected finish() {
    this.defeated = true;
    const w = this.world;
    const c = this.where;
    audio.play('upgrade');
    haptic('success');
    w.flash(c.x, c.y + 3, c.z, '#3dff8a', 70, 0.8);
    w.particles.emit(c.x, c.y + 3, c.z, { count: 40, color: '#3dff8a', speed: 6, life: 1, size: 0.6, up: 2 });
    w.dropBolts(new THREE.Vector3(c.x, c.y + 2, c.z), 40);
    w.bossDefeated(this);
  }

  private hint(key: string, show: () => void) {
    if (this.hinted.has(key)) return;
    this.hinted.add(key);
    show();
  }

  hit(dmg: number, kind: HitKind): boolean {
    if (!this.started || this.defeated || this.kneeling) return true;
    if (this.state !== 'stunned') {
      audio.play('zap', 1.4);
      this.hint('armour', () => this.world.hooks.toast('Its gold box is shut tight! Stun it first: shield its charge, or make it crash.', 'brennus'));
      return true;
    }
    // A big blast or a charge into the open box hits hardest.
    const n = kind === 'blast' ? dmg + 1 : kind === 'smash' ? dmg + 2 : kind === 'pound' ? dmg + 1 : dmg;
    this.hp = Math.max(0, this.hp - n);
    this.world.hooks.bossBar(this.title, this.hp / this.maxHp);
    this.box.emissiveIntensity = 3.5;
    audio.play('hit', 0.7);
    if (this.hp <= 0) this.kneel();
    return true;
  }

  /** At zero health it sinks down, its control box sparking: waiting for an order. */
  private kneel() {
    this.state = 'kneel';
    this.aimable = false;
    this.world.shots.clear();
    audio.play('explode', 0.8);
    this.world.shake(0.6);
    this.world.particles.emit(this.aim.x, this.aim.y, this.aim.z, { count: 30, color: '#ffd166', speed: 7, life: 0.7, size: 0.5 });
    this.world.hooks.bossBar(null, 0);
    this.world.hooks.toast('It’s powering down! Walk up to it and press COMMAND.', 'brennus');
  }

  reset() {
    this.hp = this.maxHp;
    this.body.x = this.home.x;
    this.body.z = this.home.z;
    this.state = 'drive';
    this.stateT = 3;
    this.count = 0;
    this.commanded = false;
    this.lens.color.set('#ff3a3a');
    this.lens.emissive.set('#ff3a3a');
  }

  protected onStart() {
    this.orbit = Math.atan2(this.body.z - this.home.z, this.body.x - this.home.x);
  }

  /** True if a cliff wall or a rock pillar is right in front of its drill. */
  private blocked(dx: number, dz: number): boolean {
    const b = this.body;
    for (const ahead of [2.4, 3.2]) {
      const x = b.x + dx * ahead;
      const z = b.z + dz * ahead;
      const c = this.world.grid.cell(Grid.toCell(x), Grid.toCell(z));
      if (c.kind === 'wall' || c.kind === 'void' || c.h > b.y + 0.6) return true;
      if (this.pillars.some((p) => Math.hypot(p.x - x, p.z - z) < 1.6)) return true;
    }
    return false;
  }

  /** Dizzy for a few seconds, its control box hanging open. */
  private stun(seconds: number, why: 'shield' | 'crash') {
    const b = this.body;
    this.state = 'stunned';
    this.stateT = seconds;
    audio.play('explode');
    haptic('heavy');
    this.world.shake(0.7);
    this.world.flash(b.x, b.y + 2, b.z, '#ffc23a', 50, 0.4);
    this.world.particles.emit(b.x + this.dir.x * 2.6, b.y + 1.4, b.z + this.dir.y * 2.6, { count: 30, color: '#c8b8a0', speed: 7, life: 0.7, size: 0.8 });
    if (why === 'shield') this.hint('shield', () => this.world.hooks.toast('It bounced right off your shield! Now BLAST the gold box on its back!', 'brennus'));
    else this.hint('crash', () => this.world.hooks.toast('It crashed! The gold box on its back is open: BLAST it!', 'brennus'));
  }

  update(dt: number) {
    this.t += dt;
    const b = this.body;
    if (!this.started) {
      if (this.playerDist() < 13) this.begin();
      this.sync(0);
      return;
    }
    if (this.defeated || this.kneeling) {
      // Kneeling (then resting, its lens green): the drill winds down.
      this.model.rotation.x = damp(this.model.rotation.x, 0.12, 2, dt);
      this.drill.rotation.z += dt * (this.defeated ? 0 : 1.5);
      this.boxGlow.material.opacity = damp(this.boxGlow.material.opacity, 0, 2, dt);
      if (!this.defeated && Math.random() < 0.2) this.world.particles.emit(this.aim.x, this.aim.y, this.aim.z, { count: 2, color: '#ffd166', speed: 3, life: 0.4, size: 0.4 });
      this.spot.set(b.x, b.y, b.z);
      return;
    }
    const p = this.player.body;
    const angry = this.hp < this.maxHp / 2;
    const toX = p.x - b.x;
    const toZ = p.z - b.z;
    this.stateT -= dt;
    let speed = 0;
    let spin = 5;
    switch (this.state) {
      case 'drive': {
        // Rumbles round the middle of the arena.
        this.orbit += dt * 0.5;
        const r = 9;
        const tx = this.home.x + Math.cos(this.orbit) * r - b.x;
        const tz = this.home.z + Math.sin(this.orbit) * r * 0.6 - b.z;
        const td = Math.hypot(tx, tz) || 1;
        this.yaw = dampAngle(this.yaw, Math.atan2(tx, tz), 3, dt);
        speed = Math.min(5, td * 2);
        if (this.stateT <= 0) {
          this.count += 1;
          if (this.count % 3 === 0) {
            this.state = 'dig';
            this.stateT = 2;
          } else {
            this.state = 'rev';
            this.stateT = angry ? 1.0 : 1.4;
            audio.play('roar', 0.5);
            this.hint('rev', () => this.world.hooks.toast('It’s revving up! Raise your SHIELD toward it, or get out of the way!', 'brennus'));
          }
        }
        break;
      }
      case 'rev':
        this.yaw = dampAngle(this.yaw, Math.atan2(toX, toZ), 6, dt);
        spin = 16;
        this.lamps.emissive.set(Math.sin(this.t * 20) > 0 ? '#ff3a4c' : '#ffd166');
        this.lamps.emissiveIntensity = 2.5;
        if (Math.random() < 0.6) this.world.particles.emit(b.x, b.y + 3.6, b.z - 1, { count: 1, color: '#4a4a50', speed: 1, up: 3, life: 0.8, size: 1, gravity: 0 });
        if (this.stateT <= 0) {
          this.state = 'charge';
          this.stateT = 3;
          this.dir.set(Math.sin(this.yaw), Math.cos(this.yaw));
          audio.play('dash', 0.5);
          haptic('medium');
        }
        break;
      case 'charge': {
        speed = CHARGE_SPEED;
        spin = 20;
        this.yaw = Math.atan2(this.dir.x, this.dir.y);
        if (Math.random() < 0.7) this.world.particles.emit(b.x - this.dir.x * 2.4, b.y + 0.3, b.z - this.dir.y * 2.4, { count: 2, color: '#c8b8a0', speed: 2, up: 1, life: 0.5, size: 0.9 });
        const fx = b.x + this.dir.x * 2.2;
        const fz = b.z + this.dir.y * 2.2;
        if (Math.hypot(p.x - fx, p.z - fz) < REACH && p.y < b.y + 3) {
          if (this.player.shieldBlocks(b.x, b.z)) {
            // CLANG. It bounces off the old general's shield.
            this.player.hurt(1, b.x, b.z);
            b.x -= this.dir.x * 1.2;
            b.z -= this.dir.y * 1.2;
            speed = 0;
            this.stun(angry ? 3.4 : 4, 'shield');
            break;
          }
          this.player.hurt(1, b.x, b.z);
        }
        if (this.blocked(this.dir.x, this.dir.y) || this.stateT <= 0) {
          speed = 0;
          this.stun(angry ? 3 : 3.6, 'crash');
        }
        break;
      }
      case 'stunned':
        spin = 0;
        if (Math.random() < 0.25) this.world.particles.emit(b.x, b.y + 4, b.z, { count: 1, color: '#ffd166', speed: 2, up: 2, life: 0.4, size: 0.5, gravity: 2 });
        if (this.stateT <= 0) {
          this.state = 'drive';
          this.stateT = angry ? 2.2 : 3;
          b.x -= this.dir.x * 1.2;
          b.z -= this.dir.y * 1.2;
          this.world.addEntity(new Shockwave(this.world, b.x, b.y, b.z, 12, 7, '#ffc23a'));
          audio.play('pound');
          this.orbit = Math.atan2(b.z - this.home.z, b.x - this.home.x);
        }
        break;
      case 'dig':
        // Scoops up ore and flings it where Brennus stands (and, once angry, spits chunks straight at him).
        spin = 24;
        if (this.stateT <= 1.2 && this.stateT + dt > 1.2) {
          const n = angry ? 5 : 3;
          for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = i === 0 ? 0 : 2 + Math.random() * 3;
            this.world.addEntity(new Strike(this.world, p.x + Math.cos(a) * r, b.y, p.z + Math.sin(a) * r, 1.2, 1.2, '#ffc23a', 'rock'));
          }
          audio.play('pound', 1.3);
        }
        if (angry && this.stateT <= 0.6 && this.stateT + dt > 0.6) {
          const from = new THREE.Vector3(b.x + Math.sin(this.yaw) * 2.4, b.y + 1.6, b.z + Math.cos(this.yaw) * 2.4);
          for (const k of [-0.25, 0, 0.25]) {
            const dir = new THREE.Vector3(p.x - from.x, 0, p.z - from.z).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), k);
            this.world.shots.fire('enemy', from, dir, 9, 1);
          }
          audio.play('enemyShoot', 0.6);
        }
        this.yaw = dampAngle(this.yaw, Math.atan2(toX, toZ), 3, dt);
        if (this.stateT <= 0) {
          this.state = 'drive';
          this.stateT = 2.6;
        }
        break;
    }
    b.vx = Math.sin(this.yaw) * speed;
    b.vz = Math.cos(this.yaw) * speed;
    moveBody(b, dt, this.world.grid, [], { stepUp: 0.6 });
    this.drill.rotation.z += dt * spin;
    for (const t of this.treads) t.position.y = 0.55 + (speed > 0 ? Math.sin(this.t * 30) * 0.03 : 0);
    this.lamps.emissiveIntensity = damp(this.lamps.emissiveIntensity, 1, 4, dt);
    if (this.state !== 'rev') this.lamps.emissive.set('#ffd166');
    const open = this.state === 'stunned';
    this.aimable = open;
    this.box.emissiveIntensity = damp(this.box.emissiveIntensity, open ? 2.2 + Math.sin(this.t * 10) * 0.6 : 0.3, 6, dt);
    this.boxGlow.material.opacity = damp(this.boxGlow.material.opacity, open ? 0.85 : 0, 6, dt);
    this.model.rotation.z = open ? Math.sin(this.t * 6) * 0.04 : 0;
    this.sync(speed);
    // Bumping into its drill or treads hurts (not while it's dizzy).
    if (!open && this.state !== 'charge' && Math.hypot(toX, toZ) < 2.4 && p.y < b.y + 2.8) this.player.hurt(1, b.x, b.z);
  }

  private sync(speed: number) {
    const b = this.body;
    this.model.position.set(b.x, b.y + (speed > 8 ? Math.sin(this.t * 30) * 0.05 : 0), b.z);
    this.model.rotation.y = this.yaw;
    // The control box sits on its back.
    this.aim.set(b.x - Math.sin(this.yaw) * 1.5, b.y + 2.9, b.z - Math.cos(this.yaw) * 1.5);
    this.spot.set(b.x, b.y, b.z);
  }
}
