/**
 * Atalanta's moves. While she is the playing hero, `Player` hands her the controls every frame; she
 * shares the body, hearts, armor, spin charges and the physics step with Jason.
 *
 * - Faster run, and a SPRINT: keep the stick pushed all the way (or a direction key held) and she
 *   breaks into a sprint after a moment. A sharp turn or letting go ends it.
 * - One strong jump, plus a WALL-JUMP: jump while touching a wall to kick off it (never twice in a row
 *   off the same wall, so it's a zig-zag between two walls, not a ladder).
 * - WALL-RUN on marked walls (`wallrun` cells): run at a stripe while in the air and she runs along it
 *   for a moment; jump to kick off.
 * - CLIMB marked cliffs (`climb` cells, with handholds): push into one, on the ground or in the air, and
 *   she grabs on. Keep pushing to climb up (pull back to climb down, sideways to shimmy); her grip lasts
 *   a few seconds and comes back on the ground. At the top she pulls herself onto the ledge; jump to kick
 *   off the wall instead.
 * - SLIDE (the DASH button): low and fast, under low gaps, tripping enemies. Jump out of it for a long jump.
 * - BOW (the BLAST button): tap for quick arrows, hold for a power arrow (pierces, sets off targets).
 * - KICK (the SPIN button): a spinning kick from the shared spin charges, on the ground or in the air.
 *
 * Her chapter 3 shop upgrades change the numbers (see atalantaStats.ts), read fresh every frame.
 */
import * as THREE from 'three';

import { audio } from '../../core/audio';
import { haptic } from '../../core/bridge';
import { ATALANTA, CELL, GRAVITY, OUTDOOR, PLAYER } from '../../core/constants';
import type { Input } from '../../core/input';
import { clamp, damp, dampAngle } from '../../core/math';
import type { World } from '../../game/world';
import { Grid } from '../../world/grid';
import type { Player } from '../player';
import type { Target } from '../entity';
import { ATALANTA_COLORS, dressAtalanta, makeAtalanta, type AtalantaModel } from './atalantaModel';
import { atalantaStats, type AtalantaStats } from './atalantaStats';
import { heroWorld } from './heroProps';

interface WallFace {
  /** Outward normal of the wall face (pointing at Atalanta). */
  nx: number;
  nz: number;
  /** Identifies the face plane, so the same wall can't be kicked off twice in a row. */
  key: string;
}

/** A cliff face she climbs: the face, the cell it belongs to, and the height of its top. */
type Climb = WallFace & { cx: number; cz: number; top: number };

/** Triple Arrow: how far (radians) the two extra power arrows fan out from the middle one. */
const TRIPLE_ANGLE = 0.2;
const UP = new THREE.Vector3(0, 1, 0);

const SIDES = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

export class AtalantaMoves {
  readonly model: AtalantaModel;
  private coyote = 0;
  private jumpBuf = 0;
  private cut = true;
  /** Seconds the stick has been at full push, and whether she is sprinting. */
  private sprintT = 0;
  sprinting = false;
  /** The wall she last kicked off (cleared on landing). */
  private lastWall: string | null = null;
  /** The wall-run in progress, and the wall she last ran along (she can't start on it again until she lands). */
  private run: (WallFace & { tx: number; tz: number; t: number }) | null = null;
  private ranOn: string | null = null;
  private slideT = 0;
  private slideCd = 0;
  private slideBuf = 0;
  private slideHit = new Set<unknown>();
  /** The cliff she is climbing (with the cell it belongs to and its top), and how much grip she has left. */
  private climb: Climb | null = null;
  private grip: number = ATALANTA.climbGrip;
  /** How far her hands have moved on the cliff (the climbing animation follows it). */
  private climbPhase = 0;
  /** Pulling herself over the lip: from where to where, and how far along (0..1). */
  private mantle: { from: THREE.Vector3; to: THREE.Vector3; k: number } | null = null;
  /** Kept low by a ceiling after a slide: she crawls until there is room to stand. */
  private crouched = false;
  private airKicked = false;
  private shootCd = 0;
  private shootBuf = 0;
  private holdT = 0;
  private wasHeld = false;
  private chargedFx = false;
  /** Seconds the bow stays raised after a shot. */
  private aimT = 0;

  constructor(
    private p: Player,
    private world: World,
  ) {
    this.model = makeAtalanta();
    this.dress();
  }

  /** Blaster Power, her own upgrades and her outfit; returns true if her gear changed. */
  dress() {
    const s = this.world.save;
    return dressAtalanta(this.model, s.upgrades.blaster ?? 0, s.ataUpgrades, s.wearing.atalanta);
  }

