import * as THREE from 'three';

import { audio } from '../../core/audio';
import { haptic } from '../../core/bridge';
import { ATALANTA } from '../../core/constants';
import { tr } from '../../core/i18n';
import type { World } from '../../game/world';
import type { HeroId } from '../../world/levelTypes';
import { pointBlocked } from '../../world/physics';
import { Entity, type Interactable } from '../entity';
import { ArrowTarget } from '../heroes/heroProps';
import { HEROES } from '../heroes/heroes';
import { CrackedWall } from '../heroes/legion';
import { Anchor } from '../outdoor';
import { FloorSwitch } from '../props';

/**
 * The seals of the Fleece vault, made obvious: a puzzle prop with `seal: <hero>` (a bullseye, a red
 * switch, or the cracked rock in front of one) gets a tall beam of that hero's colour until it is
 * done, and the action button does the move for you once you're close: POWER ARROW for Atalanta's
 * bullseye, POUND on a red switch, SMASH for General Brennus at cracked rock. A red switch up on a
 * pillar with a grapple ring gives Jason GRAPPLE from anywhere around its foot (the pillar itself would
 * hide the ring from the near side). The wrong hero gets a hint to switch. Each seal that breaks says
 * how many are left.
 */

type SealProp = ArrowTarget | FloorSwitch | CrackedWall;

/** Every seal on the level that sets a flag (the ones the vault counts). */
const registry = new WeakMap<World, VaultSeal[]>();

export class VaultSeal extends Entity implements Interactable {
  readonly spot: THREE.Vector3;
  range: number;
  reachY: number;
  private beam: THREE.Mesh;
  private beamMat: THREE.MeshBasicMaterial;
  private wasDone: boolean;
  private hinted = false;
  private aimHinted = false;
  /** Seconds Atalanta has stood in range of her bullseye without a clear shot. */
  private blind = 0;
  /** The grapple ring beside a switch up on a pillar (undefined until looked for). */
  private ring: Anchor | null | undefined;

  constructor(
    world: World,
    id: string,
    private prop: SealProp,
    readonly hero: HeroId,
  ) {
    super(world, id);
    const at = prop instanceof ArrowTarget ? prop.center : prop.aim;
    const base = prop instanceof ArrowTarget ? at.y - 2.3 : prop instanceof FloorSwitch ? at.y - 0.3 : at.y - 1;
    this.spot = new THREE.Vector3(at.x, base, at.z);
    // A bullseye is shot from the floor below its ledge; a switch or rock is used from close beside it.
    this.range = prop instanceof ArrowTarget ? 16 : prop instanceof FloorSwitch ? 3.2 : 5;
    this.reachY = prop instanceof ArrowTarget ? 7 : 1.6;
    this.beamMat = new THREE.MeshBasicMaterial({ color: HEROES[hero].color, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.55, 30, 12, 1, true), this.beamMat);
    this.beam.position.set(at.x, base + 15, at.z);
    this.obj.add(this.beam);
    this.wasDone = this.done;
    this.beam.visible = !this.wasDone;
    if (this.flag) {
      let list = registry.get(world);
      if (!list) registry.set(world, (list = []));
      list.push(this);
    }
    world.addInteractable(this);
  }

  /** The flag this seal sets (a cracked rock has none: it only opens the way to a switch). */
  private get flag(): string | null {
    const p = this.prop;
    return p instanceof CrackedWall ? null : p.flag;
  }

  get done(): boolean {
    const p = this.prop;
    if (p instanceof CrackedWall) return !p.alive;
    return this.world.hasFlag(p.flag);
  }

  /** Who can use the button: Atalanta shoots, Brennus smashes, anyone but Atalanta pounds a switch. */
  private canUse(hero: HeroId) {
    if (this.prop instanceof FloorSwitch) return hero !== 'atalanta';
    return hero === this.hero;
  }

  /** The grapple ring that takes Jason up to a switch on a pillar, if this is one. */
  private get lift(): Anchor | null {
    if (this.ring === undefined) {
      const ring = this.prop instanceof FloorSwitch ? this.world.entities.find((e): e is Anchor => e instanceof Anchor && e.spot.distanceTo(this.spot) < 4) : undefined;
      this.ring = ring ?? null;
      // Jason is offered the climb from anywhere around the pillar's foot.
      if (this.ring) {
        this.range = 8;
        this.reachY = 6;
      }
    }
    return this.ring;
  }

  /** True while the hero is down at the foot of a pillar switch, below its top. */
  private below() {
    return !!this.lift && this.spot.y - this.world.player.body.y > 1.6;
  }

  /** True if the wrong hero is close: Atalanta at a switch, or anyone but Jason at the foot of a pillar switch. */
  private wrongHero(hero: HeroId) {
    return !this.canUse(hero) || (this.below() && hero !== 'jason');
  }

