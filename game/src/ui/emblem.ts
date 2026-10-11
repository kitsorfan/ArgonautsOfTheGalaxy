/**
 * The game's brand art, drawn as SVG: LUX (`luxArt`), and the emblem (`emblemSvg`), LUX inside a glowing
 * ring wrapped in GaScu's pink vine. The emblem is on the boot splash and the About screen; the app icon,
 * the Android icon layers and the native splash image are rendered from the same drawings by
 * game/tools/icons.ts (npm run gen:icons).
 */

/**
 * LUX in a 200×200 box, his body centred at (100,106): a glossy white sphere with ear pods, a big glowing
 * eye, a gold star on his band (unless `star` is false) and a red antenna light (class `lux-tip`). `p`
 * prefixes the gradient ids, so several copies can share a page.
 */
export function luxArt(p = 'lx', star = true): string {
  return `<defs>
    <radialGradient id="${p}body" cx="36%" cy="28%" r="80%"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#e3eaf4"/><stop offset=".8" stop-color="#a7b4ca"/><stop offset="1" stop-color="#6f7d98"/></radialGradient>
    <radialGradient id="${p}rim" cx="72%" cy="80%" r="60%"><stop offset=".55" stop-color="#5ee0ff" stop-opacity="0"/><stop offset="1" stop-color="#5ee0ff" stop-opacity=".55"/></radialGradient>
    <radialGradient id="${p}iris" cx="42%" cy="38%" r="62%"><stop offset="0" stop-color="#f2feff"/><stop offset=".3" stop-color="#8ff0ff"/><stop offset=".62" stop-color="#2fb8f5"/><stop offset="1" stop-color="#0d4fae"/></radialGradient>
    <radialGradient id="${p}glow" cx="50%" cy="50%" r="50%"><stop offset=".35" stop-color="#5ee0ff" stop-opacity=".9"/><stop offset="1" stop-color="#5ee0ff" stop-opacity="0"/></radialGradient>
    <radialGradient id="${p}tip" cx="38%" cy="35%" r="65%"><stop offset="0" stop-color="#ffd0d3"/><stop offset=".45" stop-color="#ff5e6a"/><stop offset="1" stop-color="#c22a3c"/></radialGradient>
    <radialGradient id="${p}tipglow" cx="50%" cy="50%" r="50%"><stop offset=".2" stop-color="#ff5e6a" stop-opacity=".8"/><stop offset="1" stop-color="#ff5e6a" stop-opacity="0"/></radialGradient>
    <linearGradient id="${p}pod" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9c4d8"/><stop offset="1" stop-color="#6b7894"/></linearGradient>
    <linearGradient id="${p}band" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7d8aa6"/><stop offset=".4" stop-color="#b8c3d7"/><stop offset="1" stop-color="#66738f"/></linearGradient>
    <clipPath id="${p}clip"><circle cx="100" cy="106" r="56"/></clipPath>
  </defs>
  <ellipse cx="44" cy="108" rx="13" ry="22" fill="url(#${p}pod)"/>
  <ellipse cx="156" cy="108" rx="13" ry="22" fill="url(#${p}pod)"/>
  <path d="M114 56 L128 26" stroke="#7d8aa6" stroke-width="5" stroke-linecap="round"/>
  <g class="lux-tip"><circle cx="129" cy="24" r="17" fill="url(#${p}tipglow)"/><circle cx="129" cy="24" r="8" fill="url(#${p}tip)"/></g>
  <circle cx="100" cy="106" r="56" fill="url(#${p}body)"/>
  <g clip-path="url(#${p}clip)">
    <path d="M40 116 Q100 134 160 116 L160 127 Q100 145 40 127 Z" fill="url(#${p}band)"/>
    <circle cx="100" cy="106" r="56" fill="url(#${p}rim)"/>
  </g>
  <ellipse cx="78" cy="74" rx="17" ry="9" transform="rotate(-32 78 74)" fill="#fff" opacity=".75"/>
  <circle cx="100" cy="100" r="44" fill="url(#${p}glow)" opacity=".55"/>
  <circle cx="100" cy="100" r="32" fill="#101826"/>
  <circle cx="100" cy="100" r="32" fill="none" stroke="#2c3d5c" stroke-width="2.5"/>
  <circle cx="100" cy="100" r="24.5" fill="url(#${p}iris)"/>
  <circle cx="100" cy="100" r="13" fill="none" stroke="#e8fdff" stroke-opacity=".45" stroke-width="2"/>
  <circle cx="100" cy="100" r="7" fill="#0b3d86" opacity=".55"/>
  <ellipse cx="91" cy="90" rx="7" ry="5.5" fill="#fff"/>
  <circle cx="109.5" cy="109" r="2.6" fill="#fff" opacity=".85"/>
  ${star ? '<path d="M68 128 l3.2 6.4 7 1 -5.1 5 1.2 7 -6.3 -3.3 -6.3 3.3 1.2 -7 -5.1 -5 7 -1z" fill="#ffd166" stroke="#e0a63a" stroke-width="1"/>' : ''}`;
}

/** The emblem as a square SVG of `size` pixels (viewBox 200×200). */
export function emblemSvg(size = 220, p = 'em'): string {
  const leaves = [-62, -20, 28, 74, 118, 160, 206, 250, 296]
    .map((deg, i) => {
      const a = (deg * Math.PI) / 180;
      const x = (100 + Math.cos(a) * 88).toFixed(1);
      const y = (100 + Math.sin(a) * 88).toFixed(1);
      const r = i % 3 === 0 ? 7.5 : 5;
      return `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${(r * 0.62).toFixed(1)}" transform="rotate(${deg + 50} ${x} ${y})" fill="#ff7bd5"/>`;
    })
    .join('');
  return `<svg class="emblem-svg" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 200 200">
    <defs>
      <radialGradient id="${p}halo" cx="50%" cy="50%" r="50%"><stop offset=".6" stop-color="#5ee0ff" stop-opacity=".28"/><stop offset=".86" stop-color="#5ee0ff" stop-opacity=".12"/><stop offset="1" stop-color="#5ee0ff" stop-opacity="0"/></radialGradient>
      <radialGradient id="${p}disc" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="#1a2c5c"/><stop offset="1" stop-color="#070b1c"/></radialGradient>
      <linearGradient id="${p}ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9ff3ff"/><stop offset=".5" stop-color="#5ee0ff"/><stop offset="1" stop-color="#3f6dff"/></linearGradient>
    </defs>
    <circle cx="100" cy="100" r="99" fill="url(#${p}halo)"/>
    <circle cx="100" cy="100" r="86" fill="url(#${p}disc)"/>
    <circle cx="100" cy="100" r="88" fill="none" stroke="url(#${p}ring)" stroke-width="4"/>
    <path d="M100 12a88 88 0 0 1 76 44M180 118a88 88 0 0 1-60 64M52 176A88 88 0 0 1 14 92" fill="none" stroke="#ff6fcf" stroke-width="5" stroke-linecap="round"/>
    ${leaves}
    <g transform="translate(100 100) scale(.8) translate(-100 -104)">${luxArt(p)}</g>
  </svg>`;
}
