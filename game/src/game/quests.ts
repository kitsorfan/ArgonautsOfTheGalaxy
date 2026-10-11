import { tr } from '../core/i18n';
import { addBolts, type SaveData, type UpgradeId } from '../core/save';
import { LEVELS, chapterOf, chapterTotals, inChapter } from '../levels';
import type { DeckId, LevelDef } from '../world/levelTypes';
import { flightQuests } from '../vehicles/quests';
import { diveQuests } from '../vehicles/sub/quests';
import { findKind, plannedFinds, rescueKind } from './collectibles';
import { heartCap, levelUp } from './shop';

/**
 * Side quests and rewards. Every deck has the same four side quests: rescue its colonists, find
 * its memory shards, find its heart canister and crack its secret vault. Finishing one pays out
 * straight away, so collecting things always feels worth it.
 */

export const COLONIST_BOLTS = 25;
export const QUEST_BOLTS = 50;
export const SHARDS_PER_HEART = 6;

export interface Quest {
  id: string;
  text: string;
  done: boolean;
  progress: string;
  reward: string;
  /** Bolts paid out when it's done (the flight levels' quests; the classic four pay as below). */
  pay?: number;
}

const UPGRADE_NAME: Record<UpgradeId, string> = {
  blaster: 'Blaster Power +1',
  rapid: 'Quick Reload',
  clip: 'Bigger Clip (+2 shots)',
  boltZap: 'LUX Zapper',
  magnet: 'Bolt Magnet',
  heart: '+1 max heart',
  armor: 'Armor Plating',
  dashCell: 'Dash Cell',
  spinCharge: 'Spin Charge',
  grapple: 'Grapple Range',
};

/** Shop upgrade levels per chapter (vault prizes never go past the shop's maximum). */
export { UPGRADE_MAX } from './shop';

function entities(def: LevelDef, type: string) {
  return Object.values(def.legend).filter((s) => s.type === type);
}

function vaultReward(def: LevelDef): string {
  const prize = Object.values(def.legend).find((s) => s.type === 'prize');
  if (!prize || prize.type !== 'prize') return '';
  return prize.reward === 'bolts' ? tr('300 bolts') : tr(UPGRADE_NAME[prize.reward]);
}

export function deckQuests(id: DeckId, save: SaveData): Quest[] {
  const def = LEVELS[id];
  // A flight has its own quests: rings, drones and the dove's timing (a dive: rings, buoys and pearls).
  if (def.vehicle === 'sub') return diveQuests(id, def, save);
  if (def.vehicle) return flightQuests(id, def, save);
  const ch = chapterOf(id);
  const rescue = rescueKind(ch);
  const find = findKind(ch);
  const out: Quest[] = [];
  const cols = def.colonistIds ?? [];
  const freed = cols.filter((c) => save.colonists.includes(`${id}.${c}`)).length;
  // A level with nobody to rescue, or nothing of the kind to find, skips that quest (General Brennus's mine).
  if (cols.length) {
    out.push({
      id: `${id}:colonists`,
      text:
        rescue === 'scientist'
          ? tr('Free the captured scientists (blast their thorn cocoons)')
          : rescue === 'supplies'
            ? tr('Win back the stolen supplies (blast the gold harpy nets)')
            : tr('Free the trapped colonists (blast their pink cocoons)'),
      done: freed === cols.length,
      progress: `${freed} / ${cols.length}`,
      reward: tr('+{each} bolts each, +{bonus} bonus', { each: COLONIST_BOLTS, bonus: QUEST_BOLTS }),
    });
  }
  const found = def.shardIds.filter((s) => save.shards.includes(`${id}.${s}`)).length;
  if (def.shardIds.length) {
    out.push({
      id: `${id}:shards`,
      text:
        find === 'page'
          ? tr('Find the pages of Brennus’s journal (glowing gold pages)')
          : find === 'stone'
            ? tr('Find the Gardener light-stones (glowing rainbow stones)')
            : tr('Find the memory shards (glowing pink crystals)'),
      done: found === def.shardIds.length,
      progress: `${found} / ${def.shardIds.length}`,
      reward: tr('+{bonus} bolts · every {n} give a heart', { bonus: QUEST_BOLTS, n: SHARDS_PER_HEART }),
    });
  }
  if (entities(def, 'canister').length) {
    const got = save.canisters.some((c) => c.startsWith(`${id}.`));
    out.push({ id: `${id}:canister`, text: tr('Find the hidden heart canister'), done: got, progress: got ? '1 / 1' : '0 / 1', reward: tr('+1 max heart') });
  }
  const vault = Object.values(def.legend).find((s) => s.type === 'prize');
  if (vault && vault.type === 'prize') {
    const open = (save.prizes ?? []).includes(`${id}.${vault.id}`);
    out.push({ id: `${id}:vault`, text: tr('Crack the secret vault'), done: open, progress: open ? tr('opened') : tr('locked'), reward: vaultReward(def) });
  }
  return out;
}

