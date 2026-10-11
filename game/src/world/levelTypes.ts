import type { Track } from '../core/music';
import type { PuzzleKind } from '../game/puzzles';
import type { PanelId } from '../ui/panels/ids';
import type { FlightCourse } from '../vehicles/course';
import type { DiveCourse } from '../vehicles/sub/dive';

/**
 * Chapter 1 is the six decks of the colony ship; chapter 2 is six regions of the planet Gaia Nova;
 * chapter 3, The Argonauts, is the voyage of the Argo to the moon Colchis (its levels are being built
 * one by one: see `CHAPTER_PLAN` in levels/index.ts).
 */
export type DeckId = 'cryo' | 'hydro' | 'engine' | 'habitat' | 'security' | 'bridge' | 'plains' | 'desert' | 'snow' | 'rockies' | 'jungle' | 'volcano' | 'rocks' | 'harpies' | 'mine' | 'reef' | 'sirens' | 'forge' | 'labyrinth' | 'stand' | 'garden' | 'fleece';
/**
 * A level that is driven instead of walked: the vehicle replaces Jason on foot (see game/src/vehicles).
 * The Argo flies (The Clashing Rocks) and the submarine dives (the Sirens' Sea). (The mech suit of
 * Talos's Forge walks the level's own map instead: it is the `mech` hero, see `heroes/mech.ts`.)
 */
export type VehicleKind = 'argo' | 'sub' | 'mech';
export type ThemeId = DeckId;
export type TileKind = 'void' | 'floor' | 'wall' | 'hazard' | 'ice' | 'grate';
/** `mirror` is the Gardeners' Mirror Shield, found in Medusa's Labyrinth (chapter 3): Jason holds SPIN to raise it and bounce gaze beams. */
export type Ability = 'doubleJump' | 'dash' | 'glide' | 'pulse' | 'grapple' | 'mirror';
/**
 * The playable heroes (see `entities/heroes/heroes.ts` for what each one can do). Jason is the
 * default; chapter 3 adds Atalanta, and General Brennus plays his own levels (3 and 8). `mech` is the
 * Gardeners' bronze mech suit in Talos's Forge: Jason pilots it, with Atalanta riding on its shoulder.
 */
export type HeroId = 'jason' | 'atalanta' | 'brennus' | 'mech';
/**
 * Trooper, minebot, bulwark and mortar are General Brennus's robots (Aeëtes bought the old ones for
 * scrap in chapter 3); the harpy is one of Aeëtes's gold thief drones that snatch bolts, the anvil
 * drone drops heavy anvils from above (Talos's Forge), the coil is one of MEDUSA's cable snakes
 * in her labyrinth, the weeder is his saboteur drone in the Garden of Colchis (it sprays gold
 * weed-killer), and the ring guard is one of his gold butler robots that throws its ring like a
 * boomerang (the Golden Fleece).
 */
export type EnemyKind = 'sporeling' | 'snapper' | 'buzzer' | 'sentry' | 'turret' | 'brute' | 'trooper' | 'minebot' | 'bulwark' | 'mortar' | 'harpy' | 'crab' | 'jelly' | 'anvil' | 'coil' | 'ramling' | 'weeder' | 'ringguard';
export type BossKind = 'warden' | 'queen' | 'golem' | 'bloblin' | 'wardog' | 'heart' | 'reborn' | 'thresher' | 'driller' | 'boreas' | 'stheno' | 'hydra' | 'colossus' | 'rogue' | 'aello' | 'excavator' | 'scylla' | 'organ' | 'talos' | 'medusa' | 'ram' | 'dragon' | 'goldenking';

/** Conditions that open doors or arm triggers. */
export type Cond = { flag: string } | { clear: string } | { boss: true } | { all: Cond[] };

interface Base {
  /** Floor height (in world units) under this entity. Defaults to the neighbours' height. */
  h?: number;
  /** Tile kind under this entity (defaults to floor, or void for moving platforms). */
  floor?: TileKind;
}

