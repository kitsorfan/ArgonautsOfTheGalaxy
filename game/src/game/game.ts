import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

import { Director, type Rig } from '../cinema/director';
import { argoHop, argoPrologue, argoVoyage } from '../cinema/chapter3';
import { fleeceHome, fleeceVoyage } from '../cinema/finale3';
import { MoonScene } from '../cinema/moonScene';
import { flyover, wakeUp } from '../cinema/scenes';
import { PlanetScene } from '../cinema/planetScene';
import * as planet from '../cinema/planetScenes';
import { ShipScene } from '../cinema/shipScene';
import * as space from '../cinema/spaceScenes';
import { audio } from '../core/audio';
import { haptic, inApp, post, setHaptics } from '../core/bridge';
import { CELL } from '../core/constants';
import { FrameWatch, resolveAuto, stepDown } from '../core/graphics';
import { lang, setLang, tr, type Lang } from '../core/i18n';
import { Input } from '../core/input';
import { heroCourse } from '../entities/heroes/course';
import { heroDev, parseHeroes } from '../entities/heroes/heroes';
import { cleanBolts, clearSave, loadSave, newSave, writeSave, type SaveData, type Settings } from '../core/save';
import { CHAPTER_DECKS, GAME_FINALE, LEVELS, LEVEL_ORDER, catchUpChapters, chapterIndex, chapterOf, chapterSize, chapterTotals, comingSoon, inChapter, isFinale, nextChapterStart, type Chapter } from '../levels';
import type { DeckId, EndingKind, Line } from '../world/levelTypes';
import { THEMES } from '../world/themes';
import { PANEL_IDS, type PanelId } from '../ui/panels';
import { UI } from '../ui/ui';
import { equippedWeapon, ownedWeapons } from '../entities/weapons';
import { knownOutfits, outfitFor } from '../entities/outfits';
import { buyAtalantaUpgrade, buyOutfit, buyUpgrade, buyWeapon, equipWeapon, takeOffOutfit, wearOutfit } from './shop';
import { PostFx } from './post';
import { enemyIconUrl } from '../entities/badges';
import { findKind, lootLabels, plannedFinds } from './collectibles';
import type { PuzzleKind } from './puzzles';
import { deckQuests, givePrize, payQuests, shardMilestone } from './quests';
import { takeReviewAsk } from './review';
import { INTEL, creditsHtml, endingChapter } from './story';
import { TitleScene } from './title';
import { World, type WorldHooks } from './world';
import { Trailer } from '../trailer/director';
import type { DeckSet, StageKind, TrailerHost } from '../trailer/stage';
import { VehicleHudView } from '../vehicles/hud';
import { argoBar } from '../entities/stand/holds';

type State = 'boot' | 'title' | 'menu' | 'card' | 'play' | 'dialogue' | 'hack' | 'shop' | 'pause' | 'down' | 'results' | 'ending' | 'cutscene' | 'cinema';

/** How a deck opens when it is entered fresh (not resumed from a checkpoint); 'none' skips the opening. */
type Opening = 'auto' | 'wake' | 'fly' | 'none';

/** A scene a cinematic is staged in: deep space around the ship, or the skies of Gaia Nova. */
interface CinemaScene {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  resize(w: number, h: number): void;
  update(dt: number, rig: Rig): void;
}

/** Frees everything a scene uploaded to the GPU. */
function disposeScene(scene: THREE.Scene) {
  scene.traverse((o) => {
    const any = o as THREE.Mesh;
    any.geometry?.dispose();
    const mats = Array.isArray(any.material) ? any.material : any.material ? [any.material] : [];
    for (const m of mats) {
      for (const v of Object.values(m)) if (v instanceof THREE.Texture) v.dispose();
      m.dispose();
    }
    if (o instanceof THREE.InstancedMesh) o.dispose();
    if (o instanceof THREE.Light) o.dispose();
  });
}

const ABILITY_LINES: Record<string, Line[]> = {
  doubleJump: [
    { who: 'bolt', text: 'JET BOOTS! Now you can jump again while you are in the air. Double jump!' },
    { who: 'jason', text: 'Up, up and away!' },
  ],
  dash: [
    { who: 'bolt', text: 'DASH THRUSTERS! Press DASH to zoom forward, even in mid-air. Great for long gaps!' },
    { who: 'bolt', text: 'A dash hits HARD too: ram straight through enemies! Each one uses an energy cell. Checkpoints and violet energy cells fill you back up.' },
    { who: 'jason', text: 'Nyoom!' },
  ],
  glide: [
    { who: 'bolt', text: 'A HOVER PACK! Hold JUMP while you fall to float gently down. Wheee!' },
    { who: 'jason', text: 'I can glide across the whole Ring with this!' },
    { who: 'bolt', text: 'King Bloblin is on the island in the MIDDLE of the Ring. Climb the launch tower, follow the gold marker and glide over!' },
  ],
  pulse: [
    { who: 'bolt', text: 'FORCE PULSE installed! Press PULSE and I blast out a shockwave. It knocks out every enemy around you!' },
    { who: 'bolt', text: 'It also shorts out lasers for a few seconds. But it takes me a LONG time to recharge, so pick your moment.' },
    { who: 'jason', text: 'Those laser walls don’t stand a chance.' },
  ],
  grapple: [
    { who: 'bolt', text: 'A GRAPPLE HOOK! See the glowing rings? Look at one and press GRAPPLE to zip right over to it!' },
    { who: 'bolt', text: 'It works over gaps, up cliffs, even across quicksand. If the ring glows bright, you can reach it.' },
    { who: 'jason', text: 'Hold on to your antenna, LUX!' },
  ],
  mirror: [
    { who: 'bolt', text: 'The Gardeners’ MIRROR SHIELD! It’s polished so bright, I can see all my scratches.' },
    { who: 'bolt', text: 'HOLD the SPIN button to raise it. MEDUSA’s green gaze bounces right off it instead of turning you to stone!' },
    { who: 'atalanta', text: 'And turn while you hold it up: the bounced beam goes where the shield points. Light a crystal with it!' },
    { who: 'jason', text: 'A shield that bounces light. Just like Perseus in the old story!' },
  ],
};

const tmpV = new THREE.Vector3();

