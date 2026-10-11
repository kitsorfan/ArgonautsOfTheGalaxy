import * as THREE from 'three';

import { glowSprite } from '../entities/models';

/**
 * The Argo: Captain Argus's old shuttle, rebuilt for the voyage to Colchis. A sleek white-and-gold ship
 * shaped like an old Greek galley: a ram's head on the prow, five oar-like solar fins along each side
 * that "row" as it flies, one big sail-like solar panel on a mast, a curling stern post and two
 * engines. It points along -Z (forward), up is +Y, and it is about 7 units long. The root sits at the
 * hull's centre, unless it is built `centred` (see makeArgo).
 */
export interface ArgoModel {
  root: THREE.Group;
  /** Tilts with the steering (the flight banks it), about the root. */
  body: THREE.Group;
  /**
   * How far the middle of the whole ship as you see it (hull, oars, mast and sail) is above the hull's
   * centre, in model units (before the root is scaled). The tall sail puts it well above the hull.
   */
  centre: number;
  /** A bubble of gold light while boosting. */
  shield: THREE.Mesh;
  /** Animates the oars, the sail and the engines; `thrust` 0..1 (1 = boosting). */
  update(t: number, thrust: number): void;
}

const WHITE = '#cfd5e2';
const GOLD = '#ffc94a';

/** The sail's solar cells: a gold frame around a grid of blue cells with a ram's head emblem. */
function sailTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 192;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.fillStyle = '#f6efe0';
  g.fillRect(0, 0, 256, 192);
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 8; x++) {
      const grad = g.createLinearGradient(0, 14 + y * 28, 0, 38 + y * 28);
      grad.addColorStop(0, '#5fb8ff');
      grad.addColorStop(1, '#2a5ac8');
      g.fillStyle = grad;
      g.fillRect(14 + x * 29, 14 + y * 28, 25, 24);
    }
  }
  g.strokeStyle = '#ffc94a';
  g.lineWidth = 10;
  g.strokeRect(5, 5, 246, 182);
  // A gold sun-and-ram emblem in the middle.
  g.fillStyle = '#ffd166';
  g.beginPath();
  g.arc(128, 96, 30, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#b8860b';
  g.lineWidth = 6;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.arc(128 + s * 16, 86, 14, s > 0 ? Math.PI : 0, s > 0 ? Math.PI * 2.6 : -Math.PI * 1.6, s < 0);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const tube = (pts: THREE.Vector3[], r: number, mat: THREE.Material) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, r, 8, false), mat);

/**
 * Builds the Argo. `centred` hangs it from the middle of what you see instead of from the hull's centre:
 * the flight steers the ship by its root, and rings, bolts and rocks are tested against that point, so
 * a ring counts when the ship looks centred in it (and the ship banks about that point too).
 */
