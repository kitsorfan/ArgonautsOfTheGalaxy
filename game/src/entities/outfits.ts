import type { OutfitHero } from '../core/save';

/**
 * PANDORA's outfits (chapter 3): fancy clothes for Jason and Atalanta. They are only for looks: buy
 * one once, then put it on or take it off for free in the shop. An outfit repaints the hero's model
 * and adds a few pieces of its own (see outfitModels.ts); the upgrade gear stays on top of it.
 */

export type OutfitId = 'bronze' | 'fleece' | 'starlight' | 'captain' | 'artemis' | 'olympic' | 'ranger' | 'crystal';

/** Which little extra the shop's picture of the outfit shows (the model has the real pieces). */
export type OutfitExtra = 'crest' | 'fleece' | 'stars' | 'coat' | 'moon' | 'wreath' | 'hood' | 'crystal';

export interface Outfit {
  id: OutfitId;
  hero: OutfitHero;
  name: string;
  desc: string;
  price: number;
  /**
   * Colours of the shop's picture: suit, legs, boots and gloves, the metal or gold trim, the extra
   * piece, Jason's helmet and a cape.
   */
  look: { suit: string; legs: string; trim: string; accent: string; extra: string; head?: string; cape?: string };
  icon: OutfitExtra;
}

export const OUTFITS: Outfit[] = [
  {
    id: 'captain',
    hero: 'jason',
    name: 'Captain’s Coat',
    desc: 'Navy tails and gold buttons. Very captain-y.',
    price: 400,
    look: { suit: '#22336a', legs: '#2a2a36', trim: '#f4f4f4', accent: '#e8b840', extra: '#e8b840', head: '#25366a' },
    icon: 'coat',
  },
  {
    id: 'starlight',
    hero: 'jason',
    name: 'Starlight Explorer',
    desc: 'Night blue and full of twinkling stars.',
    price: 500,
    look: { suit: '#1b2350', legs: '#141a3a', trim: '#e8ecff', accent: '#9ff2ff', extra: '#c9a6ff', head: '#f4f6ff' },
    icon: 'stars',
  },
  {
    id: 'bronze',
    hero: 'jason',
    name: 'Argonaut Bronze',
    desc: 'Bronze armour and a red-crested helmet.',
    price: 600,
    look: { suit: '#c07a3a', legs: '#8a1f1f', trim: '#7a4a24', accent: '#d09a52', extra: '#e0302a', head: '#d09a52' },
    icon: 'crest',
  },
  {
    id: 'fleece',
    hero: 'jason',
    name: 'Golden Fleece Cape',
    desc: 'Royal blue, with a woolly golden cape.',
    price: 750,
    look: { suit: '#2f4fae', legs: '#1c2450', trim: '#ffcf5a', accent: '#ffcf5a', extra: '#f2c14e', head: '#f4ecd6', cape: '#f2c14e' },
    icon: 'fleece',
  },
  {
    id: 'ranger',
    hero: 'atalanta',
    name: 'Forest Ranger',
    desc: 'A moss-green hooded cloak. Good for sneaking.',
    price: 400,
    look: { suit: '#4f7a3a', legs: '#5a3f28', trim: '#9a7448', accent: '#a8743a', extra: '#6fbf4a', cape: '#2f5a2a' },
    icon: 'hood',
  },
  {
    id: 'artemis',
    hero: 'atalanta',
    name: 'Huntress of Artemis',
    desc: 'Moon silver, with a crescent on her brow.',
    price: 500,
    look: { suit: '#dde6f2', legs: '#3a4870', trim: '#f6f8ff', accent: '#cfd8e8', extra: '#f4f8ff', cape: '#1e2a5a' },
    icon: 'moon',
  },
  {
    id: 'olympic',
    hero: 'atalanta',
    name: 'Olympic Champion',
    desc: 'White and gold, a laurel wreath and a medal.',
    price: 600,
    look: { suit: '#fbf8ef', legs: '#efe4c8', trim: '#ffffff', accent: '#ffcf5a', extra: '#5f9a3a', cape: '#ffffff' },
    icon: 'wreath',
  },
  {
    id: 'crystal',
    hero: 'atalanta',
    name: 'Gardener’s Crystal Dress',
    desc: 'Glowing Gardener crystal, with a tiara.',
    price: 750,
    look: { suit: '#c8f6ff', legs: '#7fd8e8', trim: '#ffffff', accent: '#ffd6ff', extra: '#b07aff', cape: '#e6d6ff' },
    icon: 'crystal',
  },
];

export const OUTFIT: Record<OutfitId, Outfit> = Object.fromEntries(OUTFITS.map((o) => [o.id, o])) as Record<OutfitId, Outfit>;

/** The outfit with this id for this hero, or null (unknown ids, or another hero's outfit). */
export function outfitFor(hero: OutfitHero, id: string | undefined): Outfit | null {
  const o = id ? OUTFIT[id as OutfitId] : undefined;
  return o && o.hero === hero ? o : null;
}

/** Keeps only real outfit ids, once each, in shop order (for old or edited saves). */
export function knownOutfits(ids: string[]): OutfitId[] {
  return OUTFITS.filter((o) => ids.includes(o.id)).map((o) => o.id);
}