export type Spec = Base &
  (
    | { type: 'spawn'; facing?: number }
    | { type: 'bolt' }
    | { type: 'crate'; loot?: 'bolts' | 'heart' | 'big'; metal?: boolean }
    | { type: 'heart' }
    /** A dash energy cell that grows back a few seconds after Jason takes it (placed before dash jumps). */
    | { type: 'energy' }
    /** An invisible spot an objective can point the waypoint at (`at` in the objective). */
    | { type: 'marker'; id: string }
    | { type: 'canister'; id: string }
    | { type: 'shard'; id: string }
    | { type: 'upgrade'; ability: Ability; id: string }
    | { type: 'checkpoint'; id: string }
    | { type: 'enemy'; enemy: EnemyKind; room?: string; variant?: string }
    | { type: 'boss'; boss: BossKind; room: string }
    | { type: 'door'; id: string; open: Cond; color?: string }
    /** A floor pad in a code puzzle: step on every pad of the group in order to set the group's flag. */
    | { type: 'rune'; group: string; order: number; color: string }
    /** A vault chest with a reward: an upgrade level (or bolts, if that upgrade is maxed). */
    | { type: 'prize'; id: string; reward: 'blaster' | 'rapid' | 'clip' | 'boltZap' | 'magnet' | 'heart' | 'bolts' }
    /**
     * A red floor switch: a ground pound presses it and sets `flag`. A `timed` switch pops back up after
     * that many seconds. `together` switches share their flag and one clock: the first press starts
     * `timed` seconds, the flag is set once they are all down, and from then on they stay down.
     */
    | { type: 'switch'; flag: string; timed?: number; together?: boolean; seal?: HeroId }
    /** A LUX HACK terminal: solving its puzzle (the memory lights unless `puzzle` says otherwise) sets `flag`. */
    | { type: 'terminal'; flag: string; length?: number; label?: string; puzzle?: PuzzleKind }
    | { type: 'cell' }
    | { type: 'socket'; flag: string }
    | {
        type: 'platform';
        /** Waypoints relative to the start, in cells: [dx, dz, dy]. */
        path: [number, number, number?][];
        speed?: number;
        wait?: number;
        size?: number;
        needs?: Cond;
        /** Dressed as a mine's ore cart on rails, or one of Brennus's hauler robots (default: the deck's own platform). */
        look?: 'cart' | 'hauler';
      }
    | { type: 'faller' }
    | { type: 'bounce' }
    | { type: 'vent'; period?: number; offset?: number }
    /** `hardened` emitters guard puzzles, so LUX's force pulse can't short them out. */
    | { type: 'laser'; axis: 'x' | 'z'; length: number; period?: number; offset?: number; always?: boolean; off?: Cond; low?: boolean; hardened?: boolean }
    | { type: 'zap'; period?: number; offset?: number }
    | { type: 'conveyor'; dx: number; dz: number; speed?: number }
    | { type: 'cocoon'; id: string; name: string; line: string }
    | { type: 'vendor' }
    | { type: 'sign'; text: string }
    | { type: 'trigger'; id: string; dialogue?: string; event?: string; w?: number; d?: number; when?: Cond }
    | { type: 'dark' }
    | { type: 'exit' }
    | { type: 'breakwall' }
    /** A wall of thorny brambles filling the cell: only fire (the Flamethrower, a charged fireball, a cannon blast) burns it away. */
    | { type: 'bramble' }
    /** A droid switched off in a dark corner, waiting for Jason to wake it: LUX (default) or IRIS. */
    | { type: 'boltfind'; who?: 'lux' | 'iris' }
    /** A hologram projector that plays a recorded message (a dialogue key) the first time Jason walks past. */
    | { type: 'holo'; log: string; who?: HoloSpeaker }
    /** A glowing grapple ring: with the GRAPPLE hook, Jason can zip to it from far away (and land on the cell it sits on). */
    | { type: 'anchor' }
    /** A gust zone `w` x `d` cells around the letter that shoves Jason along (dx, dz) every `period` seconds. */
    | { type: 'wind'; dx: number; dz: number; w?: number; d?: number; period?: number; offset?: number; strength?: number }
    /** Quicksand (or deep snow, or bog): Jason wades slowly and sinks if he stands still too long. */
    | { type: 'quicksand' }
    /** A lane that a boulder (or log, or snowball) rolls down every `period` seconds: jump over it. */
    | { type: 'boulder'; axis: 'x' | 'z'; length: number; period?: number; offset?: number }
    /**
     * A bullseye on a post: only an arrow from Atalanta's bow (a charged power arrow) sets `flag`. With `seal`
     * (also on `switch` and `cracked`), it is a vault seal made obvious: a beam in that hero's colour, and the
     * action button does the move once the right hero is close (see `entities/ch3/seals.ts`).
     */
    | { type: 'target'; flag: string; seal?: HeroId }
    /** A wall cell with a glowing running stripe: Atalanta can wall-run along its faces. The cell is a wall. */
    | { type: 'wallrun' }
    /**
     * A cliff face Atalanta can CLIMB: put it on the high cell (with its `h`). Every face that drops to a lower
     * neighbour gets handholds; she climbs up hand over hand and pulls herself onto the top, then helps the
     * others up after her.
     */
    | { type: 'climb' }
    /** A wall with a low crawl hole: only Atalanta's slide fits under it. `axis` is the way through (guessed from the walls beside it). */
    | { type: 'lowgap'; axis?: 'x' | 'z' }
    /* General Brennus's puzzles (his own levels). */
    /** A cracked rock wall veined with gold: only a charged CANNON blast or Brennus's CHARGE smashes it. The cell under it is floor. */
    | { type: 'cracked'; seal?: HeroId }
    /**
     * A Legion command post: Brennus walks up and gives the order with the action button (COMMAND), which
     * sets `flag`. `order` says what his robots do: walk onto a heavy plate (`plate`), carry him over a
     * gap (`carry`: a hauler platform with `needs: { flag }`), or switch sides and fight for him
     * (`fight`: the gold robots of `room`).
     */
    | { type: 'post'; flag: string; order: 'plate' | 'carry' | 'fight' | 'guns'; room?: string }
    /**
     * Brennus's Last Stand: an old Legion dock gun, asleep until a command post (`order: 'guns'`) sets
     * `flag`; then it fights for Brennus, shooting at Aeëtes's machines in range.
     */
    | { type: 'dockgun'; flag: string }
    /**
     * Brennus's Last Stand: a line to hold (the cell is its middle). Once `start` is true and Brennus
     * is within `w` x `d` cells of it, Aeëtes's dropships bring the `drops` one by one while the Argo
     * flies in, from `argo[0]` to `argo[1]` of its way (faster while the bridge is clear of enemies).
     * When the Argo gets there, the rest flee and `flag` is set. The dropped robots belong to `room`.
     */
    /** Brennus's Last Stand: the Gardeners' great stone arch (the Sky Gate), `span` units between its pillars. */
    | { type: 'arch'; span?: number }
    | { type: 'hold'; start: Cond; flag: string; argo: [number, number]; time: number; w: number; d: number; room: string; drops: { enemy: EnemyKind; n: number; variant?: string }[] }
    /** One of Brennus's old Legion robots, painted gold by Aeëtes and standing idle: on the post's `flag` it marches to the nearest heavy plate. */
    | { type: 'legionbot'; flag: string }
    /** A heavy plate: sets `flag` while something heavy (Brennus, or a robot for good) stands on it. */
    | { type: 'plate'; flag: string }
    /* Scylla's Reef. */
    /** A raft of driftwood on the tidal flats: it rests on the sand at low tide and floats up with the sea (see `LevelDef.tide`). */
    | { type: 'raft' }
    /* Talos's Forge (the bronze mech suit). */
    /** A bronze gate (the cell under it is floor): only the mech's PUNCH, or a big blast from its cannon, breaks it open. */
    | { type: 'bronzegate' }
    /**
     * A cracked forge floor over a cellar: the cell itself is the cellar floor (at `h`), and a cracked
     * plate covers it at `lid` (world units). The mech's SLAM, or any heavy landing on it, smashes the
     * plate and the mech drops into the cellar.
     */
    | { type: 'brittle'; lid: number }
    /* Medusa's Labyrinth (chapter 3): gaze beams, mirrors and light crystals. */
    /**
     * One of MEDUSA's eye-sentries: a stone eye that shines a green gaze beam along `dir` (0 north,
     * 1 east, 2 south, 3 west). A hero it touches turns to stone for a moment (no damage). `sweep`
     * swings the beam that many degrees to either side and back every `period` seconds. Its own gaze
     * bounced back into its eye dazzles it shut for a few seconds. `reach` cuts the beam short (in cells).
     */
    | { type: 'gazer'; dir: 0 | 1 | 2 | 3; sweep?: number; period?: number; offset?: number; reach?: number }
    /** A Gardener mirror on a stand: it turns a beam a quarter turn. Any shot, arrow or spin rotates it (`turn` 0 is "/", 1 is "\"). The cell is solid. */
    | { type: 'mirror'; turn?: 0 | 1 }
    /**
     * A light crystal on a pedestal: a gaze beam lights it (bounced off mirrors, or off Jason's Mirror
     * Shield) and sets `flag` for good. `shield` says the beam can only get there off the Mirror Shield.
     */
    | { type: 'crystal'; flag: string; shield?: boolean }
    | { type: 'decor'; kind: DecorKind; rot?: number; scale?: number; solid?: boolean }
  );

