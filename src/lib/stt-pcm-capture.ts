/**
 * Capture microphone as PCM s16le mono @ 16kHz for real-time STT WebSocket streaming.
 */

const TARGET_SAMPLE_RATE = 16_000;
/** ~100ms of audio per WebSocket frame at 16kHz */
const FLUSH_SAMPLES = 1_600;

export type PcmCaptureHandle = {
  stop: () => void;
};

function resampleFloat32(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const outLength = Math.max(1, Math.round(input.length / ratio));
  const output = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const srcIdx = i * ratio;
    const idx = Math.floor(srcIdx);
    const frac = srcIdx - idx;
    const s0 = input[idx] ?? 0;
    const s1 = input[idx + 1] ?? s0;
    output[i] = s0 + (s1 - s0) * frac;
  }
  return output;
}

function float32ToInt16(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]!));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

export async function startPcmCapture(
  stream: MediaStream,
  onChunk: (pcm: ArrayBuffer) => void,
): Promise<PcmCaptureHandle> {
  const audioContext = new AudioContext();
  await audioContext.resume();

  const source = audioContext.createMediaStreamSource(stream);
  const mute = audioContext.createGain();
  mute.gain.value = 0;

  const bufferSize = 4096;
  const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
  const inputRate = audioContext.sampleRate;
  const pending: number[] = [];

  const flush = () => {
    while (pending.length >= FLUSH_SAMPLES) {
      const slice = pending.splice(0, FLUSH_SAMPLES);
      const int16 = float32ToInt16(new Float32Array(slice));
      onChunk(int16.buffer.slice(0));
    }
  };

  processor.onaudioprocess = (event) => {
    const channel = event.inputBuffer.getChannelData(0);
    const resampled = resampleFloat32(channel, inputRate, TARGET_SAMPLE_RATE);
    for (let i = 0; i < resampled.length; i++) {
      pending.push(resampled[i]!);
    }
    flush();
  };

  source.connect(processor);
  processor.connect(mute);
  mute.connect(audioContext.destination);

  return {
    stop: () => {
      if (pending.length > 0) {
        const int16 = float32ToInt16(new Float32Array(pending));
        onChunk(int16.buffer.slice(0));
        pending.length = 0;
      }
      processor.onaudioprocess = null;
      processor.disconnect();
      source.disconnect();
      mute.disconnect();
      void audioContext.close();
    },
  };
}

export { TARGET_SAMPLE_RATE, resampleFloat32, float32ToInt16 };
