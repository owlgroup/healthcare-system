import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { regenerateTranscriptFromAudio } from '@/lib/stt-nlp-api';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('regenerateTranscriptFromAudio', () => {
  const audioBlob = new Blob(['audio-bytes'], { type: 'audio/webm' });
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return a single doctor turn when only transcribe is selected', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ transcript: 'Đau họng ba ngày.', turns: [] })
    );

    const result = await regenerateTranscriptFromAudio({
      audioBlob,
      apis: { transcribe: true, diarize: false, session: false },
    });

    expect(result.turns).toEqual([{ speaker: 'doctor', text: 'Đau họng ba ngày.' }]);
    expect(result.plainTranscript).toBe('Đau họng ba ngày.');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/stt/transcribe');
    expect(String(fetchMock.mock.calls[0][0])).toContain('diarize=false');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('should diarize transcript when transcribe returns no turns', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ transcript: 'Bác sĩ hỏi. Bệnh nhân trả lời.', turns: [] }))
      .mockResolvedValueOnce(jsonResponse({
        turns: [
          { speaker: 'doctor', text: 'Bác sĩ hỏi.' },
          { speaker: 'patient', text: 'Bệnh nhân trả lời.' },
        ],
      }));

    const result = await regenerateTranscriptFromAudio({
      audioBlob,
      apis: { transcribe: true, diarize: true, session: false },
    });

    expect(result.turns).toEqual([
      { speaker: 'doctor', text: 'Bác sĩ hỏi.' },
      { speaker: 'patient', text: 'Bệnh nhân trả lời.' },
    ]);
    expect(String(fetchMock.mock.calls[0][0])).toContain('diarize=true');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/stt/diarize');
  });

  it('should diarize existing text without fetching audio when only diarize is selected', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      turns: [{ role: 'patient', text: 'Tôi đau đầu.' }],
    }));

    const result = await regenerateTranscriptFromAudio({
      existingTranscript: 'Tôi đau đầu.',
      apis: { transcribe: false, diarize: true, session: false },
    });

    expect(result.turns).toEqual([{ speaker: 'patient', text: 'Tôi đau đầu.' }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/stt/diarize');
  });

  it('should keep transcribe when session create fails', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ detail: 'session down' }, 502))
      .mockResolvedValueOnce(jsonResponse({
        transcript: 'Nội dung.',
        turns: [{ speaker: 'doctor', text: 'Nội dung.' }],
      }));

    const result = await regenerateTranscriptFromAudio({
      audioBlob,
      apis: { transcribe: true, diarize: false, session: true },
      session: { appointmentId: 'appt-1', doctorId: 'doc-1' },
    });

    expect(result.turns).toEqual([{ speaker: 'doctor', text: 'Nội dung.' }]);
    expect(result.sessionWarning).toBeTruthy();
    expect(String(fetchMock.mock.calls[0][0])).toContain('/stt/sessions');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/stt/transcribe');
  });

  it('should throw when neither transcribe nor diarize is selected', async () => {
    await expect(
      regenerateTranscriptFromAudio({
        audioBlob,
        apis: { transcribe: false, diarize: false, session: true },
      })
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
