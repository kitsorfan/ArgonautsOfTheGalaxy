import * as THREE from 'three';

import { audio } from '../../core/audio';
import { haptic } from '../../core/bridge';
import { damp, dampAngle } from '../../core/math';
import type { World } from '../../game/world';
import { Grid } from '../../world/grid';
import { makeBody, moveBody, type Body } from '../../world/physics';
import { Boss, bossHp } from '../bossBase';
import type { HitKind, Target } from '../entity';
import { Shockwave } from '../hazards';
import { makeRam, type RamParts } from './ramModels';
import { Dropship } from './ships';

type State = 'walk' | 'paw' | 'charge' | 'locked' | 'shoved' | 'open' | 'dazed' | 'stomp' | 'down';

/** THE GOLDEN RAM's numbers (fair for kids: long warnings, long open windows). */
export const RAM_TUNING = {
  hp: 30,
  scale: 2.8,
  /** Paws the ground this long before every charge (a red lane shows where it will run). */
  paw: 1.4,
  charge: 13,
  chargeTime: 2.6,
  /** Horns stuck in Brennus's shield: this long to CHARGE into it. */
  locked: 3.4,
  shove: 16,
  /** A shove with no pillar behind it only skids this long. */
  shoveTime: 0.8,
  /** How far off a shove may be and still steer into a pillar (cosine of the angle), and how far away that pillar may be. */
  steer: 0.4,
  steerRange: 30,
  /** The engine hatch stays open this long after a crash (a bit shorter once it's furious). */
  open: 6,
  openAngry: 5,
  /** How close its side must come to a pillar to crash into it. */
  crash: 2.9,
};

const REACH = 3.2;

/**
 * THE GOLDEN RAM, the boss of Brennus's Last Stand: Aeëtes's huge golden ram war machine, sent to
 * butt General Brennus off Colchis's sky-dock before the Argo gets through. HP 30.
 *
 * - It paws the ground (a red lane shows where it will run), then CHARGES.
 * - Hold the SHIELD toward it and its horns lock against the shield: it's stuck for a few seconds.
 *   Then CHARGE into it (the DASH button) and shove it backwards into one of the stone pillars. Each
 *   shove is steered a little toward the nearest pillar behind it, so lining up roughly is enough.
 *   (If it misses Brennus and runs into a pillar by itself, that counts too.)
 * - CRASH: the hatch on its back pops open and its engine glows. BLAST the engine (a big blast hurts most).
 * - Below two thirds of its health it rears up and stamps (a shockwave ring: jump it) and a dropship
 *   brings two ramlings; below one third, two of Aeëtes's gold troopers.
 * - At zero it doesn't explode: its engine coughs, sputters and stops, and it lies down like a tired sheep.
 */
export class GoldenRam extends Boss implements Target {
  readonly title = 'THE GOLDEN RAM';
  protected focusHeight = 4;
  readonly aim = new THREE.Vector3();
  radius = 1.4;
  aimable = false;
  private body: Body;
  private ram: RamParts;
  private state: State = 'walk';
  private stateT = 3;
  private yaw = Math.PI;
  private dir = new THREE.Vector2(0, -1);
  private shoveDir = new THREE.Vector2();
  private orbit = 0;
  private count = 0;
  private home: THREE.Vector3;
  private pillars: THREE.Vector3[] = [];
  private lane: THREE.Mesh;
  private hinted = new Set<string>();
  private called = 0;
  private stride = 0;
  private downT = 0;

