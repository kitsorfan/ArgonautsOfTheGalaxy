import { inApp, post } from './bridge';
import { TRACKS, type MusicFile, type Track } from './music';

export type Sfx =
  | 'jump'
  | 'djump'
  | 'land'
  | 'shoot'
  | 'hit'
  | 'pop'
  | 'bolt'
  | 'heart'
  | 'hurt'
  | 'dash'
  | 'pound'
  | 'spin'
  | 'door'
  | 'checkpoint'
  | 'fail'
  | 'success'
  | 'roar'
  | 'explode'
  | 'bounce'
  | 'vent'
  | 'zap'
  | 'shard'
  | 'upgrade'
  | 'select'
  | 'blip'
  | 'enemyShoot'
  | 'break'
  | 'glide'
  | 'shield'
  | 'pulse'
  | 'reload'
  | 'empty'
  | 'charge'
  | 'charged'
  | 'fireball'
  | 'alarm'
  | 'sputter'
  | 'tone0'
  | 'tone1'
  | 'tone2'
  | 'tone3';

export type { Track } from './music';

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

/** The recordings are mastered loud: at full music volume they play at this level, under the sound effects. */
const MUSIC_LEVEL = 0.6;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private noise!: AudioBuffer;
  /** The recording playing (or wanted, before the first tap lets a browser play it). */
  private file: MusicFile | null = null;
  /** In a browser: the <audio> element playing it. */
  private el: HTMLAudioElement | null = null;
  private unlocked = false;
  private lastPlay = new Map<Sfx, number>();
  musicVolume = 0.55;
  sfxVolume = 0.8;

  /** Must be called from a user gesture on mobile. */
  unlock() {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.setup(new Ctor());
    }
    const ctx = this.ctx as AudioContext;
    if (ctx.state === 'suspended') void ctx.resume();
    if (!this.unlocked) {
      this.unlocked = true;
      this.startElement();
    }
  }

  /** Builds the sound effects' mixer on a context. */
  private setup(ctx: AudioContext) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.applyVolumes();
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  /** The page is hidden (or the app sent to the background): hush. In the app the phone pauses the music itself. */
  suspend(on: boolean) {
    if (this.el) {
      if (on) this.el.pause();
      else this.startElement();
    }
    if (!this.ctx) return;
    if (on) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  setVolumes(music: number, sfx: number) {
    this.musicVolume = music;
    this.sfxVolume = sfx;
    this.applyVolumes();
  }

  private applyVolumes() {
    if (inApp()) post({ type: 'musicVolume', volume: this.musicVolume * MUSIC_LEVEL });
    else if (this.el) {
      this.el.volume = this.musicVolume * MUSIC_LEVEL;
      if (this.musicVolume > 0.01) this.startElement();
      else this.el.pause();
    }
    if (this.ctx) this.sfxBus.gain.value = this.sfxVolume;
  }

  /* ---------------- building blocks ---------------- */

  private env(g: GainNode, t: number, a: number, d: number, peak: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  private tone(t: number, type: OscillatorType, f0: number, f1: number, dur: number, vol: number, bus: AudioNode, attack = 0.005) {
    const ctx = this.ctx as AudioContext;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    this.env(g, t, attack, dur, vol);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
  }

  private hiss(t: number, dur: number, vol: number, type: BiquadFilterType, f0: number, f1: number, bus: AudioNode, attack = 0.003) {
    const ctx = this.ctx as AudioContext;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.setValueAtTime(f0, t);
    filt.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    filt.Q.value = type === 'bandpass' ? 1.6 : 0.7;
    const g = ctx.createGain();
    this.env(g, t, attack, dur, vol);
    src.connect(filt).connect(g).connect(bus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + attack + dur + 0.05);
  }

  /** Plays a sound effect. `volume` below 1 is for sounds out in the world, quieter the further away they are. */
  play(name: Sfx, pitch = 1, volume = 1) {
    if (!this.ctx || this.ctx.state !== 'running' || volume < 0.02) return;
    const now = this.ctx.currentTime;
    const last = this.lastPlay.get(name) ?? 0;
    if (now - last < 0.035) return;
    this.lastPlay.set(name, now);
    let b = this.sfxBus;
    if (volume < 0.999) {
      b = this.ctx.createGain();
      b.gain.value = volume;
      b.connect(this.sfxBus);
    }
    const t = now + 0.005;
    const p = pitch;
    switch (name) {
      case 'jump':
        this.tone(t, 'square', 320 * p, 640 * p, 0.12, 0.12, b);
        break;
      case 'djump':
        this.tone(t, 'triangle', 480 * p, 1100 * p, 0.16, 0.2, b);
        this.hiss(t, 0.18, 0.12, 'highpass', 3000, 6000, b);
        break;
      case 'land':
        this.hiss(t, 0.08, 0.18, 'lowpass', 900, 200, b);
        break;
      case 'shoot':
        this.tone(t, 'square', 1100 * p, 280 * p, 0.09, 0.1, b);
        this.tone(t, 'sine', 1600 * p, 600 * p, 0.06, 0.08, b);
        break;
      case 'hit':
        this.hiss(t, 0.07, 0.35, 'bandpass', 2400, 900, b);
        this.tone(t, 'sine', 220, 90, 0.09, 0.25, b);
        break;
      case 'pop':
        this.tone(t, 'sine', 500 * p, 1300 * p, 0.12, 0.3, b);
        this.hiss(t, 0.15, 0.2, 'bandpass', 3000, 1200, b);
        break;
      case 'bolt':
        this.tone(t, 'sine', midi(88) * p, midi(88) * p, 0.06, 0.13, b);
        this.tone(t + 0.05, 'sine', midi(95) * p, midi(95) * p, 0.1, 0.12, b);
        break;
      case 'heart':
        [72, 76, 79, 84].forEach((n, i) => this.tone(t + i * 0.06, 'triangle', midi(n), midi(n), 0.12, 0.2, b));
        break;
      case 'hurt':
        this.tone(t, 'sawtooth', 380, 110, 0.28, 0.2, b);
        this.hiss(t, 0.15, 0.25, 'lowpass', 2000, 300, b);
        break;
      case 'dash':
        this.hiss(t, 0.22, 0.3, 'bandpass', 800, 4000, b);
        break;
      case 'pound':
        this.tone(t, 'sine', 170, 38, 0.35, 0.6, b);
        this.hiss(t, 0.3, 0.35, 'lowpass', 1500, 120, b);
        break;
      case 'spin':
        this.hiss(t, 0.3, 0.25, 'bandpass', 600, 2600, b, 0.03);
        break;
      case 'door':
        this.tone(t, 'sawtooth', 90, 180, 0.4, 0.1, b, 0.05);
        this.hiss(t, 0.4, 0.12, 'lowpass', 400, 1600, b, 0.05);
        break;
      case 'checkpoint':
        [72, 76, 79, 84, 88].forEach((n, i) => this.tone(t + i * 0.07, 'triangle', midi(n), midi(n), 0.2, 0.18, b));
        break;
      case 'fail':
        this.tone(t, 'square', 220, 150, 0.35, 0.14, b);
        break;
      case 'success':
        [67, 72, 76, 79].forEach((n, i) => this.tone(t + i * 0.08, 'square', midi(n), midi(n), 0.14, 0.1, b));
        this.tone(t + 0.32, 'triangle', midi(84), midi(84), 0.4, 0.2, b);
        break;
      case 'roar':
        this.tone(t, 'sawtooth', 130, 55, 0.9, 0.22, b, 0.08);
        this.tone(t, 'sawtooth', 137, 58, 0.9, 0.18, b, 0.08);
        this.hiss(t, 0.9, 0.2, 'lowpass', 800, 200, b, 0.1);
        break;
      case 'explode':
        this.hiss(t, 0.7, 0.55, 'lowpass', 2400, 90, b);
        this.tone(t, 'sine', 140, 30, 0.6, 0.5, b);
        break;
      case 'bounce':
        this.tone(t, 'sine', 180, 760, 0.28, 0.35, b);
        this.tone(t, 'triangle', 360, 1500, 0.2, 0.12, b);
        break;
      case 'vent':
        this.hiss(t, 0.7, 0.18, 'highpass', 1200, 3000, b, 0.05);
        break;
      case 'zap':
        this.tone(t, 'square', 1800 * p, 300 * p, 0.16, 0.08, b);
        this.hiss(t, 0.12, 0.12, 'highpass', 5000, 2000, b);
        break;
      case 'shard':
        [84, 88, 91, 96].forEach((n, i) => {
          this.tone(t + i * 0.09, 'sine', midi(n), midi(n), 0.5, 0.18, b);
          this.tone(t + i * 0.09, 'sine', midi(n + 12), midi(n + 12), 0.3, 0.05, b);
        });
        break;
      case 'upgrade':
        [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => this.tone(t + i * 0.07, 'square', midi(n), midi(n), 0.16, 0.08, b));
        this.tone(t + 0.5, 'triangle', midi(84), midi(84), 0.8, 0.22, b);
        break;
      case 'select':
        this.tone(t, 'square', 880, 880, 0.05, 0.07, b);
        break;
      case 'blip':
        this.tone(t, 'square', 620 * p, 620 * p, 0.03, 0.035, b);
        break;
      case 'enemyShoot':
        this.tone(t, 'sine', 600, 200, 0.18, 0.12, b);
        break;
      case 'break':
        this.hiss(t, 0.22, 0.4, 'bandpass', 1400, 500, b);
        this.tone(t, 'triangle', 300, 120, 0.15, 0.15, b);
        break;
      case 'glide':
        this.hiss(t, 0.25, 0.08, 'bandpass', 1200, 900, b, 0.05);
        break;
      case 'shield':
        this.tone(t, 'sine', 300, 900, 0.35, 0.2, b, 0.03);
        this.tone(t, 'triangle', 450, 1350, 0.35, 0.08, b, 0.03);
        break;
      case 'pulse':
        // A deep thump, a rush of air and a rising electric shimmer.
        this.tone(t, 'sine', 120, 34, 0.6, 0.7, b);
        this.hiss(t, 0.55, 0.4, 'lowpass', 3200, 150, b);
        this.tone(t + 0.02, 'sawtooth', 220, 1760, 0.4, 0.07, b, 0.02);
        this.hiss(t + 0.05, 0.35, 0.16, 'highpass', 4000, 9000, b, 0.02);
        break;
      case 'reload':
        this.tone(t, 'square', 260, 520, 0.05, 0.08, b);
        this.hiss(t + 0.08, 0.06, 0.18, 'bandpass', 3000, 2000, b);
        this.tone(t + 0.16, 'square', 700, 700, 0.04, 0.09, b);
        break;
      case 'empty':
        this.tone(t, 'square', 180, 160, 0.04, 0.08, b);
        this.hiss(t, 0.03, 0.12, 'bandpass', 2500, 2500, b);
        break;
      case 'charge':
        this.tone(t, 'sawtooth', 160, 900, 0.75, 0.06, b, 0.05);
        this.tone(t, 'sine', 320, 1800, 0.75, 0.08, b, 0.05);
        break;
      case 'charged':
        this.tone(t, 'triangle', 1400, 1400, 0.12, 0.12, b);
        this.tone(t + 0.07, 'triangle', 1870, 1870, 0.16, 0.1, b);
        break;
      case 'fireball':
        this.tone(t, 'sawtooth', 420, 90, 0.45, 0.22, b);
        this.hiss(t, 0.5, 0.4, 'lowpass', 3000, 300, b);
        break;
      case 'sputter':
        // A soft electrical crackle (not a blaster "pew": no falling pitch).
        this.hiss(t, 0.05, 0.1, 'highpass', 4000, 4000, b);
        this.hiss(t + 0.06, 0.03, 0.06, 'highpass', 6000, 6000, b);
        break;
      case 'alarm':
        for (let i = 0; i < 3; i++) {
          this.tone(t + i * 0.26, 'square', 880, 660, 0.22, 0.09, b);
        }
        break;
      case 'tone0':
      case 'tone1':
      case 'tone2':
      case 'tone3': {
        const n = [64, 68, 71, 76][Number(name.slice(4))];
        this.tone(t, 'triangle', midi(n), midi(n), 0.35, 0.28, b);
        this.tone(t, 'sine', midi(n + 12), midi(n + 12), 0.25, 0.08, b);
        break;
      }
    }
  }

  /* ---------------- music ---------------- */

  /** Plays a track (looped), or stops the music with null. Tracks sharing a recording carry on without a restart. */
  music(track: Track | null) {
    const file = track ? TRACKS[track] : null;
    if (file === this.file) return;
    this.file = file;
    if (inApp()) {
      post({ type: 'music', file, volume: this.musicVolume * MUSIC_LEVEL });
      return;
    }
    this.el?.pause();
    this.el = null;
    if (!file) return;
    const el = new Audio(`music/${file}.mp3`);
    el.loop = true;
    el.volume = this.musicVolume * MUSIC_LEVEL;
    this.el = el;
    this.startElement();
  }

  /** Starts the browser's <audio> element, once a tap has allowed it and while the music is turned up. */
  private startElement() {
    const el = this.el;
    if (!el || !this.unlocked || this.musicVolume <= 0.01 || document.hidden) return;
    el.play().catch(() => {});
  }

  /* ---------------- the Flamethrower's roar ---------------- */

  private flameSrc: AudioBufferSourceNode | null = null;
  private flameGain: GainNode | null = null;
  private flameOn = false;
  private flameSeen = 0;
  private flameTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * The Flamethrower's roar: a loop of rumbling, crackling filtered noise. Call it every frame with
   * whether the flames are burning; it fades in and out, and stops by itself if the calls stop (pause).
   */
  flame(on: boolean) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    if (on) this.flameSeen = ctx.currentTime;
    if (on === this.flameOn) return;
    this.flameOn = on;
    const t = ctx.currentTime;
    if (on) {
      if (!this.flameSrc) {
        const src = ctx.createBufferSource();
        src.buffer = this.noise;
        src.loop = true;
        const low = ctx.createBiquadFilter();
        low.type = 'lowpass';
        low.frequency.value = 900;
        low.Q.value = 0.9;
        // A fast wobble on the filter makes it crackle and flutter like real fire.
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 9;
        const depth = ctx.createGain();
        depth.gain.value = 380;
        lfo.connect(depth).connect(low.frequency);
        const g = ctx.createGain();
        g.gain.value = 0.0001;
        src.connect(low).connect(g).connect(this.sfxBus);
        src.start(t, Math.random() * 0.5);
        lfo.start(t);
        src.onended = () => lfo.stop();
        this.flameSrc = src;
        this.flameGain = g;
      }
      // The roar dies down if nobody keeps it going (the game paused mid-flame).
      this.flameTimer ??= setInterval(() => {
        if (this.ctx && this.ctx.currentTime - this.flameSeen > 0.2) this.flame(false);
      }, 100);
      this.flameGain?.gain.setTargetAtTime(0.42, t, 0.04);
      // A whoosh as it lights.
      this.hiss(t, 0.25, 0.25, 'bandpass', 600, 2400, this.sfxBus, 0.02);
    } else if (this.flameSrc && this.flameGain) {
      if (this.flameTimer) clearInterval(this.flameTimer);
      this.flameTimer = null;
      this.flameGain.gain.setTargetAtTime(0.0001, t, 0.07);
      this.flameSrc.stop(t + 0.5);
      this.flameSrc = null;
      this.flameGain = null;
    }
  }
}

export const audio = new AudioEngine();
