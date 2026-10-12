import * as THREE from 'three';

import { audio } from '../../core/audio';
import { haptic } from '../../core/bridge';
import { damp, dampAngle } from '../../core/math';
import type { World } from '../../game/world';
import { Grid } from '../../world/grid';
import { Boss, bossHp } from '../bossBase';
import { armLux, type RogueParts } from '../companionModels';
import type { Enemy } from '../enemies';
import type { HitKind, Target } from '../entity';
import { Shockwave } from '../hazards';
import { makeBolt, type BoltModel } from '../models';

type State = 'hover' | 'zip' | 'aim' | 'volley' | 'summon' | 'dizzy' | 'sing';

/** How big LUX looks in his armour (the armour falls off when he's freed, and he shrinks back). */
export const ROGUE_SCALE = 1.6;
const HP = 24;
/** The arena is an oval: LUX zips between points on it. */
const RX = 11;
const RZ = 6;
/** Hover height, and how low he sinks while he's overheated. */
const HIGH = 2.6;
const LOW = 1.1;
const RED = '#ff3a4c';
const CYAN = '#5ee0ff';
const tmp = new THREE.Vector3();

/**
 * SHADOW LUX, the mini-boss of Mount Atlantas: Brennus has clamped thorny armour and a control chip
 * onto LUX. He zips around the gatehouse, crackles red zaps down where Jason stands, fires volleys
 * and calls little drones. After each attack run he overheats and sinks, spinning, with the chip on
 * his back glowing: that is the moment to blast it. Each hit makes his eye flicker back to cyan. At
 * two thirds and one third of his health IRIS sings him a rainbow light-word, which stuns him (free
 * hits!), but makes the chip fight harder: faster zips, more zaps. When the chip breaks, LUX is LUX
 * again (the reunion is a cutscene in `cinema/luxScenes.ts`).
 */
export class RogueLux extends Boss implements Target {
  readonly title = 'SHADOW LUX';
  protected focusHeight = HIGH;
  readonly aim = new THREE.Vector3();
  radius = 1;
  aimable = false;
  readonly model: BoltModel;
  readonly parts: RogueParts;
  /** Where LUX floats right now. */
  readonly pos = new THREE.Vector3();
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();
  private state: State = 'hover';
  private stateT = 2;
  private count = 0;
  private shots = 0;
  private yaw = 0;
  private spin = 0;
  private flicker = 0;
  private told = new Set<string>();
  /** Where the next red zap will land, and its warning ring. */
  private mark = new THREE.Vector3();
  private ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  /** Which of IRIS's songs he has heard (one at 2/3 health, one at 1/3), and how far into one she is. */
  private songs = 0;
  private beat = 0;
  /** The little drones he has called (he never has more than three around). */
  private drones: Enemy[] = [];
  /** Set by the reunion cutscene: the armour is coming off, so stop fighting. */
  freeing = false;

