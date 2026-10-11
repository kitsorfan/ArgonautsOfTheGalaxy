import type { LevelDef } from '../world/levelTypes';

/**
 * Chapter 3, level 10 (the game's finale) — The Golden Fleece: the Gardeners' great tree-temple on
 * Colchis, at golden twilight, with Jason and Atalanta (and, from the root hall on, General Brennus:
 * three heroes to switch between).
 *
 * 1. The landing glade among the giant roots: Aeëtes's new RING GUARDS (gold butler robots that throw
 *    their rings like boomerangs), a crawl tunnel only Atalanta's slide fits (a light-stone), and the root
 *    gate, opened by a bullseye for Atalanta's POWER ARROW.
 * 2. The root chasm: islands over the drop, a wall-run along a root wall (a light-stone) and a grapple
 *    ring up to a high root (the heart canister).
 * 3. The root hall: Brennus's lifeboat has crashed through the trunk and Aeëtes's guards have him pinned
 *    down. Drive them off and he JOINS, with his own squad of Legion robots. Only he can smash the
 *    cracked rock to the Legion gallery, where Aeëtes's gold-painted squad (his old robots) obey his
 *    COMMAND. A grapple ring leads up to a light-stone shelf.
 * 4. PANDORA's shop, then the seal court before the Fleece vault: the vault gate has three seals, one
 *    for each hero. A bullseye on a high ledge (Atalanta), a red switch on a root pillar only the
 *    grapple reaches (Jason), and a switch behind cracked rock (Brennus). Gardener light-word rune pads
 *    open a chest of the Gardeners (the vault).
 * 5. The Fleece chamber: AEËTES, THE GOLDEN KING, in three phases that need all three heroes. Then the
 *    game's final endings (`fleece`, or `gardeners` with every Gardener light-stone): there is no exit.
 * Side quests: three light-stones, three gold nets of Gardener treasures Aeëtes's crew stole, a heart
 * canister, and the Gardeners' chest.
 */
