import * as THREE from 'three';

import { audio } from '../core/audio';
import type { Boss } from '../entities/bossBase';
import type { World } from '../game/world';
import { ease, type Director } from './director';

/**
 * The Garden of Colchis: the lullaby. Once the fight has worn it out, LUX and IRIS fly up to the Sleepless
 * Dragon's head and sing it to sleep in light-words (music notes of light stream into it), while it
 * curls up around its tree and closes its eyes (the boss's own `sleepK` rises once it is "defeated").
 * Then the storybook picture of it asleep, the heroes' lines, and a look at the tree-temple's door.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const NOTE_COLORS = ['#7dffc8', '#ff9ad8', '#ffe066', '#9fe8ff'];

export async function dragonLullaby(d: Director, w: World, b: Boss) {
  const c = b.where.clone();
  const lux = w.lux;
  const iris = w.iris;
  const pl = w.player.body;
  // Look at the dragon from the hero's side of the lawn.
  const from = V(pl.x - c.x, 0, pl.z - c.z);
  if (from.lengthSq() < 1) from.set(0, 0, 1);
  from.normalize();
  const side = V(from.z, 0, -from.x);
  const head = () => b.focus;
  const notes = (n: number) => {
    const h = head();
    for (const droid of [lux, iris]) {
      const p = droid.pos;
      const v = h.clone().sub(p).multiplyScalar(0.8);
      for (let i = 0; i < n; i++) {
        const k = 0.6 + Math.random() * 0.6;
        w.particles.emit(p.x, p.y, p.z, { count: 1, color: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)], speed: 0.3, life: 1.3, size: 0.5, gravity: 0, drag: 0, vel: [v.x * k, v.y * k + 0.8, v.z * k] });
      }
    }
  };
  lux.override = lux.pos.clone();
  iris.override = iris.pos.clone();
  try {
    // The droids fly up on either side of its head and start to sing.
    const h0 = head();
    const luxFrom = lux.pos.clone();
    const irisFrom = iris.pos.clone();
    const luxTo = h0.clone().addScaledVector(from, 1.2).addScaledVector(side, 2.8).add(V(0, 2.2, 0));
    const irisTo = h0.clone().addScaledVector(from, 1.2).addScaledVector(side, -2.8).add(V(0, 2.2, 0));
    const camPos = h0.clone().addScaledVector(from, 11).addScaledVector(side, 3).add(V(0, 1.5, 0));
    audio.play('tone2');
    await Promise.all([
      d.cam(camPos, h0.clone().add(V(0, 0.4, 0)), 2, ease.inOut, 46),
      d.tween(
        2,
        (x) => {
          lux.override?.lerpVectors(luxFrom, luxTo, x);
          iris.override?.lerpVectors(irisFrom, irisTo, x);
          if (Math.random() < 0.5) notes(1);
        },
        ease.inOut,
      ),
    ]);
    // The song: notes of light pour into its head as it curls up and its eyes close.
    const tones = ['tone0', 'tone1', 'tone2', 'tone3', 'tone2', 'tone1'] as const;
    let played = 0;
    await Promise.all([
      d.tween(4.2, (x) => {
        notes(1);
        const n = Math.floor(x * tones.length);
        if (n > played && n < tones.length) {
          played = n;
          audio.play(tones[n], 1.2);
        }
        const h = head();
        luxTo.y = h.y + 2.2 + Math.sin(x * 12) * 0.25;
        irisTo.y = h.y + 2.2 + Math.cos(x * 12) * 0.25;
        lux.override?.copy(luxTo);
        iris.override?.copy(irisTo);
      }),
      d.cam(c.clone().addScaledVector(from, 13).addScaledVector(side, -5).add(V(0, 7, 0)), c.clone().add(V(0, 2.5, 0)), 4.2, ease.inOut, 50),
    ]);
    const beats = w.def.stories?.lullaby;
    if (beats?.length) await d.story(beats);
    // Fast asleep, smiling, with little clouds of sleep drifting up.
    // Right in front of its sleeping face (the dragon knows where its face points).
    const h1 = head();
    const face = (b as Boss & { faceSpot?: (dist: number) => THREE.Vector3 }).faceSpot?.(4.6);
    d.cut(face ?? h1.clone().addScaledVector(from, 8.5).addScaledVector(side, 3).add(V(0, 2, 0)), h1.clone().add(V(0, -0.2, 0)), 44);
    await d.say(w.dialogue('bossDown'));
  } finally {
    lux.override = null;
    iris.override = null;
  }
  // The tree-temple's door opens beyond the lawn.
  const exit = w.exit;
  if (exit) {
    const e = exit.spot.clone();
    const dir = V(c.x - e.x, 0, c.z - e.z).normalize();
    await d.cam(e.clone().addScaledVector(dir, 9).add(V(0, 5, 0)), e.clone().add(V(0, 1, 0)), 1.8);
    w.rings.burst(e.x, e.y, e.z, 4, '#7dffc8', 0.8);
    w.flash(e.x, e.y + 1.5, e.z, '#7dffc8', 40, 0.8);
    audio.play('success');
    await d.wait(1.1);
  }
  const back = w.followPose({ pos: V(), look: V(), fov: 50 }, 13);
  await d.cam(back.pos, back.look, 1.1);
}
