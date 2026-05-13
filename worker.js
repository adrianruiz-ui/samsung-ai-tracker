/**
 * Cloudflare Worker · Samsung AI Visibility Tracker
 * ─────────────────────────────────────────────────
 * Proxy seguro entre el frontend (GitHub Pages) y la API de Anthropic.
 * La API key de Anthropic nunca toca el navegador.
 *
 * Variables de entorno requeridas (Settings → Variables and Secrets):
 *   ANTHROPIC_API_KEY  (Secret)  → Tu API key desde console.anthropic.com
 *   APP_SECRET         (Secret)  → String random largo (compartido con el HTML)
 *   ALLOWED_ORIGINS    (Text)    → URL(s) de tu GitHub Pages, separadas por coma
 *                                  Ej: https://adrian-ganem.github.io
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS);
    const corsOrigin = pickCorsOrigin(origin, allowedOrigins);

    // Preflight CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(corsOrigin) });
    }

    // Solo aceptamos POST
    if (request.method !== 'POST') {
      return jsonError('Method not allowed', 405, corsOrigin);
    }

    // Validar origin (defensa contra navegadores)
    if (allowedOrigins.length > 0 && !allowedOrigins.includes(origin)) {
      return jsonError(`Origin not allowed: ${origin}`, 403, corsOrigin);
    }

    // Validar shared secret (defensa contra curl / scripts)
    const providedSecret = request.headers.get('X-App-Secret') || '';
    if (!env.APP_SECRET) {
      return jsonError('Worker not configured: APP_SECRET missing', 500, corsOrigin);
    }
    if (providedSecret !== env.APP_SECRET) {
      return jsonError('Unauthorized', 401, corsOrigin);
    }

    // Validar API key configurada
    if (!env.ANTHROPIC_API_KEY) {
      return jsonError('Worker not configured: ANTHROPIC_API_KEY missing', 500, corsOrigin);
    }

    // Forward al endpoint de Anthropic
    try {
      const body = await request.text();

      const anthropicResponse = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body,
      });

      const responseBody = await anthropicResponse.text();
      return new Response(responseBody, {
        status: anthropicResponse.status,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(corsOrigin),
        },
      });
    } catch (err) {
      return jsonError(`Upstream error: ${err.message}`, 502, corsOrigin);
    }
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────

function parseAllowedOrigins(raw) {
  if (!raw) return [];
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

function pickCorsOrigin(requestOrigin, allowedOrigins) {
  if (allowedOrigins.length === 0) return '*';
  if (allowedOrigins.includes(requestOrigin)) return requestOrigin;
  return allowedOrigins[0];
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-App-Secret',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function jsonError(message, status, corsOrigin) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(corsOrigin),
    },
  });
}
