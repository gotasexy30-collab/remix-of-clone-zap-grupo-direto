-- Tabela de números de WhatsApp
CREATE TABLE public.whatsapp_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  label text NOT NULL DEFAULT '',
  link text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  manually_disabled boolean NOT NULL DEFAULT false,
  hourly_limit integer NOT NULL DEFAULT 30,
  total_leads integer NOT NULL DEFAULT 0,
  last_lead_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_numbers ENABLE ROW LEVEL SECURITY;

-- Leitura pública (necessário para escolher número no frontend)
CREATE POLICY "Anyone can read whatsapp numbers"
  ON public.whatsapp_numbers FOR SELECT
  USING (true);

-- Atualização pública (para incrementar contadores no log_lead)
CREATE POLICY "Anyone can update whatsapp numbers"
  ON public.whatsapp_numbers FOR UPDATE
  USING (true);

-- Insert/Delete apenas via edge function (service role bypassa RLS)
-- Sem policies = bloqueado para anon

CREATE TRIGGER update_whatsapp_numbers_updated_at
  BEFORE UPDATE ON public.whatsapp_numbers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de logs de leads
CREATE TABLE public.lead_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_number_id uuid REFERENCES public.whatsapp_numbers(id) ON DELETE SET NULL,
  whatsapp_phone text NOT NULL DEFAULT '',
  message_text text NOT NULL DEFAULT '',
  user_agent text DEFAULT '',
  referer text DEFAULT '',
  session_id text DEFAULT '',
  redirected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_logs ENABLE ROW LEVEL SECURITY;

-- Qualquer um pode inserir log (clique no botão)
CREATE POLICY "Anyone can insert lead logs"
  ON public.lead_logs FOR INSERT
  WITH CHECK (true);

-- Leitura pública (para o painel admin)
CREATE POLICY "Anyone can read lead logs"
  ON public.lead_logs FOR SELECT
  USING (true);

CREATE INDEX idx_lead_logs_redirected_at ON public.lead_logs(redirected_at DESC);
CREATE INDEX idx_lead_logs_number_id ON public.lead_logs(whatsapp_number_id);