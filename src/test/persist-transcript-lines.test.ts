import { beforeEach, describe, expect, it, vi } from 'vitest';

const fromMock = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'doc-1' } } }),
    },
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import { persistTranscriptLines, resolveTranscriptTurns } from '@/lib/ai-assistant-api';

describe('resolveTranscriptTurns', () => {
  it('should use empty edited transcript instead of falling back to raw', () => {
    const raw = [{ speaker: 'patient' as const, text: '' }];
    expect(resolveTranscriptTurns([], raw)).toEqual([]);
  });

  it('should use raw when edited is null', () => {
    const raw = [{ speaker: 'doctor' as const, text: 'Khám họng' }];
    expect(resolveTranscriptTurns(null, raw)).toEqual(raw);
  });
});

describe('persistTranscriptLines', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it('should write both transcript_raw and transcript_edited', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    fromMock.mockReturnValue({ update });

    const lines = [{ speaker: 'patient' as const, text: 'Còn lại' }];
    await persistTranscriptLines('appt-1', lines);

    expect(fromMock).toHaveBeenCalledWith('voice_sessions');
    expect(update).toHaveBeenCalledWith({
      transcript_edited: lines,
      transcript_raw: lines,
    });
    expect(eq).toHaveBeenCalledWith('appointment_id', 'appt-1');
  });
});