  /** Her numbers with the shop upgrades bought so far. */
  private get stats(): AtalantaStats {
    return atalantaStats(this.world.save.ataUpgrades);
  }

  get sliding() {
    return this.slideT > 0;
  }

  get wallRunning() {
    return this.run !== null;
  }

  /** On a cliff, or pulling herself over its top. */
  get climbing() {
    return this.climb !== null || this.mantle !== null;
  }

  /** True while she crawls under a low ceiling (a follower only copies that if it is Atalanta too). */
  get crawling() {
    return this.crouched;
  }

  /** In the middle of a slide, wall-run or climb (no hero switching then). */
  get busy() {
    return this.slideT > 0 || this.run !== null || this.climbing;
  }

  /** True when a low ceiling (a low gap) is right above her: nobody could stand up here. */
  get cramped() {
    return !this.standRoom();
  }

  /** Back to normal: standing, not sliding or running (teleports, switches, cutscenes). */
  reset() {
    this.slideT = 0;
    this.run = null;
    this.climb = null;
    this.mantle = null;
    this.sprinting = false;
    this.sprintT = 0;
    this.holdT = 0;
    this.wasHeld = false;
    this.chargedFx = false;
    this.aimT = 0;
    if (this.standRoom()) {
      this.crouched = false;
      this.p.body.h = PLAYER.height;
    }
  }

  /** A bounce pad or vent threw her up: she can kick off walls again. */
  launched() {
    this.lastWall = null;
    this.ranOn = null;
    this.run = null;
    this.climb = null;
    this.cut = true;
  }

  /** True if nothing solid is above her up to standing height. */
  private standRoom(): boolean {
    const b = this.p.body;
    const r = b.r * 0.9;
    for (const box of this.world.boxes) {
      if (!box.solid || box.bottom <= b.y + ATALANTA.crouchHeight - 0.05 || box.bottom >= b.y + PLAYER.height) continue;
      if (b.x + r > box.minX && b.x - r < box.maxX && b.z + r > box.minZ && b.z - r < box.maxZ) return false;
    }
    return true;
  }

  /** A tall wall face right beside her (only wall-run stripes if `marked`), or null. */
  private wallFace(marked: boolean): WallFace | null {
    const b = this.p.body;
    const g = this.world.grid;
    const own = Grid.toCell(b.x) + Grid.toCell(b.z) * g.width;
    const runs = heroWorld(this.world).wallRuns;
    for (const [nx, nz] of SIDES) {
      const cx = Grid.toCell(b.x - nx * (b.r + 0.25));
      const cz = Grid.toCell(b.z - nz * (b.r + 0.25));
      const idx = cz * g.width + cx;
      if (idx === own || !g.inside(cx, cz)) continue;
      if (g.obstacleTop(cx, cz) < b.y + 1.2) continue;
      if (marked && !runs.has(idx)) continue;
      const plane = nx > 0 ? (cx + 1) * CELL : nx < 0 ? cx * CELL : nz > 0 ? (cz + 1) * CELL : cz * CELL;
      return { nx, nz, key: `${nx},${nz},${plane}` };
    }
    return null;
  }

  /** A climbable cliff face right in front of her (she must be below its top), or null. */
  private climbFace(): Climb | null {
    const b = this.p.body;
    const g = this.world.grid;
    const climbs = heroWorld(this.world).climbs;
    if (!climbs.size) return null;
    const own = Grid.toCell(b.x) + Grid.toCell(b.z) * g.width;
    for (const [nx, nz] of SIDES) {
      const cx = Grid.toCell(b.x - nx * (b.r + 0.3));
      const cz = Grid.toCell(b.z - nz * (b.r + 0.3));
      const idx = cz * g.width + cx;
      if (idx === own || !g.inside(cx, cz) || !climbs.has(idx)) continue;
      const top = g.cell(cx, cz).h;
      if (top < b.y + 0.4) continue;
      const plane = nx > 0 ? (cx + 1) * CELL : nx < 0 ? cx * CELL : nz > 0 ? (cz + 1) * CELL : cz * CELL;
      return { nx, nz, key: `${nx},${nz},${plane}`, cx, cz, top };
    }
    return null;
  }