export type DecorKind =
  | 'pod'
  | 'console'
  | 'crystal'
  | 'pipes'
  | 'tank'
  | 'tree'
  | 'mushroom'
  | 'flowers'
  | 'crops'
  | 'barrel'
  | 'generator'
  | 'lamp'
  | 'bench'
  | 'kiosk'
  | 'fountain'
  | 'locker'
  | 'camera'
  | 'barrier'
  | 'globe'
  | 'bloom'
  | 'screen'
  /* Gaia Nova outdoors. */
  | 'rock'
  | 'boulder'
  | 'cactus'
  | 'pine'
  | 'palm'
  | 'bush'
  | 'grass'
  | 'fern'
  | 'icespike'
  | 'lavarock'
  | 'bones'
  | 'tent'
  | 'wreck'
  | 'thorns'
  | 'banner'
  | 'pillar'
  /* Scylla's Reef. */
  | 'coral'
  | 'seafan'
  | 'kelp'
  | 'shell'
  | 'lighthouse'
  | 'tidepost'
  /** One of Aeëtes's robots, turned to stone by MEDUSA's gaze long ago (Medusa's Labyrinth). */
  | 'statue'
  /* The Garden of Colchis: a giant Gardener flower and a tree of glowing crystal. */
  | 'giantflower'
  | 'crystaltree';

