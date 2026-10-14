import { CREATOR, GAME_NAME } from '../core/brand';
import { tr, upper } from '../core/i18n';
import { MUSIC_CREDITS } from '../core/music';
import type { SaveData } from '../core/save';
import { CHAPTER_DECKS, LEVELS, chapterTotals, inChapter, type Chapter } from '../levels';
import { plannedFinds } from './collectibles';
import type { BadgeKind } from '../entities/badges';
import type { BossKind, DeckId, EndingKind, Line } from '../world/levelTypes';

/**
 * The story of ASTROTROUBLES!
 *
 * A glowing space seed, GaScu, lands on a colony ship and grows over it. It puts the crew to
 * sleep in cocoons and steers the ship toward a star, because it would rather burn than be carried
 * to the planet the ship is flying to. Junior engineer Jason wakes up early, rescues the Captain's
 * scared little drone LUX, follows the Captain's recorded logs up six decks, saves Aunt Rosa, frees
 * HALCYON (the ship's computer) from GaScu pollen, and learns the truth: GaScu isn't a monster,
 * it's terrified. At the top, Jason can stop the Heart of GaScu, or, with every memory shard, LUX
 * can talk to it in lights.
 *
 * Chapter 2, GAIA NOVA. Forty years ago General Brennus led the first expedition, in the warship
 * Gorgon, to make Gaia Nova ready for the colony ship. The planet fought back, so he decided to
 * destroy the heart of all its plants, the great flower the scientists named Celestia; they mutinied
 * and launched it into space. Celestia IS GaScu (which is why, when it met the colony ship flying to
 * Gaia Nova, it turned the ship away), and chapter 2 calls it by that real name: Brennus reveals it
 * in his broadcast. Brennus captures Dr. Hypatia's science team, and his drones steal Celestia so he
 * can force its pollen into a Thorn Legion of machines and build the Colossus inside the volcano
 * Mount Atlantas. Jason and LUX cross six regions to free the scientists and Celestia. In the
 * tundra Brennus's snare drone carries LUX off, so Jason climbs the Rockies alone; in the jungle he
 * wakes IRIS, a rainbow droid of the Gardeners that Brennus threw away; and in the volcano Brennus
 * sets the reprogrammed LUX on him, until IRIS sings the control chip off and LUX comes home. The
 * 18 pages of Brennus's journal tell how a boy who loved his grandmother's greenhouse became a man
 * who tries to own everything; with all of them, Jason can talk him down instead of beating him.
 */

/** Narration for the opening cinematic, one caption per shot. */
export const PROLOGUE = {
  ship: 'The colony ship <b>{ship}</b>. Ten thousand people asleep in their pods, on the long journey to a new home.',
  quiet: 'The ship computer, <b>HALCYON</b>, kept watch. For months, everything was quiet...',
  comet: '...until something came flying out of the dark.',
  seed: 'It was not a comet. It was a seed: a glowing space vine called the <b>Galactic Cuscuta Echinochloa</b>. <b style="color:#ff6fcf">GASCU</b>, for short.',
  grow: 'GaScu grew and grew. It wrapped the crew in soft cocoons and made the robots go haywire.',
  turn: 'Then its roots reached the Bridge... and it turned the ship toward a burning star.',
  wake: 'But deep inside, on the Cryo Deck, one little pod was waking up early.',
};