  /** Grabs a cliff when she pushes into one (from the ground, or in the air if she isn't flying up fast). */
  private tryClimb(wx: number, wz: number, mag: number) {
    const b = this.p.body;
    if (this.grip < 0.4 || mag < 0.3 || b.vy > 7) return;
    const face = this.climbFace();
    if (!face) return;
    if (wx * -face.nx + wz * -face.nz < 0.55) return;
    // On the ground, a ledge she could simply step or hop up isn't worth climbing.
    if (b.grounded && face.top - b.y < 1.2) return;
    this.climb = face;
    this.run = null;
    this.sprinting = false;
    this.p.facing = Math.atan2(-face.nx, -face.nz);
    this.p.noteMove('climb');
    b.vy = 0;
    audio.play('land', 1.4, 0.5);
    haptic('light');
    this.world.particles.emit(b.x - face.nx * 0.4, b.y + 1.2, b.z - face.nz * 0.4, { count: 8, color: '#d8d0c0', speed: 1.5, life: 0.35, size: 0.35, gravity: 3 });
    const hw = heroWorld(this.world);
    if (!hw.climbHinted) {
      hw.climbHinted = true;
      this.world.hooks.toast('Keep pushing at the cliff to CLIMB, sideways to shimmy, JUMP to kick off. Once I’m up, I’ll help the others up!', 'atalanta');
    }
  }

  /**
   * Climbing: pushing into the cliff climbs up, pulling away climbs down, sideways shimmies along it
   * (only as far as the handholds go). Jump kicks off; at the top she pulls herself over.
   */
  private updateClimb(dt: number, input: Input, wx: number, wz: number, mag: number, st: AtalantaStats) {
    const p = this.p;
    const b = p.body;
    const c = this.climb;
    if (!c) return;
    const g = this.world.grid;
    if (input.take('jump')) {
      this.climb = null;
      this.kickOff(c, false);
      return;
    }
    const tx = -c.nz;
    const tz = c.nx;
    const into = mag > 0.2 ? wx * -c.nx + wz * -c.nz : 0;
    const side = mag > 0.2 ? wx * tx + wz * tz : 0;
    const up = clamp(into * 1.4, -1, 1);
    // Only shimmy while there are handholds further along.
    let along = side * ATALANTA.climbSide;
    if (Math.abs(along) > 0.01) {
      const off = Math.sign(along) * (b.r + 0.15);
      const nx = Grid.toCell(b.x + tx * off - c.nx * (b.r + 0.3));
      const nz = Grid.toCell(b.z + tz * off - c.nz * (b.r + 0.3));
      if (!heroWorld(this.world).climbs.has(nz * g.width + nx)) along = 0;
    }
    b.vy = up * st.climbSpeed;
    // Pressed lightly against the face so she keeps touching it.
    p.vx = tx * along - c.nx * 1.2;
    p.vz = tz * along - c.nz * 1.2;
    p.facing = dampAngle(p.facing, Math.atan2(-c.nx, -c.nz), 20, dt);
    this.climbPhase += (Math.abs(b.vy) + Math.abs(along)) * dt;
    // Her arms tire: faster while climbing, slowly while she just hangs on.
    this.grip -= dt * (Math.abs(up) > 0.1 || along !== 0 ? 1 : 0.4);
    if (this.grip <= 0) {
      // Out of grip: she slips off, and catches her breath on the ground.
      this.climb = null;
      b.vy = -1;
      p.vx = c.nx * 2;
      p.vz = c.nz * 2;
      audio.play('hurt', 1.5, 0.35);
      return;
    }
    // Climbed down to the bottom, or off the side of the handholds: let go.
    const face = this.climbFace();
    if ((b.grounded && up < -0.1) || !face || face.nx !== c.nx || face.nz !== c.nz) {
      this.climb = null;
      return;
    }
    this.climb = face;
    // Chest over the lip and still climbing: pull up onto the top.
    if (b.y + 1.05 >= face.top && up > 0.2) this.startMantle(face);
  }

  /** Over the top: an arc from the lip to a step in from the edge, where she stands up. */
  private startMantle(c: Climb) {
    const b = this.p.body;
    const from = new THREE.Vector3(b.x, b.y, b.z);
    const to = new THREE.Vector3(b.x - c.nx * (b.r + 0.75), c.top + 0.02, b.z - c.nz * (b.r + 0.75));
    this.mantle = { from, to, k: 0 };
    this.climb = null;
    this.p.vx = 0;
    this.p.vz = 0;
    audio.play('jump', 0.9, 0.6);
    haptic('light');
  }

