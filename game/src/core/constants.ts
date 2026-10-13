/** World units per grid cell. */
export const CELL = 2;
/** Height of one floor step ('1' in a map = 0.5 units). */
export const STEP_H = 0.5;
/** How high a wall is drawn above the tallest neighbouring floor. */
export const WALL_H = 3.2;
/** Floors are drawn as columns reaching down to this depth. */
export const FLOOR_BOTTOM = -6;
/** Anything that falls below this is lost in the void. */
export const DEATH_Y = -12;

export const GRAVITY = 32;
export const MAX_FALL = 28;
/** Highest ledge you can walk onto without jumping. */
export const STEP_UP = 0.6;

export const PLAYER = {
  radius: 0.42,
  height: 1.7,
  speed: 7,
  accel: 38,
  airAccel: 22,
  iceAccel: 7,
  jumpV: 11.5,
  doubleJumpV: 10.5,
  jumpCut: 0.45,
  coyote: 0.12,
  jumpBuffer: 0.14,
  dashSpeed: 17,
  dashTime: 0.2,
  dashCooldown: 0.55,
  /** Dashes run on energy: one cell per dash, refilled at checkpoints and by energy pickups. */
  dashEnergy: 3,
  /** Ramming an enemy with a dash hits this hard (plus Blaster Power). */
  dashDamage: 3,
  dashHitRadius: 1.25,
  poundSpeed: 26,
  glideFall: 2.2,
  bounceV: 19,
  ventV: 17,
  invuln: 1.4,
  knockback: 9,
  shootCooldown: 0.3,
  /** A tap that lands during the cooldown is remembered this long, so quick tapping never drops shots. */
  shootBuffer: 0.25,
  /** Seconds BLAST must be held before it starts charging a fireball. */
  chargeDelay: 0.22,
  /** Shots per clip, reload time, and the charged fireball (hold BLAST). */
  clip: 6,
  reloadTime: 1.5,
  chargeTime: 0.8,
  fireballCost: 3,
  fireballSpeed: 17,
  shotSpeed: 24,
  shotRange: 22,
  spinTime: 0.4,
  spinRadius: 2.1,
  /**
   * Spins in a row before the long recharge. A spin also guards Jason: enemy attacks bounce off it
   * (hazards like lasers and lava still hurt).
   */
  spinCharges: 3,
  /** Seconds to recharge every spin once they are all used up (a partly used set recharges in proportion). */
  spinReload: 7,
  /** Seconds without spinning before a partly used set starts recharging. */
  spinTopUp: 3.5,
  aimRange: 12,
  magnetRange: 3.2,
};

/**
 * Atalanta, the scout (chapter 3): quicker on her feet than Jason, a higher single jump, wall-jumps
 * and wall-runs, a slide under low gaps, and a bow with long, straight arrows instead of a blaster.
 */
export const ATALANTA = {
  speed: 8,
  /** Top speed once she breaks into a sprint: full stick (or a held direction key) for `sprintBuild` seconds. */
  sprintSpeed: 11.5,
  sprintBuild: 0.35,
  /** Stick push that counts as "full" (0..1), and how sharp a turn (radians) breaks the sprint. */
  sprintStick: 0.9,
  sprintTurn: 1.2,
  /** One strong jump (no jet boots): apex about 2.6 units, against Jason's 2.1 for a single jump. */
  jumpV: 13,
  /** Kick off a wall: straight up this fast, and away from it at `wallKick`. */
  wallJumpV: 11.5,
  wallKick: 7,
  /** Wall-run on marked walls: at least this fast along the wall, for at most `wallRunTime` seconds. */
  wallRunTime: 1.1,
  wallRunLift: 3.5,
  /** Gravity is scaled by this while she runs along a wall. */
  wallRunGravity: 0.25,
  /** CLIMB marked cliffs: speed up and sideways, seconds of grip before her arms tire, and the pull-up at the top. */
  climbSpeed: 3.6,
  climbSide: 2.2,
  climbGrip: 4.5,
  climbMantle: 0.4,
  /** Slide (her DASH button): speed, length in seconds, cooldown, and her height while low. */
  slideSpeed: 14,
  slideTime: 0.45,
  slideCooldown: 0.45,
  crouchHeight: 0.8,
  /** Crawl speed while a low ceiling keeps her down after the slide. */
  crawlSpeed: 3.2,
  /** A slide trips enemies: this much damage (plus Blaster Power) and a stagger. */
  slideDamage: 1,
  slideHitRadius: 1.1,
  /** BOW: quick arrows (tap) and the power arrow (hold). No clip: just a short cooldown. */
  arrowCooldown: 0.38,
  arrowSpeed: 34,
  /** World units a quick arrow flies (Jason's blaster shots fly 22). */
  arrowRange: 32,
  /** Auto-aim reach for the bow, in world units. */
  aimRange: 18,
  chargeDelay: 0.2,
  chargeTime: 0.7,
  powerSpeed: 42,
  powerRange: 44,
  /** Enemies a power arrow can pass through before it stops. */
  pierce: 4,
  powerDamage: 3,
};

