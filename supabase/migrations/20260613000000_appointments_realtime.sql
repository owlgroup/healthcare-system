-- Enable Realtime for appointments so admin receives INSERT events live.
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;

-- Full replica identity so UPDATE/DELETE payloads include old row data.
ALTER TABLE public.appointments REPLICA IDENTITY FULL;