  constructor(world: World, id: string, cx: number, cz: number, h: number) {
    super(world, id, cx, cz, h, bossHp(world, HP));
    this.model = makeBolt();
    this.parts = armLux(this.model);
    this.model.root.scale.setScalar(ROGUE_SCALE);
    this.obj.add(this.model.root);
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(1.05, 1.35, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: RED, transparent: true, opacity: 0, depthWrite: false }),
    );
    this.obj.add(this.ring);
    this.pos.copy(this.center).setY(this.center.y + HIGH);
    world.addTarget(this);
    this.sync(0);
  }

  get where(): THREE.Vector3 {
    return new THREE.Vector3(this.pos.x, this.center.y, this.pos.z);
  }

  get focus(): THREE.Vector3 {
    return this.pos.clone();
  }

  private get phase() {
    return this.hp > (HP * 2) / 3 ? 0 : this.hp > HP / 3 ? 1 : 2;
  }

  private first(key: string) {
    if (this.told.has(key)) return false;
    this.told.add(key);
    return true;
  }

  hit(dmg: number, kind: HitKind): boolean {
    if (!this.started || this.defeated || this.freeing) return true;
    // IRIS would never zap her friend.
    if (kind === 'zap') return true;
    if (this.state !== 'dizzy' && this.state !== 'sing') {
      audio.play('shield', 1.3);
      this.world.particles.emit(this.aim.x, this.aim.y, this.aim.z, { count: 6, color: RED, speed: 4, life: 0.3, size: 0.4 });
      if (this.first('blocked')) this.world.hooks.toast('His armour blocks it! Wait until he overheats, then blast the chip on his back!', 'bolt');
      return true;
    }
    this.damage(kind === 'pound' || kind === 'blast' ? dmg + 2 : dmg);
    this.flicker = 0.35;
    this.parts.chip.emissiveIntensity = 4;
    audio.play('hit');
    this.world.particles.emit(this.aim.x, this.aim.y, this.aim.z, { count: 10, color: Math.random() < 0.5 ? RED : CYAN, speed: 5, life: 0.4, size: 0.5 });
    return true;
  }

  reset() {
    this.hp = this.maxHp;
    this.state = 'hover';
    this.stateT = 2;
    this.count = 0;
    this.songs = 0;
    this.drones = [];
    this.pos.copy(this.center).setY(this.center.y + HIGH);
    this.ring.material.opacity = 0;
    this.world.iris.override = null;
  }

  protected onStart() {
    this.state = 'hover';
    this.stateT = 1.2;
  }

  /** A spot on the arena oval at angle a. */
  private spot(a: number, out: THREE.Vector3) {
    return out.set(this.center.x + Math.cos(a) * RX, this.center.y + HIGH, this.center.z + Math.sin(a) * RZ);
  }

  private go(state: State, t: number) {
    this.state = state;
    this.stateT = t;
  }

  update(dt: number) {
    this.t += dt;
    if (this.freeing) {
      // The reunion cutscene has him now.
      this.model.root.position.copy(this.pos);
      return;
    }
    if (!this.started || this.defeated) {
      if (!this.started && !this.defeated && this.playerDist() < 9.5) this.begin();
      if (this.defeated) {
        // Sparking and wobbling, waiting for IRIS's song in the cutscene.
        this.pos.y = damp(this.pos.y, this.center.y + LOW, 2, dt);
        if (Math.random() < 0.2) this.world.particles.emit(this.pos.x, this.pos.y, this.pos.z, { count: 2, color: '#ffd166', speed: 3, life: 0.3, size: 0.3 });
      }
      this.sync(dt);
      return;
    }
    const p = this.player.body;
    const pace = [1, 0.8, 0.65][this.phase];
    this.stateT -= dt;
    // IRIS sings at 2/3 and 1/3 health.
    if (this.songs < this.phase && this.state !== 'sing') {
      this.songs = this.phase;
      this.sing();
    }
    switch (this.state) {
      case 'hover':
        this.pos.y = damp(this.pos.y, this.center.y + HIGH + Math.sin(this.t * 2) * 0.2, 4, dt);
        if (this.stateT <= 0) this.zip();
        break;
      case 'zip': {
        const k = 1 - Math.max(0, this.stateT) / (0.45 * pace);
        this.pos.lerpVectors(this.from, this.to, k * k * (3 - 2 * k));
        this.world.particles.emit(this.pos.x, this.pos.y, this.pos.z, { count: 2, color: RED, speed: 0.4, life: 0.4, size: 0.6, gravity: 0 });
        if (this.stateT <= 0) this.attack(pace);
        break;
      }
      case 'aim': {
        // A crackling red ring where the zap will land: step out of it!
        const left = Math.max(0, this.stateT);
        this.ring.position.set(this.mark.x, this.mark.y + 0.08, this.mark.z);
        this.ring.material.opacity = 0.35 + Math.sin(this.t * 30) * 0.2;
        this.ring.scale.setScalar(1 + left * 0.6);
        if (Math.random() < 0.3) this.world.beams.zap(tmp.copy(this.aim), this.mark.clone().setY(this.mark.y + 0.3), RED);
        if (this.stateT <= 0) this.strike(pace);
        break;
      }
      case 'volley':
        if (this.stateT <= 0) {
          this.volley();
          this.shots -= 1;
          if (this.shots > 0) this.stateT = 0.45 * pace;
          else this.overheat(pace);
        }
        break;
      case 'summon':
        this.parts.chipGlow.material.opacity = 1;
        if (this.stateT <= 0) {
          this.summon();
          this.go('hover', 1.4 * pace);
        }
        break;
      case 'dizzy':
        this.pos.y = damp(this.pos.y, this.center.y + LOW, 3, dt);
        this.spin += dt * 2.2;
        if (Math.random() < 0.25) this.world.particles.emit(this.pos.x, this.pos.y + 0.8, this.pos.z, { count: 1, color: '#ffd166', speed: 2, up: 2, life: 0.4, size: 0.35, gravity: 2 });
        if (this.stateT <= 0) {
          audio.play('charged', 0.7);
          this.go('hover', 0.8);
        }
        break;
      case 'sing':
        this.pos.y = damp(this.pos.y, this.center.y + LOW + 0.4, 2, dt);
        this.spin += dt * 0.8;
        this.song(3 - this.stateT);
        if (this.stateT <= 0) {
          this.world.iris.override = null;
          this.go('hover', 0.6);
        }
        break;
    }
    // He keeps his eye on Jason, except while he's spinning helplessly.
    const lookYaw = Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
    if (this.state === 'dizzy' || this.state === 'sing') this.yaw += dt * (this.state === 'dizzy' ? 2.2 : 0.8);
    else this.yaw = dampAngle(this.yaw, lookYaw, 6, dt);
    if (this.state !== 'aim') this.ring.material.opacity = damp(this.ring.material.opacity, 0, 8, dt);
    this.aimable = this.state === 'dizzy' || this.state === 'sing';
    this.sync(dt);
  }

  /** Off to another spot on the oval, as far round as possible from where he is. */
  private zip() {
    this.from.copy(this.pos);
    const now = Math.atan2((this.pos.z - this.center.z) / RZ, (this.pos.x - this.center.x) / RX);
    this.spot(now + Math.PI * (0.6 + Math.random() * 0.8), this.to);
    this.go('zip', 0.45 * [1, 0.8, 0.65][this.phase]);
    audio.play('dash', 1.3);
  }

  /** Picks the next attack: zaps most of the time, a volley now and then, drones every fourth run. */
  private attack(pace: number) {
    this.count += 1;
    this.drones = this.drones.filter((e) => e.alive);
    if (this.count % 4 === 0 && this.drones.length < 2) {
      this.go('summon', 0.9);
      audio.play('alarm', 1.2);
      if (this.first('summon')) this.world.hooks.toast('He’s calling little drones! Knock them out!', 'bolt');
      return;
    }
    if (this.count % 3 === 0) {
      this.shots = 3 + this.phase;
      this.go('volley', 0.5);
      return;
    }
    this.shots = 1 + this.phase;
    this.aimAt(pace);
    if (this.first('zap')) this.world.hooks.toast('Red rings! Run out of them before the zap lands!', 'bolt');
  }

  private aimAt(pace: number) {
    const p = this.player.body;
    this.mark.set(p.x + p.vx * 0.35, p.y, p.z + p.vz * 0.35);
    this.go('aim', 0.85 * pace);
    audio.play('charge', 1.2);
  }

  private strike(pace: number) {
    const m = this.mark;
    this.world.beams.zap(this.aim.clone(), m.clone(), RED);
    this.world.beams.zap(this.aim.clone(), m.clone().add(tmp.set(0.4, 0.2, -0.3)), '#ffb0b8');
    this.world.addEntity(new Shockwave(this.world, m.x, m.y, m.z, 1.6, 8, RED));
    this.world.flash(m.x, m.y + 1, m.z, RED, 40, 0.25);
    audio.play('zap', 0.8);
    const p = this.player.body;
    if (Math.hypot(p.x - m.x, p.z - m.z) < 1.4 && Math.abs(p.y - m.y) < 1.6) this.player.hurt(1, m.x, m.z);
    this.shots -= 1;
    if (this.shots > 0) this.aimAt(pace);
    else this.overheat(pace);
  }

  private volley() {
    const p = this.player.body;
    const base = Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
    for (const off of [-0.3, 0, 0.3]) {
      const dir = new THREE.Vector3(Math.sin(base + off), 0, Math.cos(base + off));
      dir.y = (p.y + 1 - this.pos.y) / Math.max(2, Math.hypot(p.x - this.pos.x, p.z - this.pos.z));
      this.world.shots.fire('enemy', this.pos.clone(), dir.normalize(), 9, 1);
    }
    audio.play('enemyShoot', 1.3);
    this.parts.chip.emissiveIntensity = 3;
  }

  private summon() {
    for (const s of [-1, 1]) {
      const cx = Grid.toCell(this.center.x + s * (RX - 1));
      const cz = Grid.toCell(this.center.z);
      this.drones.push(this.world.spawnEnemy('buzzer', cx, cz, 'legion'));
    }
  }

  /** Too much zapping: he overheats, sinks and spins, and the chip on his back is wide open. */
  private overheat(pace: number) {
    this.go('dizzy', 3.6 * pace + 0.6);
    audio.play('sputter', 1.1);
    haptic('light');
    if (this.first('dizzy')) this.world.hooks.toast('He’s overheating! BLAST the red chip on his back!', 'bolt');
  }

  /** IRIS flies up and sings a rainbow light-word: LUX freezes and his eye flickers back to cyan. */
  private sing() {
    this.go('sing', 3);
    this.beat = 0;
    const p = this.player.body;
    this.world.iris.override = tmp.set(p.x, p.y, p.z).lerp(this.pos, 0.55).setY(this.center.y + 2.4).clone();
    if (this.songs === 1) this.world.hooks.toast('LUX, it’s me, IRIS! Remember: hello... safe... together!', 'iris');
    else this.world.hooks.toast('Come back to us, LUX! Jason needs you!', 'iris');
  }

  /** The song, `k` seconds in: three light-words (blue, pink, gold), then the chip fights back. */
  private song(k: number) {
    const words: [string, 'tone0' | 'tone1' | 'tone2'][] = [
      ['#5e9bff', 'tone0'],
      ['#ff6fcf', 'tone1'],
      ['#ffd166', 'tone2'],
    ];
    const iris = this.world.iris;
    if (this.beat < words.length && k >= 0.35 + this.beat * 0.6) {
      const [color, tone] = words[this.beat];
      audio.play(tone);
      this.world.beams.zap(iris.pos.clone(), this.pos.clone(), color);
      this.world.particles.emit(iris.pos.x, iris.pos.y, iris.pos.z, { count: 12, color, speed: 3, life: 0.6, size: 0.5, gravity: 0 });
      this.flicker = 0.5;
      this.beat += 1;
    } else if (this.beat === words.length && k >= 2.2) {
      this.beat += 1;
      if (this.songs === 1) this.world.hooks.toast('J-Jason...? ...ERROR. OBEY. OBEY!', 'rogue');
      else this.world.hooks.toast('I... I want to... NO. OBEY!', 'rogue');
    }
  }

  private sync(dt: number) {
    const m = this.model;
    m.root.position.copy(this.pos);
    m.root.rotation.y = this.yaw;
    m.shell.rotation.z = this.state === 'dizzy' ? Math.sin(this.t * 9) * 0.3 : Math.sin(this.t * 1.7) * 0.08;
    // The eye is red, but it flickers back to cyan when the chip is hit (or IRIS sings).
    this.flicker = Math.max(0, this.flicker - dt);
    const cyan = this.flicker > 0 && Math.random() < 0.7;
    m.iris.color.set(cyan ? CYAN : RED);
    m.iris.emissive.set(cyan ? CYAN : RED);
    m.iris.emissiveIntensity = cyan ? 2.6 : 1.8;
    const open = this.state === 'dizzy' || this.state === 'sing';
    this.parts.chip.emissiveIntensity = damp(this.parts.chip.emissiveIntensity, open ? 2.4 + Math.sin(this.t * 12) * 0.8 : 1, 6, dt);
    this.parts.chipGlow.material.opacity = damp(this.parts.chipGlow.material.opacity, open ? 0.95 : 0.35, 6, dt);
    this.parts.chipGlow.scale.setScalar(open ? 1.3 : 0.8);
    // The chip is on his back.
    const s = ROGUE_SCALE;
    this.aim.set(this.pos.x - Math.sin(this.yaw) * 0.45 * s, this.pos.y, this.pos.z - Math.cos(this.yaw) * 0.45 * s);
  }
}
