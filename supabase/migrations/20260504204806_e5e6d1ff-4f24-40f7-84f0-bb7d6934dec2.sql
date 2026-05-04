CREATE TABLE public.purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mp_payment_id TEXT NOT NULL UNIQUE,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  session_id TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'approved',
  approved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert purchases"
ON public.purchases FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Anyone can read purchases"
ON public.purchases FOR SELECT TO public USING (true);

CREATE INDEX idx_purchases_approved_at ON public.purchases(approved_at DESC);