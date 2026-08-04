type Locale = 'ru' | 'kz' | 'en';
type AssistTask = 'post_caption' | 'route_copy' | 'ride_analysis';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

function json(value: object, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      ...corsHeaders,
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLocale(value: unknown): value is Locale {
  return value === 'ru' || value === 'kz' || value === 'en';
}

function supabasePublicKey(): string | null {
  const publishableKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  if (publishableKey) return publishableKey;

  const namedKeys = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');
  if (namedKeys) {
    try {
      const parsed: unknown = JSON.parse(namedKeys);
      if (isRecord(parsed)) {
        const defaultKey = parsed.default;
        if (typeof defaultKey === 'string') return defaultKey;
        const firstKey = Object.values(parsed).find((value): value is string => typeof value === 'string');
        if (firstKey) return firstKey;
      }
    } catch {
      // Fall through to the legacy key.
    }
  }

  return Deno.env.get('SUPABASE_ANON_KEY');
}

async function authenticatedUser(request: Request): Promise<boolean> {
  const authorization = request.headers.get('authorization');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = supabasePublicKey();
  if (!authorization?.startsWith('Bearer ') || !supabaseUrl || !anonKey) return false;
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, authorization },
  });
  if (!response.ok) return false;
  const user: unknown = await response.json().catch(() => null);
  return isRecord(user) && typeof user.id === 'string';
}

function safeObject(value: unknown, limit: number): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  try {
    return JSON.stringify(value).length <= limit;
  } catch {
    return false;
  }
}

function geminiText(payload: unknown): string | null {
  if (!isRecord(payload) || !Array.isArray(payload.candidates)) return null;
  for (const candidate of payload.candidates) {
    if (!isRecord(candidate) || !isRecord(candidate.content) || !Array.isArray(candidate.content.parts)) continue;
    for (const part of candidate.content.parts) {
      if (isRecord(part) && typeof part.text === 'string') return part.text;
    }
  }
  return null;
}

function geminiError(status: number): string {
  if (status === 400) return 'ИИ-сервис отклонил запрос. Попробуй изменить данные.';
  if (status === 401 || status === 403) return 'ИИ-сервис временно недоступен из-за ошибки доступа.';
  if (status === 404) return 'ИИ-модель временно недоступна.';
  if (status === 429) return 'ИИ-сервис занят. Попробуй ещё раз немного позже.';
  return `ИИ-сервис не ответил (код ${status}).`;
}

const assistSchema = {
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

function assistPrompt(task: AssistTask): string {
  if (task === 'post_caption') {
    return 'Create a natural first-person social post for a cycling community. Use only supplied facts. Keep it under 700 characters. Do not invent places, speed, weather, achievements, or safety claims. title is a short internal label, text is the ready caption, highlights is empty.';
  }
  if (task === 'route_copy') {
    return 'Create a useful cycling route title and description from supplied metrics. Mention distance, climbing, difficulty and city only when provided. Do not invent roads, surfaces, landmarks, water points, safety, or bike lanes. title is under 70 characters, text under 700 characters, highlights contains up to three factual traits.';
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

async function generate(
  apiKey: string,
  model: string,
  systemPrompt: string,
  locale: Locale,
  input: Record<string, unknown>,
  schema: object,
  maxOutputTokens: number,
): Promise<Response> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{
          text: `${systemPrompt} Return all user-facing text in the requested language: ru Russian, kz Kazakh, en English. Return only JSON matching the supplied schema.`,
        }],
      },
      contents: [{
        role: 'user',
        parts: [{ text: JSON.stringify({ locale, ...input }) }],
      }],
      generationConfig: {
        maxOutputTokens,
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    }),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) return json({ error: geminiError(response.status) }, 502);
  const text = geminiText(payload);
  if (!text) return json({ error: 'ИИ не смог подготовить ответ.' }, 502);
  try {
    const result: unknown = JSON.parse(text);
    if (!isRecord(result)) return json({ error: 'ИИ-сервис вернул неполный ответ.' }, 502);
    return json({ ...result, provider: 'gemini' });
  } catch {
    return json({ error: 'ИИ-сервис вернул некорректный ответ.' }, 502);
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Метод не поддерживается.' }, 405);
  if (!await authenticatedUser(request)) return json({ error: 'Сессия истекла. Войди в аккаунт снова.' }, 401);

  const apiKey = Deno.env.get('GEMINI_API_KEY') ?? Deno.env.get('GOOGLE_API_KEY');
  if (!apiKey) return json({ error: 'ИИ-сервис не настроен на сервере.' }, 503);
  const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';
  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body) || !isLocale(body.locale)) return json({ error: 'Некорректный запрос.' }, 400);

  if (body.mode === 'assist') {
    const task = body.task;
    if ((task !== 'post_caption' && task !== 'route_copy' && task !== 'ride_analysis') || !safeObject(body.context, 12_000)) {
      return json({ error: 'Не удалось проверить данные для ИИ.' }, 400);
    }
    return generate(apiKey, model, assistPrompt(task), body.locale, {
      task,
      context: body.context,
    }, assistSchema, task === 'ride_analysis' ? 2600 : 1400);
  }

  if (body.mode === 'coach') {
    return json({ error: 'ИИ-тренер доступен только в Slipstream Pro.' }, 403);
  }

  return json({ error: 'Неизвестный режим ИИ.' }, 400);
});
