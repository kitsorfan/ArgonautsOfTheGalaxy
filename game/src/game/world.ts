import * as THREE from 'three';

import { audio, type Sfx, type Track } from '../core/audio';
import { haptic } from '../core/bridge';
import { CELL, PLAYER, PULSE } from '../core/constants';
import { tr } from '../core/i18n';
import type { Input } from '../core/input';
import { damp } from '../core/math';
import { addBolts, type Quality, type SaveData } from '../core/save';
import type { Director, Rig } from '../cinema/director';
import * as fleeceScenes from '../cinema/fleeceScenes';
import type { GoldenKing } from '../entities/ch3/goldenKing';
import { addSeal } from '../entities/ch3/seals';
import * as scenes from '../cinema/scenes';
import { Bolt, HelmetLamp, Torch } from '../entities/bolt';
import { makeBoss, type Boss } from '../entities/bosses';
import { findKind, rescueKind } from './collectibles';
import { knowsGardenerWords } from './story';
import { SupplyNet } from '../entities/isles/supplies';
import { companionPlan, helperOf, IRIS_FLAG, LUX_BACK_FLAG, ROGUE_MARKER, voiceOf, type CompanionPlan, type CompanionSkin, type Helper } from './companions';
import type { BadgeKind } from '../entities/badges';
import { makeEnemy, type Enemy } from '../entities/enemies';
import { difficultyFor, type Difficulty } from './difficulty';
import type { PuzzleKind } from './puzzles';
import { COLONIST_BOLTS, HINTS } from './quests';
import { chapterOf, chapterTotals, inChapter, isFinale } from '../levels';
import { Anchor, Boulder, Quicksand, Wind } from '../entities/outdoor';
import { Raft, Tide } from '../entities/reef/tide';
import type { Entity, HitKind, Interactable, Target } from '../entities/entity';
import { Beams, Rings } from '../entities/fx';
import { ArrowTarget, ClimbWall, LowGap, WallRun } from '../entities/heroes/heroProps';
import { atalantaStats } from '../entities/heroes/atalantaStats';
import { parkedFlag } from '../entities/heroes/heroes';
import { CommandPost, CrackedWall, HeavyPlate, legionWorld } from '../entities/heroes/legion';
import { AllyBot, LegionBot } from '../entities/heroes/legionBots';
import { BrittleFloor, BronzeGate } from '../entities/forge/forgeProps';
import { GazeSentry, LightCrystal, MirrorPylon } from '../entities/labyrinth/gaze';
import { SkyArch } from '../entities/stand/arch';
import { DockGun } from '../entities/stand/dockgun';
import { Hold, resetHolds } from '../entities/stand/holds';
import { isRobot } from '../entities/robots';
import { Impacts } from '../entities/moveFx';
import { BoltField, Canister, EnergyPickup, HeartPickup, PowerCell, Shard, UpgradePickup } from '../entities/pickups';
import { Player } from '../entities/player';
import {
  BoltFind,
  BouncePad,
  BreakWall,
  Checkpoint,
  Cocoon,
  Conveyor,
  Crate,
  Door,
  Exit,
  Faller,
  Holo,
  Prize,
  Rune,
  FloorSwitch,
  Laser,
  Platform,
  Sign,
  Socket,
  Terminal,
  Trigger,
  Vendor,
  Vent,
  ZapFloor,
  type FloorFx,
  type Overloadable,
} from '../entities/props';
import { Bramble } from '../entities/flame';
import { Shots } from '../entities/shots';
import { buildLevel, type BuiltLevel } from '../world/builder';
import { buildDecor, type DecorPlacement } from '../world/decor';
import { Grid, parseLevel } from '../world/grid';
import type { Ability, BossKind, Cond, EndingKind, EnemyKind, HeroId, LevelDef, Line, ParsedLevel, PlacedEntity, Speaker } from '../world/levelTypes';
import { makeVehicle } from '../vehicles';
import type { Vehicle } from '../vehicles/vehicle';
import { Ambience, Particles } from '../world/particles';
import { pointBlocked, type Box, type Ground } from '../world/physics';
import { buildSky } from '../world/sky';
import { THEMES, type Theme } from '../world/themes';

export type Collectible = 'shard' | 'canister' | 'colonist' | 'ability';

export interface WorldHooks {
  say(lines: Line[], then?: () => void): void;
  toast(text: string, who?: Speaker): void;
  /** Who helps Jason right now (the action button's face and the hacking panel follow it). */
  helper?(who: Helper | null): void;
  hack(length: number, done: (ok: boolean) => void, kind?: PuzzleKind): void;
  shop(): void;
  complete(): void;
  checkpoint(): void;
  collect(kind: Collectible, id: string): void;
  hud(): void;
  bossBar(name: string | null, frac: number): void;
  down(): void;
  music(track: Track): void;
  objective(text: string): void;
  ending(kind: EndingKind): void;
  /** A vault chest was opened. */
  prize(reward: string): void;
  /** A gold banner for rewards (bolts, hearts, quests). */
  reward(text: string): void;
  /** A pulsing warning banner that stays up until it is cleared with null (MEDUSA's glare). */
  warn?(text: string | null): void;
  /** The first time Jason meets a kind of enemy (or an elite), show what it is and what it's up to. */
  threat(kind: BadgeKind | 'elite'): void;
  /** Jason tried to dash with no energy left. */
  dashEmpty(): void;
  /** A side quest may have just been finished (a flight's best run improved): pay it out and save. */
  progress(): void;
  /** Queues a cutscene; it plays as soon as nothing else is on screen and resolves when it ends. */
  cutscene(script: (d: Director) => Promise<void>): Promise<void>;
}

export interface ResumeState {
  checkpoint: string | null;
  flags: string[];
  taken: string[];
  dead: string[];
}

/** Usual camera tilt above the horizon (radians), and the steepest it tips to when walls would hide Jason. */
const PITCH = 1.0;
const PITCH_MAX = 1.5;
/** A flatter tilt while a far-off boss (MEDUSA) shares the screen with the hero. */
const FRAME_PITCH = 0.72;
/** Strength of the studio reflections; the game assigns the environment map itself. */
const ENV_LIGHT = 0.45;
const tmpV = new THREE.Vector3();
const tmpL = new THREE.Vector3();
/** Fixed sun direction, and the rotation into (and out of) the shadow camera's space. */
const LIGHT_DIR = new THREE.Vector3(12, 30, 8).normalize();
const LIGHT_ROT = new THREE.Matrix4().lookAt(LIGHT_DIR, new THREE.Vector3(), new THREE.Vector3(0, 1, 0));
const LIGHT_INV = LIGHT_ROT.clone().transpose();
const NO_BOXES: Box[] = [];
/** The objective while the heroes are out of the bronze mech (Talos's Forge) and it waits for them. */
const MECH_OBJECTIVE: { text: string; at?: string } = { text: 'Climb back into the bronze mech' };

