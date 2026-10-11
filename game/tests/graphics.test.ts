import { FrameWatch, gpuClass, resolveAuto, stepDown } from '../src/core/graphics';
import { defaultSettings } from '../src/core/save';

describe('Auto graphics', () => {
  it('knows phone GPUs by name', () => {
    expect(gpuClass('Adreno (TM) 610')).toBe(0);
    expect(gpuClass('Adreno (TM) 642L')).toBe(1);
    expect(gpuClass('Adreno (TM) 660')).toBe(2);
    expect(gpuClass('Adreno (TM) 720')).toBe(1);
    expect(gpuClass('Adreno (TM) 750')).toBe(2);
    expect(gpuClass('Mali-G52 MC2')).toBe(0);
    expect(gpuClass('Mali-G78 MP14')).toBe(1);
    expect(gpuClass('Mali-G610 MC6')).toBe(1);
    expect(gpuClass('Mali-G715-Immortalis MC11')).toBe(2);
    expect(gpuClass('PowerVR Rogue GE8320')).toBe(0);
    expect(gpuClass('Samsung Xclipse 920')).toBe(2);
    expect(gpuClass('Google SwiftShader')).toBe(0);
    expect(gpuClass('Apple GPU')).toBeNull();
    expect(gpuClass('')).toBeNull();
  });

  it('never picks above what play has shown the device can hold', () => {
    const s = { ...defaultSettings(), quality: 'high' as const, autoCap: 'low' as const };
    resolveAuto(s);
    expect(s.quality).toBe('low');
    const manual = { ...defaultSettings(), autoQuality: false, quality: 'high' as const };
    resolveAuto(manual);
    expect(manual.quality).toBe('high');
  });

  it('steps down one tier at a time', () => {
    expect(stepDown('high')).toBe('medium');
    expect(stepDown('medium')).toBe('low');
    expect(stepDown('low')).toBeNull();
  });

  const run = (w: FrameWatch, fps: number, seconds: number) => {
    let hit = false;
    for (let t = 0; t < seconds; t += 1 / fps) hit = w.sample(1 / fps) || hit;
    return hit;
  };

  it('steps down only after the frame rate stays low', () => {
    const w = new FrameWatch();
    expect(run(w, 60, 30)).toBe(false);
    expect(run(w, 30, 8)).toBe(false); // one slow window is not enough
    expect(run(w, 30, 6)).toBe(true);
  });

  it('ignores single long frames and a slow warm-up', () => {
    const w = new FrameWatch();
    expect(run(w, 20, 2.5)).toBe(false);
    for (let i = 0; i < 20; i++) w.sample(1.5);
    expect(run(w, 60, 20)).toBe(false);
  });
});
