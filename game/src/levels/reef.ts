import type { LevelDef } from '../world/levelTypes';

/**
 * Chapter 3, Scylla's Reef: a sunny strait of coral and sandbars on the water moon, where the Dolphin
 * surfaces after the Sirens' Sea. The sea here breathes: the TIDE comes in and goes out every half
 * minute (a gauge on the HUD blinks before it rises). At low tide the sandy paths between the coral are
 * dry; at high tide they're under water, and anyone caught on them is washed back. Driftwood RAFTS sit
 * on the sand at low tide and float up beside the high ledges at high tide.
 *
 * Jason and Atalanta (with LUX and IRIS) cross the first flats to a coral island, then the wide
 * sandbars (crab-drones and jellyfish-drones, a raft up to a high ledge, a wall-jump nook for
 * Atalanta), to the old lighthouse. Its lamp opens the causeway gate: Atalanta hits the lamp's
 * sun-mirror out at sea with a power arrow, and Jason grapples to a sea stack and pounds the red switch.
 * The causeway floods at high tide (wait on its rocks), and leads to the landing under Scylla's rock
 * (PANDORA's shop, the last checkpoint, Scylla's crane crew to chase off). On the rock waits SCYLLA,
 * Aeëtes's six-armed crane robot, beside CHARYBDIS, the whirlpool that pulls on a rhythm: Atalanta's
 * power arrows jam her glowing elbows, and Jason ground-pounds her base plates.
 *
 * Side quests: three gold nets of the Argo's stolen supplies, three Gardener light-stones (a raft
 * ledge, Atalanta's wall-jump nook, a sea stack only Jason's grapple reaches), a heart canister behind
 * a crawl hole only Atalanta's slide fits through, and the lighthouse keeper's shell vault.
 */
