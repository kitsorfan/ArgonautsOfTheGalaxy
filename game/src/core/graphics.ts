import type { Quality, Settings } from './save';

/** What the app shell knows about the phone (from expo-device), handed over before the page loads. */
export interface DeviceInfo {
  /** Total memory in bytes. */
  memory?: number | null;
  /** The year the phone's class of hardware was top of the range. */
  year?: number | null;
  model?: string | null;
  os?: string;
}

declare global {
  interface Window {
    __DEVICE__?: DeviceInfo;
  }
  interface Navigator {
    /** Memory in GB, rounded and capped at 8 (Chrome and Android WebView only). */
    deviceMemory?: number;
  }
}

const TIERS: Quality[] = ['low', 'medium', 'high'];
const rank = (q: Quality) => TIERS.indexOf(q);

/** The graphics card's name, from a throwaway WebGL context ('' when the browser hides it). */
function gpuName(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    if (!gl) return '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  } catch {
    return '';
  }
}

/** How strong a graphics chip is: 0 low, 1 medium, 2 high, or null if we don't know it. */
export function gpuClass(name: string): number | null {
  const n = name.toLowerCase();
  if (!n) return null;
  if (/swiftshader|llvmpipe|software|microsoft basic/.test(n)) return 0;
  const adreno = /adreno[^\d]*(\d{3})/.exec(n);
  if (adreno) {
    const v = Number(adreno[1]);
    if (v >= 730 || (v >= 650 && v < 700)) return 2;
    if (v >= 616) return 1;
    return 0;
  }
  if (/immortalis|xclipse/.test(n)) return 2;
  const mali = /mali-g(\d+)/.exec(n);
  if (mali) {
    const v = Number(mali[1]);
    // Three digits (G310, G610, G710...) is the newer naming; two digits (G52, G76...) the older one.
    if (v >= 100) return v >= 700 ? 2 : v >= 600 ? 1 : 0;
    return v >= 76 ? 1 : 0;
  }
  if (/mali|powervr|img |vivante|videocore/.test(n)) return 0;
  if (/nvidia|geforce|rtx|radeon rx|apple m\d/.test(n)) return 2;
  if (/intel|radeon/.test(n)) return 1;
  return null;
}

let detected: Quality | null = null;

/** The graphics quality this device should manage at a steady frame rate. */
export function detectQuality(): Quality {
  if (detected) return detected;
  const dev = typeof window !== 'undefined' ? window.__DEVICE__ : undefined;
  const gpu = gpuName();
  const ios = dev?.os === 'ios' || /apple gpu/i.test(gpu);
  const memGB = dev?.memory ? dev.memory / 2 ** 30 : (navigator.deviceMemory ?? null);
  const cores = navigator.hardwareConcurrency ?? null;
  const year = dev?.year ?? null;

  // iPhones hide their GPU's name, so their tier comes from the phone's age.
  let tier = gpuClass(gpu) ?? (year ? (year >= 2021 ? 2 : year >= 2018 ? 1 : 0) : 1);
  const cap = (t: number) => (tier = Math.min(tier, t));
  if (memGB !== null) {
    if (memGB < 3.5) cap(0);
    else if (memGB < 5.5) cap(1);
  }
  // WebKit doesn't always report the real core count, so only trust it off iOS.
  if (cores !== null && !ios) {
    if (cores <= 4) cap(0);
    else if (cores <= 6) cap(1);
  }
  if (year !== null) {
    if (year <= 2016) cap(0);
    else if (year <= 2019) cap(1);
  }
  detected = TIERS[tier];
  return detected;
}

/** With Auto graphics on, sets the quality to what this device can run, never above what play has shown it can hold. */
export function resolveAuto(s: Settings) {
  if (!s.autoQuality) return;
  const q = detectQuality();
  s.quality = s.autoCap && rank(s.autoCap) < rank(q) ? s.autoCap : q;
}

/** One quality step down, or null if already at the lowest. */
export function stepDown(q: Quality): Quality | null {
  const i = rank(q);
  return i > 0 ? TIERS[i - 1] : null;
}

/** Below this, sustained over two windows in a row, Auto graphics drops a step. */
const SLOW_FPS = 40;
const WINDOW = 5;
const WARM_UP = 3;

/**
 * Watches the frame rate during play. A frame-rate drop while a deck builds or after a pause is skipped (the warm-up),
 * and so are single long frames (loading, the app coming back from the background).
 */
export class FrameWatch {
  private warm = WARM_UP;
  private t = 0;
  private n = 0;
  private slow = 0;

  /** Starts over, e.g. on a new deck or after a step down. */
  reset() {
    this.warm = WARM_UP;
    this.t = 0;
    this.n = 0;
    this.slow = 0;
  }

  /** Feeds one frame's real length in seconds. True when the game has been too slow for long enough to step down. */
  sample(seconds: number): boolean {
    if (seconds <= 0 || seconds > 0.25) return false;
    if (this.warm > 0) {
      this.warm -= seconds;
      return false;
    }
    this.t += seconds;
    this.n += 1;
    if (this.t < WINDOW) return false;
    const fps = this.n / this.t;
    this.t = 0;
    this.n = 0;
    this.slow = fps < SLOW_FPS ? this.slow + 1 : 0;
    if (this.slow < 2) return false;
    this.reset();
    return true;
  }
}
