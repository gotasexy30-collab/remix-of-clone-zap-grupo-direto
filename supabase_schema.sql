-- Script SQL para configurar o banco de dados do Supabase
-- Este script cria todas as tabelas necessárias e aplica as políticas de segurança (RLS).

-- 1. Criar tabelas

-- Tabela de configurações globais
CREATE TABLE IF NOT EXISTS public.app_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de números de WhatsApp para o roteador
CREATE TABLE IF NOT EXISTS public.whatsapp_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT NOT NULL,
    phone TEXT NOT NULL,
    link TEXT NOT NULL,
    status TEXT DEFAULT 'active', -- active, inactive, auto_paused
    manually_disabled BOOLEAN DEFAULT false,
    hourly_limit INTEGER DEFAULT 30,
    total_leads INTEGER DEFAULT 0,
    last_lead_at TIMESTAMPTZ,
    last_assigned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de logs de leads (redirecionamentos)
CREATE TABLE IF NOT EXISTS public.lead_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    whatsapp_number_id UUID REFERENCES public.whatsapp_numbers(id) ON DELETE SET NULL,
    whatsapp_phone TEXT NOT NULL,
    message_text TEXT,
    session_id TEXT,
    user_agent TEXT,
    referer TEXT,
    redirected_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de visitas à página
CREATE TABLE IF NOT EXISTS public.page_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    slug TEXT NOT NULL,
    user_agent TEXT,
    referer TEXT,
    visited_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de eventos rastreados (Pixel/Funil)
CREATE TABLE IF NOT EXISTS public.tracked_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_name TEXT NOT NULL,
    session_id TEXT NOT NULL,
    slug TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de compras/pagamentos
CREATE TABLE IF NOT EXISTS public.purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mp_payment_id TEXT UNIQUE NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    status TEXT DEFAULT 'pending',
    session_id TEXT,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Conceder permissões para a API do Supabase

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT SELECT ON public.app_settings TO anon;
GRANT ALL ON public.app_settings TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_numbers TO authenticated;
GRANT SELECT ON public.whatsapp_numbers TO anon;
GRANT ALL ON public.whatsapp_numbers TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_logs TO authenticated;
GRANT INSERT ON public.lead_logs TO anon;
GRANT ALL ON public.lead_logs TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_visits TO authenticated;
GRANT INSERT ON public.page_visits TO anon;
GRANT ALL ON public.page_visits TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tracked_events TO authenticated;
GRANT INSERT ON public.tracked_events TO anon;
GRANT ALL ON public.tracked_events TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.purchases TO anon;
GRANT ALL ON public.purchases TO service_role;

-- 3. Habilitar RLS (Row Level Security)

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracked_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- 4. Criar Políticas de RLS

-- app_settings: Público pode ler chaves não sensíveis, usuários autenticados têm controle total.
CREATE POLICY "Public read settings" ON public.app_settings FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated full access settings" ON public.app_settings FOR ALL TO authenticated USING (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;

-- whatsapp_numbers: Público pode ler para o roteador, apenas admins editam.
CREATE POLICY "Public read numbers" ON public.whatsapp_numbers FOR SELECT TO anon USING (true);
CREATE POLICY "Admins full access numbers" ON public.whatsapp_numbers FOR ALL TO authenticated USING (true);

-- lead_logs: Público insere, apenas admins leem.
CREATE POLICY "Public insert logs" ON public.lead_logs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Admins read logs" ON public.lead_logs FOR SELECT TO authenticated USING (true);

-- page_visits: Público insere, apenas admins leem.
CREATE POLICY "Public insert visits" ON public.page_visits FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Admins read visits" ON public.page_visits FOR SELECT TO authenticated USING (true);

-- tracked_events: Público insere, apenas admins leem.
CREATE POLICY "Public insert events" ON public.tracked_events FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Admins read events" ON public.tracked_events FOR SELECT TO authenticated USING (true);

-- purchases: Público insere/lê as próprias (via session_id se implementado), admins tudo.
CREATE POLICY "Public insert purchases" ON public.purchases FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Public read own purchases" ON public.purchases FOR SELECT TO anon USING (true);
CREATE POLICY "Admins full access purchases" ON public.purchases FOR ALL TO authenticated USING (true);

-- 5. Função para atualizar o updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_app_settings_updated_at BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_whatsapp_numbers_updated_at BEFORE UPDATE ON public.whatsapp_numbers FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