/**
 * General Brennus (chapter 3, his own levels): old, slow and strong. A low jump (no jet boots, no
 * grapple), an arm CANNON with an overheat meter instead of a clip, a big SHIELD, a shoulder CHARGE
 * that smashes, a heavy STOMP in the air, and COMMAND for his old Legion robots.
 */
export const BRENNUS = {
  speed: 5.6,
  /** Walking behind the raised shield. */
  shieldSpeed: 2.4,
  height: 1.9,
  /** One low jump: apex about 1.7 units (Jason's single jump reaches 2.1). */
  jumpV: 10.5,
  /** CHARGE (the DASH button): a shoulder charge along the ground; jump out of it for a charge-leap. */
  chargeSpeed: 13,
  chargeTime: 0.42,
  chargeCooldown: 0.9,
  chargeDamage: 3,
  chargeRadius: 1.35,
  /** How fast a charge-leap carries on through the air. */
  leapSpeed: 10,
  /** CANNON (the BLAST button): heavy shells, no clip, a short cooldown and an overheat meter. */
  shellCooldown: 0.5,
  shellSpeed: 21,
  shellGravity: 6,
  shellDamage: 2,
  /** Each shell splashes the targets around where it lands. */
  shellSplash: 1.6,
  /** Hold to charge the BIG BLAST: it smashes cracked walls and knocks robots' shields away. */
  chargeDelay: 0.25,
  blastCharge: 0.9,
  blastSpeed: 17,
  blastDamage: 5,
  blastRadius: 3.2,
  /** Heat added by a shell and by a big blast, cooling per second, and the cool-down after overheating. */
  heatShell: 0.2,
  heatBlast: 0.45,
  cool: 0.32,
  overheat: 2.2,
  aimRange: 14,
  /** SHIELD (the SPIN button, held): blocks everything from the front (within this cosine of straight ahead). */
  shieldArc: 0.3,
  /** Letting go of the shield bashes forward. */
  bashSpeed: 10,
  bashTime: 0.22,
  bashDamage: 2,
  /** STOMP (SPIN in the air): the heavy landing presses red switches like Jason's ground pound. */
  stompSpeed: 24,
} as const;

/**
 * The Gardeners' bronze mech suit (Talos's Forge): Jason pilots it, Atalanta rides on its shoulder. Big,
 * heavy and slow, but far stronger than anyone on foot: one strong hydraulic jump, a forward THRUST (its
 * jets) for gaps, a PUNCH that breaks bronze gates and flattens robots, a SLAM that breaks cracked
 * floors, and a big FLAMETHROWER. Aboard there are no hearts: hits wear its STRENGTH down instead.
 */
export const MECH = {
  /** A heavy walk: clearly slower than Jason (7) and even General Brennus (5.6). */
  speed: 4.8,
  /** A wider, taller body than Jason's: corridors in the forge are at least one cell wide. */
  radius: 0.75,
  height: 3,
  /** One strong jump: apex about 2.4 units (four floor steps, with a little to spare). */
  jumpV: 12.4,
  /**
   * THRUST (the DASH button): a burst of its back jets, on the ground or once per jump; gravity pauses
   * while it lasts. Strong enough that a jump and a THRUST still clear a wide lava channel at the slow walk.
   */
  thrustSpeed: 18,
  thrustTime: 0.32,
  thrustCooldown: 0.7,
  /**
   * PUNCH (the SPIN button on the ground): a one-two of bronze fists, each a heavy `smash` just in front.
   * Its damage (like the SLAM's and the flames') is multiplied by how tough the level's enemies are, so a
   * small robot or drone always goes down in one or two punches.
   */
  punchTime: 0.3,
  punchCooldown: 0.12,
  punchDamage: 5,
  punchRadius: 1.6,
  punchReach: 1.5,
  /** SLAM (SPIN in the air): straight down, like a ground pound; it smashes cracked floors. */
  slamSpeed: 26,
  slamDamage: 5,
  slamRadius: 3.6,
  /** A landing at least this fast (falling) counts as a heavy landing: it also cracks brittle floors. */
  heavyLanding: 17,
  /**
   * FLAMETHROWER (BLAST, held): a big cone of fire from the right arm, longer and wider than Jason's, that
   * reaches up to drones overhead. Damage per second (times the enemies' toughness), seconds between damage
   * ticks, how far auto-aim looks, seconds of fire in a full tank, and seconds to refill an empty one.
   */
  flameRange: 7.5,
  flameCone: 0.6,
  flameReachY: 4.5,
  flameDps: 4,
  flameTick: 0.2,
  flameAim: 9,
  flameFuel: 4,
  flameRefill: 3,
  /**
   * STRENGTH, instead of hearts: a hit that costs a hero a heart costs the mech only `hitCost` (lava costs
   * `hazardCost`). It never comes back by itself: a checkpoint mends it fully, and a bronze gear (what a
   * heart pickup becomes while the heroes ride it) mends `gearMend`. At 0 the heroes are knocked out.
   */
  strength: 100,
  gearMend: 25,
  /** Aboard, an enemy that can drop a heart drops a gear at least this often. */
  gearChance: 0.2,
  hitCost: 10,
  hazardCost: 15,
  invuln: 0.7,
  /** How close a hero must stand to the parked mech to climb back in. */
  boardRange: 3.4,
} as const;