/** Shown while the camera sweeps over a deck on the first visit. */
export const FLYOVER: Record<DeckId, string> = {
  cryo: '',
  hydro: '<b>Hydroponics</b>: the gardens that feed the whole ship. GaScu loves it here... a little too much.',
  engine: 'The <b>Engine Core</b>. The coolant pumps are off, the lava is rising, and something big is stomping around.',
  habitat: 'The <b>Habitat Ring</b>, where the colonists live. Home, sweet, gooey home.',
  security: 'The <b>Security Deck</b>. Lasers, cameras... and a voice that does not sound like HALCYON anymore.',
  bridge: '<b>The Bridge</b>. The star fills every window now. At the very top, the Heart of GaScu is waiting.',
  plains: 'The <b>Whispering Plains</b> of Gaia Nova. Golden grass as far as you can see... and the science team’s camp, empty.',
  desert: 'The <b>Glass Desert</b>. Sand that sparkles like sugar, ruins older than anyone remembers, and Brennus’s drills chewing through it all.',
  snow: 'The <b>Frostpeak Tundra</b>. Somewhere in this blizzard is Brennus’s prison camp, and the scientists he captured.',
  rockies: 'The <b>Titan Rockies</b>. Cliffs taller than the {ship}, rickety bridges, and up at the very top... the wreck of the Gorgon.',
  jungle: 'The <b>Thornwood Jungle</b>. Something is wrong here: the trees are grey, and Celestia’s pollen hangs in the air like fog.',
  volcano: '<b>Mount Atlantas</b>. Brennus built his fortress right inside the volcano. Celestia is in there. So is the end of this.',
  rocks: 'The <b>Clashing Rocks</b>. A glittering belt of asteroids guards the ring of moons... and somewhere in it, two giant rocks keep slamming together.',
  reef: 'The strait of <b>Scylla’s Reef</b>. Coral, sunshine and turquoise water... between a great dark rock and a whirlpool that never stops turning.',
  harpies: 'The <b>Harpy Isles</b>. Little green islands float on the wind, high above a sea of clouds... and something gold keeps flapping between them.',
  mine: 'The mining moon of <b>Aeëtes</b>. He is digging the whole moon into a golden pit... and <b>General Brennus</b> has just landed in it, all on his own.',
  sirens: 'The <b>Sirens’ Sea</b>. Deep under the waves of a water moon lies a sunken Gardener gate... and Aeëtes’s gold buoys are singing a very strange song.',
  forge: 'The bronze island of <b>Talos</b>. Lava channels, an ancient Gardener forge... and a bronze giant as tall as a tower, walking his rounds.',
  labyrinth: '<b>Medusa’s Labyrinth</b>. Under the gate of Colchis winds a maze of green stone... and in the dark, a great green eye is opening.',
  stand: 'The <b>sky-dock of Colchis</b>, floating above the clouds. Aeëtes’s gold fleet is coming to shut its gate... and one old general is standing in the way.',
  garden: 'The <b>Garden of Colchis</b>. Flowers as tall as houses, trees of glowing crystal, and fountains that whisper in light... and somewhere in the middle, something very big is <b>not</b> asleep.',
  fleece: 'The great tree-temple of the <b>Gardeners</b>, taller than any mountain. Somewhere at the top, the <b style="color:#ffd166">Golden Fleece</b> is waiting... and so is Aeëtes.',
};

