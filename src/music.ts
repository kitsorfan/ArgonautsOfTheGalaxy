import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import type { MusicFile } from '../game/src/core/music';

/** The game's recordings (game/src/core/music.ts names them; the page tells us which one to play). */
const SOURCES: Record<MusicFile, number> = {
  title: require('../assets/music/title.mp3'),
  ending: require('../assets/music/ending.mp3'),
  'ship-calm': require('../assets/music/ship-calm.mp3'),
  'ship-action': require('../assets/music/ship-action.mp3'),
  'planet-adventure': require('../assets/music/planet-adventure.mp3'),
  'planet-frost': require('../assets/music/planet-frost.mp3'),
  'planet-wild': require('../assets/music/planet-wild.mp3'),
  voyage: require('../assets/music/voyage.mp3'),
  mystery: require('../assets/music/mystery.mp3'),
  epic: require('../assets/music/epic.mp3'),
  'boss-ship': require('../assets/music/boss-ship.mp3'),
  boss: require('../assets/music/boss.mp3'),
  'boss-final': require('../assets/music/boss-final.mp3'),
};

/** How long one song fades out, and the next in, on a switch (ms). */
const FADE = 500;
const STEP = 50;

/**
 * Plays the game's music natively, so decoding and mixing it costs the page (and its three.js frame)
 * nothing. One looping player at a time; on a switch the old one fades out and is let go.
 */
export class Music {
  private player: AudioPlayer | null = null;
  private file: MusicFile | null = null;
  private volume = 0;
  /** The app is in the foreground. */
  private active = true;
  private fades = new Map<AudioPlayer, ReturnType<typeof setInterval>>();

  constructor() {
    // doNotMix: the soundtrack takes over from whatever the phone was playing, instead of both at once.
    setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'doNotMix', shouldPlayInBackground: false }).catch(() => {});
  }

  play(file: MusicFile | null, volume: number) {
    this.volume = volume;
    if (file === this.file) return this.update();
    this.file = file;
    if (this.player) this.fadeOut(this.player);
    this.player = null;
    if (!file || !SOURCES[file]) return;
    const p = createAudioPlayer(SOURCES[file]);
    p.loop = true;
    p.volume = 0;
    this.player = p;
    this.update();
  }

  setVolume(volume: number) {
    this.volume = volume;
    this.update();
  }

  /** The app went to the background (false) or came back (true). */
  setActive(on: boolean) {
    this.active = on;
    this.update();
  }

  release() {
    for (const t of this.fades.values()) clearInterval(t);
    this.fades.clear();
    this.player?.remove();
    this.player = null;
    this.file = null;
  }

  /** Plays (fading up to the wanted volume) or pauses the current song. */
  private update() {
    const p = this.player;
    if (!p) return;
    if (!this.active || this.volume <= 0.01) {
      this.stopFade(p);
      p.pause();
      return;
    }
    if (!p.playing) p.play();
    this.fade(p, this.volume);
  }

  private fadeOut(p: AudioPlayer) {
    this.fade(p, 0, () => p.remove());
  }

  private fade(p: AudioPlayer, to: number, done?: () => void) {
    this.stopFade(p);
    const from = p.volume;
    const steps = Math.max(1, Math.round((FADE * Math.abs(to - from)) / STEP));
    let i = 0;
    const t = setInterval(() => {
      i++;
      p.volume = from + ((to - from) * i) / steps;
      if (i < steps) return;
      this.stopFade(p);
      done?.();
    }, STEP);
    this.fades.set(p, t);
  }

  private stopFade(p: AudioPlayer) {
    const t = this.fades.get(p);
    if (t !== undefined) clearInterval(t);
    this.fades.delete(p);
  }
}
