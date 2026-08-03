type Locale = 'ru' | 'kz' | 'en';
type AiTask = 'post_caption' | 'route_copy' | 'ride_analysis';
type SupabaseUser = { id: string };

const outputSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    text: { type: 'string' },
    highlights: {
      type: 'array',
      minItems: 0,
      maxItems: 6,
      items: { type: 'string' },
    },
  },
  required: ['title', 'text', 'highlights'],
};

function json(value: object, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function serverSetting(primary: string, fallback: string): string {
  const value = process.env[primary] ?? process.env[fallback];
  if (!value) throw new Error(`Не настроена серверная переменная ${primary}.`);
  return value;
}

function bearerToken(request: Request): string {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) throw new Error('Нужна авторизация.');
  return header.slice('Bearer '.length);
}

async function authenticatedUser(accessToken: string): Promise<SupabaseUser> {
  const supabaseUrl = serverSetting('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const supabaseAnonKey = serverSetting('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: supabaseAnonKey, authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error('Сессия истекла. Войди в аккаунт снова.');
  const user = await response.json() as Partial<SupabaseUser>;
  if (!user.id) throw new Error('Не удалось определить пользователя.');
  return { id: user.id };
}

function isLocale(value: unknown): value is Locale {
  return value === 'ru' || value === 'kz' || value === 'en';
}

function isTask(value: unknown): value is AiTask {
  return value === 'post_caption' || value === 'route_copy' || value === 'ride_analysis';
}

function safeContext(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  try {
    return JSON.stringify(value).length <= 12_000;
  } catch {
    return false;
  }
}

function geminiText(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const candidates = (payload as Record<string, unknown>).candidates;
  if (!Array.isArray(candidates)) return null;
  for (const candidate of candidates) {
    if (typeof candidate !== 'object' || candidate === null) continue;
    const content = (candidate as Record<string, unknown>).content;
    if (typeof content !== 'object' || content === null) continue;
    const parts = (content as Record<string, unknown>).parts;
    if (!Array.isArray(parts)) continue;
    for (const part of parts) {
      if (typeof part === 'object' && part !== null && typeof (part as Record<string, unknown>).text === 'string') {
        return (part as Record<string, unknown>).text as string;
      }
    }
  }
  return null;
}

function geminiFailure(status: number): string {
  if (status === 400) return 'Gemini отклонил запрос. Проверь GEMINI_MODEL и доступ ключа к этой модели.';
  if (status === 401 || status === 403) return 'Ключ Gemini недействителен или не имеет доступа к Gemini API.';
  if (status === 404) return 'Указанная модель Gemini не найдена. Проверь GEMINI_MODEL.';
  if (status === 429) return 'Квота Gemini закончилась или сервис занят. Проверь лимиты проекта и попробуй позже.';
  return `Gemini API не ответил (код ${status}).`;
}

function taskPrompt(task: AiTask): string {
  if (task === 'post_caption') {
    return 'Create a natural first-person social post for a cycling community. Use only supplied facts. Keep it under 700 characters, avoid clichés, fake emotions, hashtags spam, invented places, speed, weather, achievements, or safety claims. title must be a short internal label, text must be the ready-to-publish caption, highlights must be empty.';
  }
  if (task === 'route_copy') {
    return 'Create a specific, useful cycling route title and description from supplied route metrics. Mention distance, climbing, difficulty and city only when provided. Do not invent roads, surfaces, landmarks, water points, safety, or bike lanes. title must be under 70 characters, text under 700 characters, highlights may contain up to three short factual route traits.';
  }
  return [
    'Analyze one completed bicycle ride using only supplied metrics.',
    'Write a detailed 6-9 sentence overview that explains how distance, moving and elapsed time, average speed, maximum speed, pace, elevation gain, elevation per kilometre and GPS data quality affect the interpretation.',
    'Do not call a result excellent or poor without enough context and do not compare it with unavailable ride history.',
    'Treat an unusually high maximum speed cautiously because it may be a descent or GPS spike.',
    'Provide exactly six substantial highlights, each 1-2 sentences: distance and duration; moving time and stops; average speed and pace; maximum speed reliability and safety; elevation and route load; a conservative next-ride plan.',
    'Every highlight must name its parameter, cite the supplied value when available, explain what it means, and give one concrete action.',
    'Never invent heart rate, power, cadence, sleep, weather, surface, medical facts or diagnoses.',
  ].join(' ');
}

async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Метод не поддерживается.' }, 405);
  try {
    await authenticatedUser(bearerToken(request));
    const body: unknown = await request.json().catch(() => null);
    if (typeof body !== 'object' || body === null) return json({ error: 'Некорректный запрос.' }, 400);
    const input = body as Record<string, unknown>;
    if (!isTask(input.task) || !isLocale(input.locale) || !safeContext(input.context)) {
      return json({ error: 'Не удалось проверить данные для ИИ.' }, 400);
    }

    const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
    if (!apiKey) return json({ error: 'Gemini ещё не подключён на сервере.' }, 503);
    const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text: [
              'You are Slipstream AI, a concise and safety-first cycling product assistant.',
              taskPrompt(input.task),
              'Return user-facing text in the requested language: ru Russian, kz Kazakh, en English.',
              'Return only data matching the response schema.',
            ].join(' '),
          }],
        },
        contents: [{
          role: 'user',
          parts: [{ text: JSON.stringify({ task: input.task, locale: input.locale, context: input.context }) }],
        }],
        generationConfig: {
          maxOutputTokens: 2600,
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: 'application/json',
          responseSchema: outputSchema,
        },
      }),
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      return json({ error: geminiFailure(response.status) }, 502);
    }
    const text = geminiText(payload);
    if (!text) return json({ error: 'Gemini не смог подготовить ответ.' }, 502);
    const result: unknown = JSON.parse(text);
    if (typeof result !== 'object' || result === null) return json({ error: 'Gemini вернул неполный ответ.' }, 502);
    return json({ ...(result as object), provider: 'gemini' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Внутренняя ошибка сервера.';
    return json({ error: message }, message.includes('авторизац') || message.includes('Сессия') ? 401 : 500);
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    return corsPreflight(request, 'POST, OPTIONS')
      ?? withCors(request, await handler(request), 'POST, OPTIONS');
  },
};
import { corsPreflight, withCors } from '../_cors.js';
