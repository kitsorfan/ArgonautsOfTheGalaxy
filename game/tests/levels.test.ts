import { deckAbilities } from '../tools/deckAbilities';
import { isCollectible, reach, refillGaps, timedRoutes } from '../tools/reach';
import { FLYOVER, TRANSITIONS } from '../src/game/story';
import { CHAPTER_DECKS, FOOT_LEVELS, LEVELS, LEVEL_ORDER, chapterSize, isFinale } from '../src/levels';
import { parseLevel } from '../src/world/grid';
import { PASSABLE_DECOR, type Ability } from '../src/world/levelTypes';

const ALL: Ability[] = ['doubleJump', 'dash', 'glide', 'pulse', 'grapple', 'mirror'];
// The levels Jason walks; the flight levels have their own checks in chapter3.test.ts.
const parsed = FOOT_LEVELS.map((id) => parseLevel(LEVELS[id]));

describe('deck data', () => {
  it('has six decks on the ship, six regions on Gaia Nova and the chapter 3 levels built so far, in order', () => {
    expect(CHAPTER_DECKS[1]).toHaveLength(6);
    expect(CHAPTER_DECKS[2]).toHaveLength(6);
    expect(CHAPTER_DECKS[3].length).toBeGreaterThanOrEqual(1);
    expect(CHAPTER_DECKS[3].length).toBeLessThanOrEqual(chapterSize(3));
    expect(LEVEL_ORDER).toHaveLength(12 + CHAPTER_DECKS[3].length);
    LEVEL_ORDER.forEach((id, i) => expect(LEVELS[id].index).toBe(i + 1));
  });

  it('hides 18 shards and 12 people to rescue in each of the first two chapters', () => {
    for (const ch of [1, 2] as const) {
      let shards = 0;
      let colonists = 0;
      for (const level of parsed.filter((l) => CHAPTER_DECKS[ch].includes(l.def.id))) {
        const ids = level.entities.filter((e) => e.spec.type === 'shard').map((e) => e.id.split('.')[1]);
        expect(ids.sort()).toEqual([...level.def.shardIds].sort());
        const cocoons = level.entities.filter((e) => e.spec.type === 'cocoon').map((e) => e.id.split('.')[1]);
        expect(cocoons.sort()).toEqual([...(level.def.colonistIds ?? [])].sort());
        shards += ids.length;
        colonists += cocoons.length;
      }
      expect(shards).toBe(18);
      expect(colonists).toBe(12);
    }
  });

  it('gives every shard a memory and every deck its story beats', () => {
    for (const level of parsed) {
      const d = level.def;
      for (const s of d.shardIds) expect(d.dialogues[`shard:${s}`]?.length).toBeGreaterThan(0);
      if (d.intro) expect(d.dialogues[d.intro]?.length).toBeGreaterThan(0);
      expect(d.dialogues.boss?.length).toBeGreaterThan(0);
      expect(d.dialogues.bossDown?.length).toBeGreaterThan(0);
      for (const e of level.entities) {
        if (e.spec.type === 'trigger' && e.spec.dialogue) expect(d.dialogues[e.spec.dialogue]?.length).toBeGreaterThan(0);
      }
    }
    expect(LEVELS.cryo.dialogues.bolt?.length).toBeGreaterThan(0);
    expect(LEVELS.bridge.dialogues.speak?.length).toBeGreaterThan(0);
    expect(LEVELS.bridge.dialogues.friends?.length).toBeGreaterThan(0);
    // Chapter 2's secret ending: talking General Brennus down.
    expect(LEVELS.volcano.dialogues.redeem?.length).toBeGreaterThan(0);
    expect(LEVELS.volcano.dialogues.redeemed?.length).toBeGreaterThan(0);
  });

  it('tells the story: a recorded log on every deck, and a scene for each story character', () => {
    for (const level of parsed) {
      const d = level.def;
      const logs = level.entities.filter((e) => e.spec.type === 'holo');
      expect(logs).toHaveLength(1);
      for (const e of logs) if (e.spec.type === 'holo') expect(d.dialogues[e.spec.log]?.length).toBeGreaterThan(0);
      for (const key of Object.keys(d.dialogues).filter((k) => k.startsWith('colonist:'))) {
        expect(d.colonistIds).toContain(key.slice('colonist:'.length));
      }
    }
    for (const key of ['wake', 'intro', 'bolt', 'boltJoin']) expect(LEVELS.cryo.dialogues[key]?.length).toBeGreaterThan(0);
    for (const id of LEVEL_ORDER.filter((d) => !isFinale(d))) expect(TRANSITIONS[id].length).toBeGreaterThan(0);
    for (const id of LEVEL_ORDER.slice(1)) expect(FLYOVER[id]).not.toBe('');
  });

  it('has exactly one boss per deck and an exit on every deck but each chapter’s finale', () => {
    for (const level of parsed) {
      const bosses = level.entities.filter((e) => e.spec.type === 'boss');
      expect(bosses).toHaveLength(1);
      const exits = level.entities.filter((e) => e.spec.type === 'exit');
      expect(exits).toHaveLength(isFinale(level.def.id) ? 0 : 1);
    }
  });

  it('hands out each ability exactly once, in order', () => {
    const found = parsed.flatMap((l) => l.entities.filter((e) => e.spec.type === 'upgrade').map((e) => (e.spec.type === 'upgrade' ? e.spec.ability : null)));
    expect(found).toEqual(['doubleJump', 'dash', 'glide', 'pulse', 'grapple', 'mirror']);
  });
});

