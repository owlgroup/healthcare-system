-- FR-021: Check-in & AI Routing — Enable Supabase Realtime on queue_entries
-- This allows the frontend to subscribe to queue changes via postgres_changes.
-- Required for: AdminQueueBoard, DoctorQueuePanel, PublicQueueDisplay.

-- ─── Add queue_entries to the realtime publication ────────────────────────────

alter publication supabase_realtime add table public.queue_entries;

comment on table public.queue_entries is
  'Live patient queue for FR-021. Realtime-enabled: subscribe via postgres_changes '
  'on the queue-updates channel for live queue board and doctor dashboard updates.';
