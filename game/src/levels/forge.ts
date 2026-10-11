import type { LevelDef } from '../world/levelTypes';

/**
 * Chapter 3, level 6 — Talos's Forge: a bronze volcanic island past Scylla's Reef, guarded by TALOS, the
 * Gardeners' ancient bronze giant, whom Aeëtes has reprogrammed to smash anyone who lands. It starts on
 * foot and becomes a mech level:
 *
 * 1. The black-sand beach and the lava moat: Atalanta's POWER ARROW hits the bullseye on the far bank
 *    and lowers the drawbridge.
 * 2. The forge courtyard: Jason GRAPPLEs up to the high ledge, then Atalanta SLIDEs through the low gap
 *    into the control room, where LUX wakes the old forge up (side: a Gardener light-word vault, and a
 *    light-stone only Atalanta's wall-jump reaches).
 * 3. In the forge hall sleeps the Gardeners' bronze MECH. Jason climbs into the cockpit and Atalanta onto
 *    its shoulder (cutscene + storybook panel): from here on they ride it, with STRENGTH instead of
 *    hearts and a big FLAMETHROWER. They can GET OUT and CLIMB back IN with the action button.
 * 4. PUNCH the bronze gate open; cross the lava fields with a JUMP and a THRUST while anvil drones drop
 *    anvils from above.
 * 5. The casting floor: SLAM (spin in the air) through the cracked floor plates into the trench under
 *    the wall (another cracked plate hides a cellar with the heart canister).
 * 6. The bellows yard: SLAM both red switches to open the arena gate. PANDORA's shop, and a light-stone
 *    on top of the forge chimney across the lava (jump + thrust).
 * 7. TALOS walks his rounds (only the mech can fight him): dodge his stomps and hammer, PUNCH (or burn)
 *    the armour off his ankle while his foot is stuck, then pull the PLUG in his heel. Three pulls and the golden ichor drains: he sits down,
 *    gently, free of Aeëtes's control, and nods. Beyond him: the labyrinth gate into Colchis.
 */