/**
 * How a chapter ends. Chapter 1: GaScu is stopped (`saved`) or befriended (`friends`). Chapter 2:
 * Brennus is beaten (`freed`) or talked down with every journal page (`redeemed`). Chapter 3, the
 * game's final endings: the Golden Fleece is carried home and Celestia blooms again (`fleece`), or,
 * with every Gardener light-stone, LUX and IRIS speak the Gardeners' language and the Fleece's seeds
 * wake, so Celestia is no longer the last of her kind (`gardeners`).
 */
export type EndingKind = 'saved' | 'friends' | 'freed' | 'redeemed' | 'fleece' | 'gardeners';

/** Low props Jason walks straight through (they never block a cell). */
export const PASSABLE_DECOR: readonly DecorKind[] = ['grass', 'fern', 'bones', 'flowers', 'crops', 'kelp'];

/** Who can appear in a hologram log. */
export type HoloSpeaker = 'captain' | 'rosa' | 'hypatia' | 'brennus' | 'atalanta' | 'aeetes';

/** `glitch` is HALCYON while GaScu pollen scrambles its circuits. */
export type Speaker =
  | 'jason'
  | 'bolt'
  | 'halcyon'
  | 'glitch'
  | 'colonist'
  | 'vendy'
  | 'gascu'
  | 'celestia'
  | 'captain'
  | 'rosa'
  | 'brennus'
  | 'hypatia'
  /** Aeëtes, the salvage tycoon who wants the Golden Fleece (chapter 3's villain). */
  | 'aeetes'
  /** Atalanta, the scout who joins the Argonauts in chapter 3 (a playable hero). */
  | 'atalanta'
  /** IRIS, the rainbow droid Jason finds in the jungle. */
  | 'iris'
  /** LUX while Brennus's control chip has hold of him. */
  | 'rogue'
  /** Phineus, the blind old astronomer of the Harpy Isles (chapter 3). */
  | 'phineus'
  /** MEDUSA, Aeëtes's security AI in the labyrinth under Colchis (chapter 3). */
  | 'medusa';

