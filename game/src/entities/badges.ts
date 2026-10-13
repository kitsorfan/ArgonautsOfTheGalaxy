import * as THREE from 'three';

/**
 * Enemy icons and the floating badge (icon + health bar) above every enemy. The same drawings are
 * used for the "new threat" card in the UI.
 */

export type BadgeKind = 'sporeling' | 'snapper' | 'buzzer' | 'sentry' | 'turret' | 'brute' | 'blob' | 'trooper' | 'minebot' | 'bulwark' | 'mortar' | 'harpy' | 'piranha' | 'crab' | 'jelly' | 'anvil' | 'coil' | 'ramling' | 'weeder' | 'ringguard';

const COLORS: Record<BadgeKind, string> = {
  sporeling: '#ff3fd0',
  snapper: '#ff4f7a',
  buzzer: '#ffcf3a',
  sentry: '#ff3a4c',
  turret: '#c6ff3a',
  brute: '#ff7a1a',
  blob: '#ff5fa8',
  trooper: '#ff2a2a',
  minebot: '#ff8a3a',
  bulwark: '#c9a24a',
  mortar: '#ff6fcf',
  harpy: '#ffc94a',
  piranha: '#ffb020',
  crab: '#ff9a4a',
  jelly: '#ff8ad8',
  anvil: '#ff8a3a',
  coil: '#7dff9a',
  ramling: '#ffb43a',
  weeder: '#c8e04a',
  ringguard: '#e8b83a',
};

type G = CanvasRenderingContext2D;