describe.each(FOOT_LEVELS)('%s layout', (id) => {
  const level = parseLevel(LEVELS[id]);
  const { before, after } = deckAbilities(level);

  it('lets Jason reach every door, switch, terminal, checkpoint and the boss', () => {
    const r = reach(level, after);
    const stuck = r.missing.filter((e) => !isCollectible(e.spec)).map((e) => `${e.id} at ${e.cx},${e.cz}`);
    expect(stuck).toEqual([]);
  });

  it('never stands a solid prop right in front of a door or cracked wall', () => {
    // The checker can squeeze past a pillar diagonally; the heroes can't (a pillar once sealed a door in the Golden Fleece).
    const at = new Map(level.entities.map((e) => [e.cz * level.width + e.cx, e.spec]));
    const blocked: string[] = [];
    for (const e of level.entities) {
      if (e.spec.type !== 'door' && e.spec.type !== 'cracked') continue;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const s = at.get((e.cz + dz) * level.width + e.cx + dx);
        if (s?.type === 'decor' && s.solid !== false && !PASSABLE_DECOR.includes(s.kind)) blocked.push(`${e.id} at ${e.cx},${e.cz}: ${s.kind}`);
      }
    }
    expect(blocked).toEqual([]);
  });

  it('keeps every collectible reachable (some may need later abilities)', () => {
    expect(reach(level, ALL).missing.map((e) => e.id)).toEqual([]);
  });

  it('puts a checkpoint or energy cell before every jump that needs a dash', () => {
    expect(refillGaps(level, after).map((t) => `${t.cx},${t.cz}`)).toEqual([]);
  });

  it('leaves time to spare on every clock: half of it at full speed, a fifth even in the slowest order', () => {
    const switches = level.entities.flatMap((e) => (e.spec.type === 'switch' && e.spec.timed ? [e.spec] : []));
    for (const s of switches) expect(switches.filter((o) => o.flag === s.flag).every((o) => o.timed === s.timed && o.together === s.together)).toBe(true);
    for (const t of timedRoutes(level, after)) {
      expect(t.best).toBeLessThanOrEqual(t.clock * 0.5);
      expect(t.worst).toBeLessThanOrEqual(t.clock * 0.8);
    }
  });

  it('makes the new ability necessary to finish the deck', () => {
    const upgrade = level.entities.find((e) => e.spec.type === 'upgrade');
    if (!upgrade) return;
    const r = reach(level, before);
    expect(r.missing.map((e) => e.id)).not.toContain(upgrade.id);
    const boss = level.entities.find((e) => e.spec.type === 'boss');
    expect(r.missing.map((e) => e.id)).toContain(boss?.id);
  });
});
