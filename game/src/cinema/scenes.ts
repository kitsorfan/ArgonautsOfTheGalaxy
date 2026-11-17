import * as THREE from 'three';

import { audio } from '../core/audio';
import { haptic } from '../core/bridge';
import { CELL } from '../core/constants';
import { tr } from '../core/i18n';
import type { Boss } from '../entities/bosses';
import type { BoltFind, Exit, Holo } from '../entities/props';
import type { World } from '../game/world';
import { BOSS_CARD, FLYOVER, READY_TO_TALK, lightStones } from '../game/story';
import { inChapter, isFinale } from '../levels';
import type { Line } from '../world/levelTypes';
import { ease, type Director, type Rig } from './director';
import { talosOutro } from './forgeScenes';
import { dragonLullaby } from './gardenScenes';
import { luxTaken, rogueIntro } from './luxScenes';
import { straitClear } from './reefScenes';
import { argoThrough } from './standScenes';

export { irisFound, luxReunion, luxTaken } from './luxScenes';
export { heroJoins } from './islesScenes';

/**
 * Cutscenes that play inside a deck. Each script poses the camera through the director's rig,
 * animates the world, and always tidies up (even when skipped) so play resumes cleanly.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

function jason(w: World) {
  const b = w.player.body;
  return V(b.x, b.y, b.z);
}

/** Flat unit vector from a to b. */
function toward(a: THREE.Vector3, b: THREE.Vector3) {
  const v = V(b.x - a.x, 0, b.z - a.z);
  return v.lengthSq() < 1e-6 ? V(0, 0, 1) : v.normalize();
}

function face(w: World, at: THREE.Vector3) {
  const p = w.player.body;
  w.player.facing = Math.atan2(at.x - p.x, at.z - p.z);
}

function follow(w: World, dist = 13): Rig {
  return w.followPose({ pos: V(), look: V(), fov: 50 }, dist);
}

function after<T>(d: Director, seconds: number, fn: () => Promise<T> | T) {
  return (async () => {
    await d.wait(seconds);
    return fn();
  })();
}

/* ---------------- Cryo: Jason wakes up ---------------- */

export async function wakeUp(d: Director, w: World) {
  const p = jason(w);
  const fwd = V(Math.sin(w.player.facing), 0, Math.cos(w.player.facing));
  const side = V(fwd.z, 0, -fwd.x);
  let crouch = 1;
  let look = 0;
  w.player.pose = (m) => {
    m.body.position.y = -0.38 * crouch;
    m.body.rotation.x = 0.4 * crouch;
    m.head.rotation.x = 0.25 * crouch;
    m.head.rotation.y = look;
    m.armL.rotation.set(-1.1 * crouch, 0, -0.4 * crouch);
    m.armR.rotation.set(-1.1 * crouch, 0, 0.4 * crouch);
    m.legL.rotation.x = -0.9 * crouch;
    m.legR.rotation.x = -0.9 * crouch;
  };
  try {
    d.cut(p.clone().addScaledVector(fwd, 4.6).addScaledVector(side, 1.8).add(V(0, 0.8, 0)), p.clone().add(V(0, 0.8, 0)), 44);
    d.fade('#ffffff', 1, 0);
    audio.play('vent');
    await Promise.all([
      d.fade('#ffffff', 0, 2.6),
      d.tween(2.6, () => {
        // Cold mist curling up around the pod, not over Jason.
        const a = Math.random() * Math.PI * 2;
        if (Math.random() < 0.35) w.particles.emit(p.x + Math.cos(a) * 1.6, p.y + 0.1, p.z + Math.sin(a) * 1.6, { count: 1, color: '#9fb8c8', speed: 0.6, up: 1.6, life: 1.2, size: 0.8, gravity: -0.3, drag: 1 });
      }),
      d.cam(p.clone().addScaledVector(fwd, 3.4).addScaledVector(side, 1).add(V(0, 0.9, 0)), p.clone().add(V(0, 0.8, 0)), 2.6, ease.out),
    ]);
    await d.say(w.dialogue('wake'));
    audio.play('land');
    await d.tween(1, (k) => (crouch = 1 - k), ease.out);
    await d.tween(0.55, (k) => (look = 0.8 * k));
    await d.tween(0.9, (k) => (look = 0.8 - 1.6 * k));
    await d.tween(0.45, (k) => (look = -0.8 + 0.8 * k));
    const f = follow(w);
    await d.cam(f.pos, f.look, 1.6);
    await d.say(w.dialogue('intro'));
  } finally {
    w.player.pose = null;
    d.fade('#ffffff', 0, 0.3);
  }
}