export function makeArgo(centred = false): ArgoModel {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const white = new THREE.MeshStandardMaterial({ color: WHITE, roughness: 0.5, metalness: 0.1 });
  const gold = new THREE.MeshStandardMaterial({ color: GOLD, roughness: 0.3, metalness: 0.75, emissive: '#5a3a00', emissiveIntensity: 0.25 });
  const darkGold = new THREE.MeshStandardMaterial({ color: '#c8901e', roughness: 0.35, metalness: 0.8 });
  const glass = new THREE.MeshStandardMaterial({ color: '#7fe6ff', emissive: '#3fb6ff', emissiveIntensity: 0.9, roughness: 0.08, transparent: true, opacity: 0.85 });
  const cell = new THREE.MeshStandardMaterial({ color: '#4a9cff', emissive: '#2a6aff', emissiveIntensity: 0.3, roughness: 0.35, metalness: 0.4 });

  // The hull: a long white galley with a gold belly and a gold rail along the deck.
  const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), white);
  hull.scale.set(1.15, 0.72, 3.3);
  body.add(hull);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), gold);
  belly.scale.set(1.17, 0.74, 3.32);
  body.add(belly);
  for (const s of [-1, 1]) {
    const rail = tube([new THREE.Vector3(s * 0.7, 0.42, 2.6), new THREE.Vector3(s * 1.08, 0.36, 0), new THREE.Vector3(s * 0.62, 0.42, -2.6)], 0.07, gold);
    body.add(rail);
  }

  // The prow curls up into a golden ram's head with curly horns and glowing eyes.
  body.add(tube([new THREE.Vector3(0, 0.1, -2.9), new THREE.Vector3(0, 0.35, -3.55), new THREE.Vector3(0, 0.9, -3.85)], 0.24, gold));
  const ram = new THREE.Group();
  ram.position.set(0, 1.05, -3.95);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 14), gold);
  head.scale.set(0.82, 0.9, 1.1);
  ram.add(head);
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10), gold);
  snout.position.set(0, -0.14, -0.38);
  snout.scale.set(0.9, 0.85, 1.2);
  ram.add(snout);
  for (const s of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.1, 8, 20, Math.PI * 1.65), darkGold);
    horn.position.set(s * 0.36, 0.04, 0.06);
    horn.rotation.set(0, s * Math.PI * 0.5, s > 0 ? -0.6 : Math.PI + 0.6);
    ram.add(horn);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: '#7fe6ff' }));
    eye.position.set(s * 0.2, 0.08, -0.3);
    ram.add(eye);
  }
  body.add(ram);

  // The stern post curls up and forward, like the old ships' tail.
  body.add(tube([new THREE.Vector3(0, 0.25, 2.9), new THREE.Vector3(0, 0.9, 3.55), new THREE.Vector3(0, 1.8, 3.4), new THREE.Vector3(0, 2.05, 2.85), new THREE.Vector3(0, 1.75, 2.6)], 0.13, gold));

  // The cockpit bubble (Captain Argus flies; Jason and LUX sit behind him).
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), glass);
  dome.position.set(0, 0.52, -1.45);
  dome.scale.set(1, 0.8, 1.5);
  body.add(dome);

  // Five oar-like solar fins along each side, angled down and out, that row as the ship flies.
  const oars: { pivot: THREE.Group; side: number; i: number }[] = [];
  const shaftG = new THREE.CylinderGeometry(0.05, 0.05, 2.0, 6).rotateZ(Math.PI / 2).translate(1.0, 0, 0);
  const bladeG = new THREE.BoxGeometry(0.95, 0.05, 0.42).translate(2.35, 0, 0);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.98, -0.05, -1.5 + i * 0.75);
      const arm = new THREE.Group();
      arm.add(new THREE.Mesh(shaftG, darkGold), new THREE.Mesh(bladeG, cell));
      arm.rotation.z = -0.42;
      arm.scale.x = side;
      if (side < 0) arm.rotation.z = 0.42;
      pivot.add(arm);
      body.add(pivot);
      oars.push({ pivot, side, i });
    }
  }

  // The mast and its great sail-shaped solar panel, curved as if full of starlight.
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.5, 8), darkGold);
  mast.position.set(0, 2.1, 0.1);
  body.add(mast);
  const sailG = new THREE.PlaneGeometry(3.4, 2.5, 10, 6);
  const sp = sailG.getAttribute('position') as THREE.BufferAttribute;
  const flat = new Float32Array(sp.array as Float32Array);
  const sail = new THREE.Mesh(sailG, new THREE.MeshStandardMaterial({ map: sailTexture(), side: THREE.DoubleSide, roughness: 0.6, metalness: 0.1, emissive: '#3060c0', emissiveIntensity: 0.1 }));
  sail.position.set(0, 2.45, 0.05);
  body.add(sail);
  for (const y of [1.2, 3.7]) {
    const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.6, 6).rotateZ(Math.PI / 2), gold);
    yard.position.set(0, y, 0.1);
    body.add(yard);
  }
  const flag = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 4).rotateZ(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#ff6fcf', emissive: '#ff6fcf', emissiveIntensity: 0.3 }));
  flag.position.set(0.25, 3.95, 0.1);
  body.add(flag);

  // Two engines at the stern, and a big glow between them when boosting.
  const engines: THREE.Sprite[] = [];
  for (const s of [-1, 1]) {
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.5, 12).rotateX(Math.PI / 2), darkGold);
    nozzle.position.set(s * 0.5, -0.12, 3.1);
    body.add(nozzle);
    const e = glowSprite('#7fe6ff', 1, 0.5);
    e.position.set(s * 0.5, -0.12, 3.45);
    body.add(e);
    engines.push(e);
  }
  const boostGlow = glowSprite('#ffd166', 3, 0);
  boostGlow.position.set(0, 0, 3.6);
  body.add(boostGlow);

  const shield = new THREE.Mesh(
    new THREE.SphereGeometry(1, 24, 16),
    new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  shield.scale.set(2.4, 2.6, 4.6);
  shield.position.y = 0.9;
  shield.visible = false;
  root.add(shield);

  // The middle of the ship as you see it: the box around its meshes (not the glow sprites), oars at rest.
  const box = new THREE.Box3();
  body.updateMatrixWorld(true);
  body.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) box.union(new THREE.Box3().setFromObject(o));
  });
  const centre = box.getCenter(new THREE.Vector3()).y;
  if (centred) {
    const frame = new THREE.Group();
    frame.add(...body.children);
    frame.position.y = -centre;
    body.add(frame);
    shield.position.y -= centre;
  }

  return {
    root,
    body,
    shield,
    centre,
    update(t: number, thrust: number) {
      for (const o of oars) {
        // A slow rowing stroke, rippling from the prow to the stern.
        const k = Math.sin(t * 3.2 - o.i * 0.5);
        o.pivot.rotation.y = o.side * k * 0.22;
        o.pivot.rotation.x = Math.cos(t * 3.2 - o.i * 0.5) * 0.08;
      }
      // The sail billows a little.
      for (let i = 0; i < sp.count; i++) {
        const x = flat[i * 3];
        const y = flat[i * 3 + 1];
        sp.setZ(i, (1 - (x / 1.7) ** 2) * (0.35 + Math.sin(t * 1.7 + y) * 0.06) * (1 - 0.3 * (y / 1.25) ** 2));
      }
      sp.needsUpdate = true;
      const pulse = 1 + Math.sin(t * 30) * 0.08;
      for (const e of engines) e.scale.setScalar((0.7 + thrust * 0.9) * pulse);
      boostGlow.material.opacity = thrust * 0.6;
      boostGlow.scale.setScalar(3 + thrust * 3);
      ram.rotation.x = Math.sin(t * 1.3) * 0.04;
    },
  };
}

