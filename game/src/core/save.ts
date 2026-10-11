import type { Ability, DeckId } from '../world/levelTypes';
import { post } from './bridge';
import { START_HEARTS } from './constants';
import { detectLang, type Lang } from './i18n';
import { equippedWeapon, ownedWeapons } from '../entities/weapons';
import { knownOutfits, outfitFor } from '../entities/outfits';

/** Shop upgrades. The last four are only sold on Gaia Nova (chapter 2). */
export type UpgradeId = 'blaster' | 'rapid' | 'clip' | 'boltZap' | 'magnet' | 'heart' | 'armor' | 'dashCell' | 'spinCharge' | 'grapple';
/** Atalanta's own shop upgrades (chapter 3, once she has joined; see game/shop.ts). */
export type AtalantaUpgradeId = 'bow' | 'draw' | 'sandals' | 'gloves' | 'kick' | 'triple';
/** The heroes PANDORA sells outfits for. */
export type OutfitHero = 'jason' | 'atalanta';
export type Quality = 'low' | 'medium' | 'high';

export interface Settings {
  music: number;
  sfx: number;
  /** The quality in effect (with Auto on, the game picks it; see core/graphics.ts). */
  quality: Quality;
  /** Auto graphics: the game picks the quality for this device and steps it down if play gets slow. */
  autoQuality: boolean;
  /** The highest quality Auto may pick here, lowered when play was too slow; cleared by choosing Auto again. */
  autoCap?: Quality;
  camSpeed: number;
  haptics: boolean;
  lang: Lang;
}

/** A flight level's best results: the most rings and drones in one flight, and whether the dove's way was ever flown clean. */
export interface FlightRecord {
  rings: number;
  drones: number;
  clean: boolean;
}

export interface SaveData {
  version: 1;
  /** Highest level index the player may enter (1-6 on the ship, 7-12 on Gaia Nova, 13 on for chapter 3). */
  unlocked: number;
  /** Deck and checkpoint to resume from, with the deck's switches, pickups and defeated enemies. */
  resume: { deck: DeckId; checkpoint: string | null; flags: string[]; taken: string[]; dead: string[] } | null;
  bolts: number;
  maxHearts: number;
  abilities: Ability[];
  upgrades: Partial<Record<UpgradeId, number>>;
  /** Enemy kinds Jason has already met (their threat card has been shown). */
  bestiary?: string[];
  /** Vault prizes already opened. */
  prizes?: string[];
  /** First-time hints LUX has already given (about cocoons, shards, bolts...). */
  hints?: string[];
  /** Side quests finished (their reward has been paid). */
  quests?: string[];
  /** Deck numbers after which the app has already asked for a store review (see game/review.ts). */
  reviewAsks?: number[];
  shards: string[];
  canisters: string[];
  colonists: string[];
  completed: DeckId[];
  bestTimes: Partial<Record<DeckId, number>>;
  endings: string[];
  settings: Settings;
  playSeconds: number;
  /** True once the arrival at Gaia Nova (the start of chapter 2) has been shown. */
  gaiaIntro?: boolean;
  /** True once the building of the Argo (the start of chapter 3) has been shown. */
  argoIntro?: boolean;
  /** Best results on the flight levels (rings, drones, a clean run), for their side quests. */
  flights?: Partial<Record<DeckId, FlightRecord>>;
  /** Weapons Jason owns (see entities/weapons.ts); the Blaster is always one of them. */
  weapons: string[];
  /** The weapon he has equipped. */
  weapon: string;
  /** Atalanta's upgrade levels (chapter 3). */
  ataUpgrades: Partial<Record<AtalantaUpgradeId, number>>;
  /** Outfits bought (see entities/outfits.ts), and the one each hero is wearing (none: their usual suit). */
  outfits: string[];
  wearing: Partial<Record<OutfitHero, string>>;
}

/** Named after the game's old title; kept so existing saves carry over. */
const KEY = 'leviathan3d.save.v1';

export function defaultSettings(): Settings {
  return { music: 0.6, sfx: 0.85, quality: 'medium', autoQuality: true, camSpeed: 1, haptics: true, lang: detectLang() };
}

