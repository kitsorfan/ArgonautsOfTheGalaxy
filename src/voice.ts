import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

import VOICES from '@/generated/voices';

/**
 * Speaks the story's voice-over natively (the page names the line: game/src/core/voice.ts). One line at
 * a time: a new one, or none, stops the last. The page dips the music itself while a line plays.
 */
export class Voice {
  private player: AudioPlayer | null = null;

  play(key: string | null, volume: number) {
    this.stop();
    const source = key ? VOICES[key] : undefined;
    if (source === undefined) return;
    const p = createAudioPlayer(source);
    p.volume = volume;
    const finished = p.addListener('playbackStatusUpdate', (status) => {
      if (!status.didJustFinish) return;
      finished.remove();
      if (this.player === p) this.player = null;
      p.remove();
    });
    this.player = p;
    p.play();
  }

  stop() {
    const p = this.player;
    this.player = null;
    if (!p) return;
    p.pause();
    p.remove();
  }
}
