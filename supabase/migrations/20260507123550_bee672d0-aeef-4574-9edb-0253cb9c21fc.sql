ALTER TABLE public.tracked_events REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tracked_events;
CREATE INDEX IF NOT EXISTS idx_tracked_events_created_at ON public.tracked_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracked_events_event_session ON public.tracked_events(event_name, session_id);