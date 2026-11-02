// FR-021: Check-in & AI Routing — Realtime queue hook
// Mirrors the useDoctorNotifications pattern.
// Subscribes to postgres_changes on queue_entries with 10s polling fallback.

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  fetchAllQueueEntries,
  fetchDoctorQueue,
  fetchRoomQueue,
} from '@/lib/queue-api';
import type { QueueEntry } from '@/types/queue';

interface UseQueueUpdatesOptions {
  roomId?: string;
  doctorId?: string;
  /** Date string YYYY-MM-DD — defaults to today */
  date?: string;
}

interface UseQueueUpdatesResult {
  entries: QueueEntry[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useQueueUpdates(
  options: UseQueueUpdatesOptions = {},
): UseQueueUpdatesResult {
  const { roomId, doctorId, date } = options;

  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const channelRef    = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pollTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectedRef  = useRef(false);

  // ─── Load data ─────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    try {
      let data: QueueEntry[];
      if (roomId) {
        data = await fetchRoomQueue(roomId);
      } else if (doctorId) {
        data = await fetchDoctorQueue(doctorId);
      } else {
        data = await fetchAllQueueEntries(date);
      }
      setEntries(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [roomId, doctorId, date]);

  // ─── Initial load ──────────────────────────────────────────────────────────

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  // ─── Polling fallback (10s when Realtime is disconnected) ──────────────────

  const startPolling = useCallback(() => {
    if (pollTimerRef.current) return;
    pollTimerRef.current = setInterval(() => {
      void load();
    }, 10_000);
  }, [load]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // ─── Supabase Realtime subscription ────────────────────────────────────────

  useEffect(() => {
    const channelName = roomId
      ? `queue-updates-room-${roomId}`
      : doctorId
      ? `queue-updates-doctor-${doctorId}`
      : 'queue-updates-all';

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'queue_entries',
          // Filter server-side when possible
          ...(roomId ? { filter: `room_id=eq.${roomId}` } : {}),
        },
        (_payload) => {
          // Re-fetch on any change to get consistent joined data
          void load();
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          connectedRef.current = true;
          stopPolling();
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          connectedRef.current = false;
          startPolling();
        }
      });

    channelRef.current = channel;

    // Start polling as fallback until Realtime confirms SUBSCRIBED
    const fallbackTimer = setTimeout(() => {
      if (!connectedRef.current) {
        startPolling();
      }
    }, 5_000);

    return () => {
      clearTimeout(fallbackTimer);
      stopPolling();
      void supabase.removeChannel(channel);
    };
  }, [roomId, doctorId, load, startPolling, stopPolling]);

  return { entries, loading, error, refetch: load };
}
