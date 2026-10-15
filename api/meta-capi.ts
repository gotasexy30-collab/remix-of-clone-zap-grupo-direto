import { createClient } from '@supabase/supabase-js';

const META_GRAPH_VERSION = 'v19.0';

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

function getClientIp(req: any): string {
  const candidates = [
    req.headers?.['x-forwarded-for'],
    req.headers?.['x-real-ip'],
    req.headers?.['cf-connecting-ip'],
    req.headers?.['true-client-ip'],
  ];

  for (const value of candidates) {
    if (!value) continue;
    let ip = String(value).split(',')[0].trim();
    ip = ip.replace(/^for=/i, '').replace(/^"|"$/g, '');
    if (/^\[.*\]:\d+$/.test(ip)) ip = ip.replace(/^\[(.*)\]:\d+$/, '$1');
    else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(ip)) ip = ip.replace(/:\d+$/, '');
    if (ip) return ip;
  }

  return '';
}

// Confere no servidor o Pixel configurado no painel. Nunca confia no ID
// enviado pelo navegador, que pode ter um localStorage antigo ou ser adulterado.
let configuredPixelCache: { id: string; expiresAt: number } | null = null;
const reportedMismatches = new Set<string>();

async function getConfiguredPixelId(): Promise<string | null> {
  if (configuredPixelCache && configuredPixelCache.expiresAt > Date.now()) {
    return configuredPixelCache.id;
  }

  const admin = createSupabaseAdmin();
  if (!admin) {
    console.error('[Meta CAPI] Acesso ao banco indisponível para resolver o Pixel atual.');
    return null;
  }
  try {
    const { data, error } = await admin
      .from('app_settings')
      .select('value')
      .eq('key', 'meta_pixel_id')
      .maybeSingle();
    if (error) throw error;
    const id = String(data?.value || '').trim();
    if (!/^\d{10,25}$/.test(id)) {
      console.error('[Meta CAPI] Pixel atual ausente ou inválido no banco.');
      return null;
    }
    // TTL curto evita uma consulta extra ao Supabase em todo evento.
    configuredPixelCache = { id, expiresAt: Date.now() + 30_000 };
    return id;
  } catch (error) {
    console.error('[Meta CAPI] Falha ao consultar Pixel configurado:', error);
    return null;
  }
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
    const pixelId = await getConfiguredPixelId();
    if (!pixelId) {
      // Falha fechada: é preferível não enviar o evento a escolher um Pixel incorreto.
      return res.status(503).json({ error: 'Pixel não disponível nas configurações do servidor.' });
    }
    const submittedPixelId = String(body?.pixelId || body?.pixel_id || '').trim();
    if (submittedPixelId && submittedPixelId !== pixelId && !reportedMismatches.has(submittedPixelId)) {
      console.warn('[Meta CAPI] ID de Pixel antigo/divergente ignorado:', submittedPixelId);
      if (reportedMismatches.size < 32) reportedMismatches.add(submittedPixelId);
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

    const clientIp = getClientIp(req);
    const userAgent = String(req.headers?.['user-agent'] || '');
    const userData = { ...(body.user_data || {}) };

    // O IP é obtido no servidor para não depender do navegador.
    if (clientIp) userData.client_ip_address = clientIp;
    if (!userData.client_user_agent && userAgent) userData.client_user_agent = userAgent;

    if (!userData.client_ip_address) {
      console.warn('[Meta CAPI] client_ip_address não encontrado nos cabeçalhos da requisição.');
    }

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
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(pixelId)}/events`,
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