/** What everyone says in the lift between one deck and the next, keyed by the deck being left. */
export const TRANSITIONS: Record<DeckId, Line[]> = {
  cryo: [
    { who: 'halcyon', text: 'Lift engaged! Jason, take a look out of the window.' },
    { who: 'jason', text: 'Whoa. Is that the star? It is SO bright.' },
    { who: 'halcyon', text: 'At this speed we will be too close in three days. Plenty of time! Probably. Maybe.' },
    { who: 'bolt', text: 'Look at the vines on the hull. They all grow toward the Bridge... like roots going home.' },
  ],
  hydro: [
    { who: 'halcyon', text: 'Warning: the ship is speeding up. The engines are running way too hot.' },
    { who: 'jason', text: 'Who turned them up?' },
    { who: 'halcyon', text: 'Not me! Something on the Bridge. GaScu is in a hurry to reach that star.' },
    { who: 'bolt', text: 'The Engine Core is full of lava. I will stay VERY close to you. Like, super close.' },
  ],
  engine: [
    { who: 'jason', text: 'The Habitat Ring is next... that is where I live. Where Aunt Rosa lives.' },
    { who: 'bolt', text: 'Is she nice? Does she like drones?' },
    { who: 'jason', text: 'She is the Security Chief. She is the bravest person I know. She will be okay. She has to be.' },
    { who: 'halcyon', text: 'Lift to the Habitat Ring. The star is getting... bzzt... closer.' },
  ],
  habitat: [
    { who: 'glitch', text: 'Lift to S-S-Security. GaScu is so... warm. So... pretty...' },
    { who: 'jason', text: 'HALCYON? HALCYON, what is wrong?' },
    { who: 'bolt', text: 'The pollen! It got into HALCYON’s computer core. That is on the Security Deck!' },
    { who: 'jason', text: 'Then that is where we are going. Hang on, HALCYON.' },
  ],
  security: [
    { who: 'halcyon', text: 'Final lift: the Bridge. Jason, the star is VERY close now. I can feel my circuits sweating.' },
    { who: 'jason', text: 'LUX... if GaScu talks in lights, could you talk to it?' },
    { who: 'bolt', text: 'Maybe! If I knew its words. The memory shards are full of its memories...' },
    { who: 'halcyon', text: 'With every memory shard, LUX might learn its language. If not, you will have to stop the Heart the hard way.' },
  ],
  bridge: [],
  plains: [
    { who: 'halcyon', text: 'Shuttle systems online. Next stop: the Glass Desert. Dr. Hypatia’s team was digging there before the radio went quiet.' },
    { who: 'jason', text: 'The scientists we freed said Brennus took the others south. Why would he want a bunch of scientists?' },
    { who: 'bolt', text: 'Maybe he needs someone clever. He does not seem clever. He seems... grumpy.' },
    { who: 'halcyon', text: 'Grumpy AND dangerous. His drills are all over the desert. Please land somewhere soft.' },
  ],
  desert: [
    { who: 'bolt', text: 'Jason, those ruins! The lights on the walls were Celestia’s light-words. Hello, safe, together!' },
    { who: 'jason', text: 'So Celestia’s people were here once? A long, long time ago?' },
    { who: 'halcyon', text: 'That would explain why Celestia dreamed of a warm blue world. It was not a dream. It was a memory.' },
    { who: 'jason', text: 'And now Brennus wants to turn it into a weapon. Not if we can help it. North, to the tundra!' },
  ],
  // LUX was carried off at the end of the tundra: Jason flies on alone, with HALCYON on the radio.
  snow: [
    { who: 'halcyon', text: 'Dr. Galen is safe on board the {ship}. He slept for forty years and woke up very hungry. He has eaten eleven pancakes.' },
    { who: 'jason', text: 'That’s good. ...HALCYON, any sign of LUX?' },
    { who: 'halcyon', text: 'Not yet. But Engineer Ariadne heard something: “Brennus is building something called the COLOSSUS. And he writes everything in his journal. Find the pages, and you will understand him.”' },
    { who: 'jason', text: 'Then I’ll find every page. And I’ll find LUX.' },
  ],
  rockies: [
    { who: 'jason', text: 'The Gorgon crashed up there forty years ago. Brennus has been alone on this planet ever since.' },
    { who: 'jason', text: 'Forty years alone. One day without LUX and I’m already talking to myself.' },
    { who: 'halcyon', text: 'You are talking to me, Jason. That counts. Warning: the jungle ahead is thick with Celestia pollen. Something has gone very wrong down there.' },
    { who: 'jason', text: 'Then we fix it. Hang on, Celestia. Hang on, LUX. I’m coming.' },
  ],
  // IRIS joined in the jungle.
  jungle: [
    { who: 'celestia', text: '...Jason... ...LUX... ...hot... ...trapped... ...please...' },
    { who: 'iris', text: 'That was Celestia, speaking in pink light through the pollen. It is inside the volcano... and so is your friend.' },
    { who: 'halcyon', text: 'Mount Atlantas. Brennus’s fortress. The Colossus will be waiting for you.' },
    { who: 'jason', text: 'So will we. One last climb, IRIS. We’re bringing LUX home.' },
    { who: 'iris', text: 'One last climb. I will light the way.' },
  ],
  volcano: [],
  rocks: [
    { who: 'halcyon', text: 'Course set for the first moon. Its floating islands are called the Harpy Isles.' },
    { who: 'bolt', text: 'Harpies? Like the grabby bird monsters in the old story?' },
    { who: 'captain', text: 'Probably just a name. Probably.' },
    { who: 'halcyon', text: 'Captain, I am picking up a little distress beacon down there. It belongs to one of OUR scout skiffs!' },
    { who: 'captain', text: 'A colony skiff, all the way out here? ...Oh dear. I know exactly who flies off alone like that.' },
    { who: 'jason', text: 'We got through the Clashing Rocks. We can get through anything!' },
  ],
  // The end of the Harpy Isles: General Brennus sets off alone after Aeëtes (his own level comes next).
  harpies: [
    { who: 'halcyon', text: 'Captain, a message is coming in from Gaia Nova. It is... General Brennus?' },
    { who: 'brennus', text: 'Argus. I saw Aeëtes’s gold ships fly over the colony. I know that kind of greed. I used to have it.' },
    { who: 'brennus', text: 'He is digging for the Fleece in a mine on the next moon. I am taking the Gorgon’s old lifeboat, and I am going after him. Alone.' },
    { who: 'captain', text: 'Brennus, wait! ...He switched his radio off. Stubborn as ever.' },
    { who: 'atalanta', text: 'Flying off alone without telling anyone? Who would do something so silly? ...Don’t look at me like that.' },
    { who: 'jason', text: 'Then we keep going, and we listen for his signal. Hang on, General!' },
  ],
  // Brennus's map reaches the Argo: the way to Colchis goes under the Sirens' Sea.
  mine: [
    { who: 'captain', text: 'Argo to everyone: a message is coming in. From... the Gorgon’s old lifeboat?' },
    { who: 'brennus', text: 'Argus. It is Brennus. I am sending you a map: the way into the Fleece vault on Colchis. Aeëtes was hiding it in his desk.' },
    { who: 'hypatia', text: 'You went into Aeëtes’s mine ALONE? Brennus, are you hurt?' },
    { who: 'brennus', text: 'A few dents. My robots and I are flying home. You fly to Colchis. The map says the way goes through the Sirens’ Sea.' },
    { who: 'jason', text: 'Thank you, General. ...Brennus. That was really brave.' },
    { who: 'brennus', text: 'Hmph. Tell Celestia her little sprout says hello.' },
  ],
  // The Dolphin surfaces at a strait of coral and rock: Scylla's Reef, on foot with Atalanta, is next.
  sirens: [
    { who: 'captain', text: 'Dolphin, you are back on the surface! Hold still, the Argo is coming to scoop you up.' },
    { who: 'atalanta', text: 'Jason! You beat a giant singing ORGAN, and I missed it? Next time I am coming in the sub.' },
    { who: 'iris', text: 'Look ahead: a strait between a tall rock and a great whirlpool. The coral there grows like a city.' },
    { who: 'hypatia', text: 'Brennus’s map says that reef is the way to Colchis. But someone has built something very big on that rock...' },
    { who: 'bolt', text: 'Is it another organ? Please say it is not another organ. My singing voice needs a rest.' },
    { who: 'jason', text: 'Then this time we go on foot. Atalanta, ready to run?' },
    { who: 'atalanta', text: 'I was BORN ready.' },
  ],
  // Through the strait at last: next comes Talos's bronze island.
  reef: [
    { who: 'captain', text: 'Argo to the reef: the strait is clear! Scylla’s arms are folded, and Charybdis is just a gentle swirl. We are sailing through.' },
    { who: 'halcyon', text: 'Beyond the strait there is an island of black rock and bronze cliffs. Its volcano is smoking... and something enormous is walking along the beach.' },
    { who: 'atalanta', text: 'Enormous? How enormous?' },
    { who: 'halcyon', text: 'About as tall as a ten-storey building. And it is made of bronze.' },
    { who: 'bolt', text: 'Oh good. A giant. I was worried today would be boring.' },
    { who: 'jason', text: 'The map says the way to Colchis goes right across that island. Let’s go and say hello. Politely.' },
  ],
  // Talos rests; the labyrinth gate leads under Colchis, to Medusa's Labyrinth.
  forge: [
    { who: 'iris', text: 'The labyrinth gate. The Gardeners built a maze under Colchis to keep the Fleece safe.' },
    { who: 'halcyon', text: 'I am detecting a security system down there. One of Aeëtes’s. It calls itself... MEDUSA.' },
    { who: 'bolt', text: 'Medusa? Like the old story? The one who turns people into STONE?' },
    { who: 'atalanta', text: 'Then we don’t look her in the eye. Easy. ...Is it easy?' },
    { who: 'jason', text: 'Talos is resting, the gate is open, and Colchis is right under our feet. Come on, Argonauts!' },
  ],
  // Out of the labyrinth: Aeëtes's gold fleet arrives over Colchis, and Brennus comes to hold the sky-dock.
  labyrinth: [
    { who: 'halcyon', text: 'Argonauts, the labyrinth gate is open! The Argo can fly straight up the old shaft to the Gardeners’ sky-dock.' },
    { who: 'halcyon', text: 'But... I count twenty gold ships coming round the moon. Aeëtes has brought his whole fleet.' },
    { who: 'aeetes', text: 'You switched off my MEDUSA? Then I will close the sky myself. Nobody reaches the garden but ME!' },
    { who: 'brennus', text: 'Argus. Brennus here. My lifeboat is right behind you, and my old robots are with me.' },
    { who: 'brennus', text: 'I will hold the sky-dock. You fly through to the garden. Do not argue, Captain. Just fly.' },
    { who: 'atalanta', text: 'Holding a whole dock against a whole fleet? Okay. I take back everything I said about grumpy generals.' },
  ],
  // The Argo is through Colchis's Sky Gate; next, the Garden of Colchis.
  stand: [
    { who: 'halcyon', text: 'We are through the Sky Gate! Aeëtes’s fleet is turning back. Every single ship.' },
    { who: 'atalanta', text: 'He held off a whole fleet. On his own. With a SHIELD.' },
    { who: 'brennus', text: 'Not on my own. My Legion stood with me. And the sprout. She is very brave, for a plant.' },
    { who: 'jason', text: 'Thank you, General. We’ll find the Fleece. For Celestia.' },
    { who: 'brennus', text: 'Then go, Argonauts. The garden is waiting. I will catch you up: old soldiers are slow, but we always arrive.' },
    { who: 'captain', text: 'Taking her down through the clouds. Everyone, look out of the window... the Garden of Colchis.' },
  ],
  // The dragon sleeps; the way into the Gardeners' tree-temple and the Fleece vault is open.
  garden: [
    { who: 'iris', text: 'Listen. The whole garden is breathing slowly now, in time with the dragon’s snores.' },
    { who: 'bolt', text: 'It’s smiling in its sleep! I made a dragon SMILE. I am putting that on my list of skills.' },
    { who: 'atalanta', text: 'The tree-temple doors are open. The Fleece vault is right inside. Last one in is a slow harpy!' },
    { who: 'captain', text: 'Careful, Argonauts. Aeëtes’s gold ships are circling Colchis. He knows exactly where you are going.' },
    { who: 'jason', text: 'Then we’d better get to the Fleece first. Celestia is waiting for it. Let’s go!' },
  ],
  // The Golden Fleece is the game's finale: it ends with the final endings, not a hop to another level.
  fleece: [],
};

