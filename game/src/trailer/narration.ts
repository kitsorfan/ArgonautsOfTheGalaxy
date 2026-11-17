/**
 * The trailer's voice-over: a narrator reading the captions as they come up, the game's name on the
 * drop, and the question at the end.
 *
 * The lines are recorded once, by `npm run voice` (game/tools/voice.ts), with Kyutai's Pocket TTS in its
 * "javert" voice, and kept in assets/voice/trailer, so recording the trailer needs no speech engine.
 * The recorder lays each one on its bar and dips the music under it. A line whose words change here is
 * recorded again the next time the tool runs; `npm run voice -- --only <id>` asks for a fresh take.
 *
 * English only: the voice has no Greek, so the Greek trailer plays without a narrator.
 */

export interface Spoken {
  id: string;
  /** When it starts, in bars on the trailer's own clock, like the cards: just after its caption comes up. */
  at: number;
  /** What is said. Not `text`, so the translation check (npm run game:i18n) knows it is not on screen. */
  say: string;
}

/** Who speaks, and the credit the end card gives them. */
export const NARRATOR = {
  engine: 'pocket-tts',
  voice: 'javert',
  credit: 'Voice: Pocket TTS by Kyutai · CC BY 4.0',
} as const;

/** Where the recordings are kept, from the project root: <dir>/<id>.wav, and <dir>/lines.json for what each says. */
export const VOICE_DIR = 'assets/voice/trailer';

export const NARRATION: Spoken[] = [
  { id: 'ch1', at: 0.35, say: 'Wake up among the stars.' },
  { id: 'lux', at: 4.25, say: 'Solve puzzles. Uncover the story.' },
  { id: 'ch2', at: 6.3, say: 'Explore a wild new world.' },
  { id: 'ch3', at: 9.3, say: 'Sail for the Golden Fleece.' },
  // On the drop, with the logo.
  { id: 'title', at: 12.1, say: 'Argonauts of the Galaxy.' },
  { id: 'chapters', at: 14.1, say: 'Three chapters.' },
  { id: 'heroes', at: 16.1, say: 'Three heroes.' },
  { id: 'end', at: 31.25, say: 'Will you make it?' },
  { id: 'soon', at: 32.35, say: 'Coming soon, to Android.' },
];
