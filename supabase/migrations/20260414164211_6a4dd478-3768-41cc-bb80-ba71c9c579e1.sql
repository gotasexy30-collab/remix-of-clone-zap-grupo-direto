INSERT INTO storage.buckets (id, name, public) VALUES ('chat-assets', 'chat-assets', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow public read access on chat-assets" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'chat-assets');