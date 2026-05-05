CREATE TABLE public.tracked_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name text NOT NULL,
  session_id text NOT NULL DEFAULT '',
  slug text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX idx_tracked_events_event_created ON public.tracked_events(event_name, created_at DESC);
ALTER TABLE public.tracked_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert tracked events" ON public.tracked_events FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can read tracked events" ON public.tracked_events FOR SELECT TO public USING (true);