/**
 * LUX's dove drone: a little white robot bird with gold wings and a cyan eye. In the myth the Argonauts
 * sent a dove through the Clashing Rocks first; LUX built one. It faces -Z.
 */
export interface DoveModel {
  root: THREE.Group;
  /** Flaps the wings; `beat` 0..1 (0 = gliding). */
  flap(t: number, beat: number): void;
  /** Hides (or shows back) the middle tail feather the rocks snip off. */
  tail: THREE.Mesh;
}

export function makeDove(): DoveModel {
  const root = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4, emissive: '#ffffff', emissiveIntensity: 0.15 });
  const gold = new THREE.MeshStandardMaterial({ color: GOLD, roughness: 0.3, metalness: 0.7 });
  const bodyM = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), white);
  bodyM.scale.set(0.9, 0.8, 1.5);
  root.add(bodyM);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), white);
  head.position.set(0, 0.16, -0.42);
  root.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 6).rotateX(-Math.PI / 2), gold);
  beak.position.set(0, 0.13, -0.62);
  root.add(beak);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), new THREE.MeshBasicMaterial({ color: '#5ee0ff' }));
    eye.position.set(s * 0.1, 0.2, -0.52);
    root.add(eye);
  }
  const wings: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Group();
    w.position.set(s * 0.18, 0.08, -0.05);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.03, 0.38).translate(s * 0.45, 0, 0), white);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.035, 0.3).translate(s * 0.95, 0, 0.04), gold);
    w.add(blade, tip);
    root.add(w);
    wings.push(w);
  }
  const tails: THREE.Mesh[] = [];
  for (const a of [-0.4, 0, 0.4]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.025, 0.4).translate(0, 0, 0.2), white);
    f.position.set(0, 0.02, 0.38);
    f.rotation.y = a;
    root.add(f);
    tails.push(f);
  }
  const glow = glowSprite('#bff4ff', 1.6, 0.6);
  root.add(glow);
  return {
    root,
    tail: tails[1],
    flap(t: number, beat: number) {
      const a = Math.sin(t * 16) * 0.7 * beat + 0.1;
      wings[0].rotation.z = -a;
      wings[1].rotation.z = a;
    },
  };
}

/** One of the Argo's three rockets: a white-and-gold dart with red fins and a glowing exhaust (points along -z). */
export function makeRocket(): THREE.Group {
  const root = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: '#f4f2ee', roughness: 0.35 });
  const red = new THREE.MeshStandardMaterial({ color: '#e0383a', roughness: 0.4 });
  const gold = new THREE.MeshStandardMaterial({ color: GOLD, roughness: 0.3, metalness: 0.7 });
  root.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.1, 10).rotateX(Math.PI / 2), white));
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 10).rotateX(-Math.PI / 2), red);
  nose.position.z = -0.76;
  root.add(nose);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.12, 10).rotateX(Math.PI / 2), gold);
  band.position.z = -0.3;
  root.add(band);
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.34, 0.3), red);
    fin.position.set(0, 0, 0.42);
    fin.rotation.z = (i * Math.PI) / 2;
    fin.translateY(0.2);
    root.add(fin);
  }
  const flame = glowSprite('#ffb020', 1.6, 0.9);
  flame.position.z = 0.75;
  root.add(flame);
  root.scale.setScalar(1.3);
  return root;
}