  private updateMantle(dt: number) {
    const p = this.p;
    const b = p.body;
    const m = this.mantle;
    if (!m) return;
    m.k = Math.min(1, m.k + dt / ATALANTA.climbMantle);
    // Up first (a knee on the lip), then forward onto the top.
    const up = Math.min(1, m.k * 1.7);
    const fwd = Math.max(0, (m.k - 0.35) / 0.65);
    b.x = m.from.x + (m.to.x - m.from.x) * fwd;
    b.z = m.from.z + (m.to.z - m.from.z) * fwd;
    b.y = m.from.y + (m.to.y - m.from.y) * up;
    b.vy = 0;
    p.vx = 0;
    p.vz = 0;
    if (m.k >= 1) {
      this.mantle = null;
      this.lastWall = null;
      this.world.particles.emit(b.x, b.y + 0.1, b.z, { count: 8, color: '#ffffff', speed: 2, life: 0.3, size: 0.35, gravity: 1 });
    }
  }

  update(dt: number, input: Input) {
    const p = this.p;
    const w = this.world;
    const b = p.body;
    const { wx, wz, mag } = p.moveInput(input);
    const st = this.stats;
    if (b.grounded && !this.climb) this.grip = st.climbGrip;
    if (this.mantle) {
      this.updateMantle(dt);
      // The body was placed by hand: only a gentle settle onto the top (no gravity while pulling up).
      p.stepBody(dt, () => {}, { noGravity: true });
      this.animate(dt, 0);
      return;
    }
    if (this.climb) {
      this.updateClimb(dt, input, wx, wz, mag, st);
      p.tickSpins(dt);
      if (this.climb || this.mantle) {
        if (!p.stepBody(dt, () => {}, { noGravity: true })) {
          this.reset();
          return;
        }
        this.animate(dt, 0);
        return;
      }
    }

    this.coyote = b.grounded ? PLAYER.coyote : this.coyote - dt;
    this.jumpBuf -= dt;
    this.slideCd -= dt;
    this.slideBuf -= dt;
    this.shootCd -= dt;
    this.aimT = Math.max(0, this.aimT - dt);
    if (b.grounded) {
      this.lastWall = null;
      this.ranOn = null;
      this.airKicked = false;
      this.run = null;
    }

    // Sprint: full stick for a moment, straight ahead.
    const full = mag >= ATALANTA.sprintStick && !p.carrying && !p.inMud && !this.crouched && this.slideT <= 0;
    if (full) {
      const v = Math.hypot(p.vx, p.vz);
      let turn = 0;
      if (v > 2) {
        turn = Math.abs(Math.atan2(wx, wz) - Math.atan2(p.vx, p.vz)) % (Math.PI * 2);
        if (turn > Math.PI) turn = Math.PI * 2 - turn;
      }
      if (turn > ATALANTA.sprintTurn) {
        this.sprintT = 0;
        if (b.grounded) this.sprinting = false;
      } else {
        this.sprintT += dt;
        if (this.sprintT >= st.sprintBuild && b.grounded && !this.sprinting) {
          this.sprinting = true;
          audio.play('dash', 1.5, 0.5);
        }
      }
    } else {
      this.sprintT = 0;
      if (b.grounded) this.sprinting = false;
    }

    // Moving: sliding, wall-running, crawling or running.
    if (this.slideT > 0) this.updateSlide(dt);
    else if (this.run) this.updateRun(dt, wx, wz, mag, st);
    else {
      const onIce = b.grounded && b.ground?.kind === 'ice';
      const base = this.crouched ? ATALANTA.crawlSpeed : this.sprinting ? st.sprintSpeed : st.speed;
      const speed = base * (p.carrying ? 0.85 : 1) * (p.inMud ? OUTDOOR.sandSpeed : 1);
      const accel = b.grounded ? (onIce ? PLAYER.iceAccel : PLAYER.accel * (this.sprinting ? 1.2 : 1)) : PLAYER.airAccel;
      p.steer(dt, wx, wz, mag, speed, accel);
    }
    if (this.crouched && this.slideT <= 0 && this.standRoom()) {
      this.crouched = false;
      b.h = PLAYER.height;
    }

    this.updateJump(input);
    if (!b.grounded && !this.run && this.slideT <= 0) this.tryWallRun(wx, wz, mag);
    if (!this.run && this.slideT <= 0 && !this.crouched) this.tryClimb(wx, wz, mag);

    // Slide (the DASH button), buffered a moment so a press just before landing still counts.
    if (input.take('dash')) this.slideBuf = 0.15;
    if (this.slideBuf > 0 && b.grounded && this.slideT <= 0 && this.slideCd <= 0) this.startSlide(wx, wz, mag);

    // Spinning kick (the SPIN button): on the ground or once in the air, where it also stalls the fall.
    if (input.take('spin') && this.slideT <= 0 && p.startSpin(0.38)) {
      if (!b.grounded && !this.airKicked) {
        this.airKicked = true;
        b.vy = Math.max(b.vy, 1.5);
      }
    }
    p.tickSpins(dt);

    this.updateBow(dt, input, st);

    if (this.run) b.vy += GRAVITY * (1 - ATALANTA.wallRunGravity) * dt;
    const ok = p.stepBody(dt, (impact) => {
      if (impact > 8) {
        audio.play('land');
        p.squash = 0.12;
        w.particles.emit(b.x, b.y + 0.1, b.z, { count: 6, color: '#ffffff', speed: 2, life: 0.3, size: 0.35, gravity: 1 });
      }
    });
    if (!ok) {
      this.reset();
      return;
    }
    this.animate(dt, Math.hypot(p.vx, p.vz) / ATALANTA.speed);
  }

