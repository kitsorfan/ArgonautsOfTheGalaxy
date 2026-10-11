import { ATALANTA, MAX_HEARTS, MAX_HEARTS_MK2, PLAYER } from '../src/core/constants';
import { addBolts, cleanBolts, migrateSave, newSave, spendBolts, type SaveData, type UpgradeId } from '../src/core/save';
import { atalantaStats } from '../src/entities/heroes/atalantaStats';
import { OUTFITS } from '../src/entities/outfits';
import { difficultyFor } from '../src/game/difficulty';
import { givePrize, payQuests, shardMilestone } from '../src/game/quests';
import {
  ATALANTA_UPGRADES,
  UPGRADES,
  UPGRADE_MAX,
  atalantaJoined,
  buyAtalantaUpgrade,
  buyOutfit,
  buyUpgrade,
  buyWeapon,
  heartCap,
  shopChapter,
  shopStock,
  takeOffOutfit,
  upgradeCap,
  wearOutfit,
} from '../src/game/shop';
import { CHAPTER_DECKS, LEVEL_ORDER } from '../src/levels';

// newSave() reads navigator for its quality default; give Jest a stand-in.
beforeAll(() => {
  (globalThis as { navigator?: unknown }).navigator ??= { hardwareConcurrency: 8 };
});

const NEW: UpgradeId[] = ['armor', 'dashCell', 'spinCharge', 'grapple'];

/** A save with every ship upgrade maxed and 10 hearts: the usual state at the end of chapter 1. */
function maxedShip(onGaia: boolean): SaveData {
  const s = newSave();
  for (const u of UPGRADES) if (u.prices.length) s.upgrades[u.id] = u.prices.length;
  s.maxHearts = MAX_HEARTS;
  if (onGaia) s.unlocked = CHAPTER_DECKS[1].length + 1;
  return s;
}

describe('upgrade caps per chapter', () => {
  it('keeps the ship’s caps in chapter 1, exactly as before', () => {
    expect(UPGRADE_MAX[1]).toMatchObject({ heart: 3, blaster: 2, rapid: 2, clip: 2, boltZap: 2, magnet: 2 });
    for (const id of NEW) expect(UPGRADE_MAX[1][id]).toBe(0);
  });

  it('adds Mk II levels and four new upgrades on Gaia Nova', () => {
    for (const u of UPGRADES) expect(UPGRADE_MAX[2][u.id]).toBeGreaterThan(UPGRADE_MAX[1][u.id]);
    expect(UPGRADE_MAX[2]).toMatchObject({ heart: 5, blaster: 3, rapid: 3, clip: 3, boltZap: 3, magnet: 3 });
    for (const id of NEW) expect(UPGRADE_MAX[2][id]).toBeGreaterThan(0);
  });

  it('prices every Mk II level above the ship’s levels', () => {
    for (const u of UPGRADES) {
      const all = [...u.prices, ...u.mk2];
      for (let i = 1; i < all.length; i++) expect(all[i]).toBeGreaterThan(all[i - 1]);
    }
  });

  it('opens the chapter 2 stock once Gaia Nova is reached, or while playing there', () => {
    expect(shopChapter(newSave())).toBe(1);
    expect(shopChapter(newSave(), 'desert')).toBe(2);
    expect(shopChapter(maxedShip(true))).toBe(2);
    expect(upgradeCap('blaster', maxedShip(false))).toBe(2);
    expect(upgradeCap('blaster', maxedShip(true))).toBe(3);
  });
});

