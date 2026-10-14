import * as THREE from 'three';

import { audio } from '../../core/audio';
import { haptic } from '../../core/bridge';
import type { World } from '../../game/world';
import { PYLONS, type PylonKind } from './gardenData';
import { Entity, type HitKind, type Interactable, type Target } from '../entity';
import { HEROES } from '../heroes/heroes';
import { cyl, glowSprite, mat, mesh, ownMat, torus } from '../models';
import { clearShot, powerShot } from './seals';

/**
 * The LULLABY PYLONS around the Sleepless Dragon's lawn: four old Gardener light-pylons, one for each
 * word of the lullaby. Each one needs one hero's skill to light (the marker `pylon:<kind>` places it):
 * - SKY: a crystal bullseye on top, only a POWER ARROW lights it (Atalanta).
 * - GROW: a round stone dais, only a GROUND POUND on it lights it (Jason).
 * - HOME: up on a high hedge shelf; only Atalanta's wall-jump gets there. Touch it.
 * - FRIEND: on top of a crystal column; only Jason's grapple gets there. Touch it.
 * They only wake up once the fight has begun; the dragon resets them if the heroes are knocked out.
 * Until it is lit, each one sends up a thin beam in the colour of the hero who can light it, and the
 * SKY pylon gives Atalanta a POWER ARROW button whenever her shot is clear.
 */

export class Pylon extends Entity implements Target, Interactable {
  readonly aim: THREE.Vector3;
  radius = 0.9;
  range = 16;
  reachY = 6;
  aimable = false;
  lit = false;
  /** Set by the dragon while the fight is on. */
  active = false;
  private crystalMat: THREE.MeshStandardMaterial;
  private ringMat: THREE.MeshStandardMaterial;
  private beam: THREE.Mesh;
  private beamMat: THREE.MeshBasicMaterial;
  /** The thin beam in the hero's colour that marks it until it is lit. */
  private need: THREE.Mesh;
  private needMat: THREE.MeshBasicMaterial;
  private glow: THREE.Sprite;
  private top = new THREE.Group();
  private hinted = false;
  private flare = 0;
  private topY: number;

