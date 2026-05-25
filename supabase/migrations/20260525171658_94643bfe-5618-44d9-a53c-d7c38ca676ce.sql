
-- =========================
-- app_settings
-- =========================
DROP POLICY IF EXISTS "Anyone can read settings" ON public.app_settings;
DROP POLICY IF EXISTS "Anyone can insert settings" ON public.app_settings;
DROP POLICY IF EXISTS "Anyone can update settings" ON public.app_settings;

CREATE POLICY "Public can read whitelisted settings"
ON public.app_settings FOR SELECT
TO anon, authenticated
USING (key IN (
  'chat_profile_name',
  'chat_profile_photo',
  'chat_location_image',
  'meta_pixel_id',
  'pix_tutorial_video_url',
  'payment_redirect_link',
  'pix_success_url',
  'redirect_mobile_url',
  'redirect_desktop_url'
));

-- Remover credenciais sensíveis da tabela (agora estão em secrets)
DELETE FROM public.app_settings WHERE key IN ('admin_password', 'meta_capi_token');

-- =========================
-- lead_logs (bloquear público)
-- =========================
DROP POLICY IF EXISTS "Anyone can read lead logs" ON public.lead_logs;
DROP POLICY IF EXISTS "Anyone can insert lead logs" ON public.lead_logs;

-- =========================
-- purchases (bloquear público)
-- =========================
DROP POLICY IF EXISTS "Anyone can read purchases" ON public.purchases;
DROP POLICY IF EXISTS "Anyone can insert purchases" ON public.purchases;

-- =========================
-- whatsapp_numbers (bloquear público)
-- =========================
DROP POLICY IF EXISTS "Anyone can read whatsapp numbers" ON public.whatsapp_numbers;
DROP POLICY IF EXISTS "Anyone can update whatsapp numbers" ON public.whatsapp_numbers;

-- =========================
-- tracked_events (manter INSERT público, bloquear SELECT)
-- =========================
DROP POLICY IF EXISTS "Anyone can read tracked events" ON public.tracked_events;

-- =========================
-- page_visits (manter INSERT público, bloquear SELECT)
-- =========================
DROP POLICY IF EXISTS "Anyone can read page visits" ON public.page_visits;

-- =========================
-- Realtime: parar broadcast de tracked_events
-- =========================
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.tracked_events;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.page_visits;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.purchases;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