export interface Line {
  who: Speaker;
  text: string;
  name?: string;
}

/** One storybook picture in a story scene, with what is said (or narrated) over it. */
export interface StoryBeat {
  panel: PanelId;
  lines?: Line[];
  caption?: string;
}

export interface LevelDef {
  id: DeckId;
  index: number;
  name: string;
  subtitle: string;
  /** The level's own song (see core/songs.ts). */
  music: Track;
  map: string;
  legend: Record<string, Spec>;
  intro?: string;
  outro?: string;
  /** `at` points the HUD waypoint somewhere: a marker id, 'boss' or 'exit'. */
  objectives: { until: Cond; text: string; at?: string }[];
  /** Shards in this deck, for the pause menu and results. */
  shardIds: string[];
  colonistIds?: string[];
  dialogues: Record<string, Line[]>;
  /**
   * Storybook scenes: illustrated panels with lines. A `colonist:<id>` story plays when that cocoon is
   * freed (instead of its conversation); others play from a trigger's `story:<key>` event.
   */
  stories?: Record<string, StoryBeat[]>;
  boss?: BossKind;
  /**
   * Driven instead of walked: the vehicle replaces Jason on foot, with its own controls, camera and HUD.
   * A vehicle level still has a (tiny) map for the spawn, but its play happens on the vehicle's course.
   */
  vehicle?: VehicleKind;
  /** The Argo's flight course (for `vehicle: 'argo'`). */
  flight?: FlightCourse;
  /** The little sub Dolphin's dive course (for `vehicle: 'sub'`). */
  dive?: DiveCourse;
  /**
   * Heroes the player can switch between on this level, the first one starting (default: just
   * Jason). With two or more, the HUD shows the switch button.
   */
  heroes?: HeroId[];
  /**
   * Heroes from `heroes` who join partway through the level, with the flag that brings them in:
   * until it is set they stay out of the roster (Atalanta joins on the Harpy Isles when Jason meets her).
   */
  joins?: Partial<Record<HeroId, string>>;
  /** The sea rises and falls on a cycle, flooding the low floors (Scylla's Reef). */
  tide?: TideDef;
}

/**
 * Tides: the sea level goes from `low` up to `high` and back again, spending `phases` seconds at low
 * tide, rising, at high tide and falling. A walkable floor below the sea is flooded: a hero standing on
 * it is washed back to the last dry spot. `raft`s float on the sea (see `entities/reef/tide.ts`).
 */
export interface TideDef {
  low: number;
  high: number;
  phases: [low: number, rising: number, high: number, falling: number];
}

export interface Cell {
  kind: TileKind;
  /** Top of the floor (walls report their visual top). */
  h: number;
  dark: boolean;
}

export interface PlacedEntity {
  id: string;
  spec: Spec;
  cx: number;
  cz: number;
  h: number;
}

export interface ParsedLevel {
  def: LevelDef;
  width: number;
  depth: number;
  cells: Cell[];
  entities: PlacedEntity[];
  spawn: { cx: number; cz: number; h: number; facing: number };
}