/* ---------------- every deck: fly over it once ---------------- */

export async function flyover(d: Director, w: World) {
  // A level can open with a storybook scene first (General Brennus on his way to Aeëtes's Mine).
  const opening = w.def.stories?.opening;
  if (opening?.length) await d.story(opening);
  const lv = w.level;
  const boss = lv.entities.find((e) => e.spec.type === 'boss');
  const k = jason(w);
  const target = boss ? V(boss.cx * CELL + CELL / 2, boss.h, boss.cz * CELL + CELL / 2) : k.clone();
  const dir = toward(target, k);
  const side = V(dir.z, 0, -dir.x);
  const mid = target.clone().lerp(k, 0.55);
  d.cut(target.clone().addScaledVector(dir, -10).add(V(0, 24, 0)), target.clone().add(V(0, 2, 0)), 55);
  if (w.def.id === 'security') d.glitch(1.4);
  const text = FLYOVER[w.def.id];
  const caption = text ? d.caption(text, 6) : Promise.resolve();
  const end = follow(w);
  await d.fly(
    [
      { pos: target.clone().addScaledVector(side, 8).add(V(0, 16, 0)), look: target.clone().lerp(mid, 0.4) },
      { pos: mid.clone().addScaledVector(side, -6).add(V(0, 20, 0)), look: mid.clone().lerp(k, 0.6) },
      { pos: end.pos, look: end.look },
    ],
    7.5,
  );
  await caption;
  d.rig.fov = end.fov;
  await d.say(w.dialogue('intro'));
}

/* ---------------- a hologram log ---------------- */

export async function holoLog(d: Director, w: World, holo: Holo) {
  const s = holo.spot.clone();
  const k = jason(w);
  face(w, s);
  const dir = toward(k, s);
  const side = V(dir.z, 0, -dir.x);
  const mid = k.clone().lerp(s, 0.5);
  try {
    // Over Jason's shoulder at first, then close on the hologram's face while it talks.
    await d.cam(mid.clone().addScaledVector(side, 4.5).addScaledVector(dir, -1.5).add(V(0, 2.4, 0)), mid.clone().add(V(0, 1.4, 0)), 1.1, ease.inOut, 44);
    audio.play('zap', 0.6);
    audio.play('blip', 0.5);
    // The beam comes on, then the figure is built up from its feet.
    await d.tween(1.9, (x) => holo.show(x), ease.linear);
    const headY = s.y + holo.headHeight;
    const close = s.clone().addScaledVector(dir, -1.35).addScaledVector(side, 0.4);
    close.y = headY + 0.05;
    void d.cam(close, V(s.x, headY - 0.07, s.z), 1.6, ease.inOut, 32);
    // The figure talks with its hands while it has the line, and listens while anyone else talks.
    await d.say(w.dialogue(holo.log), (line) => (holo.talking = line.who === holo.who));
    holo.talking = false;
    await d.tween(1.2, (x) => holo.show(1 - x), ease.inOut);
  } finally {
    holo.talking = false;
    holo.show(0);
  }
}

/* ---------------- Cryo: finding LUX ---------------- */