export class Game {
  readonly renderer: THREE.WebGLRenderer;
  private input: Input;
  private ui: UI;
  private save: SaveData;
  private world: World | null = null;
  private title = new TitleScene();
  private envMap: THREE.Texture;
  private post: PostFx;
  private state: State = 'boot';
  private last = performance.now();
  private deckTime = 0;
  private boltsAtStart = 0;
  private frames = 0;
  private fpsT = 0;
  private hudT = 0;
  /** Auto graphics: watches the frame rate during play and steps the quality down when it can't keep up. */
  private watch = new FrameWatch();
  private director: Director | null = null;
  private ship: CinemaScene | null = null;
  private queue: { script: (d: Director) => Promise<void>; resolve: () => void }[] = [];
  /** The boost button, progress bar and call-outs of a vehicle level. */
  private vehicleHud: VehicleHudView;
  /** Set while the game is filming its own trailer (#trailer, see trailer/director.ts). */
  private trailer: Trailer | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    touch: HTMLElement,
    uiRoot: HTMLElement,
  ) {
    this.save = loadSave() ?? newSave();
    // Finished a chapter before the next one existed? It's open now.
    if (catchUpChapters(this.save)) writeSave(this.save);
    resolveAuto(this.save.settings);
    // No antialiasing on the canvas itself: medium and high smooth edges in the bloom pass's own multisampled target,
    // so a multisampled screen would only cost memory and fill rate.
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // A soft studio environment gives metal and glossy toys their shine.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.title.scene.environment = this.envMap;
    this.title.scene.environmentIntensity = 0.55;
    this.post = new PostFx(this.renderer);
    this.input = new Input(touch);
    this.ui = new UI(uiRoot, this.input);
    this.ui.onPause = () => this.pause();
    this.vehicleHud = new VehicleHudView(uiRoot, this.input);
    this.applySettings(this.save.settings);
    window.addEventListener('resize', () => this.resize());
    this.resize();
    window.__onBack = () => this.back();
    window.__onPause = () => {
      if (this.state === 'play') this.pause();
      audio.suspend(true);
    };
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.state === 'play') this.pause();
        this.persist();
        audio.suspend(true);
      } else {
        audio.suspend(false);
      }
    });
    window.__game = this;
    requestAnimationFrame((t) => this.frame(t));
    // Warm up while the splash plays: fonts, and every shader the title scene needs.
    const renderer = this.renderer;
    const title = this.title;
    const ready = (async () => {
      await new Promise((r) => setTimeout(r, 60));
      try {
        await document.fonts?.ready;
      } catch {
        // fonts are embedded; carry on without waiting
      }
      renderer.compile(title.scene, title.camera);
    })();
    // Developer shortcut, only in a desktop browser (never in the app): #deck=<id> jumps straight into a deck
    // (&still skips its opening, &all hands over every ability), #cinema=<arrival|descent|hop|finale> plays a
    // chapter 2 cinematic, #cinema=<argo|voyage|argohop> a chapter 3 one, #cinema=<fleece|gardeners> the game's final endings.
    const dev = inApp() ? null : new URLSearchParams(location.hash.slice(1));
    // #trailer films the game's trailer (&lang=el in Greek); `npm run trailer` records it to an MP4.
    if (dev?.has('trailer')) {
      void ready.then(() => this.startTrailer(dev));
      return;
    }
    if (dev && (dev.get('deck') || dev.get('cinema') || dev.get('panel') || dev.get('menu'))) {
      void ready.then(() => this.devJump(dev));
      return;
    }
    // First launch (or until a language is picked): the boot screen asks for English or Greek.
    const pick = this.save.settings.langChosen
      ? null
      : (l: Lang) => {
          this.save.settings = { ...this.save.settings, lang: l, langChosen: true };
          this.applySettings(this.save.settings);
          writeSave(this.save);
        };
    this.ui.tapToStart(ready, pick, () => {
      audio.unlock();
      this.toTitle();
    });
  }

  private devJump(dev: URLSearchParams) {
    if (dev.has('all')) {
      this.save.abilities = ['doubleJump', 'dash', 'glide', 'pulse', 'grapple', 'mirror'];
      this.save.unlocked = LEVEL_ORDER.length;
    }
    // &bolts=N sets the bolt count, &weapons=spread,frost hands over weapons (&weapon=frost equips one),
    // &up=heart:4,armor:1 sets upgrade levels, &ata=bow:3,triple:1 Atalanta's, &outfit=bronze,artemis
    // hands over outfits and puts them on, and &shop opens PANDORA's shop once the deck is up
    // (&shop=weapons|atalanta|outfits on that tab, &try=<outfit> in the fitting room).
    const bolts = Number(dev.get('bolts'));
    if (bolts > 0) this.save.bolts = cleanBolts(bolts);
    const hearts = Number(dev.get('hearts'));
    if (hearts > 0) this.save.maxHearts = hearts;
    const arms = dev.get('weapons');
    if (arms) this.save.weapons = ownedWeapons(arms.split(','));
    this.save.weapon = equippedWeapon(this.save.weapons, dev.get('weapon') ?? this.save.weapon);
    for (const pair of dev.get('up')?.split(',') ?? []) {
      const [id, n] = pair.split(':');
      this.save.upgrades[id as keyof SaveData['upgrades']] = Number(n) || 0;
    }
    for (const pair of dev.get('ata')?.split(',') ?? []) {
      const [id, n] = pair.split(':');
      this.save.ataUpgrades[id as keyof SaveData['ataUpgrades']] = Number(n) || 0;
    }
    for (const id of knownOutfits(dev.get('outfit')?.split(',') ?? [])) {
      if (!this.save.outfits.includes(id)) this.save.outfits.push(id);
      for (const hero of ['jason', 'atalanta'] as const) if (outfitFor(hero, id)) this.save.wearing[hero] = id;
    }
    // &heroes=jason,atalanta lets you switch heroes on any deck; &hero=atalanta starts as her.
    const heroes = parseHeroes(dev.get('heroes'));
    if (heroes.length) heroDev.heroes = heroes;
    const hero = parseHeroes(dev.get('hero'))[0];
    if (hero) heroDev.hero = hero;
    // &course swaps the deck for the small hero practice course (dressed as that deck).
    if (dev.has('course')) heroDev.course = true;
    // &press=KeyW:3600:6000,Space:4200 holds keys from/to those milliseconds, for scripted test runs.
    for (const step of dev.get('press')?.split(',') ?? []) {
      const [code, from, to] = step.split(':');
      const t0 = Number(from) || 0;
      setTimeout(() => window.dispatchEvent(new KeyboardEvent('keydown', { code })), t0);
      setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code })), Number(to) || t0 + 90);
    }
    const deck = dev.get('deck') as DeckId | null;
    if (deck && LEVELS[deck]) {
      this.startDeck(deck, false, dev.has('still') ? 'none' : 'auto');
      const tab = dev.get('shop');
      if (tab === 'weapons' || tab === 'atalanta' || tab === 'outfits') this.ui.shopTab = tab;
      // &try=<outfit> (with &shop=outfits) opens the fitting room on it.
      this.ui.shopTry = dev.get('try');
      // &fire keeps tapping BLAST (&fire=charge holds it for charged shots), for looking at the weapons.
      const fire = dev.get('fire');
      if (fire !== null) {
        const hold = fire === 'charge' ? 1300 : 60;
        setInterval(() => {
          this.input.press('shoot', true);
          setTimeout(() => this.input.press('shoot', false), hold);
        }, hold + 380);
      }
      if (dev.has('shop')) setTimeout(() => this.world && this.hooks().shop(), 3600);
      // &flags=iris,luxback starts with story flags set, &play=taken|iris|rogue|reunion plays one of
      // LUX's chapter 2 scenes, and &talk clicks through dialogue by itself (for checking cutscenes).
      const flags = dev.get('flags')?.split(',') ?? [];
      const play = dev.get('play');
      if (flags.length || play) setTimeout(() => this.world?.devStory(flags, play), 3600);
      if (dev.has('talk')) setInterval(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' })), 900);
      // &tick also drives the game from a timer: headless browsers barely run animation frames.
      if (dev.has('tick')) setInterval(() => this.step(performance.now()), 33);
      // &time=<seconds> winds the deck's clock (the tide on Scylla's Reef) once it is up.
      const time = Number(dev.get('time'));
      if (time) setTimeout(() => this.world && (this.world.time = time), 3400);
      // &at=x,z puts Jason on that map cell once the deck is up (after the title card).
      const at = dev.get('at')?.split(',').map(Number);
      // On a vehicle level, &at=<distance> flies ahead along the course instead.
      if (at && at.length === 1) setTimeout(() => this.world?.vehicle?.skipTo?.(at[0]), 3400);
      // &drop drops a heart pickup once the deck is up, a few steps from the hero toward the camera
      // (aboard the mech, a gear).
      if (dev.has('drop'))
        setTimeout(() => {
          const w = this.world;
          if (!w) return;
          const p = w.player.body;
          const to = new THREE.Vector3(w.camera.position.x - p.x, 0, w.camera.position.z - p.z).setLength(3.5);
          w.dropHeart(new THREE.Vector3(p.x + to.x, p.y + 1, p.z + to.z));
        }, 3800);
      if (at && at.length === 2) {
        setTimeout(() => {
          const w = this.world;
          if (!w) return;
          const c = w.grid.cell(at[0], at[1]);
          w.player.teleport(at[0] * CELL + CELL / 2, c.h + 0.1, at[1] * CELL + CELL / 2);
          w.snapCamera();
        }, 3400);
      }
      return;
    }
    // #menu=decks opens the level select (with &all, every level unlocked); #menu=title|settings|about|news|help
    // opens that screen, for checking how it fits a phone.
    const menu = dev.get('menu');
    if (menu === 'decks') return this.deckSelect();
    if (menu === 'title') return this.toTitle();
    if (menu === 'settings') return this.settings(() => this.toTitle(), true);
    if (menu === 'about') return this.ui.about(() => this.toTitle());
    if (menu === 'news') return this.ui.whatsNew(() => this.toTitle());
    if (menu === 'help') return this.ui.help(() => this.toTitle());
    // #menu=results, #menu=end and #menu=hack&kind=<puzzle> show a sample results card, END OF CHAPTER card and LUX HACK puzzle.
    if (menu === 'results') {
      const rows: [string, string][] | undefined = dev.has('rows') ? [['Rings', '18 / 20'], ['Drones', '7 / 9']] : undefined;
      return this.ui.results({ deck: 'The Clashing Rocks', time: '4:05', bolts: 120, shards: '2 / 3', colonists: '1 / 2', next: 'The Harpy Isles', planet: false, voyage: true, labels: lootLabels(3), rows }, () => this.toTitle());
    }
    if (menu === 'end') return this.ui.chapterEnd('saved', 1, tr('{finds}: {n} / {total}. Find the rest for a secret ending!', { finds: lootLabels(1).finds, n: 12, total: 18 }), 2, () => this.toTitle());
    if (menu === 'hack') return this.ui.hack(6, () => this.toTitle(), (dev.get('kind') ?? 'memory') as PuzzleKind);
    // #panel=<id> shows one storybook illustration on its own (for checking the art); add &caption or
    // &talk to see a sample caption or line of dialogue over it.
    const art = dev.get('panel') as PanelId | null;
    if (art && (PANEL_IDS as readonly string[]).includes(art)) {
      this.state = 'cinema';
      this.ui.cinema(true);
      this.ui.storyPanel(art);
      if (dev.has('caption')) this.ui.caption('Low over the dock, white and gold, the Argo slipped through the great arch.');
      if (dev.has('talk')) this.ui.dialogue([{ who: 'jason', text: 'Look! He’s saluting! General, you were AMAZING!' }], () => {});
      return;
    }
    const film = dev.get('cinema');
    const done = () => this.toTitle();
    if (film === 'arrival') void this.cinema((d, s) => planet.arrival(d, s)).then(done);
    else if (film === 'descent') void this.planetCinema((d, p) => planet.descent(d, p)).then(done);
    else if (film === 'hop') void this.planetCinema((d, p) => planet.hop(d, p, 'plains', 'desert')).then(done);
    else if (film === 'finale') void this.planetCinema((d, p) => planet.finale(d, p, 'freed')).then(done);
    else if (film === 'argo') void this.planetCinema((d, p) => argoPrologue(d, p)).then(() => this.moonCinema((d, m) => argoVoyage(d, m))).then(done);
    else if (film === 'voyage') void this.moonCinema((d, m) => argoVoyage(d, m)).then(done);
    else if (film === 'argohop') void this.moonCinema((d, m) => argoHop(d, m, 'rocks', null)).then(done);
    // #cinema=<saved|friends|freed|redeemed|fleece|gardeners> plays that ending (with its END OF CHAPTER card, then the
    // next chapter's opening, or after chapter 3 the end credits), as if just earned.
    else if (film === 'saved' || film === 'friends' || film === 'freed' || film === 'redeemed' || film === 'fleece' || film === 'gardeners') this.ending(film);
  }

  private applySettings(s: Settings) {
    audio.setVolumes(s.music, s.sfx);
    setHaptics(s.haptics);
    if (s.lang !== lang()) {
      setLang(s.lang);
      this.ui.applyLang();
    }
    const ratio = Math.min(window.devicePixelRatio || 1, s.quality === 'high' ? 2 : s.quality === 'medium' ? 1.5 : 1);
    this.renderer.setPixelRatio(ratio);
    this.resize();
    this.post.configure(s.quality);
  }

  /** Auto graphics found play too slow: one step down now (sharpness and glow change at once, shadows from the next deck), and remembered. */
  private slowDown() {
    const s = this.save.settings;
    const next = stepDown(s.quality);
    if (!next) return;
    s.quality = next;
    s.autoCap = next;
    this.applySettings(s);
    writeSave(this.save);
  }

  private resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.title.resize(w, h);
    this.world?.resize(w, h);
    this.ship?.resize(w, h);
    this.post?.resize();
  }

  private persist() {
    // The trailer plays on a save of its own, which must never overwrite the player's.
    if (this.trailer) return;
    if (this.world && this.state !== 'ending') {
      this.save.resume = { deck: this.world.def.id, ...this.world.resumeState() };
    }
    writeSave(this.save);
  }

  /* ---------------- menus ---------------- */

  private toTitle() {
    this.disposeWorld();
    this.ui.fade('#000000', 0, 0.5);
    this.state = 'title';
    this.ui.showHud(false);
    audio.music('title');
    const r = this.save.resume;
    this.ui.title({
      canContinue: !!r,
      continueText: r ? LEVELS[r.deck].name : '',
      hasDecks: this.save.unlocked > 1 || this.save.completed.length > 0,
      onContinue: () => {
        if (!r) return;
        // The first time a chapter starts, its opening plays first.
        const ch = chapterOf(r.deck);
        if (ch > 1 && r.deck === CHAPTER_DECKS[ch][0] && !r.checkpoint && !this.introSeen(ch)) this.startChapter(ch);
        else this.startDeck(r.deck, true);
      },
      onNew: () => {
        if (this.save.resume || this.save.completed.length) {
          this.ui.confirm('Start a brand new adventure? Your current progress will be erased.', () => this.newGame(), () => this.toTitle());
        } else this.newGame();
      },
      onDecks: () => this.deckSelect(),
      onSettings: () => this.settings(() => this.toTitle(), true),
    });
  }

  private newGame() {
    const settings = this.save.settings;
    this.save = newSave();
    this.save.settings = settings;
    writeSave(this.save);
    this.state = 'menu';
    audio.music('title');
    void this.cinema((d, ship) => space.prologue(d, ship)).then(() => this.startDeck('cryo', false, 'wake'));
  }

  /** True once a chapter's opening has been shown. */
  private introSeen(ch: Chapter): boolean {
    return ch === 1 || (ch === 2 ? !!this.save.gaiaIntro : !!this.save.argoIntro);
  }

  /**
   * Opens a chapter with its cinematic, then its first level. Chapter 2: the ship arrives at Gaia Nova,
   * Celestia is stolen, and the shuttle flies down to the Whispering Plains. Chapter 3: Celestia fades,
   * the Argo is built and sets off for the ring of moons, and Aeëtes shows up.
   */
  private startChapter(ch: Chapter) {
    const first = CHAPTER_DECKS[ch][0];
    this.state = 'menu';
    this.save.unlocked = Math.max(this.save.unlocked, LEVELS[first].index);
    this.save.resume = { deck: first, checkpoint: null, flags: [], taken: [], dead: [] };
    writeSave(this.save);
    audio.music('title');
    const film =
      ch === 2
        ? this.cinema((d, ship) => planet.arrival(d, ship)).then(() => this.planetCinema((d, p) => planet.descent(d, p)))
        : this.planetCinema((d, p) => argoPrologue(d, p)).then(() => this.moonCinema((d, m) => argoVoyage(d, m)));
    void film.then(() => {
      if (ch === 2) this.save.gaiaIntro = true;
      else this.save.argoIntro = true;
      writeSave(this.save);
      this.startDeck(first, false, 'fly');
    });
  }

  private deckSelect() {
    this.state = 'menu';
    const levels = LEVEL_ORDER.map((id) => {
      const d = LEVELS[id];
      return {
        index: d.index,
        id,
        name: d.name,
        color: THEMES[id].accent,
        shards: d.shardIds.filter((s) => this.save.shards.includes(`${id}.${s}`)).length,
        shardTotal: d.shardIds.length,
        unlocked: d.index <= this.save.unlocked,
        completed: this.save.completed.includes(id),
        chapter: chapterOf(id),
        number: chapterIndex(id),
      };
    });
    // The levels of chapter 3 that are still being built, listed after the ones that exist.
    const soon = comingSoon(3).map((name, i) => ({
      index: 0,
      id: `soon${i}`,
      name,
      color: '#8a90b0',
      shards: 0,
      shardTotal: 0,
      unlocked: false,
      completed: false,
      chapter: 3 as const,
      number: CHAPTER_DECKS[3].length + i + 1,
      soon: true,
    }));
    this.ui.decks(
      [...levels, ...soon],
      (id) => this.startDeck(id as DeckId, false),
      () => this.toTitle(),
    );
  }

  private settings(back: () => void, allowReset = false) {
    const prev = this.state;
    this.state = 'menu';
    this.ui.settings(
      this.save.settings,
      (s) => {
        resolveAuto(s);
        this.save.settings = s;
        this.applySettings(s);
        writeSave(this.save);
      },
      () => {
        this.state = prev === 'menu' ? 'menu' : prev;
        back();
      },
      allowReset
        ? () =>
            this.ui.confirm(
              'Erase ALL progress, shards and upgrades?',
              () => {
                clearSave();
                this.save = newSave();
                resolveAuto(this.save.settings);
                this.applySettings(this.save.settings);
                this.toTitle();
              },
              () => this.settings(back, allowReset),
            )
        : undefined,
    );
  }

  private pause() {
    if (this.state !== 'play' || !this.world) return;
    this.state = 'pause';
    this.input.reset();
    this.ui.showControls(false);
    const w = this.world;
    const d = w.def;
    const ch = chapterOf(d.id);
    const totals = chapterTotals(ch);
    this.ui.pause({
      deck: d.name,
      planet: ch === 2,
      voyage: ch === 3,
      labels: lootLabels(ch),
      stats: w.vehicle?.stats(),
      shards: tr('{n} / {m} here · {t} / {total} total', {
        n: d.shardIds.filter((s) => this.save.shards.includes(`${d.id}.${s}`)).length,
        m: d.shardIds.length,
        t: inChapter(this.save.shards, ch),
        total: totals.shards,
      }),
      colonists: `${inChapter(this.save.colonists, ch)} / ${totals.colonists}`,
      quests: deckQuests(d.id, this.save),
      onResume: () => this.resume(),
      onHelp: () => this.ui.help(() => this.pauseAgain()),
      onSettings: () => this.settings(() => this.pauseAgain()),
      onRestart: () => {
        this.resume();
        w.respawn();
      },
      onQuit: () => {
        this.persist();
        this.toTitle();
      },
    });
  }

  private pauseAgain() {
    this.state = 'play';
    this.pause();
  }

  private resume() {
    this.ui.close();
    this.ui.showControls(true);
    this.input.flush();
    this.state = 'play';
  }

  private back() {
    switch (this.state) {
      case 'play':
        this.pause();
        break;
      case 'pause':
        this.resume();
        break;
      case 'title':
        post({ type: 'exit' });
        break;
      case 'cutscene':
      case 'cinema':
        this.director?.skip();
        break;
      default:
        break;
    }
  }

  /* ---------------- decks ---------------- */

  private disposeWorld() {
    this.vehicleHud.show(null);
    if (!this.world) return;
    this.world.vehicle?.dispose();
    // Free every buffer, texture, material and shadow map the deck uploaded; phones have little GPU memory.
    // Shared helpers (cached geometry, glow textures) are simply uploaded again when the next deck uses them.
    disposeScene(this.world.scene);
    this.world = null;
    this.ui.warn(null);
    this.ui.voice = (who) => who;
    this.queue = [];
    this.renderer.renderLists.dispose();
  }

  /* ---------------- cutscenes ---------------- */

  /** Queues an in-deck cutscene. It starts as soon as nothing else (dialogue, menus) is on screen. */
  private cutscene(script: (d: Director) => Promise<void>): Promise<void> {
    return new Promise((resolve) => this.queue.push({ script, resolve }));
  }

  private runCutscene() {
    const w = this.world;
    const job = this.queue.shift();
    if (!w || !job) return;
    const rig: Rig = { pos: w.camera.position.clone(), look: w.cameraLook.clone(), fov: w.camera.fov };
    const d = new Director(this.ui, rig);
    this.director = d;
    this.state = 'cutscene';
    this.input.reset();
    this.ui.showControls(false);
    this.ui.showHud(false);
    this.ui.setAction(null);
    this.ui.cinema(true, () => d.skip(), () => d.tap());
    w.cutscene = true;
    w.setCameraRig(rig);
    job
      .script(d)
      .catch((err: unknown) => console.error(err))
      .finally(() => {
        if (this.world === w) {
          w.cutscene = false;
          w.setCameraRig(null, d.skipping ? 0.35 : 0.9);
        }
        if (this.director === d) this.director = null;
        this.ui.cinema(false);
        if (this.state === 'cutscene') {
          this.state = 'play';
          this.ui.showHud(true);
          this.ui.showControls(true);
          this.input.flush();
          this.refreshHud();
        }
        job.resolve();
      });
  }

  /** Plays a cinematic out in space (prologue, the rides between decks, endings). */
  private cinema(script: (d: Director, ship: ShipScene) => Promise<void>) {
    // Deep space has nothing bright to reflect: keep the studio reflections faint.
    return this.stage(() => new ShipScene(), script, 0.18);
  }

  /** Plays a cinematic over Gaia Nova (the descent, the shuttle hops between regions, the chapter 2 ending). */
  private planetCinema(script: (d: Director, p: PlanetScene) => Promise<void>) {
    return this.stage(() => new PlanetScene(), script, 0.4);
  }

  /** Plays a cinematic among the moons of the gas giant (chapter 3's opening and the Argo's voyage). */
  private moonCinema(script: (d: Director, m: MoonScene) => Promise<void>) {
    return this.stage(() => new MoonScene(), script, 0.25);
  }

  private async stage<S extends CinemaScene>(make: () => S, script: (d: Director, s: S) => Promise<void>, env: number) {
    this.disposeWorld();
    this.ui.close();
    const s = make();
    s.scene.environment = this.envMap;
    s.scene.environmentIntensity = env;
    s.resize(window.innerWidth, window.innerHeight);
    const rig: Rig = { pos: s.camera.position.clone(), look: new THREE.Vector3(), fov: 45 };
    const d = new Director(this.ui, rig);
    this.ship = s;
    this.director = d;
    this.state = 'cinema';
    this.input.reset();
    this.ui.showHud(false);
    this.ui.showControls(false);
    this.ui.cinema(true, () => d.skip(), () => d.tap());
    this.renderer.compile(s.scene, s.camera);
    try {
      await script(d, s);
    } catch (err) {
      console.error(err);
    }
    this.ui.cinema(false);
    if (this.director === d) this.director = null;
    this.ship = null;
    disposeScene(s.scene);
  }

  private startDeck(id: DeckId, resume: boolean, opening: Opening = 'auto') {
    this.disposeWorld();
    const def = heroDev.course ? heroCourse(id, LEVELS[id].name, LEVELS[id].music) : LEVELS[id];
    this.state = 'card';
    this.ui.showHud(false);
    audio.music(def.music);
    const r = resume && this.save.resume?.deck === id ? this.save.resume : null;
    const build = () => {
      const w = new World(def, this.save, this.hooks(), this.save.settings.quality, r ? { checkpoint: r.checkpoint, flags: r.flags ?? [], taken: r.taken ?? [], dead: r.dead ?? [] } : null);
      w.scene.environment = this.envMap;
      w.resize(window.innerWidth, window.innerHeight);
      // LUX's lines go to whoever is with Jason on this deck (IRIS, HALCYON's radio, or Jason himself).
      this.ui.voice = (who, toast) => w.voice(who, toast);
      // Compile every shader now so the first frames of play don't stutter.
      this.renderer.compile(w.scene, w.camera);
      return w;
    };
    // Build the deck behind its title card (after the card has painted) so the loading pause is hidden.
    let ready: World | null = null;
    const early = setTimeout(() => {
      ready = build();
    }, 80);
    const ch = chapterOf(id);
    const n = chapterIndex(id);
    const kicker = ch === 1 ? tr('DECK {n} OF 6', { n }) : ch === 2 ? tr('GAIA NOVA · REGION {n} OF 6', { n }) : tr('THE ARGONAUTS · LEVEL {n} OF {m}', { n, m: chapterSize(3) });
    this.ui.card(kicker, def.name, def.subtitle, THEMES[id].accent, () => {
      clearTimeout(early);
      this.world = ready ?? build();
      this.deckTime = 0;
      this.boltsAtStart = this.save.bolts;
      this.save.resume = { deck: id, ...this.world.resumeState() };
      writeSave(this.save);
      this.state = 'play';
      this.ui.showHud(true);
      this.ui.showControls(true);
      this.vehicleHud.show(this.world.vehicle?.kind ?? null);
      this.ui.setShards(
        def.shardIds.map((s) => this.save.shards.includes(`${id}.${s}`)),
        findKind(chapterOf(id)),
      );
      this.refreshHud();
      this.input.flush();
      const w = this.world;
      const how = r || opening === 'none' ? null : opening === 'auto' ? (id === 'cryo' ? 'wake' : 'fly') : opening;
      if (how !== 'wake') this.ui.fade('#000000', 0, 0.7);
      if (how === 'wake') void this.cutscene((d) => wakeUp(d, w));
      else if (how === 'fly') void this.cutscene((d) => (w.vehicle ? w.vehicle.intro(d) : flyover(d, w)));
    });
  }

  private refreshHud() {
    const w = this.world;
    if (!w) return;
    if (w.vehicle) {
      // In a vehicle the hearts are its hull.
      this.ui.setHearts(w.vehicle.hull, w.vehicle.hullMax);
      this.ui.setBolts(this.save.bolts);
      return;
    }
    this.ui.setHearts(w.player.hearts, this.save.maxHearts, w.player.armor, w.player.armorMax);
    this.refreshStrength(w);
    this.ui.setBolts(this.save.bolts);
    this.refreshAbilities(w);
  }

  /** Aboard the bronze mech, its STRENGTH bar stands in for the hearts, and its flamethrower's heat shows by FLAME. */
  private refreshStrength(w: World) {
    const mech = w.player.aboard ? w.player.mech : null;
    this.ui.setStrength(mech ? mech.strength : null);
    if (mech) this.ui.setHeat(1 - mech.fuel, mech.tank.dry, 'hm');
  }

  private refreshAbilities(w: World) {
    const pl = w.player;
    this.ui.setAbilities({
      spins: pl.spins,
      spinMax: pl.spinMax,
      spinReload: pl.spinReloadProgress,
      dash: this.save.abilities.includes('dash'),
      energy: pl.energy,
      energyMax: pl.energyMax,
      // The force pulse is a droid's: Jason can't fire it while he is on his own.
      pulse: this.save.abilities.includes('pulse') && w.boltActive,
      pulseCharge: w.pulseCharge,
      pulseLeft: w.pulseCd,
      weapon: pl.weapon,
      weapons: ownedWeapons(this.save.weapons).length,
      hero: pl.hero,
      swapTo: pl.nextHero,
      swapReady: pl.swapReady,
    });
  }

  /** Draws the gold objective marker over its target, or pinned to the screen edge pointing at it. */
  private placeWaypoint(w: World) {
    const at = w.waypoint;
    const p = w.player.body;
    const dist = at ? Math.hypot(at.x - p.x, at.z - p.z) : 0;
    if (!at || dist < 5) {
      this.ui.setWaypoint(null);
      return;
    }
    const W = window.innerWidth;
    const H = window.innerHeight;
    const v = tmpV.set(at.x, at.y + 2.4, at.z).project(w.camera);
    const behind = v.z > 1;
    let x = (v.x * 0.5 + 0.5) * W;
    let y = (0.5 - v.y * 0.5) * H;
    if (behind) {
      // Behind the camera the projection comes out mirrored.
      x = W - x;
      y = H - y;
    }
    const left = 44;
    const top = 84;
    const bottom = 70;
    if (!behind && x > left && x < W - left && y > top && y < H - bottom) {
      this.ui.setWaypoint({ x, y, edge: false, angle: 0, dist });
      return;
    }
    // Slide the marker along the line from the screen centre until it meets the safe edge.
    const cx = W / 2;
    const cy = H / 2;
    const dx = x - cx;
    const dy = behind && Math.abs(y - cy) < 1 ? 1 : y - cy;
    const sx = (W / 2 - left) / Math.max(1e-3, Math.abs(dx));
    const sy = (dy > 0 ? H / 2 - bottom : H / 2 - top) / Math.max(1e-3, Math.abs(dy));
    const s = Math.min(sx, sy);
    this.ui.setWaypoint({ x: cx + dx * s, y: cy + dy * s, edge: true, angle: Math.atan2(dy, dx), dist });
  }

  private hooks(): WorldHooks {
    return {
      say: (lines, then) => {
        if (!lines.length) {
          then?.();
          return;
        }
        const prev = this.state;
        this.state = 'dialogue';
        this.input.reset();
        this.ui.showControls(false);
        this.ui.dialogue(lines, () => {
          this.state = prev === 'dialogue' ? 'play' : prev === 'play' ? 'play' : prev;
          if (this.state === 'play') this.ui.showControls(true);
          this.input.flush();
          then?.();
        });
      },
      toast: (text, who) => this.ui.toast(text, who ?? 'bolt'),
      helper: (who) => this.ui.setHelper(who),
      hack: (length, done, kind) => {
        this.state = 'hack';
        this.input.reset();
        this.ui.showControls(false);
        this.ui.hack(
          length,
          (ok) => {
            this.state = 'play';
            this.ui.showControls(true);
            this.input.flush();
            done(ok);
          },
          kind,
        );
      },
      shop: () => {
        this.state = 'shop';
        this.input.reset();
        this.ui.showControls(false);
        const deck = this.world?.def.id ?? 'cryo';
        // Bolts spent here don't count against the ones collected on this level.
        const before = this.save.bolts;
        this.ui.shop(this.save, deck, {
          buyUpgrade: (id) => this.bought(buyUpgrade(this.save, id, deck), id === 'heart'),
          buyWeapon: (id) => this.bought(buyWeapon(this.save, id, deck)),
          equip: (id) => {
            if (equipWeapon(this.save, id)) this.world?.player.refreshGear();
          },
          buyAtalanta: (id) => this.bought(buyAtalantaUpgrade(this.save, id, deck)),
          buyOutfit: (id) => this.bought(buyOutfit(this.save, id, deck)),
          wear: (id) => this.dressed(wearOutfit(this.save, id)),
          takeOff: (hero) => this.dressed(takeOffOutfit(this.save, hero)),
          close: () => {
            this.boltsAtStart -= before - this.save.bolts;
            this.ui.close();
            this.state = 'play';
            this.ui.showControls(true);
            this.input.flush();
            this.refreshHud();
            writeSave(this.save);
          },
        });
      },
      complete: () => this.completeDeck(),
      checkpoint: () => this.persist(),
      collect: (kind, id) => {
        const w = this.world;
        if (!w) return;
        if (kind === 'shard') {
          const d = w.def;
          this.ui.setShards(
            d.shardIds.map((s) => this.save.shards.includes(`${d.id}.${s}`)),
            findKind(chapterOf(d.id)),
          );
          const key = id.split('.')[1];
          const lines = d.dialogues[`shard:${key}`];
          const milestone = shardMilestone(this.save, d.id);
          if (milestone) this.ui.reward(milestone);
          if (inChapter(this.save.shards, chapterOf(d.id)) % 6 === 0) w.player.heal(99);
          this.persist();
          haptic('success');
          if (lines) this.hooks().say(lines);
        } else if (kind === 'ability') {
          this.persist();
          this.refreshHud();
          this.hooks().say(ABILITY_LINES[id] ?? []);
        } else {
          this.persist();
        }
        for (const msg of payQuests(w.def.id, this.save)) this.ui.reward(msg);
        this.refreshHud();
      },
      hud: () => this.refreshHud(),
      bossBar: (name, frac) => this.ui.setBoss(name, frac, this.world?.boss?.phaseMarks ?? []),
      down: () => {
        this.state = 'down';
        this.input.reset();
        this.ui.showControls(false);
        haptic('warning');
        audio.play('fail');
        this.ui.down(() => {
          this.world?.respawn();
          this.state = 'play';
          this.ui.showControls(true);
          this.input.flush();
          this.refreshHud();
        });
      },
      music: (t) => audio.music(t),
      objective: (t) => this.ui.setObjective(t),
      ending: (kind) => this.ending(kind),
      cutscene: (script) => this.cutscene(script),
      prize: (reward) => {
        const w = this.world;
        const msg = givePrize(reward, this.save, w?.def.id);
        this.ui.reward(msg);
        if (w) {
          w.player.heal(99);
          w.player.refreshGear();
          w.player.refill();
          for (const m of payQuests(w.def.id, this.save)) this.ui.reward(m);
        }
        this.persist();
        this.refreshHud();
      },
      reward: (text) => this.ui.reward(text),
      warn: (text) => this.ui.warn(text),
      threat: (kind) => {
        const info = INTEL[kind];
        const icon = enemyIconUrl(kind === 'elite' ? 'brute' : kind, kind === 'elite');
        this.ui.threat(icon, info.name, info.tip, kind === 'elite' ? '#ffd166' : '#ff8a9a');
        audio.play('blip', 0.8);
      },
      progress: () => {
        const w = this.world;
        if (!w) return;
        for (const m of payQuests(w.def.id, this.save)) this.ui.reward(m);
        this.refreshHud();
        writeSave(this.save);
      },
      dashEmpty: () => {
        this.ui.dashEmpty();
        // The button shakes every time; LUX explains why only once.
        const seen = (this.save.hints ??= []);
        if (!seen.includes('dashEmpty')) {
          seen.push('dashEmpty');
          this.ui.toast('Out of dash energy! Checkpoints and violet energy cells fill it back up.', 'bolt');
        }
      },
    };
  }

  /** After a shop purchase (see game/shop.ts): heal for a new heart, put the gear on, and celebrate. */
  /** An outfit went on or came off (free): dress the heroes and keep it. */
  private dressed(ok: boolean) {
    if (!ok) return;
    this.world?.player.refreshGear();
    writeSave(this.save);
  }

  private bought(ok: boolean, heart = false) {
    if (!ok) return;
    if (heart) this.world?.player.heal(99);
    this.world?.player.refreshGear();
    this.world?.player.refill();
    audio.play('upgrade');
    haptic('success');
    writeSave(this.save);
  }

  private completeDeck() {
    const w = this.world;
    if (!w) return;
    const d = w.def;
    this.state = 'results';
    this.input.reset();
    this.ui.showControls(false);
    this.ui.showHud(false);
    audio.play('success');
    if (!this.save.completed.includes(d.id)) this.save.completed.push(d.id);
    // A chapter's last deck ends with its finale, never with an exit; the next deck is always in the same chapter
    // (in a chapter still being built, the next level may not exist yet: it's "coming soon").
    const ch = chapterOf(d.id);
    const after = LEVEL_ORDER[d.index] as DeckId | undefined;
    const nextId = isFinale(d.id) || !after || chapterOf(after) !== ch ? undefined : after;
    const soon = !nextId && !isFinale(d.id) ? (comingSoon(ch)[0] ?? null) : null;
    this.save.unlocked = Math.max(this.save.unlocked, Math.min(LEVEL_ORDER.length, d.index + 1));
    const best = this.save.bestTimes[d.id];
    if (!best || this.deckTime < best) this.save.bestTimes[d.id] = Math.round(this.deckTime);
    this.save.resume = nextId ? { deck: nextId, checkpoint: null, flags: [], taken: [], dead: [] } : null;
    writeSave(this.save);
    const m = Math.floor(this.deckTime / 60);
    const s = Math.floor(this.deckTime % 60);
    const colonistsHere = d.colonistIds?.length ?? 0;
    this.ui.results(
      {
        deck: d.name,
        time: `${m}:${String(s).padStart(2, '0')}`,
        bolts: cleanBolts(this.save.bolts - this.boltsAtStart),
        shards: d.shardIds.length ? `${d.shardIds.filter((x) => this.save.shards.includes(`${d.id}.${x}`)).length} / ${d.shardIds.length}` : '',
        colonists: colonistsHere ? `${d.colonistIds?.filter((c) => this.save.colonists.includes(`${d.id}.${c}`)).length} / ${colonistsHere}` : '',
        next: nextId ? LEVELS[nextId].name : null,
        planet: ch === 2,
        labels: lootLabels(ch),
        voyage: ch === 3,
        rows: w.vehicle?.stats(),
        soon,
      },
      () => {
        this.ui.close();
        if (ch === 3) void this.moonCinema((dir, m) => argoHop(dir, m, d.id, nextId ?? null)).then(() => (nextId ? this.startDeck(nextId, false, 'fly') : this.toTitle()));
        else if (!nextId) this.toTitle();
        else if (ch === 1) void this.cinema((dir, ship) => space.interlude(dir, ship, d.id, d.index)).then(() => this.startDeck(nextId, false, 'fly'));
        else void this.planetCinema((dir, p) => planet.hop(dir, p, d.id, nextId)).then(() => this.startDeck(nextId, false, 'fly'));
      },
    );
    this.askForReview(d.index);
  }

  /**
   * After decks 2, 4 and 6 (once each, see review.ts) the app asks Google Play for its review card. It only happens
   * on a still results screen, never from a button and never after a question, as Google's guidelines require.
   */
  private askForReview(deckIndex: number) {
    if (!inApp() || !takeReviewAsk(this.save, deckIndex)) return;
    writeSave(this.save);
    // Let the results panel land first; the card then appears on top of it.
    setTimeout(() => post({ type: 'review' }), 1000);
  }

  private ending(kind: EndingKind) {
    const finale = this.world?.def.id ?? (endingChapter(kind) === 1 ? 'bridge' : endingChapter(kind) === 2 ? 'volcano' : GAME_FINALE);
    const ch = endingChapter(kind);
    this.state = 'ending';
    this.input.reset();
    this.ui.showHud(false);
    if (!this.save.endings.includes(kind)) this.save.endings.push(kind);
    if (!this.save.completed.includes(finale)) this.save.completed.push(finale);
    // After a chapter's ending the next chapter opens: Continue on the title screen goes straight there.
    const next = nextChapterStart(finale);
    const nextCh = next ? chapterOf(next) : null;
    // Replaying a finale once the next chapter is under way must not throw away the place reached there.
    const midNext = !!nextCh && this.introSeen(nextCh) && !!this.save.resume && chapterOf(this.save.resume.deck) >= nextCh;
    if (next) {
      this.save.unlocked = Math.max(this.save.unlocked, LEVELS[next].index);
      if (!midNext) this.save.resume = { deck: next, checkpoint: null, flags: [], taken: [], dead: [] };
    } else this.save.resume = null;
    writeSave(this.save);
    audio.music('ending');
    const totals = chapterTotals(ch);
    const finds = inChapter(this.save.shards, ch);
    const all = plannedFinds(ch, totals.shards);
    const secret = kind === 'friends' || kind === 'redeemed' || kind === 'gardeners';
    const film =
      kind === 'saved' || kind === 'friends'
        ? this.cinema((d, ship) => space.ending(d, ship, kind))
        : ch === 2
          ? this.planetCinema((d, p) => planet.finale(d, p, kind))
          : this.moonCinema((d, m) => fleeceVoyage(d, m, kind)).then(() => this.planetCinema((d, p) => fleeceHome(d, p, kind)));
    // No stats screen: the film ends on an END OF CHAPTER card, then chapters 1 and 2 roll straight into the
    // next chapter's opening, and chapter 3 (the end of the game) into the end credits.
    void film.then(() => {
      this.state = 'ending';
      this.ui.chapterEnd(
        kind,
        ch,
        !secret && finds < all ? tr('{finds}: {n} / {total}. Find the rest for a secret ending!', { finds: lootLabels(ch).finds, n: finds, total: all }) : null,
        next && nextCh && !midNext ? nextCh : null,
        () => {
          if (ch === 3) this.ui.credits(creditsHtml(kind, this.save), () => this.toTitle());
          else if (nextCh && !midNext) this.startChapter(nextCh);
          else this.toTitle();
        },
      );
      this.askForReview(LEVELS[finale].index);
    });
  }

  /* ---------------- loop ---------------- */

  private frame(t: number) {
    requestAnimationFrame((n) => this.frame(n));
    this.step(t);
  }

  private step(t: number) {
    const raw = (t - this.last) / 1000;
    const dt = Math.min(0.05, Math.max(0, raw));
    this.last = t;
    if (this.state !== 'play') this.watch.reset();
    else if (this.save.settings.autoQuality && this.watch.sample(raw)) this.slowDown();
    this.frames += 1;
    this.fpsT += dt;
    if (this.fpsT >= 1) {
      if (!inApp() && location.hash.includes('fps')) this.ui.setFps(`${this.frames} fps`);
      this.frames = 0;
      this.fpsT = 0;
    }
    this.input.poll();
    this.trailer?.frame();
    if (this.state === 'cinema' && this.ship && this.director) {
      this.director.update(dt);
      this.ship.update(dt, this.director.rig);
      this.post.setStrength(0.4);
      this.draw(this.ship.scene, this.ship.camera);
      return;
    }
    const w = this.world;
    if (w && this.state === 'play' && this.queue.length) this.runCutscene();
    if (w && this.state === 'cutscene' && this.director) {
      const d = this.director;
      d.update(dt);
      w.update(dt * d.timeScale, this.input, 0);
    }
    if (w && (this.state === 'play' || this.state === 'cutscene' || this.state === 'dialogue' || this.state === 'hack' || this.state === 'shop' || this.state === 'pause' || this.state === 'down' || this.state === 'results')) {
      if (this.state === 'play') {
        this.deckTime += dt;
        this.save.playSeconds += dt;
        if (this.input.take('pause')) {
          this.pause();
        } else {
          w.update(dt, this.input, this.save.settings.camSpeed);
          const pl = w.player;
          if (w.vehicle) this.vehicleHud.update(w.vehicle.hud());
          else {
            // The Flamethrower shows its fuel gauge instead of a clip.
            this.ui.setAmmo(pl.ammo, pl.clipSize, pl.reloadProgress, pl.charge, pl.weapon === 'flame' ? pl.fuel : null, pl.tank.dry);
            if (pl.bren && pl.hero === 'brennus') this.ui.setHeat(pl.bren.heat, pl.bren.overheated);
            this.refreshStrength(w);
            this.refreshAbilities(w);
          }
          this.ui.setCountdown(w.countdown());
          // The tide gauge steps aside during a boss fight (the boss bar takes its place).
          this.ui.setTide(w.boss?.started && !w.boss.defeated ? null : (w.tide?.gauge() ?? null));
          this.ui.setArgo(argoBar(w));
          this.placeWaypoint(w);
          this.hudT -= dt;
          if (this.hudT <= 0) {
            this.hudT = 0.1;
            this.ui.setAction(w.focus?.label() ?? null);
          }
        }
      }
      this.post.setStrength(w.theme.bloom);
      this.draw(w.scene, w.camera);
      return;
    }
    this.title.update(dt, this.save.upgrades, this.save.wearing.jason);
    this.post.setStrength(0.2);
    this.draw(this.title.scene, this.title.camera);
  }

  private draw(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.trailer?.aim(camera);
    this.post.render(scene, camera);
  }

  /* ---------------- the trailer ---------------- */

  /** Hands the game over to the trailer's director, on a save of its own: everything open, graphics on High, silent. */
  private startTrailer(dev: URLSearchParams) {
    const save = newSave();
    save.abilities = ['doubleJump', 'dash', 'glide', 'pulse', 'grapple', 'mirror'];
    save.unlocked = LEVEL_ORDER.length;
    save.settings = { ...save.settings, quality: 'high', autoQuality: false, music: 0, sfx: 0, lang: dev.get('lang') === 'el' ? 'el' : 'en', langChosen: true };
    this.save = save;
    this.applySettings(save.settings);
    this.ui.close();
    const host = {
      input: this.input,
      save,
      deck: (set: DeckSet) => this.trailerDeck(set),
      stage: (kind: StageKind) => this.trailerStage(kind),
    };
    this.trailer = new Trailer(host as TrailerHost);
  }

  /** Clears whatever the last shot left: its level, or its stage. */
  private trailerClear() {
    this.disposeWorld();
    if (this.ship) disposeScene(this.ship.scene);
    this.ship = null;
    this.director = null;
    this.queue = [];
    this.input.reset();
  }

  /** A level, straight into play: no title card, no opening, and nothing in it ever stops to talk. */
  private trailerDeck(set: DeckSet): World {
    this.trailerClear();
    heroDev.heroes = set.heroes;
    heroDev.hero = set.hero;
    const hooks: WorldHooks = {
      ...this.hooks(),
      say: (_lines, then) => then?.(),
      hack: (_length, done) => done(true),
      shop: () => {},
      complete: () => {},
      checkpoint: () => {},
      collect: () => {},
      down: () => {},
      ending: () => {},
      prize: () => {},
      progress: () => {},
      cutscene: () => Promise.resolve(),
    };
    const w = new World(LEVELS[set.deck], this.save, hooks, this.save.settings.quality, null);
    w.scene.environment = this.envMap;
    w.resize(window.innerWidth, window.innerHeight);
    this.ui.voice = (who, toast) => w.voice(who, toast);
    this.renderer.compile(w.scene, w.camera);
    this.world = w;
    this.state = 'play';
    return w;
  }

  /** One of the cinematic stages, or the title screen's own scene. */
  private trailerStage(kind: StageKind): ShipScene | PlanetScene | MoonScene | TitleScene {
    this.trailerClear();
    if (kind === 'title') {
      this.state = 'title';
      return this.title;
    }
    const s = kind === 'ship' ? new ShipScene() : kind === 'planet' ? new PlanetScene() : new MoonScene();
    s.scene.environment = this.envMap;
    s.scene.environmentIntensity = kind === 'ship' ? 0.18 : kind === 'planet' ? 0.4 : 0.25;
    s.resize(window.innerWidth, window.innerHeight);
    this.director = new Director(this.ui, { pos: s.camera.position.clone(), look: new THREE.Vector3(), fov: 45 });
    this.ship = s;
    this.state = 'cinema';
    this.renderer.compile(s.scene, s.camera);
    return s;
  }
}