/** Narration for the opening of chapter 2, one caption per shot. */
export const PROLOGUE2 = {
  arrive: 'After months between the stars, the <b>{ship}</b> reached its new home: a green and blue world called <b>Gaia Nova</b>.',
  team: 'Captain Argus sent the science team down first. Their leader, <b>Dr. Hypatia</b>, would find the perfect place to land.',
  quiet: 'Three days later, their radio went quiet...',
  signal: '...and then a message came up from the planet.',
  snatch: 'That night, little black drones swooped onto the {ship}, grabbed Celestia and flew it down to the planet.',
  down: 'So Jason and LUX climbed into the shuttle and flew down to Gaia Nova.',
};

/** General Brennus's broadcast, and what the ship says back. */
export const BROADCAST: Line[] = [
  { who: 'brennus', text: 'Attention, colony ship. This is General Brennus, of the warship Gorgon.' },
  { who: 'brennus', text: 'I reached Gaia Nova forty years before you. This world is MINE. Every tree, every river, every rock.' },
  { who: 'brennus', text: 'Your scientists came poking around my planet. They will be my guests for a while.' },
  { who: 'brennus', text: 'And you have brought back something of mine. That little plant you call GaScu. Its real name is CELESTIA.' },
  { who: 'captain', text: 'Brennus... my first commander. He led the first expedition here, forty years ago. We all thought he was lost.' },
  { who: 'brennus', text: 'Hello, Argus. Turn your ship around and fly away, or meet my THORN LEGION.' },
];

