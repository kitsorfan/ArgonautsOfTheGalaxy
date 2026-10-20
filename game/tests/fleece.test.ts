import { newSave } from '../src/core/save';
import { nextHero, heroRoster } from '../src/entities/heroes/heroes';
import { LIGHT_STONES } from '../src/game/collectibles';
import { BOSS_CARD, ENDING_CAPTIONS, FLYOVER, INTEL, TRANSITIONS, creditsHtml, endingChapter, knowsGardenerWords, lightStones } from '../src/game/story';
import { CHAPTER_DECKS, GAME_FINALE, LEVELS, chapterOf, isFinale, nextChapterStart } from '../src/levels';
import { PANEL_IDS, panelSvg } from '../src/ui/panels';
import { parseLevel } from '../src/world/grid';
import type { HeroId } from '../src/world/levelTypes';
import { isCollectible, reach } from '../tools/reach';

// newSave() reads navigator for its quality default; give Jest a stand-in.
beforeAll(() => {
  (globalThis as { navigator?: unknown }).navigator ??= { hardwareConcurrency: 8 };
});

const def = LEVELS.fleece;
const level = parseLevel(def);
const ALL = ['doubleJump', 'dash', 'glide', 'pulse', 'grapple'] as const;
const find = (pred: (e: (typeof level.entities)[number]) => boolean) => level.entities.filter(pred);
/** The non-collectible things a set of heroes can't get to (by entity type). */
const stuck = (heroes: HeroId[]) =>
  reach(level, [...ALL], heroes)
    .missing.filter((e) => !isCollectible(e.spec))
    .map((e) => e.spec.type);

describe('the Golden Fleece', () => {
  it('is chapter 3’s last level and the finale of the whole game', () => {
    expect(chapterOf('fleece')).toBe(3);
    expect(CHAPTER_DECKS[3]).toContain('fleece');
    expect(GAME_FINALE).toBe('fleece');
    expect(isFinale('fleece')).toBe(true);
    expect(nextChapterStart('fleece')).toBeNull();
    // No exit: the level ends with the final endings.
    expect(find((e) => e.spec.type === 'exit')).toHaveLength(0);
    expect(TRANSITIONS.fleece).toEqual([]);
    expect(FLYOVER.fleece).not.toBe('');
    expect(def.music).toBe('fleece');
  });

  it('lets all three heroes play: Jason and Atalanta from the start, Brennus once he joins in the root hall', () => {
    expect(heroRoster(def.heroes)).toEqual(['jason', 'atalanta', 'brennus']);
    expect(def.joins).toEqual({ brennus: 'brennus' });
    const meet = find((e) => e.spec.type === 'trigger' && e.spec.event === 'join:brennus');
    expect(meet).toHaveLength(1);
    expect(find((e) => e.spec.type === 'marker' && e.spec.id === 'brennus')).toHaveLength(1);
    // His squad lines up at three markers.
    for (const id of ['squad1', 'squad2', 'squad3']) expect(find((e) => e.spec.type === 'marker' && e.spec.id === id)).toHaveLength(1);
    // Jason and Atalanta get to the meeting on their own.
    expect(reach(level, [...ALL], ['jason', 'atalanta']).reached.has(`${meet[0].cx},${meet[0].cz}`)).toBe(true);
    for (const key of ['meet:brennus', 'joined:brennus', 'hall', 'seals', 'log']) expect(def.dialogues[key]?.length).toBeGreaterThan(0);
    expect(def.stories?.['meet:brennus']?.[0].panel).toBe('ch3-squad');
  });

  it('switches round all three heroes in turn', () => {
    const roster: HeroId[] = ['jason', 'atalanta', 'brennus'];
    expect(nextHero(roster, 'jason')).toBe('atalanta');
    expect(nextHero(roster, 'atalanta')).toBe('brennus');
    expect(nextHero(roster, 'brennus')).toBe('jason');
  });

  it('needs all three heroes: any two of them get stuck somewhere', () => {
    // Without Brennus nobody smashes the cracked rock into the Legion gallery.
    expect(stuck(['jason', 'atalanta'])).toContain('boss');
    // Without Atalanta the bullseyes stay whole.
    expect(stuck(['jason', 'brennus'])).toContain('target');
    // Without Jason nobody grapples up to the red switch on the root pillar.
    expect(stuck(['atalanta', 'brennus'])).toContain('switch');
    expect(stuck(['jason', 'atalanta', 'brennus'])).toEqual([]);
  });

  it('seals the Fleece vault with one seal for each hero', () => {
    const gate = find((e) => e.spec.type === 'door' && e.spec.id === 'vaultgate')[0];
    expect(gate.spec.type === 'door' && gate.spec.open).toEqual({ all: [{ flag: 'sealA' }, { flag: 'sealJ' }, { flag: 'sealB' }] });
    expect(find((e) => e.spec.type === 'target' && e.spec.flag === 'sealA')).toHaveLength(1);
    expect(find((e) => e.spec.type === 'switch' && e.spec.flag === 'sealJ')).toHaveLength(1);
    expect(find((e) => e.spec.type === 'switch' && e.spec.flag === 'sealB')).toHaveLength(1);
    expect(find((e) => e.spec.type === 'cracked').length).toBeGreaterThanOrEqual(2);
    expect(find((e) => e.spec.type === 'post' && e.spec.order === 'fight' && e.spec.room === 'squad')).toHaveLength(1);
  });

  it('has the side quests, gadgets and crew of a full level', () => {
    const count = (t: string) => find((e) => e.spec.type === t).length;
    expect(def.shardIds).toEqual(['s1', 's2', 's3']);
    expect(count('shard')).toBe(3);
    expect(count('cocoon')).toBe(3);
    expect(count('canister')).toBe(1);
    expect(count('checkpoint')).toBeGreaterThanOrEqual(3);
    expect(count('vendor')).toBe(1);
    expect(count('holo')).toBe(1);
    expect(count('lowgap')).toBeGreaterThan(0);
    expect(count('wallrun')).toBeGreaterThan(0);
    expect(count('anchor')).toBeGreaterThanOrEqual(3);
    expect(count('rune')).toBe(4);
    expect(find((e) => e.spec.type === 'prize' && e.spec.id === 'vault')).toHaveLength(1);
    expect(count('enemy')).toBeGreaterThanOrEqual(25);
    expect(find((e) => e.spec.type === 'enemy' && e.spec.enemy === 'ringguard').length).toBeGreaterThanOrEqual(4);
    expect(find((e) => e.spec.type === 'boss' && e.spec.boss === 'goldenking')).toHaveLength(1);
    expect(BOSS_CARD.goldenking.sub).toBeTruthy();
    expect(INTEL.ringguard.tip).toBeTruthy();
    for (const key of ['boss', 'wear', 'armour', 'grow', 'giant', 'bossDown', 'fleeceWon', 'gardenWords', 'seedsAwake', 'shard:s1', 'shard:s2', 'shard:s3']) {
      expect(def.dialogues[key]?.length).toBeGreaterThan(0);
    }
  });
});

