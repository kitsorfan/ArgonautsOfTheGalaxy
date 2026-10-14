import type { LevelDef } from '../world/levelTypes';

/**
 * Chapter 3, level 9 — The Garden of Colchis, on foot with Jason and Atalanta (switch any time). The
 * Gardeners' ancient garden at dusk: flowers as tall as houses, trees of living crystal, glowing ponds
 * and fountains that speak in light. Its gates are locked with LIGHT-WORDS: step on a word's colours in
 * order (the words the light-stones taught: HOME is blue then green, FRIEND is the whole rainbow).
 *
 * 1. The landing lawn: Aeëtes's WEEDER DRONES (they spray gold weed-killer circles), Hypatia's message,
 *    and the first light-word gate (HOME).
 * 2. The glowing pond: lily pads, a grapple ring on a giant stump (a gold net with a seed-sprite in it),
 *    and a wall-run hedge across the water to the first light-stone.
 * 3. The crystal grove: the crystal gate needs both heroes, a bullseye on a spire in the ravine for
 *    Atalanta and a red switch on a grapple-only pillar for Jason. A low gap hides the second light-stone.
 * 4. The fountain plaza: PANDORA's shop, the rainbow gate (FRIEND), the vault (SLEEP, then GROW), a
 *    hedge tower with the heart canister and a crystal plinth with the third light-stone.
 * 5. The hedge yard: an ambush (the door opens when the yard is clear), then the last checkpoint.
 * 6. THE SLEEPLESS DRAGON, guardian of the Fleece, chained to its tree by Aeëtes. While his weeder
 *    drones buzz the lawn, light the four LULLABY PYLONS around it, each with one hero's skill (SKY:
 *    Atalanta's power arrow; GROW: Jason's ground pound; HOME: a high shelf only Atalanta's wall-jump
 *    reaches; FRIEND: a crystal column only Jason's grapple reaches). Their light melts its chains: it
 *    breaks free and fights (tail, crystal breath, crystal rain) until it is worn out, then LUX and
 *    IRIS sing it to sleep in light-words, and the tree-temple's door opens.
 * Side quests: three gold nets with seed-sprites in them, three light-stones (SLEEP, SONG, WAKE), a
 * heart canister and the vault.
 */