/** After the drones steal Celestia. */
export const STOLEN: Line[] = [
  { who: 'bolt', text: 'GaScu! I mean... Celestia! They took it! Jason, they TOOK it!' },
  { who: 'captain', text: 'Celestia: the name the first expedition gave it. He wants its pollen for his army. Jason, LUX: take the shuttle down. Find the scientists, and bring Celestia back.' },
  { who: 'jason', text: 'We will, Captain. Come on, LUX. Gaia Nova needs us.' },
];

/* ---------------- Chapter 3: The Argonauts ---------------- */

/**
 * Chapter 3, THE ARGONAUTS. After chapter 2, Celestia starts to fade: she is the last of her kind.
 * Dr. Hypatia and LUX read the light-word ruins of Celestia's people, the Gardeners: they left a Golden
 * Fleece, a living golden cloak of seeds that can make any world bloom, on Colchis, a moon of the gas
 * giant next door. Captain Argus rebuilds the shuttle into the Argo, and the crew (the Argonauts) set
 * off. But the salvage tycoon Aeëtes wants the Fleece too, to sell green planets to the highest bidder.
 */
export const PROLOGUE3 = {
  garden: 'Spring came to <b>Gaia Nova</b>. The colonists planted their very first garden, and Celestia bloomed right in the middle of it.',
  fading: 'But one morning, Celestia’s glow began to fade. She was the last of her kind... and she was getting very tired.',
  argo: 'So Captain Argus rebuilt the old shuttle into a brand new ship, and named her the <b>Argo</b>.',
  crew: 'Her crew called themselves the <b style="color:#ffd166">Argonauts</b>.',
  launch: 'One bright morning, the Argo lifted off from the Whispering Plains...',
  moons: '...toward the gas giant next door and its ring of moons. One of them was <b>Colchis</b>.',
  gold: 'But someone else was heading there too.',
  soon: 'The voyage continues soon...',
};

/** The ruins, the Fleece and the plan: said over the storybook picture of the fading Celestia. */
export const FLEECE: Line[] = [
  { who: 'celestia', text: '...tired... ...alone... ...the last one...' },
  { who: 'bolt', text: 'Celestia? Celestia, please wake up! Dr. Hypatia, what do we do?' },
  { who: 'hypatia', text: 'These old ruins are covered in Celestia’s light-words. LUX, can you read them with me?' },
  { who: 'bolt', text: 'They say... GARDENERS. Celestia’s people called themselves the Gardeners!' },
  { who: 'hypatia', text: 'The Gardeners left a gift on Colchis, a moon of the gas giant next door: a living golden cloak of seeds. The GOLDEN FLEECE. It can make any world bloom.' },
  { who: 'jason', text: 'Then it can make Celestia strong again! How do we get there?' },
];

/** Captain Argus and his new ship. */
export const ARGO_BUILT: Line[] = [
  { who: 'captain', text: 'In the old stories, a ship called the Argo carried the bravest heroes in the world on a quest for a Golden Fleece.' },
  { who: 'captain', text: 'Our Argo has a ram’s head on the prow, solar oars and a great solar sail. And our heroes are... a little shorter.' },
  { who: 'jason', text: 'Hey!' },
  { who: 'halcyon', text: 'All systems ready. Crew: Jason, LUX, Dr. Hypatia, Captain Argus, and me. Please keep your hands inside the ship.' },
];

