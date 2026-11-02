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

import { persistRegeneratedTranscript } from '@/lib/ai-assistant-api';

describe('persistRegeneratedTranscript', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it('should write full appended transcript to voice_sessions and new turns to recording snapshot', async () => {
    const sessionEq = vi.fn().mockResolvedValue({ error: null });
    const sessionUpdate = vi.fn().mockReturnValue({ eq: sessionEq });
    const recordingEq = vi.fn().mockResolvedValue({ error: null });
    const recordingUpdate = vi.fn().mockReturnValue({ eq: recordingEq });

    fromMock.mockImplementation((table: string) => {
      if (table === 'voice_sessions') return { update: sessionUpdate };
      if (table === 'consultation_recordings') return { update: recordingUpdate };
      throw new Error(`unexpected table ${table}`);
    });

    const fullTranscript = [
      { speaker: 'doctor' as const, text: 'Cũ' },
      { speaker: 'patient' as const, text: 'Mới' },
    ];
    const newTurns = [{ speaker: 'patient' as const, text: 'Mới' }];

    await persistRegeneratedTranscript({
      appointmentId: 'appt-1',
      fullTranscript,
      recordingId: 'rec-9',
      newTurns,
    });

    expect(fromMock).toHaveBeenCalledWith('voice_sessions');
    expect(sessionUpdate).toHaveBeenCalledWith({
      transcript_raw: fullTranscript,
      transcript_edited: fullTranscript,
    });
    expect(sessionEq).toHaveBeenCalledWith('appointment_id', 'appt-1');

    expect(fromMock).toHaveBeenCalledWith('consultation_recordings');
    expect(recordingUpdate).toHaveBeenCalledWith({ transcript_snapshot: newTurns });
    expect(recordingEq).toHaveBeenCalledWith('id', 'rec-9');
  });

  it('should throw when voice_sessions update fails', async () => {
    fromMock.mockReturnValue({
      update: () => ({
        eq: vi.fn().mockResolvedValue({ error: { message: 'session write failed' } }),
      }),
    });

    await expect(
      persistRegeneratedTranscript({
        appointmentId: 'appt-1',
        fullTranscript: [{ speaker: 'doctor', text: 'A' }],
        recordingId: 'rec-1',
        newTurns: [{ speaker: 'doctor', text: 'A' }],
      })
    ).rejects.toThrow('session write failed');
  });
});