describe('the shop', () => {
  it('has nothing left to buy at the end of chapter 1', () => {
    const s = maxedShip(false);
    s.bolts = 99999;
    const stock = shopStock(s, 'bridge');
    expect(stock.upgrades.map((o) => o.item.id)).not.toContain('armor');
    expect(stock.upgrades.every((o) => o.price === null)).toBe(true);
    expect(buyUpgrade(s, 'blaster', 'bridge')).toBe(false);
  });

  it('sells Mk II levels and the new upgrades on Gaia Nova', () => {
    const s = maxedShip(true);
    s.bolts = 99999;
    const stock = shopStock(s, 'plains');
    expect(stock.upgrades).toHaveLength(UPGRADES.length);
    expect(stock.upgrades.every((o) => o.price !== null)).toBe(true);
    expect(buyUpgrade(s, 'blaster', 'plains')).toBe(true);
    expect(s.upgrades.blaster).toBe(3);
    expect(buyUpgrade(s, 'blaster', 'plains')).toBe(false);
    expect(buyUpgrade(s, 'armor', 'plains')).toBe(true);
    expect(s.upgrades.armor).toBe(1);
  });

  it('raises the heart limit with Heart Plating Mk II, up to 12', () => {
    const s = maxedShip(true);
    s.bolts = 99999;
    expect(heartCap(s)).toBe(MAX_HEARTS);
    expect(buyUpgrade(s, 'heart')).toBe(true);
    expect(s.maxHearts).toBe(MAX_HEARTS + 1);
    expect(buyUpgrade(s, 'heart')).toBe(true);
    expect(s.maxHearts).toBe(MAX_HEARTS_MK2);
    expect(buyUpgrade(s, 'heart')).toBe(false);
    expect(heartCap(s)).toBe(MAX_HEARTS_MK2);
  });

  it('goes straight to Mk II hearts if canisters already filled Jason up to 10', () => {
    const s = maxedShip(true);
    s.upgrades.heart = 1;
    s.bolts = 99999;
    const offer = shopStock(s).upgrades.find((o) => o.item.id === 'heart');
    expect(offer?.level).toBe(3);
    expect(buyUpgrade(s, 'heart')).toBe(true);
    expect(s.upgrades.heart).toBe(4);
    expect(s.maxHearts).toBe(MAX_HEARTS + 1);
  });

  it('lets canisters and pages fill the extra heart slots only after Mk II', () => {
    const s = maxedShip(true);
    for (let i = 1; i <= 6; i++) s.shards.push(`${CHAPTER_DECKS[2][0]}.s${i}`);
    shardMilestone(s, CHAPTER_DECKS[2][0]);
    expect(s.maxHearts).toBe(MAX_HEARTS);
  });
});

describe('vault prizes', () => {
  it('never go past the shop’s cap for the chapter', () => {
    const ship = maxedShip(false);
    const before = ship.bolts;
    givePrize('blaster', ship, 'bridge');
    expect(ship.upgrades.blaster).toBe(2);
    expect(ship.bolts).toBeGreaterThan(before);
    const gaia = maxedShip(true);
    expect(givePrize('blaster', gaia, 'volcano')).toContain('Blaster Power');
    expect(gaia.upgrades.blaster).toBe(3);
    givePrize('blaster', gaia, 'volcano');
    expect(gaia.upgrades.blaster).toBe(3);
    givePrize('heart', gaia, 'snow');
    expect(gaia.maxHearts).toBe(MAX_HEARTS + 1);
  });
});

describe('difficulty with Mk II', () => {
  it('counts Mk II weapon levels a little less than the ship’s', () => {
    const s = maxedShip(true);
    const base = difficultyFor(8, s).tier;
    s.upgrades.blaster = 3;
    const up = difficultyFor(8, s).tier - base;
    expect(up).toBeGreaterThan(0);
    expect(up).toBeLessThan(0.5);
  });
});

/** A save that has reached chapter 3 (with chapter 2's upgrades maxed) and has Atalanta on the team. */
function inColchis(): SaveData {
  const s = maxedShip(true);
  s.unlocked = LEVEL_ORDER.indexOf('harpies') + 2;
  s.bolts = 99999;
  return s;
}