export const forge: LevelDef = {
  id: 'forge',
  index: 18,
  name: 'Talos’s Forge',
  subtitle: 'A bronze giant, and a bronze mech',
  music: 'forge',
  intro: 'intro',
  boss: 'talos',
  shardIds: ['s1', 's2', 's3'],
  colonistIds: ['c1', 'c2'],
  // Jason and Atalanta on foot until they climb into the mech (the `join:mech` trigger sets the flag);
  // from then on the mech is the only hero, with both of them aboard (unless they climb out and leave it
  // parked: then they are on foot again until they climb back in).
  heroes: ['jason', 'atalanta', 'mech'],
  joins: { mech: 'mech' },
  map: `
                   ######
    ################4z44################
    #~~~4Y444444444I4444I444444444l4~~~#
    #~~~4444444444444444444444444444~~~#
    #~~~4444444444444444444444444444~~~#
    #4444444444444444444444444444444444#
    #4444444444444444444444444444444444#
    #4444444444444444444444444444444444#
    #4444444444444444444444444444444444#
    #4Y444444444444444444444444444444Y4#
    #4444444444444444444444444444444444#
    #4444444444444444Z44444444444444444#
    #4444444444444444444444444444444444#
    #4444444444444444444444444444444444#
    #4444444444444444444444444444444444#
    #4444444444444444444444444444444444#
    #4444444444444444444444444444444444#
    #4444444444444444444444444444444444#
    #~~~4444444444444444444444444444~~~#
    #~~~4444444444444444444444444444~~~#
    #~~~444444444444I44I444444444444~~~#
  ###################()###################
  #h44444444o4o4o444444444444~~~~~~~~~~~~#
  #4Y44###44444444444444F4444~~~~~~~~8$~~#
  #4444###4444444444U4444t444~~~~~~~~o8~~#
  #44l4444444e444444444444444~~~~~6~~~~~~#
  #44444444444444333333333344~~5~~~~~~~~~#
  #444t44f4444444222222222244~~~~~~~~~~~~#
  #444444;4444444111111111144~~~~~~~~~~~~#
  #4s44444444444#..........#4444444444444#
  #44w4444444444#....oo....#E444444444444#
  #444444444a444#....'.....#4444n4a44444Y#
  #X444444444444#..........#444444444R44x#
  ###################..###################
  #x44444444444444444BB44444444444444444x#
  #4444444m4444444444BB444444444444m44s44#
  #4444444444444a4444444U444~~44444444444#
  #44###BB###444444444444444~~44444444l44#
  #44#..b...#44444444*44u444~~446644o4444#
  #44#....o.#4~~~~~44"444444~~446?4444444#
  #44#+....o#444444o44444a44~~44444444444#
  #s4#......#l44444o44444444~~4444444a444#
  #44########44444444k44444444444444444h4#
  #33333333333333333333333333333333333333#
  #22222222222222222222222222222222222222#
  #x....o.l.t.......a....m..o......ol..h.#
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~#
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~o=~~~~~~~~~#
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~#
  #......................................#
  #.....a.......m.............t..a.....l.#
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~#
  #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~#
  ############l...|../...c.-..xx..#########
  #999999999##########GG###################
  #999999999#9999#....&..}.....I.##########
  #999{99999L9K99#............N..##########
  #99999:999#99>9H....M..........##########
  #9jo99<999#9999#...............##.....###
  #999999999######...............##.hP..###
  #999999o99#.........J..........##.....###
  #999999999#XI................IX##.....###
 ##9999A9999##########O##############V#####
 #.......................................!#
 #.h......Y...o.o.o...........t..Y........#
 #......]...........................r..y..#
 #...............t...............q........#
 #.l........p.............m...............#
 #..................................v..x..#
 #......................C.........g.......#
 #..xx.........S......................i.l.#
 #.........................^T.............#
 #~~~~~~~~~~~~~~~~~~~,,~~~~~~~~~~~~~~~~~~~#
  ~~~~~~~~~~~~~~~~~~~o,~~~~~~~~~~~~~~~~~~~
  ~~~~~~~~~~~~~~~~~~~,,~~~~~~~~~~~~~~~~~~~
  ~~~~~~~~~~~~~~~~~~~,o~~~~~~~~~~~~~~~~~~~
  ~~~~~~~~~~~~~~~~~~~,,~~~~~~~~~~~~~~~~~~~
  ~~~~~~~~~~~~~~~~~~~o,~~~~~~~~~~~~~~~~~~~
  ~~~~~~~~~~~~~~~~~~~,,~~~~~~~~~~~~~~~~~~~
  ~~~~~~~~~~~~~~~~~~~,,~~~~~~~~~~~~~~~~~~~
  ~~~~~~~~~~~~~~~~~~~Dd~~~~~~~~~~~~~~~~~~~
  .....................................l..
  ....Q...................................
  ........t.............[............Q....
  ..l.........................p...........
    ..............o.o...o.o.............
    ..........W.........................
    ..................@...........Q.....
    ....Q...................l...........
        ............................
`,
  legend: {
    // The way through, on foot.
    T: { type: 'target', flag: 'bridge' },
    D: { type: 'door', id: 'bridgeW', open: { flag: 'bridge' } },
    d: { type: 'door', id: 'bridgeE', open: { flag: 'bridge' } },
    A: { type: 'anchor' },
    L: { type: 'lowgap', axis: 'x' },
    K: { type: 'terminal', flag: 'forgelit', length: 4, puzzle: 'lights', label: 'WAKE THE FORGE' },
    H: { type: 'door', id: 'balcony', open: { flag: 'forgelit' }, h: 4.5 },
    O: { type: 'door', id: 'halldoor', open: { flag: 'forgelit' } },
    M: { type: 'marker', id: 'mech' },
    J: { type: 'trigger', id: 'board', event: 'join:mech', w: 5, d: 3, when: { flag: 'forgelit' } },
    N: { type: 'holo', log: 'log', who: 'hypatia' },
    C: { type: 'checkpoint', id: 'cp1' },
    '^': { type: 'marker', id: 'bridge' },
    '<': { type: 'marker', id: 'ledge' },
    '>': { type: 'marker', id: 'forge' },
    ':': { type: 'trigger', id: 'onledge', event: 'flag:ledge', dialogue: 'ledge', w: 3, d: 3 },
    // The way through, in the mech.
    G: { type: 'bronzegate' },
    '&': { type: 'marker', id: 'gate' },
    c: { type: 'checkpoint', id: 'cp2' },
    '/': { type: 'trigger', id: 'fields', event: 'flag:fields', dialogue: 'fields', w: 9, d: 1 },
    k: { type: 'checkpoint', id: 'cp3' },
    '*': { type: 'marker', id: 'casting' },
    '"': { type: 'trigger', id: 'castingfloor', dialogue: 'casting', w: 9, d: 2 },
    B: { type: 'brittle', lid: 2, h: 0 },
    "'": { type: 'trigger', id: 'pit', event: 'flag:pit', dialogue: 'pit', w: 8, d: 3 },
    w: { type: 'switch', flag: 'bellowsW' },
    e: { type: 'switch', flag: 'bellowsE' },
    ';': { type: 'marker', id: 'bellows' },
    '(': { type: 'door', id: 'arenaW', open: { all: [{ flag: 'bellowsW' }, { flag: 'bellowsE' }] } },
    ')': { type: 'door', id: 'arenaE', open: { all: [{ flag: 'bellowsW' }, { flag: 'bellowsE' }] } },
    E: { type: 'checkpoint', id: 'cp4' },
    n: { type: 'vendor' },
    Z: { type: 'boss', boss: 'talos', room: 'arena' },
    z: { type: 'exit' },
    // The Gardener light-word vault: spell SKY, then GROW.
    q: { type: 'rune', group: 'vault', order: 1, color: '#5ec8ff' },
    v: { type: 'rune', group: 'vault', order: 2, color: '#ffd166' },
    y: { type: 'rune', group: 'vault', order: 3, color: '#5ec8ff' },
    g: { type: 'rune', group: 'vault', order: 4, color: '#ff8ad8' },
    i: { type: 'rune', group: 'vault', order: 5, color: '#7dff9a' },
    V: { type: 'door', id: 'vaultdoor', open: { flag: 'vault' } },
    P: { type: 'prize', id: 'vault', reward: 'clip' },
    // Collectibles: Gardener light-stones, two gold harpy nets, the heart canister in the cellar.
    '!': { type: 'shard', id: 's1' },
    '?': { type: 'shard', id: 's2' },
    $: { type: 'shard', id: 's3' },
    '+': { type: 'canister', id: 'hc' },
    b: { type: 'bounce' },
    // Aeëtes's thieves and guards, and his new anvil drones.
    p: { type: 'enemy', enemy: 'harpy' },
    t: { type: 'enemy', enemy: 'trooper', variant: 'gold' },
    m: { type: 'enemy', enemy: 'minebot', variant: 'gold' },
    S: { type: 'enemy', enemy: 'sentry' },
    a: { type: 'enemy', enemy: 'anvil' },
    U: { type: 'enemy', enemy: 'bulwark', variant: 'gold' },
    R: { type: 'enemy', enemy: 'mortar', variant: 'gold' },
    // Gold harpy nets: things Aeëtes's drones snatched from the Argo while it was moored off the island.
    j: { type: 'cocoon', id: 'c1', name: 'Captain Argus’s lucky spanner', line: 'The Captain’s lucky spanner! He says it built the whole Argo. And fixed his kettle.' },
    '=': { type: 'cocoon', id: 'c2', name: 'Dr. Hypatia’s notebook', line: 'Dr. Hypatia’s notebook! Full of Gardener light-words... and a drawing of LUX with a moustache.' },
    // Signs.
    '[': { type: 'sign', text: 'A DRAWBRIDGE over the lava, pulled up tight. See the bullseye on the far bank? Switch to ATALANTA and HOLD BOW for a power arrow!' },
    ']': { type: 'sign', text: 'The forge’s high door is up on that ledge: too high to jump. JASON can GRAPPLE up to the glowing ring!' },
    '{': { type: 'sign', text: 'A low gap with yellow-and-black stripes: only ATALANTA’s SLIDE fits under it.' },
    r: { type: 'sign', text: 'A Gardener light-door. “Spell the word for SKY, then the word for GROW.” (The Harpy Isles taught you: SKY is blue, gold, blue. GROW is pink, then green.)' },
    '}': { type: 'sign', text: 'A BRONZE GATE, a hand thick. Nothing on foot can open it... but a mech’s PUNCH (the SPIN button) can!' },
    '|': { type: 'sign', text: 'LAVA CHANNELS! Narrow ones: just JUMP. Wide ones: JUMP, then THRUST (the DASH button) in the air. The jets carry you across.' },
    '-': { type: 'sign', text: 'Watch the sky! Anvil drones drop anvils on red circles. Step out of the circle, then PUNCH the drone while it picks its anvil back up, or roast it with the FLAMETHROWER.' },
    u: { type: 'sign', text: 'Cracked floor plates! Walking won’t break them. JUMP and SLAM (press SPIN in the air) to smash straight through.' },
    f: { type: 'sign', text: 'Two red switches, one on each side of the yard. SLAM them both and the arena gate opens.' },
    F: { type: 'sign', text: 'TALOS walks his rounds in there, and only the mech is strong enough to fight him! When he stomps, his foot gets stuck: PUNCH the armour off his ankle (or hold the FLAMETHROWER on it). Then pull the plug in his heel.' },
    // Decor: palms on the beach, lava rocks, Aeëtes's gold banners, the Gardeners' bronze pillars and forge machines.
    W: { type: 'decor', kind: 'wreck', scale: 1.4, rot: 0.6 },
    Q: { type: 'decor', kind: 'palm' },
    l: { type: 'decor', kind: 'lavarock' },
    Y: { type: 'decor', kind: 'banner' },
    I: { type: 'decor', kind: 'pillar' },
    s: { type: 'decor', kind: 'generator' },
    X: { type: 'crate', metal: true, loot: 'big' },
  },
  objectives: [
    { until: { flag: 'bridge' }, text: 'Lower the drawbridge: hit the bullseye with Atalanta’s POWER ARROW', at: 'bridge' },
    { until: { flag: 'ledge' }, text: 'GRAPPLE up to the forge’s high ledge as Jason', at: 'ledge' },
    { until: { flag: 'forgelit' }, text: 'SLIDE through the low gap as Atalanta and wake up the forge', at: 'forge' },
    { until: { flag: 'mech' }, text: 'Climb into the sleeping bronze mech', at: 'mech' },
    { until: { flag: 'fields' }, text: 'PUNCH the bronze gate open', at: 'gate' },
    { until: { flag: 'pit' }, text: 'Cross the lava fields and SLAM through the cracked floor', at: 'casting' },
    { until: { all: [{ flag: 'bellowsW' }, { flag: 'bellowsE' }] }, text: 'SLAM both red switches to open the arena gate', at: 'bellows' },
    { until: { boss: true }, text: 'Free TALOS: pull the plug in his heel', at: 'boss' },
    { until: { flag: 'never' }, text: 'Walk through the labyrinth gate into Colchis', at: 'exit' },
  ],
  dialogues: {
    intro: [
      { who: 'halcyon', text: 'This island is made of bronze-coloured rock, and it is warm. Very warm. The volcano is still awake.' },
      { who: 'atalanta', text: 'Look up at the cliffs. Something HUGE is walking around up there.' },
      { who: 'bolt', text: 'A giant! A bronze giant! Jason, it is looking at us. It is DEFINITELY looking at us.' },
      { who: 'iris', text: 'That is TALOS. The Gardeners built him to guard this island. In the old light-songs, he walks all the way around it three times a day.' },
      { who: 'aeetes', text: 'And now he works for ME! Anyone who lands on my island gets a big bronze STOMP. Enjoy your visit!' },
      { who: 'jason', text: 'We can’t stop something that big on foot... IRIS, what else is on this island?' },
      { who: 'iris', text: 'A Gardener forge, past the lava moat. They built their biggest tools there. Maybe they left one behind.' },
    ],
    log: [
      { who: 'hypatia', text: 'Hypatia here, on the Argo. LUX sent me pictures of the carvings around this projector, so I translated them for you.' },
      { who: 'hypatia', text: '“TALOS, our bronze friend, walks the shore three times a day and keeps the island safe. His heart is golden light, flowing in his veins.”' },
      { who: 'hypatia', text: '“If ever he must rest, pull the plug in his heel. The light will flow out softly, and he will sit down and sleep.”' },
      { who: 'hypatia', text: 'So it doesn’t hurt him: it’s his off-switch! Be gentle with him, Jason. None of this is his fault.' },
    ],
    ledge: [
      { who: 'jason', text: 'Made it! But the forge door up here is jammed. There’s only a little gap under it.' },
      { who: 'atalanta', text: 'A gap? My favourite. Switch to me and I’ll slide right under.' },
    ],
    'meet:mech': [
      { who: 'bolt', text: 'Jason... look. In the middle of the forge.' },
      { who: 'atalanta', text: 'It’s a robot! A big bronze robot, sitting very still. Like it’s asleep.' },
    ],
    'joined:mech': [
      { who: 'halcyon', text: 'The mech is awake! Jason pilots it, Atalanta rides on its shoulder, and LUX and IRIS fly alongside.' },
      { who: 'halcyon', text: 'SPIN is PUNCH. In the air, SPIN is a big SLAM. DASH fires the back jets: THRUST! And hold BLAST for its FLAMETHROWER.' },
      { who: 'halcyon', text: 'No hearts in a mech: it has STRENGTH. Hits wear it down, and it does NOT come back by itself: only a checkpoint mends it. If it runs out, it’s back to the last checkpoint!' },
      { who: 'jason', text: 'It’s slow, but SO strong. And the action button lets us GET OUT, and CLIMB back IN.' },
      { who: 'atalanta', text: 'Comfy up here! You steer, Jason. I’ll do the cheering.' },
    ],
    fields: [
      { who: 'aeetes', text: 'You found a TOY in my forge? How sweet. Anvil drones! Drop something heavy on it.' },
      { who: 'atalanta', text: 'Anvils?! Jason, keep an eye on the sky. I’ll keep an eye on everything else.' },
      { who: 'bolt', text: 'And I will keep my eyes closed. That is my job.' },
    ],
    casting: [
      { who: 'iris', text: 'This is the old casting floor, where the Gardeners poured hot bronze. The plates in the middle are cracked.' },
      { who: 'jason', text: 'And that wall is too high, even for the mech. So... we go DOWN.' },
      { who: 'atalanta', text: 'Jump and SLAM? I love this mech.' },
    ],
    pit: [
      { who: 'bolt', text: 'We are under the wall! The trench climbs up into a big yard full of bellows.' },
      { who: 'halcyon', text: 'Talos is behind the gate at the far end. My earthquake sensor can hear every footstep. Every. Single. One.' },
    ],
    'shard:s1': [
      { who: 'atalanta', text: 'A light-stone, up where only a wall-jump reaches! It glows orange, then white, like hot metal.' },
      { who: 'iris', text: 'In the Gardeners’ words, that means “make”: making things with your own hands. A good word for a forge.' },
    ],
    'shard:s2': [
      { who: 'bolt', text: 'Another light-stone! Gold, then teal, around and around, like a hug.' },
      { who: 'iris', text: 'That word is “keep safe”. The Gardeners carved it on Talos’s chest, too.' },
    ],
    'shard:s3': [
      { who: 'iris', text: 'The last one, on top of the chimney. It glows soft blue, slower and slower... “rest”.' },
      { who: 'jason', text: 'Rest. Maybe that’s what Talos needs most.' },
    ],
    boss: [
      { who: 'aeetes', text: 'TALOS! Intruders in a bronze bucket! Stomp them flat!' },
      { who: 'bolt', text: 'He is so BIG. Jason, he is SO big.' },
      { who: 'iris', text: 'His eye glows red: that is Aeëtes’s control. Remember the carving. The plug in his heel.' },
      { who: 'jason', text: 'When he stomps, his foot gets stuck. We PUNCH the armour off his ankle... and pull!' },
      { who: 'atalanta', text: 'Easy, big guy. We’re here to help you.' },
    ],
    bossDown: [
      { who: 'aeetes', text: 'My bodyguard! Do you know how much it costs to reprogram a GIANT?' },
      { who: 'jason', text: 'He was never yours, Aeëtes. Rest well, Talos. We’ll keep your island safe.' },
      { who: 'halcyon', text: 'The labyrinth gate is open behind him. It leads underground, into Colchis itself.' },
    ],
  },
  stories: {
    // Jason and Atalanta find the sleeping mech (played while they climb aboard).
    'meet:mech': [
      {
        panel: 'ch3-mech',
        caption: 'In the middle of the old forge sat a bronze mech, waiting, just as the Gardeners had left it.',
        lines: [
          { who: 'iris', text: 'Not a robot: a mech, a suit you ride inside. The Gardeners used it to carry hot bronze. The light-words on it say: “Strong hands for gentle work.”' },
          { who: 'jason', text: 'There’s a seat in the glass bubble on top. And a flat bit on the shoulder that’s exactly the right size for...' },
          { who: 'atalanta', text: 'Me! I call the shoulder!' },
          { who: 'bolt', text: 'Its eye is lighting up! It likes us. I think it likes us. Please like us.' },
        ],
      },
    ],
    // Talos, free at last, sits down and nods (played after the fight, before `bossDown`).
    talos: [
      {
        panel: 'ch3-talos',
        caption: 'The golden light ran out of his heel like warm honey, and the great bronze giant sat down.',
        lines: [
          { who: 'iris', text: 'His eye is blue again. Aeëtes’s control is gone. He is himself.' },
          { who: 'bolt', text: 'He sat down so gently. Like a big bronze grandpa after lunch.' },
          { who: 'iris', text: 'He is speaking in light-words... “Thank you, small friends. I am tired now. I will rest.”' },
          { who: 'atalanta', text: 'Did he just NOD at us? He nodded at us! You’re welcome, Talos!' },
        ],
      },
    ],
  },
};