  private updateJump(input: Input) {
    const p = this.p;
    const b = p.body;
    const w = this.world;
    if (input.take('jump')) this.jumpBuf = PLAYER.jumpBuffer;
    if (this.jumpBuf > 0) {
      if (this.run) {
        this.kickOff(this.run, true);
      } else if (this.coyote > 0 && (!this.crouched || this.standRoom())) {
        // A jump straight out of a slide keeps its speed: a long jump.
        if (this.slideT > 0) this.endSlide();
        b.vy = ATALANTA.jumpV;
        this.coyote = 0;
        this.jumpBuf = 0;
        this.cut = false;
        audio.play('jump', 1.12);
        w.particles.emit(b.x, b.y + 0.1, b.z, { count: 8, color: '#ffffff', speed: 2.5, life: 0.35, size: 0.4, gravity: 2 });
      } else if (!b.grounded) {
        const face = this.wallFace(false);
        if (face && face.key !== this.lastWall) this.kickOff(face, false);
      }
    }
    if (!input.isHeld('jump') && b.vy > 0 && !this.cut) {
      b.vy *= PLAYER.jumpCut;
      this.cut = true;
    }
  }

  /** A wall-jump: up and away from the wall (keeping some speed along it after a wall-run). */
  private kickOff(face: WallFace, fromRun: boolean) {
    const p = this.p;
    const b = p.body;
    const w = this.world;
    const keep = fromRun ? 0.8 : 0.35;
    const along = p.vx * -face.nz + p.vz * face.nx;
    p.vx = face.nx * ATALANTA.wallKick + -face.nz * along * keep;
    p.vz = face.nz * ATALANTA.wallKick + face.nx * along * keep;
    b.vy = ATALANTA.wallJumpV;
    p.facing = Math.atan2(p.vx, p.vz);
    this.lastWall = face.key;
    if (fromRun) this.ranOn = face.key;
    p.noteMove(fromRun ? 'wallrun' : 'walljump');
    this.run = null;
    this.jumpBuf = 0;
    this.cut = true;
    w.particles.emit(b.x - face.nx * 0.4, b.y + 0.8, b.z - face.nz * 0.4, { count: 12, color: ATALANTA_COLORS.glow, speed: 3.5, life: 0.4, size: 0.4, gravity: 2 });
    audio.play('djump', 1.2);
    haptic('light');
  }

  /** Starts a wall-run when she meets a marked wall in the air, moving along it. */
  private tryWallRun(wx: number, wz: number, mag: number) {
    const p = this.p;
    const b = p.body;
    if (b.vy < -7) return;
    const face = this.wallFace(true);
    if (!face || face.key === this.ranOn) return;
    // Pushing away from the wall means "let go".
    if (mag > 0.3 && wx * face.nx + wz * face.nz > 0.5) return;
    const along = p.vx * -face.nz + p.vz * face.nx;
    if (Math.abs(along) < 3.5) return;
    const s = Math.sign(along);
    this.run = { ...face, tx: -face.nz * s, tz: face.nx * s, t: ATALANTA.wallRunTime };
    this.ranOn = face.key;
    p.noteMove('wallrun');
    b.vy = Math.max(b.vy, ATALANTA.wallRunLift);
    this.sprinting = true;
    audio.play('dash', 1.7, 0.6);
    haptic('light');
  }

