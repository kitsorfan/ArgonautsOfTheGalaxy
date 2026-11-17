import RECORDED from '../../../assets/voice/game/index.json';
import type { Speaker } from '../world/levelTypes';
import { audio } from './audio';
import { lang } from './i18n';

/**
 * The story's voice-over. A line of dialogue, or a caption the narrator reads, that has a recording is
 * spoken as it comes up. In English only: the voices speak no Greek, so the Greek game keeps its text
 * and blips.
 *
 * The recordings are made ahead of time by `npm run voice` (game/tools/voice.ts), which also picks the
 * voice for each speaker (game/src/core/cast.ts). Each is kept as assets/voice/game/<key>.mp3, named
 * by `voiceKey`, and index.json lists them with their lengths, so the game knows which lines it can
 * speak without asking for files that are not there.
 */

/** Who can be heard: the story's speakers, and the narrator who reads the captions. */
export type Voice = Speaker | 'narrator';

/** The name of a line's recording: a short hash (FNV-1a) of who says it and its English words. */
export function voiceKey(who: Voice, text: string): string {
  const s = `${who}\n${text}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

const LENGTHS: Record<string, number> = RECORDED;

/** Says a line, if it has a recording and can be heard. Returns how long it runs, in seconds, or 0. */
export function speak(who: Voice, text: string): number {
  const key = voiceKey(who, text);
  const seconds = lang() === 'en' ? (LENGTHS[key] ?? 0) : 0;
  return audio.voice(seconds ? key : null, seconds) ? seconds : 0;
}

/** Stops whatever is being said. */
export function hush() {
  audio.voice(null);
}