  constructor(world: World, id: string, cx: number, cz: number, h: number) {
    super(world, id, cx, cz, h, bossHp(world, RAM_TUNING.hp));
    this.home = this.center.clone();
    this.body = makeBody(this.center.x, h, this.center.z, 2, 4.5);
    // The stone pillars round the arena that it can be shoved into.
    for (const e of world.level.entities) {
      if (e.spec.type === 'decor' && e.spec.kind === 'pillar' && Math.hypot(e.cx - cx, e.cz - cz) < 14) this.pillars.push(new THREE.Vector3(Grid.center(e.cx), e.h, Grid.center(e.cz)));
    }
    this.ram = makeRam(true);
    this.ram.root.scale.setScalar(RAM_TUNING.scale);
    this.obj.add(this.ram.root);
    this.lane = new THREE.Mesh(new THREE.PlaneGeometry(4, 24), new THREE.MeshBasicMaterial({ color: '#ff3a4c', transparent: true, opacity: 0.3, depthWrite: false }));
    this.lane.rotation.x = -Math.PI / 2;
    this.lane.visible = false;
    this.obj.add(this.lane);
    world.addTarget(this);
    this.sync(0);
  }

  get where(): THREE.Vector3 {
    return new THREE.Vector3(this.body.x, this.body.y, this.body.z);
  }

  /** The pillars it can be shoved into (for the checks and the tests). */
  get pillarCount() {
    return this.pillars.length;
  }

  private get phase() {
    return this.hp > (this.maxHp * 2) / 3 ? 1 : this.hp > this.maxHp / 3 ? 2 : 3;
  }

  private hint(key: string, show: () => void) {
    if (this.hinted.has(key)) return;
    this.hinted.add(key);
    show();
  }

  private toast(text: string) {
    this.world.hooks.toast(text, 'brennus');
  }

  private setState(s: State, t: number) {
    this.state = s;
    this.stateT = t;
    this.lane.visible = s === 'paw';
  }

  hit(dmg: number, kind: HitKind, from: THREE.Vector3): boolean {
    if (!this.started || this.defeated || this.state === 'down') return true;
    if (this.state === 'locked' && (kind === 'smash' || kind === 'dash')) {
      this.shove(from);
      return true;
    }
    if (this.state !== 'open') {
      audio.play('zap', 1.2);
      if (this.state === 'locked') this.hint('lockedHit', () => this.toast('Its horns are stuck! Now CHARGE into it and push it into a pillar!'));
      else this.hint('armour', () => this.toast('Solid gold! Stop its charge with your SHIELD first.'));
      return true;
    }
    // A big blast into the open engine hurts most.
    const n = kind === 'blast' ? dmg + 1 : kind === 'smash' ? dmg + 1 : dmg;
    this.hp = Math.max(0, this.hp - n);
    this.world.hooks.bossBar(this.title, this.hp / this.maxHp);
    if (this.ram.core) this.ram.core.emissiveIntensity = 5;
    audio.play('hit', 0.6);
    if (this.hp <= 0) this.lieDown();
    return true;
  }

  /** Brennus charges into it while its horns are stuck: it skids backwards, steered toward a pillar behind it. */
  private shove(from: THREE.Vector3) {
    const b = this.body;
    let dx = b.x - from.x;
    let dz = b.z - from.z;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d;
    dz /= d;
    let best: THREE.Vector3 | null = null;
    let bestDot = RAM_TUNING.steer;
    for (const p of this.pillars) {
      const px = p.x - b.x;
      const pz = p.z - b.z;
      const pd = Math.hypot(px, pz) || 1;
      const dot = (px * dx + pz * dz) / pd;
      if (dot > bestDot && pd < RAM_TUNING.steerRange) {
        bestDot = dot;
        best = p;
      }
    }
    if (best) {
      const px = best.x - b.x;
      const pz = best.z - b.z;
      const pd = Math.hypot(px, pz) || 1;
      dx = px / pd;
      dz = pz / pd;
    }
    this.shoveDir.set(dx, dz);
    // Steered at a pillar, it skids all the way there; with none behind it, it only skids a little.
    const far = best ? Math.hypot(best.x - this.body.x, best.z - this.body.z) : 0;
    this.setState('shoved', best ? far / RAM_TUNING.shove + 0.4 : RAM_TUNING.shoveTime);
    audio.play('pound', 0.8);
    haptic('heavy');
    this.world.shake(0.5);
    this.world.hitStop(0.08);
    this.world.particles.emit(from.x, from.y + 1.5, from.z, { count: 24, color: '#ffd166', speed: 6, life: 0.5, size: 0.6 });
    if (!best) this.hint('aim', () => this.toast('Shove it toward a stone pillar so it crashes!'));
  }

