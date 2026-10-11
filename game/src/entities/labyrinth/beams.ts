/**
 * How MEDUSA's gaze beams look: a glowing core and halo along the corners of a trace, and a splash of
 * light where the beam stops. The rules of the beams themselves are in `trace.ts` (no three.js there,
 * so the tests can check them).
 */
import * as THREE from 'three';

import type { Vec } from './trace';

export { labWorld, reflectFlat, traceBeam, type BeamCatcher, type BeamMirror, type BeamResult } from './trace';

/* ---------------- the beam's look ---------------- */

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const CORE_GEO = new THREE.CylinderGeometry(0.07, 0.07, 1, 6, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5);
const HALO_GEO = new THREE.CylinderGeometry(0.22, 0.22, 1, 8, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5);

/** A glowing beam drawn along a trace's corners (up to 11 legs), with a splash of light where it stops. */
export class BeamFx {
  readonly group = new THREE.Group();
  /** How solid the whole beam looks (1: a real beam; less for MEDUSA's faint aiming line). */
  alpha = 1;
  private cores: THREE.Mesh[] = [];
  private halos: THREE.Mesh[] = [];
  private coreMat: THREE.MeshBasicMaterial;
  private haloMat: THREE.MeshBasicMaterial;
  private splash: THREE.Sprite;

  constructor(color: string) {
    this.coreMat = new THREE.MeshBasicMaterial({ color: '#f4fff6', transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false });
    this.haloMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    for (let i = 0; i < 11; i++) {
      const c = new THREE.Mesh(CORE_GEO, this.coreMat);
      const h = new THREE.Mesh(HALO_GEO, this.haloMat);
      c.frustumCulled = h.frustumCulled = false;
      c.visible = h.visible = false;
      this.cores.push(c);
      this.halos.push(h);
      this.group.add(c, h);
    }
    const tex = splashTexture();
    this.splash = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    this.splash.scale.setScalar(1.4);
    this.group.add(this.splash);
  }

  /** Draws the beam through `pts` (or hides it with an empty list); `pulse` swells the halo. */
  show(pts: readonly Vec[], pulse = 0) {
    for (let i = 0; i < this.cores.length; i++) {
      const on = !!pts[i] && !!pts[i + 1];
      const a = on ? tmpA.set(pts[i].x, pts[i].y, pts[i].z) : tmpA;
      const z = on ? tmpB.set(pts[i + 1].x, pts[i + 1].y, pts[i + 1].z) : tmpB;
      const show = on && a.distanceToSquared(z) > 1e-4;
      this.cores[i].visible = this.halos[i].visible = show;
      if (!show) continue;
      for (const m of [this.cores[i], this.halos[i]]) {
        m.position.copy(a);
        m.lookAt(z);
        m.scale.set(1, 1, a.distanceTo(z));
      }
    }
    this.halos.forEach((h) => h.scale.setX(1 + pulse * 0.6).setY(1 + pulse * 0.6));
    this.coreMat.opacity = 0.95 * this.alpha;
    this.haloMat.opacity = (0.3 + pulse * 0.25) * this.alpha;
    (this.splash.material as THREE.SpriteMaterial).opacity = this.alpha;
    const last = pts[pts.length - 1];
    this.splash.visible = pts.length > 1;
    if (last) this.splash.position.set(last.x, last.y, last.z);
    this.splash.scale.setScalar(1.2 + pulse * 0.8 + Math.random() * 0.25);
  }

  hide() {
    this.show([]);
  }
}

let splashTex: THREE.Texture | null = null;

function splashTexture(): THREE.Texture {
  if (splashTex) return splashTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (g) {
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.3, 'rgba(255,255,255,0.6)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
  }
  splashTex = new THREE.CanvasTexture(c);
  return splashTex;
}
