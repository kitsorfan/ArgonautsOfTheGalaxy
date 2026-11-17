import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CAST, engineOf } from '../src/core/cast';
import { voiceKey, type Voice } from '../src/core/voice';

const DIR = join(__dirname, '../../assets/voice/game');
const INDEX: Record<string, number> = JSON.parse(readFileSync(join(DIR, 'index.json'), 'utf8'));
const MADE = existsSync(join(DIR, 'lines.json'))
  ? (JSON.parse(readFileSync(join(DIR, 'lines.json'), 'utf8')) as { lines: Record<string, { who: Voice; engine: string; voice: string; fx?: string; seconds: number }> })
  : { lines: {} };

describe('the story voice-over', () => {
  it('names a recording after who says it and the words, the same every time', () => {
    expect(voiceKey('jason', 'Hey!')).toBe(voiceKey('jason', 'Hey!'));
    expect(voiceKey('jason', 'Hey!')).toMatch(/^[0-9a-f]{8}$/);
    expect(voiceKey('bolt', 'Hey!')).not.toBe(voiceKey('jason', 'Hey!'));
    expect(voiceKey('jason', 'Hey')).not.toBe(voiceKey('jason', 'Hey!'));
  });

  it('has a file, and the right length, for every line the game thinks it can speak', () => {
    expect(Object.keys(INDEX).sort()).toEqual(Object.keys(MADE.lines).sort());
    for (const [key, seconds] of Object.entries(INDEX)) {
      expect(existsSync(join(DIR, `${key}.mp3`))).toBe(true);
      expect(seconds).toBeGreaterThan(0.3);
      expect(MADE.lines[key].seconds).toBe(seconds);
    }
  });

  it('was recorded in the voices the cast gives now (npm run voice)', () => {
    for (const line of Object.values(MADE.lines)) {
      const part = CAST[line.who];
      expect(part).toBeDefined();
      if (!part) continue;
      expect(line.engine).toBe(engineOf(part));
      expect(line.voice).toBe(part.voice);
      expect(line.fx ?? '').toBe(part?.fx ?? '');
    }
  });
});