  /** Crashes into a pillar: the hatch on its back pops open. */
  private crash() {
    const b = this.body;
    this.setState('open', this.phase === 3 ? RAM_TUNING.openAngry : RAM_TUNING.open);
    audio.play('explode');
    audio.play('break', 0.6);
    haptic('heavy');
    this.world.shake(0.8);
    this.world.flash(b.x, b.y + 3, b.z, '#ffc23a', 60, 0.5);
    this.world.particles.emit(b.x, b.y + 2, b.z, { count: 36, color: '#e8e0d0', speed: 8, life: 0.8, size: 0.9 });
    this.hint('open', () => this.toast('CRASH! Its engine hatch is open! BLAST the glowing engine!'));
  }

  /** Zero health: the engine coughs and stops, and the Ram lies down for a nap. */
  private lieDown() {
    this.setState('down', 0);
    this.aimable = false;
    this.downT = 0;
    this.world.shots.clear();
    this.world.hooks.bossBar(null, 0);
    audio.play('sputter');
    this.world.shake(0.5);
  }

  reset() {
    this.hp = this.maxHp;
    this.body.x = this.home.x;
    this.body.z = this.home.z;
    this.body.vx = 0;
    this.body.vz = 0;
    this.setState('walk', 3);
    this.count = 0;
    this.called = 0;
    this.downT = 0;
    this.aimable = false;
  }

  /** It turns to face Brennus as he walks in, horns first. */
  protected onIntro() {
    const p = this.player.body;
    this.yaw = Math.atan2(p.x - this.body.x, p.z - this.body.z);
    this.sync(0);
  }

  protected onStart() {
    this.orbit = Math.atan2(this.body.z - this.home.z, this.body.x - this.home.x);
  }

  /** What's in front of it at `ahead` units along (dx, dz): a pillar, a wall (or the edge), or nothing. */
  private ahead(dx: number, dz: number): 'pillar' | 'wall' | null {
    const b = this.body;
    for (const a of [2.2, 3]) {
      const x = b.x + dx * a;
      const z = b.z + dz * a;
      if (this.pillars.some((p) => Math.hypot(p.x - x, p.z - z) < 1.7)) return 'pillar';
      const c = this.world.grid.cell(Grid.toCell(x), Grid.toCell(z));
      if (c.kind === 'wall' || c.kind === 'void' || c.kind === 'hazard' || Math.abs(c.h - b.y) > 0.6) return 'wall';
    }
    return null;
  }

  /** A dropship brings Aeëtes's help: two ramlings below two thirds, two gold troopers below one third. */
  private callHelp() {
    const want = this.phase - 1;
    if (this.called >= want) return;
    this.called = want;
    const g = this.world.grid;
    const cx = Grid.toCell(this.home.x);
    const cz = Grid.toCell(this.home.z);
    const cells: [number, number][] = [];
    for (let z = cz - 4; z <= cz + 4; z++) for (let x = cx - 6; x <= cx + 6; x++) if (g.cell(x, z).kind === 'floor' && Math.abs(g.cell(x, z).h - this.home.y) < 0.3) cells.push([x, z]);
    if (!cells.length) return;
    const p = this.player.body;
    const pick = cells.filter(([x, z]) => Math.hypot(Grid.center(x) - p.x, Grid.center(z) - p.z) > 8);
    const [x, z] = (pick.length ? pick : cells)[Math.floor(Math.random() * (pick.length || cells.length))];
    const near = cells.filter(([nx, nz]) => Math.abs(nx - x) <= 1 && Math.abs(nz - z) <= 1);
    const kind = want === 1 ? 'ramling' : 'trooper';
    this.world.addEntity(new Dropship(this.world, new THREE.Vector3(Grid.center(x), this.home.y, Grid.center(z)), near, kind, 2, kind === 'trooper' ? 'gold' : undefined, 'ramfight', () => {}));
    if (want === 1) this.world.hooks.toast('Aeëtes sent ramlings to help it! Keep your shield up!', 'brennus');
    else this.world.hooks.toast('More of Aeëtes’s robots! Shield up, and keep pushing that Ram into the pillars!', 'brennus');
  }

