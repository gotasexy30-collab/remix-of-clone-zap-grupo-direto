import { createHmac, timingSafeEqual } from 'node:crypto';


// Servidor apenas: não importar este módulo no frontend.
const AUDIO_BASE_URL = 'https://whatsapp-backend-vott.onrender.com';

const SERVER_DIALOGUE: Record<string, any> = {
  START: {
    messages: [ { type: 'audio', content: AUDIO_BASE_URL + '/audios/audio01.mp3', delay: 3000 } ],
    response: { type: 'text', next: 'AWAITING_CITY' }
  },
  AWAITING_CITY: {
    messages: [
      { type: 'audio', content: AUDIO_BASE_URL + '/audios/audio02.mp3', delay: 6000 },
      { type: 'image_with_location', content: {}, delay: 4500 },
      { type: 'text', content: 'Sou aqui de {{city}}', delay: 3000 },
      { type: 'text', content: 'Me diz de qual cidade você é amor 🥰😈', delay: 3500 }
    ],
    response: { type: 'text', next: 'AWAITING_ROMANCE_CHOICE' }
  },
  AWAITING_ROMANCE_CHOICE: {
    messages: [
      { type: 'audio', content: AUDIO_BASE_URL + '/audios/audio03.mp3', delay: 7000 },
      { type: 'audio', content: AUDIO_BASE_URL + '/audios/audio04.mp3', delay: 6000 }
    ],
    response: {
      type: 'buttons',
      options: [
        { text: "Sou mais safado", payload: "SELECT_NAUGHTY", next: 'NAUGHTY_PATH' },
        { text: "Sou mais Romântico", payload: "SELECT_CARING", next: 'CARING_PATH' }
      ]
    }
  },
  NAUGHTY_PATH: {
    messages: [ { type: 'audio', content: AUDIO_BASE_URL + '/audios/audio05.mp3', delay: 8000 } ],
    response: { type: 'continue', next: 'POST_CHOICE_AUDIO' }
  },
  CARING_PATH: {
    messages: [ { type: 'audio', content: AUDIO_BASE_URL + '/audios/audio06.mp3', delay: 8000 } ],
    response: { type: 'continue', next: 'POST_CHOICE_AUDIO' }
  },
  POST_CHOICE_AUDIO: {
    messages: [ { type: 'audio', content: AUDIO_BASE_URL + '/audios/audio07.mp3', delay: 9000 } ],
    response: { type: 'continue', next: 'AWAITING_CONFIRM_JOIN' }
  },
  AWAITING_CONFIRM_JOIN: {
    messages: [ { type: 'audio', content: AUDIO_BASE_URL + '/audios/audio08.mp3', delay: 7000 } ],
    response: {
      type: 'buttons',
      options: [ { text: "Entro sim meu amor ❤️", payload: "CONFIRM_JOIN", next: 'AWAITING_NO_OBJECTION' } ]
    }
  },
  AWAITING_NO_OBJECTION: {
    messages: [
      { type: 'audio', content: AUDIO_BASE_URL + '/audios/audio09.mp3', delay: 7000 },
      { type: 'audio', content: AUDIO_BASE_URL + '/audios/audio10.mp3', delay: 6000 },
      { type: 'audio', content: AUDIO_BASE_URL + '/audios/audio13.mp3', delay: 6500 },
      { type: 'image', content: 'https://midia.jdfnu287h7dujn2jndjsifd.com/oi6gtpxvamkpw9g2661pohgv.jpeg', delay: 5000 },
      { type: 'image', content: 'https://dimukzjiyqzdndqrbwkf.supabase.co/storage/v1/object/public/chat-assets/clube-secreto-preview.png', delay: 4000 },
    ],
    response: {
      type: 'buttons',
      options: [ { text: "Combinado❤️", payload: "CONFIRM_COMBINED", next: 'AWAITING_COMBINED' } ]
    }
  },
  AWAITING_COMBINED: {
    messages: [
      { type: 'audio', content: AUDIO_BASE_URL + '/audios/audio15.mp3', delay: 7000 },
      { type: 'audio', content: AUDIO_BASE_URL + '/audios/audio16.mp3', delay: 7000 }
    ],
    response: {
      type: 'buttons',
      options: [ { text: "Entendi meu amor❤️", payload: "CONFIRM_UNDERSTOOD", next: 'AWAITING_ENTER_CLUB' } ]
    }
  },
  AWAITING_ENTER_CLUB: {
    messages: [
      { type: 'audio', content: AUDIO_BASE_URL + '/audios/audio17.mp3', delay: 6000 },
      { type: 'audio', content: AUDIO_BASE_URL + '/audios/audio18.mp3', delay: 8000 },
      { type: 'audio', content: AUDIO_BASE_URL + '/audios/audio19.mp3', delay: 5000 },
      { type: 'gif', content: 'https://midia.jdfnu287h7dujn2jndjsifd.com/ohjlvxht3us81l3l5c6sckxx.gif', delay: 5000 },
      { type: 'audio', content: AUDIO_BASE_URL + '/audios/audio20.mp3', delay: 7000 },
      { type: 'image', content: 'https://dimukzjiyqzdndqrbwkf.supabase.co/storage/v1/object/public/chat-assets/chat-group-1.png', delay: 5000 },
      { type: 'image', content: 'https://dimukzjiyqzdndqrbwkf.supabase.co/storage/v1/object/public/chat-assets/chat-group-2.png', delay: 4500 },
      { type: 'audio', content: AUDIO_BASE_URL + '/audios/audio21.mp3', delay: 7000 },
      { type: 'audio', content: AUDIO_BASE_URL + '/audios/audio22.mp3', delay: 5000 },
      { type: 'audio', content: AUDIO_BASE_URL + '/audios/audio23.mp3', delay: 10000 }
    ],
    response: {
      type: 'buttons',
      options: [ { text: "ENTRAR NO CLUBE SECRETO 🔥", payload: "ENTER_CLUB", next: 'OPEN_PAYMENT_MODAL' } ]
    }
  },
  OPEN_PAYMENT_MODAL: {
    action: {
      type: 'open_payment'
    }
  }
};




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