/** Our first look at Aeëtes, on his golden flagship. */
export const AEETES_INTRO: Line[] = [
  { who: 'aeetes', text: 'A golden cloak that makes dead worlds bloom? Ha! Imagine the PRICE of a brand new green planet.' },
  { who: 'aeetes', text: 'I am Aeëtes, and I buy and sell EVERYTHING. Find me that Fleece, my little drones. Before anyone else does.' },
];

/** Name cards for boss entrances. */
export const BOSS_CARD: Record<BossKind, { sub: string; color: string }> = {
  warden: { sub: 'Cryo-bay guard robot · frozen and grumpy', color: '#7fe6ff' },
  queen: { sub: 'Ruler of the gardens · very, very thorny', color: '#c6ff7a' },
  golem: { sub: 'Melted engine parts · too hot to touch', color: '#ffa23a' },
  bloblin: { sub: 'The wobbliest king in space', color: '#ff7fd0' },
  wardog: { sub: 'Chief security robot · controlled by the pollen', color: '#ff3a4c' },
  heart: { sub: 'GaScu itself · steering the ship', color: '#ff6fcf' },
  reborn: { sub: 'Every vine on the ship · its very last stand', color: '#ff2a8a' },
  thresher: { sub: 'Brennus’s giant harvester · it mows down everything', color: '#ffd166' },
  driller: { sub: 'A mining machine as long as a river · and twice as loud', color: '#ff9a3a' },
  boreas: { sub: 'Warden of the prison camp · colder than the tundra', color: '#7fe6ff' },
  stheno: { sub: 'Last gunship of the Gorgon · guards the mountain pass', color: '#ffb347' },
  hydra: { sub: 'The jungle’s sickness · three heads, zero manners', color: '#ff6fcf' },
  colossus: { sub: 'General Brennus’s war machine · with Celestia caged inside', color: '#ff3a4c' },
  rogue: { sub: 'Your best friend · with Brennus’s chip on his back', color: '#ff5a6a' },
  aello: { sub: 'The Harpy Queen · Aeëtes’s biggest, greediest thief', color: '#ffd166' },
  excavator: { sub: 'Brennus’s old digging machine · painted gold, and very cross', color: '#ffc23a' },
  organ: { sub: 'Aeëtes’s singing trap · the loudest thing under the sea', color: '#ff6fb0' },
  scylla: { sub: 'Aeëtes’s six-armed crane robot · she grabs every ship that sails by', color: '#ffb04a' },
  talos: { sub: 'The Gardeners’ bronze guardian · reprogrammed by Aeëtes', color: '#ffb050' },
  medusa: { sub: 'Aeëtes’s security AI · one look turns you to stone', color: '#7dff9a' },
  ram: { sub: 'Aeëtes’s war machine · solid gold, and it butts like a battleship', color: '#ffb43a' },
  dragon: { sub: 'Guardian of the Golden Fleece · it hasn’t slept in a thousand years', color: '#7dffc8' },
  goldenking: { sub: 'Aeëtes in the Golden Fleece · he wants every garden for himself', color: '#ffd166' },
};

/**
 * What each kind of enemy is, and what it's trying to do. GaScu's plan is simple: keep growing
 * toward the Bridge, keep the ship pointed at the star, and keep everyone asleep. Every creature
 * (and every robot the pollen got to) has a job in that plan.
 */
