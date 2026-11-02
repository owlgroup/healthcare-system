/**
 * Button + dialog listing saved consultation recordings.
 */

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Headphones, Loader2, Play, Pause, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { ConsultationRecording } from '@/lib/ai-assistant-api';

export type RecordingPlaybackItem = ConsultationRecording & {
  audioUrl?: string | null;
};

type VoiceRecordingHistoryProps = {
  recordings: RecordingPlaybackItem[];
  loading?: boolean;
  resolveAudioUrl: (storagePath: string) => Promise<string | null>;
  onRegenerate?: (recordings: RecordingPlaybackItem[]) => void;
  regenerating?: boolean;
  busy?: boolean;
};

export default function VoiceRecordingHistory({
  recordings, loading, resolveAudioUrl, onRegenerate, regenerating, busy,
}: VoiceRecordingHistoryProps) {
  const [open, setOpen] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>(() => recordings.map((rec) => rec.id));

  useEffect(() => {
    setSelectedIds(recordings.map((rec) => rec.id));
  }, [recordings]);

  const count = recordings.length;
  const selectedRecordings = recordings.filter((rec) => selectedIds.includes(rec.id));
  const canRegenerate = Boolean(onRegenerate)
    && selectedRecordings.length > 0
    && !busy
    && !regenerating;

  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((item) => item !== id);
    });
  };

  const handlePlay = useCallback(async (rec: RecordingPlaybackItem) => {
    if (playingId === rec.id) {
      setPlayingId(null);
      return;
    }

    let url = rec.audioUrl ?? audioUrls[rec.id];
    if (!url) {
      setLoadingId(rec.id);
      try {
        url = await resolveAudioUrl(rec.audio_storage_path) ?? undefined;
        if (url) setAudioUrls((prev) => ({ ...prev, [rec.id]: url! }));
      } finally {
        setLoadingId(null);
      }
    }
    if (!url) return;

    setPlayingId(rec.id);
    const audio = new Audio(url);
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => setPlayingId(null);
    try {
      await audio.play();
    } catch {
      setPlayingId(null);
    }
  }, [playingId, audioUrls, resolveAudioUrl]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full h-10 gap-2 justify-center rounded-xl border-slate-200 bg-slate-50/80 hover:bg-slate-100 font-medium text-sm"
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Headphones className="h-4 w-4 text-primary" />
          )}
          Bản ghi phiên khám ({loading ? '…' : count})
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Headphones className="h-5 w-5 text-primary" />
            Bản ghi phiên khám ({count})
          </DialogTitle>
          <DialogDescription className="text-xs">
            Tích chọn file ghi âm rồi bấm Gen lại transcript.
          </DialogDescription>
        </DialogHeader>

        {count === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Chưa có bản ghi nào. Bấm &quot;Bắt đầu ghi âm realtime&quot; để lưu phiên khám.
          </p>
        ) : (
          <div className="space-y-2 max-h-[min(60vh,420px)] overflow-y-auto pr-1">
            {recordings.map((rec, idx) => {
              const label = count - idx;
              const isPlaying = playingId === rec.id;
              const isLoading = loadingId === rec.id;
              const duration = rec.duration_seconds
                ? `${Math.floor(rec.duration_seconds / 60)}:${String(rec.duration_seconds % 60).padStart(2, '0')}`
                : null;
              const src = rec.audioUrl ?? audioUrls[rec.id];
              const checked = selectedIds.includes(rec.id);
              const rowLabel = `Bản ghi #${label}`;

              return (
                <div
                  key={rec.id}
                  className="rounded-lg border bg-card px-3 py-2.5 space-y-2"
                >
                  <div className="flex items-start gap-2">
                    {onRegenerate && (
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => toggleSelected(rec.id, !!value)}
                        className="mt-1"
                        aria-label={rowLabel}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {rowLabel}
                        {duration && (
                          <span className="text-muted-foreground font-normal ml-1.5">· {duration}</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(rec.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                      </p>
                    </div>
                    {/* <Button
                      type="button"
                      size="sm"
                      variant={isPlaying ? 'secondary' : 'default'}
                      className="h-8 px-2.5 gap-1 shrink-0 text-xs"
                      disabled={isLoading}
                      onClick={() => void handlePlay(rec)}
                    >
                      {isLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : isPlaying ? (
                        <Pause className="h-3.5 w-3.5" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                      {isPlaying ? 'Dừng' : 'Nghe'}
                    </Button> */}
                  </div>
                  {src && (
                    <audio
                      src={src}
                      controls
                      preload="metadata"
                      className="w-full h-8"
                      onPlay={() => setPlayingId(rec.id)}
                      onPause={() => setPlayingId((id) => (id === rec.id ? null : id))}
                      onEnded={() => setPlayingId((id) => (id === rec.id ? null : id))}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {onRegenerate && count > 0 && (
          <div className="flex justify-end pt-1">
            <Button
              type="button"
              size="sm"
              className="h-9 px-3 gap-1.5"
              disabled={!canRegenerate}
              onClick={() => onRegenerate(selectedRecordings)}
            >
              {regenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Gen lại transcript
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