export async function boltFound(d: Director, w: World, find: BoltFind) {
  const s = find.spot.clone();
  const k = jason(w);
  face(w, s);
  const dir = toward(s, k);
  const side = V(dir.z, 0, -dir.x);
  const bolt = find.model;
  let kneel = 0;
  w.player.pose = (m) => {
    m.body.position.y = -0.3 * kneel;
    m.body.rotation.x = 0.45 * kneel;
    m.armR.rotation.x = -1.3 * kneel;
    m.head.rotation.x = 0.35 * kneel;
  };
  find.waking = true;
  try {
    await Promise.all([
      d.cam(s.clone().addScaledVector(dir, 1).addScaledVector(side, 2.8).add(V(0, 1, 0)), s.clone().add(V(0, 0.45, 0)), 1.2, ease.inOut, 40),
      d.tween(0.8, (x) => (kneel = x)),
    ]);
    // Jason fiddles with a loose wire: sparks, then LUX's eye flickers to life.
    await d.tween(
      1.6,
      (x) => {
        if (Math.random() < 0.35) w.particles.emit(s.x, s.y + 0.5, s.z, { count: 4, color: '#ffd166', speed: 3, life: 0.3, size: 0.3 });
        bolt.iris.emissiveIntensity = Math.random() < x ? 2.2 : 0.2;
      },
      ease.linear,
    );
    audio.play('zap', 1.4);
    bolt.iris.emissiveIntensity = 2.4;
    bolt.glow.visible = true;
    haptic('light');
    await d.say(w.dialogue('bolt'));
    // Up he pops, spinning with joy.
    audio.play('djump');
    const y0 = bolt.root.position.y;
    await Promise.all([
      d.tween(
        1.2,
        (x) => {
          bolt.root.position.y = y0 + x * 1.5;
          bolt.root.rotation.z = 0.9 * (1 - x);
          bolt.root.rotation.y = x * Math.PI * 4;
        },
        ease.out,
      ),
      d.tween(0.8, (x) => (kneel = 1 - x)),
      d.cam(k.clone().lerp(s, 0.5).addScaledVector(side, 5).add(V(0, 2.4, 0)), s.clone().add(V(0, 1.4, 0)), 1.2, ease.inOut, 44),
    ]);
    // A lap of honour around Jason.
    const c = jason(w);
    const r0 = V(bolt.root.position.x - c.x, 0, bolt.root.position.z - c.z);
    const a0 = Math.atan2(r0.x, r0.z);
    audio.play('dash');
    await d.tween(
      1.8,
      (x) => {
        const a = a0 + x * Math.PI * 2;
        const r = 1.6 + Math.sin(x * Math.PI) * 0.6;
        bolt.root.position.set(c.x + Math.sin(a) * r, c.y + 1.9 + Math.sin(x * Math.PI * 4) * 0.3, c.z + Math.cos(a) * r);
        bolt.root.rotation.y = a + Math.PI / 2;
        w.particles.emit(bolt.root.position.x, bolt.root.position.y, bolt.root.position.z, { count: 1, color: '#7fe6ff', speed: 0.3, life: 0.5, size: 0.4, gravity: 0 });
        face(w, bolt.root.position);
      },
      ease.inOut,
    );
    await d.panel('ch1-lux', { lines: w.dialogue('boltJoin') });
  } finally {
    w.player.pose = null;
    const at = bolt.root.position.clone();
    w.joinBolt();
    w.bolt.place(at.x, at.y, at.z);
    find.remove();
  }
}

/* ---------------- bosses ---------------- */

function bossLines(w: World, b: Boss): Line[] {
  const lines = [...w.dialogue('boss')];
  if (b.kind === 'heart') {
    const n = inChapter(w.save.shards, 1);
    lines.push(
      n >= 18
        ? READY_TO_TALK.heart
        : { who: 'bolt', text: tr('If only we had all 18 memory shards... (we have {n}) then I could try to TALK to it.', { n }) },
    );
  }
  if (b.kind === 'colossus') {
    const n = inChapter(w.save.shards, 2);
    lines.push(
      n >= 18
        ? READY_TO_TALK.colossus
        : { who: 'bolt', text: tr('If only we had all 18 journal pages... (we have {n}) then maybe we could reach the man inside that machine.', { n }) },
    );
  }
  if (b.kind === 'goldenking') {
    // The game's last fight: with every Gardener light-stone, LUX and IRIS could speak to the Fleece itself.
    const { n, total } = lightStones(w.save);
    lines.push(
      n >= total
        ? READY_TO_TALK.goldenking
        : { who: 'bolt', text: tr('If only we had every Gardener light-stone... (we have {n} of {total}) then IRIS and I could talk to the Fleece in its own words.', { n, total }) },
    );
  }
  return lines;
}