export const INTEL: Record<BadgeKind | 'elite', { name: string; tip: string }> = {
  sporeling: { name: 'Spore Crawler', tip: 'Hunts in packs and tries to surround you. Keep moving!' },
  snapper: { name: 'Maw Plant', tip: 'Hides in the roots and bites up close. Watch its jaws!' },
  buzzer: { name: 'Stinger Wasp', tip: 'Circles you and dives in while you reload.' },
  sentry: { name: 'Warden Bot', tip: 'Shield in front, weak spot behind: hit the glowing pack on its back!' },
  turret: { name: 'Spitter Pod', tip: 'Lobs acid where you are going. Change direction to dodge.' },
  brute: { name: 'Horned Brute', tip: 'Charges in straight lines. Dodge, then hit it while it’s dizzy.' },
  blob: { name: 'Bloblin', tip: 'Splits when popped. Pop the big ones, then the little ones.' },
  trooper: { name: 'Legion Trooper', tip: 'Its red eye glows, then it fires three slow shots. Run sideways!' },
  minebot: { name: 'Roller Mine', tip: 'It beeps and flashes before it pops. Blast it early, or run out of the red circle!' },
  bulwark: { name: 'Shield Bulwark', tip: 'The shield only covers its front. Hit it from behind, or ground-pound to knock the shield down!' },
  mortar: { name: 'Mortar Bot', tip: 'Shells land on the red circles. Step out, then run up close: it can’t aim at its own feet!' },
  harpy: { name: 'Harpy Drone', tip: 'It swoops down and snatches your bolts! Blast it before it flies off, and it drops every one.' },
  piranha: { name: 'Piranha Drone', tip: 'Little gold fish robots that swim in a school and nibble the hull. PING stuns the whole school, then torpedo them!' },
  crab: { name: 'Crab-Drone', tip: 'Its big claws block shots from the front. When it snaps, the claws hang open: blast it then, or from the side!' },
  jelly: { name: 'Jellyfish-Drone', tip: 'Its tentacles glow, then it ZAPS a ring of sparks. Step back until the zap is over, then blast it!' },
  anvil: { name: 'Anvil Drone', tip: 'It drops an anvil on the red circle. Step out, then hit it while it swoops down for its anvil!' },
  coil: { name: 'Cable Snake', tip: 'It rears up and hisses, then LUNGES straight ahead. Step aside, then blast it while it lies tangled!' },
  ramling: { name: 'Ramling', tip: 'It paws the ground, then charges head first! Its gold forehead stops shots. SHIELD it: it bonks its head and gets dizzy.' },
  weeder: { name: 'Weeder Drone', tip: 'Aeëtes’s garden wrecker: when its tank glows, it sprays gold weed-killer on the ground. Step off the gold circle, then blast it!' },
  ringguard: { name: 'Ring Guard', tip: 'It hides behind its gold ring, then throws it like a boomerang. Jump over the ring, and hit the guard while its ring is away!' },
  elite: { name: 'Elite!', tip: 'A gold crown means bigger, tougher and more bolts.' },
};

/** Narration for the ending cinematics. */
export const ENDING_CAPTIONS: Record<EndingKind, string[]> = {
  saved: [
    'With one mighty pull on the wheel, the <b>{ship}</b> swung away from the star.',
    'The vines let go of the ship. The Heart of GaScu curled up into a tiny, sleeping seed.',
    'Weeks later, the pods opened one by one above a green-and-blue world: <b>Gaia Nova</b>.',
    'Ten thousand colonists had a new home. And a brand new hero.',
  ],
  friends: [
    'LUX flashed the words: <b style="color:#5e9bff">hello</b>... <b style="color:#ff6fcf">safe</b>... <b style="color:#ffd166">together</b>. And for the first time, GaScu flashed back.',
    'Its vines turned gold and burst into flowers. After a long, long time in the dark, GaScu was not afraid anymore.',
    'Gently, it turned the {ship} away from the star and back toward the warm blue world it had run from. It was not scared anymore: now it had friends.',
    'Ten thousand colonists woke up in a garden between the stars. And LUX was never scared of the dark again, because now something always glows.',
  ],
  freed: [
    'The Colossus crashed down into the crater, and Mount Atlantas let out one last, tired puff of smoke.',
    'Celestia’s vines slipped free of the machines. All over Gaia Nova, the Thorn Legion switched off and went quiet.',
    'General Brennus was taken up to the {ship} to explain himself to Captain Argus. It was going to be a VERY long talk.',
    'And at last, the colonists stepped out onto <b>Gaia Nova</b>: a brand new home that belonged to everyone.',
  ],
  redeemed: [
    'Brennus read the very first page of his journal, the one he wrote when he was twelve... and lowered his hands.',
    '“I came here to make this world obey me,” he said. “I forgot that the best gardens are the ones you share.”',
    'Together, Brennus, the scientists and Celestia turned the Thorn Legion into the <b>Green Legion</b>: robots that plant forests instead of fighting.',
    'On the colony’s first morning, Celestia bloomed across the whole valley. Gaia Nova was home at last, for everyone.',
  ],
  // Chapter 3, the game's final endings (said over the Argo's journey home and the colony garden).
  fleece: [
    'The Golden King’s armour fell away like autumn leaves, and the Fleece floated down, soft and warm, into Jason’s arms.',
    'The Argo carried it home across the ring of moons, past the Clashing Rocks, all the way back to <b>Gaia Nova</b>.',
    'In the colony’s garden, the Argonauts laid the Golden Fleece over Celestia, like a blanket made of sunshine.',
    'Celestia opened her petals and glowed brighter than ever before. She was strong again, and the whole valley bloomed.',
  ],
  gardeners: [
    'LUX and IRIS spoke the Gardeners’ words in light: <b style="color:#5ec8ff">sky</b>, <b style="color:#7dff9a">grow</b>, <b style="color:#ff6fcf">friend</b>, <b style="color:#ffd166">home</b>... and the Fleece answered.',
    'Every golden seed in the Fleece woke up and began to glow. They had waited a very long time for someone to say hello.',
    'At home on <b>Gaia Nova</b>, the Fleece settled over Celestia, and its seeds drifted down all around her like golden snow.',
    'By spring, a hundred little Celestias were blooming across the valley. She was not the last of her kind anymore. She had a family.',
  ],
};

