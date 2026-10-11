import type { HoloSpeaker, Speaker } from '../world/levelTypes';

export const ICON = {
  heart: (full: boolean) =>
    `<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.2C.8 8.4 2.9 4.5 6.7 4.5c2.2 0 3.6 1.2 5.3 3.1 1.7-1.9 3.1-3.1 5.3-3.1 3.8 0 5.9 3.9 4.3 7.3C19.5 16.4 12 21 12 21z" fill="${full ? '#ff4d6d' : 'rgba(0,0,0,0.45)'}" stroke="${full ? '#ffd0da' : 'rgba(255,255,255,0.35)'}" stroke-width="1.6"/>${full ? '<ellipse cx="8" cy="9" rx="2" ry="1.3" fill="#fff" opacity=".6"/>' : ''}</svg>`,
  bolt: `<svg viewBox="0 0 24 24"><polygon points="12,2 20.7,7 20.7,17 12,22 3.3,17 3.3,7" fill="#ffd166" stroke="#fff2c2" stroke-width="1.2"/><circle cx="12" cy="12" r="3.6" fill="#b87a10"/></svg>`,
  /** A page of Brennus's journal (chapter 2's collectible). */
  page: (got: boolean) =>
    `<svg viewBox="0 0 16 20"><path d="M2 1.5H11L14.5 5V18.5H2Z" fill="${got ? '#ffd166' : 'rgba(0,0,0,0.4)'}" stroke="${got ? '#fff2c2' : 'rgba(255,255,255,0.35)'}" stroke-width="1.2"/>${got ? '<path d="M4.5 8H12M4.5 11H12M4.5 14H10" stroke="#a8761a" stroke-width="1"/>' : ''}</svg>`,
  /** A Gardener light-stone (chapter 3's collectible): a smooth stone with a rainbow band. */
  stone: (got: boolean) =>
    `<svg viewBox="0 0 16 20"><defs><linearGradient id="istn" x1="0" x2="1"><stop offset="0" stop-color="#ff5e6a"/><stop offset=".25" stop-color="#ffd166"/><stop offset=".5" stop-color="#7dff9a"/><stop offset=".75" stop-color="#5ec8ff"/><stop offset="1" stop-color="#c37bff"/></linearGradient></defs><ellipse cx="8" cy="11" rx="6.6" ry="7.4" fill="${got ? '#f2efff' : 'rgba(0,0,0,0.4)'}" stroke="${got ? '#ffffff' : 'rgba(255,255,255,0.35)'}" stroke-width="1.2"/>${got ? '<path d="M1.8 11.6Q8 14.4 14.2 11.6" fill="none" stroke="url(#istn)" stroke-width="2.4"/><ellipse cx="5.6" cy="7" rx="1.6" ry="1" fill="#fff" opacity=".8"/>' : ''}</svg>`,
  shard: (got: boolean) =>
    `<svg viewBox="0 0 16 20"><polygon points="8,1 15,10 8,19 1,10" fill="${got ? '#ff6fcf' : 'rgba(0,0,0,0.4)'}" stroke="${got ? '#ffd6f2' : 'rgba(255,255,255,0.35)'}" stroke-width="1.3"/></svg>`,
  pause: `<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1.5" fill="#fff"/><rect x="14" y="5" width="4" height="14" rx="1.5" fill="#fff"/></svg>`,
  clock: `<svg viewBox="0 0 24 24"><rect x="9.5" y="1.5" width="5" height="2.6" rx="1" fill="currentColor"/><circle cx="12" cy="13.5" r="8" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 13.5V9M12 13.5l3 2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  jump: `<svg viewBox="0 0 24 24"><path d="M12 4l7 8h-4.5v8h-5v-8H5z" fill="#fff"/></svg>`,
  shoot: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="#fff"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  spin: `<svg viewBox="0 0 24 24"><path d="M12 4a8 8 0 1 1-7.4 5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><path d="M3 4l1.8 5.6L10 7.5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  dash: `<svg viewBox="0 0 24 24"><path d="M4 12h9M6 7h8M6 17h8" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M14 5l7 7-7 7z" fill="#fff"/></svg>`,
  cell: `<svg viewBox="0 0 24 24"><rect x="7" y="4" width="10" height="17" rx="2.5" fill="#3dff8a" stroke="#fff" stroke-width="1.5"/><rect x="10" y="2" width="4" height="3" rx="1" fill="#fff"/></svg>`,
  pulse: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.4" fill="#fff"/><circle cx="12" cy="12" r="6.6" fill="none" stroke="#fff" stroke-width="1.8" opacity=".8"/><path d="M3.6 8.2a9.4 9.4 0 0 0 0 7.6M20.4 8.2a9.4 9.4 0 0 1 0 7.6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".6"/></svg>`,
  energy: `<svg viewBox="0 0 24 24"><rect x="7" y="4" width="10" height="17" rx="2.5" fill="#b58cff" stroke="#fff" stroke-width="1.5"/><rect x="10" y="2" width="4" height="3" rx="1" fill="#fff"/><path d="M13 7l-3.4 5.4h2.6L11 17l3.4-5.6h-2.6z" fill="#fff"/></svg>`,
  close: `<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>`,
  mail: `<svg viewBox="0 0 24 24"><rect x="3" y="5.5" width="18" height="13" rx="2.5" fill="none" stroke="#fff" stroke-width="1.8"/><path d="M4 7l8 6 8-6" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
  info: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="#fff" stroke-width="1.8"/><path d="M12 11v6" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="7.6" r="1.4" fill="#fff"/></svg>`,
  sparkle: `<svg viewBox="0 0 24 24"><path d="M12 2.5l2.2 6.3 6.3 2.2-6.3 2.2L12 19.5l-2.2-6.3L3.5 11l6.3-2.2z" fill="#ffd166"/><path d="M19 15.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" fill="#fff"/></svg>`,
  globe: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="#fff" stroke-width="1.8"/><path d="M3 12h18M12 3c3 3.4 3 14.6 0 18M12 3c-3 3.4-3 14.6 0 18" fill="none" stroke="#fff" stroke-width="1.5"/></svg>`,
  lock: `<svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="2.5" fill="#9fb0d6"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="#9fb0d6" stroke-width="2.4"/></svg>`,
  star: `<svg viewBox="0 0 24 24"><polygon points="12,2 14.9,8.6 22,9.3 16.6,14 18.2,21 12,17.3 5.8,21 7.4,14 2,9.3 9.1,8.6" fill="#ffd166"/></svg>`,
  /** Armor Plating: a blue shield (dim when spent). */
  shield: (full = true) =>
    `<svg viewBox="0 0 24 24"><path d="M12 2.5l8 3v6c0 5-3.6 8.6-8 10-4.4-1.4-8-5-8-10v-6z" fill="${full ? '#5ec8ff' : 'rgba(0,0,0,0.45)'}" stroke="${full ? '#d6f3ff' : 'rgba(255,255,255,0.35)'}" stroke-width="1.6" stroke-linejoin="round"/>${full ? '<path d="M8 8.5h3.2v6.5" fill="none" stroke="#fff" stroke-width="1.6" opacity=".6" stroke-linecap="round"/>' : ''}</svg>`,
  grapple: `<svg viewBox="0 0 24 24"><circle cx="16" cy="8" r="4.2" fill="none" stroke="#7fe6ff" stroke-width="2.4"/><path d="M3 21l9.6-9.6" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="2.6 2.4"/></svg>`,
  /** Atalanta's buttons: BOW, KICK and SLIDE. */
  bow: `<svg viewBox="0 0 24 24"><path d="M7 2.5Q16 6 16 12T7 21.5" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M7 2.5V21.5" stroke="#8ff8e4" stroke-width="1.2"/><path d="M3 12H21M18 9l3 3-3 3" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  kick: `<svg viewBox="0 0 24 24"><path d="M12 4a8 8 0 1 1-7.4 5" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="3 2.4"/><path d="M8 17l5-5 4 1.5M13 12l-1-4" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  slide: `<svg viewBox="0 0 24 24"><path d="M3 19H21" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="17" cy="10.5" r="2.4" fill="#fff"/><path d="M5 16.5L12 15L15 12.5M12 15l-2-4" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 12h3M1 15h3" stroke="#8ff8e4" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  /** General Brennus's buttons: CANNON, SHIELD and CHARGE. */
  cannon: `<svg viewBox="0 0 24 24"><rect x="3" y="8.5" width="13" height="7" rx="2" fill="#c9a24a" stroke="#fff" stroke-width="1.6"/><rect x="15" y="9.8" width="4" height="4.4" rx="1" fill="#3a3028" stroke="#fff" stroke-width="1.3"/><circle cx="21.2" cy="12" r="1.8" fill="#ffb04a"/><path d="M6 8.5v7M10 8.5v7" stroke="#7a5a20" stroke-width="1.4"/></svg>`,
  guard: `<svg viewBox="0 0 24 24"><path d="M12 2.5l8 3.2v6.2c0 4.8-3.4 8.2-8 9.6-4.6-1.4-8-4.8-8-9.6V5.7z" fill="#4a5632" stroke="#ffd166" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="11.5" r="3.2" fill="none" stroke="#ff4a4a" stroke-width="2"/><circle cx="12" cy="11.5" r="1" fill="#ff4a4a"/></svg>`,
  charge: `<svg viewBox="0 0 24 24"><path d="M5 18c2-6 6-10 13-11" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="17" cy="8" r="3.4" fill="#ffb04a" stroke="#fff" stroke-width="1.5"/><path d="M2 12h4M3 16h4M4 20h4" stroke="#ffd166" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  /** The bronze mech's buttons: PUNCH (a big bronze fist) and THRUST (its back jets). */
  punch: `<svg viewBox="0 0 24 24"><rect x="5" y="7" width="12" height="11" rx="3" fill="#e0a040" stroke="#fff" stroke-width="1.8"/><path d="M8 7v4M11 7v4M14 7v4" stroke="#7a4a1a" stroke-width="1.4"/><rect x="2.5" y="10" width="4" height="6" rx="1.5" fill="#e0a040" stroke="#fff" stroke-width="1.5"/><path d="M19 9h3M19.5 12.5h3M19 16h3" stroke="#ffd166" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  thrust: `<svg viewBox="0 0 24 24"><rect x="8" y="3" width="8" height="10" rx="2.5" fill="#c8862e" stroke="#fff" stroke-width="1.6"/><path d="M9.5 13h5l-1 2h-3z" fill="#3a3230" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/><path d="M12 16c-2.5 2.5-1.5 4.5 0 6 1.5-1.5 2.5-3.5 0-6z" fill="#ffb04a" stroke="#ffd166" stroke-width="1.2"/></svg>`,
  /** The badge on the switch-hero button. */
  swap: `<svg viewBox="0 0 24 24"><path d="M5 9a7 7 0 0 1 12.5-3M19 15a7 7 0 0 1-12.5 3" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><path d="M18.5 2.5V7H14M5.5 21.5V17H10" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

/** A weapon's icon (shop, the weapon button). Each has its own shape and colour. */
export const WEAPON_ICON: Record<string, string> = {
  blaster: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="#bff4ff"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5" stroke="#5ee0ff" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  spread: `<svg viewBox="0 0 24 24"><circle cx="4.5" cy="12" r="2.6" fill="#fff2b0"/><path d="M8 12h12M8 10.5L19 4.5M8 13.5L19 19.5" stroke="#ffb020" stroke-width="2.4" stroke-linecap="round"/><circle cx="20" cy="12" r="1.8" fill="#fff"/><circle cx="19.5" cy="4.5" r="1.8" fill="#fff"/><circle cx="19.5" cy="19.5" r="1.8" fill="#fff"/></svg>`,
  frost: `<svg viewBox="0 0 24 24"><g stroke="#bfeeff" stroke-width="2.2" stroke-linecap="round"><path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6"/><path d="M9.6 4.2L12 6.6l2.4-2.4M9.6 19.8L12 17.4l2.4 2.4" fill="none"/></g><circle cx="12" cy="12" r="2.4" fill="#7fd4ff"/></svg>`,
  thunder: `<svg viewBox="0 0 24 24"><path d="M14 1.8L5 13.4h5.6L9 22.2l10-12.4h-5.8z" fill="#fff36a" stroke="#c58cff" stroke-width="1.4" stroke-linejoin="round"/></svg>`,
  seeker: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.2" fill="none" stroke="#ff7aa6" stroke-width="2"/><circle cx="12" cy="12" r="3.4" fill="#ff4f8a"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" stroke="#ffd0e0" stroke-width="2" stroke-linecap="round"/></svg>`,
  flame: `<svg viewBox="0 0 24 24"><path d="M12 1.8c1 3.6 6.6 6.2 6.6 12.2a6.6 6.6 0 0 1-13.2 0c0-3.3 1.9-5 3.2-6.6.3 1.9 1.1 3 2.2 3.4C10.2 7.6 10.9 4.4 12 1.8z" fill="#ff6a1a" stroke="#ffd08a" stroke-width="1.3" stroke-linejoin="round"/><path d="M12 11.6c.6 1.9 3.1 2.9 3.1 5.6a3.1 3.1 0 0 1-6.2 0c0-1.6.9-2.5 1.6-3.3.2.8.6 1.3 1 1.4-.3-1.5.1-2.7.5-3.7z" fill="#fff1c4"/></svg>`,
};

