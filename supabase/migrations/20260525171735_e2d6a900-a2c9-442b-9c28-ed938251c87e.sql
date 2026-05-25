
DROP POLICY IF EXISTS "Anyone can insert tracked events" ON public.tracked_events;
CREATE POLICY "Public can insert tracked events"
ON public.tracked_events FOR INSERT
TO anon, authenticated
WITH CHECK (
  event_name IS NOT NULL
  AND length(event_name) BETWEEN 1 AND 100
  AND length(coalesce(session_id, '')) <= 200
  AND length(coalesce(slug, '')) <= 200
);

DROP POLICY IF EXISTS "Anyone can insert page visits" ON public.page_visits;
CREATE POLICY "Public can insert page visits"
ON public.page_visits FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(coalesce(session_id, '')) <= 200
  AND length(coalesce(slug, '')) <= 200
  AND length(coalesce(user_agent, '')) <= 1000
  AND length(coalesce(referer, '')) <= 2000
);