/** Which chapter an ending belongs to. */
export const endingChapter = (kind: EndingKind): Chapter => (kind === 'saved' || kind === 'friends' ? 1 : kind === 'freed' || kind === 'redeemed' ? 2 : 3);

/** How many Gardener light-stones chapter 3 hides in all (every planned level's), and how many the save has. */
export function lightStones(save: Pick<SaveData, 'shards'>): { n: number; total: number } {
  return { n: inChapter(save.shards, 3), total: plannedFinds(3, chapterTotals(3).shards) };
}

/** With every light-stone, LUX and IRIS know enough Gardener words to wake the Fleece's seeds (the secret ending). */
export function knowsGardenerWords(save: Pick<SaveData, 'shards'>): boolean {
  const { n, total } = lightStones(save);
  return n >= total;
}

/**
 * The soundtrack, with thanks: each recording once, with its composer, where they shared it and its
 * license (titles and names stay untranslated), then a word on the licenses.
 */
function musicCredits(): string {
  const songs = new Set(Object.values(MUSIC_CREDITS).map((c) => `<p class="song">“${c.title}”<span>${c.artist} · ${c.source} · ${c.license}</span></p>`));
  return [
    `<h3>${tr('MUSIC')}</h3>`,
    `<p class="thanks">${tr('A big thank you to the composers who shared their music with the world, so games like this one can have a soundtrack:')}</p>`,
    ...songs,
    `<p class="thanks">${tr('Used under Creative Commons licenses (creativecommons.org). CC0 tracks are in the public domain.')}</p>`,
  ].join('');
}

function colonistNames(save: SaveData, ch: Chapter): string[] {
  const names: string[] = [];
  for (const id of CHAPTER_DECKS[ch]) {
    for (const spec of Object.values(LEVELS[id].legend)) {
      if (spec.type === 'cocoon' && save.colonists.includes(`${id}.${spec.id}`)) names.push(spec.name);
    }
  }
  return names;
}

/**
 * The end credits, rolled once, after the game's final ending (chapter 3; the other chapters end on a card):
 * who made it, everyone from all three chapters, every boss, the things won back on the voyage, the
 * light-stones found, the music, and THE END.
 */
export function creditsHtml(kind: EndingKind, save: SaveData): string {
  const p = (s: string) => `<p>${tr(s)}</p>`;
  const head = (s: string) => `<h3>${tr(s)}</h3>`;
  const won = colonistNames(save, 3);
  const { n, total } = lightStones(save);
  return [
    `<h1>${upper(tr(GAME_NAME))}</h1>`,
    `<h2>${tr('THE ARGONAUTS')}</h2>`,
    head('A GAME BY'),
    `<p class="creator">${CREATOR.name}</p>`,
    head('STARRING'),
    p('Jason, junior engineer'),
    p('LUX, a very brave little drone'),
    p('Atalanta, the fastest runner in the colony'),
    p('IRIS, a droid who speaks in rainbows'),
    p('General Brennus, the colony’s Chief Gardener'),
    head('WITH'),
    p('Captain Argus, who built the Argo'),
    p('HALCYON, the ship computer'),
    p('Dr. Hypatia, chief scientist'),
    p('Aunt Rosa, Security Chief'),
    p('Phineus, the stargazer of the Harpy Isles'),
    p('PANDORA, the travelling shop'),
    kind === 'gardeners' ? p('Celestia, and her hundred little sisters') : p('Celestia, in full bloom'),
    p('the Gardeners, who wrote in light'),
    head('AND'),
    p('Aeëtes, now a tree planter'),
    head('ON THE SHIP'),
    p('Frost Warden · Vine Queen · Magma Golem'),
    p('King Bloblin · CERBERUS · the Heart of GaScu'),
    head('ON GAIA NOVA'),
    p('Thresher · Dune Driller · Boreas · Shadow LUX (not really)'),
    p('Stheno · the Thorn Hydra · the Colossus'),
    head('ON THE VOYAGE'),
    p('the Clashing Rocks · AELLO · the Gold Excavator'),
    p('the Siren Organ · Scylla · Talos'),
    p('Medusa · the Golden Ram · the Sleepless Dragon'),
    p('Aeëtes, the Golden King'),
    head('THINGS YOU WON BACK'),
    ...(won.length ? won.map(p) : [p('Everything found its way home!')]),
    head('GARDENER LIGHT-STONES'),
    `<p>${tr('{n} of {total}', { n, total })}</p>`,
    musicCredits(),
    head('CREATED BY'),
    `<p class="creator">${CREATOR.name}</p>`,
    `<h2>${tr('THE END')}</h2>`,
    `<p class="end">${tr('Thank you for playing!')}</p>`,
  ].join('');
}
