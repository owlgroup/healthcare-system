import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import VoiceRecordingHistory from '@/components/emr/VoiceRecordingHistory';
import type { RecordingPlaybackItem } from '@/components/emr/VoiceRecordingHistory';

function rec(id: string, createdAt: string): RecordingPlaybackItem {
  return {
    id,
    appointment_id: 'appt-1',
    doctor_id: 'doc-1',
    audio_storage_path: `${id}.webm`,
    duration_seconds: 14,
    transcript_snapshot: [{ speaker: 'doctor', text: 'Cũ' }],
    created_at: createdAt,
  };
}

const recA = rec('rec-a', '2026-09-19T00:11:00.000Z');
const recB = rec('rec-b', '2026-09-18T16:09:00.000Z');

function openDialog() {
  fireEvent.click(screen.getByRole('button', { name: /Bản ghi phiên khám/i }));
}

describe('VoiceRecordingHistory regenerate', () => {
  it('should check all recording rows by default', () => {
    const onRegenerate = vi.fn();
    render(
      <VoiceRecordingHistory
        recordings={[recA, recB]}
        resolveAudioUrl={vi.fn()}
        onRegenerate={onRegenerate}
      />
    );
    openDialog();

    expect(screen.getByRole('checkbox', { name: /Bản ghi #2/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Bản ghi #1/i })).toBeChecked();
    expect(screen.getByRole('button', { name: /Gen lại transcript/i })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: /Gen lại transcript/i }));
    expect(onRegenerate).toHaveBeenCalledWith([recA, recB]);
  });

  it('should disable Gen lại transcript after unchecking every recording', () => {
    render(
      <VoiceRecordingHistory
        recordings={[recA, recB]}
        resolveAudioUrl={vi.fn()}
        onRegenerate={vi.fn()}
      />
    );
    openDialog();

    fireEvent.click(screen.getByRole('checkbox', { name: /Bản ghi #2/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Bản ghi #1/i }));

    expect(screen.getByRole('button', { name: /Gen lại transcript/i })).toBeDisabled();
  });
});
