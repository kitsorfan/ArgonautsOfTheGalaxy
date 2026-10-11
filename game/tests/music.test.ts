import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { MUSIC_CREDITS, MUSIC_FILES, TRACKS, type Track } from '../src/core/music';
import { LEVELS, LEVEL_ORDER } from '../src/levels';
import type { BossKind } from '../src/world/levelTypes';

/** Every boss kind (a missing one is a type error here). */
const BOSSES: Record<BossKind, true> = {
  warden: true, queen: true, golem: true, bloblin: true, wardog: true, heart: true, reborn: true,
  thresher: true, driller: true, boreas: true, stheno: true, hydra: true, colossus: true, rogue: true,
  aello: true, excavator: true, scylla: true, organ: true, talos: true, medusa: true, ram: true, dragon: true, goldenking: true,
};

const fileOf = (t: Track) => TRACKS[t];

describe('the soundtrack', () => {
  it('has a recording, with its credit, for every music file', () => {
    for (const f of MUSIC_FILES) {
      expect(existsSync(join(__dirname, '../../assets/music', `${f}.mp3`))).toBe(true);
      expect(MUSIC_CREDITS[f]?.artist).toBeTruthy();
      expect(MUSIC_CREDITS[f]?.license).toMatch(/^(CC0|CC BY [34]\.0)$/);
    }
  });

  it('plays every recording somewhere', () => {
    const used = new Set<string>(Object.values(TRACKS));
    for (const f of MUSIC_FILES) expect(used.has(f)).toBe(true);
  });

  it('changes the music when a boss fight starts', () => {
    const levelFiles = new Set<string>(LEVEL_ORDER.map((id) => fileOf(LEVELS[id].music)));
    for (const b of Object.keys(BOSSES) as BossKind[]) expect(levelFiles.has(fileOf(b))).toBe(false);
  });
});
