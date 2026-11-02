import { describe, expect, it } from 'vitest';
import { resolveSttWsUrl } from '@/lib/stt-ws-stream';

describe('resolveSttWsUrl', () => {
  it('returns absolute wss URLs unchanged', () => {
    expect(resolveSttWsUrl('wss://example.com/stt/ws/abc')).toBe('wss://example.com/stt/ws/abc');
  });

  it('resolves relative paths against STT base URL', () => {
    const resolved = resolveSttWsUrl('/stt/ws/session-123');
    expect(resolved).toMatch(/^wss:\/\//);
    expect(resolved).toContain('/stt/ws/session-123');
  });
});