function glyph(g: G, kind: BadgeKind) {
  g.fillStyle = '#fff';
  g.strokeStyle = '#fff';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  switch (kind) {
    case 'sporeling': {
      // A crawling bug: round body, six legs, two red eyes.
      g.lineWidth = 6;
      for (const sx of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          g.beginPath();
          g.moveTo(64 + sx * 12, 60 + i * 10);
          g.lineTo(64 + sx * 34, 50 + i * 16);
          g.lineTo(64 + sx * 40, 70 + i * 16);
          g.stroke();
        }
      }
      g.beginPath();
      g.ellipse(64, 66, 22, 26, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#e0142a';
      g.beginPath();
      g.arc(56, 52, 5, 0, Math.PI * 2);
      g.arc(72, 52, 5, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'snapper': {
      // Open jaws full of fangs.
      g.beginPath();
      g.moveTo(26, 64);
      g.quadraticCurveTo(64, 10, 102, 64);
      g.lineTo(26, 64);
      g.moveTo(26, 70);
      g.quadraticCurveTo(64, 116, 102, 70);
      g.lineTo(26, 70);
      g.fill();
      g.fillStyle = COLORS.snapper;
      for (let i = 0; i < 5; i++) {
        const x = 36 + i * 14;
        g.beginPath();
        g.moveTo(x - 5, 60);
        g.lineTo(x + 5, 60);
        g.lineTo(x, 48);
        g.fill();
        g.beginPath();
        g.moveTo(x - 5, 74);
        g.lineTo(x + 5, 74);
        g.lineTo(x, 86);
        g.fill();
      }
      break;
    }
    case 'buzzer': {
      // A wasp: striped body, wings and a stinger.
      g.globalAlpha = 0.7;
      g.beginPath();
      g.ellipse(44, 40, 18, 10, -0.6, 0, Math.PI * 2);
      g.ellipse(84, 40, 18, 10, 0.6, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
      g.beginPath();
      g.ellipse(64, 66, 16, 26, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = COLORS.buzzer;
      g.fillRect(48, 62, 32, 6);
      g.fillRect(48, 74, 32, 6);
      g.fillStyle = '#fff';
      g.beginPath();
      g.moveTo(58, 90);
      g.lineTo(70, 90);
      g.lineTo(64, 110);
      g.fill();
      break;
    }
    case 'sentry': {
      // A robot head with a red visor slit.
      g.beginPath();
      g.roundRect(30, 34, 68, 56, 12);
      g.fill();
      g.fillRect(60, 18, 8, 18);
      g.fillStyle = '#e0142a';
      g.fillRect(40, 54, 48, 12);
      g.fillStyle = '#fff';
      g.fillRect(24, 92, 80, 10);
      break;
    }
    case 'turret': {
      // A drop of acid over a root.
      g.beginPath();
      g.moveTo(64, 16);
      g.bezierCurveTo(92, 52, 92, 88, 64, 88);
      g.bezierCurveTo(36, 88, 36, 52, 64, 16);
      g.fill();
      g.lineWidth = 7;
      g.beginPath();
      g.moveTo(40, 104);
      g.quadraticCurveTo(64, 92, 88, 104);
      g.stroke();
      g.fillStyle = COLORS.turret;
      g.beginPath();
      g.arc(58, 60, 8, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'brute': {
      // A horned skull.
      g.beginPath();
      g.moveTo(34, 50);
      g.quadraticCurveTo(22, 22, 12, 18);
      g.quadraticCurveTo(30, 34, 44, 46);
      g.moveTo(94, 50);
      g.quadraticCurveTo(106, 22, 116, 18);
      g.quadraticCurveTo(98, 34, 84, 46);
      g.fill();
      g.beginPath();
      g.roundRect(34, 40, 60, 54, 20);
      g.fill();
      g.fillStyle = '#e0142a';
      g.fillRect(44, 58, 14, 7);
      g.fillRect(70, 58, 14, 7);
      g.fillStyle = COLORS.brute;
      g.fillRect(50, 78, 28, 6);
      break;
    }
    case 'blob': {
      g.beginPath();
      g.moveTo(24, 92);
      g.bezierCurveTo(20, 30, 108, 30, 104, 92);
      g.closePath();
      g.fill();
      g.fillStyle = '#ffd24a';
      g.beginPath();
      g.arc(52, 60, 7, 0, Math.PI * 2);
      g.arc(76, 60, 7, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = COLORS.blob;
      g.fillRect(48, 76, 32, 6);
      break;
    }
    case 'trooper': {
      // A round helmet with one big red lens and an antenna.
      g.beginPath();
      g.arc(64, 66, 34, Math.PI, 0);
      g.lineTo(98, 84);
      g.quadraticCurveTo(64, 100, 30, 84);
      g.closePath();
      g.fill();
      g.fillRect(84, 14, 6, 22);
      g.beginPath();
      g.arc(87, 14, 7, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#e0142a';
      g.beginPath();
      g.arc(64, 66, 15, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(59, 61, 4, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'minebot': {
      // A round bomb with a little head and a sparking antenna.
      g.beginPath();
      g.arc(64, 78, 30, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(64, 46, 16, Math.PI, 0);
      g.fill();
      g.fillRect(62, 14, 5, 20);
      g.fillStyle = COLORS.minebot;
      g.beginPath();
      g.arc(64, 14, 7, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#e0142a';
      g.beginPath();
      g.arc(64, 42, 6, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'bulwark': {
      // A tower shield with Brennus's gear in the middle.
      g.beginPath();
      g.moveTo(30, 22);
      g.lineTo(98, 22);
      g.lineTo(98, 70);
      g.quadraticCurveTo(98, 98, 64, 112);
      g.quadraticCurveTo(30, 98, 30, 70);
      g.closePath();
      g.fill();
      g.fillStyle = '#e0142a';
      g.beginPath();
      g.arc(64, 62, 14, 0, Math.PI * 2);
      g.fill();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.fillRect(64 + Math.cos(a) * 17 - 4, 62 + Math.sin(a) * 17 - 4, 8, 8);
      }
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(64, 62, 5, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'mortar': {
      // A dome with a fat barrel, and the dotted arc of its shell.
      g.beginPath();
      g.arc(46, 96, 26, Math.PI, 0);
      g.closePath();
      g.fill();
      g.save();
      g.translate(50, 80);
      g.rotate(0.6);
      g.fillRect(-10, -40, 20, 40);
      g.restore();
      g.fillStyle = COLORS.mortar;
      for (let i = 0; i < 5; i++) {
        const t = 0.15 + i * 0.2;
        g.beginPath();
        g.arc(70 + t * 40, 46 - Math.sin(t * Math.PI) * 30, 4, 0, Math.PI * 2);
        g.fill();
      }
      g.strokeStyle = '#e0142a';
      g.lineWidth = 5;
      g.beginPath();
      g.ellipse(108, 100, 12, 5, 0, 0, Math.PI * 2);
      g.stroke();
      break;
    }
    case 'harpy': {
      // A bird with spread wings, a hooked beak and grabbing claws holding a bolt.
      g.beginPath();
      g.moveTo(64, 50);
      g.quadraticCurveTo(38, 26, 12, 40);
      g.quadraticCurveTo(34, 50, 44, 66);
      g.quadraticCurveTo(64, 74, 84, 66);
      g.quadraticCurveTo(94, 50, 116, 40);
      g.quadraticCurveTo(90, 26, 64, 50);
      g.fill();
      g.beginPath();
      g.arc(64, 54, 13, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(58, 62);
      g.lineTo(64, 74);
      g.lineTo(70, 62);
      g.fill();
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(56, 76);
      g.lineTo(52, 92);
      g.moveTo(72, 76);
      g.lineTo(76, 92);
      g.stroke();
      g.fillStyle = COLORS.harpy;
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.lineTo(64 + Math.cos(a) * 10, 100 + Math.sin(a) * 10);
      }
      g.fill();
      g.fillStyle = '#e0142a';
      g.beginPath();
      g.arc(64, 52, 5, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'piranha': {
      // A round little fish with a forked tail, a big underbite full of teeth and one red eye.
      g.beginPath();
      g.ellipse(58, 64, 34, 28, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(86, 64);
      g.lineTo(116, 40);
      g.lineTo(106, 64);
      g.lineTo(116, 88);
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(12,8,20,0.88)';
      g.beginPath();
      g.moveTo(24, 66);
      g.lineTo(52, 72);
      g.lineTo(26, 86);
      g.closePath();
      g.fill();
      g.fillStyle = '#fff';
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.moveTo(30 + i * 8, 70);
        g.lineTo(34 + i * 8, 78);
        g.lineTo(38 + i * 8, 71);
        g.fill();
      }
      g.fillStyle = '#e0142a';
      g.beginPath();
      g.arc(46, 52, 7, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'crab': {
      // A round crab shell, two big raised claws, stalk eyes and little legs.
      g.beginPath();
      g.ellipse(64, 74, 30, 20, 0, 0, Math.PI * 2);
      g.fill();
      for (const sx of [-1, 1]) {
        g.beginPath();
        g.ellipse(64 + sx * 36, 40, 12, 16, sx * 0.4, 0, Math.PI * 2);
        g.fill();
        g.lineWidth = 7;
        g.beginPath();
        g.moveTo(64 + sx * 22, 62);
        g.lineTo(64 + sx * 34, 50);
        g.stroke();
        g.lineWidth = 4;
        for (let i = 0; i < 3; i++) {
          g.beginPath();
          g.moveTo(64 + sx * 26, 78 + i * 6);
          g.lineTo(64 + sx * 44, 90 + i * 7);
          g.stroke();
        }
        g.beginPath();
        g.moveTo(64 + sx * 9, 58);
        g.lineTo(64 + sx * 11, 44);
        g.stroke();
      }
      // A notch in each pincer, and red eyes.
      g.fillStyle = COLORS.crab;
      for (const sx of [-1, 1]) {
        g.beginPath();
        g.moveTo(64 + sx * 36, 40);
        g.lineTo(64 + sx * 40, 24);
        g.lineTo(64 + sx * 30, 26);
        g.fill();
      }
      g.fillStyle = '#e0142a';
      for (const sx of [-1, 1]) {
        g.beginPath();
        g.arc(64 + sx * 11, 42, 5, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
    case 'jelly': {
      // A jellyfish bell with wavy tentacles and a glowing spark at the tips.
      g.beginPath();
      g.arc(64, 58, 32, Math.PI, 0);
      g.closePath();
      g.fill();
      g.lineWidth = 5;
      for (let i = 0; i < 5; i++) {
        const x = 40 + i * 12;
        g.beginPath();
        g.moveTo(x, 60);
        g.quadraticCurveTo(x - 7, 76, x, 88);
        g.quadraticCurveTo(x + 7, 100, x, 112);
        g.stroke();
      }
      g.fillStyle = COLORS.jelly;
      g.beginPath();
      g.arc(64, 44, 9, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#7fe6ff';
      for (let i = 0; i < 5; i++) {
        g.beginPath();
        g.arc(40 + i * 12, 112, 4, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
    case 'anvil': {
      // A little rotor drone on top, a cable, and a heavy anvil hanging under it.
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(34, 22);
      g.lineTo(94, 22);
      g.stroke();
      g.beginPath();
      g.ellipse(64, 36, 18, 11, 0, 0, Math.PI * 2);
      g.fill();
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(64, 46);
      g.lineTo(64, 66);
      g.stroke();
      g.beginPath();
      g.moveTo(30, 68);
      g.lineTo(98, 68);
      g.quadraticCurveTo(86, 78, 80, 84);
      g.lineTo(80, 92);
      g.lineTo(96, 104);
      g.lineTo(32, 104);
      g.lineTo(48, 92);
      g.lineTo(48, 84);
      g.quadraticCurveTo(40, 76, 30, 68);
      g.fill();
      g.fillStyle = '#e0142a';
      g.beginPath();
      g.arc(64, 36, 5, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'coil': {
      // A cable snake rearing up in an S, with a wide head, two green eyes and a forked tongue.
      g.lineWidth = 13;
      g.beginPath();
      g.moveTo(26, 104);
      g.bezierCurveTo(70, 112, 104, 96, 84, 76);
      g.bezierCurveTo(64, 58, 40, 70, 52, 46);
      g.stroke();
      g.beginPath();
      g.ellipse(64, 36, 22, 15, -0.35, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = COLORS.coil;
      g.beginPath();
      g.arc(56, 32, 5, 0, Math.PI * 2);
      g.arc(73, 28, 5, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#ff4f7a';
      g.lineWidth = 3.5;
      g.beginPath();
      g.moveTo(82, 40);
      g.lineTo(96, 46);
      g.lineTo(92, 40);
      g.moveTo(96, 46);
      g.lineTo(98, 52);
      g.stroke();
      break;
    }
    case 'ramling': {
      // A ram's head from the front: two big curly horns, a long face and a red visor.
      g.lineWidth = 9;
      for (const sx of [-1, 1]) {
        g.beginPath();
        g.arc(64 + sx * 30, 52, 17, 0, Math.PI * 2);
        g.stroke();
        g.beginPath();
        g.arc(64 + sx * 30, 52, 6, 0, Math.PI * 2);
        g.fill();
      }
      g.beginPath();
      g.moveTo(44, 40);
      g.lineTo(84, 40);
      g.lineTo(78, 92);
      g.quadraticCurveTo(64, 104, 50, 92);
      g.closePath();
      g.fill();
      g.fillStyle = '#e0142a';
      g.fillRect(48, 56, 32, 9);
      g.fillStyle = COLORS.ramling;
      g.beginPath();
      g.arc(57, 88, 3.5, 0, Math.PI * 2);
      g.arc(71, 88, 3.5, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'weeder': {
      // A round drone with a rotor on top, a spray tank, and a nozzle dripping weed-killer.
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(30, 28);
      g.lineTo(98, 28);
      g.moveTo(64, 28);
      g.lineTo(64, 42);
      g.stroke();
      g.beginPath();
      g.ellipse(64, 62, 30, 22, 0, 0, Math.PI * 2);
      g.fill();
      g.fillRect(58, 80, 12, 14);
      g.fillStyle = COLORS.weeder;
      g.beginPath();
      g.ellipse(64, 66, 16, 10, 0, 0, Math.PI * 2);
      g.fill();
      for (const [x, y] of [
        [56, 104],
        [72, 110],
        [64, 118],
      ]) {
        g.beginPath();
        g.arc(x, y, 5, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#e0142a';
      g.beginPath();
      g.arc(64, 52, 6, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'ringguard': {
      // A round robot head with one wide red eye and a bow tie, behind a big ring.
      g.lineWidth = 9;
      g.beginPath();
      g.arc(64, 70, 38, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.arc(64, 54, 18, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(46, 86);
      g.lineTo(64, 94);
      g.lineTo(46, 102);
      g.closePath();
      g.moveTo(82, 86);
      g.lineTo(64, 94);
      g.lineTo(82, 102);
      g.closePath();
      g.fill();
      g.fillStyle = '#e0142a';
      g.fillRect(52, 50, 24, 7);
      break;
    }
  }
}

const iconCache = new Map<string, HTMLCanvasElement>();

/** A round threat icon: dark disc, coloured rim (gold for elites) and a white glyph. */
export function enemyIcon(kind: BadgeKind, elite = false): HTMLCanvasElement {
  const key = `${kind}|${elite}`;
  const hit = iconCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d') as G;
  g.fillStyle = 'rgba(12,8,20,0.88)';
  g.beginPath();
  g.arc(64, 64, 58, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = elite ? 9 : 6;
  g.strokeStyle = elite ? '#ffd166' : COLORS[kind];
  g.beginPath();
  g.arc(64, 64, 57, 0, Math.PI * 2);
  g.stroke();
  g.save();
  g.translate(64, 64);
  g.scale(0.72, 0.72);
  g.translate(-64, -64);
  glyph(g, kind);
  g.restore();
  if (elite) {
    // A little crown on top for tougher elites.
    g.fillStyle = '#ffd166';
    g.beginPath();
    g.moveTo(44, 16);
    g.lineTo(52, 2);
    g.lineTo(64, 12);
    g.lineTo(76, 2);
    g.lineTo(84, 16);
    g.closePath();
    g.fill();
  }
  iconCache.set(key, c);
  return c;
}

export function enemyIconUrl(kind: BadgeKind, elite = false): string {
  return enemyIcon(kind, elite).toDataURL();
}

const texCache = new Map<string, THREE.Texture>();
function iconTexture(kind: BadgeKind, elite: boolean) {
  const key = `${kind}|${elite}`;
  let t = texCache.get(key);
  if (!t) {
    t = new THREE.CanvasTexture(enemyIcon(kind, elite));
    t.colorSpace = THREE.SRGBColorSpace;
    texCache.set(key, t);
  }
  return t;
}

let white: THREE.Texture | null = null;
function whiteTexture() {
  if (!white) {
    const c = document.createElement('canvas');
    c.width = c.height = 4;
    const g = c.getContext('2d') as G;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, 4, 4);
    white = new THREE.CanvasTexture(c);
  }
  return white;
}

/** Health bar size in world units (before the distance scaling). */
const BAR_W = 1.5;
const BAR_H = 0.24;
const EDGE = 0.08;

// Picked in linear light, strong enough to stay vivid through the game's filmic tone mapping.
const RED = new THREE.Color().setRGB(1.25, 0.05, 0.04);
const YELLOW = new THREE.Color().setRGB(1.15, 0.8, 0.0);
const GREEN = new THREE.Color().setRGB(0.05, 1.0, 0.08);

/** The bar's colour for a share of health left: green when healthy, through yellow, to red. */
export function healthColor(frac: number, out = new THREE.Color()): THREE.Color {
  const f = Math.max(0, Math.min(1, frac));
  return f > 0.5 ? out.copy(YELLOW).lerp(GREEN, (f - 0.5) * 2) : out.copy(RED).lerp(YELLOW, f * 2);
}

/** Tough enemies (elites, or lots of health) also show their health as a number beside the bar. */
export function showsNumber(maxHp: number, elite: boolean): boolean {
  return elite || maxHp >= 8;
}

/** What the badge is told every frame. */
export interface BadgeState {
  /** Show the icon (the enemy is close and awake). */
  icon: boolean;
  /** Show the health bar (the enemy is hurt, or very close). */
  bar: boolean;
  hp: number;
  maxHp: number;
  alarmed: boolean;
  t: number;
  /** Distance from the camera: far bars grow so they stay readable on a small screen. */
  camDist: number;
}

/**
 * Floating icon and health bar that always faces the camera. The bar has a dark outline and a fill
 * that goes from green through yellow to red; each hit flashes it white and leaves a pale "chunk" that
 * drains away after a moment. Tough enemies show their health as a number too. Far away, the whole
 * badge grows so it reads on a phone.
 */
/** Set to hide every enemy's badge (the trailer films the fights without them). */
export const BADGES = { hidden: false };

export class Badge {
  readonly group = new THREE.Group();
  private icon: THREE.Sprite;
  private frame: THREE.Sprite;
  private back: THREE.Sprite;
  private chunk: THREE.Sprite;
  private fill: THREE.Sprite;
  private alarm: THREE.Sprite;
  private num: THREE.Sprite | null = null;
  private numCanvas: HTMLCanvasElement | null = null;
  private numTex: THREE.CanvasTexture | null = null;
  private numShown = -1;
  private fillMat: THREE.SpriteMaterial;
  private iconA = 0;
  private barA = 0;
  /** The health share shown by the pale chunk, and how long until it starts to drain. */
  private chunkFrac = 1;
  private chunkWait = 0;
  private lastFrac = 1;
  private flashT = 0;
  private color = new THREE.Color();
  private bar = new THREE.Group();
  private iconSize = 0.8;

  constructor(kind: BadgeKind, elite: boolean, maxHp = 1) {
    // Flat, untoned colours: the bar must read the same in fog, at night and under bloom.
    const sm = (map: THREE.Texture, color = '#ffffff') => new THREE.SpriteMaterial({ map, color, transparent: true, depthWrite: false, depthTest: false, opacity: 0, toneMapped: false, fog: false });
    this.icon = new THREE.Sprite(sm(iconTexture(kind, elite)));
    this.iconSize = elite ? 0.95 : 0.8;
    this.icon.scale.setScalar(this.iconSize);
    this.icon.position.y = 0.62;
    this.frame = new THREE.Sprite(sm(whiteTexture(), '#07040a'));
    this.frame.scale.set(BAR_W + EDGE * 2, BAR_H + EDGE * 2, 1);
    this.back = new THREE.Sprite(sm(whiteTexture(), '#3a1622'));
    this.back.scale.set(BAR_W, BAR_H, 1);
    this.chunk = new THREE.Sprite(sm(whiteTexture(), '#fff3c8'));
    this.fillMat = sm(whiteTexture(), '#46e05a');
    this.fill = new THREE.Sprite(this.fillMat);
    for (const s of [this.chunk, this.fill]) {
      s.center.set(0, 0.5);
      s.position.x = -BAR_W / 2;
      s.scale.set(BAR_W, BAR_H, 1);
    }
    // Elites wear a gold outline.
    if (elite) (this.frame.material as THREE.SpriteMaterial).color.set('#ffd166');
    this.bar.add(this.frame, this.back, this.chunk, this.fill);
    if (showsNumber(maxHp, elite)) {
      this.numCanvas = document.createElement('canvas');
      this.numCanvas.width = 128;
      this.numCanvas.height = 64;
      this.numTex = new THREE.CanvasTexture(this.numCanvas);
      this.numTex.colorSpace = THREE.SRGBColorSpace;
      this.num = new THREE.Sprite(sm(this.numTex));
      this.num.scale.set(0.84, 0.42, 1);
      this.num.position.x = BAR_W / 2 + 0.5;
      this.bar.add(this.num);
    }
    this.alarm = new THREE.Sprite(sm(alarmTexture()));
    this.alarm.scale.setScalar(0.9);
    this.alarm.position.y = 1.55;
    // Draw order: outline, back, chunk, fill, then the number and icons on top.
    [this.frame, this.back, this.chunk, this.fill, this.num, this.icon, this.alarm].forEach((s, i) => {
      if (s) s.renderOrder = 20 + i;
    });
    this.group.add(this.bar, this.icon, this.alarm);
  }

  /** Call each frame. */
  update(dt: number, st: BadgeState) {
    const frac = st.maxHp > 0 ? Math.max(0, Math.min(1, st.hp / st.maxHp)) : 0;
    this.iconA += ((st.icon ? 1 : 0) - this.iconA) * Math.min(1, dt * 6);
    this.barA += ((st.bar ? 1 : 0) - this.barA) * Math.min(1, dt * 8);
    // A hit: flash white and leave the lost health as a pale chunk that drains after a moment.
    if (frac < this.lastFrac - 1e-4) {
      this.flashT = 0.14;
      this.chunkWait = 0.4;
      this.chunkFrac = Math.max(this.chunkFrac, this.lastFrac);
    }
    this.lastFrac = frac;
    this.flashT = Math.max(0, this.flashT - dt);
    if (this.chunkWait > 0) this.chunkWait -= dt;
    else this.chunkFrac = Math.max(frac, this.chunkFrac - dt * 0.9);
    this.group.visible = !BADGES.hidden && (this.iconA > 0.02 || this.barA > 0.02);
    if (!this.group.visible) return;
    // Keep the badge about the same size on screen however far the camera is (never smaller than up close).
    this.group.scale.setScalar(Math.max(1, Math.min(2.4, st.camDist / 13)));
    (this.icon.material as THREE.SpriteMaterial).opacity = this.iconA;
    const a = this.barA;
    (this.frame.material as THREE.SpriteMaterial).opacity = a * 0.95;
    (this.back.material as THREE.SpriteMaterial).opacity = a * 0.9;
    (this.chunk.material as THREE.SpriteMaterial).opacity = this.chunkFrac > frac ? a : 0;
    this.chunk.scale.x = Math.max(0.001, BAR_W * this.chunkFrac);
    this.fillMat.opacity = a;
    this.fill.scale.x = Math.max(0.001, BAR_W * frac);
    if (this.flashT > 0) this.fillMat.color.set('#ffffff');
    else this.fillMat.color.copy(healthColor(frac, this.color));
    // The icon sits above the bar, or in its place while the bar is hidden.
    this.icon.position.y = 0.3 + a * (BAR_H / 2 + EDGE + 0.06 + this.iconSize / 2 - 0.3);
    if (this.num && this.numCanvas && this.numTex) {
      const n = Math.max(0, Math.ceil(st.hp - 1e-3));
      if (n !== this.numShown) {
        this.numShown = n;
        const g = this.numCanvas.getContext('2d') as G;
        g.clearRect(0, 0, 128, 64);
        g.font = 'bold 46px Orbitron, Arial, sans-serif';
        g.textAlign = 'left';
        g.textBaseline = 'middle';
        g.lineWidth = 10;
        g.lineJoin = 'round';
        g.strokeStyle = '#07040a';
        g.strokeText(String(n), 6, 34);
        g.fillStyle = '#ffffff';
        g.fillText(String(n), 6, 34);
        this.numTex.needsUpdate = true;
      }
      (this.num.material as THREE.SpriteMaterial).opacity = a;
    }
    const am = this.alarm.material as THREE.SpriteMaterial;
    am.opacity = st.alarmed ? Math.max(this.iconA, a) * (0.6 + Math.sin(st.t * 14) * 0.4) : 0;
  }
}

let alarmTex: THREE.Texture | null = null;
function alarmTexture() {
  if (alarmTex) return alarmTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d') as G;
  g.fillStyle = '#ff2030';
  g.beginPath();
  g.moveTo(32, 4);
  g.lineTo(60, 58);
  g.lineTo(4, 58);
  g.closePath();
  g.fill();
  g.fillStyle = '#fff';
  g.fillRect(28, 20, 8, 22);
  g.fillRect(28, 46, 8, 7);
  alarmTex = new THREE.CanvasTexture(c);
  alarmTex.colorSpace = THREE.SRGBColorSpace;
  return alarmTex;
}
