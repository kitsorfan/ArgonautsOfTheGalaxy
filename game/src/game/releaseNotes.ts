/**
 * What changed in each version, newest first, shown under About → What's new. The first entry's version
 * must match `expo.version` in app.json (a test checks). Notes are English keys like any other text:
 * add their Greek to i18n/el.ts.
 */
export interface Release {
  version: string;
  /** Release date, YYYY-MM-DD. */
  date: string;
  notes: { text: string }[];
}

export const RELEASES: Release[] = [
  {
    version: '1.0.0',
    date: '2026-10-11',
    notes: [
      { text: 'The whole adventure in three chapters and 22 levels: the six decks of the Syracusia, six regions of Gaia Nova and the ten-level voyage of the Argonauts.' },
      { text: 'Three heroes to play: Jason, Atalanta the archer and General Brennus, plus the Gardeners’ bronze mech.' },
      { text: 'Fly the Argo through the Clashing Rocks and dive the submarine Dolphin under the Sirens’ Sea.' },
      { text: 'PANDORA’s shop: upgrades, new weapons and outfits for Jason and Atalanta.' },
      { text: 'Side quests, secret endings and story pictures drawn like a graphic novel.' },
      { text: 'Thirteen openly licensed music tracks.' },
      { text: 'Play in English or Greek: the game asks on first launch, and you can switch any time in Settings.' },
      { text: 'Auto graphics: the game picks the right quality for your phone and lowers it if play gets slow.' },
    ],
  },
];