  update(dt: number) {
    this.t += dt;
    const b = this.body;
    const r = this.ram;
    if (!this.started) {
      if (this.playerDist() < 14) this.begin();
      this.sync(0);
      return;
    }
    if (this.defeated || this.state === 'down') {
      this.updateDown(dt);
      return;
    }
    const p = this.player.body;
    const toX = p.x - b.x;
    const toZ = p.z - b.z;
    const toD = Math.hypot(toX, toZ) || 1;
    const angry = this.phase;
    this.stateT -= dt;
    let speed = 0;
    let heading = this.yaw;
    switch (this.state) {
      case 'walk': {
        // Trots round the middle of the arena, keeping an eye on Brennus.
        this.orbit += dt * 0.35;
        const tx = this.home.x + Math.cos(this.orbit) * 5 - b.x;
        const tz = this.home.z + Math.sin(this.orbit) * 4 - b.z;
        heading = Math.atan2(tx, tz);
        speed = Math.min(3.5, Math.hypot(tx, tz) * 1.5);
        this.yaw = dampAngle(this.yaw, Math.atan2(toX, toZ), 3, dt);
        if (this.stateT <= 0) {
          this.count += 1;
          this.callHelp();
          if (angry >= 2 && this.count % 3 === 0) {
            this.setState('stomp', 1.1);
            audio.play('roar', 0.6);
          } else {
            this.setState('paw', RAM_TUNING.paw);
            audio.play('roar', 0.45);
            this.hint('paw', () => this.toast('It’s pawing the ground! Face it and HOLD your SHIELD!'));
          }
        }
        break;
      }
      case 'paw':
        if (this.stateT > RAM_TUNING.paw * 0.4) this.dir.set(toX / toD, toZ / toD);
        this.yaw = dampAngle(this.yaw, Math.atan2(this.dir.x, this.dir.y), 8, dt);
        r.legs[0].rotation.x = Math.sin(this.t * 16) * 0.7 - 0.3;
        r.head.rotation.x = 0.3;
        r.visor.emissiveIntensity = 1.5 + Math.abs(Math.sin(this.t * 20)) * 3;
        if (Math.random() < 0.5) this.world.particles.emit(b.x + this.dir.x * 2, b.y + 0.2, b.z + this.dir.y * 2, { count: 2, color: '#e8dcc8', speed: 2.5, up: 1.5, life: 0.5, size: 0.9 });
        this.lane.position.set(b.x + this.dir.x * 13, b.y + 0.08, b.z + this.dir.y * 13);
        this.lane.rotation.z = -Math.atan2(this.dir.x, this.dir.y);
        if (this.stateT <= 0) {
          this.setState('charge', RAM_TUNING.chargeTime);
          audio.play('dash', 0.5);
          haptic('medium');
        }
        break;
      case 'charge': {
        speed = RAM_TUNING.charge + (angry - 1) * 1.5;
        heading = Math.atan2(this.dir.x, this.dir.y);
        this.yaw = heading;
        r.head.rotation.x = 0.4;
        if (Math.random() < 0.7) this.world.particles.emit(b.x - this.dir.x * 2, b.y + 0.3, b.z - this.dir.y * 2, { count: 2, color: '#e8dcc8', speed: 2, up: 1, life: 0.5, size: 1 });
        const fx = b.x + this.dir.x * 2.4;
        const fz = b.z + this.dir.y * 2.4;
        if (Math.hypot(p.x - fx, p.z - fz) < REACH && p.y < b.y + 3.5) {
          if (this.player.shieldBlocks(b.x, b.z)) {
            // CLANG! Horns against the shield: it's stuck.
            this.player.hurt(1, b.x, b.z);
            speed = 0;
            this.setState('locked', RAM_TUNING.locked);
            audio.play('explode', 1.4);
            this.world.shake(0.6);
            this.world.hitStop(0.1);
            this.world.flash(fx, b.y + 2, fz, '#ffd166', 60, 0.4);
            this.world.particles.emit(fx, b.y + 2, fz, { count: 30, color: '#ffd166', speed: 8, life: 0.5, size: 0.5 });
            this.hint('locked', () => this.toast('CLANG! Its horns are stuck in your shield! Quick: CHARGE into it!'));
            break;
          }
          this.player.hurt(1, b.x, b.z);
        }
        const hit = this.ahead(this.dir.x, this.dir.y);
        if (hit === 'pillar') {
          speed = 0;
          this.crash();
        } else if (hit === 'wall' || this.stateT <= 0) {
          speed = 0;
          this.setState('dazed', 1.2);
          audio.play('pound', 0.7);
          this.world.shake(0.4);
        }
        break;
      }
      case 'locked':
        r.head.rotation.x = 0.45 + Math.sin(this.t * 30) * 0.05;
        this.yaw = dampAngle(this.yaw, Math.atan2(toX, toZ), 2, dt);
        if (Math.random() < 0.3) this.world.particles.emit(b.x, b.y + 5.6, b.z, { count: 1, color: '#ffd166', speed: 2, up: 1, life: 0.5, size: 0.6, gravity: 0 });
        if (this.stateT <= 0) {
          this.setState('walk', 2);
          this.hint('tooSlow', () => this.toast('Too slow! Next time CHARGE (DASH) as soon as its horns are stuck.'));
        }
        break;
      case 'shoved': {
        speed = RAM_TUNING.shove * Math.min(1, this.stateT / 0.5 + 0.3);
        heading = Math.atan2(this.shoveDir.x, this.shoveDir.y);
        if (Math.random() < 0.8) this.world.particles.emit(b.x, b.y + 0.2, b.z, { count: 2, color: '#e8dcc8', speed: 3, up: 1, life: 0.5, size: 1 });
        if (this.pillars.some((q) => Math.hypot(q.x - b.x, q.z - b.z) < RAM_TUNING.crash)) {
          speed = 0;
          this.crash();
          break;
        }
        const hit = this.ahead(this.shoveDir.x, this.shoveDir.y);
        if (hit === 'pillar') {
          speed = 0;
          this.crash();
        } else if (hit === 'wall' || this.stateT <= 0) {
          speed = 0;
          this.setState('dazed', 1.4);
          this.hint('missPillar', () => this.toast('Close! Push it toward one of the stone pillars next time.'));
        }
        break;
      }
      case 'open':
        if (Math.random() < 0.3) this.world.particles.emit(b.x, b.y + 5.4, b.z, { count: 1, color: '#ffd166', speed: 2, up: 1, life: 0.5, size: 0.6, gravity: 0 });
        if (this.stateT <= 0) {
          this.setState('walk', 2.4);
          if (angry >= 2) this.world.addEntity(new Shockwave(this.world, b.x, b.y, b.z, 12, 7, '#ffc23a'));
          audio.play('roar', 0.5);
        }
        break;
      case 'dazed':
        if (this.stateT <= 0) this.setState('walk', angry === 3 ? 1.6 : 2.4);
        break;
      case 'stomp': {
        // Rears up on its back legs... and stamps: a shockwave ring to jump over.
        const k = 1 - Math.max(0, this.stateT) / 1.1;
        r.body.rotation.x = -Math.sin(Math.min(1, k * 1.25) * Math.PI) * 0.45;
        if (this.stateT <= 0) {
          r.body.rotation.x = 0;
          this.world.addEntity(new Shockwave(this.world, b.x, b.y, b.z, 14, 8, '#ffc23a'));
          audio.play('pound', 0.6);
          this.world.shake(0.7);
          this.hint('stomp', () => this.toast('Shockwave! JUMP over the ring!'));
          this.setState('walk', 2);
        }
        break;
      }
    }
    b.vx = Math.sin(heading) * speed;
    b.vz = Math.cos(heading) * speed;
    moveBody(b, dt, this.world.grid, [], { stepUp: 0.6 });
    if (speed > 0) this.stride += dt * (speed > 6 ? 16 : 8);
    this.pose(dt, speed);
    this.sync(speed);
    // Bumping into it hurts (not while it's stuck, dizzy or open).
    const calm = this.state === 'locked' || this.state === 'open' || this.state === 'dazed' || this.state === 'shoved';
    if (!calm && this.state !== 'charge' && toD < 2.6 && p.y < b.y + 3) this.player.hurt(1, b.x, b.z);
  }