describe('chapter 3 stock', () => {
  it('opens once chapter 3 is reached, and keeps chapter 2’s upgrades and weapons', () => {
    expect(shopChapter(newSave(), 'harpies')).toBe(3);
    expect(shopChapter(inColchis())).toBe(3);
    expect(shopChapter(maxedShip(true))).toBe(2);
    expect(upgradeCap('blaster', inColchis())).toBe(3);
    const stock = shopStock(inColchis(), 'reef');
    expect(stock.upgrades).toHaveLength(UPGRADES.length);
    expect(stock.weapons.length).toBeGreaterThan(0);
  });

  it('sells nothing for Atalanta and no outfits before chapter 3', () => {
    for (const [s, deck] of [[maxedShip(false), 'bridge'], [maxedShip(true), 'volcano']] as const) {
      const stock = shopStock(s, deck);
      expect(stock.atalanta).toEqual([]);
      expect(stock.outfits).toEqual([]);
    }
  });

  it('opens Atalanta’s tab and her outfits once she has joined (the Harpy Isles on)', () => {
    const early = newSave();
    early.unlocked = LEVEL_ORDER.indexOf('rocks') + 1;
    expect(atalantaJoined(early, 'rocks')).toBe(false);
    const before = shopStock(early, 'rocks');
    expect(before.atalanta).toEqual([]);
    expect(before.outfits.every((o) => o.outfit.hero === 'jason')).toBe(true);
    expect(before.outfits.length).toBeGreaterThanOrEqual(4);
    expect(atalantaJoined(early, 'harpies')).toBe(true);
    expect(shopStock(early, 'harpies').atalanta).toHaveLength(ATALANTA_UPGRADES.length);
    // Back on an old deck later on, the stock is still there.
    expect(shopStock(inColchis(), 'cryo').atalanta).toHaveLength(ATALANTA_UPGRADES.length);
  });
});

describe('Atalanta’s upgrades', () => {
  it('have 1 to 3 levels each, priced like the Mk II stock and rising', () => {
    expect(ATALANTA_UPGRADES.length).toBeGreaterThanOrEqual(4);
    for (const u of ATALANTA_UPGRADES) {
      expect(u.prices.length).toBeGreaterThanOrEqual(1);
      expect(u.prices.length).toBeLessThanOrEqual(3);
      for (const p of u.prices) {
        expect(p).toBeGreaterThanOrEqual(200);
        expect(p).toBeLessThanOrEqual(900);
      }
      for (let i = 1; i < u.prices.length; i++) expect(u.prices[i]).toBeGreaterThan(u.prices[i - 1]);
    }
    expect(ATALANTA_UPGRADES.filter((u) => u.prices.length >= 2).length).toBeGreaterThanOrEqual(4);
  });

  it('are bought a level at a time, until maxed or the bolts run out', () => {
    const s = inColchis();
    const [p1, p2, p3] = ATALANTA_UPGRADES.find((u) => u.id === 'bow')?.prices ?? [];
    expect(buyAtalantaUpgrade(s, 'bow', 'harpies')).toBe(true);
    expect(s.ataUpgrades.bow).toBe(1);
    expect(s.bolts).toBe(99999 - p1);
    expect(buyAtalantaUpgrade(s, 'bow', 'harpies')).toBe(true);
    expect(buyAtalantaUpgrade(s, 'bow', 'harpies')).toBe(true);
    expect(s.bolts).toBe(99999 - p1 - p2 - p3);
    expect(buyAtalantaUpgrade(s, 'bow', 'harpies')).toBe(false);
    expect(shopStock(s, 'harpies').atalanta.find((o) => o.item.id === 'bow')?.price).toBeNull();
    s.bolts = 10;
    expect(buyAtalantaUpgrade(s, 'kick', 'harpies')).toBe(false);
    expect(s.ataUpgrades.kick).toBeUndefined();
    // Not on sale before she joins.
    const early = newSave();
    early.bolts = 99999;
    expect(buyAtalantaUpgrade(early, 'bow', 'rocks')).toBe(false);
  });

  it('change her stats', () => {
    const base = atalantaStats({});
    expect(base).toMatchObject({
      speed: ATALANTA.speed,
      sprintSpeed: ATALANTA.sprintSpeed,
      climbGrip: ATALANTA.climbGrip,
      chargeTime: ATALANTA.chargeTime,
      kickRadius: PLAYER.spinRadius,
      arrowDamage: 0,
      powerDamage: 0,
      kickDamage: 0,
      triple: false,
    });
    const up = atalantaStats({ bow: 3, draw: 2, sandals: 2, gloves: 2, kick: 2, triple: 1 });
    expect(up.arrowDamage).toBeGreaterThan(0);
    expect(up.powerDamage).toBe(3);
    expect(up.chargeTime).toBeLessThan(base.chargeTime);
    expect(up.arrowCooldown).toBeLessThan(base.arrowCooldown);
    expect(up.powerCooldown).toBeLessThan(base.powerCooldown);
    expect(up.sprintSpeed).toBeGreaterThan(base.sprintSpeed);
    expect(up.sprintBuild).toBeLessThan(base.sprintBuild);
    expect(up.speed).toBeGreaterThan(base.speed);
    expect(up.climbGrip).toBeGreaterThan(base.climbGrip);
    expect(up.climbSpeed).toBeGreaterThan(base.climbSpeed);
    expect(up.kickDamage).toBe(2);
    expect(up.kickRadius).toBeGreaterThan(base.kickRadius);
    expect(up.triple).toBe(true);
    // Each level counts.
    expect(atalantaStats({ gloves: 1 }).climbGrip).toBeGreaterThan(base.climbGrip);
    expect(atalantaStats({ gloves: 2 }).climbGrip).toBeGreaterThan(atalantaStats({ gloves: 1 }).climbGrip);
  });
});

