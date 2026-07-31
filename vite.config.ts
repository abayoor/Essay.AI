import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import coachAnalyze from './api/coach/analyze';
import routeDirections from './api/routes/directions';

type FetchHandler = { fetch(request: Request): Promise<Response> };

function localApiPlugin(): Plugin {
  const handlers = new Map<string, FetchHandler>([
    ['/api/coach/analyze', coachAnalyze],
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
  ['OPENAI_API_KEY', 'OPENAI_MODEL', 'ORS_API_KEY', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].forEach((name) => {
    if (!process.env[name] && env[name]) process.env[name] = env[name];
  });
  return {
    plugins: [react(), localApiPlugin()],
  };
});
