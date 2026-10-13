import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { MUSIC_CREDITS, MUSIC_FILES } from '../src/core/music';
import { BAR, FPS, MUSIC, barFrame, layout, presence } from '../src/trailer/cut';
import { drift, follow, glide, orbit } from '../src/trailer/moves';
import { CARDS, SHOTS } from '../src/trailer/shots';

// three is ESM-only, which Jest's module loader can't read; Node's own require can, so load it with that.
jest.mock('three', () => process.getBuiltinModule('node:module').createRequire(__filename)('three'));

const SLOTS = layout(SHOTS.map((s) => s.bars));
const TOTAL = SLOTS[SLOTS.length - 1].to;

describe('the trailer cut', () => {
  it('lays shots end to end, every cut on a bar line', () => {
    let bars = 0;
    SLOTS.forEach((slot, i) => {
      expect(slot.from).toBe(barFrame(bars));
      bars += SHOTS[i].bars;
      expect(slot.to).toBe(barFrame(bars));
      if (i > 0) expect(slot.from).toBe(SLOTS[i - 1].to);
    });
  });

  it('never drifts off the beat, however many shots there are', () => {
    const many = layout(Array.from({ length: 200 }, () => 1));
    expect(many[199].to).toBe(Math.round(200 * BAR * FPS));
  });

  it('runs about a minute', () => {
    expect(TOTAL / FPS).toBeGreaterThan(50);
    expect(TOTAL / FPS).toBeLessThan(80);
  });

  it('names every shot once', () => {
    expect(new Set(SHOTS.map((s) => s.id)).size).toBe(SHOTS.length);
  });

  it('keeps every card inside the trailer, and in both languages', () => {
    for (const card of CARDS) {
      expect(card.from).toBeLessThan(card.to);
      expect(barFrame(card.to)).toBeLessThanOrEqual(TOTAL);
      for (const words of [card.kicker, card.text]) {
        if (!words) continue;
        expect(words.en).toBeTruthy();
        expect(words.el).toBeTruthy();
      }
    }
    expect(CARDS.filter((c) => c.kind === 'title')).toHaveLength(1);
    expect(CARDS[CARDS.length - 1].kind).toBe('end');
  });

  it('fades a card up and down inside its slot, and nowhere else', () => {
    const slot = { from: 100, to: 200 };
    expect(presence(99, slot, 10, 10)).toBe(0);
    expect(presence(100, slot, 10, 10)).toBeCloseTo(0.1);
    expect(presence(150, slot, 10, 10)).toBe(1);
    expect(presence(199, slot, 10, 10)).toBeCloseTo(0.1);
    expect(presence(200, slot, 10, 10)).toBe(0);
  });

  it('is cut to a credited recording that is long enough', () => {
    expect((MUSIC_FILES as readonly string[]).includes(MUSIC.file)).toBe(true);
    expect(MUSIC_CREDITS[MUSIC.file].license).toBeTruthy();
    expect(existsSync(join(__dirname, '../../assets/music', `${MUSIC.file}.mp3`))).toBe(true);
    // The music starts on one of its own bar lines.
    const bars = (MUSIC.from - 0.012) / BAR;
    expect(Math.abs(bars - Math.round(bars))).toBeLessThan(0.001);
  });
});

describe('the trailer camera moves', () => {
  const still = { x: 0, y: 0, z: 0, facing: 0 };

  it('are still moving at both ends of a shot', () => {
    expect(drift(0.01) - drift(0)).toBeGreaterThan(0.005);
    expect(drift(1) - drift(0.99)).toBeGreaterThan(0.005);
    expect(drift(0)).toBe(0);
    expect(drift(1)).toBe(1);
  });

  it('glide from one pose to the other', () => {
    const m = glide({ from: { position: [0, 0, 0], target: [0, 0, -1] }, to: { position: [10, 2, 0], target: [10, 2, -1] }, fov: [40, 50] });
    expect(m(0, still)).toEqual({ position: [0, 0, 0], target: [0, 0, -1], fov: 40 });
    expect(m(1, still)).toEqual({ position: [10, 2, 0], target: [10, 2, -1], fov: 50 });
  });

  it('orbit at the radius asked, starting due +z of the centre', () => {
    const m = orbit({ center: [5, 0, 5], radius: 10, height: 3, from: 0, to: Math.PI });
    const a = m(0, still);
    expect(a.position[0]).toBeCloseTo(5);
    expect(a.position[1]).toBeCloseTo(3);
    expect(a.position[2]).toBeCloseTo(15);
    const b = m(0.5, still);
    expect(Math.hypot(b.position[0] - 5, b.position[2] - 5)).toBeCloseTo(10);
  });

  it('follow the subject wherever it goes', () => {
    const m = follow({ distance: 4, height: 2, angle: 0 });
    const p = m(0.5, { x: 7, y: 1, z: -3, facing: 1 });
    expect(p.position).toEqual([7, 3, 1]);
    expect(p.target[0]).toBeCloseTo(7);
  });
});
