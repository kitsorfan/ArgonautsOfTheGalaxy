import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CREATOR, VERSION } from '../src/core/brand';
import { defaultSettings } from '../src/core/save';
import { RELEASES } from '../src/game/releaseNotes';

const appVersion = (JSON.parse(readFileSync(join(__dirname, '..', '..', 'app.json'), 'utf8')) as { expo: { version: string } }).expo.version;

describe('About and release notes', () => {
  it('has release notes for the version in app.json', () => {
    expect(RELEASES[0].version).toBe(appVersion);
  });

  it('lists each version once, newest first, with a date and notes', () => {
    const versions = RELEASES.map((r) => r.version);
    expect(new Set(versions).size).toBe(versions.length);
    const num = (v: string) => v.split('.').reduce((n, x) => n * 1000 + Number(x), 0);
    for (let i = 1; i < RELEASES.length; i++) expect(num(RELEASES[i - 1].version)).toBeGreaterThan(num(RELEASES[i].version));
    for (const r of RELEASES) {
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.notes.length).toBeGreaterThan(0);
    }
  });

  it('shows "dev" as the version outside a build', () => {
    expect(VERSION).toBe('dev');
  });

  it('names the creator with a way to get in touch', () => {
    expect(CREATOR.email).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]+$/);
    expect(CREATOR.site).toMatch(/^www\./);
  });

  it('asks for a language until one is chosen', () => {
    expect(defaultSettings().langChosen).toBe(false);
  });
});