  constructor(
    world: World,
    readonly kind: PylonKind,
    readonly spot: THREE.Vector3,
    private onLit: (p: Pylon) => void,
  ) {
    super(world, `${world.def.id}.pylon.${kind}`);
    const def = PYLONS[kind];
    const { x, y, z } = spot;
    const stone = mat('#d8c8a8', { rough: 0.8 });
    const height = kind === 'grow' ? 1.6 : 2.8;
    this.obj.add(mesh(cyl(0.7, 0.85, 0.3, 8), stone, x, y + 0.15, z));
    this.obj.add(mesh(cyl(0.32, 0.45, height, 6), stone, x, y + height / 2, z));
    // Bands of the word's colour up the shaft.
    const band = mat(def.color, { emissive: def.color, ei: 0.6 });
    for (let k = 1; k <= (kind === 'grow' ? 1 : 3); k++) this.obj.add(mesh(torus(0.38, 0.05), band, x, y + k * 0.7, z, false).rotateX(Math.PI / 2));
    this.crystalMat = ownMat(def.color, { emissive: def.color, ei: 0.3, rough: 0.1 });
    this.topY = y + height + 0.55;
    this.top.position.set(x, this.topY, z);
    this.top.add(mesh(new THREE.OctahedronGeometry(0.5, 0), this.crystalMat, 0, 0, 0, false));
    if (kind === 'sky') {
      // A bullseye ring of crystal around the top for the power arrow.
      const white = mat('#ffffff', { emissive: '#ffffff', ei: 0.4 });
      this.top.add(mesh(torus(0.85, 0.08), white, 0, 0, 0, false));
      this.top.add(mesh(torus(0.62, 0.06), band, 0, 0, 0, false));
    }
    this.obj.add(this.top);
    // A ring on the ground in the colour of the hero who can light it.
    this.ringMat = ownMat(HEROES[def.hero].color, { emissive: HEROES[def.hero].color, ei: 0.3 });
    const r = kind === 'grow' ? 1.9 : 1.15;
    this.obj.add(mesh(torus(r, 0.07), this.ringMat, x, y + 0.08, z, false).rotateX(Math.PI / 2));
    if (kind === 'grow') this.obj.add(mesh(cyl(r, r, 0.12, 20), mat('#b8a888', { rough: 0.9 }), x, y + 0.06, z));
    // The pillar of light it sends up to the sky once it is lit.
    this.beamMat = new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 40, 12, 1, true), this.beamMat);
    this.beam.position.set(x, y + 20, z);
    this.beam.visible = false;
    this.obj.add(this.beam);
    this.needMat = new THREE.MeshBasicMaterial({ color: HEROES[def.hero].color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.need = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.4, 30, 10, 1, true), this.needMat);
    this.need.position.set(x, y + 15, z);
    this.need.visible = false;
    this.obj.add(this.need);
    this.glow = glowSprite(def.color, 3.2, 0);
    this.glow.position.copy(this.top.position);
    this.obj.add(this.glow);
    this.aim = this.top.position.clone();
    if (kind === 'grow') this.aim.set(x, y + 0.3, z);
    if (kind === 'grow') this.radius = 1.6;
    world.addTarget(this);
    if (kind === 'sky') world.addInteractable(this);
  }

  /** The SKY pylon's button: POWER ARROW for Atalanta, whenever nothing hides it from her bow. */
  label() {
    return this.shootable() && clearShot(this.world, this.aim, this.radius) ? 'POWER ARROW' : null;
  }

  /** True while Atalanta could light this pylon with an arrow. */
  private shootable() {
    const pl = this.world.player;
    return this.def.how === 'arrow' && this.active && !this.lit && !pl.down && pl.hero === 'atalanta';
  }

  interact() {
    if (this.label()) powerShot(this.world, this.aim);
  }

  get def() {
    return PYLONS[this.kind];
  }

  reset() {
    this.lit = false;
    this.active = false;
    this.beam.visible = false;
    this.flare = 0;
  }

  /** Lights the pylon: a burst of its colour, a beam to the sky, and the dragon hears another verse. */
  light() {
    if (this.lit || !this.active) return;
    this.lit = true;
    this.flare = 1;
    const w = this.world;
    const c = this.top.position;
    this.beam.visible = true;
    w.flash(c.x, c.y, c.z, this.def.color, 70, 0.5);
    w.rings.burst(this.spot.x, this.spot.y + 0.05, this.spot.z, 6, this.def.color, 0.6);
    w.particles.emit(c.x, c.y, c.z, { count: 40, color: this.def.color, speed: 7, life: 0.9, size: 0.6, up: 3 });
    audio.play('upgrade', 1.2);
    audio.play('tone3', 1);
    haptic('success');
    this.onLit(this);
  }

  /** The wrong kind of hit: a "tink" and (once) a hint about who can light it. */
  private nudge() {
    audio.play('zap', 2.4, 0.6);
    if (this.hinted || !this.def.text) return;
    this.hinted = true;
    this.world.hooks.toast(this.def.text, 'bolt');
  }

  hit(_dmg: number, kind: HitKind): boolean {
    if (this.lit || !this.active) return false;
    if (this.def.how === 'pound' && kind === 'pound') {
      this.light();
      return true;
    }
    if (this.def.how === 'touch') return false;
    if (kind !== 'zap' && kind !== 'pulse') this.nudge();
    return this.def.how === 'arrow';
  }

  powerArrow(): boolean {
    if (this.lit || !this.active) return false;
    if (this.def.how === 'arrow') this.light();
    else this.nudge();
    return true;
  }

  update(dt: number) {
    const w = this.world;
    const t = w.time;
    this.flare = Math.max(0, this.flare - dt * 0.8);
    this.top.rotation.y += dt * (this.lit ? 2.5 : 0.8);
    this.top.position.y = this.topY + Math.sin(t * 2 + this.spot.x) * 0.12;
    if (this.kind !== 'grow') this.aim.y = this.top.position.y;
    this.crystalMat.emissiveIntensity = this.lit ? 2.6 + this.flare * 3 : this.active ? 0.6 + Math.sin(t * 4) * 0.35 : 0.15;
    this.ringMat.emissiveIntensity = this.lit ? 0.4 : this.active ? 1 + Math.sin(t * 5) * 0.6 : 0.1;
    this.glow.position.copy(this.top.position);
    this.glow.material.opacity = this.lit ? 0.7 : this.active ? 0.25 + Math.sin(t * 4) * 0.1 : 0;
    this.beamMat.opacity = this.lit ? 0.22 + Math.sin(t * 3) * 0.06 + this.flare * 0.4 : 0;
    this.need.visible = this.active && !this.lit;
    this.needMat.opacity = 0.3 + Math.sin(t * 3 + this.spot.x) * 0.1;
    // Only Atalanta's bow locks on to the SKY pylon (Jason's blaster shouldn't waste shots on it).
    this.aimable = this.def.how === 'arrow' && this.active && !this.lit && w.player.hero === 'atalanta';
    if (this.lit && Math.random() < dt * 6) w.particles.emit(this.top.position.x, this.top.position.y, this.top.position.z, { count: 1, color: this.def.color, speed: 0.6, up: 3, life: 1.2, size: 0.4, gravity: -1 });
    if (this.def.how !== 'touch' || this.lit || !this.active) return;
    const p = w.player.body;
    if (Math.hypot(p.x - this.spot.x, p.z - this.spot.z) < 1.7 && Math.abs(p.y - this.spot.y) < 1.4) this.light();
  }
}
