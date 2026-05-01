CREATE TABLE IF NOT EXISTS public.page_visits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id text NOT NULL DEFAULT '',
  slug text NOT NULL DEFAULT '',
  user_agent text NOT NULL DEFAULT '',
  referer text NOT NULL DEFAULT '',
  visited_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_visits_visited_at ON public.page_visits(visited_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_visits_session ON public.page_visits(session_id);

ALTER TABLE public.page_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert page visits"
  ON public.page_visits FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Anyone can read page visits"
  ON public.page_visits FOR SELECT TO public USING (true);