  private updateRun(dt: number, wx: number, wz: number, mag: number, st: AtalantaStats) {
    const p = this.p;
    const b = p.body;
    const r = this.run;
    if (!r) return;
    r.t -= dt;
    const face = this.wallFace(true);
    const away = mag > 0.3 && wx * r.nx + wz * r.nz > 0.6;
    if (r.t <= 0 || !face || face.nx !== r.nx || face.nz !== r.nz || away || b.grounded) {
      this.run = null;
      return;
    }
    const along = Math.max(st.sprintSpeed * 0.95, p.vx * r.tx + p.vz * r.tz);
    // Pressed lightly into the wall so she keeps touching it.
    p.vx = r.tx * along - r.nx;
    p.vz = r.tz * along - r.nz;
    p.facing = dampAngle(p.facing, Math.atan2(r.tx, r.tz), 18, dt);
    if (Math.random() < 0.7) this.world.particles.emit(b.x - r.nx * 0.45, b.y + 0.2, b.z - r.nz * 0.45, { count: 1, color: ATALANTA_COLORS.glow, speed: 1, life: 0.3, size: 0.35, gravity: 0 });
  }

  private startSlide(wx: number, wz: number, mag: number) {
    const p = this.p;
    this.slideBuf = 0;
    this.slideT = ATALANTA.slideTime;
    this.slideCd = ATALANTA.slideTime + ATALANTA.slideCooldown;
    this.slideHit.clear();
    if (mag > 0.1) p.facing = Math.atan2(wx, wz);
    p.body.h = ATALANTA.crouchHeight;
    this.crouched = true;
    this.sprinting = false;
    audio.play('dash', 0.85);
    haptic('light');
  }

  private endSlide() {
    this.slideT = 0;
    if (this.standRoom()) {
      this.crouched = false;
      this.p.body.h = PLAYER.height;
    }
  }

  /** The slide itself: fast at first, easing off, tripping every enemy it meets. */
  private updateSlide(dt: number) {
    const p = this.p;
    const b = p.body;
    const w = this.world;
    this.slideT -= dt;
    const k = Math.max(0, this.slideT / ATALANTA.slideTime);
    const speed = ATALANTA.crawlSpeed + (ATALANTA.slideSpeed - ATALANTA.crawlSpeed) * Math.min(1, k * 1.6);
    p.vx = Math.sin(p.facing) * speed;
    p.vz = Math.cos(p.facing) * speed;
    if (b.grounded && Math.random() < 0.8) w.particles.emit(b.x, b.y + 0.1, b.z, { count: 1, color: '#d8d0c0', speed: 1.5, life: 0.35, size: 0.5, up: 1 });
    const front = new THREE.Vector3(b.x + Math.sin(p.facing) * 0.6, b.y + 0.6, b.z + Math.cos(p.facing) * 0.6);
    const dmg = ATALANTA.slideDamage + (w.save.upgrades.blaster ?? 0);
    let tripped = false;
    for (const t of w.targetsNear(front, ATALANTA.slideHitRadius + 1)) {
      if (this.slideHit.has(t) || Math.hypot(t.aim.x - front.x, t.aim.z - front.z) > ATALANTA.slideHitRadius + t.radius) continue;
      this.slideHit.add(t);
      if (t.hit(dmg, 'dash', front)) tripped = true;
    }
    if (tripped) {
      audio.play('hit', 0.8);
      w.shake(0.15);
    }
    if (this.slideT <= 0 || !b.grounded) this.endSlide();
  }

  /* ---------------- the bow ---------------- */

  private updateBow(dt: number, input: Input, st: AtalantaStats) {
    const p = this.p;
    const held = input.isHeld('shoot');
    this.shootBuf = input.take('shoot') ? PLAYER.shootBuffer : this.shootBuf - dt;
    if (this.shootBuf > 0 && this.shootCd <= 0 && p.spinLeft <= 0 && this.slideT <= 0) {
      this.shootBuf = 0;
      this.loose(false, st);
    }
    if (held) {
      this.holdT += dt;
      if (this.holdT > ATALANTA.chargeDelay && p.spinLeft <= 0 && this.slideT <= 0) {
        if (p.charge === 0) audio.play('charge', 1.2);
        p.charge = Math.min(1, p.charge + dt / st.chargeTime);
        if (p.charge >= 1 && !this.chargedFx) {
          this.chargedFx = true;
          audio.play('charged', 1.15);
          haptic('light');
        }
      }
    } else if (this.wasHeld) {
      if (p.charge >= 1) this.loose(true, st);
      p.charge = 0;
      this.holdT = 0;
      this.chargedFx = false;
    }
    this.wasHeld = held;
  }