  private pose(dt: number, speed: number) {
    const r = this.ram;
    const swing = speed > 0 ? Math.sin(this.stride) * 0.55 : 0;
    r.legs.forEach((l, i) => {
      if (this.state === 'paw' && i === 0) return;
      l.rotation.x = i === 0 || i === 3 ? swing : -swing;
    });
    if (this.state !== 'paw') r.visor.emissiveIntensity = damp(r.visor.emissiveIntensity, 1.6, 5, dt);
    if (this.state !== 'paw' && this.state !== 'charge' && this.state !== 'locked') r.head.rotation.x = damp(r.head.rotation.x, 0, 5, dt);
    if (this.state !== 'stomp') r.body.rotation.x = damp(r.body.rotation.x, 0, 6, dt);
    const open = this.state === 'open';
    this.aimable = open;
    for (const [i, lid] of (r.lids ?? []).entries()) lid.rotation.z = damp(lid.rotation.z, open ? (i ? -1.9 : 1.9) : 0, 8, dt);
    // The engine pops up out of its wool when the hatch opens, so it shows from every side.
    if (r.engine) r.engine.position.y = damp(r.engine.position.y, open ? 2.15 : 1.62, 8, dt);
    if (r.core) r.core.emissiveIntensity = damp(r.core.emissiveIntensity, open ? 2.4 + Math.sin(this.t * 12) * 0.8 : 0.5, 6, dt);
    if (r.coreGlow) r.coreGlow.material.opacity = damp(r.coreGlow.material.opacity, open ? 0.9 : 0, 6, dt);
    r.root.rotation.z = this.state === 'locked' || this.state === 'dazed' ? Math.sin(this.t * 7) * 0.05 : 0;
  }

