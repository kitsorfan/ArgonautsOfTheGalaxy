/**
 * Jason's arsenal. The Blaster is his from the start; on Gaia Nova PANDORA sells five more, and he
 * can switch between the ones he owns at any time (the weapon button, or X on a keyboard).
 *
 * Every weapon has its own range, power, speed and ammo, and a special trick:
 * - range: how far its shots fly before they fizzle out (and how far auto-aim looks);
 * - power: damage per hit, as a share of the Blaster's (1 + Blaster Power);
 * - speed: how fast its shots fly and how quickly it fires again;
 * - ammo: its own clip and reload (each weapon keeps its clip when Jason switches). The Flamethrower
 *   has a fuel tank instead: it drains while it burns and fills up again when it rests.
 * Tap BLAST to shoot; hold it for a charged shot (the Flamethrower just keeps burning while held).
 *
 * Plain data only (no three.js), so the shop and the tests can use it.
 */

export type WeaponId = 'blaster' | 'spread' | 'frost' | 'thunder' | 'seeker' | 'flame';

/** The four stat bars in the shop and on the switch card, each 1 (low) to 5 (high). */
export interface WeaponBars {
  range: number;
  power: number;
  speed: number;
  ammo: number;
}

export interface Weapon {
  id: WeaponId;
  name: string;
  /** What PANDORA says about it in the shop. */
  desc: string;
  /** Its special trick, one short line under the stat bars. */
  special: string;
  /** Shop price in bolts (0 = owned from the start). */
  price: number;
  /** Damage per hit, as a share of the Blaster's (Flamethrower: damage per second of flame). */
  power: number;
  /** Shot speed in units per second (Flamethrower: how fast the flames roll out). */
  speed: number;
  /** How far a shot flies (units) before it fizzles out. */
  range: number;
  /** How far auto-aim looks for a target (units). */
  aim: number;
  /** Seconds between shots (Flamethrower: between damage ticks). Quick Reload shortens it. */
  cooldown: number;
  /** Shots per clip (Flamethrower: seconds of flame in a full tank). */
  clip: number;
  /** Extra clip per level of Bigger Clip. */
  clipStep: number;
  /** Seconds to reload a clip (Flamethrower: to refill an empty tank). Quick Reload shortens it. */
  reload: number;
  /** Shots per pull of the trigger (the Spread Shot's pellets). */
  pellets: number;
  /** Shots a charged shot uses up (0 = no charged shot). */
  chargeCost: number;
  bars: WeaponBars;
  /** Shot colours: the bright core and the glow around it. */
  core: string;
  glow: string;
  /** Pitch of the shot sound. */
  pitch: number;
}

