# Argonauts of the Galaxy

<img src="assets/images/icon.png" alt="The app icon: LUX, a little white repair drone with a big glowing eye, circled by a golden orbit in deep space" width="112" align="right"/>

**Version 1.0.0** · made by **Kitsu Game Studios** (Kitsos Orfanopoulos, [kitsorfan@protonmail.com](mailto:kitsorfan@protonmail.com) · [www.kitsorfan.com](https://www.kitsorfan.com)) · [release notes](#release-notes)

![The title screen: ARGONAUTS OF THE GALAXY over Jason waving in front of the colony ship Syracusia, overgrown with pink GaScu vines, with LUX flying by](docs/screenshots/title.jpg)

*In Greek: Αργοναύτες του Γαλαξία*

(It used to be called AstroTroubles!, and the Android package id still is the old one so updates install over it.)

A 3D action-adventure platformer for Android, built with three.js inside an Expo / React Native app. Open source under the MIT license, and coming to Google Play.

The colony ship *Syracusia* is carrying ten thousand sleeping colonists when a glowing space vine, the Galactic Cuscuta Echinochloa (**GaScu** for short), grows over every deck and starts steering the ship toward a star. You play **Jason**, a junior engineer who wakes up early. Together with **LUX**, a nervous little repair drone who's scared of the dark, Jason climbs six decks to reach the Bridge. Along the way you rescue colonists, collect memory shards, and find out what GaScu really wants.

In **Chapter 2** the ship reaches its new home, the planet **Gaia Nova** (Γαία Νόβα), only to find General Brennus waiting. Forty years ago he led the planet's first expedition, and when he tried to destroy the heart of all its plants, a great glowing flower the scientists named **Celestia**, they mutinied and launched it into space. Celestia is GaScu: that is why it turned the ship away, it was running from him. In Chapter 2 it goes by its real name. Brennus has captured the science team and stolen Celestia to power his Thorn Legion and the Colossus inside the volcano Mount Atlantas. Jason and LUX cross six outdoor regions to free them both, though not always together: Brennus has his eye on LUX too, and in the jungle Jason meets a new droid, **IRIS**, who speaks in rainbows.

In **Chapter 3: The Argonauts** Celestia starts to fade, and the crew rebuild the shuttle into the **Argo** to fetch the Golden Fleece from Colchis before the salvage tycoon Aeëtes gets there first. Ten levels of Greek myth in space: the Clashing Rocks, the Harpy Isles, the Sirens' Sea in a little submarine, Talos's forge in a bronze mech, Medusa's labyrinth and the Sleepless Dragon. Jason is joined by **Atalanta**, the colony's fastest runner and best archer, and you also get to play **General Brennus**, out to pay his debts.

It's made for players around 9 and up: bright and forgiving, with three chapters, 22 levels and plenty of secrets to hunt for.

| | |
| --- | --- |
| ![Chapter 1: Jason and LUX face the Magma Golem in the Engine Core](docs/screenshots/01-magma-golem.jpg) | ![Chapter 2: BOREAS on the frozen lake of Gaia Nova, with its red slam circle](docs/screenshots/02-boreas.jpg) |
| ![Chapter 3: the Argo flies through the glittering belt to the Clashing Rocks](docs/screenshots/03-argo-flight.jpg) | ![Chapter 3: Atalanta and LUX against MEDUSA in her labyrinth](docs/screenshots/04-medusa.jpg) |
| ![Chapter 3: the submarine Dolphin dives into the Sirens' Sea](docs/screenshots/05-submarine.jpg) | ![Chapter 3: General Brennus, with his shield and cannon, against the Golden Ram](docs/screenshots/06-golden-ram.jpg) |
| ![A graphic-novel story picture: Brennus, Atalanta, Jason and LUX face Aeëtes, the Golden King, in the Golden Fleece](docs/screenshots/07-golden-king-panel.jpg) | ![PANDORA's shop: outfits for Jason and Atalanta](docs/screenshots/08-shop.jpg) |

## Highlights

- **The whole game is one offline HTML page.** The game is TypeScript and three.js, and esbuild bundles it, fonts included, into a single 3.6 MB page. The Expo app shows that page full screen in a WebView and handles what the page can't: saving, haptics, the Android back button and screen orientation.
- **Almost no asset files.** Characters, bosses and levels are built from code, textures are drawn on canvases at runtime, and the sound effects are synthesized with the Web Audio API. The music is the one exception (below).
- **Openly licensed music, played natively.** Thirteen CC0 and CC BY recordings in `assets/music` (credited in `assets/music/CREDITS.md` and the end credits), one per mood: calm and tense ship decks, Gaia Nova's open lands, frost and jungle, the voyage, mystery, epic, and three kinds of boss fight. `game/src/core/music.ts` maps every level and boss to one. In the app the page only names the track; the phone plays it with expo-audio (`src/music.ts`), so the music costs the game's frame nothing. In a browser an `<audio>` element plays it.
- **Levels are ASCII maps, checked by a solver.** A reachability checker simulates Jason's jumps, dashes and hovering on every deck. It reports anything Jason can't reach, checks that each deck really needs its new ability, and times the fastest route through every countdown puzzle to prove it can be beaten with time to spare. The Jest suite runs the same checks.
- **In-engine cutscenes.** A small cutscene director moves the camera through the real level and adds letterbox bars, boss name cards and slow-motion finishes.
- **Storybook pictures.** The big story moments also get hand-drawn cartoon illustrations, written as inline SVG, that slowly pan inside a picture frame while the narration plays.
- **Built for phones.** Each deck frees its GPU memory when you leave it. Shaders compile behind the title cards so play doesn't stutter.
- **Auto graphics.** Graphics are on **Auto** by default (`game/src/core/graphics.ts`). At launch the game sizes the phone up from its graphics chip (Adreno, Mali, PowerVR, Xclipse...), memory, CPU cores and age (the last two from `expo-device`) and picks Low, Medium or High. During play it watches the frame rate: if a deck stays under 40 fps for ten seconds, it drops one step on the spot (sharpness and glow at once, shadows from the next deck) and remembers that for next time. Picking Auto again in Settings starts over; picking Low, Medium or High turns Auto off.
- **Two languages.** English and Greek. The first time the game starts it asks which one you want, and there's a test that fails if any visible string is missing its Greek translation.

## Running it on your phone

You need Node 20+ and the **Expo Go** app (SDK 57) on an Android phone.

```bash
npm install
npm start          # builds the game page, then starts Expo
```

Scan the QR code with Expo Go. The game runs in a WebView (`react-native-webview`, included in Expo Go), so you don't need a custom build. Hold the phone in landscape.

To build an installable APK:

```bash
npx eas-cli@latest build -p android --profile preview
```

EAS runs `npm run game:build` automatically after installing dependencies (`eas-build-post-install`).

### Playing on a computer

```bash
npm run game:build     # writes game/dist/index.html
```

Open `game/dist/index.html` in a browser. Keyboard: **WASD / arrows** move, **Space** jumps, **J** blasts, **K** spins or ground-pounds, **L / Shift** dashes, **I** fires LUX's force pulse, **E** is the action button, **Q / R** turn the camera, **Esc** pauses, and **C** (or **Tab**) switches heroes where you can. `npm run game:dev` rebuilds on every save.

Developer shortcuts (desktop browser only): `#deck=<id>` jumps into a deck (`&still` skips the fly-over, `&all` hands over every ability), `&heroes=jason,atalanta` lets you switch heroes on any deck, `&hero=atalanta` starts as Atalanta, and `&course` swaps the deck for a small practice course with every hero gadget (a sprint gap, a wall-run, a low gap and an arrow target).

## How to play

| Control | What it does |
| --- | --- |
| Left side of the screen | Joystick: move |
| Drag on the right side | Turn the camera |
| **JUMP** | Jump. Hold for higher jumps; with the Jet Boots, press again in mid-air |
| **BLAST** | Tap to shoot (it aims at the nearest enemy). The clip holds 6 shots, then Jason reloads. **Hold** to charge a big fireball that bursts on impact; it costs 3 shots, and if the clip is too low, holding reloads it while the charge builds |
| **SPIN** | Spin attack that also blocks enemy attacks and bats their shots back (lasers and lava still hurt). Jason gets 3 spins in a row, then a long recharge. In mid-air it becomes a **ground pound**, which presses red switches, hurts more and never runs out |
| **SPIN** (held) | With the **Mirror Shield** (found in Medusa's Labyrinth, Chapter 3): hold SPIN on the ground to raise it. Jason walks slowly behind it; it bounces MEDUSA's gaze beams (and enemy shots) from the front, and a bounced beam goes where the shield points, snapping onto a crystal or an eye close by. A quick tap still spins |
| **DASH** | Zoom forward, even in mid-air (after the Engine Core), ramming through enemies for heavy damage. Each dash uses one of 3 energy cells, refilled at checkpoints and by violet energy cells (enemies drop them, and chargers sit before every jump that needs a dash) |
| **PULSE** | LUX's force pulse (after the Security Deck's armory): a shockwave that hits and stuns every enemy around Jason, wipes out their shots and shorts out lasers and zap floors for a few seconds. It takes 16 seconds to recharge |
| **GRAPPLE** | The grapple hook (found in the Glass Desert): look toward a glowing ring and press the LUX button to zip straight over to it, across gaps and up cliffs |
| **Weapon button** | On Gaia Nova, once Jason owns a second weapon: switch weapons (or press **X** on a keyboard) |
| LUX button | Appears near terminals, pylons, signs, the shop, lifts and grapple rings. It wears the face of whoever is helping Jason: LUX, IRIS, or (when Jason is on his own) his wrist computer, the ACTION button |
| **Switch** (a face button above the others) | On levels with two heroes: take control of the hero whose face it shows, wherever they are (the camera swings over), or press **C**. It works on the ground, between moves, with a one-second cooldown. The hero you were playing stays put and follows from there. Hearts, armor, spins and bolts are shared |

#### Playing as Atalanta

Atalanta, the colony's fastest runner and best archer, joins in Chapter 3. Her buttons do different things:

| Control | What it does |
| --- | --- |
| Move | She runs faster than Jason. Keep the stick pushed **all the way** (or hold a direction key) and she breaks into a **sprint** for long jumps; a sharp turn or letting go ends it |
| **JUMP** | One strong jump (higher than Jason's first jump, but no jet boots). Jump while touching a wall to **wall-jump** off it (not off the same wall twice in a row). In mid-air, run at a wall with a glowing **teal stripe** to **wall-run** along it, and jump to kick off |
| **CLIMB** (just push) | Cliffs with teal-and-gold **handholds** (and a glowing lip) can be climbed: push into one, on the ground or in mid-air, and she grabs on. Keep pushing to climb up, pull back to climb down, push sideways to shimmy along the holds, and JUMP to kick off. Her grip lasts a few seconds (it comes back on the ground). At the top she pulls herself over the lip |
| **BOW** (the BLAST button) | Tap for quick arrows that fly far and straight. **Hold** to charge a **power arrow** that goes through up to 4 enemies and is the only thing that sets off a **bullseye target**. No clip, just a short cooldown; Blaster Power makes her arrows stronger |
| **KICK** (the SPIN button) | A spinning kick that blocks enemy shots like Jason's spin (from the same charges), on the ground or once in mid-air |
| **SLIDE** (the DASH button) | A low, fast slide that trips enemies and fits under **low gaps** (the walls with yellow-and-black stripes). Under a low ceiling she crawls until there's room to stand. Jump out of a slide for a long jump. It needs no energy cells |

She has no grapple, no ground pound and none of Jason's weapons: red floor switches and grapple rings need Jason, low gaps, cliffs and bullseyes need her.

#### Travelling together

The heroes travel as a team, and nobody pops over by magic. The hero you aren't playing walks after you, copying only the moves their own hero can make: Atalanta crawls after you through a low gap and climbs after you up a cliff, Jason jumps a gap you jumped. When the way on needs a move they don't have, they stop at it and **wait** (a little "..." bubble over their head), and you can only scout a short way ahead of them (the **tether**: about six cells): far enough to reach a switch, open a door or bring out a bridge, and then they find the way round and catch up. Two moves bring them along:

- **A hand up.** Stand still at the top of a ledge right above a waiting hero and you lend a hand: Atalanta drops a climbing rope, Jason lowers his grapple line, the General reaches down. They climb up beside you.
- **Riding the grapple.** When Jason grapples with someone close behind him, they grab on and zip across with him.

You can also switch to the waiting hero and find them a way yourself. `npm run game:check` checks every level for this: each hero must reach the exit and the boss together with the others, and anything only one hero can reach must be within the tether of where the others can wait.

#### Playing as General Brennus

On his own levels in Chapter 3 (level 3, Aeëtes's Mine, and later level 8) you play General Brennus, alone: he never switches with the others (on the last level, the Golden Fleece, he joins Jason and Atalanta and all three switch). He is old, slow and strong, with a low jump (two steps up at most) and no jet boots, glider or grapple:

| Control | What it does |
| --- | --- |
| **CANNON** (the BLAST button) | A heavy shell on a low arc that splashes everything around where it lands. **Hold** for a **big blast** that smashes **cracked walls** (rock with glowing gold cracks) and knocks robots' shields away. No clip: a short cooldown and a **heat** gauge beside the button. Too many shots in a row and the cannon overheats, and he has to wait for it to cool |
| **SHIELD** (the SPIN button, held) | Raises the Legion's big shield: every shot and bump from the front is blocked (shots bounce back), but he walks slowly behind it. Let go to **bash** forward. In mid-air, the button is a heavy **stomp** that presses red switches |
| **CHARGE** (the DASH button) | A shoulder charge along the ground that smashes crates, crate barricades and cracked walls and knocks robots over. **Jump while charging** for a **charge-leap**, the only way he gets across two-cell gaps. It needs no energy cells |
| **COMMAND** (the action button) | At a Legion **command post**, his old Thorn Legion robots (painted gold by Aeëtes) obey his voice: one marches onto a **heavy plate** that holds a gate open, a **hauler** robot carries him over a gap, or a whole squad switches sides and fights for him |

His signs and hints are in his own voice (there is no droid with him); his wrist computer still hacks terminals. Developer shortcut: `#deck=mine` plays his level, and `&hero=brennus` puts him on any deck.

#### Driving the bronze mech

In Talos's Forge, Jason and Atalanta start on foot, then find the Gardeners' bronze **mech** asleep in the old forge and climb aboard: Jason sits in the glass bubble on top and steers, Atalanta rides on its shoulder, and LUX and IRIS fly alongside. While they ride it, the mech is the only hero (no switching). It is twice Jason's height and **slow** (a heavy walk, slower even than General Brennus), with one strong jump (four steps up) and no double jump, glider or grapple, but it is **far stronger** than anyone on foot: its punches, slam and flames send robots flying, a small robot or drone goes down in one or two punches, and only the mech can fight **TALOS**:

| Control | What it does |
| --- | --- |
| **PUNCH** (the SPIN button) | A one-two of big bronze fists just in front of it: they break **bronze gates**, crates and cracked walls, knock robots flat, and knock **Talos's ankle armour** off |
| **SLAM** (SPIN in mid-air) | Straight down like a ground pound, with a wide shockwave: it presses red switches and smashes **cracked floor plates** (iron plates with glowing cracks), dropping the mech into the cellar or trench below. Any heavy landing from high up does too |
| **THRUST** (the DASH button) | A burst of its back jets, straight ahead, on the ground or once per jump. Gravity pauses while the jets fire, so **jump, then thrust** to cross a wide lava channel |
| **FLAME** (the BLAST button, held) | A big **flamethrower** on its right arm: a long, wide cone of fire, auto-aimed (even at an anvil drone hovering overhead), that sets enemies burning. A tap gives a short puff. The **heat gauge** beside the button fills while it burns; when it is full the flamethrower sputters and has to cool for a moment. Held on Talos's stuck ankle, it heats a plate until it pops off. (The old cannon is gone: one button, one big fire) |
| **GET OUT** / **CLIMB IN** (the action button) | On solid ground with room beside it, Jason and Atalanta **climb out** and play on foot again (switching, their own hearts, every move of theirs). The empty mech waits where they left it, **kneeling**, and the objective marker points back to it. Walk up to it and **climb in** to get everyone back aboard (the boarding scene only plays the first time) |

**Strength instead of hearts.** Aboard, the hearts in the corner are replaced by a big bronze **STRENGTH** bar. A hit that would cost a hero a heart only costs the mech a tenth of its strength (lava a little more), and it never comes back by itself. While the heroes ride, heart pickups turn into **bronze gears** (robots drop them at least one time in five), and each gear mends a quarter of the bar; checkpoints mend it fully. The heroes' own hearts are untouched while they ride. At zero the heroes are knocked out, just as with no hearts left, and start again at the last checkpoint.

Back at a checkpoint (knocked out on foot, "back to last checkpoint", or loading a save), everyone starts again **aboard** the mech, cooled down and at full strength, so it can never be left somewhere out of reach. In Talos's arena, heroes on foot can't hurt him (their hits bounce off with a clang, and LUX says only the mech is strong enough); they just have to climb back in, and the mech always kneels right beside them.

Developer shortcut: `#deck=forge&flags=mech` starts in the mech (`&flags=forgelit` wakes the forge, so walking up to the mech plays the boarding scene).

On level 8, **Brennus's Last Stand** (`#deck=stand`), he **holds lines** while the Argo flies in. A bar at the top of the screen shows the Argo coming. At each line's command post he wakes the Legion's **dock guns** (they shoot at Aeëtes's machines for him); then he stands by the line's beacon while Aeëtes's dropships swoop in (a red ring shows where) and lower robots onto the dock. The Argo only flies at full speed while the line is (nearly) clear, and the bar turns red when it's crowded, so fighting back helps; once the Argo gets through that stretch, the robots left run back to their ships, the beacon turns green and the next gate opens. If he is knocked out, the line starts again when he gets back to it. On the second line a **fight** post turns the gold Legion robots Aeëtes drops back to his side. `&play=outro` on any deck plays its boss-defeated scene (here, the Argo passing through the Sky Gate).

A gold marker on screen points to where the current objective wants you to go, for example the launch tower and King Bloblin's island on the Habitat Ring, or the lift once a deck's boss is beaten.

Jason finds a new ability on each deck, and it's needed to finish that deck:

| Deck | New trick | Boss |
| --- | --- | --- |
| 1. Cryo Deck | Find LUX in the dark storeroom; hacking | Frost Warden |
| 2. Hydroponics | Jet Boots (double jump) | Vine Queen |
| 3. Engine Core | Dash Thrusters | Magma Golem |
| 4. Habitat Ring | Hover Pack (hold JUMP to float) | King Bloblin |
| 5. Security Deck | LUX's Force Pulse (shorts out lasers) | CERBERUS |
| 6. The Bridge | Everything at once | The Heart of GaScu, then GaScu Reborn |

Chapter 2 takes place outdoors on Gaia Nova. Jason keeps every ability, finds the grapple hook, and meets wind gusts, quicksand and rolling boulders:

| Region | New trick | Boss |
| --- | --- | --- |
| 1. Whispering Plains | River rafts, windy ridges | The Thresher (make it crash, then hit its engine) |
| 2. Glass Desert | The grapple hook; quicksand and sandstorms | The Dune Driller (hit its drill head when it surfaces) |
| 3. Frostpeak Tundra | Ice, blizzards and rolling snowballs; the prison camp | BOREAS (block from the front, blast its back) |
| 4. Titan Rockies | Grapple climbs, boulders, cable cars; no droid (wrist hacking, helmet lamp, no PULSE) | STHENO, the Gorgon's gunship (shoot its three engines) |
| 5. Thornwood Jungle | Wake IRIS; shut down the pollen pumps; dark root caves | The Thorn Hydra (heads first, then the heart) |
| 6. Mount Atlantas | Everything at once, inside a volcano | Shadow LUX (blast the chip on his back when he overheats), then the Colossus, General Brennus's war machine |

Chapter 3, **The Argonauts**, is the voyage of the Argo to the moon Colchis, and the game's final chapter:

| Level | New trick | Boss |
| --- | --- | --- |
| 1. The Clashing Rocks | Fly the Argo through an asteroid belt and twenty pairs of slamming rocks, setting your own speed with the **SPEED lever** beside BLAST (drag it up for full speed, down to slow right down or stop; on a keyboard hold **Space** to push it up and **Shift** to pull it down). The Argo never stops by itself: ease off in front of a pair, and go full speed the moment it opens. LUX's dove flies through the first pair once, then you're on your own, with three ROCKETs (the SPIN button, or **K**) to blow up the pairs you'd rather not risk | (Aeëtes's salvage drones) |
| 2. Harpy Isles | Atalanta joins: switch heroes. Bullseyes, wall-jumps, wall-runs and low gaps for her, red switches and grapple rings for Jason; updrafts, gusts and bolt-snatching harpy drones | AELLO, the Harpy Queen (Atalanta's power arrow knocks her down, Jason cracks her core) |
| 3. Aeëtes's Mine | General Brennus alone: cracked rock, charge-leaps, his shield, heavy plates, an ore cart, and turning his old Legion robots back to his side | THE GOLD EXCAVATOR (shield its charges or crash it into a pillar, blast the control box, then COMMAND it to stand down) |
| 4. Sirens' Sea | Dive in the little sub Dolphin: torpedoes, a sonar PING that shows the open doorway in Gardener gates and hidden pearls (and stuns piranha drones), kelp, currents and dark trenches; siren buoys pull you onto the rocks until LUX sings back (tap SING on the beat) | THE SIREN ORGAN (swim through the holes in its sound rings, torpedo the glowing pipe, then out-sing its last song) |
| 5. Scylla's Reef | **Tides**: the sea rises and falls every half minute (a gauge under the objective blinks before it comes in). Sandy paths are dry at low tide and flooded at high tide; rafts float up beside high ledges. Crab-drones and jellyfish-drones | SCYLLA, Aeëtes's six-armed crane robot (Atalanta's power arrows jam her glowing elbows, Jason ground-pounds her base plates), with the whirlpool CHARYBDIS pulling on a rhythm |
| 6. Talos's Forge | Atalanta and Jason open the forge, then everyone climbs into the Gardeners' bronze mech (strength instead of hearts, a flamethrower, and you can get out and back in): punch bronze gates, thrust over lava, SLAM through cracked floors; anvil drones | TALOS, the bronze giant, whom only the mech can fight (punch or burn his ankle armour off when his foot sticks, then pull the plug in his heel, three times) |
| 7. Medusa's Labyrinth | Gaze beams from stone eye-sentries turn a hero to stone for a moment (switch to the other one). Jason finds the **Mirror Shield** and bounces beams onto light crystals; turning Gardener mirrors (shoot, arrow or spin them) guides a gaze across a hall; cable snakes | MEDUSA (bounce her own gaze back into her eye, hit it while she's dazzled; Atalanta's power arrow unties the knot of snakes over it) |
| 8. Brennus's Last Stand | General Brennus alone holds the sky-dock while the Argo comes (a bar shows how close it is): dock guns, lines to hold, ramlings that charge head first (shield them and they get dizzy) | THE GOLDEN RAM (shield its charge, charge it into a pillar, blast its open engine) |
| 9. The Garden of Colchis | Light-word gates (step on a word's colours in order), weeder drones' weed-killer circles, a crystal gate that needs both heroes, grapple stumps, wall-run hedges | THE SLEEPLESS DRAGON (not a fight: light the four lullaby pylons, one hero's skill each, and LUX and IRIS sing it to sleep) |
| 10. The Golden Fleece | All three heroes: General Brennus joins in the root hall with his own little squad. The vault gate has three seals, one for each hero (a bullseye, a red switch only the grapple reaches, a switch behind cracked rock); ring guards that throw their rings like boomerangs | AEËTES, THE GOLDEN KING, in three phases: shoot down his ring-drones; stop his Fleece-armour charges with Brennus's shield; then Atalanta cuts his vines, Brennus cracks his clasp and Jason hits his seed-core. Then the game's final endings |

- **Hacking** a terminal is a puzzle, and the kind changes from deck to deck: the light-pattern memory game (watch LUX's lights, then repeat them), **What comes next?** (find the rule in a row of shapes, arrows or dots), **Power grid** (each tap flips a tile and its neighbours; light them all) and **Colour square** (fill the gaps so no row or column repeats a colour). The puzzles live in `game/src/game/puzzles.ts`.
- **Upgrades show on Jason.** Every shop upgrade adds gear to his suit: chest plate and shoulder pads (gold at the top level), blaster coils and a power cell, a drum magazine and a belt of spare cells, cooling fins and a gauntlet, a LUX link and a second antenna, and a magnet on his backpack. Atalanta's upgrades show on her the same way (see **PANDORA's shop in Chapter 3**).
- **LUX** lights dark rooms and hacks terminals, but in a fight he only stuns enemies now and then. Upgrade his zapper at PANDORA's shop to make it hurt. **IRIS** does all the same jobs (her zap is rainbow-coloured), and while no droid is around, Jason hacks with his wrist computer and his helmet lamp lights the dark, but there is no force pulse and no zap.
- **Bolts** are money. Spend them at PANDORA's shop on extra hearts, blaster power, a bigger clip, quicker reloads, a stronger LUX zap and a bolt magnet.
- **New weapons on Gaia Nova.** Once Jason reaches the planet, PANDORA's shop gets a Weapons tab (see **The arsenal** below). Switch between the weapons you own with the weapon button next to BLAST (or **X**); a little card pops up with the weapon's name and stat bars.
- **Mk II upgrades.** In Chapter 2 the shop also sells a further level of every upgrade (the heart plating can now take Jason up to 12 hearts) and four new ones: **Armor Plating** (blocks a hit, then recharges), **Dash Cell** (an extra dash), **Spin Charge** (an extra spin) and **Grapple Range** (a longer, faster grapple).
- **Chapter 3: Atalanta's gear and outfits.** In Chapter 3 PANDORA's shop gets two more tabs (see **PANDORA's shop in Chapter 3** below): **Atalanta**, her own upgrades (from the Harpy Isles on, once she has joined), and **Outfits**, fancy clothes for both heroes.
- **Checkpoints** heal you. Falling or touching sludge, lava or electric water costs one heart and puts you back on the last safe ground. If you run out of hearts, you restart at the last checkpoint, and every enemy on the deck comes back. They also come back whenever you return to a deck, but rooms you've cleared stay open.
- **The final battle.** Beating the Heart of GaScu isn't the end: it pulls every vine on the ship into itself and rises again as GaScu Reborn, a floating titan that is only hurt while its great eye is open. It has 80 health, plus 16 for each level of Blaster Power, so it stays a long fight.
- **The Colossus**, chapter 2's final boss, is longer still: 110 health plus 20 per Blaster Power level, in three phases (shield generators, swinging arms, overheating core).
- **Journal pages.** On Gaia Nova the collectibles are the 18 pages of General Brennus's journal, telling how a boy who named all 300 of his grandmother's tomato plants became a man who wants to own a whole planet. Like memory shards, every 6 give an extra heart.
- **Gardener light-stones.** In Chapter 3 every level on foot (and the mech's Forge) hides three glowing rainbow stones left by the Gardeners, Celestia's people (24 in the whole chapter). Each one teaches LUX and IRIS another word of Celestia's light-language, and every 6 give an extra heart. Instead of cocoons, Chapter 3 has things to win back: on the Harpy Isles, gold harpy nets stuffed with old Phineus's stolen food (blast them open).
- **The submarine** (Chapter 3, the Sirens' Sea). The little sub Dolphin swims forward by itself: steer with the stick, BLAST fires torpedoes, and the BOOST button becomes **PING**, the sonar (three charges that refill): it lights up hidden pearls for a few seconds, shows which round doorway of a Gardener gate is open (green; swimming into a sealed one is a BONK), and makes a school of **piranha drones** dizzy so you can torpedo them. Kelp slows you down, currents push you sideways (or carry you along fast), and deep stretches go dark. When one of Aeëtes's **siren buoys** sings, its song pulls the sub toward the rocks round it and the button turns into **SING**: notes slide along a strip at the top of the screen, and every tap as a note reaches the ring is one of LUX's counter-song notes (four good ones and the buoy goes quiet), or you can torpedo the buoy, or just steer hard away. Its side quests are gold rings, siren buoys silenced and hidden pearls, each in a single dive.
- **Tides** (Scylla's Reef). Every walkable floor below the high-tide line is a tidal flat: when the sea is deeper than a step over it, a hero standing there is washed back to the last dry spot (one heart, like any fall into water), and flats never count as safe ground. Driftwood rafts sit on the sand at low tide and float on the sea. The cycle (`LevelDef.tide`: low, rising, high, falling) and its rules are in `game/src/world/tides.ts`; the sea, the rafts and the gauge in `game/src/entities/reef/tide.ts`. Developer shortcut: `&time=<seconds>` winds a deck's clock (and so the tide).
- **Harpy drones** (Chapter 3) are Aeëtes's gold thief birds: one circles you, flashes its red eye, then swoops in and snatches a handful of bolts. Blast it (or arrow it) and it drops everything it stole; a spin or kick bats it away.
- **Gaze beams** (Medusa's Labyrinth) never hurt: a hero they touch turns to grey stone for about two seconds, then is safe from them for a moment. Statues and pillars block them. A beam that has bounced (off a Gardener mirror or the Mirror Shield) lights the crystals that open doors; one bounced back into an eye-sentry's own eye shuts it for a few seconds. **Cable snakes** rear up and hiss, then lunge straight ahead: step aside and blast them while they lie tangled.

### PANDORA's shop in Chapter 3

Chapter 3 keeps all of Chapter 2's stock and adds two tabs. Prices sit with the Mk II upgrades: a Chapter 3 level on foot pays a few hundred bolts, so by the end of the chapter you can own most of it, not all. Atalanta's upgrades change her numbers (`game/src/entities/heroes/atalantaStats.ts`; the level checker always plans for an Atalanta without them), and each one shows on her like Jason's gear:

| Atalanta's upgrade | Price per level | What it does | How it shows |
| --- | --- | --- | --- |
| **Hunter's Bow** | 300, 550, 800 | Quick arrows +½ damage and power arrows +1, per level (on top of Blaster Power) | Arrows in her quiver (three, then five), then gold fletching and a gold band |
| **Quick Draw** | 300, 550 | The power arrow charges 20% faster per level; quick arrows and power arrows come back sooner | A leather bracer on her bow arm, then a glowing gem on it |
| **Wind Sandals** | 250, 450 | She breaks into a sprint sooner and sprints faster (+0.8 per level), so her running jumps go further; a little more run speed too | White wings on her boots, then bigger gold ones |
| **Climber's Gloves** | 200, 400 | +1.5 seconds of grip on cliffs per level, and she climbs 12% faster | Leather gloves, then gold cuffs |
| **Iron Kick** | 300, 500 | Her spinning kick hits for +1 per level and reaches 15% wider | Bronze shin guards, then gold ones with a glowing edge |
| **Triple Arrow** | 900 | Every power arrow flies with two more beside it, in a fan | Three gold gems on the bow's grip |

**Outfits** are only for looks. Buy one once and the hero puts it on; after that **WEAR** and **TAKE OFF** are free, one outfit per hero at a time. Tap an outfit's picture to see the hero turning round in it in 3D (the fitting room, with the gear they've bought). An outfit repaints the hero's model and adds a few pieces of its own; upgrade gear stays on top of it, and since cutscenes use the same models, the heroes wear their outfits there too (and Jason on the title screen). Atalanta's outfits are on sale once she has joined. The catalogue is in `game/src/entities/outfits.ts`, the 3D pieces in `game/src/entities/outfitModels.ts`.

| Outfit | Hero | Price | Look |
| --- | --- | --- | --- |
| **Captain's Coat** | Jason | 400 | A navy coat with tails, gold buttons and epaulettes, a gold band round the helmet |
| **Starlight Explorer** | Jason | 500 | A night-blue suit full of twinkling stars, glowing bands, a star badge and a glowing ring round the helmet |
| **Argonaut Bronze** | Jason | 600 | Bronze armour and helmet with a red horsehair crest, leather strips round the waist |
| **Golden Fleece Cape** | Jason | 750 | Royal blue and gold, a woolly golden cape (under the backpack) that flies out as he runs, a fleece collar |
| **Forest Ranger** | Atalanta | 400 | Moss green and leather, a hood, a leaf brooch and a feather |
| **Huntress of Artemis** | Atalanta | 500 | Moon-silver and midnight blue, a crescent moon on her brow, a longer cape with silver stars |
| **Olympic Champion** | Atalanta | 600 | White and gold, a laurel wreath and a gold medal |
| **Gardener's Crystal Dress** | Atalanta | 750 | Glowing Gardener crystal, a crystal skirt and tiara, two floating lights |

Developer shortcuts: `&ata=bow:3,triple:1` sets Atalanta's upgrade levels, `&outfit=bronze,artemis` hands over outfits and puts them on, and `&shop=atalanta` or `&shop=outfits` opens the shop on that tab (`&try=<outfit>` opens the fitting room).

### The arsenal

Every weapon has its own range, power, speed and ammo, and a special trick. The shop shows them as four stat bars (1 to 5). Each weapon keeps its own clip when you switch; tap BLAST to shoot and hold it for a charged shot (it uses a few shots from the clip). Blaster Power raises every weapon's damage, Bigger Clip every clip (and the fuel tank), Quick Reload every fire rate and reload (and the refuelling). The numbers live in `game/src/entities/weapons.ts`.

| Weapon | Price | Range | Power (per hit) | Fire rate | Ammo | Special |
| --- | --- | --- | --- | --- | --- | --- |
| **Blaster** | (yours) | 22 | 1 | a shot every 0.28 s, fast bolts | 6, reload 1.5 s | All-rounder. Hold BLAST for a big fireball |
| **Spread Shot** | 300 | 11 | 0.5 x 5 pellets | every 0.5 s | 10, reload 1.7 s | Five pellets in a fan: up close they all hit. Charged: three fireballs |
| **Frost Ray** | 450 | 16 | 0.5 | every 0.18 s | 12, reload 1.4 s | Every hit slows the enemy; a charged shot freezes everything around it |
| **Thunder Arc** | 600 | 15 | 1.6 | every 0.65 s, very fast bolts | 4, reload 1.9 s | Lightning jumps to 2 more enemies (4 when charged) |
| **Seeker** | 750 | 30 | 1.3 | every 0.55 s, slow orbs | 5, reload 2 s | Homing: turns hard after its target, never misses a moving enemy |
| **Flamethrower** | 950 | 5.5 (cone) | 4.5 a second | continuous while held | fuel tank: 3.5 s of fire, refills in 4 s | Sets enemies **burning** (they flicker orange and lose health for 3 s), melts frost, and burns away **brambles** |

- **Burning and cold.** Fire thaws a frozen enemy, and the Frost Ray puts a fire out. Bosses resist both: they never freeze, a chill only slows them a little, and they burn for about a second.
- **The fuel tank.** The Flamethrower drains its tank while it burns and refills it by itself after a short rest. If it runs dry it sputters out (the gauge blinks red) until the tank is about a third full again.
- **Brambles** (`{ type: 'bramble' }` in a level's legend) are thorny hedges that fill a cell. Only fire gets through: the Flamethrower burns one away in a moment, and a charged fireball (or General Brennus's cannon blast) sets it alight too.
- **Weeder drones** (the Garden of Colchis) are Aeëtes's garden wreckers: gold drones with garden shears and a tank of weed-killer. One hovers a few steps away, its tank glows, and a gold circle spreads where you stand: step off it before the weed-killer splashes.
- **Light-word gates** (the Garden of Colchis): the Gardeners locked their gates with words of light, and the light-stones taught their colours. Step on the colour pads of the right word, in order (HOME is blue then green; FRIEND is the whole rainbow, red to violet). The garden's rescues are seed-sprites, the Gardeners' little helpers, caught in Aeëtes's gold nets.
- **Ring guards** (the Golden Fleece) are Aeëtes's gold butler robots. They hold a big gold ring up in front like a shield (shots from the front ping off), and every few seconds, after a glowing wind-up, they throw it like a boomerang: it skims out at knee height and comes back. Jump the ring, and hit the guard while its ring is away (Brennus's shield bats the ring straight back).
- **Three heroes.** On the Golden Fleece the switch button goes round all three: Jason, Atalanta and, once he joins, General Brennus. The two you aren't playing walk along behind, each where they can (cracked rock is only for Brennus, even Jason's charged fireball just scorches it, and heavy plates only hold under the General).

### Enemies

Each enemy type has a floating icon, and the first time you meet one, a small card under your hearts names it and gives a tip. Once an enemy is hurt (or right next to you) a bold health bar shows over it: a dark outline, a fill that goes from green through yellow to red, a white flash and a pale chunk that drains away after every hit. Far away the badge grows, so it stays readable on a phone; tough enemies and elites also show their health as a number. Bosses get a big bar at the top of the screen, with notches where the fight changes phase.

| Enemy | Its plan |
| --- | --- |
| Spore Crawler | Hunts in packs. When one spots you it calls the others, and they surround you |
| Maw Plant | Hides among the roots and bites when you walk too close |
| Stinger Wasp | Circles you, shoots where you're going, and dives in while you reload |
| Warden Bot | Patrols, and sounds an alarm that wakes the guards nearby. Its front shield blocks shots, but it turns slowly and freezes to vent after each burst: hit the glowing pack on its back for triple damage |
| Spitter Pod | Lobs acid at where you'll be when it lands |
| Horned Brute | Charges; if it misses, it stomps in anger |

On Gaia Nova, General Brennus's Thorn Legion sends its robots too:

| Robot | Its plan |
| --- | --- |
| Legion Trooper | Sidesteps across your path, its red lens glows, then it fires three slow shots: run sideways |
| Roller Mine | Rolls up to you and puffs up over a red circle before it pops. Blast it first and it just fizzles |
| Shield Bulwark | Its tower shield blocks everything from the front. Get behind it and hit its glowing pink core, or drop the shield with a ground pound or LUX's zap |
| Mortar Bot | Lobs shells at a red circle on the ground. Step out of the circle, then get close: it can't aim at its own feet |
| Anvil Drone | One of Aeëtes's gold work drones (Talos's Forge). It hovers high with an iron anvil on a cable and drops it on a red circle; then it swoops down low to hook the anvil back up. Step out of the circle, then punch it while it's low (or roast it with the mech's flamethrower) |

On Scylla's Reef, Aeëtes's reef robots:

| Robot | Its plan |
| --- | --- |
| Crab-Drone | Scuttles sideways around you with its big claws up like a shield (shots from the front ping off). It rears up and shakes its claws, then lunges and snaps; right after, its claws hang open: blast it then, or from the side |
| Jellyfish-Drone | Bobs over the reef (always above the sea, so it rides the tide) and drifts after you. Its tentacles light up, then it zaps a ring of sparks: step back, then pop it |

In Chapter 3, Aeëtes adds gold harpy drones (they snatch bolts) and, on Colchis's sky-dock, **ramlings**: little gold ram robots that paw the ground (a red lane shows where they'll run) and charge head first. Their gold foreheads stop plain shots; hold up General Brennus's shield and they bonk their heads and wobble about, dizzy, taking double damage.

Enemies get tougher deck by deck: more health, faster attacks, sharper senses. They also scale up a little with every weapon upgrade and new weapon you buy. From the Engine Core on, some are **elites** with a gold crown: bigger, tougher and worth more bolts.

### Side quests and rewards

Every deck has four side quests, listed with their rewards in the pause menu. LUX also explains each kind of collectible the first time you get close to one.

- **Free the colonists** trapped in pink GaScu cocoons (blast them open): 25 bolts each, plus a bonus when the whole deck is free.
- **Find the memory shards** (glowing pink crystals): a bolt bonus per deck and an extra heart for every 6. All 18 unlock the secret ending, where LUX *speaks* to GaScu instead of fighting it.
- **Find the hidden heart canister** for one more max heart. They're often behind cracked walls (spin or blast them).
- **Crack the secret vault.** Each deck has one, locked behind a harder puzzle, and the chest inside holds a free upgrade:

| Deck | Vault puzzle | Prize |
| --- | --- | --- |
| Cryo Deck | Step on the colour pads in the order a sign gives | Bigger Clip |
| Hydroponics | Ground-pound three switches within 21 seconds | +1 max heart |
| Engine Core | A four-colour code on islands in the lava, worked out from three clues | Blaster Power |
| Habitat Ring | A colour riddle split between two signs on opposite sides of the Ring | Quick Reload |
| Security Deck | A five-round **What comes next?** hack switches off a laser corridor | LUX Zapper |
| The Bridge | Ground-pound four switches across the navigation room within 28 seconds | 300 bolts |

For the switch puzzles, a clock at the top of the screen counts down from the first switch, with a dot for each one that's down. A cracked vault stays open, even when you replay the deck.

**Replay a level** on the title screen lets you replay any deck or region you've reached.

Progress saves at every checkpoint and when you leave the app.

## The story

A new game opens with a prologue out in space: a glowing seed strikes the *Syracusia*, GaScu spreads over the hull, and the ship turns toward a burning star. Then Jason's cryo pod thaws. What happens next (**spoilers**):

- **Captain's logs.** Captain Argus left hologram messages on every deck as GaScu took over. They tell you what happened, and where to find his drone, LUX. On the Habitat Ring, the message is from Jason's Aunt Rosa instead.
- **Rescuing LUX.** Jason finds the Captain's little drone switched off in a dark storeroom, fixes him, and he tags along.
- **HALCYON is infected.** By the Security Deck, GaScu pollen has scrambled the ship computer, who turns on you and sends CERBERUS. Beating CERBERUS lets LUX reboot HALCYON. HALCYON then reveals that GaScu isn't angry, it's scared: someone on the planet the ship is flying to once tried to hurt it, and it would rather fly into the star than go back.
- **Story characters.** Freeing Aunt Rosa (Security) and the Captain (the Bridge) from their cocoons plays a scene with each of them.

Cutscenes play in the game world with letterbox bars:

- Every deck opens with a fly-over, and every boss makes an entrance with its own name card.
- Boss defeats play in slow motion, and each deck ends with a lift ride.
- Between decks the lift climbs the outside of the ship while the crew talks, and the star looks bigger every time.
- Both endings have their own cinematic, followed by credits that list the colonists you rescued.
- The biggest moments (the seed striking the ship, LUX waking up, the Heart of GaScu, Brennus's broadcast, the expedition forty years ago, LUX carried off, IRIS waking up, LUX coming home...) are shown as storybook pictures between the camera shots.

**Chapter 2: Gaia Nova** (more spoilers):

- **The arrival.** The ship reaches Gaia Nova and sends Dr. Hypatia's science team down first. Their radio goes quiet, General Brennus broadcasts that the planet is his (and that GaScu's real name is Celestia), and his drones steal it. Jason and LUX take the shuttle down.
- **The first expedition.** Dr. Galen, freed in the snow, slept for forty years: he was one of the twelve scientists who came here with Brennus. His story plays as storybook pictures: the planet fighting back, Brennus's order to destroy Celestia, the mutiny, and the escape pod that carried it into space.
- **The journey.** Each region frees two captured scientists (thorn cocoons) and beats one of Brennus's machines. Dr. Hypatia's field logs and Brennus's own recordings play on hologram projectors, and between regions the shuttle flies over the planet while the crew talks.
- **LUX is taken.** The moment BOREAS falls in the tundra, a snare drone drops out of the blizzard, cages LUX and carries him off to the volcano while Brennus gloats on the radio. Jason climbs the Titan Rockies alone, with HALCYON keeping him company on the radio.
- **IRIS.** In the jungle roots Jason switches on IRIS, a slim droid with a rainbow visor, fins and a golden halo. The Gardeners, the people who planted Celestia, built her long ago; Brennus dug her out of the desert ruins, and when she would not fight for him he threw her away. Calm, curious and a little poetic, she takes over LUX's jobs.
- **Shadow LUX.** In Mount Atlantas, Brennus has clamped thorny armour and a control chip onto LUX and sends him against Jason. Blast the chip whenever he overheats; twice, IRIS sings him a rainbow light-word, and when the chip breaks LUX is himself again. LUX and IRIS both fly with Jason up to the Colossus (and in the secret ending LUX still talks to Celestia).
- **Two endings.** Beat the Colossus and Gaia Nova is free. Or, with all 18 journal pages, press **TALK**: Jason reminds Brennus of his grandmother's garden, and he lets Celestia go himself (the secret ending).

**Chapter 3: The Argonauts** (more spoilers):

- **The Golden Fleece.** Celestia starts to fade: she is the last of her kind. Her people, the Gardeners, left a living golden cloak of seeds on Colchis, a moon of the gas giant next door. Captain Argus rebuilds the shuttle into the **Argo**, and the crew set off, with the salvage tycoon **Aeëtes** racing them for the Fleece.
- **The Clashing Rocks.** Jason flies the Argo through the asteroid belt and between twenty pairs of slamming rocks. LUX's dove flies ahead through the first pair (a little late: it loses a tail feather) and flies off for good; after that he reads the rocks himself, easing off the speed lever in front of each pair and going full speed the moment it opens, with three rockets for emergencies.
- **The Harpy Isles.** Floating sky-islands over a sea of clouds. A distress beacon leads Jason to **Atalanta**, the colony's fastest runner and best archer, who flew ahead alone in her scout skiff until Aeëtes's harpy drones stripped it for parts. IRIS is her friend from the greenhouse, and from then on flies with her while LUX stays with Jason: the hero you play has their droid in the lead, and the other droid floats beside the other hero. They meet **Phineus**, a blind old stargazer whose dinner the harpies steal every evening, beat the Harpy Queen AELLO, and learn the way to Colchis. Then a message comes in: General Brennus has gone after Aeëtes on his own.
- **Aeëtes's Mine (level 3, General Brennus alone).** While the Argonauts fight on the Harpy Isles, Brennus flies the Gorgon's old lifeboat to Aeëtes's mining moon, talking to the little pot of Celestia's sprout on his belt: Captain Argus gave him a second chance (whether he was in the brig or in the garden after Chapter 2), and he means to pay his debts. Aeëtes is digging the whole moon into a golden pit with Brennus's own old Legion robots, which he found in the snow and painted gold, and he taunts Brennus on the radio all the way. Brennus blasts through cracked rock, charge-leaps into the mine, marches up a walkway under fire behind his shield, orders a robot onto a heavy plate, rides an ore cart over the pit and turns a whole squad back to his side. The boss is **THE GOLD EXCAVATOR**, his old digging machine "Rumble" with Aeëtes's control box bolted on: block its charges with the shield (or make it crash into a pillar), blast the box, and when it kneels, **COMMAND** it to stand down. In Aeëtes's office he finds the golden map to the Fleece vault on Colchis and sends it to the Argo; next stop, the Sirens' Sea.
- **The Sirens' Sea (level 4, the submarine).** Brennus's map says the way to Colchis runs under the ocean of a water moon, through a sunken Gardener gate, so Jason and LUX dive in the little sub **Dolphin** while the Argo waits on the waves. They swim through kelp forests and a whole sunken Gardener city, PING the sonar to find the one open doorway in each gate, and meet Aeëtes's **siren buoys**, whose song pulls ships onto the rocks. Like Orpheus in the old story, LUX sings back, louder and happier. At the bottom of the dark trench Aeëtes has bolted **THE SIREN ORGAN** onto the great gate: six golden pipes that send rings of sound at the sub, faster as they break, and when the last pipe falls its great horn sings one final song, until LUX out-sings it. The Dolphin rises to the surface at a strait of coral and rock, between a tall rock and a giant whirlpool: Scylla's Reef.
- **Scylla's Reef (level 5).** The Dolphin surfaces at a sunny strait of coral and sandbars on the water moon, where the tide comes in and goes out every half minute. Yesterday SCYLLA, a six-armed crane robot Aeëtes bolted onto the great rock, snatched the crates off the Argo's deck, and her crab-drones dragged them across the reef in gold nets (the Argo's fruit, Atalanta's snacks and all of Captain Argus's jam: win them back). Jason and Atalanta cross the flats at low tide, ride a raft up on the high tide, relight the old lighthouse (Atalanta's power arrow hits its sun-mirror out at sea, Jason grapples to a sea stack and pounds the switch) to open the causeway gate, and cross the causeway, waiting on its rocks when the sea comes in. On the rock, SCYLLA slams and sweeps with her arms while the whirlpool CHARYBDIS pulls everything toward its middle: Atalanta jams two glowing elbows, Scylla overloads, and Jason pounds a base plate; three plates and she folds up like a tired spider. Without her pumps Charybdis calms to a gentle swirl and the Argo sails through, on toward a bronze island where something enormous walks the beach.
- **Talos's Forge (level 6, the bronze mech).** Past Scylla's Reef lies a bronze volcanic island, and walking his rounds on it is **TALOS**, the Gardeners' ancient bronze guardian, reprogrammed by Aeëtes's gold crown to stomp anyone who lands. On foot, Atalanta's power arrow lowers the drawbridge over the lava moat, Jason grapples up to the forge's high door and Atalanta slides under it; a hologram from Dr. Hypatia translates the carvings: the plug in Talos's heel is his off-switch. In the forge sleeps the Gardeners' bronze mech (“strong hands for gentle work”), and everyone climbs aboard: it is slow but mighty, with STRENGTH instead of hearts and a big flamethrower, and the heroes can climb out and back in. The mech punches the bronze gate open, jumps and thrusts over lava channels under **anvil drones**, slams through the cracked casting floor into a trench under the wall, and slams two red switches to open the arena. **TALOS** stomps (the foot sticks in the floor: punch or burn his ankle armour off; on foot nobody can even dent him), swings his forge hammer, and in later rounds Aeëtes sends anvil drones and Talos throws hot rivets; each time his armour is off he kneels, and the mech pulls the plug a little further. After the third pull the golden light drains away like warm honey and he sits down by the sea, free, his eye teal again, and gives the Argonauts a slow, grateful nod. Behind him the labyrinth gate leads under Colchis, where Aeëtes's security system, MEDUSA, is waiting.
- **Medusa's Labyrinth (level 7).** Under the gate of Colchis winds a maze of green stone carved by the Gardeners, full of Aeëtes's own robots turned to statues. It is watched by **MEDUSA**, Aeëtes's security AI: stone eye-sentries whose green gaze turns anyone to stone for a moment. In the Gardeners' shrine Jason finds the **Mirror Shield** (a nod to Perseus), which bounces the gaze; the heroes light crystals with it, turn the old mirrors that once carried sunlight into the maze, win back the Argonauts' stolen picnic from the cable snakes, and open the Hall of Eyes with a crystal for Jason and a bullseye for Atalanta. MEDUSA herself, a giant gold mask with a crown of cable snakes, is beaten with her own gaze: bounced back into her eye, it dazzles her so her eye can be hit, and when she knots her snakes over it, Atalanta's power arrow unties them. She powers down to sleep, the stone robots wake and run, and the old gate opens on the shaft up to Colchis's sky-dock, just as Aeëtes's whole gold fleet arrives and General Brennus promises to hold the dock.
- **Brennus's Last Stand (level 8, General Brennus alone).** Colchis's only way down to the Gardeners' garden is the great arch of an ancient sky-dock floating in the clouds, and Aeëtes's whole gold fleet comes to shut it. Brennus (who told everyone he was flying home: he lied, a little) holds the dock with his old Legion so the Argo can slip through. He smashes a cracked wall across the landing pier, wakes the dock guns and holds the Outer Dock, charges through a crate barricade on the Lantern Terrace and marches up a walkway over the clouds behind his shield, orders one of his robots onto a heavy plate to open the way to Aeëtes's lockbox, and holds the Great Bridge, turning the gold Legion robots Aeëtes drops back to his side. Ramlings, Aeëtes's little gold rams, charge him all the way. The boss is **THE GOLDEN RAM**, Aeëtes's huge golden ram war machine: shield its charge so its horns lock in the shield, **charge** it backwards into one of the stone pillars, then blast its open engine. When it lies down for a nap, the Argo comes in low over the dock and through the arch behind him, and Brennus salutes, dented and proud. Next: the Garden of Colchis.
- **The Garden of Colchis (level 9, Jason and Atalanta).** Thanks to Brennus holding the sky-dock, the Argo lands in the Gardeners' own garden: flowers taller than houses, trees of living crystal, glowing ponds and fountains that speak in light. Aeëtes's weeder drones are spraying it with gold weed-killer. The gates open to light-words, a crystal gate needs Atalanta's arrow and Jason's grapple and ground pound together, and Dr. Hypatia (on the Argo) has read the old carvings: the guardian that never sleeps must not be fought, but sung to. That guardian is **THE SLEEPLESS DRAGON**, a huge serpent of vines and crystal coiled around a crystal tree in front of the Fleece vault, kept awake for a thousand years (and poked all week by Aeëtes's drones). Dodging its tail slams, crystal breath and crystal rain, the heroes light the four lullaby pylons (SKY with Atalanta's power arrow, GROW with Jason's ground pound, HOME up a hedge shelf only her wall-jump reaches, FRIEND on a crystal column only his grapple reaches), and LUX and IRIS sing it to sleep in light-words. It curls up around its tree, smiling, and the tree-temple's door opens on the way to the Golden Fleece. Its light-stones teach SLEEP, SONG and WAKE.
- **The Golden Fleece (level 10, the finale).** Past the sleeping dragon stands the Gardeners' great tree-temple. Jason and Atalanta climb through its roots and find General Brennus, whose lifeboat has crashed through the trunk, pinned down by Aeëtes's guards: he joins the Argonauts with his own squad of green Legion robots, and from then on all three heroes can be switched. The Fleece vault has three seals, one for each of them. Inside, Aeëtes grabs the Fleece and wears it, becoming **AEËTES, THE GOLDEN KING**: first he fights from a gold bubble held up by ring-drones, then in the Fleece's gold armour (Brennus's shield stops his charges), and finally as a giant rooted by gold vines (Atalanta's power arrows cut them, Brennus's charge cracks the crystal clasp on his chest, and Jason blasts the glowing seed-core). He isn't destroyed: the Fleece lets him go and ties him up in its own vines.
- **The final endings.** The Argo carries the Fleece home to Gaia Nova, the Argonauts lay it over Celestia, and she blooms again; Aeëtes ends up planting trees for the colony, and Brennus becomes its Chief Gardener. With **every** Gardener light-stone of the chapter, LUX and IRIS speak to the Fleece in the Gardeners' own words: its seeds wake, and by spring a hundred little Celestias bloom in the valley. She is not the last of her kind anymore (the secret ending). Then the final credits of the whole game, and THE END. (`#cinema=fleece` and `#cinema=gardeners` play them in a desktop browser.)

Tap to hurry a caption along, or press **SKIP** (or the Android back button) to skip a scene.

## Languages

The game is in English and Greek: in Greek it is called **Αργοναύτες του Γαλαξία**, Captain Argus is **Κυβερνήτης Άργος**, the ship is the **Συρακουσία**, Jason is **Ιάσονας** GaScu is **Γάκου** (Γαλαξιακή Κουσκούτα Εχινόχλοη) and Celestia is **Σελέστια**, and the app shows that name on phones set to Greek (`assets/languages/el.json`, for builds made with EAS). The first time the game starts, the boot screen asks *Choose your language · Διάλεξε γλώσσα* (with the phone's own language highlighted) instead of TAP TO START, and keeps asking until a language has been picked; you can switch at any time in **Settings**. The Greek is written as natural Greek for young players rather than word for word. Every string the player sees goes through `tr()` (`game/src/core/i18n.ts`) with its English text as the key, and the Greek table lives in `game/src/i18n/el.ts`. The game and ship names are in `game/src/core/brand.ts`; story text refers to the ship as `{ship}`. `npm run game:i18n` lists anything still missing, and the Jest suite fails if a visible string has no Greek. Fredoka and Orbitron have no Greek letters, so the build fills them in with just the Greek glyphs of M PLUS Rounded 1c and Play.

## Project layout

```text
game/                    the 3D game (TypeScript, three.js), bundled with esbuild
  build.mjs              bundles everything, fonts included, into one offline HTML page
  src/core/              input, audio (synthesized sound effects, the music's track list), save data, app bridge, translations
  src/world/             grid level parser, physics, level mesh builder, sky, particles, decor
  src/entities/          Jason, LUX and IRIS, enemies, bosses, pickups and interactive props
  src/entities/heroes/   the hero table and switching rules, Atalanta (model, moves, arrows), the follower,
                         hero props (arrow targets, wall-run walls, climbing cliffs, low gaps), the jump envelopes and the dev practice course,
                         General Brennus (model, moves, cannon) and his Legion props (cracked walls, heavy
                         plates, command posts, his old robots), and the Gardeners' bronze mech (model, moves, strength)
  src/entities/forge/    Talos's Forge: TALOS, the anvil drones, bronze gates and cracked floor plates
  src/entities/stand/    Brennus's Last Stand: the lines to hold and the Argo's bar, dock guns, Aeëtes's
                         dropships and fleet, the Sky Gate arch, ramlings and THE GOLDEN RAM
  src/cinema/            cutscene director, in-deck cutscenes, the ship exterior and space cinematics
  src/game/              game state machine, world simulation, title scene, story text
  src/levels/            the six decks as ASCII maps plus legends, objectives and dialogue
  src/vehicles/          the vehicle levels: the Argo's flight, and (in sub/) the submarine Dolphin's dive,
                         its siren buoys and THE SIREN ORGAN
  src/i18n/              the Greek translation
  src/trailer/           the game's trailer: the shot list cut to the music's bars, camera moves, title cards
  src/ui/                HUD, touch controls, menus, dialogue and hacking screens
  tools/                 level reachability checker (npm run game:check), translation check (npm run game:i18n),
                         brand art renderer (npm run gen:icons: the app icon, Android icon layers, favicon,
                         Play Store icon and splash image, drawn from src/ui/emblem.ts; needs Chrome or Edge),
                         trailer recorder (npm run trailer)
  tests/                 Jest tests: deck data, reachability of every deck, physics, translations, review prompt
src/app/                 Expo Router screens: the WebView host (plus an iframe version for web)
src/generated/           game page as a string (generated, git-ignored)
assets/                  app icons and splash image, plus the app's name on phones set to Greek (languages/)
docs/                    privacy policy, plus the Google Play listing text, screenshots and store graphics
.claude/                 instructions and settings for Claude Code
```

The files left at the root are the ones each tool looks for there: `package.json`, `app.json` (Expo), `eas.json` (EAS builds), `tsconfig.json` and `eslint.config.js`.

### Levels

Each deck is an ASCII map. `#` is a wall, space is open void, `.` is floor, `1`–`9` are raised floor (half a unit per step), `~` is a hazard (sludge, lava, electric water), `_` is ice and `,` is a grate (a plank bridge outdoors). Gaia Nova regions get their natural look (ground, cliffs, sky, weather) from the region's theme, and can place grapple `anchor`s, `wind` zones, `quicksand` and rolling `boulder` lanes. Levels that list `heroes: ['jason', 'atalanta']` can also place arrow `target`s, `wallrun` walls, `climb` cliffs (on the high cell, with its `h`) and `lowgap` crawl holes, and General Brennus's levels (`heroes: ['brennus']`) `cracked` walls, heavy `plate`s, Legion command `post`s, idle `legionbot`s, and moving platforms dressed as ore carts or haulers (`look: 'cart' | 'hauler'`), plus, for his Last Stand, `hold` lines (with their dropships, drops and stretch of the Argo's way), Legion `dockgun`s woken by `post`s with `order: 'guns'`, and the Sky Gate `arch`. Letters are placed from the deck's `legend`. `npm run game:check` simulates Jason's jump, double-jump, dash and hover ranges on every map. It also models grapple zips to anchors and, on levels with Atalanta, her jumps, sprint long jumps (after a two-cell run-up), wall-jumps, wall-runs, climbs, crawling through low gaps and power-arrow shots at targets, and on Brennus's levels his low jump, his charge-leaps and the cracked walls only he gets through. It also reports what each hero can't reach alone, and checks that the heroes can travel together (hand-ups and grapple rides included, see **Travelling together**). It reports anything you can't reach, checks that each deck's new ability really is needed to finish it, that a checkpoint or energy charger (`=` in a map) sits before every jump that needs a dash, and that every countdown leaves time to spare: the fastest route may use at most half the clock, and even the slowest order of switches at most four fifths. The Jest suite runs the same checks.

## Development

```bash
npm run typecheck     # builds the game page, then runs tsc
npm run lint
npm test
npm run game:check    # per-deck reachability report (add a deck id and --map for a picture)
npm run game:i18n     # English strings still missing a Greek translation
```

### The trailer

The game films its own trailer: about a minute, cut to *Sons of the Storm* (`assets/music/epic.mp3`), with every cut on a bar line. `npm run trailer` builds the game, plays it in a headless Chrome or Edge on a clock of its own (each frame is exactly a sixtieth of a second, however long it took to draw) and writes `trailer/argonauts-trailer.mp4` in full HD with ffmpeg; `-- --lang el` makes the Greek one (`argonauts-trailer-el.mp4`), and `-- --stills` writes three pictures of every shot to `trailer/stills/` instead, which is the quick way to check a change. Opening `game/dist/index.html#trailer` plays it live in a desktop browser. The shots, captions and end card are in `game/src/trailer/shots.ts`; the trailer plays on a save of its own and never touches the player's.

## Releasing on Google Play

```bash
npx eas-cli@latest build -p android --profile production   # an .aab for Play Console
```

For a new version, raise `expo.version` in `app.json` and add its entry at the top of `game/src/game/releaseNotes.ts` (with the Greek), then add it to **Release notes** above.

The Play listing text in English and Greek, the answers for Play Console's forms, the screenshots and the store graphics are in [docs/store/](docs/store/listing.md). The privacy policy the listing links to is [docs/privacy-policy.md](docs/privacy-policy.md).

The first time a player finishes decks 2, 4 and 6, the app asks Google Play to show its review card (`game/src/game/review.ts`, then `expo-store-review` in the app). Following Google's rules, it never shows a button or asks a question first. Google Play decides whether the card actually appears: it limits how often each player sees it, and it never shows in Expo Go or in builds that weren't installed from Play. To see it, install a build from an internal testing track.

## The app icon and splash

The app icon is LUX in deep space, circled by a golden orbit (the Argonauts' voyage); the splash screen and the boot screen show the game's emblem, LUX inside a glowing ring wrapped in GaScu's pink vine. Both are drawn as SVG in `game/src/ui/emblem.ts`, and `npm run gen:icons` renders every PNG from them (`assets/images/` and `docs/store/icon-512.png`) with a headless Chrome or Edge. Android 12 and later crop the splash image to a circle, which is why the emblem is round. The boot screen picks up exactly where the native splash leaves off: the same emblem, the same size, in the middle of the screen, which then glides up as the game's name fades in.

## About, version and release notes

**Settings → About** shows the game's version, who made it (Kitsu Game Studios, with Kitsos Orfanopoulos's name beside it), a **Contact me** button (opens an email to kitsorfan@protonmail.com), **My website** (www.kitsorfan.com, in the phone's browser) and **What's new**, the release notes. The version comes from `expo.version` in `app.json`, stamped into the game page by `game/build.mjs`. The release notes live in `game/src/game/releaseNotes.ts` (their Greek in `game/src/i18n/el.ts`); a test fails if the newest entry doesn't match `app.json`, so a new version needs both.

## Release notes

### 1.0.0 (2026-10-11)

The first release:

- The whole adventure in three chapters and 22 levels: the six decks of the *Syracusia*, six regions of Gaia Nova and the ten-level voyage of the Argonauts.
- Three heroes to play: Jason, Atalanta the archer and General Brennus, plus the Gardeners' bronze mech.
- Fly the Argo through the Clashing Rocks and dive the submarine Dolphin under the Sirens' Sea.
- PANDORA's shop: upgrades, new weapons and outfits for Jason and Atalanta.
- Side quests, secret endings and story pictures drawn like a graphic novel.
- Thirteen openly licensed music tracks.
- Play in English or Greek: the game asks on first launch, and you can switch any time in Settings.
- Auto graphics: the game picks the right quality for your phone and lowers it if play gets slow.

## Credits

Created by **Kitsu Game Studios**, the studio name of Kitsos Orfanopoulos: [kitsorfan@protonmail.com](mailto:kitsorfan@protonmail.com) · [www.kitsorfan.com](https://www.kitsorfan.com).

The music is by the artists credited in [assets/music/CREDITS.md](assets/music/CREDITS.md) (and in the game's end credits).

## License

[MIT](LICENSE): you're free to read, change and reuse the code. The license covers the code; it doesn't give permission to publish another app under the Argonauts of the Galaxy or AstroTroubles! names or logo. The embedded fonts (Fredoka, Orbitron, M PLUS Rounded 1c and Play) are under the SIL Open Font License 1.1.
