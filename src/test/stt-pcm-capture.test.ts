import { describe, expect, it } from 'vitest';
import { resampleFloat32, float32ToInt16 } from '@/lib/stt-pcm-capture';

describe('stt-pcm-capture', () => {
  it('resampleFloat32 preserves length ratio', () => {
    const input = new Float32Array(44100);
    input.fill(0.5);
    const out = resampleFloat32(input, 44100, 16000);
    expect(out.length).toBeGreaterThan(1000);
    expect(out.length).toBeLessThan(input.length);
  });

  it('float32ToInt16 clamps to int16 range', () => {
    const input = new Float32Array([1.5, -1.5, 0]);
    const out = float32ToInt16(input);
    expect(out[0]).toBe(0x7fff);
    expect(out[1]).toBe(-0x8000);
    expect(out[2]).toBe(0);
  });
});
