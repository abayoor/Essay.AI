import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import coachAnalyze from './api/coach/analyze';
import aiAssist from './api/ai/assist';
import billingCheckout from './api/billing/checkout';
import billingPortal from './api/billing/portal';
import billingStatus from './api/billing/status';
import proAnalyze from './api/pro/analyze';
import routeDirections from './api/routes/directions';

type FetchHandler = { fetch(request: Request): Promise<Response> };

function localApiPlugin(): Plugin {
  const handlers = new Map<string, FetchHandler>([
    ['/api/coach/analyze', coachAnalyze],
    ['/api/ai/assist', aiAssist],
    ['/api/billing/checkout', billingCheckout],
    ['/api/billing/portal', billingPortal],
    ['/api/billing/status', billingStatus],
    ['/api/pro/analyze', proAnalyze],
    ['/api/routes/directions', routeDirections],
  ]);
  return {
    name: 'slipstream-local-api',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
        const handler = handlers.get(pathname);
        if (!handler) {
          next();
          return;
        }
        try {
          const headers = new Headers();
          Object.entries(request.headers).forEach(([name, value]) => {
            if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
            else if (value !== undefined) headers.set(name, value);
          });
          let body = '';
          if (request.method !== 'GET' && request.method !== 'HEAD') {
            for await (const chunk of request) body += String(chunk);
          }
          const origin = `http://${request.headers.host ?? 'localhost'}`;
          const apiResponse = await handler.fetch(new Request(new URL(request.url ?? pathname, origin), {
            method: request.method,
            headers,
            body: body || undefined,
          }));
          response.statusCode = apiResponse.status;
          apiResponse.headers.forEach((value, name) => response.setHeader(name, value));
          response.end(Buffer.from(await apiResponse.arrayBuffer()));
        } catch (error) {
          response.statusCode = 500;
          response.setHeader('content-type', 'application/json; charset=utf-8');
          response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Локальный API временно недоступен.' }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  ['APP_URL', 'BILLING_ENABLED', 'SUPPORT_EMAIL', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GEMINI_MODEL', 'OPENAI_API_KEY', 'OPENAI_MODEL', 'ORS_API_KEY', 'LEMON_SQUEEZY_API_KEY', 'LEMON_SQUEEZY_STORE_ID', 'LEMON_SQUEEZY_VARIANT_ID', 'LEMON_SQUEEZY_ALLOW_TEST_MODE', 'POLAR_ACCESS_TOKEN', 'POLAR_PRODUCT_ID', 'POLAR_ENVIRONMENT', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].forEach((name) => {
    if (!process.env[name] && env[name]) process.env[name] = env[name];
  });
  return {
    plugins: [react(), localApiPlugin()],
  };
});