describe('outfits', () => {
  it('has at least four for each hero, with unique ids', () => {
    for (const hero of ['jason', 'atalanta'] as const) expect(OUTFITS.filter((o) => o.hero === hero).length).toBeGreaterThanOrEqual(4);
    expect(new Set(OUTFITS.map((o) => o.id)).size).toBe(OUTFITS.length);
    for (const o of OUTFITS) expect(o.price).toBeGreaterThan(0);
  });

  it('are bought once and put on straight away', () => {
    const s = inColchis();
    const price = OUTFITS.find((o) => o.id === 'bronze')?.price ?? 0;
    expect(buyOutfit(s, 'bronze', 'reef')).toBe(true);
    expect(s.bolts).toBe(99999 - price);
    expect(s.outfits).toEqual(['bronze']);
    expect(s.wearing.jason).toBe('bronze');
    expect(buyOutfit(s, 'bronze', 'reef')).toBe(false);
    expect(s.bolts).toBe(99999 - price);
    const offer = shopStock(s, 'reef').outfits.find((o) => o.outfit.id === 'bronze');
    expect(offer).toMatchObject({ owned: true, worn: true, price: null });
    s.bolts = 1;
    expect(buyOutfit(s, 'artemis', 'reef')).toBe(false);
  });

  it('go on and come off for free, one per hero', () => {
    const s = inColchis();
    buyOutfit(s, 'bronze', 'reef');
    buyOutfit(s, 'captain', 'reef');
    buyOutfit(s, 'olympic', 'reef');
    const bolts = s.bolts;
    expect(s.wearing).toEqual({ jason: 'captain', atalanta: 'olympic' });
    expect(wearOutfit(s, 'bronze')).toBe(true);
    expect(s.wearing).toEqual({ jason: 'bronze', atalanta: 'olympic' });
    expect(wearOutfit(s, 'artemis')).toBe(false);
    expect(takeOffOutfit(s, 'jason')).toBe(true);
    expect(takeOffOutfit(s, 'jason')).toBe(false);
    expect(s.wearing).toEqual({ atalanta: 'olympic' });
    expect(s.bolts).toBe(bolts);
  });
});

