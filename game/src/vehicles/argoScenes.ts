import * as THREE from 'three';

import { ease, type Director, type Rig } from '../cinema/director';
import { audio } from '../core/audio';
import { FLYOVER } from '../game/story';
import type { ArgoFlight } from './argo';

/**
 * The flight level's cutscenes: the opening (the Argo sets off into the belt) and the Argo sailing
 * through the gate of the moons at the end. (LUX's dove flies during play, without stopping the Argo.)
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
/** A point framed on the Argo's hull (the flight position is the middle of the whole ship, above the hull). */
const H = (a: ArgoFlight, x: number, y: number, z: number) => V(x, y + a.keel, z);

function chase(a: ArgoFlight): Rig {
  return a.cameraPose({ pos: V(), look: V(), fov: 50 }, 0);
}

/** The opening: a slow swing from the ram's head on the prow round to the chase camera. */
export async function flightIntro(d: Director, a: ArgoFlight) {
  const w = a.world;
  const end = chase(a);
  d.cut(H(a, -5.5, 1.6, -12), H(a, 0, 1.2, 0), 42);
  d.fade('#000000', 1, 0);
  audio.play('dash', 0.6, 0.6);
  const caption = d.caption(FLYOVER[w.def.id], 6);
  await Promise.all([
    d.fade('#000000', 0, 1.2),
    d.fly(
      [
        { pos: H(a, -8, 4, -3), look: H(a, 0, 1.4, -1) },
        { pos: H(a, 4, 5, 7), look: H(a, 0, 1, -4) },
        { pos: end.pos, look: end.look },
      ],
      6.5,
    ),
  ]);
  await caption;
  d.rig.fov = end.fov;
  await d.say(w.dialogue('intro'));
}

/** The end: the Argo sails through the gate of the moons, and the moons of the gas giant fill the sky. */
export async function flightOutro(d: Director, a: ArgoFlight) {
  const w = a.world;
  const off = a.offset;
  off.set(0, 0, 46);
  d.cut(H(a, 20, 5, -14), H(a, 0, 0, 18), 52);
  audio.play('dash', 0.9);
  await Promise.all([
    d.tween(5, (k) => off.set(0, Math.sin(k * Math.PI) * 1.5, 46 - k * 120), ease.inOut),
    d.cam(H(a, 10, 7, -30), H(a, 0, 1, -80), 5, ease.inOut),
  ]);
  const g = a.giantPosition();
  await d.cam(V(0, 6, -60), g, 3, ease.inOut, 46);
  await d.say(w.dialogue('finish'));
  await d.fade('#000000', 1, 1);
  off.set(0, 0, 0);
}
