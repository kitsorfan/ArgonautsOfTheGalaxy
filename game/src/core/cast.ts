import type { Voice } from './voice';

/**
 * Who voices whom in the story's voice-over (core/voice.ts), for `npm run voice` to record with.
 *
 * Every voice comes from a recording that lets the game ship what it says (CC0 or CC BY; see
 * assets/voice/CREDITS.md). Most parts are one of Kyutai's Pocket TTS voices; a part none of them suits
 * is read by Chatterbox, which copies the voice of a recording in Kyutai's voice collection. Some get an
 * effect on top, written as ffmpeg audio filters: LUX is a small robot, so he is pitched up and a little
 * tinny. A speaker with no part here is not voiced yet; changing a part re-records that speaker's lines.
 */
/** The speech engines `npm run voice` records with (game/tools/voice/speak.py). */
export type Engine = 'pocket-tts' | 'chatterbox';

export interface Part {
  /** What speaks the part: Pocket TTS unless it says otherwise. */
  engine?: Engine;
  /**
   * For Pocket TTS, one of its voices. For Chatterbox, the recording whose voice it copies: a file of
   * Kyutai's voice collection (huggingface.co/kyutai/tts-voices), by its path there.
   */
  voice: string;
  /** ffmpeg audio filters run over every take. */
  fx?: string;
}

/** The engine a part is spoken by. */
export function engineOf(part: Part): Engine {
  return part.engine ?? 'pocket-tts';
}

/** The ship's computer: a little thin, with a short echo. */
const COMPUTER = 'highpass=f=150,lowpass=f=7500,aecho=0.8:0.5:14:0.22';
/** The living plant, whispering: a touch higher and slower, in a dreamy echo. */
const PLANT = 'rubberband=pitch=1.05:tempo=0.92:pitchq=quality,aecho=0.8:0.6:90|170:0.35|0.22,chorus=0.6:0.9:55:0.4:0.2:3';
/** LUX: pitched up by about four and a half semitones, through a short metallic echo. */
const LUX = 'rubberband=pitch=1.3,aecho=0.8:0.5:5:0.35,highpass=f=160';

export const CAST: Partial<Record<Voice, Part>> = {
  // Every part is the user's pick from the auditions, except Jason's and LUX's (first guesses, so far kept).
  // The trailer's narrator, and the deepest voice of the set.
  narrator: { voice: 'javert' },
  // A volunteer's donated voice, the deepest in Kyutai's collection, read the dramatic way Chatterbox
  // can (Pocket TTS's voices did not sound like a general).
  brennus: { engine: 'chatterbox', voice: 'voice-donations/f9cf_enhanced.wav' },
  // A VCTK speaker: the kind captain.
  captain: { voice: 'charles' },
  // The youngest-sounding man in the set (a VCTK speaker, 18).
  jason: { voice: 'george' },
  bolt: { voice: 'michael', fx: LUX },
  // LUX with Brennus's control chip in him: lower, harsher and crackling.
  rogue: { voice: 'michael', fx: 'rubberband=pitch=0.95:pitchq=quality,aecho=0.8:0.6:6:0.5,acrusher=bits=8:mode=log:aa=1,highpass=f=160' },
  atalanta: { voice: 'eve' },
  halcyon: { voice: 'caro_davy', fx: COMPUTER },
  // HALCYON with GaScu pollen in its circuits: wobbling and crackling.
  glitch: { voice: 'caro_davy', fx: `vibrato=f=8:d=0.35,acrusher=bits=7:mode=log:aa=1,${COMPUTER}` },
  // The Gardeners' droid: pitched up a little and shimmering (the same voice as Atalanta underneath).
  iris: { voice: 'eve', fx: 'rubberband=pitch=1.12:pitchq=quality,chorus=0.6:0.9:50:0.4:0.25:2,highpass=f=140' },
  // Another donated voice with an English Midlands accent, read with Chatterbox's flair.
  aeetes: { engine: 'chatterbox', voice: 'voice-donations/Midlands_Bedfordshire_Dialect_enhanced.wav' },
  hypatia: { voice: 'anna' },
  // GaScu and Celestia are the same plant (chapter 2 calls it by its real name), so they share a voice.
  gascu: { voice: 'alba', fx: PLANT },
  celestia: { voice: 'alba', fx: PLANT },
  phineus: { voice: 'marius' },
  // Aeëtes's security computer: a little lower, metallic and boxy.
  medusa: { voice: 'vera', fx: 'rubberband=pitch=0.94:pitchq=quality,aecho=0.8:0.9:7:0.45,highpass=f=200,lowpass=f=5000' },
  rosa: { voice: 'fantine' },
  colonist: { voice: 'bill_boerst' },
};

/**
 * Words the engine says better spelled another way, whatever their case (GASCU too). Names the story
 * made up are guesses until someone listens.
 */
export const SAY_AS: Record<string, string> = {
  GaScu: 'Gas-koo',
  'Aeëtes': 'Ee-ee-tees',
  // Aeëtes's harpy queen (AELLO, said as a word).
  Aello: 'Ay-ello',
  // The Gorgon's gunship (Pocket TTS says "Snow").
  Stheno: 'Sthee-no',
  'Dr.': 'Doctor',
};
