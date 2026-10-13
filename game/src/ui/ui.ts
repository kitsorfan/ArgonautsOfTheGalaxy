import { audio } from '../core/audio';
import { CREATOR, GAME_NAME, SHIP, VERSION } from '../core/brand';
import { inApp, openLink } from '../core/bridge';
import { RELEASES } from '../game/releaseNotes';
import { LANGS, lang, tr, upper, type Lang } from '../core/i18n';
import { resolveAuto } from '../core/graphics';
import type { ButtonName, Input } from '../core/input';
import { cleanBolts, type AtalantaUpgradeId, type OutfitHero, type Quality, type SaveData, type Settings, type UpgradeId } from '../core/save';
import {
  PUZZLE_COLORS,
  PUZZLE_SHAPES,
  gridConflicts,
  gridPlan,
  gridPuzzle,
  gridSolved,
  lightsPlan,
  lightsPuzzle,
  patternPlan,
  patternRound,
  toggleLights,
  tokenKey,
  type PuzzleKind,
  type Token,
} from '../game/puzzles';
import type { DeckId, EndingKind, HeroId, Line, Speaker } from '../world/levelTypes';
import { HEROES } from '../entities/heroes/heroes';
import { emblemSvg } from './emblem';
import { WEAPONS, type Weapon, type WeaponId } from '../entities/weapons';
import { shopStock } from '../game/shop';
import type { OutfitId } from '../entities/outfits';
import { ATA_ICON, OUTFITS_ICON, outfitFigure } from './shopArt';
import { FittingRoom } from './fittingRoom';
import type { FindKind } from '../game/collectibles';
import type { Helper } from '../game/companions';
import type { TideGauge } from '../world/tides';
import { ICON, SPEAKER_COLOR, SPEAKER_NAME, WEAPON_ICON, WRIST_FACE, portrait } from './icons';
import { panelSvg, type PanelId } from './panels';
import { showPanel } from './cinePanel';

const $ = <T extends HTMLElement = HTMLElement>(root: ParentNode, sel: string) => root.querySelector(sel) as T;

/** A puzzle picture as SVG: a coloured shape, an arrow turned in quarter turns, or a little grid of dots. */
function tokenSvg(t: Token): string {
  const c = PUZZLE_COLORS[t.color];
  const paint = `fill="${c}" stroke="#fff" stroke-opacity=".6" stroke-width="2" stroke-linejoin="round"`;
  let body: string;
  switch (t.shape) {
    case 'circle':
      body = `<circle cx="20" cy="20" r="14" ${paint}/>`;
      break;
    case 'square':
      body = `<rect x="7" y="7" width="26" height="26" rx="4" ${paint}/>`;
      break;
    case 'triangle':
      body = `<polygon points="20,5 35,33 5,33" ${paint}/>`;
      break;
    case 'star':
      body = `<polygon points="20,3 24.9,14 36.5,15 27.6,22.7 30.3,34.5 20,28.3 9.7,34.5 12.4,22.7 3.5,15 15.1,14" ${paint}/>`;
      break;
    case 'arrow':
      body = `<path transform="rotate(${(t.rot ?? 0) * 90} 20 20)" d="M20 4 L34 19 H25.5 V36 H14.5 V19 H6 Z" ${paint}/>`;
      break;
    case 'dots': {
      const n = Math.min(9, t.n ?? 1);
      body = Array.from({ length: n }, (_, i) => `<circle cx="${8 + (i % 3) * 12}" cy="${8 + Math.floor(i / 3) * 12}" r="4.6" fill="${c}"/>`).join('');
      break;
    }
  }
  return `<svg viewBox="0 0 40 40">${body}</svg>`;
}

/** Colour `k` in the colour square, with its own shape so it reads without colour too. */
const gridToken = (k: number): Token => ({ color: k, shape: PUZZLE_SHAPES[k] });

function h(html: string): HTMLElement {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}

/** A label that follows the language setting (see `applyLang`). */
const label = (en: string, cls = '') => `<span${cls ? ` class="${cls}"` : ''} data-t="${en}">${tr(en)}</span>`;

/** A weapon's four stat bars (RANGE, POWER, SPEED, AMMO or FUEL), five segments each, in its colour. */
export function weaponStats(w: Weapon): string {
  const rows: [string, number][] = [
    [tr('RANGE'), w.bars.range],
    [tr('POWER'), w.bars.power],
    [tr('SPEED'), w.bars.speed],
    [w.id === 'flame' ? tr('FUEL') : tr('AMMO'), w.bars.ammo],
  ];
  const row = ([name, n]: [string, number]) => `<span class="wl">${name}</span><span class="wbar">${'<span class="on"></span>'.repeat(n)}${'<span></span>'.repeat(5 - n)}</span>`;
  return `<div class="wstats" style="--wc:${w.glow}">${rows.map(row).join('')}</div>`;
}

/** An icon shown only for one hero's buttons (`hj` Jason, `ha` Atalanta; see style.css). */
const only = (svg: string, cls: string) => svg.replace('<svg', `<svg class="${cls}"`);

/** The little Argo riding along the approach bar (Brennus's Last Stand): white hull, gold belly, blue sail. */
const ARGO_ICON = `<svg viewBox="0 0 40 24"><path d="M14 4h12v9H14z" fill="#5ab4ff" stroke="#1a1630" stroke-width="1.5"/><path d="M3 13h34q-2 6-8 7H9q-5-2-6-7z" fill="#fff" stroke="#1a1630" stroke-width="1.5"/><path d="M5 17h30" stroke="#ffd166" stroke-width="2.5"/><circle cx="37" cy="10" r="3" fill="#ffd166" stroke="#1a1630" stroke-width="1.2"/></svg>`;

/** The turn-the-camera buttons: an anticlockwise arrow around a dot (mirrored for the right one in style.css). */
const CAM_ICON = `<svg viewBox="0 0 24 24"><path d="M5 13a7 7 0 1 0 2.4-6.2" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><path d="M3.6 3.4l.6 5.2 5.1-1" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="13" r="2.2" fill="#fff"/></svg>`;