export async function bossIntro(d: Director, w: World, b: Boss) {
  // Brennus's reprogrammed LUX gets an entrance of his own.
  if (b.kind === 'rogue') return rogueIntro(d, w, b);
  const c = b.where.clone();
  const f = b.focus.clone();
  const k = jason(w);
  face(w, c);
  const u = toward(c, k);
  const side = V(u.z, 0, -u.x);
  const card = BOSS_CARD[b.kind];
  const reach = 4 + b.size * 2.3;
  // LUX tucks in beside Jason so he doesn't block the view.
  w.bolt.override = k.clone().addScaledVector(side, -1.3).add(V(0, 1.9, 0));
  try {
    // Over Jason's shoulder, the boss looms ahead...
    await d.cam(k.clone().addScaledVector(u, 6.5).addScaledVector(side, 2.6).add(V(0, 4.2, 0)), f.clone().lerp(k, 0.15), 1.2, ease.inOut, 48);
    await d.wait(0.4);
    // ...then a low hero shot as it roars.
    await d.cam(c.clone().addScaledVector(u, reach).addScaledVector(side, reach * 0.3).add(V(0, 1.4, 0)), f.clone().add(V(0, 0.3, 0)), 1.3, ease.inOut, 44);
  audio.play('roar');
  w.shake(0.8);
  w.flash(f.x, f.y, f.z, card.color, 70, 0.7);
  w.rings.burst(c.x, c.y, c.z, 7, card.color, 0.7);
  w.particles.emit(f.x, f.y, f.z, { count: 50, color: card.color, speed: 9, life: 1, size: 0.7 });
    haptic('heavy');
    await d.title(b.title, card.sub, card.color);
    // The two chapter finales get a storybook picture of the villain in all its glory.
    const art = b.kind === 'heart' ? 'ch1-heart' : b.kind === 'colossus' ? 'ch2-colossus' : null;
    if (art) await d.panel(art, { lines: bossLines(w, b) });
    else await d.say(bossLines(w, b));
    const fight = follow(w, 17);
    await d.cam(fight.pos, fight.look, 1, ease.inOut, fight.fov);
  } finally {
    w.bolt.override = null;
  }
}

