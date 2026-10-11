import { MAX_HEARTS, MAX_HEARTS_MK2 } from '../core/constants';
import { cleanBolts, spendBolts, type AtalantaUpgradeId, type OutfitHero, type SaveData, type UpgradeId } from '../core/save';
import { OUTFITS, type Outfit, type OutfitId } from '../entities/outfits';
import { WEAPONS, WEAPON_ORDER, ownedWeapons, type Weapon, type WeaponId } from '../entities/weapons';
import { CHAPTERS, CHAPTER_DECKS, LEVEL_ORDER, chapterOf, type Chapter } from '../levels';
import type { DeckId } from '../world/levelTypes';

/**
 * PANDORA's shop: what she sells, for how much, and what buying does to the save. The shop screen
 * (ui.ts) only draws this.
 *
 * On the ship she sells the six classic upgrades. Once Jason reaches Gaia Nova she adds "Mk II"
 * levels on top of them, four new upgrades and the weapons. Chapter 2 pays far more bolts, so the
 * new stock costs more: a thorough player can buy most of it by the volcano, but not by the desert.
 *
 * In chapter 3 she also sells Atalanta's own upgrades (once Atalanta has joined, on the Harpy Isles)
 * and outfits for both heroes, priced like the Mk II stock: a chapter 3 level on foot pays a few
 * hundred bolts, so a player who finishes the chapter can own most of it, but not all at once.
 */

export interface Upgrade {
  id: UpgradeId;
  name: string;
  desc: string;
  /** Prices of each level sold on the ship (empty: only sold on Gaia Nova). */
  prices: number[];
  /** Prices of the extra "Mk II" levels sold on Gaia Nova. */
  mk2: number[];
}

export const UPGRADES: Upgrade[] = [
  { id: 'heart', name: 'Heart Plating', desc: '+1 max heart', prices: [150, 300, 500], mk2: [550, 800] },
  { id: 'blaster', name: 'Blaster Power', desc: '+1 damage for blasts, spins, pounds and dashes (fireballs +2)', prices: [250, 600], mk2: [900] },
  { id: 'clip', name: 'Bigger Clip', desc: 'Bigger clips for every weapon (and a bigger fuel tank)', prices: [160, 380], mk2: [480] },
  { id: 'rapid', name: 'Quick Reload', desc: 'Shoot, reload and refuel faster', prices: [200, 450], mk2: [600] },
  { id: 'boltZap', name: 'LUX Zapper', desc: 'LUX’s zap hurts instead of just stunning, and his force pulse hits harder', prices: [180, 420], mk2: [550] },
  { id: 'magnet', name: 'Bolt Magnet', desc: 'Pull in bolts from farther away', prices: [120, 300], mk2: [350] },
  { id: 'armor', name: 'Armor Plating', desc: 'Blocks one hit. Comes back at checkpoints, or after a while.', prices: [], mk2: [450, 800] },
  { id: 'dashCell', name: 'Dash Cell', desc: '+1 dash before your energy runs out', prices: [], mk2: [350, 650] },
  { id: 'spinCharge', name: 'Spin Charge', desc: '+1 spin in a row before the recharge', prices: [], mk2: [450] },
  { id: 'grapple', name: 'Grapple Range', desc: 'Zip to grapple rings from farther away, and faster', prices: [], mk2: [400] },
];

const upgrade = (id: UpgradeId) => UPGRADES.find((u) => u.id === id) as Upgrade;

/** One of Atalanta's upgrades (chapter 3): its levels' prices. What each does is in heroes/atalantaStats.ts. */
export interface AtalantaUpgrade {
  id: AtalantaUpgradeId;
  name: string;
  desc: string;
  prices: number[];
}

export const ATALANTA_UPGRADES: AtalantaUpgrade[] = [
  { id: 'bow', name: 'Hunter’s Bow', desc: 'Stronger arrows: quick ones +½ damage, power arrows +1, each level', prices: [300, 550, 800] },
  { id: 'draw', name: 'Quick Draw', desc: 'Charge the power arrow faster, and shoot again sooner', prices: [300, 550] },
  { id: 'sandals', name: 'Wind Sandals', desc: 'Sprint sooner and faster, for longer running jumps', prices: [250, 450] },
  { id: 'gloves', name: 'Climber’s Gloves', desc: 'Hold on to cliffs longer, and climb faster', prices: [200, 400] },
  { id: 'kick', name: 'Iron Kick', desc: '+1 damage for her spinning kick, which reaches wider', prices: [300, 500] },
  { id: 'triple', name: 'Triple Arrow', desc: 'Every power arrow flies with two more beside it', prices: [900] },
];