describe('the game’s final endings', () => {
  it('belong to chapter 3, with four pictures’ worth of narration each', () => {
    expect(endingChapter('fleece')).toBe(3);
    expect(endingChapter('gardeners')).toBe(3);
    expect(endingChapter('redeemed')).toBe(2);
    expect(endingChapter('friends')).toBe(1);
    expect(ENDING_CAPTIONS.fleece).toHaveLength(4);
    expect(ENDING_CAPTIONS.gardeners).toHaveLength(4);
  });

  it('opens the secret ending only with every Gardener light-stone of the chapter', () => {
    const save = newSave();
    expect(lightStones(save)).toEqual({ n: 0, total: LIGHT_STONES });
    expect(knowsGardenerWords(save)).toBe(false);
    for (let i = 1; i < LIGHT_STONES; i++) save.shards.push(`fleece.s${i}`);
    expect(knowsGardenerWords(save)).toBe(false);
    save.shards.push(`fleece.s${LIGHT_STONES}`);
    expect(knowsGardenerWords(save)).toBe(true);
  });

  it('rolls the final credits for the whole game, with who made it', () => {
    const save = newSave();
    const credits = creditsHtml('gardeners', save);
    for (const name of ['Frost Warden', 'the Colossus', 'AELLO', 'Golden King', 'Atalanta', 'General Brennus', 'THE END', 'Kitsu Game Studios', 'Kitsos Orfanopoulos']) expect(credits).toContain(name);
    expect(creditsHtml('fleece', save)).toContain('in full bloom');
    // Every composer is thanked, with where they shared the music and its license.
    for (const name of ['Kevin MacLeod', 'incompetech.com', 'Matthew Pablo', 'OpenGameArt.org', 'CC BY 4.0', 'creativecommons.org']) expect(credits).toContain(name);
  });

  it('paints the Fleece’s storybook panels', () => {
    for (const id of ['ch3-squad', 'ch3-goldenking', 'ch3-home', 'ch3-gardeners'] as const) {
      expect(PANEL_IDS).toContain(id);
      const svg = panelSvg(id);
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg).not.toContain(`>${id}</text>`);
    }
  });
});
