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
      { text: '22 levels in three chapters: the Syracusia, Gaia Nova and the Argonauts’ voyage.' },
      { text: 'Play as Jason, Atalanta, General Brennus and a bronze mech.' },
      { text: 'Fly the Argo and dive the submarine Dolphin.' },
      { text: 'PANDORA’s shop: upgrades, weapons and outfits.' },
      { text: 'Side quests, secret endings and graphic-novel story pictures.' },
      { text: 'Thirteen openly licensed music tracks.' },
      { text: 'English or Greek: switch any time in Settings.' },
      { text: 'Auto graphics keep play smooth on your phone.' },
    ],
  },
];
