/**
 * The camera moves the trailer is shot with.
 *
 * Each one is a function from how far through the shot we are, 0 to 1, to where the lens stands and
 * what it looks at. They are arithmetic and nothing else, so a shot plays the same at any frame rate and
 * a test can hold one still at any point of it.
 *
 * Every move is still going at the cut. A camera that eases to a stop and sits there before the next
 * shot reads as the end of a sequence, which is what the last shot is for and none of the others.
 */

export type Vec3 = [number, number, number];

/** Where the lens is, what it is pointed at, and how wide it sees. */
export interface Pose {
  position: Vec3;
  target: Vec3;
  fov: number;
}

/** Whatever the camera keeps in shot (a hero, a boss, the Argo), and the way it faces. */
export interface Subject {
  x: number;
  y: number;
  z: number;
  facing: number;
}

/** A camera move: the pose `t` of the way through the shot. */
export type Move = (t: number, subject: Subject) => Pose;

/** The game's own lens. */
export const FOV = 45;

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export const mix3 = (a: Vec3, b: Vec3, t: number): Vec3 => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

/** A value that may sweep across the shot: one number, or where it starts and ends. */
export type Sweep = number | [number, number];

export const sweep = (value: Sweep, t: number) => (typeof value === 'number' ? value : mix(value[0], value[1], t));

/**
 * Mostly linear, with the corners taken off. A full ease-in-out sits still at both ends of the shot,
 * and the cut lands on a camera that has stopped; this one is moving at both ends and only slower there.
 */
export function drift(t: number, softness = 0.4) {
  const x = clamp01(t);
  return mix(x, x * x * (3 - 2 * x), softness);
}

/** A straight move from one pose to another: a dolly, a crane, a push in. */
export function glide(o: { from: { position: Vec3; target: Vec3 }; to: { position: Vec3; target: Vec3 }; fov?: Sweep; softness?: number }): Move {
  return (t) => {
    const k = drift(t, o.softness);
    return {
      position: mix3(o.from.position, o.to.position, k),
      target: mix3(o.from.target, o.to.target, k),
      fov: sweep(o.fov ?? FOV, k),
    };
  };
}

/**
 * Round a point, looking at it. Radius and height can sweep as it goes, which turns the circle into a
 * spiral. Angles put the lens due +z of the point at 0 and turn it towards +x.
 */
export function orbit(o: {
  center: Vec3;
  radius: Sweep;
  height: Sweep;
  from: number;
  to: number;
  /** Raised or lowered aim, in world units off the centre. */
  aim?: Sweep;
  fov?: Sweep;
  softness?: number;
}): Move {
  return (t) => {
    const k = drift(t, o.softness ?? 0.2);
    const angle = mix(o.from, o.to, k);
    const r = sweep(o.radius, k);
    const [cx, cy, cz] = o.center;
    return {
      position: [cx + Math.sin(angle) * r, cy + sweep(o.height, k), cz + Math.cos(angle) * r],
      target: [cx, cy + sweep(o.aim ?? 0, k), cz],
      fov: sweep(o.fov ?? FOV, k),
    };
  };
}

/**
 * Keeps the subject in frame from a set distance as it moves: a tracking shot. The angle is the
 * camera's bearing from the subject, in the same convention as `orbit`, taken from the world unless
 * `relative` hangs it off the subject's facing instead.
 */
export function follow(o: {
  distance: Sweep;
  height: Sweep;
  angle: Sweep;
  relative?: boolean;
  /** How far above the subject's feet the lens is aimed. */
  aim?: Sweep;
  /** How far ahead of it, along its facing, it is aimed. */
  lead?: number;
  fov?: Sweep;
}): Move {
  return (t, s) => {
    const k = clamp01(t);
    const bearing = sweep(o.angle, k) + (o.relative ? s.facing : 0);
    const d = sweep(o.distance, k);
    const lead = o.lead ?? 0;
    return {
      position: [s.x + Math.sin(bearing) * d, s.y + sweep(o.height, k), s.z + Math.cos(bearing) * d],
      target: [s.x + Math.sin(s.facing) * lead, s.y + sweep(o.aim ?? 1.4, k), s.z + Math.cos(s.facing) * lead],
      fov: sweep(o.fov ?? FOV, k),
    };
  };
}

/** A lens that moves on its own line and turns to keep the subject in the middle of it: a pan on a dolly. */
export function watch(o: { from: Vec3; to?: Vec3; aim?: Sweep; fov?: Sweep; softness?: number }): Move {
  return (t, s) => {
    const k = drift(t, o.softness);
    return {
      position: o.to ? mix3(o.from, o.to, k) : o.from,
      target: [s.x, s.y + sweep(o.aim ?? 1.4, k), s.z],
      fov: sweep(o.fov ?? FOV, k),
    };
  };
}