export const garden: LevelDef = {
  id: 'garden',
  index: 21,
  name: 'The Garden of Colchis',
  subtitle: 'Sing the dragon to sleep',
  music: 'garden',
  intro: 'intro',
  boss: 'dragon',
  shardIds: ['s1', 's2', 's3'],
  colonistIds: ['c1', 'c2', 'c3'],
  heroes: ['jason', 'atalanta'],
  map: `
                      #.E.#
                      #...#
                      ##.##
                    ####U#########
                  ###.......######
                 ##.......;:.#8Q8#
                ##..-........#888#
               ##.........;..#...#
              ##a9...........#...##
              #.9J................#
             ##...................##
             #.:......:..:......-..#
             #h...:..;.............#
             #....................:#
             #S.........$..........#
             #.....................#
             #............:.......:#
             #.-..;...............h#
             ##...................##
              #...........;.......#
              ##.-.....:.......H.##
               ##...............##
                ##.:.:......-..##
                 ##...........##
                  ###.......###
                    ###X..###
                    ###...###
                    #2/222/2#
                    #222N222#
                    #2222222#
          ##############R##############
          #5oo222222222222222;22222222#
          #5h5222222y2222222y222222;:2#
          #2222###222222Y222:22###2222#
          #2222###222#######222###2222#
          #22222222;2222222222222222:2#
          #;2x;2k22;2o22n22o2;22k22x22#
          #222222222222222222222222222#
     ###################F###################
     #3333333333/333333333333333/33333333/3#
     #3+;3333333;3333B3333333333333333-3333####
     #39933Z3333333333[333];333;3333333333#333#
     #3333:33333333)333333333<333333333333#333#
     #3333:333333(33333:o333333>3333333333O3I3#
     #333x333r333333o333d333o3333r333o3333#333#
     #3/33333333333333333333z333:333333333#333#
     #3333;33;:33q33:33;'33333:3333v3:w3C33####
     #333h-o33333:333333333333333:333333333#
     #3:33333333333333333333:3333:33333j333#
     #33333333m333333:3o3o3:33q3333p33333=3#
     #3=33333333o3333333333333333333*933333#
     #333V3333333333333333333333o333%933333#
     #3333333m3333333333M333-333333333:x333#
     #3/3333/333333-3333333333333333/333333#
     ###################3###################
       #################G#################
       #22222222222=222c22222222222222222#
       #           222i22222-1111111111-2#
            T6     2u222222211oo1111r1112#
            66     22222222211111111111:2#
                   2222222;21m111:111o112#
       #           2222:2:2o11:a991111m12#
   #####22222222:22-2222o2221119P91;11112#
   #222##2-2:2o2/22222222222111999:1:1112#
   #2?22l222222222q22222o22-11q11111/1112#
   #222##222222222222o2222222;22222222222#
   #222##22222r2:222222222222222222x22"22#
   #####22;:x22222:22:22;2222222222-2h222#
       #2222222222222222|22222222222222=2#
     ###############222222222###############
     #~~~~~~~~~~~~~~/222L222/~~~~~~~~~~~~~~#
     #~~~~~~~~~~~~~~22o222o22~~~~~~~~~~~~~~#
     #~999~~~~~~z~~~~~~~~~~~~~~z~~~~~~~~~~~#
     #~9^9~~~~~~~~~o1~~~q~~o1~~~~~~~~~~~~~~#
     #~99A~~~~~~~~~1o~~~~~~1o~~~~~~~~~~~~~~#
     #~o99~~~~~~~~~~~~~11~~~~~~~~~~~~~~~~~~#
     #~~~~~~~~~o1~~~~~~11~~~~~~WWWWWW22222~#
     #~~~~~~~~~1h~~~~~~~~~~11o1~~~~~q22222~#
     #~~~~~~~~~~~~~~~~~~~~~111o~~~~~~22!22~#
     #~~~~~~~~~~~~~~11f111111~~~~~~~~2o2o2~#
     #~~~~~~~~~~~~~~1111K1111~~~~~~~~22222~#
     #~~~~~~~~~~~~~~/1111111/~~~~~~~~~~~~~~#
     ###################D###################
       #1111=11111=11;11111111=11111=11:1#
       #1/;x11:1:11111t1111111111111111/1#
       #11111111q11:11{1e1}111111111:&111#
       #111-11111111-111o1111:q11:1:11111#
       #111111111111111:1111/111111111111#
       #1111:1'1111:111o;o11111111:1-1111#
       #1=1:111111111111o:111114444411111#
       #1111111;111o1s1111::1o14ooo411111#
       #1111g:1111;1111111111114444411:11#
       #11:111o11-11:111@11111111b111x111#
       #11111:11;1111111111111111111111/1#
       #1/x1111111/1111111:=11:1111111x11#
       #111:1111:11111:111111111111111111#
       ###################################
`,
  legend: {
    // The way through.
    E: { type: 'exit' },
    $: { type: 'boss', boss: 'dragon', room: 'arena' },
    U: { type: 'door', id: 'templedoor', open: { boss: true } },
    D: { type: 'door', id: 'homegate', open: { flag: 'home' }, h: 0.5 },
    G: { type: 'door', id: 'grovegate', open: { all: [{ flag: 'tA' }, { flag: 'sw1' }] }, h: 1 },
    F: { type: 'door', id: 'friendgate', open: { flag: 'friend' }, h: 1.5 },
    R: { type: 'door', id: 'yarddoor', open: { clear: 'r2' }, h: 1 },
    K: { type: 'checkpoint', id: 'cp1' },
    L: { type: 'checkpoint', id: 'cp2' },
    M: { type: 'checkpoint', id: 'cp3' },
    N: { type: 'checkpoint', id: 'cp4' },
    V: { type: 'vendor' },
    g: { type: 'holo', log: 'log', who: 'hypatia' },
    e: { type: 'marker', id: 'gate1' },
    c: { type: 'marker', id: 'grove' },
    d: { type: 'marker', id: 'fountain' },
    // The four lullaby pylons around the dragon's lawn (the dragon raises them when the fight begins).
    S: { type: 'marker', id: 'pylon:sky' },
    H: { type: 'marker', id: 'pylon:grow' },
    Q: { type: 'marker', id: 'pylon:home', h: 4 },
    J: { type: 'marker', id: 'pylon:friend', h: 4.5 },
    // Light-word gates: step on a word's colours in order.
    '{': { type: 'rune', group: 'home', order: 1, color: '#5ec8ff' },
    '}': { type: 'rune', group: 'home', order: 2, color: '#7dff9a' },
    '(': { type: 'rune', group: 'friend', order: 1, color: '#ff5e6a' },
    ')': { type: 'rune', group: 'friend', order: 2, color: '#ffb347' },
    '[': { type: 'rune', group: 'friend', order: 3, color: '#ffe066' },
    ']': { type: 'rune', group: 'friend', order: 4, color: '#7dff9a' },
    '<': { type: 'rune', group: 'friend', order: 5, color: '#5ec8ff' },
    '>': { type: 'rune', group: 'friend', order: 6, color: '#c37bff' },
    // The vault: SLEEP (violet, then white), then GROW (pink, then green).
    v: { type: 'rune', group: 'vault', order: 1, color: '#c37bff' },
    w: { type: 'rune', group: 'vault', order: 2, color: '#ffffff' },
    p: { type: 'rune', group: 'vault', order: 3, color: '#ff6fcf' },
    j: { type: 'rune', group: 'vault', order: 4, color: '#7dff9a' },
    O: { type: 'door', id: 'vaultdoor', open: { flag: 'vault' } },
    I: { type: 'prize', id: 'vault', reward: 'clip' },
    // Hero gadgets: grapple rings for Jason, a bullseye, wall-run hedges and a low gap for Atalanta.
    A: { type: 'anchor' },
    a: { type: 'anchor', h: 4.5 },
    T: { type: 'target', flag: 'tA' },
    P: { type: 'switch', flag: 'sw1', h: 4.5 },
    W: { type: 'wallrun' },
    '%': { type: 'climb', h: 4.5 },
    l: { type: 'lowgap', axis: 'x' },
    // Aeëtes's saboteurs: weeder drones, harpy drones and his gold-painted scrap robots.
    q: { type: 'enemy', enemy: 'weeder' },
    z: { type: 'enemy', enemy: 'harpy' },
    r: { type: 'enemy', enemy: 'trooper', variant: 'gold' },
    m: { type: 'enemy', enemy: 'minebot', variant: 'gold' },
    u: { type: 'enemy', enemy: 'bulwark', variant: 'gold' },
    Z: { type: 'enemy', enemy: 'mortar', variant: 'gold' },
    k: { type: 'enemy', enemy: 'weeder', room: 'r2' },
    y: { type: 'enemy', enemy: 'trooper', variant: 'gold', room: 'r2' },
    Y: { type: 'enemy', enemy: 'bulwark', variant: 'gold', room: 'r2' },
    n: { type: 'enemy', enemy: 'harpy', room: 'r2' },
    // Collectibles: light-stones, seed-sprites in gold nets, a heart canister.
    '!': { type: 'shard', id: 's1' },
    '?': { type: 'shard', id: 's2' },
    '*': { type: 'shard', id: 's3', h: 4.5 },
    '&': { type: 'cocoon', id: 'c1', name: 'Seed-sprite Pip', line: 'Pip! Pip-pip! (IRIS says: “Thank you, kind giants!”)' },
    '^': { type: 'cocoon', id: 'c2', name: 'Seed-sprite Bud', line: 'Bud-bud! (IRIS says: “I was only taking a nap on the stump!”)' },
    '"': { type: 'cocoon', id: 'c3', name: 'Seed-sprite Twig', line: 'Twiiig! (IRIS says: “Free! I shall tell everyone!”)' },
    '+': { type: 'canister', id: 'hc', h: 4.5 },
    // Signs.
    s: { type: 'sign', text: 'WEEDER DRONES! Aeëtes sent them to spoil the garden. When a tank glows, a gold circle appears under you: step off it before the weed-killer splashes!' },
    t: { type: 'sign', text: 'A LIGHT-WORD GATE! The Gardeners locked their gates with words of light. Step on a word’s colours, in order. This gate opens for HOME: blue, then green.' },
    f: { type: 'sign', text: 'Lily pads! Hop across the glowing pond. As Atalanta, wall-run along the striped hedge to the little island. As Jason, GRAPPLE up the old stump to the gold net.' },
    i: { type: 'sign', text: 'THE CRYSTAL GATE needs BOTH of you: a bullseye on the spire in the ravine for Atalanta’s POWER ARROW, and a red switch on the crystal pillar for Jason (GRAPPLE up, then GROUND-POUND).' },
    B: { type: 'sign', text: 'The great fountain glows: “Only a FRIEND may pass. Our word for friend shines with the whole rainbow: red, orange, yellow, green, blue and violet.”' },
    C: { type: 'sign', text: 'An old Gardener riddle: “First the seed must SLEEP, then it will GROW.” SLEEP glows violet, then white. GROW glows pink, then green.' },
    X: { type: 'sign', text: 'LULLABY PYLONS! Light all four for the lullaby: follow the beams. SKY: Atalanta’s POWER ARROW. GROW: Jason’s GROUND POUND. HOME: high on the hedge shelf (Atalanta WALL-JUMPS). FRIEND: on the crystal column (Jason GRAPPLES). Their light melts gold chains too: be ready for a fight!' },
    // Decor.
    '/': { type: 'decor', kind: 'giantflower' },
    '-': { type: 'decor', kind: 'crystaltree' },
    "'": { type: 'decor', kind: 'fountain', scale: 1.6 },
    '=': { type: 'decor', kind: 'bush' },
    ':': { type: 'decor', kind: 'flowers' },
    ';': { type: 'decor', kind: 'grass' },
    // The heroes talk it over when they reach the crystal grove.
    '|': { type: 'trigger', id: 'grovetalk', dialogue: 'crystal', w: 9, d: 2 },
  },
  objectives: [
    { until: { flag: 'home' }, text: 'Open the light-word gate: step on HOME’s colours, blue then green', at: 'gate1' },
    { until: { all: [{ flag: 'tA' }, { flag: 'sw1' }] }, text: 'Open the crystal gate: a bullseye for Atalanta, a red switch for Jason', at: 'grove' },
    { until: { flag: 'friend' }, text: 'Spell FRIEND in light by the great fountain: the whole rainbow, red to violet', at: 'fountain' },
    // The dragon sets `unchained` when the last pylon melts its last chain.
    { until: { flag: 'unchained' }, text: 'Light the four lullaby pylons: follow the beams', at: 'boss' },
    { until: { boss: true }, text: 'The dragon is free! Tire it out (hit its glowing nose), then sing it to sleep', at: 'boss' },
    { until: { flag: 'never' }, text: 'Enter the tree-temple: the Fleece vault is inside', at: 'exit' },
  ],
  dialogues: {
    intro: [
      { who: 'captain', text: 'The Argo is down, safe and sound, right in the Gardeners’ garden. Brennus held that sky-dock just long enough.' },
      { who: 'iris', text: 'Oh... look at it. Flowers taller than the Argo. Trees made of crystal. Fountains that speak in light.' },
      { who: 'atalanta', text: 'And somebody’s spraying gold goop all over it. Those little gold drones with the scissors!' },
      { who: 'bolt', text: 'Weeder drones. Aeëtes’s, of course. They’re snipping the flowers! That is just RUDE.' },
      { who: 'halcyon', text: 'The Fleece vault is inside the great tree-temple, at the heart of the garden. But something huge is curled around its door. And it is... breathing.' },
      { who: 'jason', text: 'Then we go carefully. Atalanta, you take the high roads. LUX, IRIS: you read the light-words. Let’s go!' },
    ],
    log: [
      { who: 'hypatia', text: 'Dr. Hypatia here, recording on the Argo. I’ve been studying the light-stones you found. Every Gardener word is a little song of colours.' },
      { who: 'hypatia', text: 'The Gardeners locked their gates with those words. Step on the colours of the right word, in order, and the gate will open.' },
      { who: 'hypatia', text: 'One more thing. The old carvings speak of a guardian that never sleeps. They say: “When it rages, be brave. When it tires, sing to it.” I wonder what that means...' },
    ],
    crystal: [
      { who: 'atalanta', text: 'Another locked gate! That bullseye is on a spire out in the ravine. Nobody can get there... but my arrows can.' },
      { who: 'jason', text: 'And the red switch is up on that crystal pillar. Too smooth to climb. Good thing I brought a grapple.' },
      { who: 'iris', text: 'The Gardeners built this garden for friends who help each other. I think they would like you two.' },
    ],
    boss: [
      { who: 'aeetes', text: 'Ah, the little Argonauts! My weeder drones have been poking that old dragon all week, and I chained it to its tree. It is VERY awake now, and VERY cross. Enjoy!' },
      { who: 'iris', text: 'It is not a monster. It is a guardian, and it is so tired. It has not slept for a thousand years, guarding the Fleece.' },
      { who: 'jason', text: 'Then we light the lullaby pylons, and you two sing it to sleep. Whatever it takes!' },
      { who: 'bolt', text: 'Sing? To THAT? ...Okay. Okay! I know one song. It is mostly beeps.' },
    ],
    bossDown: [
      { who: 'iris', text: 'Shhh... Listen. It is snoring. Very, very softly.' },
      { who: 'bolt', text: 'We did it! We sang a dragon to sleep! I am the bravest singer in the galaxy.' },
      { who: 'atalanta', text: 'Sweet dreams, big guy. We’ll bring the Fleece back... well, to Celestia. She needs it more.' },
      { who: 'halcyon', text: 'The tree-temple’s door is opening. The way to the Golden Fleece is clear.' },
    ],
    'shard:s1': [
      { who: 'bolt', text: 'A light-stone, out on the little island! It glows violet... then soft white, like moonlight.' },
      { who: 'iris', text: 'This word means “sleep”. A good word to know, in a garden with a guardian that never sleeps.' },
    ],
    'shard:s2': [
      { who: 'iris', text: 'Hidden where only a slider fits. Gold and pink, rippling like water: this word is “song”.' },
      { who: 'bolt', text: 'Sleep... song... It’s like the Gardeners left us a lullaby, one word at a time!' },
    ],
    'shard:s3': [
      { who: 'bolt', text: 'Up on the crystal plinth! This one starts dark green and bursts bright white, like a sunrise.' },
      { who: 'iris', text: '“Wake.” The word the Gardeners said to their seeds every spring. One day we will say it to Celestia’s.' },
    ],
    'colonist:c1': [
      { who: 'iris', text: 'A seed-sprite! The Gardeners’ little helpers. It says “Pip! Pip-pip!” That means “thank you, kind giants!”' },
      { who: 'bolt', text: 'Giants! Did you hear that, Jason? I’m a GIANT.' },
    ],
    'colonist:c2': [
      { who: 'iris', text: 'This one was napping on the old stump when the weeders netted it. It says it will plant a flower for you.' },
      { who: 'jason', text: '...Where?' },
      { who: 'iris', text: 'In your ear, if you stand still for too long. Seed-sprites are very helpful.' },
    ],
    'colonist:c3': [
      { who: 'iris', text: 'The last one! It is flying off to tell the whole garden that the weeders are gone. Look: they are all waving at us.' },
      { who: 'atalanta', text: 'Bye, little sprites! Keep your flowers safe!' },
    ],
  },
  stories: {
    // The Argonauts step out of the Argo into the Gardeners' garden (before the flyover).
    opening: [
      {
        panel: 'ch3-garden',
        caption: 'Colchis, at last. The Argonauts step out into the garden the Gardeners planted long, long ago.',
      },
    ],
    // The lullaby: LUX and IRIS sing the dragon to sleep (played once the fight has worn it out).
    lullaby: [
      {
        panel: 'ch3-dragon',
        lines: [
          { who: 'iris', text: 'Sleep, old guardian. Your watch is over. Friends are here.' },
          { who: 'bolt', text: 'Beep... boop... sleeeep... (that’s the beep version).' },
          { who: 'jason', text: 'Look. It’s curling up around the tree. Its eyes are closing...' },
        ],
      },
    ],
  },
};