export async function bossOutro(d: Director, w: World, b: Boss) {
  // Talos isn't blown up: he sits down, free, and nods.
  if (b.kind === 'talos') return talosOutro(d, w, b);
  // The Sleepless Dragon isn't beaten: LUX and IRIS sing it to sleep.
  if (b.kind === 'dragon') return dragonLullaby(d, w, b);
  const c = b.where.clone();
  const f = b.focus.clone();
  const color = BOSS_CARD[b.kind].color;
  const radius = 6 + b.size * 2.4;
  const off = V(d.rig.pos.x - c.x, 0, d.rig.pos.z - c.z);
  const a0 = Math.atan2(off.x, off.z);
  d.timeScale = 0.3;
  const blasts = (async () => {
    for (let i = 0; i < 7; i++) {
      await d.wait(0.38);
      const q = f.clone().add(V((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 3));
      w.particles.emit(q.x, q.y, q.z, { count: 26, color: i % 2 ? '#ffffff' : color, speed: 8, life: 0.8, size: 0.8 });
      w.flash(q.x, q.y, q.z, i % 2 ? '#ffffff' : color, 60, 0.3);
      w.shake(0.4);
      if (i < 4) audio.play('explode');
    }
  })();
  await Promise.all([
    d.tween(
      3.2,
      (x) => {
        const a = a0 + x * 1.7;
        d.rig.pos.set(c.x + Math.sin(a) * radius, c.y + 2 + b.size - x * 0.8, c.z + Math.cos(a) * radius);
        d.rig.look.copy(f).add(V(0, -0.6 * x, 0));
      },
      ease.inOut,
    ),
    blasts,
  ]);
  d.timeScale = 1;
  if (w.def.id === 'security') {
    // LUX plugs into HALCYON's core and scrubs the pollen out.
    d.glitch(1.6);
    audio.play('zap', 0.5);
    await d.wait(1.2);
  }
  await d.say(w.dialogue('bossDown'));
  // Scylla's Reef: the whirlpool calms, and the Argo sails through the strait.
  if (w.def.id === 'reef') await straitClear(d, w);
  // On Colchis's sky-dock, the Argo slips through the arch behind General Brennus.
  if (w.def.id === 'stand') await argoThrough(d, w);
  // In the tundra, Brennus has one more trick: a snare drone for LUX.
  if (w.def.id === 'snow') {
    await luxTaken(d, w);
    w.hooks.checkpoint();
  }
  if (isFinale(w.def.id)) {
    await d.fade('#ffffff', 1, 1.4);
    return;
  }
  const exit = w.exit;
  if (exit) {
    const e = exit.spot.clone();
    const dir = toward(e, jason(w));
    await d.cam(e.clone().addScaledVector(dir, 8).add(V(0, 5, 0)), e.clone().add(V(0, 1, 0)), 1.6);
    w.rings.burst(e.x, e.y, e.z, 4, '#3dff8a', 0.8);
    w.flash(e.x, e.y + 1.5, e.z, '#3dff8a', 40, 0.8);
    audio.play('success');
    await d.wait(1.1);
  }
  const back = follow(w);
  await d.cam(back.pos, back.look, 1.1);
}

/** The Heart falls... and GaScu pulls every vine on the ship into it and rises again. */
export async function rebirth(d: Director, w: World, heart: Boss) {
  const c = heart.where.clone();
  const k = jason(w);
  face(w, c);
  const u = toward(c, k);
  const side = V(u.z, 0, -u.x);
  const color = BOSS_CARD.reborn.color;
  d.timeScale = 0.35;
  // Victory... for a moment.
  await d.cam(c.clone().addScaledVector(u, 11).addScaledVector(side, 3).add(V(0, 5, 0)), c.clone().add(V(0, 2.5, 0)), 1.6);
  d.timeScale = 1;
  await d.say(w.dialogue('fallen'));
  // Then the whole deck starts to shake, and every vine rushes back to the Heart.
  audio.play('roar', 0.7);
  d.glitch(0.8);
  await d.tween(
    2.6,
    (x) => {
      w.shake(0.25 + x * 0.5);
      for (let i = 0; i < 3; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 5 + Math.random() * 10;
        const from = V(c.x + Math.cos(a) * r, c.y + 0.3, c.z + Math.sin(a) * r);
        w.particles.emit(from.x, from.y, from.z, { count: 1, color: Math.random() < 0.5 ? '#ff2a8a' : '#ff4fd8', speed: 0.2, up: 0, life: 0.8, size: 0.8, gravity: 0 });
        w.beams.zap(from, c.clone().add(V(0, 1.5, 0)), color);
      }
      if (Math.random() < 0.2) w.flash(c.x, c.y + 1, c.z, color, 40 + x * 60, 0.2);
    },
    ease.in,
  );
  // It rises: bigger, angrier, with one great eye.
  const reborn = w.spawnBoss('reborn', heart);
  const titan = reborn as Boss & Partial<{ rise: number; glare: number }>;
  titan.rise = 0;
  audio.play('explode');
  audio.play('roar');
  w.flash(c.x, c.y + 3, c.z, color, 120, 1);
  w.rings.burst(c.x, c.y, c.z, 12, color, 0.9);
  w.particles.emit(c.x, c.y + 2, c.z, { count: 90, color, speed: 12, life: 1.2, size: 1.1, up: 4 });
  haptic('heavy');
  await Promise.all([
    d.tween(2.4, (x) => (titan.rise = x), ease.out),
    d.cam(c.clone().addScaledVector(u, 9).addScaledVector(side, 2).add(V(0, 1.2, 0)), c.clone().add(V(0, 4.4, 0)), 2.4, ease.inOut, 46),
  ]);
  titan.rise = 1;
  // Its great eye snaps open.
  audio.play('roar', 0.8);
  await d.tween(0.5, (x) => (titan.glare = x), ease.out);
  w.shake(0.9);
  await d.title(reborn.title, BOSS_CARD.reborn.sub, color);
  await d.say(w.dialogue('reborn'));
  titan.glare = 0;
  const fight = follow(w, 17);
  await d.cam(fight.pos, fight.look, 1.1, ease.inOut, fight.fov);
}

/** The secret ending: LUX speaks to the Heart of GaScu in lights, and it answers. */
export async function befriend(d: Director, w: World) {
  const b = w.boss;
  if (!b) return;
  const c = b.where.clone();
  const f = b.focus.clone();
  const k = jason(w);
  face(w, c);
  const u = toward(c, k);
  const side = V(u.z, 0, -u.x);
  const heart = b as Boss & Partial<{ befriend(k: number): void }>;
  const beacon = k.clone().lerp(c, 0.45).add(V(0, 2.6, 0));
  w.bolt.override = beacon;
  try {
    await d.cam(k.clone().addScaledVector(u, 5).addScaledVector(side, 3).add(V(0, 3, 0)), f.clone().lerp(beacon, 0.35), 1.4);
    const words: [string, string][] = [
      ['#5e9bff', 'tone0'],
      ['#ff6fcf', 'tone1'],
      ['#ffd166', 'tone2'],
    ];
    for (const [color, tone] of words) {
      audio.play(tone as 'tone0');
      w.flash(beacon.x, beacon.y, beacon.z, color, 55, 0.6);
      w.beams.zap(beacon, f, color);
      w.particles.emit(beacon.x, beacon.y, beacon.z, { count: 20, color, speed: 4, life: 0.8, size: 0.6, gravity: 0 });
      await d.wait(0.85);
    }
    // The Heart flashes back, and turns gold.
    audio.play('upgrade');
    await d.tween(
      2.2,
      (x) => {
        heart.befriend?.(x);
        if (Math.random() < 0.5) w.particles.emit(f.x + (Math.random() - 0.5) * 6, f.y + (Math.random() - 0.5) * 3, f.z + (Math.random() - 0.5) * 6, { count: 2, color: '#ffd166', speed: 1.5, up: 1, life: 1.4, size: 0.7, gravity: -0.4 });
      },
      ease.inOut,
    );
    w.flash(f.x, f.y, f.z, '#ffd166', 90, 1.2);
    await d.say(w.dialogue('friends'));
    await Promise.all([d.cam(c.clone().addScaledVector(u, 14).add(V(0, 9, 0)), f, 2.4), after(d, 1, () => d.fade('#ffffff', 1, 1.4))]);
  } finally {
    w.bolt.override = null;
  }
}

/** A storybook scene in the middle of a deck: illustrated panels with lines, then back to play. */
export async function storyTime(d: Director, w: World, key: string) {
  const beats = w.def.stories?.[key] ?? [];
  await d.story(beats);
  const back = follow(w);
  d.cut(back.pos, back.look, back.fov);
}

/** The secret ending of chapter 2: Jason talks General Brennus down, and he steps out of the Colossus. */
export async function talkDown(d: Director, w: World) {
  const b = w.boss;
  if (!b) return;
  const c = b.where.clone();
  const f = b.focus.clone();
  const k = jason(w);
  face(w, c);
  const u = toward(c, k);
  const side = V(u.z, 0, -u.x);
  const giant = b as Boss & Partial<{ surrender(k: number): void }>;
  await d.cam(k.clone().addScaledVector(u, 5).addScaledVector(side, 3.5).add(V(0, 2.4, 0)), f.clone().lerp(k, 0.3), 1.4);
  // While Jason talks, the picture of a boy in his grandmother's greenhouse.
  await d.panel('ch2-grandma', { lines: w.dialogue('redeem') });
  // The machine powers down, piece by piece, and Celestia's glow turns gold.
  audio.play('upgrade');
  await d.tween(
    2.4,
    (x) => {
      giant.surrender?.(x);
      if (Math.random() < 0.5) w.particles.emit(f.x + (Math.random() - 0.5) * 6, f.y + (Math.random() - 0.5) * 3, f.z + (Math.random() - 0.5) * 6, { count: 2, color: '#ffd166', speed: 1.5, up: 1, life: 1.4, size: 0.7, gravity: -0.4 });
    },
    ease.inOut,
  );
  w.flash(f.x, f.y, f.z, '#ffd166', 90, 1.2);
  await d.say(w.dialogue('redeemed'));
  await Promise.all([d.cam(c.clone().addScaledVector(u, 15).add(V(0, 9, 0)), f, 2.4), after(d, 1, () => d.fade('#ffffff', 1, 1.4))]);
}

/* ---------------- the lift ride out of a deck ---------------- */

export async function liftRide(d: Director, w: World, exit: Exit) {
  const e = exit.spot.clone();
  const body = w.player.body;
  const from = jason(w);
  const toCam = toward(e, d.rig.pos);
  const facing = Math.atan2(toCam.x, toCam.z);
  w.player.facing = facing;
  const hover = V(e.x + 0.9, e.y + 2.2, e.z);
  w.bolt.override = hover;
  // Everyone rides out together: with a partner (or two) the heroes stand side by side on the skiff,
  // a third one just behind. They all stand on the pad's floor, not sunk into it.
  const side = V(toCam.z, 0, -toCam.x);
  const crew = w.player.crew;
  const seat = (i: number) => {
    if (!crew.length) return V();
    if (i < 2) return side.clone().multiplyScalar(i === 0 ? -0.75 : 0.75);
    return toCam.clone().multiplyScalar(-0.9);
  };
  const floor = e.y + exit.floor;
  const me = e.clone().add(seat(0));
  const riders = crew.map((f, i) => {
    const at = e.clone().add(seat(i + 1)).setY(floor);
    return { f, from: V(f.spot.x, f.spot.y, f.spot.z), at, pos: V(f.spot.x, f.spot.y, f.spot.z) };
  });
  for (const r of riders) {
    r.f.place(r.from.x, r.from.y, r.from.z, facing);
    r.f.riding = r.pos;
  }
  try {
    await Promise.all([
      d.tween(0.7, (x) => {
        body.x = from.x + (me.x - from.x) * x;
        body.z = from.z + (me.z - from.z) * x;
        body.y = from.y + (floor - from.y) * x;
        body.vy = 0;
        for (const r of riders) r.pos.lerpVectors(r.from, r.at, x);
      }),
      d.cam(e.clone().addScaledVector(toCam, 7).add(V(0, 2.2, 0)), e.clone().add(V(0, 1.4, 0)), 0.9, ease.inOut, 46),
    ]);
    audio.play('door');
    w.rings.burst(e.x, e.y, e.z, 3, '#3dff8a', 0.6);
    await d.wait(0.4);
    const rise = 10;
    const cam0 = d.rig.pos.clone();
    await Promise.all([
      d.tween(
        3.2,
        (x) => {
          const y = e.y + rise * x;
          exit.pad.position.y = y;
          body.y = y + exit.floor;
          body.vy = 0;
          for (const r of riders) r.pos.y = y + exit.floor;
          hover.set(e.x + 0.9, y + 2.2, e.z);
          d.rig.pos.set(cam0.x, cam0.y + rise * x * 0.35, cam0.z);
          d.rig.look.set(e.x, y + 1.4, e.z);
          if (Math.random() < 0.6) w.particles.emit(e.x + (Math.random() - 0.5) * 2.4, y, e.z + (Math.random() - 0.5) * 2.4, { count: 1, color: '#3dff8a', speed: 0.4, up: -3, life: 0.8, size: 0.35, gravity: 0 });
        },
        ease.in,
      ),
      after(d, 2.3, () => d.fade('#000000', 1, 0.9)),
    ]);
  } finally {
    w.bolt.override = null;
    for (const r of riders) r.f.riding = null;
  }
}

