import * as THREE from 'three';

import { ColonyShip } from '../cinema/colonyShip';
import type { SaveData } from '../core/save';
import { dressJason, makeBolt, makeJason, mat, mesh } from '../entities/models';
import { buildSky } from '../world/sky';
import { THEMES } from '../world/themes';

/** The title backdrop: Jason and LUX on a floating deck with the Syracusia cruising behind them. */
export class TitleScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.3, 900);
  private ship = new ColonyShip();
  private jason = makeJason();
  readonly bolt = makeBolt();
  private t = 0;

  constructor() {
    const th = THEMES.bridge;
    this.scene.background = new THREE.Color(th.skyTop);
    this.scene.fog = new THREE.Fog(th.fog, 60, 400);
    this.scene.add(buildSky(th, new THREE.Vector3(0, 0, 0), 60));
    this.scene.add(new THREE.HemisphereLight('#e8e0ff', '#1c1640', 0.9));
    const sun = new THREE.DirectionalLight('#fff4e0', 1.9);
    sun.position.set(20, 30, 20);
    this.scene.add(sun);
    const star = new THREE.PointLight('#ffb070', 900, 0, 2);
    star.position.set(-80, 30, -160);
    this.scene.add(star);
    const sunGlow = new THREE.Mesh(new THREE.SphereGeometry(18, 24, 16), new THREE.MeshBasicMaterial({ color: '#ffcf8a', fog: false }));
    sunGlow.position.set(-120, 40, -260);
    this.scene.add(sunGlow);

    // Floating deck with Jason and LUX.
    const deck = new THREE.Group();
    deck.add(mesh(new THREE.CylinderGeometry(3.6, 3.2, 0.8, 32), mat('#7482c2', { rough: 0.6, metal: 0.2 }), 0, -0.4, 0));
    deck.add(mesh(new THREE.TorusGeometry(3.55, 0.09, 8, 48).rotateX(Math.PI / 2), mat('#ff9ae0', { emissive: '#ff6fcf', ei: 1.4 }), 0, 0.02, 0, false));
    deck.add(mesh(new THREE.CylinderGeometry(2.6, 1.2, 2.2, 24), mat('#303a78', { rough: 0.7 }), 0, -1.9, 0));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const b = mesh(new THREE.SphereGeometry(0.3, 10, 8), mat('#ff6fcf', { emissive: '#ff6fcf', ei: 0.8 }), Math.cos(a) * 2.8, 0.2, Math.sin(a) * 2.8, false);
      b.scale.y = 0.5;
      deck.add(b);
    }
    this.scene.add(deck);
    this.jason.root.position.set(-0.7, 0, 0.3);
    this.jason.root.rotation.y = 0.35;
    this.scene.add(this.jason.root);
    this.bolt.root.position.set(1.1, 2, 0.6);
    this.scene.add(this.bolt.root);

    // The Syracusia, already overgrown with GaScu.
    this.ship.setGrowth(0.85);
    const s = this.ship.group;
    s.position.set(10, 8, -120);
    s.rotation.set(0.12, 0.5, 0.05);
    this.scene.add(s);
    this.camera.position.set(0.4, 2.2, 8.5);
    this.camera.lookAt(0.6, 1.6, 0);
  }

  resize(w: number, h: number) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** `upgrades` dresses Jason in the gear he has bought, and `outfit` in what he wears (cheap when nothing changed). */
  update(dt: number, upgrades: SaveData['upgrades'], outfit?: string) {
    dressJason(this.jason, upgrades, 'blaster', outfit);
    this.t += dt;
    const t = this.t;
    this.ship.update(dt);
    this.ship.group.position.x = 10 + Math.sin(t * 0.05) * 6;
    this.ship.group.rotation.x = 0.12 + Math.sin(t * 0.2) * 0.02;
    const k = this.jason;
    k.armR.rotation.z = 2.4 + Math.sin(t * 7) * 0.4;
    k.armR.rotation.x = 0;
    k.armL.rotation.x = Math.sin(t * 1.5) * 0.05;
    k.body.position.y = Math.sin(t * 2) * 0.02;
    k.head.rotation.y = Math.sin(t * 0.7) * 0.25;
    this.bolt.root.position.y = 2 + Math.sin(t * 2.2) * 0.15;
    this.bolt.root.rotation.y = -0.4 + Math.sin(t * 0.8) * 0.3;
    this.bolt.shell.rotation.z = Math.sin(t * 1.7) * 0.1;
    this.camera.position.x = 0.4 + Math.sin(t * 0.15) * 0.6;
    this.camera.lookAt(0.6, 1.6, 0);
  }
}