interface Person {
  id: string;
  skin: string;
  hair: string;
  iris: string;
  lips: string;
  /** Hair drawn behind the head (long hair, a bun). */
  back?: string;
  /** Hair drawn over the forehead. */
  front: string;
  /** Uniform colour for the shoulders; the collar and insignia are drawn over them. */
  suit: string;
  collar: string;
  /** Anything on top of everything else (a cap, a headset, age lines). */
  extra?: string;
}

const shade = (hex: string, f: number) => {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => c(v).toString(16).padStart(2, '0')).join('')}`;
};

/** The dark comms-screen backdrop every portrait sits on: a soft glow and scanlines. */
function screen(id: string, glow: string): string {
  return `<defs>
      <radialGradient id="${id}bg" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="${glow}" stop-opacity=".35"/><stop offset=".6" stop-color="#0b1426"/><stop offset="1" stop-color="#050912"/></radialGradient>
      <pattern id="${id}sl" width="4" height="3" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#000" opacity=".1"/></pattern>
    </defs>
    <rect width="80" height="80" fill="url(#${id}bg)"/>`;
}

/** Scanlines over the finished picture, and the corner brackets of the comms screen. */
const glass = (id: string, color: string) =>
  `<rect width="80" height="80" fill="url(#${id}sl)"/><path d="M4 14V4h10M66 4h10v10M76 66v10H66M14 76H4V66" fill="none" stroke="${color}" stroke-width="1.6" opacity=".7"/>`;

/** Everyone drawn by `person`, by their id, so their face can be drawn again on its own (for holograms). */
const PEOPLE = new Map<string, Person>();

/**
 * An illustrated portrait, lit from the upper left: a proper face shape and jaw, almond eyes under
 * lids, shaped brows, a nose and lips, and a uniform with its collar and insignia. A `bare` portrait
 * is just the head on a transparent background: no comms screen, shoulders or collar.
 */
function person(p: Person, bare = false): string {
  PEOPLE.set(p.id, p);
  const id = p.id;
  const skinHi = shade(p.skin, 1.12);
  const skinLo = shade(p.skin, 0.72);
  const brow = shade(p.hair, 0.85);
  const lid = (cx: number) => `M${cx - 4.6} 37.2Q${cx} 33.6 ${cx + 4.6} 37Q${cx} 39.6 ${cx - 4.6} 37.2Z`;
  const eye = (cx: number, n: number) => `
    <path d="${lid(cx)}" fill="#f2ede6"/>
    <clipPath id="${id}e${n}"><path d="${lid(cx)}"/></clipPath>
    <g clip-path="url(#${id}e${n})"><circle cx="${cx + 0.2}" cy="37.2" r="2.3" fill="${p.iris}"/><circle cx="${cx + 0.2}" cy="37.2" r="1.05" fill="#0d0a0c"/><path d="M${cx - 5} 35.2Q${cx} 33.4 ${cx + 5} 35.2V36.4Q${cx} 34.8 ${cx - 5} 36.4Z" fill="${skinLo}" opacity=".55"/></g>
    <circle cx="${cx - 0.6}" cy="36.4" r=".5" fill="#fff" opacity=".85"/>
    <path d="M${cx - 4.9} 37.1Q${cx} 33.1 ${cx + 4.9} 36.8" fill="none" stroke="#1d1310" stroke-width="1" stroke-linecap="round"/>
    <path d="M${cx - 3.5} 38.9Q${cx} 39.9 ${cx + 3.6} 38.6" fill="none" stroke="${skinLo}" stroke-width=".5" opacity=".7"/>`;
  return `<svg viewBox="0 0 80 80"${bare ? ' xmlns="http://www.w3.org/2000/svg"' : ''}>
    ${bare ? '' : screen(id, shade(p.suit, 1.3))}
    <defs>
      <linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${skinHi}"/><stop offset=".55" stop-color="${p.skin}"/><stop offset="1" stop-color="${skinLo}"/></linearGradient>
      <linearGradient id="${id}n" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(p.skin, 0.62)}"/><stop offset=".6" stop-color="${shade(p.skin, 0.85)}"/></linearGradient>
      <linearGradient id="${id}c" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${shade(p.suit, 1.25)}"/><stop offset="1" stop-color="${shade(p.suit, 0.62)}"/></linearGradient>
    </defs>
    ${p.back ?? ''}
    ${bare ? '' : `<path d="M8 81C9 68 20 62 32 60.5L48 60.5C60 62 71 68 72 81Z" fill="url(#${id}c)"/>`}
    ${bare ? '' : `<path d="M34.2 50H45.8L46.8 61.5Q40 64 33.2 61.5Z" fill="url(#${id}n)"/>`}
    ${bare ? '' : p.collar}
    <ellipse cx="24.8" cy="39.5" rx="2.6" ry="4.6" fill="${p.skin}"/><path d="M24.4 37.2Q23.2 39.5 24.8 42" fill="none" stroke="${skinLo}" stroke-width=".7"/>
    <ellipse cx="55.2" cy="39.5" rx="2.6" ry="4.6" fill="${skinLo}"/>
    <path d="M25.4 29C25.4 17.8 54.6 17.8 54.6 29C55.6 40.5 53.6 47.6 48.6 53.2C45.6 56.6 43 58 40 58C37 58 34.4 56.6 31.4 53.2C26.4 47.6 24.4 40.5 25.4 29Z" fill="url(#${id}s)"/>
    <path d="M48.8 27C54.2 35 53.8 46.5 45.4 56C49.6 48.4 50.8 37.4 48.8 27Z" fill="#000" opacity=".13"/>
    <path d="M28 44Q30 49.5 34 52.5" fill="none" stroke="${skinLo}" stroke-width=".6" opacity=".45"/>
    ${eye(33, 0)}${eye(47, 1)}
    <path d="M28.2 32.6Q32.4 30.2 37.6 31.8" fill="none" stroke="${brow}" stroke-width="1.9" stroke-linecap="round"/>
    <path d="M42.4 31.8Q47.6 30.2 51.8 32.6" fill="none" stroke="${brow}" stroke-width="1.9" stroke-linecap="round"/>
    <path d="M41 38.5Q41.9 42.6 42.6 45.2" fill="none" stroke="${skinLo}" stroke-width=".9" opacity=".6" stroke-linecap="round"/>
    <path d="M37.6 45.8Q38.6 47.3 40 47.2Q41.4 47.3 42.6 45.8" fill="none" stroke="${skinLo}" stroke-width="1" stroke-linecap="round"/>
    <ellipse cx="38.7" cy="46.3" rx=".8" ry=".45" fill="${shade(p.skin, 0.5)}" opacity=".6"/><ellipse cx="41.3" cy="46.3" rx=".8" ry=".45" fill="${shade(p.skin, 0.5)}" opacity=".6"/>
    <path d="M35.6 51.2Q38 50 40 50.7Q42 50 44.4 51.2Q40 51.9 35.6 51.2Z" fill="${shade(p.lips, 0.85)}"/>
    <path d="M36.2 51.4Q40 55 43.8 51.4Q40 52.3 36.2 51.4Z" fill="${p.lips}"/>
    <path d="M35.4 51.2Q40 52.6 44.6 51.1" fill="none" stroke="${shade(p.lips, 0.5)}" stroke-width=".8" stroke-linecap="round"/>
    <path d="M38.6 53.4Q40 54 41.4 53.4" fill="none" stroke="#fff" stroke-width=".5" opacity=".25"/>
    ${p.front}
    ${p.extra ?? ''}
    ${bare ? '' : glass(id, shade(p.suit, 1.6))}
  </svg>`;
}

/** A thin highlight along the top of a lock of hair. */
const shine = (d: string, color: string) => `<path d="${d}" fill="none" stroke="${shade(color, 1.9)}" stroke-width="1" opacity=".35" stroke-linecap="round"/>`;

const JASON_HAIR = '#3b2416';
const JASON = person({
  id: 'pk',
  skin: '#d6a07a',
  hair: JASON_HAIR,
  iris: '#5b3a1e',
  lips: '#b0685a',
  suit: '#e0782f',
  front: `<path d="M24.4 34C21.8 20.5 30 13.2 40.4 13.4C51.4 13.6 58.6 21 55.8 33.6C55 28.6 52.8 25.8 49.6 24.4C50 26.8 48.4 27.6 46.8 27C45 24.4 39.6 23 35.6 25.2C34.6 27.4 31.6 28.4 29.6 27.4C28.4 29.4 26.6 31.2 24.4 34Z" fill="${JASON_HAIR}"/>
    ${shine('M28 22Q34 15.5 44 16.4', JASON_HAIR)}${shine('M46 18.5Q52 21 54 26', JASON_HAIR)}`,
  collar: `<path d="M26 61.5Q40 70 54 61.5L57 64Q40 74 23 64Z" fill="#c9d1dc"/><path d="M23 64Q40 74 57 64" fill="none" stroke="#8a96a8" stroke-width="1.2"/>
    <rect x="44" y="68" width="10" height="5" rx="1" fill="#1b2330"/><rect x="45.2" y="69.2" width="3" height="2.6" rx=".5" fill="#5ee0ff"/>
    <path d="M14 72L22 66" stroke="#ffd166" stroke-width="2" opacity=".8"/>`,
  extra: `<path d="M24.2 36.5C23 30 25 24 29 21" fill="none" stroke="#2a3140" stroke-width="2.2" stroke-linecap="round"/>
    <rect x="21.6" y="35.5" width="4.4" height="7.5" rx="2" fill="#2a3140"/><path d="M23.8 43Q25 50 33.5 51" fill="none" stroke="#2a3140" stroke-width="1.1"/><circle cx="34" cy="51" r="1.1" fill="#5ee0ff"/>`,
});

const CAP_NAVY = '#1c2a4f';
const CAPTAIN = person({
  id: 'pc',
  skin: '#6f4631',
  hair: '#c9c9d2',
  iris: '#2e1d10',
  lips: '#7a4436',
  suit: CAP_NAVY,
  // Close-cropped grey hair showing at the temples, under the cap.
  front: `<path d="M25.4 35C24.6 30.4 25 27.6 26.8 26.6L29 27.4C27.4 29.4 26.4 31.8 25.4 35Z" fill="#c9c9d2"/><path d="M54.6 35C55.4 30.4 55 27.6 53.2 26.6L51 27.4C52.6 29.4 53.6 31.8 54.6 35Z" fill="#b4b4be"/>`,
  collar: `<path d="M30 60.5L40 70L50 60.5L55 62L40 76L25 62Z" fill="#0f1830"/><path d="M36.5 61L40 66L43.5 61" fill="#e6edf7"/>
    <path d="M12 70Q16 64 24 62.6" stroke="#ffd166" stroke-width="2.4"/><path d="M68 70Q64 64 56 62.6" stroke="#ffd166" stroke-width="2.4"/>
    <circle cx="24" cy="71" r="1.6" fill="#ffd166"/><circle cx="56" cy="71" r="1.6" fill="#ffd166"/><path d="M52 70l2-3 2 3-2 1.2z" fill="#ffd166"/>`,
  extra: `<path d="M22.6 24.6C22 13.4 58 13.4 57.4 24.6L57.4 26.6L22.6 26.6Z" fill="${CAP_NAVY}"/>
    <path d="M22.6 24.2H57.4V27.4H22.6Z" fill="#0f1830"/><path d="M22.6 25.2H57.4" stroke="#ffd166" stroke-width=".8"/>
    <path d="M24.4 27.2Q40 33.6 55.6 27.2L55.6 28.6Q40 35.4 24.4 28.6Z" fill="#0a1022"/>
    <path d="M36.6 19.2L40 16.4L43.4 19.2L42.2 22.8H37.8Z" fill="#ffd166"/><circle cx="40" cy="20" r="1.2" fill="${CAP_NAVY}"/>
    <path d="M27.6 38.6Q28.4 39.8 29.6 40.2M52.4 38.6Q51.6 39.8 50.4 40.2" fill="none" stroke="#3e2519" stroke-width=".5" opacity=".45"/>
    <path d="M36 47.8Q35.2 49.8 35.8 51.6M44 47.8Q44.8 49.8 44.2 51.6" fill="none" stroke="#3e2519" stroke-width=".55" opacity=".4"/>
    <path d="M27.4 42.6Q27.6 54.8 40 58.6Q52.4 54.8 52.6 42.6Q50.6 49.8 46.4 51.4Q43.6 49.2 40 49.4Q36.4 49.2 33.6 51.4Q29.4 49.8 27.4 42.6Z" fill="#c9c9d2"/>
    <path d="M33.8 49.2Q37 46.8 40 48Q43 46.8 46.2 49.2Q43 50.4 40 49.8Q37 50.4 33.8 49.2Z" fill="#b4b4be"/>
    <path d="M37 52.4Q40 53.8 43 52.4" fill="none" stroke="#7a4436" stroke-width=".9"/>`,
});

const ROSA_HAIR = '#23150e';
const ROSA = person({
  id: 'pr',
  skin: '#b8784e',
  hair: ROSA_HAIR,
  iris: '#3a2410',
  lips: '#8e3f3a',
  suit: '#7c1d27',
  back: `<circle cx="40" cy="12.4" r="6.6" fill="${ROSA_HAIR}"/><path d="M35.6 9Q40 6.4 44.4 9" fill="none" stroke="${shade(ROSA_HAIR, 2)}" stroke-width=".8" opacity=".4"/>`,
  front: `<path d="M24.2 35C21.8 20 31 14 40 14C49 14 58.2 20 55.8 35C54.2 27.4 50.4 22.4 42.4 21.8C36 21.6 32.4 23.4 30.4 25.6C28.2 28 26.4 31 24.2 35Z" fill="${ROSA_HAIR}"/>
    ${shine('M29 21Q35 16.4 44 16.6', ROSA_HAIR)}<path d="M42.4 21.8Q48 22.6 51 26" fill="none" stroke="${shade(ROSA_HAIR, 2)}" stroke-width=".8" opacity=".3"/>`,
  collar: `<path d="M27 61Q40 67 53 61L55 64Q40 71 25 64Z" fill="#4a0f16"/>
    <path d="M18 66L27 62L29 80H16Z" fill="#2a3140"/><path d="M62 66L53 62L51 80H64Z" fill="#2a3140"/>
    <path d="M55 67.5l3.6 1.6v3.4c0 2.2-1.6 3.6-3.6 4.2-2-.6-3.6-2-3.6-4.2v-3.4z" fill="#ffd166"/><path d="M55 70l.9 1.8 2 .2-1.5 1.3.5 2-1.9-1.1-1.9 1.1.5-2-1.5-1.3 2-.2z" fill="#7c1d27"/>`,
});

const COL_HAIR = '#5a3a22';
const COLONIST = person({
  id: 'pn',
  skin: '#e8bf9a',
  hair: COL_HAIR,
  iris: '#2a6a8a',
  lips: '#c07a70',
  suit: '#c9d6e6',
  back: `<path d="M22 64C16 44 18 15 40 14.4C62 15 64 44 58 64L52 61C54 49 54 34 51 27C46 24 34 24 29 27C26 34 26 49 28 61Z" fill="${COL_HAIR}"/>`,
  front: `<path d="M24.6 33C23.4 21 31 14.6 40 14.6C49 14.6 56.6 21 55.4 33C53.6 26.4 48 22.4 40 22.2C35 22.4 31.6 24 29 27C27.6 28.6 26 30.6 24.6 33Z" fill="${COL_HAIR}"/>
    ${shine('M29 21.6Q35 16.8 45 17.6', COL_HAIR)}`,
  collar: `<path d="M29 60.5L40 67L51 60.5L54 62.5L40 71L26 62.5Z" fill="#9fb2c8"/><rect x="50" y="68" width="9" height="5" rx="1" fill="#e8eef6" stroke="#9fb2c8" stroke-width=".6"/>`,
});

/** General Brennus: an old soldier with a peaked cap, a big grey moustache, a scar and a red monocle. */
const BREN_OLIVE = '#3a4426';
const BRENNUS = person({
  id: 'pg',
  skin: '#d4a284',
  hair: '#b8b8c2',
  iris: '#46586a',
  lips: '#9a5a50',
  suit: '#3e4a2a',
  front: `<path d="M25.4 35C24.6 30.4 25 27.6 26.8 26.6L29 27.4C27.4 29.4 26.4 31.8 25.4 35Z" fill="#c8c8d2"/><path d="M54.6 35C55.4 30.4 55 27.6 53.2 26.6L51 27.4C52.6 29.4 53.6 31.8 54.6 35Z" fill="#b0b0ba"/>`,
  collar: `<path d="M30 60.5L40 69L50 60.5L55 62L40 75L25 62Z" fill="#262e16"/>
    <path d="M27 61.6L32.4 60.6L33.4 64.2L28 65.2Z" fill="#8a1a22"/><path d="M53 61.6L47.6 60.6L46.6 64.2L52 65.2Z" fill="#8a1a22"/>
    <path d="M11 70Q15.6 63.6 24 62.4" stroke="#ffd166" stroke-width="2.8"/><path d="M69 70Q64.4 63.6 56 62.4" stroke="#ffd166" stroke-width="2.8"/>
    <rect x="44" y="68" width="3" height="5" fill="#ff3a4c"/><rect x="48" y="68" width="3" height="5" fill="#3fb6ff"/><rect x="52" y="68" width="3" height="5" fill="#ffd166"/>`,
  extra: `<path d="M21.6 24.6C21 12.6 59 12.6 58.4 24.6L58.4 26.8L21.6 26.8Z" fill="${BREN_OLIVE}"/>
    <path d="M21.6 24H58.4V27.4H21.6Z" fill="#8a1a22"/>
    <path d="M23.8 27.2Q40 34 56.2 27.2L56.2 28.8Q40 36 23.8 28.8Z" fill="#1a1e10"/>
    <circle cx="40" cy="19.4" r="3.2" fill="#ffd166"/><circle cx="40" cy="19.4" r="1.4" fill="#8a1a22"/><path d="M37.6 16.4L42.4 22.4" stroke="#8a1a22" stroke-width=".8"/>
    <path d="M30.2 29.6L35.2 43" fill="none" stroke="#9a5848" stroke-width="1.1" opacity=".75"/>
    <path d="M32.6 48.4Q36.2 45.8 40 47.8Q43.8 45.8 47.4 48.4Q49.6 50.8 46.4 50.6Q43 49.4 40 50.4Q37 49.4 33.6 50.6Q30.4 50.8 32.6 48.4Z" fill="#cfcfd8"/>
    <path d="M28.4 43Q29.4 47.2 32 49.4M51.6 43Q50.6 47.2 48 49.4" fill="none" stroke="#7a4e3a" stroke-width=".6" opacity=".5"/>
    <circle cx="47" cy="37.2" r="5.6" fill="#ff3a4c" opacity=".22"/><circle cx="47" cy="37.2" r="5.6" fill="none" stroke="#d8b050" stroke-width="1.3"/>
    <circle cx="47" cy="37.2" r="1.3" fill="#ff3a4c"/><path d="M52.4 38.6Q55 46 52 54" fill="none" stroke="#d8b050" stroke-width=".7"/>`,
});

/** Dr. Hypatia: the colony's chief scientist, with her hair up, round glasses and a lab coat. */
const HYP_HAIR = '#1c1410';
const HYPATIA = person({
  id: 'ph',
  skin: '#c8906c',
  hair: HYP_HAIR,
  iris: '#2a1a10',
  lips: '#a0524e',
  suit: '#e8edf2',
  back: `<circle cx="40" cy="12.6" r="7" fill="${HYP_HAIR}"/><path d="M34.8 12Q40 8 45.2 12" fill="none" stroke="${shade(HYP_HAIR, 2.2)}" stroke-width=".8" opacity=".4"/><path d="M45 8L49 5" stroke="#d8b050" stroke-width="1.2" stroke-linecap="round"/>`,
  front: `<path d="M24.2 35C21.8 20 31 14 40 14C49 14 58.2 20 55.8 35C54.6 27 50.6 22.2 41 21.8C35 22 31.6 23.6 29.8 25.8C27.6 28.2 26 31.2 24.2 35Z" fill="${HYP_HAIR}"/>
    ${shine('M29 21Q35 16.4 44 16.6', HYP_HAIR)}`,
  collar: `<path d="M35 60.5L40 68L45 60.5Z" fill="#3a6ab0"/>
    <path d="M32.6 60.4L38.4 70.4L35.2 76L28.4 62.8Z" fill="#d6dee8"/><path d="M47.4 60.4L41.6 70.4L44.8 76L51.6 62.8Z" fill="#d6dee8"/>
    <rect x="50.6" y="67.4" width="1.6" height="6.4" rx=".6" fill="#3fb6ff"/><rect x="53" y="67.8" width="1.4" height="6" rx=".6" fill="#ff6fcf"/>
    <rect x="22" y="68.6" width="8" height="5.4" rx="1" fill="#ffffff" stroke="#9fb2c8" stroke-width=".5"/><rect x="23.2" y="69.8" width="2.6" height="3" fill="#7fb8e8"/>`,
  extra: `<g fill="none" stroke="#2e2420" stroke-width="1.1"><circle cx="33" cy="37.4" r="5.4"/><circle cx="47" cy="37.4" r="5.4"/><path d="M38.4 36.8Q40 35.6 41.6 36.8M27.6 36.4L24.8 35.4M52.4 36.4L55.2 35.4"/></g>
    <path d="M29.6 34.6Q31 33.4 32.6 33.6M43.6 34.6Q45 33.4 46.6 33.6" fill="none" stroke="#ffffff" stroke-width=".7" opacity=".5"/>`,
});

/** Aeëtes: slicked-back silver hair, a gold-rimmed eyepatch screen, a too-wide smile and a high gold collar. */
const AEETES = person({
  id: 'pa',
  skin: '#e8c0a0',
  hair: '#d8dce8',
  iris: '#3a5a7a',
  lips: '#a0505a',
  suit: '#e2b23c',
  front: `<path d="M24.6 33C22.6 19 31 14.4 40 14.4C49.4 14.4 57.6 19 55.4 33C54.8 26 51 22.4 40 22C31 22.2 26.4 25.2 24.6 33Z" fill="#d8dce8"/>
    <path d="M28 22Q38 17 52 21M27 26Q38 20.6 53 25" fill="none" stroke="#ffffff" stroke-width=".9" opacity=".7"/><path d="M30 19.4Q40 16 50 18.6" fill="none" stroke="#9aa0b4" stroke-width=".6"/>`,
  collar: `<path d="M26 60L33 56L40 66L47 56L54 60L50 68L40 72L30 68Z" fill="#5a1a4a"/>
    <path d="M24 61L32 52L37 64L30 74Z" fill="#f6d27a"/><path d="M56 61L48 52L43 64L50 74Z" fill="#c89a2a"/>
    <path d="M34 70Q40 74 46 70" fill="none" stroke="#fff2b0" stroke-width="1.2"/><circle cx="40" cy="72.6" r="2" fill="#fff2b0"/>`,
  extra: `<rect x="41" y="31.6" width="12.4" height="11" rx="3" fill="#12202e" stroke="#ffd166" stroke-width="1.4"/>
    <path d="M42.6 39.6L45 37.6L47 39L51.4 34.4" fill="none" stroke="#7dff9a" stroke-width=".9" stroke-linecap="round"/>
    <path d="M41 34L25.6 30.6M53.4 34L55.4 33" stroke="#3a2a20" stroke-width=".8"/>
    <path d="M31.6 49.6Q40 58.4 49.6 49.2Q40 53.2 31.6 49.6Z" fill="#6a1e2a"/><path d="M33 50.2Q40 53.8 48.2 49.8L47.6 51.4Q40 55.2 33.6 51.6Z" fill="#ffffff"/>
    <path d="M30.6 48.4Q31 50.4 32.4 50.8M50.6 48Q50.4 50 49 50.6" fill="none" stroke="#7a4e3a" stroke-width=".6"/>`,
});

/**
 * Atalanta: the colony's scout, about 13. Warm light-brown skin, green eyes, dark auburn hair with a
 * side-swept fringe and a long braid over her shoulder, a light visor band, a teal-and-white suit and
 * the gold strap of her bow across her chest.
 */
const ATA_HAIR = '#6a2618';
const ATALANTA = person({
  id: 'pt',
  skin: '#c68a5e',
  hair: ATA_HAIR,
  iris: '#3f9a4a',
  lips: '#a8604e',
  suit: '#2fb7a3',
  back: `<path d="M23 54C17 38 19 15 40 14C61 15 63 38 57 54L53 51C54 40 54 30 51 26C46 23 34 23 29 26C26 30 26 40 27 51Z" fill="${ATA_HAIR}"/>`,
  front: `<path d="M24.4 35C22 21 30 13.6 40.4 13.6C51 13.6 58.4 20.6 55.8 34C55 28 53 25.2 50 24C44 24.6 37 23.4 31.6 26.8C29 28.6 26.6 31.4 24.4 35Z" fill="${ATA_HAIR}"/>
    ${shine('M28.6 21.6Q35 15.8 45 16.8', ATA_HAIR)}`,
  collar: `<path d="M26 61Q40 68 54 61L57 64Q40 73 23 64Z" fill="#eef3f6"/><path d="M23 64Q40 73 57 64" fill="none" stroke="#ffc94a" stroke-width="1.2"/>
    <path d="M16 80L52 61.5" stroke="#ffc94a" stroke-width="2.4"/><circle cx="31" cy="73" r="1.6" fill="#8ff8e4"/>`,
  extra: `<path d="M24.8 27.6Q40 21.6 55.2 27.6L55 30.6Q40 25 25 30.6Z" fill="#eef3f6"/><path d="M31 26.8Q40 23.8 49 26.8L48.8 28.6Q40 26 31.2 28.6Z" fill="#8ff8e4" opacity=".9"/>
    ${[0, 1, 2, 3, 4, 5].map((i) => `<ellipse cx="${55.5 + i * 0.9}" cy="${47 + i * 5.2}" rx="${(3.8 - i * 0.25).toFixed(2)}" ry="3.3" fill="${ATA_HAIR}" stroke="${shade(ATA_HAIR, 0.6)}" stroke-width=".7"/>`).join('')}
    <rect x="58.2" y="74" width="5" height="2.4" rx=".8" fill="#ffc94a"/>`,
});
/** Phineus, the blind old astronomer of the Harpy Isles: round dark glasses, a cloud of white beard, a starry robe. */
const PHIN_WHITE = '#eef0f6';
const PHINEUS = person({
  id: 'pp',
  skin: '#c4916e',
  hair: '#d8dae2',
  iris: '#3a2a20',
  lips: '#9a5a48',
  suit: '#2e2a6e',
  back: `<path d="M22 44C18 34 20 26 25 24L27 34Z" fill="${PHIN_WHITE}"/><path d="M58 44C62 34 60 26 55 24L53 34Z" fill="${PHIN_WHITE}"/>`,
  front: `<path d="M24.6 36C23 30 24 26 27 24.6L29.4 27C27.6 29.6 26 32.4 24.6 36Z" fill="${PHIN_WHITE}"/><path d="M55.4 36C57 30 56 26 53 24.6L50.6 27C52.4 29.6 54 32.4 55.4 36Z" fill="${PHIN_WHITE}"/>
    ${shine('M30 21.4Q40 17.6 50 21.4', '#c4916e')}`,
  collar: `<path d="M28 60.5Q40 66 52 60.5L56 63Q40 70 24 63Z" fill="#1e1a52"/>
    <path d="M18 72l1.4-2.6 1.4 2.6-2.8-1.6h2.8z" fill="#ffd166"/><path d="M60 68l1.2-2.2 1.2 2.2-2.4-1.4h2.4z" fill="#ffd166"/><circle cx="66" cy="75" r="1.1" fill="#ffd166"/><circle cx="14" cy="77" r="1" fill="#ffd166"/>`,
  extra: `<circle cx="33" cy="37.4" r="5.4" fill="#16141e" stroke="#8a7a5a" stroke-width="1"/><circle cx="47" cy="37.4" r="5.4" fill="#16141e" stroke="#8a7a5a" stroke-width="1"/>
    <path d="M38.4 37H41.6" stroke="#8a7a5a" stroke-width="1.1"/><path d="M27.6 36.6L25 35.6M52.4 36.6L55 35.6" stroke="#8a7a5a" stroke-width="1"/>
    <ellipse cx="31.4" cy="35.6" rx="1.6" ry=".9" fill="#fff" opacity=".45"/><ellipse cx="45.4" cy="35.6" rx="1.6" ry=".9" fill="#fff" opacity=".45"/>
    <path d="M28.2 31.2Q32.4 28.6 37.6 30.4M42.4 30.4Q47.6 28.6 51.8 31.2" fill="none" stroke="${PHIN_WHITE}" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M26 44Q24 60 32 70Q36 76 40 78Q44 76 48 70Q56 60 54 44Q51 50 46.6 51.6Q43.6 49.4 40 49.6Q36.4 49.4 33.4 51.6Q29 50 26 44Z" fill="${PHIN_WHITE}"/>
    <path d="M33 49.4Q36.8 46.2 40 47.6Q43.2 46.2 47 49.4Q43.2 51 40 50.2Q36.8 51 33 49.4Z" fill="#dcdee6"/>
    <path d="M36.4 52.2Q40 54.6 43.6 52.2" fill="none" stroke="#9a5a48" stroke-width="1"/>
    <path d="M34 58Q36 64 38 68M46 58Q44 64 42 68M40 56V72" fill="none" stroke="#c8cad4" stroke-width=".7" opacity=".8"/>`,
});

/** IRIS: a pearl teardrop with a dark visor, a rainbow eye, little fins and a golden halo. */
const IRIS = `<svg viewBox="0 0 80 80">
    ${screen('pi', '#c9a8ff')}
    <defs>
      <radialGradient id="piS" cx="38%" cy="28%" r="80%"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#e6e4f6"/><stop offset="1" stop-color="#9c92c4"/></radialGradient>
      <linearGradient id="piR" x1="0" x2="1"><stop offset="0" stop-color="#ff5e6a"/><stop offset=".2" stop-color="#ffb347"/><stop offset=".4" stop-color="#ffe066"/><stop offset=".6" stop-color="#7dff9a"/><stop offset=".8" stop-color="#5ec8ff"/><stop offset="1" stop-color="#c37bff"/></linearGradient>
    </defs>
    <ellipse cx="40" cy="12" rx="9" ry="3" fill="none" stroke="#ffd166" stroke-width="2.2"/><ellipse cx="40" cy="12" rx="12" ry="5" fill="#ffd166" opacity=".18"/>
    <path d="M40 15V22" stroke="#b9a8e8" stroke-width="1.6"/>
    <path d="M17 44Q6 40 4 50Q12 52 19 50Z" fill="#b9a8e8" stroke="#8a7cc0" stroke-width=".8"/><path d="M63 44Q74 40 76 50Q68 52 61 50Z" fill="#b9a8e8" stroke="#8a7cc0" stroke-width=".8"/>
    <path d="M40 21C55 21 63 32 63 45C63 58 52 68 40 77C28 68 17 58 17 45C17 32 25 21 40 21Z" fill="url(#piS)"/>
    <path d="M18 52Q40 60 62 52" fill="none" stroke="#b9a8e8" stroke-width="2"/>
    <rect x="20" y="34" width="40" height="14" rx="7" fill="#141428"/>
    <rect x="25" y="38" width="30" height="6" rx="3" fill="url(#piR)"/><rect x="25" y="38" width="30" height="6" rx="3" fill="#fff" opacity=".18"/>
    <circle cx="29" cy="39.4" r="1.2" fill="#fff" opacity=".9"/>
    <ellipse cx="31" cy="27" rx="5" ry="2.4" fill="#fff" opacity=".7" transform="rotate(-20 31 27)"/>
    ${glass('pi', '#c9a8ff')}
  </svg>`;

/** LUX with Brennus's control chip on: red eye, dark spiky armour, glitchy scanlines. */
const ROGUE = `<svg viewBox="0 0 80 80">
    ${screen('pr', '#ff3a4c')}
    <defs>
      <radialGradient id="prS" cx="36%" cy="30%" r="78%"><stop offset="0" stop-color="#e8e8ee"/><stop offset=".55" stop-color="#b4b4c2"/><stop offset="1" stop-color="#5e5a6c"/></radialGradient>
      <radialGradient id="prI" cx="42%" cy="40%" r="62%"><stop offset="0" stop-color="#fff0f0"/><stop offset=".35" stop-color="#ff7a86"/><stop offset=".8" stop-color="#d61a2e"/><stop offset="1" stop-color="#5a0610"/></radialGradient>
    </defs>
    <path d="M48 22L53 8" stroke="#6a6478" stroke-width="2" stroke-linecap="round"/><circle cx="53.4" cy="7.6" r="3.2" fill="#ff2a3a"/>
    <path d="M14 47L2 40L10 52ZM66 47L78 40L70 52ZM24 26L16 12L30 22ZM56 26L64 12L50 22Z" fill="#2a1e26" stroke="#a8202a" stroke-width="1"/>
    <circle cx="40" cy="44" r="24.5" fill="url(#prS)"/>
    <path d="M17 49Q40 58 63 49L63 55Q40 64 17 55Z" fill="#2a1e26" stroke="#a8202a" stroke-width="1"/>
    <path d="M24 24Q40 15 56 24L54 29Q40 22 26 29Z" fill="#2a1e26" stroke="#a8202a" stroke-width="1"/>
    <circle cx="40" cy="41" r="13" fill="#140608"/>
    <circle cx="40" cy="41" r="8.6" fill="url(#prI)"/>
    <path d="M33 37L47 37" stroke="#140608" stroke-width="2.4"/>
    <circle cx="40" cy="42" r="2.6" fill="#ffe0e4"/>
    <path d="M6 30h22v2.4H6zM50 60h24v2H50z" fill="#ff3a4c" opacity=".45"/>
    ${glass('pr', '#ff3a4c')}
  </svg>`;

/** MEDUSA, Aeëtes's security AI: a gold mask with one great green eye and a crown of cable snakes. */
const MEDUSA = `<svg viewBox="0 0 80 80">
    ${screen('pm', '#7dff9a')}
    <defs>
      <radialGradient id="pmG" cx="40%" cy="30%" r="80%"><stop offset="0" stop-color="#fff2b8"/><stop offset=".5" stop-color="#f0c25a"/><stop offset="1" stop-color="#9a6a1a"/></radialGradient>
      <radialGradient id="pmI" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#e6ffe8"/><stop offset=".45" stop-color="#5dff9a"/><stop offset="1" stop-color="#0e6a32"/></radialGradient>
    </defs>
    <g fill="none" stroke="#e8b84a" stroke-width="4.4" stroke-linecap="round">
      <path d="M22 30Q10 24 14 12"/><path d="M30 22Q24 10 32 4"/><path d="M50 22Q56 10 48 4"/><path d="M58 30Q70 24 66 12"/><path d="M18 42Q6 44 4 34"/><path d="M62 42Q74 44 76 34"/>
    </g>
    <g fill="#e8b84a" stroke="#6a4a10" stroke-width=".8">
      <ellipse cx="14" cy="12" rx="4" ry="3"/><ellipse cx="32" cy="4.5" rx="3.6" ry="3"/><ellipse cx="48" cy="4.5" rx="3.6" ry="3"/><ellipse cx="66" cy="12" rx="4" ry="3"/><ellipse cx="4.5" cy="34" rx="3.4" ry="3"/><ellipse cx="75.5" cy="34" rx="3.4" ry="3"/>
    </g>
    <g fill="#7dff9a"><circle cx="13" cy="11" r="1"/><circle cx="31" cy="3.6" r=".9"/><circle cx="49" cy="3.6" r=".9"/><circle cx="67" cy="11" r="1"/><circle cx="4" cy="33" r=".9"/><circle cx="76" cy="33" r=".9"/></g>
    <path d="M40 20C55 20 63 32 62 46C61 60 52 72 40 74C28 72 19 60 18 46C17 32 25 20 40 20Z" fill="url(#pmG)" stroke="#8a5a10" stroke-width="1.2"/>
    <path d="M24 34Q32 28 38 31M42 31Q48 28 56 34" fill="none" stroke="#8a5a10" stroke-width="2.2" stroke-linecap="round"/>
    <ellipse cx="40" cy="44" rx="11" ry="8.4" fill="#f2fbf4" stroke="#8a5a10" stroke-width="1.2"/>
    <circle cx="40" cy="44" r="6.4" fill="url(#pmI)"/>
    <rect x="38.9" y="39.4" width="2.2" height="9.2" rx="1.1" fill="#08140c"/>
    <circle cx="37.6" cy="41.8" r="1.3" fill="#fff"/>
    <circle cx="25.6" cy="52" r="1.8" fill="#7dff9a"/><circle cx="54.4" cy="52" r="1.8" fill="#7dff9a"/>
    <path d="M34 62Q40 65 46 62" fill="none" stroke="#8a5a10" stroke-width="1.6" stroke-linecap="round"/>
    ${glass('pm', '#7dff9a')}
  </svg>`;

/** Jason's wrist computer, the face on the action button while no droid is around. */
export const WRIST_FACE = `<svg viewBox="0 0 80 80">
    <rect x="8" y="22" width="64" height="36" rx="10" fill="#3a4458" stroke="#cfd6e2" stroke-width="2.4"/>
    <rect x="16" y="28" width="48" height="24" rx="5" fill="#0c131e"/>
    <path d="M20 40h8l4 -8 6 16 5 -12 3 4h14" fill="none" stroke="#7dff9a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="2" y="30" width="8" height="20" rx="3" fill="#5a6274"/><rect x="70" y="30" width="8" height="20" rx="3" fill="#5a6274"/>
  </svg>`;

const FACES: Record<Exclude<Speaker, 'celestia'>, string> = {
  jason: JASON,
  aeetes: AEETES,
  atalanta: ATALANTA,
  phineus: PHINEUS,
  brennus: BRENNUS,
  hypatia: HYPATIA,
  bolt: `<svg viewBox="0 0 80 80">
    ${screen('pb', '#5ee0ff')}
    <defs>
      <radialGradient id="pbS" cx="36%" cy="30%" r="78%"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#d4dbe6"/><stop offset="1" stop-color="#7d889c"/></radialGradient>
      <radialGradient id="pbI" cx="42%" cy="40%" r="62%"><stop offset="0" stop-color="#f0feff"/><stop offset=".35" stop-color="#7fe9ff"/><stop offset=".8" stop-color="#1f86d6"/><stop offset="1" stop-color="#0b3c70"/></radialGradient>
      <radialGradient id="pbP" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#9aa6ba"/><stop offset="1" stop-color="#4a5468"/></radialGradient>
    </defs>
    <path d="M48 22L53 8" stroke="#8a96ac" stroke-width="2" stroke-linecap="round"/><circle cx="53.4" cy="7.6" r="3.2" fill="#ff5e6a"/><circle cx="53.4" cy="7.6" r="6" fill="#ff5e6a" opacity=".2"/>
    <circle cx="14.5" cy="47" r="6" fill="url(#pbP)"/><circle cx="65.5" cy="47" r="6" fill="url(#pbP)"/>
    <path d="M11.5 45.4h6M11.5 48.6h6M62.5 45.4h6M62.5 48.6h6" stroke="#2a3140" stroke-width="1"/>
    <circle cx="40" cy="44" r="24.5" fill="url(#pbS)"/>
    <path d="M17.6 50Q40 58 62.4 50L62 54Q40 62.4 18 54Z" fill="#7b8699"/><path d="M18 54Q40 62.4 62 54" fill="none" stroke="#5a6478" stroke-width=".8"/>
    <path d="M24 26Q40 17 56 26" fill="none" stroke="#9aa6ba" stroke-width=".7"/><path d="M40 19.6V28" stroke="#9aa6ba" stroke-width=".7"/>
    <circle cx="40" cy="41" r="13" fill="#0c131e"/><circle cx="40" cy="41" r="11.2" fill="none" stroke="#2c3b52" stroke-width="1.4"/>
    <circle cx="40" cy="41" r="8.6" fill="url(#pbI)"/>
    <circle cx="40" cy="41" r="8.6" fill="none" stroke="#bff4ff" stroke-width=".6" stroke-dasharray="2 1.4" opacity=".6"/>
    <circle cx="40" cy="41" r="3.2" fill="#062536"/><circle cx="40" cy="41" r="1.4" fill="#5ee0ff"/>
    <ellipse cx="36.4" cy="37.2" rx="2.4" ry="1.5" fill="#fff" opacity=".85" transform="rotate(-30 36.4 37.2)"/>
    <path d="M58 58Q63 52 64 45" fill="none" stroke="#bff4ff" stroke-width="1.2" opacity=".5" stroke-linecap="round"/>
    ${glass('pb', '#7fe6ff')}
  </svg>`,
  halcyon: `<svg viewBox="0 0 80 80">
    ${screen('ph', '#ff7a3a')}
    <defs><radialGradient id="phI" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff2e0"/><stop offset=".3" stop-color="#ffb070"/><stop offset=".75" stop-color="#ff6a2a"/><stop offset="1" stop-color="#6a1c08"/></radialGradient></defs>
    <circle cx="40" cy="40" r="29" fill="#120708" stroke="#3a1a12" stroke-width="1.5"/>
    <circle cx="40" cy="40" r="25" fill="none" stroke="#ff7a3a" stroke-width="2.4" stroke-dasharray="10 3" opacity=".85"/>
    <circle cx="40" cy="40" r="20.5" fill="none" stroke="#ff7a3a" stroke-width=".8" stroke-dasharray="1 2.2" opacity=".7"/>
    <circle cx="40" cy="40" r="15" fill="url(#phI)"/>
    <circle cx="40" cy="40" r="15" fill="none" stroke="#ffd0a8" stroke-width=".6"/>
    <circle cx="40" cy="40" r="5" fill="#fff6ea"/>
    <path d="M40 8v5M40 67v5M8 40h5M67 40h5" stroke="#ff9a5a" stroke-width="1.4"/>
    ${glass('ph', '#ff9a5a')}
  </svg>`,
  glitch: `<svg viewBox="0 0 80 80">
    ${screen('pg', '#ff4fd8')}
    <circle cx="40" cy="40" r="29" fill="#14060f"/>
    <circle cx="40" cy="40" r="25" fill="none" stroke="#ff4fd8" stroke-width="2.4" stroke-dasharray="9 5"/>
    <circle cx="43" cy="38" r="14" fill="#ff4fd8" opacity=".85"/><circle cx="37" cy="42" r="14" fill="#5ee0ff" opacity=".4"/>
    <circle cx="40" cy="40" r="4.6" fill="#ffe0f4"/>
    <path d="M6 30h30v3H6zM46 50h28v2.4H46zM14 58h18v1.6H14z" fill="#ff4fd8" opacity=".55"/>
    <path d="M18 30l14 6-6 4 12 8" stroke="#ffe0f4" stroke-width="1.6" fill="none"/>
    ${glass('pg', '#ff4fd8')}
  </svg>`,
  iris: IRIS,
  rogue: ROGUE,
  medusa: MEDUSA,
  colonist: COLONIST,
  captain: CAPTAIN,
  rosa: ROSA,
  vendy: `<svg viewBox="0 0 80 80">
    ${screen('pv', '#ff5fc8')}
    <rect x="14" y="8" width="52" height="68" rx="6" fill="#262b38"/><rect x="11.6" y="10" width="2.6" height="64" rx="1" fill="#c0368f"/><rect x="65.8" y="10" width="2.6" height="64" rx="1" fill="#c0368f"/>
    <rect x="18" y="12" width="44" height="11" rx="2" fill="#16060f"/><text x="40" y="20.6" text-anchor="middle" font-family="Orbitron, sans-serif" font-weight="800" font-size="7" textLength="40" lengthAdjust="spacingAndGlyphs" fill="#ffd0ee">PANDORA</text>
    <rect x="18" y="27" width="44" height="32" rx="3" fill="#1a0616" stroke="#ff6fcf" stroke-width="1"/>
    <rect x="28" y="34" width="6" height="11" rx="3" fill="#ffb0e6"/><rect x="46" y="34" width="6" height="11" rx="3" fill="#ffb0e6"/>
    <path d="M32 49Q40 55.6 48 49" fill="none" stroke="#ffb0e6" stroke-width="2.6" stroke-linecap="round"/>
    <rect x="22" y="63" width="36" height="7" rx="2" fill="#0e1118" stroke="#cfd6e2" stroke-width=".8"/>
    ${glass('pv', '#ff9ae0')}
  </svg>`,
  gascu: `<svg viewBox="0 0 80 80">
    ${screen('pl', '#ff6fcf')}
    <defs><radialGradient id="plC" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#ffd6f2"/><stop offset="1" stop-color="#ff5fc8"/></radialGradient></defs>
    <path d="M10 70Q22 58 30 56M70 72Q58 60 50 57M16 16Q26 26 32 30" fill="none" stroke="#8a2f75" stroke-width="2" stroke-linecap="round" opacity=".7"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7]
      .map((i) => {
        const a = (i / 8) * 360;
        const c = ['#5e9bff', '#ffd166', '#ff6fcf', '#7dff9a'][i % 4];
        return `<path d="M40 40C35 32 36 21 40 15C44 21 45 32 40 40Z" fill="${c}" opacity=".9" transform="rotate(${a} 40 40)"/><path d="M40 38C38.6 31 39 23 40 18" fill="none" stroke="#fff" stroke-width=".6" opacity=".45" transform="rotate(${a} 40 40)"/>`;
      })
      .join('')}
    <circle cx="40" cy="40" r="9" fill="url(#plC)"/><circle cx="40" cy="40" r="15" fill="#ff6fcf" opacity=".12"/>
    ${glass('pl', '#ff9ae0')}
  </svg>`,
};

/** On Gaia Nova, GaScu goes by its real name, Celestia. */
export const PORTRAIT: Record<Speaker, string> = { ...FACES, celestia: FACES.gascu };

export const SPEAKER_NAME: Record<Speaker, string> = {
  jason: 'Jason',
  atalanta: 'Atalanta',
  bolt: 'LUX',
  halcyon: 'HALCYON',
  glitch: 'HALCYON?!',
  iris: 'IRIS',
  rogue: 'LUX?!',
  medusa: 'MEDUSA',
  colonist: 'Colonist',
  captain: 'Captain Argus',
  rosa: 'Aunt Rosa',
  vendy: 'Pandora',
  gascu: 'GaScu',
  celestia: 'Celestia',
  brennus: 'General Brennus',
  hypatia: 'Dr. Hypatia',
  aeetes: 'Aeëtes',
  phineus: 'Phineus',
};

export const SPEAKER_COLOR: Record<Speaker, string> = {
  jason: '#ffb07a',
  atalanta: '#5fe0c8',
  bolt: '#7fe6ff',
  halcyon: '#ff8a6a',
  glitch: '#ff4fd8',
  iris: '#c9a8ff',
  rogue: '#ff3a4c',
  medusa: '#7dff9a',
  colonist: '#ffd166',
  captain: '#ffd166',
  rosa: '#ff8a8a',
  vendy: '#ff9ae0',
  gascu: '#ff6fcf',
  celestia: '#ff6fcf',
  brennus: '#ff6a5a',
  hypatia: '#9adfff',
  aeetes: '#ffd166',
  phineus: '#c9b8ff',
};

/** Which portrait each hologram speaker uses (their `person` id). */
const HOLO_PERSON: Record<HoloSpeaker, string> = { captain: 'pc', rosa: 'pr', brennus: 'pg', hypatia: 'ph', aeetes: 'pa', atalanta: 'pt' };

/**
 * A hologram speaker's head on its own, as a standalone SVG document (80 by 80, the face centred
 * at x = 40, the chin at y = 58), with their skin colour so the hologram can light the face evenly.
 */
export function holoFaceArt(who: HoloSpeaker): { svg: string; skin: string } {
  const p = PEOPLE.get(HOLO_PERSON[who]) as Person;
  return { svg: person(p, true), skin: p.skin };
}

let portraitCopies = 0;

/**
 * A portrait ready to insert into the page. Each copy gets its own gradient and clip ids: the same
 * face can be on screen several times at once, and an id inside a hidden copy would break the rest.
 */
export function portrait(who: Speaker): string {
  const k = `_${(portraitCopies += 1)}`;
  return PORTRAIT[who].replace(/id="([^"]+)"/g, `id="$1${k}"`).replace(/url\(#([^)]+)\)/g, `url(#$1${k})`);
}