/** Each shop upgrade's icon. */
const UPGRADE_ICON: Partial<Record<UpgradeId, string>> = {
  heart: ICON.heart(true),
  blaster: ICON.shoot,
  clip: ICON.cell,
  rapid: ICON.dash,
  boltZap: ICON.star,
  magnet: ICON.bolt,
  armor: ICON.shield(true),
  dashCell: ICON.energy,
  spinCharge: `<svg viewBox="0 0 24 24"><path d="M12 4a8 8 0 1 1-7.4 5" fill="none" stroke="#ffd166" stroke-width="2.6" stroke-linecap="round"/><path d="M3 4l1.8 5.6L10 7.5" fill="none" stroke="#ffd166" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 9v6M9 12h6" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  grapple: ICON.grapple,
};

/** What the shop screen can ask the game to do. */
export interface ShopActions {
  buyUpgrade(id: UpgradeId): void;
  buyWeapon(id: WeaponId): void;
  equip(id: WeaponId): void;
  buyAtalanta(id: AtalantaUpgradeId): void;
  buyOutfit(id: OutfitId): void;
  wear(id: OutfitId): void;
  takeOff(hero: OutfitHero): void;
  close(): void;
}

/** The shop's tabs: upgrades always; weapons from Gaia Nova on; Atalanta's upgrades and outfits in chapter 3. */
export type ShopTab = 'upgrades' | 'weapons' | 'atalanta' | 'outfits';

export interface DeckInfo {
  index: number;
  id: string;
  name: string;
  color: string;
  shards: number;
  shardTotal: number;
  unlocked: boolean;
  completed: boolean;
  chapter: 1 | 2 | 3;
  /** Its number within the chapter (1-6, or 1-10 in chapter 3). */
  number: number;
  /** A level of a chapter still being built: shown by name, marked "coming soon", not playable. */
  soon?: boolean;
}

/** Everything the ability buttons show, refreshed every frame. */
export interface AbilityHud {
  spins: number;
  spinMax: number;
  /** 0..1 while the spins recharge. */
  spinReload: number;
  dash: boolean;
  energy: number;
  energyMax: number;
  pulse: boolean;
  /** 0..1, 1 = ready. */
  pulseCharge: number;
  pulseLeft: number;
  /** The equipped weapon, and how many Jason owns (the weapon button shows once he has two). */
  weapon: WeaponId;
  weapons: number;
  /** The playing hero (the buttons change with them), and who the switch button changes to (null: no switching here). */
  hero: HeroId;
  swapTo: HeroId | null;
  /** 0..1 while the switch cools down (1 = ready). */
  swapReady: number;
}

/** Where to draw the objective waypoint: screen position, whether it's pinned to the edge, and how far it is. */
export interface WaypointHud {
  x: number;
  y: number;
  edge: boolean;
  /** Direction of the edge arrow, in radians (0 = right, clockwise). */
  angle: number;
  dist: number;
}

export class UI {
  private hud: HTMLElement;
  private overlay: HTMLElement;
  private toastEl: HTMLElement;
  private toastT: ReturnType<typeof setTimeout> | null = null;
  private stickEl: HTMLElement;
  private stickUsed = false;
  private dashBtn: HTMLElement;
  private spinBtn: HTMLElement;
  private pulseBtn: HTMLElement;
  private wpEl: HTMLElement;
  private bossEl: HTMLElement;
  private countdownEl: HTMLElement;
  private countdownKey = '';
  private tideEl: HTMLElement;
  private tideKey = '';
  private argoEl: HTMLElement | null = null;
  private argoKey = '';
  private fpsEl: HTMLElement;
  private lastHearts = -1;
  private lastBolts = -1;
  onAction?: () => void;
  onPause?: () => void;
  private fadeEl: HTMLElement;
  private cine: HTMLElement;
  private skipBtn: HTMLElement;
  private onSkip: (() => void) | null = null;
  private onCineTap: (() => void) | null = null;
  private glitchT: ReturnType<typeof setTimeout> | null = null;
  private objectiveText = '';
  private bossName: string | null = null;

  constructor(
    private root: HTMLElement,
    private input: Input,
  ) {
    const ring = (cls: string) => `<svg class="${cls}" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" pathLength="100"/></svg>`;
    this.hud = h(`<div class="hidden">
      <div class="hud-left"><div class="hearts"></div><div class="strength hidden">${label('STRENGTH')}<div class="track"><i></i></div></div><div class="counter bolts">${ICON.bolt}<b>0</b></div></div>
      <div class="hud-top"><div class="objective hidden"></div><div class="countdown hidden">${ICON.clock}<b></b><span class="dots"></span></div><div class="tide hidden"><i class="tube"><i class="sea"></i></i><b></b></div><div class="argobar hidden"><div class="name"></div><div class="track"><div class="fill"></div><i class="ship">${ARGO_ICON}</i></div></div><div class="bossbar hidden"><div class="name"></div><div class="track"><div class="chunk"></div><div class="fill"></div><div class="marks"></div></div></div><div class="toast"><div class="portrait"></div><div class="t"></div></div></div>
      <div class="hud-right"><div class="shards"></div><div class="side-col"><div class="round-btn clickable pause">${ICON.pause}</div><div class="swap-slot"><div class="btn swap clickable hidden" data-b="swap"><i class="face"></i><i class="badge">${ICON.swap}</i>${ring('cd-ring')}</div></div></div></div>
      <div class="waypoint hidden"><i class="wp-arrow"></i><i class="wp-gem"></i><b></b></div>
      <div class="stick hidden"><div class="knob"></div></div>
      <div class="stick-hint">${label('MOVE')}</div>
      <div class="buttons" data-hero="jason">
        <div class="btn jump clickable" data-b="jump">${ICON.jump}${label('JUMP')}</div>
        <div class="btn shoot clickable" data-b="shoot">${only(ICON.shoot, 'hj')}${only(ICON.bow, 'ha')}${only(ICON.cannon, 'hb')}${only(WEAPON_ICON.flame, 'hm')}${label('BLAST', 'hj')}${label('BOW', 'ha')}${label('CANNON', 'hb')}${label('FLAME', 'hm')}${ring('charge-ring')}</div>
        <div class="ammo"><div class="pips"></div><div class="fuel"><i></i></div><div class="reload"><i></i></div></div>
        <div class="heat hb"><i></i></div>
        <div class="heat hm"><i></i></div>
        <div class="btn spin clickable" data-b="spin">${only(ICON.spin, 'hj')}${only(ICON.kick, 'ha')}${only(ICON.guard, 'hb')}${only(ICON.punch, 'hm')}${label('SPIN', 'hj')}${label('KICK', 'ha')}${label('SHIELD', 'hb')}${label('PUNCH', 'hm')}${ring('cd-ring')}<div class="charges"></div></div>
        <div class="btn dash clickable hidden" data-b="dash">${only(ICON.dash, 'hj')}${only(ICON.slide, 'ha')}${only(ICON.charge, 'hb')}${only(ICON.thrust, 'hm')}${label('DASH', 'hj')}${label('SLIDE', 'ha')}${label('CHARGE', 'hb')}${label('THRUST', 'hm')}<div class="charges"></div></div>
        <div class="btn pulse clickable hidden" data-b="action"><i class="face">${portrait('bolt')}</i>${ICON.pulse}${label('PULSE')}${ring('cd-ring')}<em></em><b class="act"></b></div>
        <div class="btn weapon clickable hidden" data-b="weapon"><i class="wicon"></i><div class="wname"><b></b></div></div>
        <div class="btn cam left clickable" data-b="camLeft">${CAM_ICON}</div>
        <div class="btn cam right clickable" data-b="camRight">${CAM_ICON}</div>
      </div>
      <div class="threat"><img alt=""/><div><div class="tag">${label('NEW ENEMY')}</div><b></b><p></p></div></div>
      <div class="fps"></div>
    </div>`);
    this.overlay = h(`<div class="overlay hidden"></div>`);
    this.fadeEl = h(`<div class="fade"></div>`);
    this.cine = h(`<div class="cine">
      <div class="tap"></div><div class="bar top"></div><div class="bar bottom"></div>
      <div class="storypanel"><div class="art"></div></div>
      <div class="caption"></div><div class="bosscard"></div><div class="glitch-fx"></div>
    </div>`);
    this.skipBtn = h(`<button class="skip clickable hidden">${label('SKIP')} ▶▶</button>`);
    // Order matters: fades under everything, cutscene bars under dialogue, and the skip button on top.
    root.append(this.fadeEl, this.hud, h(`<div class="warn-edge"></div>`), h(`<div class="warn-banner"></div>`), this.cine, this.overlay, this.skipBtn, h(`<div class="reward-banner"></div>`));
    this.skipBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onSkip?.();
    });
    $(this.cine, '.tap').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.onCineTap?.();
    });
    this.toastEl = $(this.hud, '.toast');
    this.stickEl = $(this.hud, '.stick');
    this.dashBtn = $(this.hud, '.btn.dash');
    this.spinBtn = $(this.hud, '.btn.spin');
    this.pulseBtn = $(this.hud, '.btn.pulse');
    this.wpEl = $(this.hud, '.waypoint');
    this.bossEl = $(this.hud, '.bossbar');
    this.countdownEl = $(this.hud, '.countdown');
    this.tideEl = $(this.hud, '.tide');
    this.fpsEl = $(this.hud, '.fps');

    for (const btn of this.hud.querySelectorAll<HTMLElement>('.btn')) {
      const name = btn.dataset.b as ButtonName;
      const down = (e: PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        btn.setPointerCapture?.(e.pointerId);
        btn.classList.add('down');
        this.input.press(name, true);
      };
      const up = (e: PointerEvent) => {
        e.preventDefault();
        btn.classList.remove('down');
        this.input.press(name, false);
      };
      btn.addEventListener('pointerdown', down);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('lostpointercapture', up);
    }
    $(this.hud, '.pause').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onPause?.();
    });
    input.onStick = (active, ox, oy, kx, ky) => {
      this.stickEl.classList.toggle('hidden', !active);
      // The MOVE hint only teaches the first touch: once the stick has been used it stays away.
      if (active) this.stickUsed = true;
      $(this.hud, '.stick-hint').classList.toggle('hidden', this.stickUsed);
      if (!active) return;
      this.stickEl.style.left = `${ox}px`;
      this.stickEl.style.top = `${oy}px`;
      $(this.stickEl, '.knob').style.transform = `translate(${kx}px, ${ky}px)`;
    };
  }

  /** Re-labels the HUD after the language changes (menus are rebuilt every time they open). */
  applyLang() {
    for (const el of this.root.querySelectorAll<HTMLElement>('[data-t]')) el.textContent = tr(el.dataset.t ?? '');
    this.setObjective(this.objectiveText);
    if (this.bossName) $(this.bossEl, '.name').textContent = tr(this.bossName);
    this.lastAbility = '';
    this.lastWeapon = '';
  }

  /* ---------------- HUD ---------------- */

  showHud(on: boolean) {
    this.hud.classList.toggle('hidden', !on);
  }

  showControls(on: boolean) {
    for (const sel of ['.buttons', '.swap-slot']) $(this.hud, sel).classList.toggle('hidden', !on);
    $(this.hud, '.stick-hint').classList.toggle('hidden', !on || this.stickUsed);
    if (!on) this.setWaypoint(null);
  }

  /** Hearts, then a blue shield for each Armor Plating point (dim once spent). */
  setHearts(n: number, max: number, armor = 0, armorMax = 0) {
    const el = $(this.hud, '.hearts');
    if (n < this.lastHearts) {
      el.classList.remove('shake');
      void el.offsetWidth;
      el.classList.add('shake');
    }
    this.lastHearts = n;
    const shields = Array.from({ length: armorMax }, (_, i) => `<i class="armor">${ICON.shield(i < armor)}</i>`).join('');
    el.classList.toggle('wide', max > 10);
    el.innerHTML = Array.from({ length: max }, (_, i) => ICON.heart(i < n)).join('') + shields;
  }

  private lastStrength = '';

  /**
   * The bronze mech's STRENGTH bar, in place of the hearts while the heroes ride it (`k` 0..1, or null
   * to show the hearts again). It shakes when it drops and blinks red when it is low.
   */
  setStrength(k: number | null) {
    const key = k === null ? '' : String(Math.round(k * 100));
    if (key === this.lastStrength) return;
    const el = $(this.hud, '.strength');
    const before = this.lastStrength === '' ? 101 : Number(this.lastStrength);
    this.lastStrength = key;
    el.classList.toggle('hidden', k === null);
    $(this.hud, '.hearts').classList.toggle('hidden', k !== null);
    if (k === null) return;
    if (Math.round(k * 100) < before - 1) {
      el.classList.remove('shake');
      void el.offsetWidth;
      el.classList.add('shake');
    }
    el.classList.toggle('low', k < 0.3);
    $<HTMLElement>(el, '.track i').style.width = `${Math.round(k * 100)}%`;
  }

  setBolts(count: number) {
    const n = cleanBolts(count);
    const el = $(this.hud, '.bolts');
    if (n !== this.lastBolts && this.lastBolts >= 0) {
      el.classList.remove('pop');
      void el.offsetWidth;
      el.classList.add('pop');
    }
    this.lastBolts = n;
    $(el, 'b').textContent = String(n);
  }

  /** Collectible icons for the deck (memory shards on the ship, journal pages on Gaia Nova, light-stones in chapter 3). */
  setShards(got: boolean[], kind: FindKind = 'shard') {
    const el = $(this.hud, '.shards');
    el.innerHTML = got.map((g) => (kind === 'page' ? ICON.page(g) : kind === 'stone' ? ICON.stone(g) : ICON.shard(g))).join('');
    el.classList.toggle('hidden', !got.length);
  }

  setObjective(text: string) {
    this.objectiveText = text;
    const el = $(this.hud, '.objective');
    el.textContent = tr(text);
    el.classList.toggle('hidden', !text);
  }

  private bossFrac = 1;
  private bossMarks = '';

  /**
   * The boss bar: the name, the health (a pale chunk trails each hit, and the bar flashes), and a notch
   * wherever the fight changes phase.
   */
  setBoss(name: string | null, frac: number, marks: number[] = []) {
    this.bossName = name;
    this.bossEl.classList.toggle('hidden', !name);
    if (!name) {
      this.bossFrac = 1;
      return;
    }
    const f = Math.max(0, Math.min(1, frac));
    $(this.bossEl, '.name').textContent = tr(name);
    $(this.bossEl, '.fill').style.width = `${f * 100}%`;
    $(this.bossEl, '.chunk').style.width = `${f * 100}%`;
    this.bossEl.classList.toggle('low', f <= 0.25);
    if (f < this.bossFrac - 1e-4) {
      const track = $(this.bossEl, '.track');
      track.classList.remove('hit');
      void track.offsetWidth;
      track.classList.add('hit');
    }
    this.bossFrac = f;
    const key = marks.join(',');
    if (key !== this.bossMarks) {
      this.bossMarks = key;
      $(this.bossEl, '.marks').innerHTML = marks.map((m) => `<i style="left:${(m * 100).toFixed(1)}%"></i>`).join('');
    }
  }

  /** The tide gauge (Scylla's Reef): how high the sea is, what it's doing next, and when. */
  setTide(g: TideGauge | null) {
    const label = !g
      ? ''
      : g.warn || g.phase === 'rising'
        ? tr('TIDE COMING IN!')
        : g.phase === 'low'
          ? tr('LOW TIDE · {n}', { n: g.secs })
          : g.phase === 'high'
            ? tr('HIGH TIDE · {n}', { n: g.secs })
            : tr('TIDE GOING OUT');
    const key = g ? `${label}|${Math.round(g.fill * 20)}|${g.warn}` : '';
    if (key === this.tideKey) return;
    this.tideKey = key;
    this.tideEl.classList.toggle('hidden', !g);
    if (!g) return;
    $(this.tideEl, 'b').textContent = label;
    $(this.tideEl, '.sea').style.height = `${Math.round(8 + g.fill * 92)}%`;
    this.tideEl.classList.toggle('warn', g.warn || g.phase === 'rising');
    this.tideEl.classList.toggle('high', g.phase === 'high');
  }

  /**
   * Brennus's Last Stand: how close the Argo is (0..1), with a warning while Aeëtes's robots crowd the
   * line and slow it down. Null hides the bar.
   */
  setArgo(a: { frac: number; slowed: boolean } | null) {
    const key = a ? `${Math.round(a.frac * 200)}|${a.slowed}` : '';
    if (key === this.argoKey) return;
    this.argoKey = key;
    this.argoEl ??= $(this.hud, '.argobar');
    this.argoEl.classList.toggle('hidden', !a);
    if (!a) return;
    const pct = `${Math.max(0, Math.min(1, a.frac)) * 100}%`;
    this.argoEl.classList.toggle('slowed', a.slowed);
    $(this.argoEl, '.name').textContent = a.slowed ? tr('CLEAR THE LINE! THE ARGO IS SLOWING DOWN') : tr('THE ARGO IS COMING');
    $(this.argoEl, '.fill').style.width = pct;
    $(this.argoEl, '.ship').style.left = pct;
  }

  /** The clock for timed switches: whole seconds left, and a dot for each switch, lit once it's down. */
  setCountdown(c: { left: number; down: number; total: number } | null) {
    const secs = c ? Math.ceil(c.left) : 0;
    const key = c ? `${secs}|${c.down}|${c.total}` : '';
    if (key === this.countdownKey) return;
    this.countdownKey = key;
    this.countdownEl.classList.toggle('hidden', !c);
    if (!c) return;
    $(this.countdownEl, 'b').textContent = String(secs);
    this.countdownEl.classList.toggle('urgent', secs <= 5);
    $(this.countdownEl, '.dots').innerHTML = c.total > 1 ? Array.from({ length: c.total }, (_, i) => `<i class="${i < c.down ? 'on' : ''}"></i>`).join('') : '';
  }

  /**
   * Who really speaks a line written for a speaker (LUX's lines go to IRIS, HALCYON or Jason while
   * LUX is away). The game sets it for each deck; `toast` is true for the little pop-up messages.
   */
  voice: (who: Speaker, toast: boolean) => Speaker = (who) => who;
  private helperNow: Helper | null = 'lux';

  /** The title on the terminal puzzle panel: whoever is doing the hacking. */
  private hackTitle() {
    return this.helperNow === 'iris' ? tr('IRIS HACK') : this.helperNow === 'wrist' ? tr('WRIST HACK') : tr('LUX HACK');
  }

  /** The LUX button wears the helper's face (LUX, IRIS or Jason's wrist computer) while it uses something, and so does the hacking panel. */
  setHelper(who: Helper | null) {
    $(this.pulseBtn, '.face').innerHTML = who === 'wrist' ? WRIST_FACE : portrait(who === 'iris' ? 'iris' : 'bolt');
    this.helperNow = who;
  }

  private actionText: string | null = null;
  private pulseOn = false;

  /**
   * Something the helper can use is in reach (terminals, pylons, the shop, lifts, grapple rings): the LUX
   * button turns into its USE button, showing the helper's face and what it does. Otherwise it's the force pulse.
   */
  setAction(text: string | null) {
    if (text === this.actionText) return;
    this.actionText = text;
    if (text) $(this.pulseBtn, '.act').textContent = tr(text);
    this.drawLuxButton();
  }

  private drawLuxButton() {
    const use = !!this.actionText;
    this.pulseBtn.classList.toggle('use', use);
    this.pulseBtn.classList.toggle('hidden', !use && !this.pulseOn);
  }

  private lastAbility = '';
  private lastWeapon = '';

  /** The weapon button: the equipped weapon's icon, and its name popping up for a moment after a switch (the stats live in the shop). */
  private setWeapon(id: WeaponId, owned: number) {
    const btn = $(this.hud, '.btn.weapon');
    btn.classList.toggle('hidden', owned < 2);
    $(this.hud, '.buttons').dataset.weapon = id;
    if (id === this.lastWeapon) return;
    const first = this.lastWeapon === '';
    this.lastWeapon = id;
    $(btn, '.wicon').innerHTML = WEAPON_ICON[id];
    const name = $(btn, '.wname');
    $(name, 'b').textContent = tr(WEAPONS[id].name);
    name.style.setProperty('--wc', WEAPONS[id].glow);
    if (first || owned < 2) return;
    name.classList.remove('show');
    void name.offsetWidth;
    name.classList.add('show');
  }

  /** Spin charges, dash energy, LUX's force pulse and the weapon on their buttons. */
  setAbilities(a: AbilityHud) {
    const key = `${a.hero}|${a.swapTo}|${Math.round(a.swapReady * 20)}|${a.spins}|${a.spinMax}|${Math.round(a.spinReload * 30)}|${a.dash}|${a.energy}|${a.energyMax}|${a.pulse}|${Math.round(a.pulseCharge * 40)}|${Math.ceil(a.pulseLeft)}|${a.weapon}|${a.weapons}`;
    if (key === this.lastAbility) return;
    this.lastAbility = key;
    const jason = a.hero === 'jason';
    this.setWeapon(a.weapon, jason ? a.weapons : 0);
    this.setSwap(a.hero, a.swapTo, a.swapReady);
    const pips = (el: HTMLElement, n: number, max: number) => {
      const box = $(el, '.charges');
      if (box.childElementCount !== max) box.innerHTML = '<i></i>'.repeat(max);
      box.querySelectorAll('i').forEach((p, i) => p.classList.toggle('full', i < n));
    };
    const fill = (el: HTMLElement, k: number) => {
      const c = el.querySelector<SVGCircleElement>('.cd-ring circle');
      if (c) c.style.strokeDashoffset = String(100 - k * 100);
    };
    pips(this.spinBtn, a.spins, a.spinMax);
    this.spinBtn.classList.toggle('empty', a.spins === 0);
    this.spinBtn.classList.toggle('recharging', a.spinReload > 0);
    fill(this.spinBtn, a.spinReload);
    // Atalanta's slide (on the DASH button) needs no energy cells.
    this.dashBtn.classList.toggle('hidden', !a.dash && jason);
    if (a.dash && jason) {
      pips(this.dashBtn, a.energy, a.energyMax);
      this.dashBtn.classList.toggle('empty', a.energy === 0);
    }
    this.pulseOn = a.pulse;
    this.drawLuxButton();
    if (a.pulse) {
      const ready = a.pulseCharge >= 1;
      this.pulseBtn.classList.toggle('ready', ready);
      this.pulseBtn.classList.toggle('empty', !ready);
      fill(this.pulseBtn, a.pulseCharge);
      $(this.pulseBtn, 'em').textContent = ready ? '' : String(Math.ceil(a.pulseLeft));
    }
  }

  private lastSwap = '';

  /** The switch-hero button: the face of the hero it switches to, and a ring while it cools down. */
  private setSwap(hero: HeroId, to: HeroId | null, ready: number) {
    const btn = $(this.hud, '.btn.swap');
    const buttons = $(this.hud, '.buttons');
    buttons.dataset.hero = hero;
    btn.classList.toggle('hidden', !to);
    if (!to) return;
    btn.classList.toggle('empty', ready < 1);
    const c = btn.querySelector<SVGCircleElement>('.cd-ring circle');
    if (c) c.style.strokeDashoffset = String(100 - ready * 100);
    if (to === this.lastSwap) return;
    this.lastSwap = to;
    $(btn, '.face').innerHTML = portrait(HEROES[to].speaker);
    btn.style.setProperty('--hero', HEROES[to].color);
    btn.setAttribute('aria-label', tr(SPEAKER_NAME[HEROES[to].speaker]));
  }

  /** Shakes the DASH button when Jason tries to dash on an empty tank. */
  dashEmpty() {
    this.dashBtn.classList.remove('nope');
    void this.dashBtn.offsetWidth;
    this.dashBtn.classList.add('nope');
  }

  /** The gold objective marker: over the target, or pinned to the screen edge pointing at it. */
  setWaypoint(w: WaypointHud | null) {
    this.wpEl.classList.toggle('hidden', !w);
    if (!w) return;
    this.wpEl.style.transform = `translate(${Math.round(w.x)}px, ${Math.round(w.y)}px)`;
    this.wpEl.classList.toggle('edge', w.edge);
    $(this.wpEl, '.wp-arrow').style.transform = `rotate(${w.angle}rad)`;
    $(this.wpEl, 'b').textContent = `${Math.round(w.dist)} m`;
  }

  private rewardQueue: string[] = [];
  private rewardBusy = false;

  /** A pulsing green warning with the screen's edges glowing (MEDUSA is about to glare); null hides it. */
  warn(text: string | null) {
    if (text) $(this.root, '.warn-banner').textContent = `👁 ${tr(text)}`;
    this.root.classList.toggle('warning', !!text);
  }

  /** A gold banner across the top of the screen for rewards. Several in a row queue up. */
  reward(text: string) {
    this.rewardQueue.push(tr(text));
    if (!this.rewardBusy) this.nextReward();
  }

  private nextReward() {
    const el = $(this.root, '.reward-banner');
    const text = this.rewardQueue.shift();
    if (!text) {
      this.rewardBusy = false;
      el.classList.remove('show');
      return;
    }
    this.rewardBusy = true;
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    audio.play('bolt', 1.2);
    setTimeout(() => this.nextReward(), 2600);
  }

  private lastAmmo = '';

  /**
   * Ammo pips above BLAST (in the weapon's colour), the reload bar, and the fireball charge ring. The
   * Flamethrower shows a fuel gauge instead (`fuel` 0..1), blinking red while the tank is dry.
   */
  setAmmo(ammo: number, clip: number, reload: number, charge: number, fuel: number | null = null, dry = false) {
    const key = `${ammo}|${clip}|${Math.round(reload * 20)}|${Math.round(charge * 20)}|${fuel === null ? '' : Math.round(fuel * 60)}|${dry}`;
    if (key === this.lastAmmo) return;
    this.lastAmmo = key;
    const box = $(this.hud, '.ammo');
    box.classList.toggle('tank', fuel !== null);
    box.classList.toggle('dry', fuel !== null && dry);
    if (fuel !== null) {
      $<HTMLElement>(box, '.fuel i').style.width = `${Math.round(fuel * 100)}%`;
      box.classList.remove('reloading');
      return;
    }
    const pips = $(box, '.pips');
    if (pips.childElementCount !== clip) pips.innerHTML = '<i></i>'.repeat(clip);
    pips.classList.toggle('many', clip > 10);
    pips.classList.toggle('lots', clip > 16);
    pips.querySelectorAll('i').forEach((el, i) => el.classList.toggle('full', i < ammo));
    box.classList.toggle('reloading', reload > 0);
    $<HTMLElement>(box, '.reload i').style.width = `${Math.round(reload * 100)}%`;
    const ring = this.hud.querySelector<SVGCircleElement>('.charge-ring circle');
    if (ring) {
      ring.style.strokeDashoffset = String(100 - charge * 100);
      ring.classList.toggle('full', charge >= 1);
    }
  }

  private lastHeat = '';

  /**
   * General Brennus's cannon heat (`hb`), or the bronze mech's flamethrower heat (`hm`): a thermometer
   * beside BLAST that blinks red while it cools down after overheating.
   */
  setHeat(heat: number, over: boolean, who: 'hb' | 'hm' = 'hb') {
    const key = `${who}|${Math.round(heat * 30)}|${over}`;
    if (key === this.lastHeat) return;
    this.lastHeat = key;
    const bar = $(this.hud, `.heat.${who}`);
    bar.classList.toggle('over', over);
    $<HTMLElement>(bar, 'i').style.height = `${Math.round(heat * 100)}%`;
  }

  private threatQueue: [string, string, string, string][] = [];
  private threatBusy = false;

  /** A small card about an enemy the first time Jason meets one (one card at a time, out of the way). */
  threat(icon: string, name: string, tip: string, color: string) {
    this.threatQueue.push([icon, name, tip, color]);
    if (!this.threatBusy) this.nextThreat();
  }

  private nextThreat() {
    const next = this.threatQueue.shift();
    const el = $(this.hud, '.threat');
    if (!next) {
      this.threatBusy = false;
      return;
    }
    this.threatBusy = true;
    const [icon, name, tip, color] = next;
    $<HTMLImageElement>(el, 'img').src = icon;
    $(el, 'b').textContent = tr(name);
    $(el, 'b').style.color = color;
    $(el, 'p').textContent = tr(tip);
    el.classList.add('show');
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => this.nextThreat(), 500);
    }, 3600);
  }

  setFps(text: string) {
    this.fpsEl.textContent = text;
  }

  toast(text: string, speaker: Speaker = 'bolt') {
    const who = this.voice(speaker, true);
    const t = tr(text);
    // On foot it sits under the objective; in a vehicle the top belongs to the course bar, so it goes low.
    const low = !!this.hud.querySelector('.buttons.vehicle');
    const home = low ? this.hud : $(this.hud, '.hud-top');
    if (this.toastEl.parentElement !== home) home.append(this.toastEl);
    this.toastEl.classList.toggle('low', low);
    $(this.toastEl, '.portrait').innerHTML = portrait(who);
    $(this.toastEl, '.t').textContent = t;
    this.toastEl.classList.remove('out');
    this.toastEl.classList.add('show');
    if (this.toastT) clearTimeout(this.toastT);
    // A quick read, never a wall of text: it sits under the objective and fades after a few seconds.
    this.toastT = setTimeout(
      () => {
        this.toastEl.classList.add('out');
        this.toastT = setTimeout(() => this.toastEl.classList.remove('show', 'out'), 250);
      },
      Math.min(5200, 1600 + t.length * 30),
    );
  }

  /* ---------------- overlays ---------------- */

  /** Swaps in a fresh overlay element so listeners and inline styles never leak between screens. */
  private fresh(className: string): HTMLElement {
    const el = document.createElement('div');
    el.className = className;
    this.overlay.replaceWith(el);
    this.overlay = el;
    return el;
  }

  private open(html: string, dim = true): HTMLElement {
    const el = this.fresh(`overlay clickable${dim ? ' dim' : ''}`);
    el.innerHTML = html;
    return el;
  }

  close() {
    this.fresh('overlay hidden');
  }

  private button(el: HTMLElement, sel: string, fn: () => void) {
    const b = el.querySelector<HTMLElement>(sel);
    b?.addEventListener('click', (e) => {
      e.stopPropagation();
      audio.play('select');
      fn();
    });
  }

  /**
   * Shows lines one at a time; tap to advance. `onLine` hears each line as it comes up (so a scene can
   * animate whoever is speaking). Returns a function that closes it early.
   */
  dialogue(lines: Line[], done: () => void, onLine?: (line: Line) => void): () => void {
    if (!lines.length) {
      done();
      return () => {};
    }
    let i = 0;
    let shown = 0;
    let text = '';
    let finished = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const el = this.open(`<div class="dialogue"><div class="portrait"></div><div style="flex:1"><div class="who"></div><div class="text"></div></div><div class="more">${tr('TAP')} ▶</div></div>`, false);
    el.style.alignItems = 'flex-end';
    const box = $(el, '.dialogue');
    const render = () => {
      const line = lines[i];
      onLine?.(line);
      const speaker = this.voice(line.who, false);
      text = tr(line.text);
      $(el, '.portrait').innerHTML = portrait(speaker);
      const who = $(el, '.who');
      who.textContent = tr(line.name ?? SPEAKER_NAME[speaker]);
      who.style.color = SPEAKER_COLOR[speaker];
      box.classList.toggle('glitchy', speaker === 'glitch' || speaker === 'rogue');
      shown = 0;
      // Clear the last line at once, so it never shows next to the new speaker's face.
      $(el, '.text').textContent = '';
      if (timer) clearInterval(timer);
      timer = setInterval(() => {
        shown = Math.min(text.length, shown + 2);
        $(el, '.text').textContent = text.slice(0, shown);
        if (shown % 6 === 0) audio.play('blip', speaker === 'bolt' || speaker === 'rogue' ? 1.4 : speaker === 'iris' ? 1.6 : speaker === 'halcyon' || speaker === 'glitch' ? 0.7 : 1);
        if (shown >= text.length && timer) {
          clearInterval(timer);
          timer = null;
        }
      }, 28);
    };
    const finish = () => {
      if (finished) return;
      finished = true;
      if (timer) clearInterval(timer);
      window.removeEventListener('keydown', onKey);
      this.close();
      done();
    };
    const advance = () => {
      if (shown < text.length) {
        shown = text.length;
        $(el, '.text').textContent = text;
        if (timer) clearInterval(timer);
        timer = null;
        return;
      }
      i += 1;
      if (i >= lines.length) finish();
      else render();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE' || e.code === 'KeyJ') advance();
    };
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      advance();
    });
    window.addEventListener('keydown', onKey);
    render();
    return finish;
  }

  /* ---------------- cinematics ---------------- */

  /** Letterbox bars and a skip button while a cutscene plays. Taps elsewhere hurry captions along. */
  cinema(on: boolean, onSkip?: () => void, onTap?: () => void) {
    this.cine.classList.toggle('on', on);
    this.skipBtn.classList.toggle('hidden', !on);
    this.onSkip = on ? (onSkip ?? null) : null;
    this.onCineTap = on ? (onTap ?? null) : null;
    if (!on) {
      this.caption(null);
      this.storyPanel(null);
      this.cine.classList.remove('glitching');
    }
  }

  private panelCount = 0;
  private panelMoves: Animation[] = [];

  /**
   * Shows a storybook illustration full-screen over the cutscene (null fades it out). The camera drifts
   * slowly across it (alternating direction from panel to panel) and its parallax layers drift at
   * their own speeds; captions and dialogue sit over a soft dark gradient at the bottom.
   */
  storyPanel(id: PanelId | null) {
    const el = $(this.cine, '.storypanel');
    this.cine.classList.toggle('paneled', !!id);
    if (!id) {
      el.classList.remove('show');
      return;
    }
    for (const a of this.panelMoves) a.cancel();
    this.panelCount += 1;
    this.panelMoves = showPanel($(el, '.art'), panelSvg(id), this.panelCount);
    el.classList.add('show');
  }

  caption(text: string | null) {
    const el = $(this.cine, '.caption');
    if (text) el.innerHTML = tr(text);
    el.classList.toggle('show', !!text);
  }

  bossCard(name: string, sub: string, color: string) {
    const el = $(this.cine, '.bosscard');
    el.innerHTML = `<div class="name" style="color:${color}">${tr(name)}</div><div class="sub">${tr(sub)}</div>`;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  /** Fades the whole screen to (or from) a colour. The fade layer sits under captions and dialogue. */
  fade(color: string, to: number, seconds: number) {
    this.fadeEl.style.transition = `opacity ${seconds}s linear`;
    this.fadeEl.style.background = color;
    this.fadeEl.style.opacity = String(to);
  }

  glitch(seconds: number) {
    this.cine.classList.add('glitching');
    if (this.glitchT) clearTimeout(this.glitchT);
    this.glitchT = setTimeout(() => this.cine.classList.remove('glitching'), seconds * 1000);
  }

  /** Scrolling end credits; tap (after a moment) to finish early. */
  credits(html: string, done: () => void) {
    const el = this.open(`<div class="credits"><div class="roll">${html}</div></div>`);
    const roll = $(el, '.roll');
    let over = false;
    const finish = () => {
      if (over) return;
      over = true;
      done();
    };
    roll.addEventListener('animationend', finish);
    const start = performance.now();
    el.addEventListener('pointerdown', () => {
      if (performance.now() - start > 1500) finish();
    });
  }

  /**
   * A terminal puzzle (LUX HACK). `memory` is the Simon-says light pattern; `pattern`, `lights` and
   * `grid` are the logic puzzles in `game/puzzles.ts`. `length` sets how hard it is.
   */
  hack(length: number, done: (ok: boolean) => void, kind: PuzzleKind = 'memory') {
    if (kind === 'pattern') return this.patternHack(length, done);
    if (kind === 'lights') return this.lightsHack(length, done);
    if (kind === 'grid') return this.gridHack(length, done);
    this.memoryHack(length, done);
  }

  /** The panel the logic puzzles share: instructions (already translated), the puzzle, progress dots, and the buttons. */
  private puzzlePanel(intro: string, body: string, dots: number, done: (ok: boolean) => void, extra = '') {
    const el = this.open(`<div class="panel hack">
      <h2>${this.hackTitle()}</h2>
      <div class="msg small">${intro}</div>
      ${body}
      <div class="dots">${'<i></i>'.repeat(dots)}</div>
      <div class="hack-actions">${extra}<button class="menu-btn danger giveup">${tr('Give up')}</button></div>
    </div>`);
    const msg = $(el, '.msg');
    let finished = false;
    const end = (ok: boolean) => {
      if (finished) return;
      finished = true;
      if (ok) {
        msg.textContent = tr('Hacked!');
        audio.play('success');
      }
      setTimeout(
        () => {
          this.close();
          done(ok);
        },
        ok ? 800 : 0,
      );
    };
    this.button(el, '.giveup', () => end(false));
    return { el, msg, end, dots: [...el.querySelectorAll<HTMLElement>('.dots i')], over: () => finished };
  }

  /** "What comes next?": find the rule in a row of pictures and pick the missing one, a few rounds in a row. */
  private patternHack(length: number, done: (ok: boolean) => void) {
    const plan = patternPlan(length);
    const intro = tr('What comes next? Find the rule, then pick the missing picture.');
    const p = this.puzzlePanel(intro, '<div class="pattern-row"></div><div class="pattern-choices"></div>', plan.length, done);
    const row = $(p.el, '.pattern-row');
    const choices = $(p.el, '.pattern-choices');
    let round = 0;
    const deal = () => {
      if (p.over()) return;
      const r = patternRound(plan[round]);
      let busy = false;
      p.msg.textContent = intro;
      row.innerHTML = r.shown.map((t) => `<div class="tok">${tokenSvg(t)}</div>`).join('') + '<div class="tok ask">?</div>';
      choices.innerHTML = r.choices.map((t, i) => `<div class="tok pick" data-i="${i}">${tokenSvg(t)}</div>`).join('');
      choices.querySelectorAll<HTMLElement>('.pick').forEach((b) =>
        b.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          if (busy || p.over()) return;
          busy = true;
          const t = r.choices[Number(b.dataset.i)];
          if (tokenKey(t) !== tokenKey(r.answer)) {
            b.classList.add('wrong');
            audio.play('fail');
            p.msg.textContent = tr('Not quite! Here is a new one...');
            setTimeout(deal, 1100);
            return;
          }
          b.classList.add('right');
          const ask = $(row, '.ask');
          ask.innerHTML = tokenSvg(t);
          ask.classList.add('right');
          audio.play(`tone${round % 4}` as 'tone0');
          p.dots[round].classList.add('on');
          round += 1;
          if (round >= plan.length) p.end(true);
          else setTimeout(deal, 750);
        }),
      );
    };
    deal();
  }

  /** Power grid: each tap flips a tile and its neighbours; light up the whole grid. */
  private lightsHack(length: number, done: (ok: boolean) => void) {
    const { size, taps } = lightsPlan(length);
    const start = lightsPuzzle(size, taps);
    let on = start;
    const p = this.puzzlePanel(
      tr('Reroute the power! Tapping a tile flips it and the tiles next to it. Light up every tile.'),
      `<div class="lights" style="--n:${size}">${'<i></i>'.repeat(size * size)}</div><div class="hint">${tr('It can be done in {n} taps.', { n: taps })}</div>`,
      0,
      done,
      `<button class="menu-btn reset">${tr('Start over')}</button>`,
    );
    const tiles = [...p.el.querySelectorAll<HTMLElement>('.lights i')];
    const draw = () => tiles.forEach((t, i) => t.classList.toggle('on', on[i]));
    tiles.forEach((t, i) =>
      t.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        if (p.over()) return;
        on = toggleLights(on, size, i);
        audio.play('blip', 1.2 + (i % size) * 0.15);
        draw();
        if (on.every(Boolean)) p.end(true);
      }),
    );
    this.button(p.el, '.reset', () => {
      if (p.over()) return;
      on = start;
      draw();
    });
    draw();
  }

  /** Colour square: fill the gaps so every row and column has each colour exactly once. */
  private gridHack(length: number, done: (ok: boolean) => void) {
    const { size, holes } = gridPlan(length);
    const puzzle = gridPuzzle(size, holes);
    const cells = [...puzzle.cells];
    const p = this.puzzlePanel(
      tr('Fill the gaps so every row and every column has one of each colour. Tap a gap to change its colour.'),
      `<div class="cgrid" style="--n:${size}">${cells.map((_, i) => `<i class="${puzzle.given[i] ? 'given' : 'gap'}"></i>`).join('')}</div>`,
      0,
      done,
    );
    const els = [...p.el.querySelectorAll<HTMLElement>('.cgrid i')];
    const draw = () => {
      const bad = gridConflicts(cells, size);
      els.forEach((el, i) => {
        const v = cells[i];
        el.innerHTML = v === null ? '' : tokenSvg(gridToken(v));
        el.classList.toggle('bad', bad.has(i));
      });
    };
    els.forEach((el, i) => {
      if (puzzle.given[i]) return;
      el.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        if (p.over()) return;
        const v = cells[i];
        cells[i] = v === null ? 0 : v + 1 < size ? v + 1 : null;
        const now = cells[i];
        if (now === null) audio.play('blip');
        else audio.play(`tone${now}` as 'tone0');
        draw();
        if (gridSolved(cells, size)) p.end(true);
        else if (cells.every((c) => c !== null)) p.msg.textContent = tr('Almost! The red tiles share a colour with their row or column.');
      });
    });
    draw();
  }

  /** Simon-says light puzzle: watch LUX's pattern, then repeat it. */
  private memoryHack(length: number, done: (ok: boolean) => void) {
    const el = this.open(`<div class="panel hack">
      <h2>${this.hackTitle()}</h2>
      <div class="msg">${tr('Watch the lights...')}</div>
      <div class="pads"><div class="pad"></div><div class="pad"></div><div class="pad"></div><div class="pad"></div></div>
      <div class="dots">${'<i></i>'.repeat(length)}</div>
      <button class="menu-btn danger giveup" style="width:auto;padding:8px 16px;font-size:15px">${tr('Give up')}</button>
    </div>`);
    const pads = [...el.querySelectorAll<HTMLElement>('.pad')];
    const dots = [...el.querySelectorAll<HTMLElement>('.dots i')];
    const msg = $(el, '.msg');
    const seq = Array.from({ length }, () => Math.floor(Math.random() * 4));
    for (let k = 1; k < seq.length; k++) if (seq[k] === seq[k - 1] && Math.random() < 0.6) seq[k] = (seq[k] + 1 + Math.floor(Math.random() * 3)) % 4;
    let pos = 0;
    let listening = false;
    let finished = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const flash = (i: number, ms = 360) => {
      pads[i].classList.add('lit');
      audio.play(`tone${i}` as 'tone0');
      timers.push(setTimeout(() => pads[i].classList.remove('lit'), ms));
    };
    const show = () => {
      listening = false;
      pos = 0;
      dots.forEach((d) => d.classList.remove('on'));
      msg.textContent = tr('Watch the lights...');
      seq.forEach((p, k) => timers.push(setTimeout(() => flash(p), 700 + k * 560)));
      timers.push(
        setTimeout(() => {
          listening = true;
          msg.textContent = tr('Your turn! Repeat the pattern.');
        }, 700 + seq.length * 560),
      );
    };
    const end = (ok: boolean) => {
      if (finished) return;
      finished = true;
      timers.forEach(clearTimeout);
      window.removeEventListener('keydown', onKey);
      timers.push(
        setTimeout(
          () => {
            this.close();
            done(ok);
          },
          ok ? 700 : 0,
        ),
      );
    };
    const tap = (i: number) => {
      if (!listening || finished) return;
      flash(i, 220);
      if (seq[pos] === i) {
        dots[pos].classList.add('on');
        pos += 1;
        if (pos >= seq.length) {
          listening = false;
          msg.textContent = tr('Hacked!');
          audio.play('success');
          end(true);
        }
      } else {
        listening = false;
        msg.textContent = tr('Oops! Watch again...');
        audio.play('fail');
        timers.push(setTimeout(show, 900));
      }
    };
    pads.forEach((p, i) =>
      p.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        tap(i);
      }),
    );
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, number> = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, KeyW: 0, KeyD: 1, KeyS: 2, KeyA: 3 };
      if (map[e.code] !== undefined) tap(map[e.code]);
    };
    window.addEventListener('keydown', onKey);
    this.button(el, '.giveup', () => end(false));
    show();
  }

  title(opts: { canContinue: boolean; continueText: string; hasDecks: boolean; onContinue: () => void; onNew: () => void; onDecks: () => void; onSettings: () => void }) {
    // With a save to lose, New Game moves out of the way to a small corner button, so a stray tap in
    // the middle of the screen lands on Continue instead.
    const el = this.open(`<div class="overlay title-screen" style="position:absolute">
      <div class="title-logo"><div class="name logo">${upper(tr(GAME_NAME))}</div><div class="tag">${tr('Three chapters. Three heroes. One very nervous robot.')}</div></div>
      <div class="title-menu">
        ${opts.canContinue ? `<button class="menu-btn primary cont">▶ ${tr('Continue')} <small>${tr(opts.continueText)}</small></button>` : `<button class="menu-btn primary new">▶ ${tr('New Game')}</button>`}
        ${opts.hasDecks ? `<button class="menu-btn decks">${tr('Replay a level')}</button>` : ''}
        <button class="menu-btn settings">${tr('Settings')}</button>
      </div>
      ${opts.canContinue ? `<button class="menu-btn title-new new">${tr('New Game')}</button>` : ''}
    </div>`, false);
    el.style.padding = '0';
    // The tap that opened this screen (or a quick second one) must not press whatever is under it.
    const opened = performance.now();
    const armed = (fn: () => void) => () => {
      if (performance.now() - opened > 500) fn();
    };
    this.button(el, '.cont', armed(opts.onContinue));
    this.button(el, '.new', armed(opts.onNew));
    this.button(el, '.decks', armed(opts.onDecks));
    this.button(el, '.settings', armed(opts.onSettings));
  }

  /**
   * The boot splash: emblem and logo animate in over black, a loading bar fills while the game warms
   * up (`ready`), then the 3D title scene fades in behind "TAP TO START". Until a language has been
   * chosen (`pick`), it asks for one instead, in both languages, and the choice is the tap that starts.
   */
  tapToStart(ready: Promise<void>, pick: ((l: Lang) => void) | null, done: () => void) {
    // The question is asked in both languages at once, so it isn't translated.
    const ask = pick
      ? `<div class="boot-lang"><div class="boot-ask">Choose your language · Διάλεξε γλώσσα</div><div class="boot-langs">${LANGS.map((l) => `<button class="menu-btn${l.id === lang() ? ' primary' : ''}" data-l="${l.id}">${l.name}</button>`).join('')}</div></div>`
      : `<div class="boot-tap">${tr('TAP TO START')}</div>`;
    const el = this.open(`<div class="boot">
      <div class="boot-bg"></div>
      <div class="boot-core">
        <div class="boot-emblem">${emblemSvg(180)}</div>
        <div class="boot-logo"><span>${upper(tr(GAME_NAME))}</span></div>
        <div class="boot-tag">${tr('Three chapters. Three heroes. One very nervous robot.')}</div>
        <div class="boot-load"><i></i></div>
        ${ask}
      </div>
      <div class="boot-foot">${tr('Headphones on for the best adventure')}</div>
    </div>`, false);
    el.style.padding = '0';
    // Pick up where the native splash leaves off (the same emblem, 200 px wide in the middle of the
    // screen; app.json), then glide up into place as the name fades in.
    const em = $<HTMLElement>(el, '.boot-emblem');
    const at = em.getBoundingClientRect();
    if (at.width) {
      const dx = window.innerWidth / 2 - (at.left + at.width / 2);
      const dy = window.innerHeight / 2 - (at.top + at.height / 2);
      em.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${200 / at.width})` }, { transform: 'none' }], { duration: 900, delay: 250, easing: 'cubic-bezier(0.5, 0, 0.2, 1)', fill: 'backwards' });
    }
    const bar = $<HTMLElement>(el, '.boot-load i');
    let loaded = false;
    let fake = 0;
    const tick = setInterval(() => {
      fake = Math.min(0.9, fake + 0.04);
      bar.style.width = `${Math.round((loaded ? 1 : fake) * 100)}%`;
    }, 50);
    const minShow = new Promise((r) => setTimeout(r, 1500));
    void Promise.all([ready, minShow]).then(() => {
      loaded = true;
      clearInterval(tick);
      bar.style.width = '100%';
      setTimeout(() => el.querySelector('.boot')?.classList.add('ready'), 250);
    });
    let started = false;
    const go = () => {
      if (!loaded || started) return;
      started = true;
      window.removeEventListener('keydown', key);
      done();
    };
    // A key press picks the highlighted language.
    const key = () => {
      if (loaded && pick) pick(lang());
      go();
    };
    if (pick) {
      for (const b of el.querySelectorAll<HTMLElement>('.boot-langs button')) {
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!loaded) return;
          pick(b.dataset.l as Lang);
          go();
        });
      }
    } else {
      // A click, not pointerdown: on pointerdown the title opened under the finger, and the same tap's
      // click then pressed the button that had appeared there.
      el.addEventListener('click', go);
    }
    window.addEventListener('keydown', key);
  }

  confirm(text: string, yes: () => void, no: () => void) {
    const el = this.open(`<div class="panel" style="width:min(420px,80vw)"><h2>${tr('Are you sure?')}</h2><p style="font-size:17px">${tr(text)}</p>
      <div class="grid2"><button class="menu-btn danger yes">${tr('Yes')}</button><button class="menu-btn no">${tr('No')}</button></div></div>`);
    this.button(el, '.yes', yes);
    this.button(el, '.no', no);
  }

  /** The title card as a deck or region opens; `kicker` is the small line above the name (already translated). */
  card(kicker: string, name: string, sub: string, color: string, done: () => void) {
    this.open(`<div class="card"><div class="deck">${kicker}</div><div class="deckname" style="color:${color}">${upper(tr(name))}</div><div class="sub">${tr(sub)}</div></div>`);
    setTimeout(() => {
      this.close();
      done();
    }, 2300);
  }

  pause(opts: {
    deck: string;
    shards: string;
    colonists: string;
    planet: boolean;
    /** A chapter 3 level (the Argonauts' voyage). */
    voyage?: boolean;
    /** What the shard and colonist rows are called in this chapter (see `lootLabels`). */
    labels?: { finds: string; rescues: string };
    /** Replaces the shard and colonist rows (a flight shows its rings and drones instead). */
    stats?: [string, string][];
    quests: { text: string; done: boolean; progress: string; reward: string }[];
    onResume: () => void;
    onSettings: () => void;
    onHelp: () => void;
    onRestart: () => void;
    onQuit: () => void;
  }) {
    const stats = opts.stats ?? [
      [opts.labels?.finds ?? (opts.planet ? 'Journal pages' : 'Memory shards'), opts.shards],
      [opts.labels?.rescues ?? (opts.planet ? 'Scientists freed' : 'Colonists rescued'), opts.colonists],
    ];
    const el = this.open(`<div class="panel pause-panel">
      <h2>${tr('PAUSED')} · ${upper(tr(opts.deck))}</h2>
      <div class="row">
        <div class="col-menu">
          <button class="menu-btn primary resume">▶ ${tr('Resume')}</button>
          <div class="grid2"><button class="menu-btn help">${tr('How to play')}</button><button class="menu-btn settings">${tr('Settings')}</button></div>
          <button class="menu-btn restart">${tr('Back to last checkpoint')}</button>
          <button class="menu-btn danger quit">${tr('Save & quit to title')}</button>
        </div>
        <div class="col-info">
          ${stats.map(([k, v]) => `<div class="stat"><span>${tr(k)}</span><b>${v}</b></div>`).join('')}
          <div class="quests"><div class="qh">${opts.stats || opts.voyage ? tr('SIDE QUESTS ON THIS LEVEL') : opts.planet ? tr('SIDE QUESTS IN THIS REGION') : tr('SIDE QUESTS ON THIS DECK')}</div>${opts.quests
            .map((q) => `<div class="q ${q.done ? 'done' : ''}"><i>${q.done ? '✔' : ''}</i><div><b>${q.text}</b><small>${q.progress} · ${tr('Reward')}: ${q.reward}</small></div></div>`)
            .join('')}</div>
        </div>
      </div></div>`);
    this.button(el, '.resume', opts.onResume);
    this.button(el, '.help', opts.onHelp);
    this.button(el, '.settings', opts.onSettings);
    this.button(el, '.restart', opts.onRestart);
    this.button(el, '.quit', opts.onQuit);
  }

  /** The help tab showing (kept between visits). */
  private helpTab = 0;

  /** How to play: one short page per hero (and the mech), picked with tabs along the top. */
  help(back: () => void) {
    const pages: { name: string; keys: string; items: [string, string, string][] }[] = [
      {
        name: tr(SPEAKER_NAME.jason),
        keys: tr('Keyboard: WASD move · Space jump · J blast · K spin/pound · L dash · I pulse · E use · Q/R camera · Esc pause'),
        items: [
          ['var(--accent)', tr('Move'), tr('Left side moves. Drag the right side to look around.')],
          ['#7dff9a', tr('JUMP'), tr('Hold to jump higher. With the Jet Boots, jump again in mid-air.')],
          ['#7fe6ff', tr('BLAST'), tr('Tap to shoot. Hold for a big FIREBALL.')],
          ['#ffd166', tr('SPIN'), tr('Blocks attacks, 3 in a row. In mid-air: GROUND POUND.')],
          ['#b58cff', tr('DASH'), tr('Ram enemies and zoom over gaps. Uses an energy cell.')],
          ['#8ab4ff', tr('PULSE'), tr('LUX hits every enemy near you and shorts out lasers.')],
          ['#7fe6ff', tr('GRAPPLE'), tr('Look at a glowing ring and press LUX to zip over.')],
          ['#ffb020', tr('WEAPONS'), tr('Buy them from PANDORA. Tap the weapon button to switch.')],
        ],
      },
      {
        name: tr(SPEAKER_NAME.atalanta),
        keys: tr('Atalanta: J bow · K kick · L or Shift slide · C switch hero'),
        items: [
          ['#5fe0c8', tr('SWITCH'), tr('Tap the face button to change hero.')],
          ['#7dff9a', tr('SPRINT'), tr('Push the stick all the way for long jumps.')],
          ['#7dff9a', tr('WALL-JUMP'), tr('Jump off walls. Run along glowing teal stripes.')],
          ['#8ff8e4', tr('BOW'), tr('Tap for arrows. Hold for a POWER ARROW that hits targets.')],
          ['#ffd166', tr('KICK'), tr('A spinning kick that blocks shots.')],
          ['#b58cff', tr('SLIDE'), tr('Slide under gaps with yellow stripes.')],
        ],
      },
      {
        name: tr('Brennus'),
        keys: tr('Brennus: J cannon · K shield (in the air: stomp) · L charge · E command'),
        items: [
          ['#ffb04a', tr('CANNON'), tr('Hold for a BIG BLAST that breaks cracked rock. Mind the heat.')],
          ['#c9d870', tr('SHIELD'), tr('Hold to block from the front. Let go to bash.')],
          ['#ffd166', tr('CHARGE'), tr('Smash through walls. Jump while charging to leap gaps.')],
          ['#ff6a5a', tr('COMMAND'), tr('At a command post, give your robots an order.')],
        ],
      },
      {
        name: tr('Mech'),
        keys: tr('Mech: J flamethrower · K punch (in the air: slam) · L thrust · E get out'),
        items: [
          ['#e0a040', tr('PUNCH'), tr('Breaks bronze gates. In mid-air: SLAM cracked floors.')],
          ['#ffb04a', tr('THRUST'), tr('Jets you forward, once per jump, over lava.')],
          ['#ff7a1a', tr('FLAME'), tr('Hold to burn. Let go to refill.')],
          ['#ffd166', tr('STRENGTH'), tr('Hits wear it down; only checkpoints mend it. Only the mech can fight TALOS.')],
          ['#5ff0d0', tr('GET OUT'), tr('The action button climbs out. Walk back to climb in.')],
        ],
      },
    ];
    const page = pages[this.helpTab] ?? pages[0];
    const el = this.open(`<div class="panel help-panel">
      <div class="panel-head"><h2>${tr('HOW TO PLAY')}</h2>
      <div class="seg help-tabs">${pages.map((p, i) => `<button data-tab="${i}" class="${p === page ? 'on' : ''}">${p.name}</button>`).join('')}</div>
      <button class="icon-btn back" aria-label="${tr('Got it!')}">${ICON.close}</button></div>
      <div class="help-grid">${page.items.map(([color, name, text]) => `<div><b style="color:${color}">${name}</b> ${text}</div>`).join('')}</div>
      ${inApp() ? '' : `<p class="keys">${page.keys}</p>`}
      <button class="menu-btn primary done">${tr('Got it!')}</button></div>`);
    for (const b of el.querySelectorAll<HTMLElement>('[data-tab]')) {
      b.addEventListener('click', () => {
        if (Number(b.dataset.tab) === this.helpTab) return;
        this.helpTab = Number(b.dataset.tab);
        audio.play('select');
        this.help(back);
      });
    }
    this.button(el, '.back', back);
    this.button(el, '.done', back);
  }

  settings(s: Settings, change: (s: Settings) => void, back: () => void, reset?: () => void) {
    const q: (Quality | 'auto')[] = ['auto', 'low', 'medium', 'high'];
    const qName: Record<Quality | 'auto', string> = { auto: tr('Auto'), low: tr('Low'), medium: tr('Medium'), high: tr('High') };
    const autoNote = (x: Settings) => (x.autoQuality ? tr('Auto picks graphics this device runs smoothly. Now: {q}.', { q: qName[x.quality] }) : '');
    const el = this.open(`<div class="panel settings-panel">
      <div class="panel-head"><h2>${tr('SETTINGS')}</h2><button class="icon-btn back" aria-label="${tr('Done')}">${ICON.close}</button></div>
      <div class="settings-grid">
        <label class="slider"><span>${tr('Music')}</span><input type="range" min="0" max="1" step="0.05" value="${s.music}" class="music"/></label>
        <label class="slider"><span>${tr('Sounds')}</span><input type="range" min="0" max="1" step="0.05" value="${s.sfx}" class="sfx"/></label>
        <label class="slider"><span>${tr('Camera speed')}</span><input type="range" min="0.4" max="2" step="0.1" value="${s.camSpeed}" class="cam"/></label>
        <div class="slider"><span>${tr('Graphics')}</span><div class="seg quality">${q.map((x) => `<button data-q="${x}" class="${(s.autoQuality ? 'auto' : s.quality) === x ? 'on' : ''}">${qName[x]}</button>`).join('')}</div></div>
        <div class="slider"><span>${tr('Vibration')}</span><div class="seg vib"><button data-v="1" class="${s.haptics ? 'on' : ''}">${tr('On')}</button><button data-v="0" class="${s.haptics ? '' : 'on'}">${tr('Off')}</button></div></div>
        <div class="slider"><span>${ICON.globe}</span><div class="seg lang">${LANGS.map((l) => `<button data-l="${l.id}" class="${s.lang === l.id ? 'on' : ''}">${l.name}</button>`).join('')}</div></div>
      </div>
      <p class="note"><span class="auto-note">${autoNote(s)}</span> ${tr('Graphics changes apply when you enter the next deck.')}</p>
      <div class="settings-actions"><button class="menu-btn primary done">${tr('Done')}</button><button class="menu-btn about">${ICON.info} ${tr('About')}</button>${reset ? `<button class="menu-btn danger reset">${tr('Erase save')}</button>` : ''}</div></div>`);
    const cur = { ...s };
    const emit = () => change({ ...cur });
    $<HTMLInputElement>(el, '.music').addEventListener('input', (e) => {
      cur.music = Number((e.target as HTMLInputElement).value);
      emit();
    });
    $<HTMLInputElement>(el, '.sfx').addEventListener('input', (e) => {
      cur.sfx = Number((e.target as HTMLInputElement).value);
      emit();
      audio.play('bolt');
    });
    $<HTMLInputElement>(el, '.cam').addEventListener('input', (e) => {
      cur.camSpeed = Number((e.target as HTMLInputElement).value);
      emit();
    });
    const seg = (sel: string, pick: (b: HTMLElement) => void) => {
      for (const b of el.querySelectorAll<HTMLElement>(`${sel} button`)) {
        b.addEventListener('click', () => {
          pick(b);
          el.querySelectorAll(`${sel} button`).forEach((x) => x.classList.toggle('on', x === b));
          audio.play('select');
          emit();
        });
      }
    };
    seg('.quality', (b) => {
      if (b.dataset.q === 'auto') {
        cur.autoQuality = true;
        cur.autoCap = undefined;
        resolveAuto(cur);
      } else {
        cur.autoQuality = false;
        cur.quality = b.dataset.q as Quality;
      }
      $(el, '.auto-note').textContent = autoNote(cur);
    });
    seg('.vib', (b) => (cur.haptics = b.dataset.v === '1'));
    for (const b of el.querySelectorAll<HTMLElement>('.lang button')) {
      b.addEventListener('click', () => {
        if (cur.lang === b.dataset.l) return;
        cur.lang = b.dataset.l as Settings['lang'];
        cur.langChosen = true;
        audio.play('select');
        emit();
        // Redraw this screen in the new language.
        this.settings(cur, change, back, reset);
      });
    }
    this.button(el, '.back', back);
    this.button(el, '.done', back);
    this.button(el, '.about', () => this.about(() => this.settings(cur, change, back, reset)));
    if (reset) this.button(el, '.reset', reset);
  }

  /** Settings → About: the game, its version, who made it (with a way to get in touch) and what's new. */
  about(back: () => void) {
    const el = this.open(`<div class="panel about-panel">
      <div class="panel-head"><div class="about-emblem">${emblemSvg(96)}</div>
        <div><div class="about-name logo">${upper(tr(GAME_NAME))}</div><div class="about-ver">${tr('Version {v}', { v: VERSION })}</div></div>
        <button class="icon-btn back" aria-label="${tr('Back')}">${ICON.close}</button></div>
      <p class="about-by">${tr('Created by {name}', { name: `<b>${CREATOR.name}</b>` })}</p>
      <div class="about-links">
        <button class="menu-btn mail">${ICON.mail}<span>${tr('Contact me')}<small>${CREATOR.email}</small></span></button>
        <button class="menu-btn site">${ICON.globe}<span>${tr('My website')}<small>${CREATOR.site}</small></span></button>
        <button class="menu-btn notes">${ICON.sparkle}<span>${tr('What’s new')}<small>${RELEASES[0].version}</small></span></button>
      </div>
      <p class="note">${tr('Free and open source (MIT license). The music is openly licensed: every track is credited in the end credits.')}</p>
    </div>`);
    this.button(el, '.back', back);
    this.button(el, '.mail', () => openLink(`mailto:${CREATOR.email}`));
    this.button(el, '.site', () => openLink(`https://${CREATOR.site}`));
    this.button(el, '.notes', () => this.whatsNew(() => this.about(back)));
  }

  /** The release notes, newest version first. */
  whatsNew(back: () => void) {
    const el = this.open(`<div class="panel about-panel news-panel">
      <div class="panel-head"><h2>${upper(tr('What’s new'))}</h2><button class="icon-btn back" aria-label="${tr('Back')}">${ICON.close}</button></div>
      ${RELEASES.map((r) => `<div class="release"><h3>${tr('Version {v}', { v: r.version })} <small>${r.date}</small></h3><ul>${r.notes.map((n) => `<li>${tr(n.text)}</li>`).join('')}</ul></div>`).join('')}
    </div>`);
    this.button(el, '.back', back);
  }

  /** The shop tab showing (kept while the shop is open, and between visits). */
  shopTab: ShopTab = 'upgrades';
  /** An outfit to show in the fitting room as soon as the shop opens (a developer shortcut, `&try=`). */
  shopTry: string | null = null;

  /**
   * PANDORA's shop. On the ship it sells upgrades only; on Gaia Nova it has two tabs, upgrades (with
   * their Mk II levels) and weapons; in chapter 3 two more, Atalanta's upgrades and outfits for both
   * heroes. Prices and levels come from game/shop.ts.
   */
  shop(save: SaveData, deck: DeckId, act: ShopActions) {
    let room: FittingRoom | null = null;
    const leaveRoom = () => {
      room?.dispose();
      room = null;
      this.overlay.querySelector('.fitting')?.remove();
    };
    /** The fitting room: the hero in an outfit, turning round in 3D. Tap anywhere to close it. */
    const tryOn = (id: string) => {
      const o = shopStock(save, deck).outfits.find((x) => x.outfit.id === id);
      if (!o) return;
      leaveRoom();
      const box = h(`<div class="fitting"><div class="fit-card"><canvas></canvas><b>${tr(o.outfit.name)}</b><button class="icon-btn" aria-label="${tr('Close')}">${ICON.close}</button></div></div>`);
      this.overlay.append(box);
      box.addEventListener('click', (e) => {
        e.stopPropagation();
        audio.play('select');
        leaveRoom();
      });
      try {
        room = new FittingRoom($(box, 'canvas') as HTMLCanvasElement, o.outfit.hero, id, save);
      } catch {
        // No WebGL to spare: the card's picture will have to do.
        box.remove();
      }
    };
    const render = (bought?: string) => {
      leaveRoom();
      const stock = shopStock(save, deck);
      // Keep the list where it was scrolled to when a purchase redraws it.
      const scrolled = this.overlay.querySelector('.shop-grid')?.scrollTop ?? 0;
      const tabs: [ShopTab, string, string][] = [['upgrades', ICON.star, tr('Upgrades')]];
      if (stock.weapons.length) tabs.push(['weapons', WEAPON_ICON.spread, tr('Weapons')]);
      if (stock.atalanta.length) tabs.push(['atalanta', portrait('atalanta'), tr('Atalanta')]);
      if (stock.outfits.length) tabs.push(['outfits', OUTFITS_ICON, tr('Outfits')]);
      if (!tabs.some(([t]) => t === this.shopTab)) this.shopTab = 'upgrades';
      const card = (id: string, cls: string, icon: string, name: string, stars: string, desc: string, button: string, tag = '') =>
        `<div class="shop-item ${cls} ${bought === id ? 'bought' : ''}"><div class="icon">${icon}</div><div class="info"><b>${tr(name)}${tag}</b>${stars}<i>${tr(desc)}</i></div>${button}</div>`;
      const price = (n: number) => `${ICON.bolt}${n}`;
      const upgrades = stock.upgrades
        .map((o) => {
          const maxed = o.price === null;
          // Gold stars for the ship's levels, cyan ones for the Mk II levels.
          const row = (from: number, to: number) => `${'★'.repeat(Math.max(0, Math.min(o.level, to) - from))}<em>${'★'.repeat(Math.max(0, to - Math.max(o.level, from)))}</em>`;
          const mk2 = o.max > o.base ? `<span class="mk2">${row(o.base, o.max)}</span>` : '';
          const stars = `<span class="stars">${row(0, o.base)}${mk2}</span>`;
          const btn = `<button class="buy" data-up="${o.item.id}" ${!maxed && save.bolts >= (o.price ?? 0) ? '' : 'disabled'}>${maxed ? tr('MAX') : price(o.price ?? 0)}</button>`;
          return card(o.item.id, maxed ? 'maxed' : '', UPGRADE_ICON[o.item.id] ?? ICON.star, o.item.name, stars, o.item.desc, btn, o.base > 0 && o.max > o.base && o.level >= o.base ? ' <small class="mk">Mk II</small>' : '');
        })
        .join('');
      const weapons = stock.weapons
        .map((o) => {
          const id = o.weapon.id;
          const btn = o.equipped
            ? `<button class="buy equipped" disabled>${tr('EQUIPPED')}</button>`
            : o.owned
              ? `<button class="buy equip" data-eq="${id}">${tr('EQUIP')}</button>`
              : `<button class="buy" data-wp="${id}" ${save.bolts >= (o.price ?? 0) ? '' : 'disabled'}>${price(o.price ?? 0)}</button>`;
          const special = `<small class="wspecial">${ICON.star}${tr(o.weapon.special)}</small>`;
          return card(id, `weapon ${o.equipped ? 'on' : ''}`, WEAPON_ICON[id], o.weapon.name, weaponStats(o.weapon) + special, o.weapon.desc, btn);
        })
        .join('');
      // Atalanta's upgrades: plain levels (gold stars), no Mk II.
      const atalanta = stock.atalanta
        .map((o) => {
          const maxed = o.price === null;
          const stars = `<span class="stars">${'★'.repeat(o.level)}<em>${'★'.repeat(o.max - o.level)}</em></span>`;
          const btn = `<button class="buy" data-ata="${o.item.id}" ${!maxed && save.bolts >= (o.price ?? 0) ? '' : 'disabled'}>${maxed ? tr('MAX') : price(o.price ?? 0)}</button>`;
          return card(o.item.id, `ata ${maxed ? 'maxed' : ''}`, ATA_ICON[o.item.id], o.item.name, stars, o.item.desc, btn);
        })
        .join('');
      // Outfits, by hero: buy once, then WEAR or TAKE OFF for free.
      const outfits = (['jason', 'atalanta'] as const)
        .map((hero) => {
          const list = stock.outfits.filter((o) => o.outfit.hero === hero);
          if (!list.length) return '';
          const head = `<div class="shop-sec"><span class="face">${portrait(hero)}</span>${tr(SPEAKER_NAME[hero])}</div>`;
          // One column per hero.
          return (
            `<div class="outfit-col">${head}` +
            list
              .map((o) => {
                const id = o.outfit.id;
                const btn = o.worn
                  ? `<button class="buy equip" data-off="${hero}">${tr('TAKE OFF')}</button>`
                  : o.owned
                    ? `<button class="buy equip" data-wear="${id}">${tr('WEAR')}</button>`
                    : `<button class="buy" data-fit="${id}" ${save.bolts >= (o.price ?? 0) ? '' : 'disabled'}>${price(o.price ?? 0)}</button>`;
                // The picture opens the fitting room.
                const pic = `<button class="try" data-try="${id}" aria-label="${tr('Try it on')}">${outfitFigure(o.outfit)}</button>`;
                return card(id, `outfit ${o.worn ? 'on' : ''}`, pic, o.outfit.name, '', o.outfit.desc, btn);
              })
              .join('') +
            '</div>'
          );
        })
        .join('');
      const pages: Record<ShopTab, string> = { upgrades, weapons, atalanta, outfits };
      const tabBar =
        tabs.length > 1
          ? `<div class="shop-tabs seg">${tabs.map(([t, icon, name]) => `<button data-tab="${t}" class="${this.shopTab === t ? 'on' : ''}">${icon}<span>${name}</span></button>`).join('')}</div>`
          : '';
      // With tabs, the tabs take the title's place in the header row, so the whole stock fits on screen.
      const el = this.open(`<div class="panel shop-panel">
        <div class="panel-head"><div class="portrait">${portrait('vendy')}</div>
        ${tabBar || `<div class="shop-title"><h2>${tr('PANDORA’S UPGRADES')}</h2></div>`}
        <div class="counter">${ICON.bolt}<b>${cleanBolts(save.bolts)}</b></div><button class="icon-btn close" aria-label="${tr('Leave shop')}">${ICON.close}</button></div>
        <div class="shop-grid ${this.shopTab}">${pages[this.shopTab]}</div></div>`);
      if (bought) $(el, '.shop-grid').scrollTop = scrolled;
      const on = (sel: string, fn: (b: HTMLElement) => void) => {
        for (const b of el.querySelectorAll<HTMLElement>(sel)) b.addEventListener('click', () => fn(b));
      };
      on('[data-up]', (b) => {
        act.buyUpgrade(b.dataset.up as UpgradeId);
        render(b.dataset.up);
      });
      on('[data-wp]', (b) => {
        act.buyWeapon(b.dataset.wp as WeaponId);
        render(b.dataset.wp);
      });
      on('[data-eq]', (b) => {
        act.equip(b.dataset.eq as WeaponId);
        audio.play('select');
        render(b.dataset.eq);
      });
      on('[data-ata]', (b) => {
        act.buyAtalanta(b.dataset.ata as AtalantaUpgradeId);
        render(b.dataset.ata);
      });
      on('[data-fit]', (b) => {
        act.buyOutfit(b.dataset.fit as OutfitId);
        render(b.dataset.fit);
      });
      on('[data-wear]', (b) => {
        act.wear(b.dataset.wear as OutfitId);
        audio.play('select');
        render(b.dataset.wear);
      });
      on('[data-off]', (b) => {
        const worn = save.wearing[b.dataset.off as OutfitHero];
        act.takeOff(b.dataset.off as OutfitHero);
        audio.play('select');
        render(worn);
      });
      on('[data-try]', (b) => {
        audio.play('select');
        tryOn(b.dataset.try as string);
      });
      on('[data-tab]', (b) => {
        if (this.shopTab === b.dataset.tab) return;
        this.shopTab = b.dataset.tab as ShopTab;
        audio.play('select');
        render();
      });
      this.button(el, '.close', () => {
        leaveRoom();
        act.close();
      });
    };
    render();
    if (this.shopTry && this.shopTab === 'outfits') tryOn(this.shopTry);
    this.shopTry = null;
  }

  /**
   * The results card. `voyage` is a chapter 3 level (the Argo sails on); `rows` are extra stats (a
   * flight's rings and drones); `soon` names the next level when it isn't built yet.
   */
  results(
    r: { deck: string; time: string; bolts: number; shards: string; colonists: string; next: string | null; planet: boolean; voyage?: boolean; rows?: [string, string][]; soon?: string | null; labels?: { finds: string; rescues: string } },
    next: () => void,
  ) {
    const go = r.next
      ? r.voyage
        ? `${tr('Sail the Argo to {deck}', { deck: tr(r.next) })} ⛵`
        : r.planet
          ? `${tr('Fly the shuttle to {deck}', { deck: tr(r.next) })} ✈`
          : `${tr('Ride the lift to {deck}', { deck: tr(r.next) })} ▲`
      : tr('Continue');
    const kicker = r.voyage ? tr('LEVEL COMPLETE') : r.planet ? tr('REGION COMPLETE') : tr('DECK COMPLETE');
    const el = this.open(`<div class="panel card results-card">
      <div class="deck">${kicker}</div><div class="deckname" style="color:var(--good);font-size:34px">${upper(tr(r.deck))}</div>
      <div class="result-stats"><div class="stat"><span>${tr('Time')}</span><b>${r.time}</b></div>
      <div class="stat"><span>${tr('Bolts collected')}</span><b>${cleanBolts(r.bolts)}</b></div>
      ${r.shards ? `<div class="stat"><span>${r.labels?.finds ?? (r.planet ? tr('Journal pages') : tr('Memory shards'))}</span><b>${r.shards}</b></div>` : ''}
      ${r.colonists ? `<div class="stat"><span>${r.labels?.rescues ?? (r.planet ? tr('Scientists freed') : tr('Colonists rescued'))}</span><b>${r.colonists}</b></div>` : ''}
      ${(r.rows ?? []).map(([k, v]) => `<div class="stat"><span>${tr(k)}</span><b>${v}</b></div>`).join('')}</div>
      ${r.soon ? `<p class="soon-note">${tr('Next: {deck}. Coming soon!', { deck: tr(r.soon) })}</p>` : ''}
      <button class="menu-btn primary next" style="margin-top:14px">${go}</button></div>`);
    this.button(el, '.next', next);
  }

  /** The chapter page the level select shows (kept between visits). */
  private deckTab = 0;

  /**
   * The level select: one page per chapter, with tabs along the top (a chapter's tab appears once any
   * of its levels is unlocked). Levels of a chapter still being built show as "coming soon".
   */
  decks(list: DeckInfo[], pick: (id: string) => void, back: () => void) {
    const chapters = ([1, 2, 3] as const).filter((ch) => ch === 1 || list.some((d) => d.chapter === ch && d.unlocked && !d.soon));
    if (!chapters.includes(this.deckTab as 1 | 2 | 3)) this.deckTab = chapters[chapters.length - 1];
    const titles: Record<number, string> = {
      1: tr('THE {ship} · ELEVATOR', { ship: upper(tr(SHIP)) }),
      2: tr('GAIA NOVA · SHUTTLE'),
      3: tr('THE ARGONAUTS · THE ARGO'),
    };
    const icon = (d: DeckInfo) => (d.chapter === 1 ? '◆' : d.chapter === 2 ? '▤' : '✦');
    const button = (d: DeckInfo) =>
      d.soon
        ? `<button class="menu-btn deck soon" disabled style="border-color:${d.color}"><span style="color:${d.color};font-family:Orbitron,sans-serif;font-weight:800">${d.number}</span> ${tr(d.name)}<small>${tr('coming soon')}</small></button>`
        : `<button class="menu-btn deck" data-id="${d.id}" ${d.unlocked ? '' : 'disabled'} style="border-color:${d.color}">
          <span style="color:${d.color};font-family:Orbitron,sans-serif;font-weight:800">${d.number}</span> ${d.unlocked ? tr(d.name) : '???'}
          <small>${d.unlocked ? `${d.completed ? '✓ ' : ''}${d.shardTotal ? `${icon(d)} ${d.shards}/${d.shardTotal}` : icon(d)}` : ICON.lock}</small></button>`;
    const render = () => {
      const ch = this.deckTab;
      const decks = list.filter((d) => d.chapter === ch);
      const tabs =
        chapters.length > 1
          ? `<div class="seg chapter-tabs">${chapters.map((c) => `<button data-ch="${c}" class="${c === ch ? 'on' : ''}">${tr('Chapter {n}', { n: c })}</button>`).join('')}</div>`
          : '';
      const el = this.open(`<div class="panel deck-panel"><div class="panel-head"><h2>${tr('REPLAY A LEVEL')}</h2>${tabs}<button class="icon-btn back" aria-label="${tr('Back')}">${ICON.close}</button></div>
        <h3 class="chapter-head">${titles[ch]}</h3><div class="grid2 deck-grid ${decks.length > 6 ? 'many' : ''}">${decks.map(button).join('')}</div></div>`);
      for (const b of el.querySelectorAll<HTMLElement>('.deck[data-id]')) {
        b.addEventListener('click', () => {
          audio.play('select');
          pick(b.dataset.id as string);
        });
      }
      for (const b of el.querySelectorAll<HTMLElement>('[data-ch]')) {
        b.addEventListener('click', () => {
          if (Number(b.dataset.ch) === this.deckTab) return;
          this.deckTab = Number(b.dataset.ch);
          audio.play('select');
          render();
        });
      }
      this.button(el, '.back', back);
    };
    render();
  }

  down(done: () => void) {
    this.open(`<div class="big-msg" style="color:#ff8aa0">${tr('OUCH!')}</div>`);
    setTimeout(() => {
      this.close();
      done();
    }, 1600);
  }

  message(html: string) {
    this.open(html);
  }

  /**
   * The END OF CHAPTER card that closes a chapter's ending film: the ending's name over black, a `hint` when
   * a secret ending is still out there, and the chapter that comes next (`next`). It moves on by itself
   * after a few seconds, or on a tap.
   */
  chapterEnd(kind: EndingKind, chapter: number, hint: string | null, next: number | null, done: () => void) {
    const secret = kind === 'friends' || kind === 'redeemed' || kind === 'gardeners';
    const color = kind === 'friends' ? 'var(--pink)' : kind === 'redeemed' || kind === 'fleece' ? 'var(--gold)' : kind === 'gardeners' ? '#7dff9a' : 'var(--good)';
    const title =
      kind === 'friends'
        ? tr('THE GARDEN BETWEEN STARS')
        : kind === 'redeemed'
          ? tr('A GARDEN FOR EVERYONE')
          : kind === 'freed'
            ? tr('GAIA NOVA IS FREE!')
            : kind === 'fleece'
              ? tr('THE GOLDEN FLEECE COMES HOME')
              : kind === 'gardeners'
                ? tr('NOT THE LAST OF HER KIND')
                : tr('THE {ship} IS SAVED!', { ship: upper(tr(SHIP)) });
    const kicker = secret ? `${tr('SECRET ENDING')} · ${tr('END OF CHAPTER {n}', { n: chapter })}` : tr('END OF CHAPTER {n}', { n: chapter });
    const coming = next === 2 ? tr('Chapter 2: Gaia Nova') : next === 3 ? tr('Chapter 3: The Argonauts') : '';
    const el = this.open(`<div class="chapter-end">
      <div class="ce-kicker">${kicker}</div>
      <div class="ce-title" style="color:${color}">${title}</div>
      ${hint ? `<div class="ce-hint">${hint}</div>` : ''}
      ${coming ? `<div class="ce-next">${tr('Next')} ▶ ${coming}</div>` : ''}
    </div>`);
    el.classList.add('chapter-end-bg');
    const start = performance.now();
    let over = false;
    const finish = () => {
      if (over) return;
      over = true;
      clearTimeout(timer);
      this.close();
      done();
    };
    const timer = setTimeout(finish, hint ? 7000 : 5500);
    el.addEventListener('pointerdown', () => {
      if (performance.now() - start > 1500) finish();
    });
  }
}
