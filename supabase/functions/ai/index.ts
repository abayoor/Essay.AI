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

async function authenticatedUser(request: Request): Promise<boolean> {
  const authorization = request.headers.get('authorization');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
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
  if (status === 400) return 'Gemini отклонил запрос. Проверь доступ ключа к выбранной модели.';
  if (status === 401 || status === 403) return 'Ключ Gemini недействителен или не имеет доступа к Gemini API.';
  if (status === 404) return 'Модель Gemini не найдена.';
  if (status === 429) return 'Квота Gemini закончилась или сервис занят. Проверь лимиты проекта.';
  return `Gemini API не ответил (код ${status}).`;
}

const assistSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    text: { type: 'string' },
    highlights: {
      type: 'array',
      minItems: 0,
      maxItems: 3,
      items: { type: 'string' },
    },
  },
  required: ['title', 'text', 'highlights'],
};

const workoutProperties = {
  title: { type: 'string' },
  durationMinutes: { type: 'integer', minimum: 15, maximum: 180 },
  intensity: { type: 'string', enum: ['recovery', 'easy', 'moderate', 'hard'] },
  description: { type: 'string' },
};

const coachSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    headline: { type: 'string' },
    summary: { type: 'string' },
    readinessExplanation: { type: 'string' },
    trainingInsight: { type: 'string' },
    nextWorkout: {
      type: 'object',
      additionalProperties: false,
      properties: workoutProperties,
      required: ['title', 'durationMinutes', 'intensity', 'description'],
    },
    weeklyPlan: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          order: { type: 'integer', minimum: 1, maximum: 3 },
          ...workoutProperties,
          purpose: { type: 'string' },
        },
        required: ['order', 'title', 'durationMinutes', 'intensity', 'description', 'purpose'],
      },
    },
    focus: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: { type: 'string' },
    },
    caution: { type: 'string' },
    watchMetric: { type: 'string' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
  },
  required: ['headline', 'summary', 'readinessExplanation', 'trainingInsight', 'nextWorkout', 'weeklyPlan', 'focus', 'watchMetric', 'confidence', 'caution'],
};

function assistPrompt(task: AssistTask): string {
  if (task === 'post_caption') {
    return 'Create a natural first-person social post for a cycling community. Use only supplied facts. Keep it under 700 characters. Do not invent places, speed, weather, achievements, or safety claims. title is a short internal label, text is the ready caption, highlights is empty.';
  }
  if (task === 'route_copy') {
    return 'Create a useful cycling route title and description from supplied metrics. Mention distance, climbing, difficulty and city only when provided. Do not invent roads, surfaces, landmarks, water points, safety, or bike lanes. title is under 70 characters, text under 700 characters, highlights contains up to three factual traits.';
  }
  return 'Analyze one completed bicycle ride using only supplied metrics. Explain the result in plain language, identify one strength and one sensible next step. Never invent heart rate, power, sleep, weather, medical facts, or unavailable history. Avoid diagnosis. title is concise, text is 2-4 sentences, highlights contains exactly three short factual observations when possible.';
}

const coachPrompt = [
  'You are Slipstream’s evidence-based and safety-first cycling coach.',
  'Use only supplied privacy-preserving ride metrics. Never invent heart rate, sleep, power, diagnoses, injuries, or medical facts.',
  'Compare the last 7 days with the previous 7 days and the 28-day baseline.',
  'Explain which supplied numbers support the main insight and avoid generic praise.',
  'Design one actionable workout and a conservative three-session weekly progression.',
  'If feeling is low, load spiked, or recovery is uncertain, reduce intensity.',
  'Never recommend extreme loads, supplements, diets, medication, or hiding pain.',
  'For pain, dizziness, breathing difficulty, or feeling unwell, advise stopping and contacting a trusted adult or clinician.',
].join(' ');

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
        temperature: 0.35,
        maxOutputTokens,
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    }),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) return json({ error: geminiError(response.status) }, 502);
  const text = geminiText(payload);
  if (!text) return json({ error: 'Gemini не смог подготовить ответ.' }, 502);
  try {
    const result: unknown = JSON.parse(text);
    if (!isRecord(result)) return json({ error: 'Gemini вернул неполный ответ.' }, 502);
    return json({ ...result, provider: 'gemini' });
  } catch {
    return json({ error: 'Gemini вернул некорректный JSON.' }, 502);
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Метод не поддерживается.' }, 405);
  if (!await authenticatedUser(request)) return json({ error: 'Сессия истекла. Войди в аккаунт снова.' }, 401);

  const apiKey = Deno.env.get('GEMINI_API_KEY') ?? Deno.env.get('GOOGLE_API_KEY');
  if (!apiKey) return json({ error: 'GEMINI_API_KEY не настроен в Supabase Secrets.' }, 503);
  const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.6-flash';
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
    }, assistSchema, 1400);
  }

  if (body.mode === 'coach') {
    if (!safeObject(body.summary, 30_000)
      || (body.goal !== 'consistency' && body.goal !== 'endurance' && body.goal !== 'speed' && body.goal !== 'distance')
      || typeof body.feeling !== 'number' || body.feeling < 1 || body.feeling > 5) {
      return json({ error: 'Не удалось проверить показатели тренировки.' }, 400);
    }
    return generate(apiKey, model, coachPrompt, body.locale, {
      goal: body.goal,
      feeling: body.feeling,
      metrics: body.summary,
    }, coachSchema, 3000);
  }

  return json({ error: 'Неизвестный режим ИИ.' }, 400);
});