export class World {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly level: ParsedLevel;
  readonly grid: Grid;
  readonly theme: Theme;
  readonly def: LevelDef;
  readonly boxes: Box[] = [];
  readonly player: Player;
  /** Jason's two droids: LUX, and IRIS (from the jungle on). Which of them is around comes from `plan`. */
  readonly lux: Bolt;
  readonly iris: Bolt;
  /** Jason's own helmet lamp, for the dark when no droid is around. */
  private lamp: HelmetLamp;
  /** The one flashlight the lead droid (or the helmet lamp) shines into dark rooms. */
  private torch: Torch;
  plan: CompanionPlan = { lead: null, tag: null };
  /** The main boss of the deck, while a mini-boss (Brennus's reprogrammed LUX) has the stage. */
  private mainBoss: Boss | null = null;
  readonly particles: Particles;
  readonly ambience: Ambience;
  readonly shots: Shots;
  readonly beams: Beams;
  readonly rings: Rings;
  readonly impacts: Impacts;
  readonly boltField: BoltField;
  readonly flags = new Set<string>();
  readonly taken = new Set<string>();
  readonly dead = new Set<string>();
  /** How tough this deck's enemies are: it rises deck by deck and with Jason's weapon upgrades. */
  readonly difficulty: Difficulty;
  private levelEnemies = new Set<string>();
  private runes: Rune[] = [];
  private switches: FloorSwitch[] = [];
  /** Seconds left on each running switch clock, by the flag its switches set. */
  private clocks = new Map<string, number>();
  /** Every prop, enemy and boss on the level (the trailer finds its hologram projectors here). */
  readonly entities: Entity[] = [];
  private movers: Entity[] = [];
  private targets: Target[] = [];
  private interactables: Interactable[] = [];
  private enemies: Enemy[] = [];
  private floor = new Map<number, FloorFx>();
  private checkpoints: Checkpoint[] = [];
  private activeCheckpoint: Checkpoint | null = null;
  private built: BuiltLevel;
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private fog: THREE.Fog;
  private fogColor: THREE.Color;
  boss: Boss | null = null;
  focus: Interactable | null = null;
  time = 0;
  cutscene = false;
  darkness = 0;
  cameraYaw = 0;
  private camTarget = new THREE.Vector3();
  /** What the camera looked at on the last frame (cutscenes start from here). */
  readonly cameraLook = new THREE.Vector3();
  private follow: Rig = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 50 };
  private camRig: Rig | null = null;
  private blendFrom: Rig | null = null;
  private blendT = 0;
  private blendMax = 1;
  private baseFov = 50;
  /** The lift at the end of the deck, if there is one. */
  exit: Exit | null = null;
  private shakeAmt = 0;
  private objT = 0;
  private lastObjective = '';
  /** Seconds until LUX's force pulse is ready again. */
  pulseCd = 0;
  /** Lasers and zap floors, which LUX's force pulse can overload. */
  private overloadables: Overloadable[] = [];
  /** Where the current objective wants Jason to go (a `marker`, the boss or the lift), if anywhere. */
  waypoint: THREE.Vector3 | null = null;
  private markers = new Map<string, THREE.Vector3>();
  private hintT = 1;
  private shadowTexel = 0;
  /** Jason's ground height, smoothed and ignoring jumps; the shadow map is centred on it. */
  private groundY = 0;
  private pitch = PITCH;
  private flashLight: THREE.PointLight | null = null;
  private flashT = 0;
  private flashMax = 1;
  private flashPower = 0;
  /** Remaining hit-stop: a split-second freeze that sells heavy impacts. */
  private freezeT = 0;
  /** On a vehicle level (the Argo...), the vehicle that runs instead of Jason on foot. */
  readonly vehicle: Vehicle | null = null;
  /** The rising and falling sea of a tidal level (Scylla's Reef). */
  readonly tide: Tide | null = null;

  constructor(
    def: LevelDef,
    readonly save: SaveData,
    readonly hooks: WorldHooks,
    quality: Quality,
    resume: ResumeState | null,
  ) {
    this.def = def;
    this.level = parseLevel(def);
    this.grid = new Grid(this.level.width, this.level.depth, this.level.cells);
    this.theme = THEMES[def.id];
    if (resume) {
      // Back at a checkpoint, everyone starts aboard the bronze mech again (wherever it was left parked).
      for (const f of resume.flags) if (f !== parkedFlag('mech')) this.flags.add(f);
      for (const t of resume.taken) this.taken.add(t);
      for (const d of resume.dead) this.dead.add(d);
    }
    if (def.index > 1) this.flags.add('bolt');
    // A cracked vault stays cracked: every vault puzzle sets the `vault` flag, so once the chest is
    // open, later visits find the puzzle solved and the door open.
    if ((save.prizes ?? []).includes(`${def.id}.vault`)) this.flags.add('vault');
    this.difficulty = difficultyFor(def.index, save);
    // Enemies always come back when a deck is re-entered; only cleared rooms stay open.
    this.dead.clear();

    const th = this.theme;
    this.fogColor = new THREE.Color(th.fog);
    this.fog = new THREE.Fog(th.fog, th.fogNear, th.fogFar);
    this.scene.fog = this.fog;
    this.scene.background = new THREE.Color(th.skyTop);
    this.camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.3, 500);

    this.hemi = new THREE.HemisphereLight(th.hemiSky, th.hemiGround, th.hemi);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(th.sun, th.sunI);
    const shadows = quality !== 'low';
    this.sun.castShadow = shadows;
    if (shadows) {
      const size = quality === 'high' ? 2048 : 1024;
      this.sun.shadow.mapSize.set(size, size);
      const cam = this.sun.shadow.camera;
      cam.left = -22;
      cam.right = 22;
      cam.top = 22;
      cam.bottom = -22;
      cam.near = 1;
      cam.far = 90;
      this.sun.shadow.bias = -0.0006;
      this.sun.shadow.normalBias = 0.05;
      this.shadowTexel = (cam.right - cam.left) / size;
    }
    this.scene.add(this.sun, this.sun.target);
    if (quality !== 'low') {
      // One pooled light for impact flashes; it always exists so shaders never recompile mid-game.
      this.flashLight = new THREE.PointLight('#ffffff', 0, 14, 2);
      this.scene.add(this.flashLight);
    }

    this.built = buildLevel(this.level, this.grid, th, shadows);
    this.scene.add(this.built.group);
    const span = Math.max(this.level.width, this.level.depth) * CELL;
    // A vehicle level has no deck to walk on: the vehicle stages its own surroundings.
    if (def.vehicle) this.built.group.visible = false;
    else this.scene.add(buildSky(th, new THREE.Vector3((this.level.width * CELL) / 2, 0, (this.level.depth * CELL) / 2), span));

    this.particles = new Particles(quality === 'low' ? 900 : 1600);
    this.scene.add(this.particles.points);
    this.ambience = new Ambience(th.mood);
    this.scene.add(this.ambience.points);
    this.beams = new Beams(this.scene);
    this.rings = new Rings(this.scene);
    this.impacts = new Impacts(this.scene);

    const sp = this.level.spawn;
    this.player = new Player(this, Grid.center(sp.cx), sp.h, Grid.center(sp.cz), sp.facing);
    this.cameraYaw = sp.facing + Math.PI;
    this.shots = new Shots(this);
    this.boltField = new BoltField(this);
    this.torch = new Torch(this.scene);
    this.lux = new Bolt(this, 'lux', this.torch);
    this.iris = new Bolt(this, 'iris', this.torch);
    this.lamp = new HelmetLamp(this, this.torch);
    this.refreshCompanions();

    // The sea moves first, so rafts and everything else see this frame's tide.
    if (def.tide) {
      this.tide = new Tide(this, def.tide);
      this.movers.push(this.tide);
    }
    for (const pe of this.level.entities) this.spawnSpec(pe);
    this.spawnRogue();
    // Back at a checkpoint after General Brennus joined: his squad is already here.
    if (def.joins?.brennus && this.flags.has(def.joins.brennus)) this.squadArrives();
    // A hero who joins later waits at the marker named after her (Atalanta by her skiff).
    this.player.showWaiting((id) => this.markers.get(id));
    this.scene.add(buildDecor(this.decorItems, th.accent, this.boxes));

    if (resume?.checkpoint) {
      const cp = this.checkpoints.find((c) => c.id === resume.checkpoint);
      if (cp) {
        cp.setActive(true);
        this.activeCheckpoint = cp;
        this.player.teleport(cp.spot.x, cp.spot.y, cp.spot.z + 1.2);
      }
    }
    const pb = this.player.body;
    this.placeDroids(pb.x, pb.y, pb.z);
    this.camTarget.set(pb.x, pb.y + 1.2, pb.z);
    this.groundY = pb.y;
    if (def.vehicle) {
      // Jason and LUX ride inside the vehicle.
      this.player.model.root.visible = false;
      this.bolt.active = false;
      this.bolt.model.root.visible = false;
      this.vehicle = makeVehicle(def.vehicle, this);
    }
    this.placeCamera(0);
  }

  /** Lights up the surroundings for a moment (pounds, explosions, boss hits). */
  flash(x: number, y: number, z: number, color: string, power = 30, time = 0.25) {
    if (!this.flashLight || power < this.flashPower * (this.flashT / this.flashMax)) return;
    this.flashLight.position.set(x, y, z);
    this.flashLight.color.set(color);
    this.flashPower = power;
    this.flashT = time;
    this.flashMax = time;
  }

  /** Freezes the action for a split second so a big hit lands with weight. */
  hitStop(seconds: number) {
    this.freezeT = Math.max(this.freezeT, seconds);
  }

  /* ---------------- spawning ---------------- */

  private spawnSpec(pe: PlacedEntity) {
    const { spec, cx, cz, h, id } = pe;
    const s = this.save;
    switch (spec.type) {
      case 'bolt':
        this.boltField.add(Grid.center(cx), h + 1, Grid.center(cz));
        break;
      case 'crate':
        if (!this.taken.has(id)) this.addEntity(new Crate(this, id, cx, cz, h, spec.loot, spec.metal));
        break;
      case 'heart':
        if (!this.taken.has(id)) this.addEntity(new HeartPickup(this, id, cx, cz, h, id));
        break;
      case 'canister':
        if (!s.canisters.includes(id)) this.addEntity(new Canister(this, id, cx, cz, h));
        break;
      case 'shard':
        if (!s.shards.includes(id)) this.addEntity(new Shard(this, id, cx, cz, h));
        break;
      case 'upgrade':
        if (!s.abilities.includes(spec.ability)) this.addEntity(new UpgradePickup(this, id, cx, cz, h, spec.ability));
        break;
      case 'checkpoint': {
        const cp = this.addEntity(new Checkpoint(this, id, cx, cz, h));
        this.checkpoints.push(cp);
        break;
      }
      case 'enemy': {
        this.levelEnemies.add(id);
        const e = makeEnemy(this, id, spec.enemy, cx, cz, h, spec.variant);
        e.room = spec.room;
        this.addEntity(e);
        this.registerEnemy(e);
        break;
      }
      case 'boss':
        if (!this.flags.has('boss')) {
          // If Jason already beat the Heart of GaScu once, its reborn form is waiting instead.
          const kind = spec.boss === 'heart' && this.flags.has('reborn') ? 'reborn' : spec.boss;
          const b = this.addEntity(makeBoss(this, id, kind, cx, cz, h));
          if (kind === 'reborn') b.introSeen = true;
          this.boss = b;
        }
        break;
      case 'door':
        this.addEntity(new Door(this, id, cx, cz, h, spec.open));
        break;
      case 'rune': {
        const r = this.addEntity(new Rune(this, id, cx, cz, h, spec.group, spec.order, spec.color));
        this.runes.push(r);
        if (this.flags.has(spec.group)) r.setLit(true);
        break;
      }
      case 'prize':
        this.addEntity(new Prize(this, id, cx, cz, h, spec.reward));
        break;
      case 'switch': {
        const sw = this.addEntity(new FloorSwitch(this, id, cx, cz, h, spec.flag, spec.timed, spec.together));
        this.switches.push(sw);
        if (spec.seal) addSeal(this, sw, spec.seal);
        if (spec.together && this.flags.has(spec.flag)) sw.setDown(true);
        break;
      }
      case 'terminal':
        this.addEntity(new Terminal(this, id, cx, cz, h, spec.flag, spec.length, spec.puzzle));
        break;
      case 'cell':
        if (!this.taken.has(id)) this.addEntity(new PowerCell(this, id, cx, cz, h));
        break;
      case 'socket':
        this.addEntity(new Socket(this, id, cx, cz, h, spec.flag));
        break;
      case 'platform':
        this.movers.push(new Platform(this, id, cx, cz, h, spec));
        break;
      case 'faller':
        this.movers.push(new Faller(this, id, cx, cz, h));
        break;
      case 'bounce':
        this.addEntity(new BouncePad(this, id, cx, cz, h));
        break;
      case 'vent':
        this.addEntity(new Vent(this, id, cx, cz, h, spec.period, spec.offset));
        break;
      case 'laser':
        this.overloadables.push(this.addEntity(new Laser(this, id, cx, cz, h, spec)));
        break;
      case 'zap':
        this.overloadables.push(this.addEntity(new ZapFloor(this, id, cx, cz, h, spec.period, spec.offset)));
        break;
      case 'energy':
        this.addEntity(new EnergyPickup(this, id, cx, cz, h, true));
        break;
      case 'marker':
        this.markers.set(spec.id, new THREE.Vector3(Grid.center(cx), h, Grid.center(cz)));
        break;
      case 'conveyor':
        this.addEntity(new Conveyor(this, id, cx, cz, h, spec.dx, spec.dz, spec.speed));
        break;
      case 'cocoon':
        // Chapter 3 rescues stolen things from gold harpy nets instead of people from cocoons.
        if (!s.colonists.includes(id)) this.addEntity(rescueKind(chapterOf(this.def.id)) === 'supplies' ? new SupplyNet(this, id, cx, cz, h, spec.name, spec.line) : new Cocoon(this, id, cx, cz, h, spec.name, spec.line));
        break;
      case 'vendor':
        this.addEntity(new Vendor(this, id, cx, cz, h));
        break;
      case 'sign':
        this.addEntity(new Sign(this, id, cx, cz, h, spec.text));
        break;
      case 'trigger':
        this.addEntity(new Trigger(this, id, cx, cz, spec));
        break;
      case 'exit':
        this.exit = this.addEntity(new Exit(this, id, cx, cz, h));
        break;
      case 'holo':
        this.addEntity(new Holo(this, id, cx, cz, h, spec.log, spec.who ?? 'captain'));
        break;
      case 'breakwall':
        if (!this.taken.has(id)) this.addEntity(new BreakWall(this, id, cx, cz, h));
        break;
      case 'bramble':
        if (!this.taken.has(id)) this.addEntity(new Bramble(this, id, cx, cz, h));
        break;
      case 'boltfind': {
        const who = spec.who ?? 'lux';
        if (!this.flags.has(who === 'iris' ? IRIS_FLAG : 'bolt')) this.addEntity(new BoltFind(this, id, cx, cz, h, who));
        break;
      }
      case 'anchor':
        this.addEntity(new Anchor(this, id, cx, cz, h));
        break;
      case 'wind':
        this.addEntity(new Wind(this, id, cx, cz, h, spec.dx, spec.dz, spec.w, spec.d, spec.period, spec.offset, spec.strength));
        break;
      case 'quicksand':
        this.addEntity(new Quicksand(this, id, cx, cz, h));
        break;
      case 'boulder':
        this.addEntity(new Boulder(this, id, cx, cz, h, spec.axis, spec.length, spec.period, spec.offset));
        break;
      case 'target': {
        const t = this.addEntity(new ArrowTarget(this, id, cx, cz, h, spec.flag));
        if (spec.seal) addSeal(this, t, spec.seal);
        break;
      }
      case 'wallrun':
        this.addEntity(new WallRun(this, id, cx, cz, h));
        break;
      case 'climb':
        this.addEntity(new ClimbWall(this, id, cx, cz, h));
        break;
      case 'lowgap':
        this.addEntity(new LowGap(this, id, cx, cz, h, spec.axis));
        break;
      case 'cracked':
        if (!this.taken.has(id)) {
          const c = this.addEntity(new CrackedWall(this, id, cx, cz, h));
          if (spec.seal) addSeal(this, c, spec.seal);
        }
        break;
      case 'post':
        this.addEntity(new CommandPost(this, id, cx, cz, h, spec.flag, spec.order, spec.room));
        break;
      case 'legionbot':
        this.addEntity(new LegionBot(this, id, cx, cz, h, spec.flag));
        break;
      case 'plate':
        this.addEntity(new HeavyPlate(this, id, cx, cz, h, spec.flag));
        break;
      case 'raft':
        this.movers.push(new Raft(this, id, cx, cz, h));
        break;
      case 'bronzegate':
        if (!this.taken.has(id)) this.addEntity(new BronzeGate(this, id, cx, cz, h));
        break;
      case 'brittle':
        if (!this.taken.has(id)) this.addEntity(new BrittleFloor(this, id, cx, cz, spec.lid));
        break;
      case 'gazer':
        this.addEntity(new GazeSentry(this, id, cx, cz, h, spec.dir, spec.sweep, spec.period, spec.offset, spec.reach));
        break;
      case 'mirror':
        this.addEntity(new MirrorPylon(this, id, cx, cz, h, spec.turn));
        break;
      case 'crystal':
        this.addEntity(new LightCrystal(this, id, cx, cz, h, spec.flag));
        break;
      case 'dockgun':
        this.addEntity(new DockGun(this, id, cx, cz, h, spec.flag));
        break;
      case 'hold':
        this.addEntity(new Hold(this, id, cx, cz, h, spec));
        break;
      case 'arch':
        this.addEntity(new SkyArch(this, id, cx, cz, h, spec.span));
        break;
      case 'decor':
        this.decorItems.push({
          kind: spec.kind,
          x: Grid.center(cx),
          y: h,
          z: Grid.center(cz),
          rot: spec.rot ?? 0,
          scale: spec.scale ?? 1,
          solid: spec.solid ?? true,
        });
        break;
      default:
        break;
    }
  }

  private decorItems: DecorPlacement[] = [];

  addEntity<T extends Entity>(e: T): T {
    this.entities.push(e);
    return e;
  }

  forget(e: Entity) {
    for (const list of [this.entities, this.movers] as Entity[][]) {
      const i = list.indexOf(e);
      if (i >= 0) list.splice(i, 1);
    }
    const t = this.targets.indexOf(e as unknown as Target);
    if (t >= 0) this.targets.splice(t, 1);
    const it = this.interactables.indexOf(e as unknown as Interactable);
    if (it >= 0) this.interactables.splice(it, 1);
    const en = this.enemies.indexOf(e as unknown as Enemy);
    if (en >= 0) this.enemies.splice(en, 1);
  }

  addTarget(t: Target) {
    this.targets.push(t);
  }

  removeTarget(t: Target) {
    const i = this.targets.indexOf(t);
    if (i >= 0) this.targets.splice(i, 1);
  }

  addInteractable(i: Interactable) {
    this.interactables.push(i);
  }

  registerEnemy(e: Enemy) {
    this.enemies.push(e);
    this.targets.push(e);
  }

  spawnEnemy(kind: EnemyKind, cx: number, cz: number, variant?: string): Enemy {
    const c = this.grid.cell(cx, cz);
    const h = c.kind === 'void' || c.kind === 'wall' ? this.player.body.y : c.h;
    const e = makeEnemy(this, `spawn${Math.random()}`, kind, cx, cz, h + 0.5, variant);
    this.addEntity(e);
    this.registerEnemy(e);
    this.particles.emit(Grid.center(cx), h + 0.6, Grid.center(cz), { count: 18, color: '#ff9ae0', speed: 5, life: 0.5 });
    return e;
  }

  registerFloor(cx: number, cz: number, fx: FloorFx) {
    this.floor.set(cz * this.level.width + cx, fx);
  }

  floorEffect(g: Ground | null): FloorFx | undefined {
    if (!g || g.kind === 'box') return undefined;
    return this.floor.get(g.cz * this.level.width + g.cx);
  }

  /* ---------------- flags & conditions ---------------- */

  setFlag(f: string) {
    this.flags.add(f);
  }

  clearFlag(f: string) {
    this.flags.delete(f);
  }

  hasFlag(f: string) {
    return this.flags.has(f);
  }

  cond(c: Cond): boolean {
    if ('flag' in c) return this.flags.has(c.flag) || (c.flag.startsWith('ability:') && this.save.abilities.includes(c.flag.slice(8) as Ability));
    if ('clear' in c) return this.flags.has(`cleared:${c.clear}`) || !this.enemies.some((e) => e.alive && e.room === c.clear);
    if ('boss' in c) return this.flags.has('boss');
    if ('all' in c) return c.all.every((x) => this.cond(x));
    return false;
  }

  /* ---------------- Jason's droids ---------------- */

  /** The droid doing the work right now (LUX, or IRIS); LUX, switched off, when Jason is alone. */
  get bolt(): Bolt {
    return this.plan.lead === 'iris' ? this.iris : this.lux;
  }

  /** True while a droid flies with Jason (it zaps, lights the dark and fires the force pulse). */
  get boltActive() {
    return this.plan.lead !== null;
  }

  /** Who hacks terminals and lights the dark: a droid, Jason's wrist computer, or nobody yet. */
  get helper(): Helper | null {
    return helperOf(this.def.id, this.plan);
  }

  /** Terminals need a droid, or (on Gaia Nova) Jason's wrist computer. */
  get canHack() {
    return this.helper !== null;
  }

  /** Works out again who is with Jason (after a droid joins, leaves or comes home). */
  refreshCompanions() {
    const pl = this.player;
    this.plan = companionPlan(this.def.id, (f) => this.flags.has(f), {
      chapter: chapterOf(this.def.id),
      hero: pl.hero,
      atalanta: pl.roster.includes('atalanta'),
    });
    this.lux.active = this.plan.lead === 'lux' || this.plan.tag === 'lux';
    this.lux.role = this.plan.lead === 'lux' ? 'lead' : 'tag';
    this.iris.active = this.plan.lead === 'iris' || this.plan.tag === 'iris';
    this.iris.role = this.plan.lead === 'iris' ? 'lead' : 'tag';
    this.lamp.on = this.plan.lead === null;
    this.hooks.helper?.(this.helper);
  }

  private placeDroids(x: number, y: number, z: number) {
    this.lux.place(x - 1, y + 2, z + 1);
    this.iris.place(x + 1, y + 2.4, z + 1.5);
  }

  /** Who really says a line written for LUX (see `voiceOf`). */
  voice(who: Speaker, toast = false): Speaker {
    return voiceOf(who, this.plan, toast, this.player?.hero);
  }

  /** A droid joins Jason: LUX on the Cryo Deck, IRIS in the jungle. */
  joinBolt(skin: CompanionSkin = 'lux') {
    this.flags.add(skin === 'iris' ? IRIS_FLAG : 'bolt');
    this.refreshCompanions();
    const p = this.player.body;
    (skin === 'iris' ? this.iris : this.lux).place(p.x, p.y + 3, p.z);
    audio.play('upgrade');
    this.hooks.checkpoint();
  }

  /** Dev helper (`#deck=...&flags=...&play=...`): sets story flags and plays one of LUX's chapter 2 scenes. */
  devStory(flags: string[], play: string | null) {
    for (const f of flags) this.flags.add(f);
    // A join flag (`&flags=atalanta`) brings that hero in at once.
    if (Object.values(this.def.joins ?? {}).some((f) => flags.includes(f))) this.player.heroJoined();
    if (this.def.joins?.brennus && flags.includes(this.def.joins.brennus)) this.squadArrives();
    this.refreshCompanions();
    const find = this.entities.find((e): e is BoltFind => e instanceof BoltFind);
    const rogue = this.entities.find((e) => (e as Boss).bossKind === 'rogue') as Boss | undefined;
    if (play === 'taken') void this.hooks.cutscene((d) => scenes.luxTaken(d, this));
    else if (play === 'iris' && find) this.findBolt(find);
    else if (play === 'rogue' && rogue) rogue.begin();
    // &play=outro plays the deck's boss-defeated scene (e.g. the Argo passing General Brennus's sky-dock).
    else if (play === 'outro' && this.boss) {
      const b = this.boss;
      void this.hooks.cutscene((d) => scenes.bossOutro(d, this, b));
    }
    else if (play === 'reunion' && rogue) {
      rogue.defeated = true;
      this.luxBack(rogue);
    }
  }

  /** Brennus's reprogrammed LUX waits at the `rogue` marker until he is beaten and himself again. */
  private spawnRogue() {
    const at = this.markers.get(ROGUE_MARKER);
    if (!at || this.flags.has(LUX_BACK_FLAG)) return;
    this.mainBoss = this.boss;
    this.addEntity(makeBoss(this, `${this.def.id}.rogue`, 'rogue', Math.floor(at.x / CELL), Math.floor(at.z / CELL), at.y));
  }

  /** The control chip breaks: LUX is himself again, and he and IRIS both fly with Jason from now on. */
  private luxBack(b: Boss) {
    this.flags.add(LUX_BACK_FLAG);
    this.boss = this.mainBoss;
    this.hooks.bossBar(null, 0);
    this.hooks.music(this.def.music);
    void this.hooks.cutscene((d) => scenes.luxReunion(d, this, b)).then(() => this.hooks.checkpoint());
  }

  dialogue(id: string): Line[] {
    return this.def.dialogues[id] ?? [];
  }

  markTaken(id: string) {
    this.taken.add(id);
  }

  canExit() {
    return this.def.boss ? this.flags.has('boss') : true;
  }

  heldCell(): PowerCell | null {
    for (const e of this.entities) if (e instanceof PowerCell && e.isHeld) return e;
    return null;
  }

  collect(kind: Collectible, id: string) {
    const s = this.save;
    if (kind === 'shard' && !s.shards.includes(id)) s.shards.push(id);
    if (kind === 'canister' && !s.canisters.includes(id)) s.canisters.push(id);
    if (kind === 'colonist' && !s.colonists.includes(id)) {
      s.colonists.push(id);
      addBolts(s, COLONIST_BOLTS);
      const ch = chapterOf(this.def.id);
      const args = { n: COLONIST_BOLTS, saved: inChapter(s.colonists, ch), total: chapterTotals(ch).colonists };
      // In chapter 3 it is stolen things that get won back, counted per level.
      if (rescueKind(ch) === 'supplies') {
        const here = (this.def.colonistIds ?? []).filter((c) => s.colonists.includes(`${this.def.id}.${c}`)).length;
        this.hooks.reward(tr('Won back! +{n} bolts · {saved} / {total} here', { n: COLONIST_BOLTS, saved: here, total: this.def.colonistIds?.length ?? 0 }));
      } else this.hooks.reward(tr('Colonist rescued! +{n} bolts · {saved} / {total} saved', args));
    }
    this.hooks.collect(kind, id);
    this.hooks.hud();
  }

  unlock(ability: Ability, id: string) {
    if (!this.save.abilities.includes(ability)) this.save.abilities.push(ability);
    this.hooks.collect('ability', ability);
    void id;
  }

  event(name: string) {
    if (name === 'bolt') this.joinBolt();
    else if (name.startsWith('flag:')) this.setFlag(name.slice(5));
    else if (name.startsWith('music:')) this.hooks.music(name.slice(6) as Track);
    else if (name === 'shake') this.shake(0.6);
    else if (name.startsWith('story:')) this.playStory(name.slice(6));
    else if (name.startsWith('join:')) this.heroJoins(name.slice(5) as HeroId);
  }

  /** Jason meets a hero who joins the Argonauts here (once): the meeting scene, then she can play. */
  private heroJoins(hero: HeroId) {
    const flag = this.def.joins?.[hero];
    if (!flag || this.flags.has(flag)) return;
    void this.hooks.cutscene((d) => scenes.heroJoins(d, this, hero));
  }

  /** Where a `marker` sits (for cutscenes), if the level has it. */
  marker(id: string): THREE.Vector3 | null {
    return this.markers.get(id)?.clone() ?? null;
  }

  /* ---------------- combat ---------------- */

  findAimTarget(origin: THREE.Vector3, facing: number, range: number): Target | null {
    let best: Target | null = null;
    let bestScore = Infinity;
    for (const t of this.targets) {
      if (!t.alive || !t.aimable) continue;
      const dx = t.aim.x - origin.x;
      const dz = t.aim.z - origin.z;
      const d = Math.hypot(dx, dz);
      if (d > range || Math.abs(t.aim.y - origin.y) > 6) continue;
      let diff = Math.abs(Math.atan2(dx, dz) - facing) % (Math.PI * 2);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff > 1.05 && d > 5) continue;
      if (!this.clearLine(origin, t.aim)) continue;
      const score = d * (1 + diff * 1.4);
      if (score < bestScore) {
        bestScore = score;
        best = t;
      }
    }
    return best;
  }

  /** True if Jason can fire the grapple at an anchor standing at `to`: no wall or cliff in the way. */
  canGrapple(to: THREE.Vector3) {
    const p = this.player.body;
    const a = tmpL.set(p.x, p.y + 1.5, p.z);
    const b = new THREE.Vector3(to.x, to.y + 1.5, to.z);
    const steps = Math.ceil(a.distanceTo(b) / 0.8);
    for (let i = 1; i < steps; i++) {
      tmpV.copy(a).lerp(b, i / steps);
      if (pointBlocked(this.grid, NO_BOXES, tmpV.x, tmpV.y, tmpV.z)) return false;
    }
    return true;
  }

  private clearLine(a: THREE.Vector3, b: THREE.Vector3) {
    // Only walls and floors block aim; a target's own collider (cocoons, bosses) must not hide it.
    const steps = Math.ceil(a.distanceTo(b) / 0.8);
    for (let i = 1; i < steps; i++) {
      tmpV.copy(a).lerp(b, i / steps);
      if (pointBlocked(this.grid, NO_BOXES, tmpV.x, tmpV.y, tmpV.z)) return false;
    }
    return true;
  }

  /** Hits the first target overlapping a sphere. Returns what was hit, if anything. */
  hitAt(p: THREE.Vector3, r: number, dmg: number, kind: HitKind): Target | null {
    for (const t of this.targets) {
      if (!t.alive) continue;
      const rr = r + t.radius;
      if (t.aim.distanceToSquared(p) < rr * rr) {
        if (t.hit(dmg, kind, p)) return t;
      }
    }
    return null;
  }

  /** Live, aimable targets (enemies, bosses) within `r` of a point (and `dy` above or below it), nearest first (Jason's special weapons). */
  targetsNear(p: THREE.Vector3, r: number, dy = 4): Target[] {
    return this.targets
      .filter((t) => t.alive && t.aimable && t.aim.distanceToSquared(p) < r * r && Math.abs(t.aim.y - p.y) < dy)
      .sort((a, b) => a.aim.distanceToSquared(p) - b.aim.distanceToSquared(p));
  }

  /** Hits every target in a cylinder around `p`. Returns how many were hit. */
  private hitAll(p: THREE.Vector3, r: number, dmg: number, kind: HitKind, skip?: Set<unknown>): number {
    // Explosions (and LUX's pulse) reach a little higher than spins and pounds.
    const reachY = kind === 'pulse' ? 4 : kind === 'blast' ? 3 : 2.2;
    let n = 0;
    for (const t of [...this.targets]) {
      if (!t.alive || skip?.has(t)) continue;
      const dx = t.aim.x - p.x;
      const dz = t.aim.z - p.z;
      const dy = t.aim.y - p.y;
      if (dx * dx + dz * dz < (r + t.radius) ** 2 && Math.abs(dy) < reachY) {
        skip?.add(t);
        if (t.hit(dmg, kind, p)) n += 1;
      }
    }
    return n;
  }

  /** Jason's dash rams whatever is in front of him. Each target is hit once per dash. */
  dashAttack(player: Player, hitSet: Set<unknown>) {
    const b = player.body;
    const p = new THREE.Vector3(b.x + Math.sin(player.facing) * 0.5, b.y + 0.9, b.z + Math.cos(player.facing) * 0.5);
    if (!this.hitAll(p, PLAYER.dashHitRadius, PLAYER.dashDamage + (this.save.upgrades.blaster ?? 0), 'dash', hitSet)) return;
    this.impacts.slam(p.x, b.y, p.z, 2.2, '#7fe6ff');
    this.particles.emit(p.x, p.y, p.z, { count: 18, color: '#bff4ff', speed: 8, life: 0.4, size: 0.5 });
    this.flash(p.x, p.y, p.z, '#7fe6ff', 40, 0.2);
    this.shake(0.35);
    this.hitStop(0.05);
    audio.play('pound', 1.5);
    haptic('medium');
  }

  /**
   * General Brennus's shoulder charge and shield bash: a heavy `smash` just in front of him (each target
   * once per move). It knocks robots over and their shields away, and smashes crates and cracked walls.
   */
  smash(player: Player, r: number, dmg: number, hitSet: Set<unknown>) {
    const b = player.body;
    const p = new THREE.Vector3(b.x + Math.sin(player.facing) * 0.6, b.y + 0.9, b.z + Math.cos(player.facing) * 0.6);
    if (!this.hitAll(p, r, dmg, 'smash', hitSet)) return;
    this.impacts.slam(p.x, b.y, p.z, 2.4, '#ffb04a');
    this.particles.emit(p.x, p.y, p.z, { count: 18, color: '#ffd8a0', speed: 8, life: 0.4, size: 0.55 });
    this.shake(0.4);
    this.hitStop(0.06);
    audio.play('pound', 1.2);
    haptic('medium');
  }

  /** The stolen Legion robots still fighting in a room (all of them if `room` is left out). */
  goldRobots(room?: string): Enemy[] {
    return this.enemies.filter((e) => e.alive && (room === undefined || e.room === room) && isRobot(e.kind as EnemyKind));
  }

  /** A command post's "fight" order: every Legion robot in the room switches back to Brennus's side. */
  turnRobots(room?: string): number {
    const list = this.goldRobots(room);
    for (const e of list) {
      const root = e.model.root;
      this.addEntity(new AllyBot(this, root.position.x, root.position.y, root.position.z, root.rotation.y));
      e.remove();
      this.enemyDied(e);
    }
    return list.length;
  }

  get pulseReady() {
    return this.save.abilities.includes('pulse') && this.boltActive && this.pulseCd <= 0;
  }

  /** 0..1 while the force pulse recharges (1 = ready). */
  get pulseCharge() {
    return this.pulseCd > 0 ? 1 - this.pulseCd / PULSE.cooldown : 1;
  }

  /**
   * LUX's force pulse: a shockwave that hits, stuns and throws back everything around Jason, wipes out
   * enemy shots and overloads nearby lasers and zap floors for a few seconds. Then it recharges slowly.
   */
  forcePulse(): boolean {
    if (!this.pulseReady) return false;
    this.pulseCd = PULSE.cooldown;
    const b = this.player.body;
    const p = new THREE.Vector3(b.x, b.y + 0.9, b.z);
    this.hitAll(p, PULSE.radius, PULSE.damage + 2 * (this.save.upgrades.boltZap ?? 0), 'pulse');
    this.shots.clearNear(p, PULSE.radius + 1);
    let shorted = 0;
    for (const o of this.overloadables) if (o.overload(p, PULSE.overloadRadius, PULSE.overloadTime)) shorted += 1;
    this.bolt.flare();
    this.rings.burst(b.x, b.y, b.z, PULSE.radius * 2.2, '#9fefff', 0.6);
    this.rings.burst(b.x, b.y + 0.05, b.z, PULSE.radius * 1.2, '#ffffff', 0.35);
    this.impacts.slam(b.x, b.y, b.z, PULSE.radius * 0.9, '#7fe6ff');
    this.particles.emit(b.x, b.y + 1, b.z, { count: 60, color: '#bff4ff', speed: 14, life: 0.6, size: 0.5, gravity: 0, drag: 2 });
    this.flash(b.x, b.y + 2, b.z, '#9fefff', 90, 0.5);
    this.shake(0.7);
    this.hitStop(0.08);
    audio.play('pulse');
    haptic('heavy');
    if (shorted) this.hooks.toast('Lasers overloaded! Go, go, go!', 'bolt');
    return true;
  }

  spinAttack(player: Player, hitSet: Set<unknown>) {
    const b = player.body;
    tmpV.set(b.x, b.y + 0.9, b.z);
    // Atalanta's spinning kick: Iron Kick makes it hit harder and reach wider.
    const kick = player.hero === 'atalanta' ? atalantaStats(this.save.ataUpgrades) : null;
    this.hitAll(tmpV.clone(), kick?.kickRadius ?? PLAYER.spinRadius, 1 + (this.save.upgrades.blaster ?? 0) + (kick?.kickDamage ?? 0), 'spin', hitSet);
    // Sparks thrown off the rim of the spin swoosh.
    const a = Math.random() * Math.PI * 2;
    this.particles.emit(b.x + Math.cos(a) * 1.9, b.y + 0.85, b.z + Math.sin(a) * 1.9, { count: 2, color: '#bff4ff', speed: 3, life: 0.3, size: 0.3, gravity: 0 });
  }

  /** A ground pound (or the bronze mech's bigger SLAM, with its own `radius` and `dmg`). */
  groundPound(player: Player, radius = 2.8, dmg = 2 + (this.save.upgrades.blaster ?? 0)) {
    const b = player.body;
    const p = new THREE.Vector3(b.x, b.y + 0.3, b.z);
    this.hitAll(p, radius, dmg, 'pound');
    // Flash, two shockwaves, a scorched crater with glowing cracks, dust and sparks.
    this.impacts.slam(b.x, b.y, b.z, 4.4, '#7fe6ff');
    this.rings.burst(b.x, b.y, b.z, 6.5, '#bff4ff', 0.5);
    this.rings.burst(b.x, b.y + 0.05, b.z, 3.6, '#ffffff', 0.28);
    this.particles.emit(b.x, b.y + 0.25, b.z, { count: 34, color: '#8a95a8', speed: 9, life: 0.8, size: 0.8, up: 0.8, gravity: 2, drag: 3.5 });
    this.particles.emit(b.x, b.y + 0.3, b.z, { count: 26, color: '#bff4ff', speed: 11, life: 0.55, size: 0.3, up: 7, gravity: 22 });
    this.flash(b.x, b.y + 1.4, b.z, '#9fefff', 70, 0.35);
    this.hitStop(0.06);
    this.shake(0.6);
    audio.play('pound');
    haptic('heavy');
  }

  nearestEnemy(x: number, z: number, range: number): Target | null {
    let best: Target | null = null;
    let bd = range * range;
    for (const t of this.targets) {
      if (!t.alive || !t.aimable) continue;
      const d = (t.aim.x - x) ** 2 + (t.aim.z - z) ** 2;
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    return best;
  }

  dropBolts(pos: THREE.Vector3, n: number) {
    for (let i = 0; i < n; i++) this.boltField.add(pos.x, pos.y, pos.z, true);
  }

  dropHeart(pos: THREE.Vector3) {
    this.addEntity(HeartPickup.at(this, pos));
  }

  /** Drops a dash energy cell, but only once Jason has the Dash Thrusters and could use one. */
  dropEnergy(pos: THREE.Vector3) {
    if (!this.save.abilities.includes('dash') || this.player.energy >= this.player.energyMax) return;
    this.addEntity(EnergyPickup.at(this, pos));
  }

  enemyDied(e: Enemy) {
    this.dead.add(e.id);
    const i = this.enemies.indexOf(e);
    if (i >= 0) this.enemies.splice(i, 1);
    this.removeTarget(e);
    if (e.room && !this.flags.has(`cleared:${e.room}`) && !this.enemies.some((x) => x.alive && x.room === e.room)) {
      // Remember the room is cleared, so its doors stay open even when the enemies come back.
      this.flags.add(`cleared:${e.room}`);
      audio.play('success');
      this.hooks.toast('Area clear!', 'bolt');
    }
  }

  /** A sound out in the world: it fades with distance from Jason and is silent beyond `range`. */
  soundAt(name: Sfx, x: number, z: number, pitch = 1, range = 18) {
    const p = this.player.body;
    const d = Math.hypot(p.x - x, p.z - z);
    if (d >= range) return;
    audio.play(name, pitch, (1 - d / range) ** 1.5);
  }

  /** Jason stepped on a code pad: right pad lights up, wrong pad resets the whole code. */
  stepRune(r: Rune) {
    if (this.flags.has(r.group) || r.lit) return;
    const group = this.runes.filter((x) => x.group === r.group);
    const progress = group.filter((x) => x.lit).length;
    if (r.order === progress + 1) {
      r.setLit(true);
      audio.play(`tone${Math.min(3, progress)}` as 'tone0');
      this.particles.emit(r.spot.x, r.spot.y + 0.3, r.spot.z, { count: 14, color: '#ffffff', speed: 3, up: 2, life: 0.5, size: 0.4 });
      if (progress + 1 === group.length) {
        this.setFlag(r.group);
        audio.play('success');
        // Rune pads also spell the Gardeners' light-words that lock gates (the Garden of Colchis).
        if (r.group === 'vault') this.hooks.toast('Code accepted! The vault is open!', 'bolt');
        else this.hooks.toast('The light-word glows! The gate is opening!', 'bolt');
      }
    } else {
      for (const x of group) x.setLit(false);
      audio.play('fail');
      this.particles.emit(r.spot.x, r.spot.y + 0.4, r.spot.z, { count: 20, color: '#ff4f5e', speed: 5, life: 0.4, size: 0.4 });
      this.hooks.toast('Wrong order! The code reset. Try again!', 'bolt');
    }
  }

  /** Jason pounded a switch. A timed one starts its clock (see `tickClocks`); one on its own restarts it. */
  pressSwitch(s: FloorSwitch) {
    if (!s.together) {
      this.setFlag(s.flag);
      audio.play('success');
      if (s.timed) {
        this.clocks.set(s.flag, s.timed);
        this.hooks.toast(tr('Hurry! {n} seconds!', { n: s.timed }), 'bolt');
      }
      return;
    }
    const group = this.switches.filter((x) => x.flag === s.flag);
    const down = group.filter((x) => x.pressed).length;
    if (down === group.length) {
      this.clocks.delete(s.flag);
      this.setFlag(s.flag);
      audio.play('success');
      this.hooks.toast('All the switches are down! The vault is open!', 'bolt');
      return;
    }
    audio.play(`tone${Math.min(3, down - 1)}` as 'tone0');
    if (!this.clocks.has(s.flag) && s.timed) {
      this.clocks.set(s.flag, s.timed);
      this.hooks.toast(tr('Hurry! {n} seconds!', { n: s.timed }), 'bolt');
    }
  }

  /** Runs the switch clocks: a beep every second, and when one runs out its switches pop back up. */
  private tickClocks(dt: number) {
    for (const [flag, left] of this.clocks) {
      const now = left - dt;
      if (now > 0) {
        this.clocks.set(flag, now);
        if (Math.ceil(now) !== Math.ceil(left)) audio.play('blip', now <= 3 ? 2 : 1.5);
        continue;
      }
      this.clocks.delete(flag);
      const group = this.switches.filter((x) => x.flag === flag);
      for (const x of group) x.setDown(false);
      audio.play('fail');
      if (group[0]?.together) this.hooks.toast('Time’s up! The switches popped back up. Try again!', 'bolt');
      else this.clearFlag(flag);
    }
  }

  /** The most urgent running switch clock, for the HUD: seconds left, and how many of its switches are down. */
  countdown(): { left: number; down: number; total: number } | null {
    let best: { left: number; down: number; total: number } | null = null;
    for (const [flag, left] of this.clocks) {
      if (best && best.left <= left) continue;
      const group = this.switches.filter((x) => x.flag === flag);
      best = { left, down: group.filter((x) => x.pressed).length, total: group.length };
    }
    return best;
  }

  /** Jason opened a vault chest. */
  openPrize(p: Prize) {
    const s = this.save;
    (s.prizes ??= []).push(p.id);
    audio.play('upgrade');
    haptic('success');
    this.flash(p.spot.x, p.spot.y + 1, p.spot.z, '#ffd166', 50, 0.6);
    this.hooks.prize(p.reward);
  }

  /** Wakes enemies near a point: a pack calling for help, or a guard sounding the alarm. */
  alertNear(x: number, z: number, radius: number, kind: BadgeKind | null, alarm = false) {
    for (const e of this.enemies) {
      if (!e.alive || (kind && e.kind !== kind)) continue;
      if ((e.body.x - x) ** 2 + (e.body.z - z) ** 2 < radius * radius) e.alert(alarm);
    }
  }

  meetEnemy(kind: BadgeKind, elite: boolean) {
    const seen = (this.save.bestiary ??= []);
    for (const k of elite ? [kind, 'elite'] : [kind]) {
      if (seen.includes(k)) continue;
      seen.push(k);
      this.hooks.threat(k as BadgeKind | 'elite');
    }
  }

  /** Brings every enemy on the deck back (after Jason is knocked out). */
  private respawnEnemies() {
    for (const e of [...this.enemies]) if (this.levelEnemies.has(e.id) || e.id.startsWith('spawn')) e.remove();
    this.dead.clear();
    for (const pe of this.level.entities) if (pe.spec.type === 'enemy') this.spawnSpec(pe);
  }

  /** True if anything that can be hit overlaps this sphere (used by fireballs to know when to burst). */
  targetAt(p: THREE.Vector3, r: number): boolean {
    for (const t of this.targets) {
      if (!t.alive) continue;
      const rr = r + t.radius;
      if (t.aim.distanceToSquared(p) < rr * rr) return true;
    }
    return false;
  }

  /** The charged fireball bursts: everything close by takes the hit. */
  explode(p: THREE.Vector3, radius: number, dmg: number) {
    this.hitAll(p, radius, dmg, 'blast');
    this.impacts.slam(p.x, p.y - 0.8, p.z, radius * 1.6, '#ffb04a');
    this.rings.burst(p.x, p.y - 0.8, p.z, radius * 2.2, '#ffb04a', 0.45);
    this.particles.emit(p.x, p.y, p.z, { count: 44, color: '#ffb04a', speed: 10, life: 0.7, size: 0.9, up: 2 });
    this.particles.emit(p.x, p.y, p.z, { count: 20, color: '#fff2c0', speed: 5, life: 0.4, size: 0.6 });
    this.flash(p.x, p.y + 0.5, p.z, '#ff9a3d', 80, 0.35);
    this.shake(0.5);
    this.hitStop(0.05);
    audio.play('explode');
    haptic('heavy');
  }

  shake(a: number) {
    this.shakeAmt = Math.max(this.shakeAmt, a);
  }

  /* ---------------- checkpoints & bosses ---------------- */

  activateCheckpoint(cp: Checkpoint) {
    for (const c of this.checkpoints) c.setActive(c === cp);
    this.activeCheckpoint = cp;
    audio.play('checkpoint');
    this.player.heal(99);
    this.player.gainEnergy(99);
    this.player.rechargeArmor();
    // The bronze mech is mended too (the only place it is), even if it is waiting parked somewhere.
    this.player.mech?.refill();
    this.hooks.toast('Checkpoint saved!', 'bolt');
    this.hooks.checkpoint();
  }

  resumeState(): ResumeState {
    return {
      checkpoint: this.activeCheckpoint?.id ?? null,
      flags: [...this.flags],
      taken: [...this.taken],
      dead: [...this.dead],
    };
  }

  playerDown() {
    this.hooks.down();
  }

  respawn() {
    if (this.vehicle) {
      this.shots.clear();
      this.vehicle.respawn();
      return;
    }
    const cp = this.activeCheckpoint;
    const sp = this.level.spawn;
    const x = cp ? cp.spot.x : Grid.center(sp.cx);
    const y = cp ? cp.spot.y : sp.h;
    const z = cp ? cp.spot.z + 1.2 : Grid.center(sp.cz);
    // Once the bronze mech has joined, everyone starts again aboard it (it can never be lost somewhere out of reach).
    this.player.backAboard();
    this.player.teleport(x, y, z);
    this.player.revive();
    this.pulseCd = 0;
    this.shots.clear();
    this.player.bren?.cannon.clear();
    this.respawnEnemies();
    // Robots that changed sides go back to Aeëtes's paint with the rest of their squad.
    const lw = legionWorld(this);
    for (const a of lw.allies) a.remove();
    lw.allies.length = 0;
    // A line Brennus was holding starts again when he gets back to it.
    resetHolds(this);
    // General Brennus's own squad (on the Golden Fleece) is always his: it lines up again at its posts.
    const bren = this.def.joins?.brennus;
    if (bren && this.flags.has(bren)) this.squadArrives();
    this.placeDroids(x, y, z);
    if (this.boss?.started && !this.boss.defeated) {
      this.boss.reset();
      this.boss.started = false;
      this.hooks.bossBar(null, 0);
      this.hooks.music(this.def.music);
      // A mini-boss waits for Jason to come back; the deck's own boss is the one to point at again.
      if (this.mainBoss && this.boss !== this.mainBoss) this.boss = this.mainBoss;
    }
    if (this.player.carrying) {
      // Keep the power cell: it follows Jason back to the checkpoint.
    }
    this.camTarget.set(x, y + 1.2, z);
  }

  /** The boss's entrance: a full cinematic the first time, straight into the fight on a retry. */
  bossIntro(b: Boss): Promise<void> {
    if (b.introSeen) return Promise.resolve();
    this.hooks.music(b.music);
    return this.hooks.cutscene((d) => scenes.bossIntro(d, this, b));
  }

  bossStarted(b: Boss) {
    this.boss = b;
    this.hooks.bossBar(b.title, b.hp / b.maxHp);
    this.hooks.music(b.music);
  }

  bossDefeated(b: Boss) {
    if (b.kind === 'rogue') {
      this.luxBack(b);
      return;
    }
    if (this.def.id === 'bridge' && b.kind === 'heart' && !this.flags.has('reborn')) {
      // It isn't over: GaScu pulls every vine on the ship into the Heart and rises again.
      this.flags.add('reborn');
      this.hooks.bossBar(null, 0);
      this.hooks.checkpoint();
      void this.hooks.cutscene((d) => scenes.rebirth(d, this, b)).then(() => this.boss?.engage());
      return;
    }
    this.flags.add('boss');
    this.hooks.bossBar(null, 0);
    this.hooks.checkpoint();
    const last = isFinale(this.def.id);
    if (!last) this.hooks.music(this.def.music);
    const ch = chapterOf(this.def.id);
    if (last && ch === 3) {
      // The game's finale: with every light-stone, LUX and IRIS wake the Fleece's seeds (the secret ending).
      this.hooks.music('ending');
      const words = knowsGardenerWords(this.save);
      void this.hooks
        .cutscene((d) => fleeceScenes.fleeceWon(d, this, b as GoldenKing, words))
        .then(() => this.hooks.ending(words ? 'gardeners' : 'fleece'));
      return;
    }
    void this.hooks.cutscene((d) => scenes.bossOutro(d, this, b)).then(() => {
      if (last) this.hooks.ending(ch === 1 ? 'saved' : 'freed');
    });
  }

  /**
   * General Brennus's squad: when he joins the Argonauts (on the Golden Fleece) his own Legion robots
   * march in with him and stand guard at the `squad1`..`squad3` markers, fighting for him.
   */
  squadArrives() {
    for (const id of ['squad1', 'squad2', 'squad3']) {
      const at = this.markers.get(id);
      if (at) this.addEntity(new AllyBot(this, at.x, at.y, at.z, Math.PI));
    }
  }

  /** The secret ending of a chapter: LUX talks GaScu round (chapter 1), or Jason talks Brennus down (chapter 2). */
  communed() {
    this.flags.add('boss');
    this.hooks.music('ending');
    if (chapterOf(this.def.id) === 1) void this.hooks.cutscene((d) => scenes.befriend(d, this)).then(() => this.hooks.ending('friends'));
    else void this.hooks.cutscene((d) => scenes.talkDown(d, this)).then(() => this.hooks.ending('redeemed'));
  }

  /** Replaces the current boss with a new one at the same spot (GaScu's rebirth). */
  spawnBoss(kind: BossKind, old: Boss): Boss {
    const cx = Math.floor(old.center.x / CELL);
    const cz = Math.floor(old.center.z / CELL);
    old.remove();
    const b = this.addEntity(makeBoss(this, `${this.def.id}.${kind}`, kind, cx, cz, old.center.y));
    b.introSeen = true;
    this.boss = b;
    return b;
  }

  /** Jason steps onto the lift and rides it up out of the deck. */
  rideLift(exit: Exit) {
    void this.hooks.cutscene((d) => scenes.liftRide(d, this, exit)).then(() => this.hooks.complete());
  }

  /** Plays one of the deck's storybook scenes (illustrated panels with lines). */
  playStory(key: string) {
    if (!this.def.stories?.[key]?.length) return;
    void this.hooks.cutscene((d) => scenes.storyTime(d, this, key));
  }

  /** Jason finds a droid switched off in the dark (LUX on the ship, IRIS in the jungle) and wakes it up. */
  findBolt(find: BoltFind) {
    void this.hooks.cutscene((d) => (find.who === 'iris' ? scenes.irisFound(d, this, find) : scenes.boltFound(d, this, find)));
  }

  /** A hologram projector plays one of the Captain's (or Aunt Rosa's) recorded messages. */
  playLog(holo: Holo) {
    void this.hooks.cutscene((d) => scenes.holoLog(d, this, holo));
  }

  /* ---------------- per frame ---------------- */

  update(dt: number, input: Input, camSpeed: number) {
    if (this.freezeT > 0) {
      this.freezeT -= dt;
      dt *= 0.05;
    }
    this.time += dt;
    if (this.vehicle) {
      this.updateVehicle(this.vehicle, dt, input);
      return;
    }
    for (const m of this.movers) m.update(dt);
    this.player.update(dt, input);
    if (!this.boltActive && !this.lamp.on) this.torch.dim(dt);
    this.lux.update(dt);
    this.iris.update(dt);
    this.lamp.update(dt);
    // A boss chilled by the Frost Ray acts a little slower for a moment.
    for (const e of [...this.entities]) if (e.alive) e.update(e === this.boss ? dt * this.boss.tempo(dt) : dt);
    this.tickClocks(dt);
    this.boltField.update(dt);
    this.shots.update(dt);
    this.beams.update(dt);
    this.rings.update(dt);
    this.impacts.update(dt);
    this.particles.update(dt);
    this.built.update(dt, this.time);
    if (this.flashLight) {
      this.flashT = Math.max(0, this.flashT - dt);
      const k = this.flashT / this.flashMax;
      this.flashLight.intensity = this.flashPower * k * k;
    }

    // LUX's force pulse has its own button (the action key also fires it when there's nothing to use).
    if (this.pulseCd > 0) {
      this.pulseCd -= dt;
      if (this.pulseCd <= 0 && this.save.abilities.includes('pulse')) audio.play('charged', 0.8);
    }
    this.focus = this.cutscene ? null : this.findFocus();
    if (!this.cutscene && !this.player.down) {
      if (input.take('action')) {
        if (this.focus) this.focus.interact();
        else this.forcePulse();
      }
      if (input.take('pulse')) this.forcePulse();
    }

    // Lights dim in dark rooms; LUX's flashlight takes over.
    const cell = this.grid.cell(this.player.cellX, this.player.cellZ);
    this.darkness = damp(this.darkness, cell.dark ? 1 : 0, 3, dt);
    this.hemi.intensity = this.theme.hemi * (1 - 0.86 * this.darkness);
    this.scene.environmentIntensity = ENV_LIGHT * (1 - 0.9 * this.darkness);
    this.sun.intensity = this.theme.sunI * (1 - 0.92 * this.darkness);
    this.fog.color.copy(this.fogColor).multiplyScalar(1 - 0.7 * this.darkness);

    this.hintT -= dt;
    if (this.hintT <= 0 && !this.cutscene) {
      this.hintT = 0.5;
      this.checkHints();
    }

    this.objT -= dt;
    if (this.objT <= 0) {
      this.objT = 0.3;
      // While the bronze mech waits, parked, the way on needs it: the marker points back to it.
      const parked = this.flags.has('boss') ? null : this.player.mechParked;
      const obj = parked ? MECH_OBJECTIVE : this.def.objectives.find((o) => !this.cond(o.until));
      const text = obj?.text ?? '';
      if (text !== this.lastObjective) {
        this.lastObjective = text;
        this.hooks.objective(text);
      }
      this.waypoint = parked ? parked.clone() : obj?.at ? this.place(obj.at) : null;
    }

    const drag = input.consumeCamDrag();
    if (!this.cutscene) this.cameraYaw -= drag * 0.0068 * camSpeed;
    this.placeCamera(dt);
    const p = this.player.body;
    this.ambience.update(dt, this.time, p.x, p.y, p.z);
  }

  /** A frame of a vehicle level: the vehicle flies (or drives), the shared effects and objectives keep running. */
  private updateVehicle(v: Vehicle, dt: number, input: Input) {
    v.update(dt, input, this.cutscene);
    for (const e of [...this.entities]) if (e.alive) e.update(dt);
    this.beams.update(dt);
    this.rings.update(dt);
    this.impacts.update(dt);
    this.particles.update(dt);
    if (this.flashLight) {
      this.flashT = Math.max(0, this.flashT - dt);
      const k = this.flashT / this.flashMax;
      this.flashLight.intensity = this.flashPower * k * k;
    }
    this.focus = null;
    this.objT -= dt;
    if (this.objT <= 0) {
      this.objT = 0.3;
      const obj = this.def.objectives.find((o) => !this.cond(o.until));
      const text = obj?.text ?? '';
      if (text !== this.lastObjective) {
        this.lastObjective = text;
        this.hooks.objective(text);
      }
      this.waypoint = null;
    }
    input.consumeCamDrag();
    this.placeCamera(dt);
  }

  /** LUX explains each kind of collectible the first time Jason gets close to one. */
  private checkHints() {
    const seen = (this.save.hints ??= []);
    const p = this.player.body;
    const near = (x: number, z: number, r = 7) => (x - p.x) ** 2 + (z - p.z) ** 2 < r * r;
    const tell = (key: string) => {
      if (seen.includes(key)) return false;
      seen.push(key);
      this.hooks.toast(HINTS[key], 'bolt');
      return true;
    };
    if (this.bolt.active === false && !seen.includes('bolt')) {
      // Before LUX joins, the first hint is about bolts (Jason spots them on his own).
    }
    for (const e of this.entities) {
      if (!e.alive) continue;
      const ch = chapterOf(this.def.id);
      const rescue = rescueKind(ch);
      const find = findKind(ch);
      const kind =
        e instanceof Cocoon || e instanceof SupplyNet
          ? rescue === 'colonist'
            ? 'cocoon'
            : rescue
          : e instanceof Shard
            ? find
            : e instanceof Canister
              ? 'canister'
              : e instanceof Prize
                ? 'prize'
                : e instanceof Rune
                  ? 'rune'
                  : e instanceof Vendor
                    ? 'vendor'
                    : e instanceof Anchor
                      ? 'anchor'
                      : null;
      if (!kind || seen.includes(kind)) continue;
      const at = (e as unknown as { spot?: THREE.Vector3; aim?: THREE.Vector3 }).spot ?? (e as unknown as { aim?: THREE.Vector3 }).aim ?? e.obj.position;
      if (near(at.x, at.z) && tell(kind)) return;
    }
    if (!seen.includes('bolt') && this.save.bolts > 0) tell('bolt');
  }

  /** Resolves an objective's `at`: a marker placed in the map, or 'boss' / 'exit'. */
  private place(at: string): THREE.Vector3 | null {
    if (at === 'boss') return this.boss && !this.boss.defeated ? this.boss.where : null;
    if (at === 'exit') return this.exit?.spot ?? null;
    return this.markers.get(at) ?? null;
  }

  private findFocus(): Interactable | null {
    const p = this.player.body;
    let best: Interactable | null = null;
    let spare: Interactable | null = null;
    let bd = Infinity;
    for (const it of this.interactables) {
      if (!it.alive) continue;
      if (it.fallback) {
        if (!spare && it.label()) spare = it;
        continue;
      }
      const d = Math.hypot(it.spot.x - p.x, it.spot.z - p.z);
      if (d > it.range || Math.abs(it.spot.y - p.y) > (it.reachY ?? 3)) continue;
      let score = d;
      if (it.aimed) {
        // Grapple anchors: prefer the one Jason is facing (and anything close by over any anchor).
        let diff = Math.abs(Math.atan2(it.spot.x - p.x, it.spot.z - p.z) - this.player.facing) % (Math.PI * 2);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        score = 3 + d * (1 + diff * 1.6);
      }
      if (score >= bd) continue;
      if (!it.label()) continue;
      bd = score;
      best = it;
    }
    return best ?? spare;
  }

  private placeCamera(dt: number) {
    if (this.vehicle) {
      this.vehicle.cameraPose(this.follow, dt);
      this.follow.fov += this.baseFov - 50;
      this.aimCamera(dt, this.vehicle.pos);
      return;
    }
    const p = this.player.body;
    // The bronze mech is twice Jason's height: the camera looks at its chest, from a little farther back.
    const big = this.player.hero === 'mech';
    const aim = tmpV.set(p.x + p.vx * 0.12, p.y + (big ? 2 : 1.2), p.z + p.vz * 0.12);
    // A boss that keeps its distance (MEDUSA) pulls the view toward itself, so both stay on screen.
    const frame = this.boss?.started && !this.boss.defeated ? this.boss.frame : null;
    if (frame) aim.lerp(frame, 0.4);
    // A boss that asks for it (the big final one) pulls the camera part of the way toward itself.
    const bs = this.boss;
    if (bs?.started && !bs.defeated && bs.camPull > 0) {
      const w = bs.where;
      const k = bs.camPull * Math.min(1, 26 / Math.max(1, Math.hypot(w.x - p.x, w.z - p.z)));
      aim.x += (w.x - aim.x) * k;
      aim.z += (w.z - aim.z) * k;
    }
    if (dt === 0) this.camTarget.copy(aim);
    else {
      this.camTarget.x = damp(this.camTarget.x, aim.x, 7, dt);
      this.camTarget.y = damp(this.camTarget.y, aim.y, 4, dt);
      this.camTarget.z = damp(this.camTarget.z, aim.z, 7, dt);
    }
    const dist = frame ? 22 : (this.boss?.started && !this.boss.defeated ? 17 : 13) + (big ? 3 : 0);
    // Walls never turn see-through: when one would hide Jason, the camera tips up until it can see all
    // of him (or at least his head and shoulders when he is pressed right against a wall).
    let want = -1;
    for (const eye of [0.15, 1.0]) {
      for (let a = frame ? FRAME_PITCH : PITCH; a <= PITCH_MAX + 0.001 && want < 0; a += 0.05) if (!this.viewBlocked(a, dist, eye)) want = a;
      if (want >= 0) break;
    }
    if (want < 0) want = PITCH_MAX;
    this.pitch = dt === 0 ? want : damp(this.pitch, want, want > this.pitch ? 7 : 1.6, dt);
    this.followPose(this.follow, dist);
    const ground = p.grounded ? p.y : Math.min(this.groundY, p.y);
    this.groundY = dt === 0 ? ground : damp(this.groundY, ground, 5, dt);
    this.aimCamera(dt, tmpV.set(p.x, this.groundY, p.z));
  }

  /** Puts the camera on the follow pose (or a cutscene rig, or between the two), shakes it, and moves the shadows to `focus`. */
  private aimCamera(dt: number, focus: THREE.Vector3) {
    // Cutscenes steer the camera through a rig; afterwards it eases back to following Jason.
    const c = this.camera.position;
    const look = tmpL;
    let fov = this.follow.fov;
    if (this.camRig) {
      c.copy(this.camRig.pos);
      look.copy(this.camRig.look);
      fov = this.camRig.fov;
    } else if (this.blendT > 0 && this.blendFrom) {
      this.blendT = Math.max(0, this.blendT - dt);
      const k = 1 - this.blendT / this.blendMax;
      const e = k * k * (3 - 2 * k);
      c.lerpVectors(this.blendFrom.pos, this.follow.pos, e);
      look.lerpVectors(this.blendFrom.look, this.follow.look, e);
      fov = this.blendFrom.fov + (this.follow.fov - this.blendFrom.fov) * e;
    } else {
      c.copy(this.follow.pos);
      look.copy(this.follow.look);
    }
    if (this.camera.fov !== fov) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    if (this.shakeAmt > 0) {
      c.x += (Math.random() - 0.5) * this.shakeAmt;
      c.y += (Math.random() - 0.5) * this.shakeAmt;
      c.z += (Math.random() - 0.5) * this.shakeAmt;
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.5);
    }
    this.camera.lookAt(look);
    this.cameraLook.copy(look);
    // Shadows follow whatever the camera is looking at.
    if (this.camRig || this.blendT > 0) this.placeSun(look.x, look.y - 1.2, look.z);
    else this.placeSun(focus.x, focus.y, focus.z);
  }

  /** Puts the follow camera straight on Jason, with no easing (after a teleport). */
  snapCamera() {
    const p = this.player.body;
    this.camTarget.set(p.x, p.y + 1.2, p.z);
    this.groundY = p.y;
    this.placeCamera(0);
  }

  /** Where the follow camera would be right now, at the given distance from Jason. */
  followPose(out: Rig, dist = 13): Rig {
    const cp = Math.cos(this.pitch);
    out.look.copy(this.camTarget);
    out.pos.set(
      this.camTarget.x + Math.sin(this.cameraYaw) * cp * dist,
      this.camTarget.y + Math.sin(this.pitch) * dist,
      this.camTarget.z + Math.cos(this.cameraYaw) * cp * dist,
    );
    out.fov = this.baseFov;
    return out;
  }

  /** Hands the camera to a cutscene rig (null gives it back, easing over `blend` seconds). */
  setCameraRig(rig: Rig | null, blend = 0.8) {
    if (!rig && this.camRig) {
      this.blendFrom = { pos: this.camRig.pos.clone(), look: this.camRig.look.clone(), fov: this.camRig.fov };
      this.blendT = blend;
      this.blendMax = Math.max(0.001, blend);
    }
    this.camRig = rig;
  }

  /** True if a wall or raised floor sits between a point on Jason (`eye` above his feet) and a camera at this tilt. */
  private viewBlocked(pitch: number, dist: number, eye: number): boolean {
    const p = this.player.body;
    const cp = Math.cos(pitch);
    const sx = p.x;
    const sy = p.y + eye;
    const sz = p.z;
    const ex = this.camTarget.x + Math.sin(this.cameraYaw) * cp * dist;
    const ey = this.camTarget.y + Math.sin(pitch) * dist;
    const ez = this.camTarget.z + Math.cos(this.cameraYaw) * cp * dist;
    const len = Math.hypot(ex - sx, ey - sy, ez - sz);
    const steps = Math.ceil(len / 0.3);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const y = sy + (ey - sy) * t;
      // Past the tallest wall on any deck the ray is in the clear.
      if (y > p.y + 9) return false;
      const c = this.grid.cell(Grid.toCell(sx + (ex - sx) * t), Grid.toCell(sz + (ez - sz) * t));
      // A little headroom above every wall so Jason is shown clearly, not just peeking over the edge.
      if (c.kind !== 'void' && c.kind !== 'hazard' && y < c.h + 0.35) return true;
    }
    return false;
  }

  /** Centres the shadow map on Jason, snapped to whole shadow texels so shadow edges never crawl. */
  private placeSun(x: number, y: number, z: number) {
    const t = tmpV.set(x, y, z).applyMatrix4(LIGHT_INV);
    if (this.shadowTexel > 0) {
      t.x = Math.round(t.x / this.shadowTexel) * this.shadowTexel;
      t.y = Math.round(t.y / this.shadowTexel) * this.shadowTexel;
    }
    t.applyMatrix4(LIGHT_ROT);
    this.sun.target.position.copy(t);
    this.sun.position.copy(t).addScaledVector(LIGHT_DIR, 34);
  }

  resize(w: number, h: number) {
    this.camera.aspect = w / h;
    this.baseFov = w / h < 1.2 ? 62 : 50;
    this.camera.fov = this.camRig ? this.camRig.fov : this.baseFov;
    this.camera.updateProjectionMatrix();
    this.particles.setViewportHeight(h);
    this.ambience.setViewportHeight(h);
  }
}