describe('saves with chapter 3’s shop', () => {
  it('keep Atalanta’s upgrades and the outfits', () => {
    const s = inColchis();
    buyAtalantaUpgrade(s, 'gloves', 'reef');
    buyOutfit(s, 'starlight', 'reef');
    buyOutfit(s, 'crystal', 'reef');
    const back = migrateSave(JSON.parse(JSON.stringify(s)) as SaveData);
    expect(back.ataUpgrades).toEqual({ gloves: 1 });
    expect(back.outfits).toEqual(['starlight', 'crystal']);
    expect(back.wearing).toEqual({ jason: 'starlight', atalanta: 'crystal' });
  });

  it('give old saves the new fields', () => {
    const old = JSON.parse(JSON.stringify(newSave())) as Partial<SaveData>;
    delete old.ataUpgrades;
    delete old.outfits;
    delete old.wearing;
    const s = migrateSave(old as SaveData);
    expect(s.ataUpgrades).toEqual({});
    expect(s.outfits).toEqual([]);
    expect(s.wearing).toEqual({});
  });

  it('drop unknown outfits, and anything worn that isn’t owned or is the other hero’s', () => {
    const s = migrateSave({ ...newSave(), outfits: ['ranger', 'tuxedo', 'bronze', 'ranger'], wearing: { jason: 'ranger', atalanta: 'ranger' } });
    expect(s.outfits).toEqual(['bronze', 'ranger']);
    expect(s.wearing).toEqual({ atalanta: 'ranger' });
    const t = migrateSave({ ...newSave(), outfits: [], wearing: { jason: 'bronze' } });
    expect(t.wearing).toEqual({});
  });
});

describe('bolts are always a whole number, never below zero', () => {
  it('a broken count in a loaded save gets repaired', () => {
    const load = (bolts: unknown) => migrateSave(JSON.parse(JSON.stringify({ ...newSave(), bolts })) as SaveData).bolts;
    expect(load(41.6)).toBe(42);
    expect(load(12.35)).toBe(12);
    expect(load(-30)).toBe(0);
    expect(load(-0.4)).toBe(0);
    expect(load(NaN)).toBe(0); // JSON turns NaN into null
    expect(load(undefined)).toBe(0);
    expect(load('75')).toBe(75);
    expect(load('lots')).toBe(0);
    expect(load(250)).toBe(250);
  });

  it('buying never goes below zero, even from a broken count', () => {
    const price = shopStock(newSave()).upgrades[0].price ?? 0;
    for (const bolts of [0, price - 1, price - 0.6, NaN, -5]) {
      const s = newSave();
      s.bolts = bolts;
      expect(buyUpgrade(s, UPGRADES[0].id)).toBe(false);
      expect(s.upgrades).toEqual({});
    }
    const s = newSave();
    s.bolts = price + 0.4;
    expect(buyUpgrade(s, UPGRADES[0].id)).toBe(true);
    expect(s.bolts).toBe(0);
    const gaia = maxedShip(true);
    gaia.bolts = NaN;
    expect(buyWeapon(gaia, 'spread', CHAPTER_DECKS[2][0])).toBe(false);
    expect(spendBolts(gaia, 10)).toBe(false);
    gaia.bolts = 7;
    expect(spendBolts(gaia, 10)).toBe(false);
    expect(gaia.bolts).toBe(7);
  });

  it('a reward or a snatch scaled by a fractional tier stays whole', () => {
    const s = maxedShip(true);
    s.upgrades.blaster = 3;
    const tier = difficultyFor(15, s).tier;
    expect(Number.isInteger(tier)).toBe(false);
    s.bolts = 100;
    addBolts(s, 5 * (1 + tier * 0.1));
    expect(Number.isInteger(s.bolts)).toBe(true);
    addBolts(s, -(5 + tier));
    expect(Number.isInteger(s.bolts)).toBe(true);
    addBolts(s, -1000);
    expect(s.bolts).toBe(0);
    addBolts(s, NaN);
    expect(s.bolts).toBe(0);
  });

  it('prizes and quest pay keep a broken count whole', () => {
    const s = newSave();
    s.bolts = 10.5;
    givePrize('bolts', s);
    expect(s.bolts).toBe(311);
    payQuests(LEVEL_ORDER[0], s);
    expect(Number.isInteger(s.bolts)).toBe(true);
    expect(cleanBolts(-3.2)).toBe(0);
    expect(cleanBolts(Infinity)).toBe(0);
  });
});
