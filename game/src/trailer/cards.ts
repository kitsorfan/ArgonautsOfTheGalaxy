import { GAME_NAME, CREATOR } from '../core/brand';
import { lang, tr } from '../core/i18n';
import { MUSIC_CREDITS } from '../core/music';
import { MUSIC } from './cut';

/** A line in both of the game's languages. */
export interface Words {
  en: string;
  el: string;
}

export interface Card {
  id: string;
  kind: 'title' | 'caption' | 'end';
  /** Bars, on the trailer's own clock rather than any one shot's. */
  from: number;
  to: number;
  kicker?: Words;
  text?: Words;
  /** Captions sit low unless the shot has something of its own down there. */
  place?: 'top';
}

const say = (w: Words | undefined) => (w ? (lang() === 'el' ? w.el : w.en) : '');

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Upper case the way the game's logo is: Greek capitals drop their accents. */
const upper = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

/** The logo: the name on two lines, the way it stands on the title screen. */
function logo(): string {
  const words = upper(tr(GAME_NAME)).split(' ');
  // "ARGONAUTS / OF THE GALAXY", «ΑΡΓΟΝΑΥΤΕΣ / ΤΟΥ ΓΑΛΑΞΙΑ».
  return `<h1 class="tr-logo"><span class="tr-logo-a">${esc(words[0])}</span><span class="tr-logo-b">${esc(words.slice(1).join(' '))}</span></h1>`;
}

function face(card: Card): string {
  const kicker = card.kicker ? `<p class="tr-kicker">${esc(say(card.kicker))}</p>` : '';
  if (card.kind === 'title') return `${kicker}${logo()}`;
  if (card.kind === 'end') {
    const song = MUSIC_CREDITS[MUSIC.file];
    const music = lang() === 'el' ? 'Μουσική' : 'Music';
    return `<div class="tr-end">
      ${logo()}
      ${card.text ? `<p class="tr-ask">${esc(say(card.text))}</p>` : ''}
      ${kicker ? `<p class="tr-pill">${esc(say(card.kicker))}</p>` : ''}
      ${lang() === 'el' ? '' : `<p class="tr-by">A game by <b>${esc(CREATOR.name)}</b></p>`}
      <p class="tr-credit">${music}: “${esc(song.title)}” · ${esc(song.artist)} · ${esc(song.license)}</p>
    </div>`;
  }
  return `<div class="tr-caption">${kicker}<strong>${esc(say(card.text))}</strong></div>`;
}

const CSS = `
body.trailer #ui, body.trailer #touch { display: none !important; }
.tr-stage { position: fixed; inset: 0; z-index: 50; pointer-events: none; font-family: 'Fredoka', sans-serif; color: #eef4ff; }
.tr-card { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; opacity: 0; will-change: opacity, transform; }
.tr-card.caption { justify-content: flex-end; padding-bottom: 9vh; }
.tr-card.caption.top { justify-content: flex-start; padding: 8vh 0 0; }
.tr-card.title, .tr-card.end { background: radial-gradient(ellipse at center, rgba(3, 4, 14, 0.55), rgba(3, 4, 14, 0.15) 70%); }
.tr-logo { margin: 0; display: flex; flex-direction: column; align-items: center; font-family: 'Orbitron', sans-serif; font-weight: 800; line-height: 1; letter-spacing: 0.08em;
  background: linear-gradient(180deg, #ffffff, #9fe8ff 60%, #5e9bff); -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: drop-shadow(0 0 22px rgba(94, 224, 255, 0.6)) drop-shadow(0 4px 10px rgba(0, 0, 0, 0.7)); }
.tr-logo-a { font-size: 12vh; }
.tr-logo-b { font-size: 5.4vh; letter-spacing: 0.32em; margin-top: 1.6vh; padding-left: 0.32em; }
.tr-kicker { margin: 0 0 2.2vh; font-family: 'Orbitron', sans-serif; font-weight: 700; font-size: 2.4vh; letter-spacing: 0.32em; color: #ffd166; text-shadow: 0 0 3px #000, 0 0 10px rgba(0, 0, 0, 0.95), 0 2px 8px rgba(0, 0, 0, 0.9); }
.tr-caption { display: flex; flex-direction: column; align-items: center; }
.tr-caption .tr-kicker { margin-bottom: 1.2vh; font-size: 2.1vh; }
.tr-caption strong { font-family: 'Orbitron', sans-serif; font-weight: 800; font-size: 6.2vh; letter-spacing: 0.04em; line-height: 1.1;
  color: #ffffff; text-shadow: 0 0 24px rgba(94, 224, 255, 0.55), 0 3px 10px rgba(0, 0, 0, 0.95), 0 0 2px rgba(0, 0, 0, 0.9); }
.tr-end { display: flex; flex-direction: column; align-items: center; }
.tr-tag { margin: 3.4vh 0 0; font-size: 3vh; font-weight: 600; color: #ffffff; text-shadow: 0 2px 10px rgba(0, 0, 0, 0.95); }
.tr-ask { margin: 3.6vh 0 0; font-family: 'Orbitron', sans-serif; font-weight: 800; font-size: 4.6vh; letter-spacing: 0.05em; color: #ffd166;
  text-shadow: 0 0 22px rgba(255, 209, 102, 0.5), 0 3px 10px rgba(0, 0, 0, 0.95); }
.tr-pill { margin: 3vh 0 0; padding: 1vh 2.6vh; border-radius: 99px; background: #ffd166; color: #1a1030; font-family: 'Orbitron', sans-serif; font-weight: 800; font-size: 2.3vh; letter-spacing: 0.14em; box-shadow: 0 0 26px rgba(255, 209, 102, 0.55); }
.tr-by { margin: 4vh 0 0; font-size: 2.6vh; color: #cfe0ff; text-shadow: 0 2px 8px rgba(0, 0, 0, 0.95); }
.tr-by b { color: #ffffff; font-weight: 700; }
.tr-credit { position: absolute; bottom: 3vh; left: 0; right: 0; margin: 0; font-size: 1.6vh; color: rgba(207, 224, 255, 0.75); }
.tr-slate { position: absolute; inset: 0; background: #000; opacity: 1; }
`;

/**
 * The words over the pictures: the title, the lines between the shots, and the card at the end. All
 * of them sit on the page from the start, invisible; the director brings each one up on its bar, the
 * same frame the picture under it is drawn.
 */
export class Cards {
  private els = new Map<string, HTMLElement>();
  private black: HTMLElement;

  constructor(cards: Card[]) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    const root = document.createElement('div');
    root.className = 'tr-stage';
    for (const card of cards) {
      const el = document.createElement('div');
      el.className = `tr-card ${card.kind}${card.place ? ` ${card.place}` : ''}`;
      el.innerHTML = face(card);
      root.appendChild(el);
      this.els.set(card.id, el);
    }
    this.black = document.createElement('div');
    this.black.className = 'tr-slate';
    root.appendChild(this.black);
    document.body.appendChild(root);
  }

  /** How much of a card shows, 0 to 1: it fades, and rises a little as it comes. */
  show(id: string, k: number) {
    const el = this.els.get(id);
    if (!el) return;
    const o = k.toFixed(3);
    if (el.style.opacity === o) return;
    el.style.opacity = o;
    el.style.transform = k > 0 && k < 1 ? `translateY(${((1 - k) * 1.2).toFixed(2)}vh) scale(${(0.985 + k * 0.015).toFixed(4)})` : '';
  }

  /** The black over everything: 1 hides the picture, 0 shows it. */
  slate(k: number) {
    this.black.style.opacity = k.toFixed(3);
  }
}
