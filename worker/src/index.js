const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const ALLOWED_ORIGINS = new Set([
  'https://demo-rx.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);
const ALLOWED_MODELS = new Set([
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3.5-super-vl:free',
]);
const MAX_BODY_BYTES = 9 * 1024 * 1024;

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(data, status, origin) {
  return Response.json(data, { status, headers: cors(origin) });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    if (!ALLOWED_ORIGINS.has(origin)) {
      return json({ error: { message: 'Origin is not allowed.' } }, 403, origin);
    }
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/v1/chat/completions') {
      return json({ error: { message: 'Not found.' } }, 404, origin);
    }
    if (!env.OPENROUTER_API_KEY) {
      return json({ error: { message: 'Worker secret is not configured.' } }, 503, origin);
    }

    const length = Number(request.headers.get('Content-Length') || 0);
    if (length > MAX_BODY_BYTES) {
      return json({ error: { message: 'Image request is too large.' } }, 413, origin);
    }

    const clientKey = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rate = await env.SCAN_RATE_LIMITER.limit({ key: clientKey });
    if (!rate.success) {
      return json({ error: { message: 'Too many scans. Try again in one minute.' } }, 429, origin);
    }

    let body;
    try {
      const raw = await request.text();
      if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
        return json({ error: { message: 'Image request is too large.' } }, 413, origin);
      }
      body = JSON.parse(raw);
    } catch {
      return json({ error: { message: 'Invalid JSON body.' } }, 400, origin);
    }

    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const message = messages[0];
    const textPart = message?.content?.[0];
    const imagePart = message?.content?.[1];
    const validRequest = ALLOWED_MODELS.has(body?.model)
      && messages.length === 1
      && message.role === 'user'
      && message.content.length === 2
      && textPart?.type === 'text'
      && typeof textPart.text === 'string'
      && textPart.text.length <= 6000
      && imagePart?.type === 'image_url'
      && /^data:image\/(?:jpeg|png|webp);base64,/i.test(imagePart?.image_url?.url || '');
    if (!validRequest) {
      return json({ error: { message: 'Unsupported model or request.' } }, 400, origin);
    }

    const upstream = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://demo-rx.github.io/nutrition-food/',
        'X-Title': 'Healthy Nutrition Plan',
      },
      body: JSON.stringify({
        model: body.model,
        temperature: 0.2,
        messages: [message],
      }),
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        ...cors(origin),
        'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  },
};