export function newSave(): SaveData {
  return {
    version: 1,
    unlocked: 1,
    resume: null,
    bolts: 0,
    maxHearts: START_HEARTS,
    abilities: [],
    upgrades: {},
    shards: [],
    canisters: [],
    colonists: [],
    completed: [],
    bestTimes: {},
    endings: [],
    settings: defaultSettings(),
    playSeconds: 0,
    weapons: ['blaster'],
    weapon: 'blaster',
    ataUpgrades: {},
    outfits: [],
    wearing: {},
  };
}

/** A bolt count as it must be stored: a whole number, never below zero (anything broken counts as 0). */
export function cleanBolts(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0;
}

/** Gives (or, with a negative n, takes) bolts; the pocket always stays a whole number, never below zero. */
export function addBolts(save: SaveData, n: number) {
  save.bolts = cleanBolts(cleanBolts(save.bolts) + Math.round(n || 0));
}

/** Pays a price in bolts. Returns false (and takes nothing) if Jason can't afford it. */
export function spendBolts(save: SaveData, price: number): boolean {
  const have = cleanBolts(save.bolts);
  const cost = cleanBolts(price);
  if (have < cost) return false;
  save.bolts = have - cost;
  return true;
}

/** Brings a save from an older version of the game up to date: fields added since get their defaults. */
export function migrateSave(s: SaveData): SaveData {
  // Repair a bolt count that went wrong (a fraction, below zero, or missing).
  s.bolts = cleanBolts(s.bolts);
  // LUX's old shield module became the force pulse.
  s.abilities = s.abilities.map((a) => ((a as string) === 'shield' ? 'pulse' : a));
  s.upgrades ??= {};
  // Weapons came with chapter 2: older saves own just the Blaster.
  s.weapons = ownedWeapons(Array.isArray(s.weapons) ? s.weapons : []);
  s.weapon = equippedWeapon(s.weapons, s.weapon);
  // Atalanta's upgrades and the outfits came with chapter 3's shop. An outfit only stays on if it was bought.
  s.ataUpgrades = s.ataUpgrades && typeof s.ataUpgrades === 'object' ? s.ataUpgrades : {};
  s.outfits = knownOutfits(Array.isArray(s.outfits) ? s.outfits : []);
  const wearing: SaveData['wearing'] = {};
  for (const hero of ['jason', 'atalanta'] as const) {
    const id = s.wearing?.[hero];
    if (outfitFor(hero, id) && s.outfits.includes(id as string)) wearing[hero] = id;
  }
  s.wearing = wearing;
  return s;
}

function isSave(v: unknown): v is SaveData {
  const s = v as Partial<SaveData> | null;
  return !!s && s.version === 1 && typeof s.unlocked === 'number' && Array.isArray(s.shards) && Array.isArray(s.abilities);
}

export function loadSave(): SaveData | null {
  const sources = [window.__SAVE__, (() => {
    try {
      return localStorage.getItem(KEY) ?? undefined;
    } catch {
      return undefined;
    }
  })()];
  let best: SaveData | null = null;
  for (const raw of sources) {
    if (!raw) continue;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isSave(parsed) && (!best || parsed.playSeconds > best.playSeconds)) best = parsed;
    } catch {
      // ignore corrupt copies
    }
  }
  if (best) {
    // Saves from before Auto graphics: High was always a player's own choice, so it stays; anything else goes Auto.
    const auto = best.settings?.autoQuality ?? best.settings?.quality !== 'high';
    best.settings = { ...defaultSettings(), ...best.settings, autoQuality: auto };
    migrateSave(best);
  }
  return best;
}

export function writeSave(s: SaveData) {
  s.bolts = cleanBolts(s.bolts);
  const raw = JSON.stringify(s);
  try {
    localStorage.setItem(KEY, raw);
  } catch {
    // storage full or unavailable: the app bridge below still keeps a copy
  }
  post({ type: 'save', data: raw });
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  post({ type: 'save', data: '' });
}