export const reef: LevelDef = {
  id: 'reef',
  index: 17,
  name: 'Scylla’s Reef',
  subtitle: 'Between the rock and the whirlpool',
  music: 'reef',
  intro: 'intro',
  boss: 'scylla',
  shardIds: ['s1', 's2', 's3'],
  colonistIds: ['c1', 'c2', 'c3'],
  heroes: ['jason', 'atalanta'],
  // The sea: half a minute from one low tide to the next.
  tide: { low: -0.6, high: 1.6, phases: [14, 5, 10, 5] },
  map: `
                 ###################
                 ###################
                    ####66666####
                  ###W666666666W###
                 ##6666666B6666666##
                ##66666666666666666##
                #6666666666666666666#
               ##"66666666666666666"##
               #666666666666666666666#
           66666666666666666666666666
           6E666666666666   666666666
           666|666666666  C  66666666
           6666666666666     66666666
                 66666666   6666666<
                 :666666666666666666
                  66o66666666666o66
                   666666666666666
                     66666666666
                        66666
              ############G############
                   W44444e55444444
                   4y444U4u4444V44
                   444N444444y4444
                   4444444F44444g4
                   44h44444444444:
                        .....
                        ..o..
                        ...j.
                        ....|
                   4W444.....
                   44444...;.          9*
                   44c44..o..          A9
                   x4444.....
                        .j...
                        .....
                        ..o..4o444
                        ..o..44444
                        .;...444&4
                        |....44h4W
                        .....
                        ..j..
                        .....
                        d4444
                ##########D##########
     6666666666666"555555555555555"
     6W6666666c6<655555555i55m55555
     66666666h66665555555:555555{55
 99  66666666666665555[55555555555j
 T9  6666L666666665555555555555o555
 99  6666666k666665555t55555555555^     $P
     X666666666666555555555]55t5555     A9
     6666H666666665x555555555555555
     66666666666p6555oo55555555555W
     66z6666666666555555}555oo#####
     6666666:66666555555555555#555#
                  ####555m5555#5I5#
                  #55#55555555O555#
                  #+5l55555555#555#
                  #55#55555555#####
                  #55#5v55M55a55555
                  ####55555555555x5
                  55555555S555555)5
                  55c5555Z5;5555555
              ....44444444444444444....
              ......|................;.
              ..............j..........
              .o......ooo........c.....
              ........4W4................
       #######........x4j..............o.888
       ######...........................r8!8
       ##?88.o.............o.n44..;....o.888
       ##8o8...............o.4c4.........
       ######..w....c....;...X4W.......
       #######.........................
              .....................j...
              ...;...44<...............
              .......4t4...............
              .......x44...c........oo.
              ..j......................
              .....;............|......
              .........................
                :4444444444444<4444W4
                44(4444oo4J4444c44444
                4444444444K4444444444
                44444c44444444444444Y
                4444444444R44x444q444
                4W44/44444444444444h4
                       .......
                       |..o...
                       ..;....
                       ...o;..
                       .o....|
                444444444444444444444
                4Y444444s444o4o4444Y4
                4444444444Q4444444444
                444x44444444444:4x444
                4444:44444@4444444444
                44Y4444444444444W4Y44
`,
  legend: {
    // The way through.
    E: { type: 'exit' },
    B: { type: 'boss', boss: 'scylla', room: 'arena' },
    C: { type: 'marker', id: 'charybdis', floor: 'void' },
    D: { type: 'door', id: 'lampgate', open: { all: [{ flag: 'tL' }, { flag: 'swL' }] }, h: 2.5 },
    G: { type: 'door', id: 'rockgate', open: { clear: 'guards' }, h: 3 },
    K: { type: 'checkpoint', id: 'cp1' },
    M: { type: 'checkpoint', id: 'cp2' },
    N: { type: 'checkpoint', id: 'cp3' },
    V: { type: 'vendor' },
    H: { type: 'holo', log: 'log', who: 'captain' },
    J: { type: 'marker', id: 'isle' },
    Z: { type: 'marker', id: 'lighthouse' },
    k: { type: 'marker', id: 'lamp' },
    u: { type: 'marker', id: 'rock' },
    $: { type: 'marker', id: 'stack' },
    Q: { type: 'trigger', id: 'tides', dialogue: 'tides', w: 11, d: 2 },
    R: { type: 'trigger', id: 'isleflag', event: 'flag:isle', w: 21, d: 3 },
    S: { type: 'trigger', id: 'plaza', event: 'flag:plaza', dialogue: 'lighthouse', w: 17, d: 2 },
    // The plaza's east edge, facing the sea stack: LUX points out the grapple ring.
    '^': { type: 'trigger', id: 'hook', dialogue: 'hook', w: 3, d: 11 },
    i: { type: 'trigger', id: 'lit', dialogue: 'lit', w: 5, d: 2, when: { all: [{ flag: 'tL' }, { flag: 'swL' }] } },
    F: { type: 'trigger', id: 'rockstory', event: 'story:rock', w: 15, d: 2 },
    // The tide's gadgets, and the heroes' puzzles: a bullseye for Atalanta, a switch on a sea stack for Jason.
    r: { type: 'raft' },
    A: { type: 'anchor' },
    T: { type: 'target', flag: 'tL' },
    P: { type: 'switch', flag: 'swL' },
    l: { type: 'lowgap', axis: 'x' },
    // The lighthouse keeper's shell vault: sand, sea, coral, cloud.
    '[': { type: 'rune', group: 'vault', order: 1, color: '#ffd166' },
    ']': { type: 'rune', group: 'vault', order: 2, color: '#3fc8e0' },
    '{': { type: 'rune', group: 'vault', order: 3, color: '#ff7a8a' },
    '}': { type: 'rune', group: 'vault', order: 4, color: '#ffffff' },
    O: { type: 'door', id: 'vaultdoor', open: { flag: 'vault' } },
    I: { type: 'prize', id: 'vault', reward: 'boltZap' },
    // Aeëtes's reef robots, and the old Legion robots he crews his crane with.
    c: { type: 'enemy', enemy: 'crab' },
    j: { type: 'enemy', enemy: 'jelly' },
    q: { type: 'enemy', enemy: 'harpy' },
    t: { type: 'enemy', enemy: 'trooper' },
    m: { type: 'enemy', enemy: 'minebot' },
    z: { type: 'enemy', enemy: 'mortar' },
    U: { type: 'enemy', enemy: 'bulwark', room: 'guards' },
    y: { type: 'enemy', enemy: 'trooper', room: 'guards' },
    g: { type: 'enemy', enemy: 'crab', room: 'guards' },
    // Collectibles: Gardener light-stones, gold nets of the Argo's supplies, a heart canister.
    '!': { type: 'shard', id: 's1' },
    '?': { type: 'shard', id: 's2' },
    '*': { type: 'shard', id: 's3' },
    '(': { type: 'cocoon', id: 'c1', name: 'The Argo’s fruit basket', line: 'Every single mango, safe and sound!' },
    ')': { type: 'cocoon', id: 'c2', name: 'Atalanta’s snack bag', line: 'Crackers, raisins and a brand new sandwich!' },
    '&': { type: 'cocoon', id: 'c3', name: 'Captain Argus’s jam jars', line: 'My jam! Strawberry, fig and moon-plum!' },
    '+': { type: 'canister', id: 'hc' },
    // Signs.
    s: {
      type: 'sign',
      text: 'TIDE GAUGE! Watch the wave meter under your bolts. LOW TIDE: the sandy paths are dry, so go! When it BLINKS, the tide is coming in: climb up onto the coral. HIGH TIDE: the sand is under water. Wait, and it goes out again.',
    },
    n: { type: 'sign', text: 'RAFTS float! At low tide a raft sits on the sand. At high tide the sea lifts it up... right next to that high ledge.' },
    w: { type: 'sign', text: 'A ledge too high to jump? Atalanta can WALL-JUMP: jump at the rock wall, then jump again off it!' },
    p: {
      type: 'sign',
      text: 'THE LIGHTHOUSE GATE. Light the lamp to open it! Atalanta: hit the sun-mirror on the rock out at sea with a POWER ARROW. Jason: GRAPPLE over to the tall rock in the east and GROUND-POUND its red switch.',
    },
    a: { type: 'sign', text: 'The keeper’s rhyme: “From the sand to the sea, from the coral to the cloud.” Step on my shells in that order, and my treasure cave will open.' },
    v: { type: 'sign', text: 'A crawl hole! Only Atalanta’s SLIDE fits through. I wonder what the old keeper hid in there...' },
    d: { type: 'sign', text: 'THE CAUSEWAY floods at high tide! If the gauge blinks while you’re halfway across, hop onto a rock and wait.' },
    e: {
      type: 'sign',
      text: 'SCYLLA’S ROCK. When one of her elbows glows blue, jam it with Atalanta’s POWER ARROW. Two jammed arms and she overloads: then switch to Jason and GROUND-POUND a glowing plate by her base!',
    },
    // Decor.
    L: { type: 'decor', kind: 'lighthouse', scale: 1.2, rot: 0.2 },
    W: { type: 'decor', kind: 'coral' },
    '<': { type: 'decor', kind: 'seafan', rot: 0.8 },
    ';': { type: 'decor', kind: 'kelp' },
    ':': { type: 'decor', kind: 'shell', rot: 2.2 },
    '|': { type: 'decor', kind: 'tidepost' },
    Y: { type: 'decor', kind: 'palm' },
    '"': { type: 'decor', kind: 'boulder', scale: 1.4 },
    '/': { type: 'decor', kind: 'rock' },
  },
  objectives: [
    { until: { flag: 'isle' }, text: 'Cross the sand at low tide (watch the tide gauge!)', at: 'isle' },
    { until: { flag: 'plaza' }, text: 'Cross the sandbars to the old lighthouse', at: 'lighthouse' },
    { until: { flag: 'swL' }, text: 'Jason: GRAPPLE to the ring on the east rock, then pound its red switch', at: 'stack' },
    { until: { flag: 'tL' }, text: 'Atalanta: hit the lamp’s sun-mirror with a POWER ARROW', at: 'lamp' },
    { until: { clear: 'guards' }, text: 'Cross the causeway and chase Scylla’s crew off the rock', at: 'rock' },
    { until: { boss: true }, text: 'Switch off SCYLLA: jam her arms, then pound her plates', at: 'boss' },
    { until: { flag: 'never' }, text: 'Sail the Argo on to Talos’s island', at: 'exit' },
  ],
  dialogues: {
    intro: [
      { who: 'captain', text: 'Argo to the Dolphin: we can see you! You came up right at the strait. Welcome back to the sunshine!' },
      { who: 'bolt', text: 'Sunshine! Sand! No more spooky singing! ...Wait. Why is the sea going DOWN?' },
      { who: 'iris', text: 'It is the tide, LUX. This moon’s big planet pulls the sea up and down, like breathing. In, and out, every half a minute.' },
      { who: 'atalanta', text: 'And look over there: a huge rock with a crane on top, and a whirlpool spinning beside it. Scylla and Charybdis, just like the old story.' },
      { who: 'captain', text: 'The Argo can’t get past while that crane robot grabs at every ship. She snatched our supplies yesterday! Find a way to switch her off.' },
      { who: 'jason', text: 'Leave it to us. Come on, Atalanta: let’s cross the reef while the tide is out!' },
    ],
    tides: [
      { who: 'halcyon', text: 'See the tide gauge under your bolts? When it blinks, the tide is coming in.' },
      { who: 'bolt', text: 'And then these sandy paths go under water. Don’t get caught on them, or... SPLASH!' },
      { who: 'atalanta', text: 'So we run across at low tide, and wait up on the coral when it comes in. Easy!' },
    ],
    lighthouse: [
      { who: 'iris', text: 'An old lighthouse! And look: its lamp has a sun-mirror, out on that rock in the sea.' },
      { who: 'halcyon', text: 'The gate to the causeway runs on the lighthouse’s power. Light the lamp, and it should open.' },
      { who: 'jason', text: 'There’s a red switch on that tall rock to the east. I can grapple over to it!' },
      { who: 'atalanta', text: 'And the sun-mirror is a bullseye. One power arrow, coming right up.' },
    ],
    hook: [
      { who: 'bolt', text: 'See the glowing ring on that tall rock? Jason, turn to face it, and when GRAPPLE lights up, press it!' },
    ],
    lit: [
      { who: 'bolt', text: 'The lamp is on! The gate is opening! I love lighthouses. They’re like me, but taller.' },
      { who: 'captain', text: 'We can see your light from the Argo! Now we know where the safe channel is.' },
    ],
    log: [
      { who: 'captain', text: 'Argo log, Captain Argus, recorded on a message buoy. We tried to sail through the strait this morning. Big mistake.' },
      { who: 'captain', text: 'A crane robot on the rock grabbed the crates right off our deck: our fruit, Atalanta’s snacks, and all of my jam. ALL of it.' },
      { who: 'captain', text: 'Then her crab-drones dragged everything across the reef in gold nets. If anyone finds this: we would really like that jam back.' },
    ],
    boss: [
      { who: 'aeetes', text: 'Ahh, the little Argonauts. Have you met my SCYLLA? Six arms, no manners, and she never, ever lets go.' },
      { who: 'aeetes', text: 'She has caught nineteen ships, four whales and one very surprised lighthouse. You will make twenty!' },
      { who: 'atalanta', text: 'Jason, watch her elbows. When one glows blue, I’ll jam it.' },
      { who: 'jason', text: 'And when she slumps, I pound her plates. Teamwork!' },
    ],
    bossDown: [
      { who: 'bolt', text: 'All six arms are folded up! She looks like a very tired spider.' },
      { who: 'iris', text: 'And listen: Charybdis is slowing down. Without Scylla’s pumps, the whirlpool is only a little swirl.' },
      { who: 'halcyon', text: 'Scylla was pumping the sea round and round to make it spin. The strait is safe now.' },
    ],
    'shard:s1': [
      { who: 'bolt', text: 'A light-stone, up where only the high tide could carry us! It ripples blue and green, like the sea.' },
      { who: 'iris', text: 'This word is “water”. The Gardeners must have loved this moon.' },
    ],
    'shard:s2': [
      { who: 'iris', text: 'A light-stone, hidden where only a wall-jumper could go. It glows bright orange, like a flame that will not go out.' },
      { who: 'atalanta', text: 'Let me guess: it means “brave”?' },
      { who: 'iris', text: 'It does. How did you know?' },
    ],
    'shard:s3': [
      { who: 'bolt', text: 'A light-stone on a rock in the sea! It shines gold, then white, then gold again, round and round.' },
      { who: 'iris', text: 'Like the lighthouse. This word is “light”. Celestia will love it.' },
    ],
    'colonist:c1': [
      { who: 'captain', text: 'That’s the Argo’s fruit basket! Every single mango, safe and sound. I’ll send a drone to fetch it.' },
    ],
    'colonist:c2': [
      { who: 'atalanta', text: 'My snack bag! Crackers, raisins and... a sandwich. A NEW sandwich. Today is getting better and better.' },
    ],
    'colonist:c3': [
      { who: 'captain', text: 'MY JAM! Strawberry, fig and the very rare moon-plum. You are true heroes, Argonauts.' },
      { who: 'bolt', text: 'He sounds happier about the jam than about the whole strait.' },
    ],
  },
  stories: {
    rock: [
      {
        panel: 'ch3-scylla',
        lines: [
          { who: 'atalanta', text: 'There she is. SCYLLA.' },
          { who: 'bolt', text: 'Six arms. SIX! That is four more than anybody needs.' },
          { who: 'iris', text: 'Her elbows are old crane joints. A good arrow in the right place could jam them.' },
          { who: 'jason', text: 'And if she stops swinging, I can stomp on whatever keeps her running.' },
          { who: 'aeetes', text: 'Crew! Keep those children off my rock!' },
          { who: 'atalanta', text: 'Her crew is guarding the gate. Let’s chase them off first!' },
        ],
      },
    ],
    strait: [
      {
        panel: 'ch3-strait',
        lines: [
          { who: 'captain', text: 'Argo coming through! Steady... steady... and we’re past the rock!' },
          { who: 'atalanta', text: 'Look, Jason! The whirlpool is just a little swirl now. Even the fish are coming back.' },
          { who: 'captain', text: 'Meet us at the pier on the rock, Argonauts. And bring the jam!' },
        ],
      },
    ],
  },
};