  label() {
    if (this.done || this.world.player.down) return null;
    const hero = this.world.player.hero;
    if (this.wrongHero(hero)) return null;
    if (this.prop instanceof ArrowTarget) return this.clearShot() ? 'POWER ARROW' : null;
    if (this.prop instanceof FloorSwitch) {
      if (this.below()) return this.world.player.zipping ? null : 'GRAPPLE';
      // On top of the pillar: only right beside the switch.
      const b = this.world.player.body;
      return Math.hypot(b.x - this.spot.x, b.z - this.spot.z) <= 3.2 && Math.abs(b.y - this.spot.y) <= 1.6 ? 'POUND' : null;
    }
    return 'SMASH';
  }

  /** Where her arrow leaves the bow. */
  private bow() {
    const b = this.world.player.body;
    return new THREE.Vector3(b.x, b.y + 1.15, b.z);
  }

  /** True if nothing (a ledge lip, a pillar) stands between her bow and the bullseye. */
  private clearShot() {
    const t = this.prop as ArrowTarget;
    const w = this.world;
    const from = this.bow();
    const len = from.distanceTo(t.center) - t.radius;
    const dir = t.center.clone().sub(from).normalize();
    const p = new THREE.Vector3();
    for (let d = 0.8; d < len; d += 0.4) {
      p.copy(from).addScaledVector(dir, d);
      if (pointBlocked(w.grid, w.boxes, p.x, p.y, p.z)) return false;
    }
    return true;
  }

  interact() {
    if (!this.label()) return;
    const w = this.world;
    const pl = w.player;
    const b = pl.body;
    const p = this.prop;
    pl.facing = Math.atan2(this.spot.x - b.x, this.spot.z - b.z);
    const ring = this.lift;
    if (ring && this.below()) {
      pl.grappleTo(ring.spot, ring.hook);
      return;
    }
    if (p instanceof ArrowTarget) {
      const from = this.bow();
      const dir = p.center.clone().sub(from).normalize();
      from.addScaledVector(dir, 0.6);
      if (!pl.arrows?.fire(from, dir, true, ATALANTA.powerDamage)) return;
      audio.play('fireball', 1.5);
      w.flash(from.x, from.y, from.z, HEROES.atalanta.color, 25, 0.2);
      haptic('medium');
    } else if (p instanceof FloorSwitch) {
      audio.play('pound');
      w.shake(0.3);
      w.rings.burst(p.aim.x, p.aim.y - 0.25, p.aim.z, 3, HEROES[pl.hero].color, 0.35);
      p.hit(1, 'pound');
    } else {
      w.shake(0.3);
      p.hit(9, 'smash');
    }
  }

  update(dt: number) {
    const w = this.world;
    const done = this.done;
    if (done !== this.wasDone) {
      this.wasDone = done;
      this.beam.visible = !done;
      if (done && this.flag) this.counted();
    }
    if (done) return;
    this.beamMat.opacity = 0.32 + Math.sin(w.time * 3) * 0.12;
    const hero = w.player.hero;
    const b = w.player.body;
    const d = Math.hypot(b.x - this.spot.x, b.z - this.spot.z);
    const p = this.prop;
    // Atalanta stands in range but a ledge or pillar hides the bullseye: tell her to step back (once).
    if (p instanceof ArrowTarget && hero === this.hero && !this.aimHinted) {
      const blind = d <= this.range && Math.abs(b.y - this.spot.y) <= this.reachY && !this.clearShot();
      this.blind = blind ? this.blind + dt : 0;
      if (this.blind > 1.5) {
        this.aimHinted = true;
        w.hooks.toast('Atalanta can’t see the bullseye from here! Step back until POWER ARROW shows up.', 'bolt');
      }
    }
    // The wrong hero walks up: say who this one is for (once).
    if (this.hinted || !this.wrongHero(hero)) return;
    if (d > Math.min(this.range, 8) + 1) return;
    this.hinted = true;
    if (p instanceof ArrowTarget) w.hooks.toast('This seal is for Atalanta! Tap the SWITCH button until she is playing, then press POWER ARROW.', 'bolt');
    else if (p instanceof FloorSwitch && this.lift) w.hooks.toast('This seal is up on the pillar: only Jason’s GRAPPLE gets there! Tap the SWITCH button until he is playing, then press GRAPPLE.', 'bolt');
    else if (p instanceof FloorSwitch) w.hooks.toast('Atalanta can’t pound switches! Tap the SWITCH button to play as Jason or General Brennus, then press POUND.', 'bolt');
    else w.hooks.toast('Only General Brennus can smash this rock! Tap the SWITCH button until he is playing, then press SMASH.', 'bolt');
  }

  /** A seal broke: say how many are still left. */
  private counted() {
    const list = registry.get(this.world) ?? [];
    const left = list.filter((s) => !s.done).length;
    if (left > 0) this.world.hooks.toast(tr('Seal broken! {n} more to go.', { n: left }), 'bolt');
    else this.world.hooks.toast('All three seals are broken! The Fleece vault is open!', 'bolt');
  }
}

/** Gives a seal prop its beam and button. */
export function addSeal(world: World, prop: Entity, hero: HeroId) {
  if (prop instanceof ArrowTarget || prop instanceof FloorSwitch || prop instanceof CrackedWall) world.addEntity(new VaultSeal(world, `${prop.id}:seal`, prop, hero));
}