/** Pays out any side quest on this deck that just got finished. Returns the reward messages. */
export function payQuests(id: DeckId, save: SaveData): string[] {
  const done = (save.quests ??= []);
  const out: string[] = [];
  for (const q of deckQuests(id, save)) {
    if (!q.done || done.includes(q.id)) continue;
    done.push(q.id);
    const ch = chapterOf(id);
    const rescue = rescueKind(ch);
    const find = findKind(ch);
    if (q.pay) {
      addBolts(save, q.pay);
      out.push(tr('Side quest done! +{n} bolts', { n: q.pay }));
    } else if (q.id.endsWith(':colonists')) {
      addBolts(save, QUEST_BOLTS);
      out.push(
        rescue === 'scientist'
          ? tr('Side quest done: every scientist here is free! +{n} bolts', { n: QUEST_BOLTS })
          : rescue === 'supplies'
            ? tr('Side quest done: everything stolen here is back! +{n} bolts', { n: QUEST_BOLTS })
            : tr('Side quest done: every colonist on this deck is free! +{n} bolts', { n: QUEST_BOLTS }),
      );
    } else if (q.id.endsWith(':shards')) {
      addBolts(save, QUEST_BOLTS);
      out.push(
        find === 'page'
          ? tr('Side quest done: every journal page here found! +{n} bolts', { n: QUEST_BOLTS })
          : find === 'stone'
            ? tr('Side quest done: every light-stone here found! +{n} bolts', { n: QUEST_BOLTS })
            : tr('Side quest done: all memory shards here found! +{n} bolts', { n: QUEST_BOLTS }),
      );
    }
  }
  return out;
}

/**
 * Every few shards of a chapter give Jason another heart. All 18 memory shards teach LUX GaScu's
 * language; all 18 journal pages tell Brennus's whole story; all 21 Gardener light-stones (chapter 3,
 * counted against the whole planned chapter) teach LUX and IRIS all of Celestia's language. Counted
 * per chapter (`deck` is where the shard was found).
 */
export function shardMilestone(save: SaveData, deck: DeckId): string | null {
  const ch = chapterOf(deck);
  const n = inChapter(save.shards, ch);
  const total = plannedFinds(ch, chapterTotals(ch).shards);
  const find = findKind(ch);
  if (!total) return null;
  if (n === total) {
    if (find === 'stone') return tr('ALL {n} light-stones! LUX and IRIS can speak every word of Celestia’s language!', { n });
    return find === 'shard' ? tr('ALL 18 memory shards! LUX has learned GaScu’s light-language...') : tr('ALL 18 journal pages! Now you know Brennus’s whole story...');
  }
  if (n % SHARDS_PER_HEART === 0) {
    save.maxHearts = Math.min(heartCap(save), save.maxHearts + 1);
    if (find === 'stone') return tr('{n} light-stones! +1 max heart', { n });
    return find === 'shard' ? tr('{n} memory shards! +1 max heart', { n }) : tr('{n} journal pages! +1 max heart', { n });
  }
  const left = SHARDS_PER_HEART - (n % SHARDS_PER_HEART);
  if (find === 'stone') return tr('Light-stone {n} / {total} · {left} more for an extra heart', { n, total, left });
  return find === 'shard' ? tr('Memory shard {n} / 18 · {left} more for an extra heart', { n, left }) : tr('Journal page {n} / 18 · {left} more for an extra heart', { n, left });
}

/**
 * Applies a vault prize: a free level of an upgrade, never past what the shop sells in this chapter
 * (on Gaia Nova that includes the Mk II levels). Returns what Jason got.
 */
export function givePrize(reward: string, save: SaveData, deck?: DeckId): string {
  if (reward === 'bolts') {
    addBolts(save, 300);
    return tr('VAULT PRIZE: 300 bolts!');
  }
  const id = reward as UpgradeId;
  if (!levelUp(save, id, deck)) {
    addBolts(save, 150);
    return tr('VAULT PRIZE: 150 bolts ({name} is already maxed)', { name: tr(UPGRADE_NAME[id]) });
  }
  return tr('VAULT PRIZE: free upgrade, {name}!', { name: tr(UPGRADE_NAME[id]) });
}

/** What LUX says the first time Jason gets close to each kind of thing. */
export const HINTS: Record<string, string> = {
  cocoon: 'See that pink cocoon? A colonist is trapped inside! BLAST it to set them free. Every colonist you save gives you bolts.',
  shard: 'A memory shard! Each one shows a piece of GaScu’s story. Every 6 give you an extra heart, and all 18 unlock a secret ending!',
  canister: 'A heart canister! Grab it for one more max heart.',
  prize: 'A vault chest! Open it for a FREE upgrade. Vaults are always locked behind a puzzle...',
  rune: 'Code pads! Step on them in the right order. There must be a sign with the code somewhere.',
  scientist: 'A thorn cocoon! One of Dr. Hypatia’s scientists is trapped inside. BLAST it to set them free!',
  page: 'A page from General Brennus’s journal! Every 6 give you an extra heart, and all 18 might help us reach him...',
  stone: 'A Gardener light-stone! It glows with Celestia’s words. Each one teaches us a new word, and every 6 give you an extra heart!',
  supplies: 'A gold harpy net, stuffed with stolen things! BLAST it open to win them back.',
  anchor: 'A grapple ring! With a hook, we could zip right over to those. I wonder where we could find one...',
  bolt: 'Bolts! They are money. Spend them at PANDORA’s shop on upgrades like a bigger clip.',
  vendor: 'That is PANDORA’s shop! Trade bolts for upgrades. Tap SHOP to look.',
};