/** The level where Atalanta joins the team: her shop tab opens there. */
const ATALANTA_JOINS = LEVEL_ORDER.indexOf('harpies');

/** True once Jason has reached Gaia Nova (any chapter 2 region unlocked), or is playing there (or beyond) right now. */
export function gaiaReached(save: SaveData, deck?: DeckId): boolean {
  return save.unlocked > CHAPTER_DECKS[1].length || (!!deck && chapterOf(deck) >= 2);
}

/** True once chapter 3 is reached (any of its levels unlocked), or while playing in it. */
export function colchisReached(save: SaveData, deck?: DeckId): boolean {
  return save.unlocked > CHAPTER_DECKS[1].length + CHAPTER_DECKS[2].length || (!!deck && chapterOf(deck) >= 3);
}

/** True once Atalanta is on the team: the Harpy Isles finished, or playing there or later. */
export function atalantaJoined(save: SaveData, deck?: DeckId): boolean {
  return save.unlocked > ATALANTA_JOINS + 1 || (!!deck && LEVEL_ORDER.indexOf(deck) >= ATALANTA_JOINS);
}

/**
 * Which chapter's stock the shop shows (and which caps vault prizes respect). Chapter 3 keeps
 * chapter 2's upgrades and weapons, and adds Atalanta's upgrades and the outfits.
 */
export function shopChapter(save: SaveData, deck?: DeckId): Chapter {
  return colchisReached(save, deck) ? 3 : gaiaReached(save, deck) ? 2 : 1;
}

/** The highest level of each upgrade, per chapter: the ship's levels, then the Mk II ones from Gaia Nova on. */
export const UPGRADE_MAX = Object.fromEntries(
  CHAPTERS.map((ch) => [ch, Object.fromEntries(UPGRADES.map((u) => [u.id, u.prices.length + (ch >= 2 ? u.mk2.length : 0)]))]),
) as Record<Chapter, Record<UpgradeId, number>>;

/** The highest level of an upgrade this save can reach right now. */
export function upgradeCap(id: UpgradeId, save: SaveData, deck?: DeckId): number {
  return UPGRADE_MAX[shopChapter(save, deck)][id];
}

/** How many hearts Jason can have: 10, plus one for each level of Heart Plating Mk II. */
export function heartCap(save: SaveData): number {
  const mk2 = Math.max(0, (save.upgrades.heart ?? 0) - upgrade('heart').prices.length);
  return Math.min(MAX_HEARTS_MK2, MAX_HEARTS + mk2);
}

/**
 * An upgrade's level as the shop counts it. On Gaia Nova, if canisters and shards already filled
 * Jason up to 10 hearts, the ship's Heart Plating levels he skipped would add nothing, so the shop
 * goes straight to Mk II (which raises the limit).
 */
function levelOf(save: SaveData, item: Upgrade, ch: Chapter): number {
  const level = save.upgrades[item.id] ?? 0;
  if (item.id === 'heart' && ch >= 2 && level < item.prices.length && save.maxHearts >= MAX_HEARTS) return item.prices.length;
  return level;
}

export interface UpgradeOffer {
  item: Upgrade;
  level: number;
  max: number;
  /** How many of the levels are the ship's (the rest are Mk II). */
  base: number;
  /** Price of the next level, or null once maxed. */
  price: number | null;
}

export interface WeaponOffer {
  weapon: Weapon;
  owned: boolean;
  equipped: boolean;
  /** Price, or null once owned. */
  price: number | null;
}

export interface AtalantaOffer {
  item: AtalantaUpgrade;
  level: number;
  max: number;
  /** Price of the next level, or null once maxed. */
  price: number | null;
}

export interface OutfitOffer {
  outfit: Outfit;
  owned: boolean;
  /** The hero has it on right now. */
  worn: boolean;
  /** Price, or null once owned. */
  price: number | null;
}

export interface ShopStock {
  upgrades: UpgradeOffer[];
  weapons: WeaponOffer[];
  /** Atalanta's upgrades (empty until she has joined, in chapter 3). */
  atalanta: AtalantaOffer[];
  /** Outfits (empty before chapter 3; Atalanta's only once she has joined). */
  outfits: OutfitOffer[];
}

