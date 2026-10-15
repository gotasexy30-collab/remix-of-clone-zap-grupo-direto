import { createHmac, timingSafeEqual } from 'node:crypto';
import { SERVER_DIALOGUE } from '../server/lead-dialogue';

// Rotas e conteúdo ficam exclusivamente no backend. Apenas a etapa alcançada
// é enviada ao navegador. A assinatura impede pular diretamente para etapas futuras.
type ProgressToken = {
  sid: string;
  step: string;
  readyAt: number;
  expiresAt: number;
};

const TOKEN_DURATION_MS = 45 * 60 * 1000;
const validSid = (sid: unknown) => typeof sid === 'string' && /^[a-zA-Z0-9_-]{16,90}$/.test(sid);

function getSecret(): string {
  const secret = process.env.LEAD_FLOW_SECRET || '';
  return secret.length >= 32 ? secret : '';
}

function signature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function signStep(token: ProgressToken, secret: string): string {
  const body = Buffer.from(JSON.stringify(token)).toString('base64url');
  return body + '.' + signature(body, secret);
}

function verifyStep(raw: unknown, sid: string, secret: string): ProgressToken | null {
  if (typeof raw !== 'string' || raw.length > 1500) return null;
  const [body, sig, ...extra] = raw.split('.');
  if (!body || !sig || extra.length || !/^[A-Za-z0-9_-]+$/.test(body)) return null;
  const expected = Buffer.from(signature(body, secret));
  const received = Buffer.from(sig);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as ProgressToken;
    if (parsed.sid !== sid ||
        typeof parsed.step !== 'string' ||
        !Object.prototype.hasOwnProperty.call(SERVER_DIALOGUE, parsed.step) ||
        !Number.isSafeInteger(parsed.readyAt) ||
        !Number.isSafeInteger(parsed.expiresAt) ||
        parsed.expiresAt < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function calculateReadyAt(stepId: string, now: number): number {
  const step = SERVER_DIALOGUE[stepId];
  const messages = step?.messages || [];
  const totalMs = messages.reduce((sum, message, index) => {
    const delayMs = stepId === 'START' && index === 0 ? 800 : Number(message.delay) || 1000;
    return sum + Math.max(0, Math.min(delayMs, 60000)) + 1500;
  }, 0);
  // Margem para pequenas diferenças de relógio e agendamento do navegador.
  return now + Math.max(0, totalMs - 1500);
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  const secret = getSecret();
  if (!secret) return res.status(503).json({ error: 'Serviço de conversa não configurado.' });

  const origin = String(req.headers?.origin || '');
  const host = String(req.headers?.host || '');
  if (origin) {
    try {
      if (!host || new URL(origin).host !== host) return res.status(403).json({ error: 'Origem inválida.' });
    } catch {
      return res.status(403).json({ error: 'Origem inválida.' });
    }
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const sid = body.session_id;
    if (!validSid(sid)) return res.status(400).json({ error: 'Sessão inválida.' });

    let stepId = 'START';
    if (body.token != null) {
      const old = verifyStep(body.token, sid, secret);
      if (!old) return res.status(403).json({ error: 'Etapa inválida ou expirada. Recarregue a página.' });

      const waitMs = old.readyAt - Date.now();
      if (waitMs > 0) {
        return res.status(425).json({ error: 'Aguarde esta etapa.', retryAfterMs: Math.min(waitMs + 100, 60000) });
      }

      const previous = SERVER_DIALOGUE[old.step];
      const response = previous?.response;
      if (!response) return res.status(400).json({ error: 'Conversa concluída.' });

      if (body.action === 'text' && response.type === 'text') {
        stepId = response.next || '';
      } else if (body.action === 'continue' && response.type === 'continue') {
        stepId = response.next || '';
      } else if (body.action === 'choice' && response.type === 'buttons') {
        const chosen = response.options?.find(opt => opt.payload === body.choice);
        stepId = chosen?.next || '';
      } else {
        return res.status(400).json({ error: 'Resposta incompatível com esta etapa.' });
      }
      if (!Object.prototype.hasOwnProperty.call(SERVER_DIALOGUE, stepId)) {
        return res.status(400).json({ error: 'Próxima etapa não encontrada.' });
      }
    } else if (body.action !== 'start') {
      return res.status(400).json({ error: 'Início de conversa inválido.' });
    }

    const step = SERVER_DIALOGUE[stepId];
    // Não enviar os destinos das próximas etapas, nem o mapa de diálogos.
    const safeResponse = step.response ? {
      type: step.response.type,
      options: step.response.options?.map(option => ({ text: option.text, payload: option.payload })),
    } : undefined;
    const now = Date.now();
    return res.status(200).json({
      stepId,
      step: {
        messages: step.messages || [],
        response: safeResponse,
        action: step.action?.type === 'open_payment' ? { type: 'open_payment' } : undefined,
      },
      token: signStep({
        sid,
        step: stepId,
        readyAt: calculateReadyAt(stepId, now),
        expiresAt: now + TOKEN_DURATION_MS,
      }, secret),
    });
  } catch (error) {
    console.error('[lead-step] Falha ao entregar etapa', error);
    return res.status(500).json({ error: 'Não foi possível carregar a conversa. Tente novamente.' });
  }
}
