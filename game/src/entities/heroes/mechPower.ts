/**
 * The bronze mech's STRENGTH (Talos's Forge), its stand-in for hearts while the heroes ride it. Pure
 * numbers (no three.js), so the tests can drive it:
 *
 * - A hit drains a slice of strength (a hero would lose a whole heart); lava drains a bigger slice.
 * - Like hearts, it never comes back by itself: a checkpoint mends the mech fully, and a bronze gear (a
 *   heart pickup, while the heroes ride it) mends a slice.
 * - At 0 the heroes are knocked out, just as with no hearts left, and start again at the last checkpoint.
 */
import { MECH } from '../../core/constants';

export interface MechPower {
  /** 0..MECH.strength. */
  strength: number;
}

export const freshPower = (): MechPower => ({ strength: MECH.strength });

/** What one hit costs: `n` hearts' worth of an enemy attack, or a touch of lava. */
export function hitCost(n: number, hazard: boolean): number {
  return hazard ? MECH.hazardCost : Math.max(1, n) * MECH.hitCost;
}

/** A hit: strength drains (never below 0). */
export function drain(s: MechPower, n: number, hazard = false): MechPower {
  return { strength: Math.max(0, s.strength - hitCost(n, hazard)) };
}

/** A bronze gear: mends a slice of strength (never above full). */
export function mend(s: MechPower, n = MECH.gearMend): MechPower {
  return { strength: Math.min(MECH.strength, s.strength + n) };
}

/** Out of strength: the heroes are knocked out. */
export const spent = (s: MechPower) => s.strength <= 0;
