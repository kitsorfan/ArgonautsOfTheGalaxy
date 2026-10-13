import type { MoonScene } from '../cinema/moonScene';
import type { PlanetScene } from '../cinema/planetScene';
import type { ShipScene } from '../cinema/shipScene';
import type { ButtonName, Input } from '../core/input';
import type { SaveData } from '../core/save';
import type { TitleScene } from '../game/title';
import type { World } from '../game/world';
import type { DeckId, HeroId } from '../world/levelTypes';

/**
 * What the trailer and the game share: the hooks the game hands the trailer's director, the context a
 * shot is set up and acted in, and the tally the recorder reads after every frame.
 */

/** The cinematic stages a shot can be filmed on, besides a level. */
export type StageKind = 'ship' | 'planet' | 'moon' | 'title';

/** A level, with the heroes the shot wants on it. */
export interface DeckSet {
  deck: DeckId;
  /** The heroes on the level (the level's own list unless given) and the one in control. */
  heroes?: HeroId[];
  hero?: HeroId;
}

/** What the game lets the trailer do. */
export interface TrailerHost {
  readonly input: Input;
  readonly save: SaveData;
  /** Builds a level straight into play: no title card, no opening, nothing queued. */
  deck(set: DeckSet): World;
  /** Builds one of the cinematic stages (or brings back the title screen's scene). */
  stage(kind: 'ship'): ShipScene;
  stage(kind: 'planet'): PlanetScene;
  stage(kind: 'moon'): MoonScene;
  stage(kind: 'title'): TitleScene;
  stage(kind: StageKind): ShipScene | PlanetScene | MoonScene | TitleScene;
}

/** Everything a shot can reach while it is set up and while it plays. */
export interface Take {
  readonly input: Input;
  readonly save: SaveData;
  /** The level on screen (throws on a stage). */
  readonly world: World;
  readonly ship: ShipScene;
  readonly planet: PlanetScene;
  readonly moon: MoonScene;
  readonly title: TitleScene;
  /** Anything a shot wants to remember from one frame to the next. */
  readonly memo: Record<string, unknown>;
  /** Pushes the stick so the hero heads along a world bearing (0 = +z, turning towards +x). */
  steer(bearing: number, push?: number): void;
  /** Pushes the stick towards a point on the map; lets go within `near` of it. */
  toward(x: number, z: number, push?: number, near?: number): void;
  /** Presses a button for this frame only. */
  tap(button: ButtonName): void;
  /** Holds a button down for this frame (call every frame to keep holding it). */
  hold(button: ButtonName): void;
}

export type Phase = 'warmup' | 'lead' | 'roll' | 'done';

/** What the recorder reads after every frame it asks for. Updated in place by the director. */
export interface Tally {
  phase: Phase;
  /** Whether the frame just drawn belongs in the trailer. */
  take: boolean;
  /** Which frame of the trailer that was, counted from its first. */
  frame: number;
  /** How many frames the trailer runs to. */
  total: number;
  /** The shot on screen. */
  shot: string;
  /** Every shot, and the frames it covers. */
  shots: { id: string; from: number; to: number }[];
  /** The recording the soundtrack is cut from (assets/music/<file>.mp3), where it starts, and its tempo. */
  music: { file: string; from: number; bpm: number };
}

declare global {
  interface Window {
    __trailer?: Tally;
  }
}
