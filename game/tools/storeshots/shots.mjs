// The Google Play shots, in store order. Frames are 1/60 s of virtual time from navigation (the clock
// is the trailer's, seeded, so a shot comes out on the same frame in every language); a level is up
// by ~3.5 s, and fights are staged at SET.
const SET = 240;
const fightAct = (every = 0.32) => `H.faceBoss(); if (H.every(t, ${every})) H.tap('shoot');`;

/** Pop-ups that come and go (new-enemy card, LUX's tips, warnings, rewards): not in a store picture. */
const CLEAN = '.threat, .toast, .warn-banner, .warn-edge, .reward-banner { display: none !important; }';
const rig = (r) => (r ? `H.rig(${JSON.stringify(r.pos)}, ${JSON.stringify(r.look)}, ${r.fov ?? 50});` : '');

/** A boss fight under way: the hero at `at`, turned to the boss and shooting, with the lens at `rig`. */
export const fight = (o) => ({
  id: o.id,
  slug: o.slug,
  hash: o.hash,
  css: CLEAN,
  setups: [{ at: SET, js: `H.fight(${JSON.stringify(o.at)}); ${rig(o.rig)}` }],
  act: fightAct(o.every),
  actFrom: SET,
  probe: o.probe ?? [o.pick - 30, o.pick, o.pick + 30],
  pick: o.pick,
});

/** A flight or a dive, skipped ahead along its course, with the checkpoints before it passed. */
export const ride = (o) => ({
  id: o.id,
  slug: o.slug,
  hash: o.hash,
  css: CLEAN,
  setups: [{ at: SET, js: `__game.world.vehicle.skipTo(${o.to}); for (const f of ${JSON.stringify(o.flags)}) __game.world.flags.add(f);` }],
  act: `if (H.every(t, 0.3)) H.tap('shoot');`,
  actFrom: SET,
  probe: [o.pick - 30, o.pick, o.pick + 30],
  pick: o.pick,
});

export const SHOTS = [
  // Chapter 3: Atalanta and Jason (with LUX) against MEDUSA, her snake hair striking.
  fight({
    id: 'medusa',
    slug: 'medusa',
    hash: 'deck=labyrinth&still&all&heroes=atalanta,jason&hero=atalanta&bolts=1240',
    at: [45.5, 19],
    rig: { pos: [39, 6.5, 28.5], look: [50, 2.2, 13], fov: 48 },
    pick: 360,
  }),
  // Chapter 3: the Argo between a pair of Clashing Rocks, the ringed giant behind.
  ride({ id: 'rocks', slug: 'clashing-rocks', hash: 'deck=rocks&still&all&bolts=1240', to: 3170, flags: ['argo:cp1', 'argo:cp2'], pick: 300 }),
  // Chapter 1: Jason, with LUX at his side, shoots at the Magma Golem in the Engine Core.
  fight({ id: 'golem', slug: 'magma-golem', hash: 'deck=engine&still&all&bolts=1240', at: [31, 31], every: 0.6, rig: { pos: [26.5, 6.5, 40], look: [31.5, 1.5, 23] }, pick: 360 }),
  // Chapter 2: BOREAS stomps in on the frozen lake, its red slam circle round Jason.
  fight({ id: 'boreas', slug: 'boreas', hash: 'deck=snow&still&all&bolts=1240', at: [50.9, 36], every: 0.6, rig: { pos: [46.5, 6, 45], look: [51.5, 1.8, 29] }, pick: 420 }),
  // Chapter 3: the submarine Dolphin dives through a gold ring in the Sirens' Sea. (Not the sunken
  // ruins further on: their objective wraps to two lines in Greek and runs into the progress track.)
  ride({ id: 'submarine', slug: 'submarine', hash: 'deck=sirens&still&all&bolts=1240', to: 540, flags: [], pick: 300 }),
  // A graphic-novel story picture: Aeëtes as the Golden King, with his line of dialogue.
  {
    id: 'panel',
    slug: 'story-golden-king',
    hash: 'panel=ch3-goldenking',
    css: '.skip { display: none !important; }',
    setups: [{ at: 120, js: `__game.ui.dialogue([{ who: 'aeetes', text: 'Ha ha HA! Gold armour! Gold vines! I am the GOLDEN KING now, and everything I touch is MINE!' }], () => {})` }],
    probe: [270, 300, 330],
    pick: 300,
  },
  // PANDORA's shop, on the outfits for Jason and Atalanta.
  { id: 'shop', slug: 'shop', hash: 'deck=fleece&still&all&bolts=1240&shop=outfits', probe: [330, 360, 390], pick: 360 },
  // The title screen.
  { id: 'title', slug: 'title', hash: 'menu=title', probe: [210, 240, 270], pick: 240 },
  // The feature graphic (1024x500): the title scene with the logo and no buttons, drawn at twice the
  // size and scaled down afterwards (see run.sh).
  {
    id: 'feature',
    file: 'feature-graphic-2x.jpg',
    view: { width: 1024, height: 500 },
    hash: 'menu=title',
    css: '.title-menu, .title-new { display: none !important; }',
    probe: [210, 240, 270],
    pick: 240,
  },
];