  /**
   * Picks what to shoot at: the best enemy in front, else an arrow target she is facing. A power arrow
   * goes for a bullseye she is facing first (it still pierces any enemy on the way), so a guard nearby
   * can't steal the shot.
   */
  private aim(origin: THREE.Vector3, power: boolean): Target | THREE.Vector3 | null {
    const range = ATALANTA.aimRange * (power ? 1.4 : 1);
    const bullseye = power ? this.bullseye(origin) : null;
    return bullseye ?? this.world.findAimTarget(origin, this.p.facing, range) ?? this.bullseye(origin);
  }

  /** The un-hit arrow target she is facing (the nearest and most in line), if any. */
  private bullseye(origin: THREE.Vector3): THREE.Vector3 | null {
    const w = this.world;
    let best: THREE.Vector3 | null = null;
    let bestScore = Infinity;
    for (const t of heroWorld(w).targets) {
      if (t.done) continue;
      const dx = t.center.x - origin.x;
      const dz = t.center.z - origin.z;
      const d = Math.hypot(dx, dz);
      if (d > ATALANTA.powerRange) continue;
      let diff = Math.abs(Math.atan2(dx, dz) - this.p.facing) % (Math.PI * 2);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff > 0.6) continue;
      const score = d * (1 + diff * 2);
      if (score < bestScore) {
        bestScore = score;
        best = t.center;
      }
    }
    return best;
  }

  /** Looses an arrow: a quick one, or the charged power arrow (three in a fan with Triple Arrow). */
  private loose(power: boolean, st: AtalantaStats) {
    const p = this.p;
    const w = this.world;
    const b = p.body;
    const arrows = p.arrows;
    if (!arrows) return;
    const origin = new THREE.Vector3(b.x, b.y + 1.15, b.z);
    const aim = this.aim(origin, power);
    const at = aim instanceof THREE.Vector3 ? aim : aim?.aim;
    let dir: THREE.Vector3;
    if (at) {
      dir = at.clone().sub(origin);
      p.facing = Math.atan2(dir.x, dir.z);
    } else dir = new THREE.Vector3(Math.sin(p.facing), 0, Math.cos(p.facing));
    dir.normalize();
    origin.x += Math.sin(p.facing) * 0.6;
    origin.z += Math.cos(p.facing) * 0.6;
    const bonus = w.save.upgrades.blaster ?? 0;
    const dmg = power ? ATALANTA.powerDamage + bonus * 2 + st.powerDamage : 1 + bonus + st.arrowDamage;
    if (!arrows.fire(origin, dir, power, dmg)) return;
    if (power && st.triple) for (const k of [-1, 1]) arrows.fire(origin, dir.clone().applyAxisAngle(UP, k * TRIPLE_ANGLE), true, dmg);
    const rapid = w.save.upgrades.rapid ?? 0;
    this.shootCd = power ? st.powerCooldown : st.arrowCooldown * Math.max(0.5, 1 - rapid * 0.15);
    this.aimT = power ? 0.5 : 0.35;
    if (power) {
      p.vx -= dir.x * 3;
      p.vz -= dir.z * 3;
      audio.play('fireball', 1.5);
      w.flash(origin.x, origin.y, origin.z, ATALANTA_COLORS.glow, 25, 0.2);
      w.shake(0.15);
      haptic('medium');
    } else {
      audio.play('shoot', 1.45 + Math.random() * 0.1);
    }
  }

  /* ---------------- animation ---------------- */

  animate(dt: number, speedFrac: number) {
    const p = this.p;
    const m = this.model;
    const b = p.body;
    p.placeModel(m, dt, p.sink * 0.35);
    const air = !b.grounded;
    p.phase += dt * (5 + 10 * speedFrac);
    const s = Math.sin(p.phase);
    const walk = air && !this.run ? 0 : clamp(speedFrac, 0, 1.4);
    const low = this.slideT > 0 || this.crouched;
    const stride = this.sprinting ? 1.1 : 0.95;
    m.legL.rotation.set(air && !this.run ? -0.7 : s * stride * walk, 0, 0);
    m.legR.rotation.set(air && !this.run ? 0.4 : -s * stride * walk, 0, 0);
    m.armL.rotation.set(air && !this.run ? -1.9 : -s * 0.8 * walk, 0, air ? -0.35 : 0.05);
    m.armR.rotation.set(air && !this.run ? -1.6 : s * 0.8 * walk, 0, air ? 0.35 : -0.05);
    m.body.position.y = air ? 0 : Math.abs(s) * 0.08 * walk;
    m.body.rotation.set(this.sprinting ? 0.25 : walk * 0.08, m.body.rotation.y, 0);
    if (this.slideT > 0) {
      // Feet first, leaning back, one arm out for balance.
      m.body.position.y = -0.55;
      m.body.rotation.x = -0.75;
      m.legL.rotation.x = -1.35;
      m.legR.rotation.x = -1.05;
      m.armL.rotation.set(-0.4, 0, -1.1);
    } else if (this.crouched) {
      m.body.position.y = -0.5;
      m.body.rotation.x = 0.9;
      m.legL.rotation.x = -1.2 + s * 0.5 * walk;
      m.legR.rotation.x = -1.2 - s * 0.5 * walk;
      m.armL.rotation.x = -1.3 - s * 0.4 * walk;
      m.armR.rotation.x = -1.3 + s * 0.4 * walk;
    }
    if (this.run) {
      // Leaning into the wall, legs a blur.
      const side = Math.sign(this.run.tx * this.run.nz - this.run.tz * this.run.nx) || 1;
      m.body.rotation.z = side * 0.35;
      p.phase += dt * 6;
    }
    if (this.climb) {
      // Facing the cliff: hands reaching up in turn, knees stepping up the holds.
      const c = Math.sin(this.climbPhase * 2.6);
      m.body.position.y = 0;
      m.body.rotation.set(-0.12, 0, c * 0.06);
      m.armL.rotation.set(-2.55 + c * 0.55, 0, -0.3);
      m.armR.rotation.set(-2.55 - c * 0.55, 0, 0.3);
      m.legL.rotation.set(-0.85 - c * 0.55, 0, -0.1);
      m.legR.rotation.set(-0.85 + c * 0.55, 0, 0.1);
    } else if (this.mantle) {
      // Pulling over the lip: arms push down, one knee comes up onto the top.
      const k = this.mantle.k;
      const arc = Math.sin(k * Math.PI);
      m.body.position.y = 0;
      m.body.rotation.set(0.55 * arc, 0, 0);
      m.armL.rotation.set(-1.9 + k * 1.6, 0, -0.35);
      m.armR.rotation.set(-1.9 + k * 1.6, 0, 0.35);
      m.legL.rotation.set(-1.5 * arc, 0, 0);
      m.legR.rotation.set(-0.3 * arc, 0, 0);
    }
    // The spinning kick: a whirl with one leg out.
    if (p.spinLeft > 0) {
      m.body.rotation.y += dt * 26;
      m.legR.rotation.set(-1.45, 0, 0.5);
    } else m.body.rotation.y = damp(m.body.rotation.y % (Math.PI * 2), 0, 20, dt);
    // The bow: on her back, or raised in her left hand while aiming, with an arrow on the string while charging.
    const aiming = (this.aimT > 0 || p.charge > 0) && !low;
    m.bowHand.visible = aiming;
    m.bowBack.visible = !aiming;
    if (aiming) {
      m.armL.rotation.set(-1.5, 0, 0);
      m.armR.rotation.set(-1.45 + p.charge * 0.25, 0, 0.35 + p.charge * 0.3);
    }
    m.nocked.visible = p.charge > 0;
    m.nocked.position.set(-0.05, 1.08, 0.55 - p.charge * 0.25);
    const glow = p.charge > 0 ? 0.3 + p.charge * 1.4 + (p.charge >= 1 ? Math.sin(p.phase * 3) * 0.3 : 0) : 0;
    m.chargeGlow.scale.setScalar(Math.max(0.001, glow));
    m.chargeGlow.position.set(-0.05, 1.08, 1.05 - p.charge * 0.25);
    const speed = Math.hypot(p.vx, p.vz);
    m.braid.rotation.x = damp(m.braid.rotation.x, -Math.min(0.9, speed * 0.06 + (air ? 0.35 : 0)) + Math.sin(p.phase) * 0.06, 10, dt);
    m.cape.rotation.x = damp(m.cape.rotation.x, -Math.min(0.55, speed * 0.045), 10, dt);
    p.squash = Math.max(0, p.squash - dt);
    const sq = p.squash > 0 ? 1 - p.squash * 1.6 : 1;
    m.body.scale.set(2 - sq, sq, 2 - sq);
    m.visor.emissiveIntensity = 0.5 + this.world.darkness * 1.2;
    p.fx.update(dt, b.x, p.renderY, b.z, { pounding: false, hang: 0, hangMax: 1, airborne: air });
    p.pose?.(m, dt);
  }
}
