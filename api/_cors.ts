const nativeAppOrigins = new Set([
  'https://localhost',
  'http://localhost',
  'capacitor://localhost',
]);

function configuredOrigins(): Set<string> {
  const origins = new Set(nativeAppOrigins);
  for (const value of [process.env.APP_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]) {
    if (!value) continue;
    try {
      origins.add(new URL(value.startsWith('http') ? value : `https://${value}`).origin);
    } catch {
      // Invalid server configuration is handled by the endpoint that uses it.
    }
  }
  return origins;
}

function allowedOrigin(request: Request): string | null {
  const origin = request.headers.get('origin');
  return origin && configuredOrigins().has(origin) ? origin : null;
}

function corsHeaders(request: Request, methods: string): Headers {
  const headers = new Headers({
    'access-control-allow-headers': 'authorization, content-type, x-slipstream-promo',
    'access-control-allow-methods': methods,
    'access-control-max-age': '600',
    vary: 'Origin',
  });
  const origin = allowedOrigin(request);
  if (origin) headers.set('access-control-allow-origin', origin);
  return headers;
}

export function corsPreflight(request: Request, methods: string): Response | null {
  if (request.method !== 'OPTIONS') return null;
  if (!allowedOrigin(request)) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: corsHeaders(request, methods) });
}

export function withCors(request: Request, response: Response, methods: string): Response {
  const headers = new Headers(response.headers);
  corsHeaders(request, methods).forEach((value, name) => headers.set(name, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