/** Everything on sale right now, with levels and prices for this save. */
export function shopStock(save: SaveData, deck?: DeckId): ShopStock {
  const ch = shopChapter(save, deck);
  const upgrades = UPGRADES.filter((item) => ch >= 2 || item.prices.length > 0).map((item) => {
    const level = levelOf(save, item, ch);
    const tiers = ch >= 2 ? [...item.prices, ...item.mk2] : item.prices;
    return { item, level, max: tiers.length, base: item.prices.length, price: level < tiers.length ? tiers[level] : null };
  });
  const owned = ownedWeapons(save.weapons);
  const weapons =
    ch === 1
      ? []
      : WEAPON_ORDER.map((id) => {
          const have = owned.includes(id);
          return { weapon: WEAPONS[id], owned: have, equipped: have && save.weapon === id, price: have ? null : WEAPONS[id].price };
        });
  const joined = ch >= 3 && atalantaJoined(save, deck);
  const atalanta = joined
    ? ATALANTA_UPGRADES.map((item) => {
        const level = Math.min(item.prices.length, save.ataUpgrades[item.id] ?? 0);
        return { item, level, max: item.prices.length, price: level < item.prices.length ? item.prices[level] : null };
      })
    : [];
  const outfits =
    ch >= 3
      ? OUTFITS.filter((o) => o.hero === 'jason' || joined).map((o) => {
          const owned = save.outfits.includes(o.id);
          return { outfit: o, owned, worn: owned && save.wearing[o.hero] === o.id, price: owned ? null : o.price };
        })
      : [];
  return { upgrades, weapons, atalanta, outfits };
}

/**
 * Raises an upgrade one level (bought or won in a vault), keeping max hearts in step with Heart
 * Plating. Returns false if it is already at this save's cap.
 */
export function levelUp(save: SaveData, id: UpgradeId, deck?: DeckId): boolean {
  const level = levelOf(save, upgrade(id), shopChapter(save, deck));
  if (level >= upgradeCap(id, save, deck)) return false;
  if (id === 'heart' && level < upgrade('heart').prices.length && save.maxHearts >= MAX_HEARTS) return false;
  save.upgrades[id] = level + 1;
  if (id === 'heart') save.maxHearts = Math.min(heartCap(save), save.maxHearts + 1);
  return true;
}

/** Buys the next level of an upgrade. Returns false if it is maxed or Jason can't afford it. */
export function buyUpgrade(save: SaveData, id: UpgradeId, deck?: DeckId): boolean {
  const offer = shopStock(save, deck).upgrades.find((o) => o.item.id === id);
  if (!offer || offer.price === null || cleanBolts(save.bolts) < offer.price) return false;
  const price = offer.price;
  if (!levelUp(save, id, deck)) return false;
  spendBolts(save, price);
  return true;
}

/** Buys a weapon and equips it. Returns false if it isn't on sale, is owned already, or costs too much. */
export function buyWeapon(save: SaveData, id: WeaponId, deck?: DeckId): boolean {
  const offer = shopStock(save, deck).weapons.find((o) => o.weapon.id === id);
  if (!offer || offer.price === null || !spendBolts(save, offer.price)) return false;
  save.weapons = ownedWeapons([...save.weapons, id]);
  save.weapon = id;
  return true;
}

/** Equips a weapon Jason owns. */
export function equipWeapon(save: SaveData, id: WeaponId): boolean {
  if (!ownedWeapons(save.weapons).includes(id)) return false;
  save.weapon = id;
  return true;
}

/** Buys the next level of one of Atalanta's upgrades. Returns false if it isn't on sale, is maxed, or costs too much. */
export function buyAtalantaUpgrade(save: SaveData, id: AtalantaUpgradeId, deck?: DeckId): boolean {
  const offer = shopStock(save, deck).atalanta.find((o) => o.item.id === id);
  if (!offer || offer.price === null || !spendBolts(save, offer.price)) return false;
  save.ataUpgrades[id] = offer.level + 1;
  return true;
}

/** Buys an outfit, and the hero puts it on straight away. Returns false if it isn't on sale, is owned already, or costs too much. */
export function buyOutfit(save: SaveData, id: OutfitId, deck?: DeckId): boolean {
  const offer = shopStock(save, deck).outfits.find((o) => o.outfit.id === id);
  if (!offer || offer.price === null || !spendBolts(save, offer.price)) return false;
  save.outfits = [...save.outfits, id];
  save.wearing[offer.outfit.hero] = id;
  return true;
}

/** Puts on an outfit the player owns (free). Returns false if it isn't owned. */
export function wearOutfit(save: SaveData, id: OutfitId): boolean {
  const o = OUTFITS.find((x) => x.id === id);
  if (!o || !save.outfits.includes(id)) return false;
  save.wearing[o.hero] = id;
  return true;
}

/** Back into the hero's usual suit (free). Returns false if they weren't wearing an outfit. */
export function takeOffOutfit(save: SaveData, hero: OutfitHero): boolean {
  if (!save.wearing[hero]) return false;
  delete save.wearing[hero];
  return true;
}