/** Switching heroes: a short cooldown, and how the hero you're not playing follows along. */
export const HERO_SWITCH = {
  cooldown: 1,
  /** How far behind the leader the follower walks (world units), and how fast it may go. */
  followDist: 2.6,
  followSpeed: 10,
  /** While a follower waits at something it can't get past, the leader can only go this far from it. */
  tether: 13,
  /** A waiting follower gets a hand-up (a rope, a hand) from a leader standing this close above it. */
  helpReach: 5,
  helpMinRise: 1.1,
  helpMaxRise: 11,
  /** Seconds to lower the rope, and how fast the follower climbs it. */
  helpDrop: 0.45,
  helpClimb: 4.5,
  /** A follower this close when Jason fires the grapple grabs on and zips along with him. */
  tandem: 4,
};

export const START_HEARTS = 5;
/** Most hearts Jason can have: heart canisters, shards and the shop stop here... */
export const MAX_HEARTS = 10;
/** ...until Heart Plating Mk II (sold on Gaia Nova) raises the limit by one per level, up to this. */
export const MAX_HEARTS_MK2 = 12;

/** Upgrades sold on Gaia Nova: Armor Plating, Dash Cell, Spin Charge and Grapple Range. */
export const GEAR = {
  /** Seconds out of trouble (not hurt) before a spent armor point comes back on its own. */
  armorRecharge: 20,
  /** Extra grapple reach per Grapple Range level, in cells, and how much quicker the zip gets. */
  grappleCells: 2,
  grappleZip: 0.8,
};

/** LUX's force pulse: a shockwave that hits everything around Jason and overloads lasers, then recharges slowly. */
export const PULSE = {
  /** Enemies this close are hit, stunned and thrown back; enemy shots this close are wiped out. */
  radius: 8,
  /** Plus 2 for every LUX Zapper upgrade. */
  damage: 4,
  stun: 2.4,
  cooldown: 16,
  /** Laser emitters and zap floors this close short out for `overloadTime` seconds. */
  overloadRadius: 12,
  overloadTime: 6,
};

/** The grapple hook (found in the Glass Desert): zips Jason to a glowing anchor ring. */
export const GRAPPLE = {
  /** Farthest anchor Jason can reach, in cells (straight line). */
  range: 8,
  /** How much higher (or lower) than Jason an anchor may be, in world units. */
  rise: 7,
  /** Seconds for the zip: a base plus a little per unit of distance. */
  time: 0.32,
  timePerUnit: 0.022,
};

/** Wind, quicksand and rolling boulders on Gaia Nova. */
export const OUTDOOR = {
  /** Default push of a gust, in units per second (Jason runs at 7). */
  wind: 5,
  /** Seconds a gust blows, and how long it warns before it starts. */
  gust: 1.6,
  gustWarn: 0.7,
  /** How fast Jason wades through quicksand, and how long he can stand still in it before he sinks. */
  sandSpeed: 0.45,
  sinkTime: 2.6,
  /** Rolling boulders: speed (units per second) and how close they must be to knock Jason over. */
  boulderSpeed: 7,
  boulderRadius: 1.15,
};

/**
 * Medusa's Labyrinth (chapter 3): MEDUSA's gaze beams, and the Gardeners' Mirror Shield that bounces
 * them. A gaze never hurts: it turns the hero it touches to stone for a moment.
 */
export const GAZE = {
  /** Seconds a hero stays stone, then how long they are safe from the next gaze (time to step out). */
  stone: 2.2,
  safe: 1.6,
  /** How far a beam travels in all (world units), counting every bounce, and its tracing step. */
  range: 80,
  step: 0.25,
  /** A gaze beam's height above the eye-sentry's floor. */
  eye: 1.3,
  /** Seconds of beam a light crystal needs before it lights up. */
  catchTime: 0.45,
  /** Seconds an eye-sentry stays shut after its own gaze is bounced back into it. */
  dazzle: 5,
  /** A bounced beam snaps onto a crystal, eye or mirror within this angle (radians) of where it was going. */
  snap: 0.6,
};

/** The Mirror Shield: hold SPIN (on the ground) this long to raise it; Jason walks slowly behind it. */
export const MIRROR = {
  hold: 0.18,
  speed: 2.8,
  /** How quickly he turns behind it (so it's easy to aim the bounce). */
  turn: 6,
  /** A beam bounces when it hits the shield's front: within this cosine of straight on. */
  arc: 0.12,
};
