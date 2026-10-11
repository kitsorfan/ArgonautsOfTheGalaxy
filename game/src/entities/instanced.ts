import * as THREE from 'three';

const tmpM = new THREE.Matrix4();
const inv = new THREE.Matrix4();

/**
 * Draws many small meshes that share a geometry and a material as one InstancedMesh per pair, to save
 * draw calls (MEDUSA's crown of cable snakes is over a hundred beads). The meshes stay where they are
 * in the scene graph as hidden stand-ins, so the code that moves them keeps working: `sync()` copies
 * where they are now into the instances. Call it after their world matrices are up to date.
 */
export class InstancedParts {
  /** Add this to the scene, without moving it: instances are placed relative to its parent. */
  readonly group = new THREE.Group();
  private sets: { inst: THREE.InstancedMesh; parts: THREE.Mesh[] }[] = [];

  constructor(roots: readonly THREE.Object3D[]) {
    const by = new Map<string, THREE.Mesh[]>();
    for (const root of roots) {
      root.traverse((o) => {
        if (!(o instanceof THREE.Mesh) || o instanceof THREE.InstancedMesh || Array.isArray(o.material)) return;
        const key = `${o.geometry.uuid}|${(o.material as THREE.Material).uuid}`;
        const list = by.get(key) ?? [];
        list.push(o);
        by.set(key, list);
      });
    }
    for (const parts of by.values()) {
      const first = parts[0];
      const inst = new THREE.InstancedMesh(first.geometry, first.material as THREE.Material, parts.length);
      inst.castShadow = first.castShadow;
      // The parts move about a lot (and the bounding sphere would go stale): always draw them.
      inst.frustumCulled = false;
      // A hidden stand-in still updates its matrices, and (unlike `visible`) layers don't hide its children.
      for (const p of parts) p.layers.disableAll();
      this.group.add(inst);
      this.sets.push({ inst, parts });
    }
  }

  sync() {
    // The group itself stays where it was made (no offset from its parent).
    const parent = this.group.parent;
    if (parent) inv.copy(parent.matrixWorld).invert();
    else inv.identity();
    for (const { inst, parts } of this.sets) {
      for (let i = 0; i < parts.length; i++) inst.setMatrixAt(i, tmpM.multiplyMatrices(inv, parts[i].matrixWorld));
      inst.instanceMatrix.needsUpdate = true;
    }
  }

  dispose() {
    for (const { inst } of this.sets) inst.dispose();
  }
}