  /** Lying down: the engine coughs a few puffs of smoke, the legs fold, and the fight is won. */
  private updateDown(dt: number) {
    const b = this.body;
    const r = this.ram;
    this.downT += dt;
    const k = Math.min(1, this.downT / 1.6);
    r.legs.forEach((l, i) => (l.rotation.x = (i < 2 ? -1 : 1) * k * 1.3));
    r.body.position.y = -k * 0.45;
    r.head.rotation.x = k * 0.5;
    r.visor.emissiveIntensity = damp(r.visor.emissiveIntensity, 0.2, 2, dt);
    if (r.core) r.core.emissiveIntensity = damp(r.core.emissiveIntensity, 0, 2, dt);
    if (r.coreGlow) r.coreGlow.material.opacity = damp(r.coreGlow.material.opacity, 0, 3, dt);
    if (!this.defeated && Math.random() < dt * 4) this.world.particles.emit(b.x, b.y + 5, b.z, { count: 3, color: '#4a4a50', speed: 1, up: 3, life: 1, size: 1.2, gravity: 0 });
    if (!this.defeated && this.downT > 2) {
      this.defeated = true;
      audio.play('upgrade');
      haptic('success');
      this.world.dropBolts(new THREE.Vector3(b.x, b.y + 2, b.z), 40);
      this.world.bossDefeated(this);
    }
    this.sync(0);
  }

  private sync(speed: number) {
    const b = this.body;
    const r = this.ram;
    r.root.position.set(b.x, b.y + (speed > 8 ? Math.abs(Math.sin(this.t * 20)) * 0.1 : 0), b.z);
    r.root.rotation.y = this.yaw;
    if (this.state === 'open' && r.engine) {
      r.engine.getWorldPosition(this.aim);
      this.radius = 1.6;
    } else {
      this.aim.set(b.x, b.y + 2.4, b.z);
      this.radius = 2.4;
    }
  }
}
