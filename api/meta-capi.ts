import { createClient } from '@supabase/supabase-js';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version',
};

function createSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getCapiTokenFromDb(): Promise<string | null> {
  const admin = createSupabaseAdmin();
  if (!admin) return null;
  try {
    const { data, error } = await admin
      .from('app_settings')
      .select('value')
      .eq('key', 'meta_capi_token')
      .maybeSingle();
    if (error) throw error;
    return data?.value || null;
  } catch {
    return null;
  }
}

export default async function handler(req: any, res: any) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const pixelId = body.pixelId || body.pixel_id;
    if (!pixelId) {
      return res.status(400).json({ error: 'pixelId é obrigatório' });
    }

    let token = process.env.META_CAPI_TOKEN || '';
    if (!token) {
      token = (await getCapiTokenFromDb()) || '';
    }

    if (!token) {
      return res.status(500).json({
        error:
          'Token CAPI não configurado. Adicione META_CAPI_TOKEN nas variáveis de ambiente da Vercel, ou garanta que SUPABASE_SERVICE_ROLE_KEY esteja configurada para ler o token salvo no painel.',
      });
    }

    const payload = {
      data: [
        {
          action_source: body.action_source || 'website',
          event_name: body.event_name,
          event_time: body.event_time || Math.floor(Date.now() / 1000),
          event_id: body.event_id,
          user_data: body.user_data || {},
          custom_data: body.custom_data || {},
        },
      ],
      access_token: token,
    };

    const fbRes = await fetch(
      `https://graph.facebook.com/v18.0/${encodeURIComponent(pixelId)}/events`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    const fbText = await fbRes.text();
    let fbData: any = {};
    try {
      fbData = JSON.parse(fbText);
    } catch {
      fbData = { raw: fbText };
    }

    if (!fbRes.ok || fbData.error) {
      return res.status(fbRes.status || 500).json({
        error: 'Erro ao enviar evento para Meta CAPI',
        details: fbData,
      });
    }

    return res.status(200).json({ success: true, ...fbData });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erro interno no servidor' });
  }
}
