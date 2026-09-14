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

    const testEventCode = String(body.test_event_code || '').trim();
    if (testEventCode && !/^TEST\d{1,30}$/.test(testEventCode)) {
      return res.status(400).json({ error: 'Código de teste inválido. Use o formato TEST seguido de números.' });
    }

    // Prepara e flexibiliza a leitura do novo token CAPI
    let token = process.env.META_CAPI_TOKEN || process.env.VITE_META_CAPI_TOKEN || '';
    if (!token) {
      token = (await getCapiTokenFromDb()) || '';
    }

    if (!token) {
      console.error('[Meta CAPI] Token não configurado no banco ou nas variáveis de ambiente.');
      return res.status(500).json({
        error:
          'Token CAPI não configurado. Adicione META_CAPI_TOKEN nas variáveis de ambiente da Vercel, ou garanta que SUPABASE_SERVICE_ROLE_KEY esteja configurada para ler o token salvo no painel.',
      });
    }

    const forwardedFor = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
    const userAgent = String(req.headers?.['user-agent'] || '');
    const userData = { ...(body.user_data || {}) };
    if (!userData.client_ip_address && forwardedFor) userData.client_ip_address = forwardedFor;
    if (!userData.client_user_agent && userAgent) userData.client_user_agent = userAgent;

    const payload: Record<string, unknown> = {
      data: [
        {
          action_source: body.action_source || 'website',
          event_name: body.event_name,
          event_time: body.event_time || Math.floor(Date.now() / 1000),
          event_id: body.event_id,
          event_source_url: body.event_source_url || String(req.headers?.referer || req.headers?.origin || ''),
          user_data: userData,
          custom_data: body.custom_data || {},
        },
      ],
      access_token: token,
    };
    if (testEventCode) payload.test_event_code = testEventCode;

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
      console.error('[Meta CAPI] Erro ao enviar evento:', fbData.error || fbData);
      return res.status(fbRes.status || 500).json({
        error: 'Erro ao enviar evento para Meta CAPI',
        details: fbData.error || fbData,
      });
    }

    return res.status(200).json({ success: true, ...fbData });
  } catch (error: any) {
    console.error('[Meta CAPI] Erro interno:', error);
    return res.status(500).json({ error: error.message || 'Erro interno no servidor' });
  }
}
