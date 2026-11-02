/**
 * Real-time STT WebSocket stream (Module 5/6 Gateway).
 * Connects to ws_url from POST /stt/sessions and streams audio chunks.
 */

import { getSttApiBaseUrl, mapApiTurnsToTranscript, type TranscriptTurn } from './stt-nlp-api';

export type SttStreamCallbacks = {
  onPartial?: (text: string, speaker?: 'doctor' | 'patient') => void;
  onFinalTurn?: (turn: TranscriptTurn) => void;
  onError?: (message: string) => void;
  onConnected?: () => void;
};

type WsServerMessage = {
  type?: string;
  event?: string;
  text?: string;
  transcript?: string;
  speaker?: string;
  role?: string;
  turns?: Array<{ role?: string; speaker?: string; text: string; start_time?: string; end_time?: string }>;
  message?: string;
  detail?: string;
  is_final?: boolean;
  final?: boolean;
  isFinal?: boolean;
  results?: Array<{
    is_final?: boolean;
    isFinal?: boolean;
    alternatives?: Array<{ transcript?: string; confidence?: number }>;
  }>;
  alternatives?: Array<{ transcript?: string; confidence?: number }>;
  data?: { text?: string; transcript?: string; speaker?: string; role?: string; is_final?: boolean };
};

export function resolveSttWsUrl(wsUrl: string): string {
  if (wsUrl.startsWith('ws://') || wsUrl.startsWith('wss://')) return wsUrl;
  const base = getSttApiBaseUrl();
  const protocol = base.startsWith('https') ? 'wss' : 'ws';
  const host = base.replace(/^https?:\/\//, '');
  if (wsUrl.startsWith('/')) return `${protocol}://${host}${wsUrl}`;
  return `${protocol}://${host}/${wsUrl.replace(/^\//, '')}`;
}

function parseSpeaker(raw?: string): 'doctor' | 'patient' {
  const s = (raw ?? '').toLowerCase();
  return s === 'patient' ? 'patient' : 'doctor';
}

function extractText(msg: WsServerMessage): string {
  const nested = msg.data?.text ?? msg.data?.transcript;
  if (nested?.trim()) return nested.trim();
  const direct = (msg.text ?? msg.transcript ?? '').trim();
  if (direct) return direct;
  const alt = msg.alternatives?.[0]?.transcript?.trim();
  if (alt) return alt;
  const resultAlt = msg.results?.[0]?.alternatives?.[0]?.transcript?.trim();
  return resultAlt ?? '';
}

function extractSpeaker(msg: WsServerMessage): 'doctor' | 'patient' {
  return parseSpeaker(msg.speaker ?? msg.role ?? msg.data?.speaker ?? msg.data?.role);
}

function isFinalMessage(msg: WsServerMessage, type: string): boolean {
  if (type === 'final' || type === 'turn' || type === 'utterance') return true;
  if (type === 'partial' || type === 'interim' || type === 'hypothesis') return false;
  if (msg.is_final === true || msg.final === true || msg.isFinal === true) return true;
  if (msg.data?.is_final === true) return true;
  if (msg.results?.some((r) => r.is_final === true || r.isFinal === true)) return true;
  return false;
}

function parseServerMessage(raw: string, callbacks: SttStreamCallbacks, turns: TranscriptTurn[]): void {
  let msg: WsServerMessage;
  try {
    msg = JSON.parse(raw) as WsServerMessage;
  } catch {
    return;
  }

  const type = (msg.type ?? msg.event ?? '').toLowerCase();

  if (type === 'error') {
    callbacks.onError?.(msg.message ?? msg.detail ?? 'STT WebSocket error');
    return;
  }

  if (type === 'connected' || type === 'ready' || type === 'session_started') {
    callbacks.onConnected?.();
    return;
  }

  if (msg.results?.length) {
    for (const result of msg.results) {
      const text = result.alternatives?.[0]?.transcript?.trim();
      if (!text) continue;
      const speaker = extractSpeaker(msg);
      const isFinal = result.is_final === true || result.isFinal === true || isFinalMessage(msg, type);
      if (isFinal) {
        const turn: TranscriptTurn = { speaker, text };
        turns.push(turn);
        callbacks.onFinalTurn?.(turn);
      } else {
        callbacks.onPartial?.(text, speaker);
      }
    }
    return;
  }

  if (msg.turns?.length) {
    for (const t of mapApiTurnsToTranscript(msg.turns)) {
      turns.push(t);
      callbacks.onFinalTurn?.(t);
    }
    return;
  }

  const text = extractText(msg);
  if (!text) return;

  const speaker = extractSpeaker(msg);
  const isFinal = isFinalMessage(msg, type);

  if (isFinal) {
    const turn: TranscriptTurn = { speaker, text };
    turns.push(turn);
    callbacks.onFinalTurn?.(turn);
  } else {
    callbacks.onPartial?.(text, speaker);
  }
}

export type SttConnectOptions = {
  /** PCM linear16 @ 16kHz is required for low-latency partial transcript from the gateway. */
  audioEncoding?: 'pcm' | 'webm';
};

export class SttWebSocketStream {
  private ws: WebSocket | null = null;
  private turns: TranscriptTurn[] = [];
  private closed = false;
  private audioEncoding: 'pcm' | 'webm' = 'pcm';

  connect(wsUrl: string, callbacks: SttStreamCallbacks, options?: SttConnectOptions): Promise<void> {
    this.audioEncoding = options?.audioEncoding ?? 'pcm';
    return new Promise((resolve, reject) => {
      this.turns = [];
      this.closed = false;

      const url = resolveSttWsUrl(wsUrl);
      const ws = new WebSocket(url);
      this.ws = ws;

      const connectTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          reject(new Error('WebSocket STT connection timeout'));
        }
      }, 10_000);

      ws.onopen = () => {
        clearTimeout(connectTimeout);
        try {
          if (this.audioEncoding === 'pcm') {
            ws.send(JSON.stringify({
              type: 'start',
              encoding: 'linear16',
              sample_rate: 16000,
              channels: 1,
              diarize: true,
              language: 'vi-VN',
            }));
          } else {
            ws.send(JSON.stringify({
              type: 'start',
              encoding: 'webm',
              diarize: true,
              language: 'vi-VN',
            }));
          }
        } catch {
          // Some gateways need no start message
        }
        callbacks.onConnected?.();
        resolve();
      };

      ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          parseServerMessage(event.data, callbacks, this.turns);
        } else if (event.data instanceof Blob) {
          event.data.text().then((t) => parseServerMessage(t, callbacks, this.turns)).catch(() => {});
        }
      };

      ws.onerror = () => {
        clearTimeout(connectTimeout);
        callbacks.onError?.('WebSocket STT connection failed');
        reject(new Error('WebSocket STT connection failed'));
      };

      ws.onclose = () => {
        this.closed = true;
      };
    });
  }

  sendAudioChunk(chunk: Blob): void {
    if (this.audioEncoding !== 'webm') return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || chunk.size === 0) return;
    this.ws.send(chunk);
  }

  sendPcmChunk(buffer: ArrayBuffer): void {
    if (this.audioEncoding !== 'pcm') return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || buffer.byteLength === 0) return;
    this.ws.send(buffer);
  }

  async stop(): Promise<TranscriptTurn[]> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: 'stop' }));
      } catch {
        // ignore
      }

      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 2500);
        const ws = this.ws!;
        ws.onmessage = (event) => {
          if (typeof event.data === 'string') {
            parseServerMessage(event.data, {}, this.turns);
          } else if (event.data instanceof Blob) {
            event.data.text().then((t) => parseServerMessage(t, {}, this.turns)).catch(() => {});
          }
        };
        ws.onclose = () => {
          clearTimeout(timer);
          resolve();
        };
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) ws.close();
        }, 2500);
      });
    }

    this.ws = null;
    return [...this.turns];
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getTurns(): TranscriptTurn[] {
    return [...this.turns];
  }

  disconnect(): void {
    if (this.ws) {
      try { this.ws.close(); } catch { /* ignore */ }
      this.ws = null;
    }
    this.closed = true;
  }

  get closedState(): boolean {
    return this.closed;
  }
}