export const WEAPONS: Record<WeaponId, Weapon> = {
  blaster: {
    id: 'blaster',
    name: 'Blaster',
    desc: 'Your trusty blaster. Good at everything.',
    special: 'Hold for a big fireball.',
    price: 0,
    power: 1,
    speed: 26,
    range: 22,
    aim: 12,
    cooldown: 0.28,
    clip: 6,
    clipStep: 2,
    reload: 1.5,
    pellets: 1,
    chargeCost: 3,
    bars: { range: 4, power: 2, speed: 4, ammo: 3 },
    core: '#bff4ff',
    glow: '#5ee0ff',
    pitch: 1,
  },
  spread: {
    id: 'spread',
    name: 'Spread Shot',
    desc: 'Five pellets in a fan. Get close and let rip!',
    special: 'Best up close.',
    price: 300,
    power: 0.5,
    speed: 24,
    range: 11,
    aim: 9,
    cooldown: 0.5,
    clip: 10,
    clipStep: 3,
    reload: 1.7,
    pellets: 5,
    chargeCost: 4,
    bars: { range: 2, power: 3, speed: 2, ammo: 4 },
    core: '#fff2b0',
    glow: '#ffb020',
    pitch: 0.8,
  },
  frost: {
    id: 'frost',
    name: 'Frost Ray',
    desc: 'Fast icy needles. Weak, but they slow enemies down.',
    special: 'Slows. Charged, it freezes!',
    price: 450,
    power: 0.5,
    speed: 28,
    range: 16,
    aim: 12,
    cooldown: 0.18,
    clip: 12,
    clipStep: 4,
    reload: 1.4,
    pellets: 1,
    chargeCost: 4,
    bars: { range: 3, power: 1, speed: 5, ammo: 5 },
    core: '#e8fbff',
    glow: '#7fd4ff',
    pitch: 1.35,
  },
  thunder: {
    id: 'thunder',
    name: 'Thunder Arc',
    desc: 'Slow, heavy bolts of lightning. Make every shot count!',
    special: 'Chains to more enemies.',
    price: 600,
    power: 1.6,
    speed: 34,
    range: 15,
    aim: 12,
    cooldown: 0.65,
    clip: 4,
    clipStep: 1,
    reload: 1.9,
    pellets: 1,
    chargeCost: 2,
    bars: { range: 3, power: 4, speed: 2, ammo: 1 },
    core: '#fffbd0',
    glow: '#c58cff',
    pitch: 1.15,
  },
  seeker: {
    id: 'seeker',
    name: 'Seeker',
    desc: 'Slow homing orbs that fly a long, long way.',
    special: 'Never misses.',
    price: 750,
    power: 1.3,
    speed: 13,
    range: 30,
    aim: 18,
    cooldown: 0.55,
    clip: 5,
    clipStep: 1,
    reload: 2,
    pellets: 1,
    chargeCost: 2,
    bars: { range: 5, power: 3, speed: 1, ammo: 2 },
    core: '#ffd0e0',
    glow: '#ff4f8a',
    pitch: 0.7,
  },
  flame: {
    id: 'flame',
    name: 'Flamethrower',
    desc: 'A roaring cone of fire, for as long as you hold BLAST.',
    special: 'Burns enemies and brambles.',
    price: 950,
    power: 4.5,
    speed: 11,
    range: 5.5,
    aim: 6.5,
    cooldown: 0.2,
    clip: 3.5,
    clipStep: 0.7,
    reload: 4,
    pellets: 1,
    chargeCost: 0,
    bars: { range: 1, power: 5, speed: 4, ammo: 3 },
    core: '#fff1c4',
    glow: '#ff7a1a',
    pitch: 0.6,
  },
};

/** Shop and switching order. */
export const WEAPON_ORDER: WeaponId[] = ['blaster', 'spread', 'frost', 'thunder', 'seeker', 'flame'];

/** Frost Ray: how long a shot chills an enemy (and how much it slows it), and how long a charged shot freezes it. */
export const FROST = { chill: 3, slow: 0.5, freeze: 2, bossChill: 1.2, bossSlow: 0.75 };

/** Thunder Arc: how many more enemies the lightning jumps to, how far, and how hard it hits them (share of the shot). */
export const THUNDER = { jumps: 2, chargedJumps: 4, range: 6.5, power: 0.6 };

/** Seeker: how fast its shots turn (radians per second), and how far around it looks for a new target. */
export const SEEKER = { turn: 7, search: 11 };

/** Spread Shot: the angle between neighbouring pellets (radians), and between its charged fireballs. */
export const SPREAD = { angle: 0.15, chargedAngle: 0.31 };

/**
 * Flamethrower: the cone's half-angle (radians); a tap's short puff (seconds); how long the tank rests
 * before refilling; how full it must be again after running dry; and burning: how long it lasts, how
 * much it hurts per second (share of the Blaster's damage), and the share bosses keep (they burn out fast).
 */
export const FLAME = { cone: 0.5, puff: 0.3, rest: 0.5, dryAt: 0.3, burn: 3, burnDps: 0.8, bossBurn: 0.35 };

export function isWeapon(id: string): id is WeaponId {
  return (WEAPON_ORDER as string[]).includes(id);
}

