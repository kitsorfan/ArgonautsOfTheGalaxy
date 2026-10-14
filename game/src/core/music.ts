/**
 * The soundtrack: openly licensed recordings in `assets/music/<file>.mp3`, credited in `MUSIC_CREDITS`.
 * Every level and boss asks for a track by name; tracks of the same mood share a recording, so a
 * switch between two of them (a level and its sister level) carries on without a restart.
 *
 * In the app the recordings are played by the phone itself (expo-audio, see src/music.ts), off the
 * page's thread; in a browser by an <audio> element.
 */

export const MUSIC_FILES = [
  'title',
  'ending',
  'ship-calm',
  'ship-action',
  'planet-adventure',
  'planet-frost',
  'planet-wild',
  'voyage',
  'mystery',
  'epic',
  'boss-ship',
  'boss',
  'boss-final',
] as const;

export type MusicFile = (typeof MUSIC_FILES)[number];

/** Every track the game asks for (a level's music, a boss's kind, 'music:<track>' triggers), and its recording. */
export const TRACKS = {
  title: 'title',
  ending: 'ending',
  // The ship's decks.
  cryo: 'ship-calm',
  hydro: 'ship-calm',
  habitat: 'ship-calm',
  engine: 'ship-action',
  security: 'ship-action',
  bridge: 'ship-action',
  // Gaia Nova.
  plains: 'planet-adventure',
  desert: 'planet-adventure',
  rockies: 'planet-adventure',
  snow: 'planet-frost',
  jungle: 'planet-wild',
  volcano: 'planet-wild',
  // The Argonauts' voyage.
  argo: 'voyage',
  isles: 'voyage',
  reef: 'voyage',
  sirens: 'mystery',
  mine: 'mystery',
  labyrinth: 'mystery',
  garden: 'mystery',
  forge: 'epic',
  stand: 'epic',
  fleece: 'epic',
  // The ship's guardians, and Shadow LUX (LUX's own glitchy double).
  warden: 'boss-ship',
  queen: 'boss-ship',
  golem: 'boss-ship',
  bloblin: 'boss-ship',
  wardog: 'boss-ship',
  heart: 'boss-ship',
  rogue: 'boss-ship',
  // Gaia Nova's and the voyage's bosses.
  thresher: 'boss',
  driller: 'boss',
  boreas: 'boss',
  stheno: 'boss',
  hydra: 'boss',
  aello: 'boss',
  excavator: 'boss',
  scylla: 'boss',
  organ: 'boss',
  talos: 'boss',
  medusa: 'boss',
  ram: 'boss',
  dragon: 'boss',
  // The last fight of each chapter.
  reborn: 'boss-final',
  colossus: 'boss-final',
  goldenking: 'boss-final',
} as const satisfies Record<string, MusicFile>;

export type Track = keyof typeof TRACKS;

export interface MusicCredit {
  title: string;
  artist: string;
  license: string;
  /** Where the recording was shared. */
  source: 'incompetech.com' | 'OpenGameArt.org';
}

/** The recordings' titles, artists and licenses, for the end credits (sources in assets/music/CREDITS.md). */
export const MUSIC_CREDITS: Record<MusicFile, MusicCredit> = {
  title: { title: 'Heroic Minority', artist: 'Alexandr Zhelanov', license: 'CC BY 3.0', source: 'OpenGameArt.org' },
  ending: { title: 'Eternal Hope', artist: 'Kevin MacLeod', license: 'CC BY 4.0', source: 'incompetech.com' },
  'ship-calm': { title: 'Cipher', artist: 'Kevin MacLeod', license: 'CC BY 4.0', source: 'incompetech.com' },
  'ship-action': { title: 'High Tech Lab', artist: 'remaxim', license: 'CC BY 4.0', source: 'OpenGameArt.org' },
  'planet-adventure': { title: 'Fantasia Fantasia', artist: 'Kevin MacLeod', license: 'CC BY 4.0', source: 'incompetech.com' },
  'planet-frost': { title: 'Frost Waltz', artist: 'Kevin MacLeod', license: 'CC BY 4.0', source: 'incompetech.com' },
  'planet-wild': { title: 'Big Mojo', artist: 'Kevin MacLeod', license: 'CC BY 4.0', source: 'incompetech.com' },
  voyage: { title: 'Trials of the Sea', artist: 'Crocdent', license: 'CC0', source: 'OpenGameArt.org' },
  mystery: { title: 'Teller of the Tales', artist: 'Kevin MacLeod', license: 'CC BY 4.0', source: 'incompetech.com' },
  epic: { title: 'Sons of the Storm', artist: 'Patrick Maney', license: 'CC BY 3.0', source: 'OpenGameArt.org' },
  'boss-ship': { title: 'Orbital Colossus', artist: 'Matthew Pablo', license: 'CC BY 3.0', source: 'OpenGameArt.org' },
  boss: { title: 'Epic Boss Battle', artist: 'Juhani Junkala', license: 'CC0', source: 'OpenGameArt.org' },
  'boss-final': { title: 'Blackmoor Colossus', artist: 'Matthew Pablo', license: 'CC BY 3.0', source: 'OpenGameArt.org' },
};