export const fleece: LevelDef = {
  id: 'fleece',
  index: 22,
  name: 'The Golden Fleece',
  subtitle: 'Three heroes, one last climb',
  music: 'fleece',
  intro: 'intro',
  boss: 'goldenking',
  shardIds: ['s1', 's2', 's3'],
  colonistIds: ['c1', 'c2', 'c3'],
  heroes: ['jason', 'atalanta', 'brennus'],
  // General Brennus joins in the root hall, once Aeëtes's guards are driven off (the `join:brennus` trigger).
  joins: { brennus: 'brennus' },
  map: `
                      #######
                   #############
                  ####1111111####
                ####1:111Q11111####
               ###11*&1111111&111###
               ##11111111111111111##
              ###Q111111111111111Q###
              ##1:11111111111111111##
             ###1111111111111111111###
             ##111111111111111111111##
             ##111^111111$111111^111##
             ##1*;1111111111111111*1##
             ##111111111111111111111##
             ##111111111111111111'11##
             ###111Q11111111111Q'11###
              ##1111111111111111111##
              ###11111^11111^1111:###
               ##111111111111;1111##
               ###^11::11111:111^###
                ####'1111111111####
                  ####1111111####
     ####################G####################
     #111111111111111111111111111111111111111#
     #1^111Q111111111Q1111111Q11'z11Q11999111#
     #11'1111111111111111C11111111111119"9111#
     #1111z111;1**o1111111111111;111111111111#
     #111111oo11111111111111111*111E1111111:1#
     #1^111111111111R111111111oo11111111111^1#
     #11111;11A99111111111111111111111R111111#####
     #111111119<91111111111111111111111111111#1[1#
     #1h11111199911111111111E11111111111111110111#
     #1&11111111111111111c11111111111oo111111#1|1#
######111111111111111111111111111111111111111#111#
#1111#111oo11:p1111111p111111;11R1111111111&1#####
#1111#111111/111111111111-111111;111111111111#
#1I11O1111111111111]1111111111111111111111111#
#1111#111}:111111111111o111o1122222222211p111#
#1111#1111111111{11111111P11112333:3;32111111#
######11S11111111'11*11111=111233333:321111^1#
     #111^1111111111111111111111111111111^111#
     ###################111###################
                     #111k111#
                     #1V11111#
                     #111M111#
                     #11111'1#
           ##############H##############
           #111Q11m111111Q111111m11Q111#
           #1222111111111F11111111111x1#
           #1;221111F111111111F11111&11#
           #11q111*111oo111oo1:'111W111#
           #1:1N11111111U11111111111111#
           #1&11f1111'1111111'11111:1x1#
           #11111111Q111111111Q11111111#
       ##################%##################
       #>8111m11111111111e11111111111m11111#
       #8A1111111111oo1d1111111u1111111r111#
       #1111Q11111'111Z11111Z11111B111Q1111#
       #1111Q11111Q1111111111oo1111111w11^1#
       #1&11111111'1T11111;11111111v1111111#
       #1111Q111111111'11J1111T11111;1Q1111#
       #1111112oo1111111111111111'1111'1111#
       #111)1122211111111111111'Q2oo211Q111#
       #1^11Q122'11;:1111L1111:112'221Q11^1#
       #11111111111111111j11111111111111111#
       ################11111################
                      111o111    2?2####
                           z     o22Y###
                                    Y###
                A66   1z11111       Y###
                6+6   11oao11       Y###
                666                 Y###
                                    Y###
                     11o1K1o11111111####
                    1111111111111111
     ####################D####################
     #.......................................#
     #.h^.........Q............6t6.........x.#
     #..oo.*.&......m..........6'6.m....oo.:.#
     ########...........;.....Q..'..'........#
     ########......Q..........bQ..p......(...#
     ########.i.....ooo......y...:..R.....*&.#
     ##!.oo.l.........'...*......*........'..#
     ########....................z.......&.*.#
     ########....:.Q...........Q.............#
     ########......~~~~~....R...........E....#
     #.............~~~~~.......;...:.........#
     #...;.....z...~~~~~..........;2222....*.#
     #.....E.......Q...........Q..22oo2......#
     #..................n.........22222......#
     #....2222..ooo...............22222.*....#
     #....2oo2.........'.....'z............*.#
     #....2222..;..Q:......s...Q........*.^..#
     #....'222..*.....g........ooo...........#
     #......;'....E......@...................#
     #..xx'.*.^......':.....:....*........X;.#
     #..&....................;......^......^.#
     #.......................................#
     #########################################
`,
  legend: {
    // The way through.
    D: { type: 'door', id: 'rootgate', open: { flag: 'tA' } },
    H: { type: 'door', id: 'squadgate', open: { clear: 'squad' } },
    G: { type: 'door', id: 'vaultgate', open: { all: [{ flag: 'sealA' }, { flag: 'sealJ' }, { flag: 'sealB' }] } },
    $: { type: 'boss', boss: 'goldenking', room: 'arena' },
    K: { type: 'checkpoint', id: 'cp1' },
    L: { type: 'checkpoint', id: 'cp2' },
    M: { type: 'checkpoint', id: 'cp3' },
    C: { type: 'checkpoint', id: 'cp4' },
    V: { type: 'vendor' },
    g: { type: 'holo', log: 'log', who: 'hypatia' },
    // Where the waypoint points, and where Brennus and his squad stand.
    b: { type: 'marker', id: 'bull' },
    a: { type: 'marker', id: 'chasm' },
    B: { type: 'marker', id: 'brennus' },
    u: { type: 'marker', id: 'squad1' },
    v: { type: 'marker', id: 'squad2' },
    w: { type: 'marker', id: 'squad3' },
    e: { type: 'marker', id: 'crack' },
    N: { type: 'marker', id: 'post' },
    c: { type: 'marker', id: 'seals' },
    j: { type: 'trigger', id: 'inhall', event: 'flag:hall', dialogue: 'hall', w: 7, d: 1 },
    J: { type: 'trigger', id: 'meet', event: 'join:brennus', w: 25, d: 7, when: { clear: 'hall' } },
    k: { type: 'trigger', id: 'incourt', dialogue: 'seals', w: 5, d: 1, when: { flag: 'brennus' } },
    // Hero puzzles: bullseyes for Atalanta, red switches for Jason (or Brennus's stomp), cracked rock for Brennus.
    t: { type: 'target', flag: 'tA' },
    // The three vault seals glow with a beam in their hero's colour, and the action button does the move up close.
    '"': { type: 'target', flag: 'sealA', seal: 'atalanta' },
    '<': { type: 'switch', flag: 'sealJ', seal: 'jason' },
    '|': { type: 'switch', flag: 'sealB', seal: 'brennus' },
    '0': { type: 'cracked', seal: 'brennus' },
    '%': { type: 'cracked' },
    q: { type: 'post', flag: 'turn', order: 'fight', room: 'squad' },
    Y: { type: 'wallrun' },
    l: { type: 'lowgap', axis: 'x' },
    A: { type: 'anchor' },
    // The Gardeners' chest: their oldest poem, in light-words.
    '{': { type: 'rune', group: 'vault', order: 1, color: '#5ec8ff' },
    '}': { type: 'rune', group: 'vault', order: 2, color: '#7dff9a' },
    ']': { type: 'rune', group: 'vault', order: 3, color: '#ff6fcf' },
    '/': { type: 'rune', group: 'vault', order: 4, color: '#ffd166' },
    O: { type: 'door', id: 'vaultdoor', open: { flag: 'vault' } },
    I: { type: 'prize', id: 'vault', reward: 'clip' },
    // Collectibles: Gardener light-stones, gold nets of stolen Gardener treasures, a heart canister.
    '!': { type: 'shard', id: 's1' },
    '?': { type: 'shard', id: 's2' },
    '>': { type: 'shard', id: 's3' },
    '(': { type: 'cocoon', id: 'c1', name: 'The Gardeners’ seed jar', line: 'Seeds older than the moon itself, still warm.' },
    ')': { type: 'cocoon', id: 'c2', name: 'The Gardeners’ sky-harp', line: 'It plays a little tune all by itself.' },
    '[': { type: 'cocoon', id: 'c3', name: 'The Gardeners’ star-lantern', line: 'It glows in every colour at once.' },
    '+': { type: 'canister', id: 'hc' },
    // Aeëtes's crew: ring guards, gold drones and harpies, and the Legion robots he painted gold.
    R: { type: 'enemy', enemy: 'ringguard' },
    z: { type: 'enemy', enemy: 'buzzer', variant: 'sand' },
    E: { type: 'enemy', enemy: 'trooper', variant: 'gold' },
    p: { type: 'enemy', enemy: 'harpy' },
    T: { type: 'enemy', enemy: 'ringguard', room: 'hall' },
    Z: { type: 'enemy', enemy: 'buzzer', variant: 'sand', room: 'hall' },
    F: { type: 'enemy', enemy: 'trooper', variant: 'gold', room: 'squad' },
    U: { type: 'enemy', enemy: 'bulwark', variant: 'gold', room: 'squad' },
    W: { type: 'enemy', enemy: 'mortar', variant: 'gold', room: 'squad' },
    // Signs.
    s: { type: 'sign', text: 'THE GARDENERS’ TREE-TEMPLE. Tap the switch button to swap between Jason and Atalanta. Each hero has moves the other one doesn’t!' },
    n: { type: 'sign', text: 'RING GUARDS! They hide behind their gold ring, then throw it like a boomerang. JUMP over the ring, and hit the guard while its ring is away.' },
    y: { type: 'sign', text: 'The root gate opens with a bullseye up on that ledge. Switch to Atalanta, hold BOW for a POWER ARROW, and let go!' },
    i: { type: 'sign', text: 'A crawl tunnel in the roots, with yellow-and-black stripes: only Atalanta’s SLIDE fits under. Something glows at the far end...' },
    d: { type: 'sign', text: 'Cracked rock with gold in the cracks! Only General Brennus can smash it: switch to him, then CHARGE into it, or HOLD the CANNON for a BIG BLAST.' },
    f: { type: 'sign', text: 'A Legion COMMAND POST! As General Brennus, walk up and press COMMAND. His old robots still know his voice.' },
    P: { type: 'sign', text: 'THE FLEECE VAULT. Three seals, three heroes: follow the three beams of light! Atalanta: a POWER ARROW at the bullseye up high. Jason: GRAPPLE up the root pillar, then POUND the red switch. General Brennus: SMASH the cracked rock, then POUND the switch behind it.' },
    S: { type: 'sign', text: 'The Gardeners’ oldest poem, in light-words: “Under the SKY, the little seeds GROW. A FRIEND carries them HOME.” Step on the colours of the poem in order, and the Gardeners’ chest will open.' },
    // Decor.
    Q: { type: 'decor', kind: 'pillar', scale: 1.3 },
    '^': { type: 'decor', kind: 'tree', scale: 1.4 },
    '*': { type: 'decor', kind: 'bloom', solid: false },
    ':': { type: 'decor', kind: 'flowers' },
    ';': { type: 'decor', kind: 'grass' },
    '&': { type: 'decor', kind: 'crystal' },
    '-': { type: 'decor', kind: 'fountain' },
    m: { type: 'decor', kind: 'banner' },
    "'": { type: 'decor', kind: 'fern' },
    r: { type: 'decor', kind: 'wreck', scale: 1.4, rot: 0.6 },
  },
  objectives: [
    { until: { flag: 'tA' }, text: 'Open the root gate: hit the bullseye with Atalanta’s POWER ARROW', at: 'bull' },
    { until: { flag: 'hall' }, text: 'Cross the root chasm into the great tree', at: 'chasm' },
    { until: { flag: 'brennus' }, text: 'Someone is pinned down in the root hall: drive off Aeëtes’s guards!', at: 'brennus' },
    { until: { clear: 'squad' }, text: 'As General Brennus, smash the cracked rock and COMMAND his old robots', at: 'post' },
    { until: { all: [{ flag: 'sealA' }, { flag: 'sealJ' }, { flag: 'sealB' }] }, text: 'Break the three seals of the Fleece vault: one for each hero', at: 'seals' },
    { until: { boss: true }, text: 'Stop Aeëtes, the Golden King', at: 'boss' },
    { until: { flag: 'never' }, text: 'Carry the Golden Fleece home to Celestia', at: 'boss' },
  ],
  dialogues: {
    intro: [
      { who: 'captain', text: 'Argonauts, this is it: the Gardeners’ great tree-temple. The Fleece is somewhere at the very top.' },
      { who: 'iris', text: 'The Sleepless Dragon is snoring away behind us. It sounds like a very happy volcano.' },
      { who: 'bolt', text: 'And THAT sounds like gold drones. Lots of them. Aeëtes got here first!' },
      { who: 'atalanta', text: 'First doesn’t mean fastest. Race you to the top, Jason!' },
      { who: 'jason', text: 'Not yet! Together, remember? Come on, LUX. Let’s bring Celestia her Fleece.' },
    ],
    log: [
      { who: 'hypatia', text: 'Argonauts, it’s Dr. Hypatia, beaming this through the Argo. Celestia is very weak today. Her glow is almost gone.' },
      { who: 'hypatia', text: 'But this morning she flashed three words at General Brennus’s little sprout: “brave”, “friends”, “hurry”.' },
      { who: 'hypatia', text: 'And then Brennus took the Gorgon’s lifeboat and flew off toward Colchis. Without telling ANYONE. Again. Please look after each other.' },
    ],
    hall: [
      { who: 'brennus', text: 'Get back, you overgrown tin waiters! I have a cannon, and I have a very bad temper!' },
      { who: 'atalanta', text: 'That voice... it’s General Brennus! His lifeboat crashed right through the tree!' },
      { who: 'jason', text: 'Aeëtes’s guards have him trapped. Let’s give him a hand!' },
    ],
    'meet:brennus': [
      { who: 'brennus', text: 'Hmph. I had them exactly where I wanted them.' },
      { who: 'jason', text: 'Hiding behind your lifeboat?' },
      { who: 'brennus', text: '...Mostly where I wanted them. Thank you, Argonauts.' },
    ],
    'joined:brennus': [
      { who: 'halcyon', text: 'General Brennus has joined the Argonauts! Tap the switch button to swap between all THREE heroes: Jason, Atalanta and the General.' },
      { who: 'bolt', text: 'Brennus has a cannon, a shield and a CHARGE that smashes cracked rock! And he brought his own robots!' },
    ],
    seals: [
      { who: 'iris', text: 'The Fleece vault. The Gardeners closed it with three seals, and wrote on the gate in light-words.' },
      { who: 'bolt', text: 'It says: “Only those who stand TOGETHER may enter.” Three seals. Three heroes. That’s us!' },
      { who: 'brennus', text: 'Together. I keep finding that word everywhere these days.' },
      { who: 'iris', text: 'See the three beams of light? One for each hero, in their colour. Bring the right hero close to a beam and press the action button!' },
    ],
    boss: [
      { who: 'aeetes', text: 'Ah, the Argonauts! Right on time to watch me collect my prize. Look at it. The GOLDEN FLEECE.' },
      { who: 'aeetes', text: 'With this I can make a thousand green planets... and sell every single one of them!' },
      { who: 'atalanta', text: 'You can’t SELL a planet!' },
      { who: 'aeetes', text: 'Watch me, little scout. My drones, my rings! Take out the trash!' },
      { who: 'jason', text: 'Everybody together, just like the gate said. Let’s go!' },
    ],
    wear: [
      { who: 'aeetes', text: 'Enough! If you won’t let me sell the Fleece... I will WEAR it!' },
      { who: 'iris', text: 'No! The Fleece is alive. It will not like being worn by someone so greedy!' },
    ],
    armour: [
      { who: 'aeetes', text: 'Ha ha HA! Gold armour! Gold vines! I am the GOLDEN KING now, and everything I touch is MINE!' },
      { who: 'brennus', text: 'I know that look. I wore it once myself. Argonauts: my shield will stop his charge. Then hit him with everything!' },
    ],
    grow: [
      { who: 'aeetes', text: 'Still standing? Then GROW, Fleece! Make me bigger! Make me the biggest thing on this moon!' },
      { who: 'bolt', text: 'Uh-oh. Uh-oh. He’s growing. Why do the bad guys ALWAYS grow?' },
    ],
    giant: [
      { who: 'iris', text: 'Look: the Fleece’s vines are holding him to the floor. Atalanta, your arrows can cut them!' },
      { who: 'brennus', text: 'Then I will crack that crystal on his chest, and the last shot is yours, boy.' },
      { who: 'jason', text: 'One hero each. Let’s finish this!' },
    ],
    bossDown: [
      { who: 'aeetes', text: 'No, no, NO! Come back, Fleece! I bought you! ...Well, I was GOING to buy you!' },
      { who: 'brennus', text: 'The Fleece chose, Aeëtes. It does not want to be owned. Nothing alive does.' },
      { who: 'atalanta', text: 'And look: it tied him up with its own vines, like a big gold present!' },
      { who: 'aeetes', text: 'Mmph! Let me out! I have a VERY important meeting about selling a moon!' },
    ],
    fleeceWon: [
      { who: 'jason', text: 'The Golden Fleece. It’s so warm... like holding a sunbeam.' },
      { who: 'bolt', text: 'Celestia is waiting. Let’s take it home, Jason!' },
    ],
    gardenWords: [
      { who: 'iris', text: 'LUX... we found every light-stone. Every word the Gardeners left. Shall we say hello?' },
      { who: 'bolt', text: 'In Gardener! Sky... grow... friend... home... together!' },
    ],
    seedsAwake: [
      { who: 'iris', text: 'The Fleece is answering! Every seed in it is waking up. They say... “We are Celestia’s family.”' },
      { who: 'bolt', text: 'Celestia isn’t the last of her kind. She’s got a WHOLE FLEECE of brothers and sisters!' },
      { who: 'jason', text: 'Then let’s take them home. All of them. Together!' },
    ],
    'shard:s1': [
      { who: 'iris', text: 'A light-stone, hidden at the end of the crawl tunnel. It glows warm orange, then soft green: “seed”.' },
      { who: 'bolt', text: 'Seed! Like the ones in the Fleece. The Gardeners really liked gardening, huh?' },
    ],
    'shard:s2': [
      { who: 'bolt', text: 'A light-stone on the hidden ledge! This one shines silver, then blue: it means “wake up”.' },
      { who: 'atalanta', text: 'Funny word to leave in a tree full of sleeping things.' },
    ],
    'shard:s3': [
      { who: 'iris', text: 'The last light-stone of the temple. It glows every colour, slowly, like a heartbeat: “family”.' },
      { who: 'brennus', text: 'Family. Hmph. The sprout on my belt is glowing like a lantern. I think it likes that one.' },
    ],
    'colonist:c1': [
      { who: 'iris', text: 'A Gardener seed jar, stolen by Aeëtes’s crew! The seeds inside are older than the moon, and still warm.' },
      { who: 'bolt', text: 'We’ll put it back where it belongs. Gently. Very, very gently.' },
    ],
    'colonist:c2': [
      { who: 'bolt', text: 'A Gardener sky-harp! Listen: it plays a little tune all by itself.' },
      { who: 'brennus', text: 'My grandmother used to hum that tune in her greenhouse. ...How strange.' },
    ],
    'colonist:c3': [
      { who: 'atalanta', text: 'A Gardener star-lantern, stuffed into a gold net. It glows every colour at once!' },
      { who: 'iris', text: 'The Gardeners lit their way with these. Now it can light ours.' },
    ],
  },
  stories: {
    // Brennus joins the Argonauts, with his own little squad of Legion robots.
    'meet:brennus': [
      {
        panel: 'ch3-squad',
        lines: [
          { who: 'brennus', text: 'I came to help. Celestia is fading, and an old soldier still knows how to march.' },
          { who: 'brennus', text: 'And I brought my squad. My own robots, the ones I painted green again. They plant trees now. They also bite.' },
          { who: 'atalanta', text: 'You flew off alone without telling anyone? Who does that?' },
          { who: 'brennus', text: 'Hmph. I hear it runs in the crew.' },
          { who: 'jason', text: 'Welcome to the Argonauts, General. Let’s get that Fleece. Together.' },
        ],
      },
    ],
  },
};