/** The weapons a save owns, in switching order (the Blaster is always there). */
export function ownedWeapons(owned: readonly string[] | undefined): WeaponId[] {
  return WEAPON_ORDER.filter((w) => w === 'blaster' || (owned ?? []).includes(w));
}

/** The next owned weapon after `current`, wrapping round to the Blaster. */
export function nextWeapon(owned: readonly string[] | undefined, current: string | undefined): WeaponId {
  const list = ownedWeapons(owned);
  const i = list.indexOf(current as WeaponId);
  return list[(i + 1) % list.length];
}

/** The equipped weapon, falling back to the Blaster if the save names one it doesn't own. */
export function equippedWeapon(owned: readonly string[] | undefined, current: string | undefined): WeaponId {
  const list = ownedWeapons(owned);
  return list.includes(current as WeaponId) ? (current as WeaponId) : 'blaster';
}

/** Upgrade levels that change a weapon's numbers. */
export interface ArmsUpgrades {
  blaster?: number;
  clip?: number;
  rapid?: number;
}

/** A weapon's clip with Bigger Clip (Flamethrower: seconds of fuel in the tank). */
export function clipOf(id: WeaponId, up: ArmsUpgrades = {}): number {
  const w = WEAPONS[id];
  return w.clip + (up.clip ?? 0) * w.clipStep;
}

/** Seconds to reload a clip (or refill an empty tank), with Quick Reload. */
export function reloadOf(id: WeaponId, up: ArmsUpgrades = {}): number {
  return WEAPONS[id].reload * (1 - (up.rapid ?? 0) * 0.2);
}

/** Seconds between shots, with Quick Reload. */
export function cooldownOf(id: WeaponId, up: ArmsUpgrades = {}): number {
  return WEAPONS[id].cooldown * Math.max(0.4, 1 - (up.rapid ?? 0) * 0.15);
}

/** Damage of one hit (Flamethrower: per second of flame), with Blaster Power. */
export function damageOf(id: WeaponId, up: ArmsUpgrades = {}): number {
  return (1 + (up.blaster ?? 0)) * WEAPONS[id].power;
}

/** Damage of a charged shot (a fireball), with Blaster Power. */
export function chargedDamageOf(id: WeaponId, up: ArmsUpgrades = {}): number {
  return (4 + (up.blaster ?? 0) * 2) * WEAPONS[id].power;
}

/** The flame's damage per tick, and a burning enemy's damage per second. */
export function flameTick(up: ArmsUpgrades = {}): number {
  return damageOf('flame', up) * cooldownOf('flame', up);
}

export function burnDps(up: ArmsUpgrades = {}): number {
  return (1 + (up.blaster ?? 0)) * FLAME.burnDps;
}

/**
 * The Flamethrower's tank, one step of `dt` seconds: it drains while burning, rests a moment after the
 * trigger is let go, then refills (a full tank in `reloadOf` seconds). Running dry locks it until the
 * tank is back to FLAME.dryAt. Pure, so the tests can drive it.
 */
export interface Tank {
  fuel: number;
  dry: boolean;
  rest: number;
}

export function stepTank(t: Tank, firing: boolean, dt: number, up: ArmsUpgrades = {}): Tank {
  return stepFuel(t, firing, dt, clipOf('flame', up), reloadOf('flame', up));
}

/** Any fuel tank (Jason's, or the bronze mech's bigger one): `max` seconds of fire, refilled in `refill` seconds. */
export function stepFuel(t: Tank, firing: boolean, dt: number, max: number, refill: number): Tank {
  if (firing && !t.dry && t.fuel > 0) {
    const fuel = Math.max(0, t.fuel - dt);
    return { fuel, dry: fuel <= 0, rest: FLAME.rest };
  }
  if (t.rest > 0) return { ...t, rest: Math.max(0, t.rest - dt) };
  const fuel = Math.min(max, t.fuel + (max / refill) * dt);
  return { fuel, dry: t.dry && fuel < max * FLAME.dryAt, rest: 0 };
}
