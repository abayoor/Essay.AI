type CoachGoal = 'consistency' | 'endurance' | 'speed' | 'distance';
type Locale = 'ru' | 'kz' | 'en';

type CoachSummary = {
  ridesCount28Days: number;
  distanceKm28Days: number;
  durationMinutes28Days: number;
  elevationGainM28Days: number;
  averageSpeedKmh28Days: number | null;
  longestRideKm28Days: number;
  averageRideDistanceKm28Days: number;
  elevationMPer10Km28Days: number;
  activeDays28Days: number;
  ridesCount7Days: number;
  distanceKm7Days: number;
  durationMinutes7Days: number;
  load7Days: number;
  previousLoad7Days: number;
  loadTrendPercent: number;
  speedTrendPercent: number | null;
  acuteChronicRatio: number;
  daysSinceLastRide: number | null;
  readinessScore: number;
  enoughData: boolean;
  recentRides: {
    daysAgo: number;
    distanceKm: number;
    durationMinutes: number;
    elevationGainM: number;
    averageSpeedKmh: number | null;
  }[];
};

type SupabaseUser = { id: string };

function json(value: object, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function bearerToken(request: Request): string {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) throw new Error('Нужна авторизация.');
  return header.slice('Bearer '.length);
}

function serverSetting(primary: string, fallback: string): string {
  const value = process.env[primary] ?? process.env[fallback];
  if (!value) throw new Error(`Не настроена серверная переменная ${primary}.`);
  return value;
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

function finiteNumber(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function isGoal(value: unknown): value is CoachGoal {
  return value === 'consistency' || value === 'endurance' || value === 'speed' || value === 'distance';
}

function isLocale(value: unknown): value is Locale {
  return value === 'ru' || value === 'kz' || value === 'en';
}

function isRideSample(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return finiteNumber(item.daysAgo, 0, 10000)
    && finiteNumber(item.distanceKm, 0, 10000)
    && finiteNumber(item.durationMinutes, 0, 10000)
    && finiteNumber(item.elevationGainM, 0, 100000)
    && (item.averageSpeedKmh === null || finiteNumber(item.averageSpeedKmh, 0, 150));
}

function isSummary(value: unknown): value is CoachSummary {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return finiteNumber(item.ridesCount28Days, 0, 1000)
    && finiteNumber(item.distanceKm28Days, 0, 100000)
    && finiteNumber(item.durationMinutes28Days, 0, 100000)
    && finiteNumber(item.elevationGainM28Days, 0, 1000000)
    && (item.averageSpeedKmh28Days === null || finiteNumber(item.averageSpeedKmh28Days, 0, 150))
    && finiteNumber(item.longestRideKm28Days, 0, 10000)
    && finiteNumber(item.averageRideDistanceKm28Days, 0, 10000)
    && finiteNumber(item.elevationMPer10Km28Days, 0, 100000)
    && finiteNumber(item.activeDays28Days, 0, 28)
    && finiteNumber(item.ridesCount7Days, 0, 1000)
    && finiteNumber(item.distanceKm7Days, 0, 100000)
    && finiteNumber(item.durationMinutes7Days, 0, 100000)
    && finiteNumber(item.load7Days, 0, 100000)
    && finiteNumber(item.previousLoad7Days, 0, 100000)
    && finiteNumber(item.loadTrendPercent, -100, 10000)
    && (item.speedTrendPercent === null || finiteNumber(item.speedTrendPercent, -100, 10000))
    && finiteNumber(item.acuteChronicRatio, 0, 100)
    && (item.daysSinceLastRide === null || finiteNumber(item.daysSinceLastRide, 0, 10000))
    && finiteNumber(item.readinessScore, 0, 100)
    && typeof item.enoughData === 'boolean'
    && Array.isArray(item.recentRides)
    && item.recentRides.length <= 6
    && item.recentRides.every(isRideSample);
}

function responseText(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const output = (payload as Record<string, unknown>).output;
  if (!Array.isArray(output)) return null;
  for (const item of output) {
    if (typeof item !== 'object' || item === null) continue;
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (typeof part !== 'object' || part === null) continue;
      const record = part as Record<string, unknown>;
      if (record.type === 'output_text' && typeof record.text === 'string') return record.text;
    }
  }
  return null;
}

function geminiResponseText(payload: unknown): string | null {
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

const coachSchema = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    summary: { type: 'string' },
    readinessExplanation: { type: 'string' },
    trainingInsight: { type: 'string' },
    nextWorkout: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        durationMinutes: { type: 'integer', minimum: 15, maximum: 180 },
        intensity: { type: 'string', enum: ['recovery', 'easy', 'moderate', 'hard'] },
        description: { type: 'string' },
      },
      required: ['title', 'durationMinutes', 'intensity', 'description'],
    },
    weeklyPlan: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'object',
        properties: {
          order: { type: 'integer', minimum: 1, maximum: 3 },
          title: { type: 'string' },
          durationMinutes: { type: 'integer', minimum: 15, maximum: 180 },
          intensity: { type: 'string', enum: ['recovery', 'easy', 'moderate', 'hard'] },
          description: { type: 'string' },
          purpose: { type: 'string' },
        },
        required: ['order', 'title', 'durationMinutes', 'intensity', 'description', 'purpose'],
      },
    },
    focus: {
      type: 'array',
      items: { type: 'string' },
      minItems: 3,
      maxItems: 3,
    },
    caution: { type: 'string' },
    watchMetric: { type: 'string' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
  },
  required: ['headline', 'summary', 'readinessExplanation', 'trainingInsight', 'nextWorkout', 'weeklyPlan', 'focus', 'watchMetric', 'confidence', 'caution'],
};

function withStrictObjects(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withStrictObjects);
  if (typeof value !== 'object' || value === null) return value;

  const record = Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => [key, withStrictObjects(item)]),
  );
  return record.type === 'object' ? { ...record, additionalProperties: false } : record;
}

const openAiCoachSchema = withStrictObjects(coachSchema);

async function safetyIdentifier(userId: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(userId));
  return `slipstream_${Array.from(new Uint8Array(digest)).slice(0, 12).map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

const coachSystemPrompt = [
  'You are Slipstream’s evidence-based and safety-first cycling coach.',
  'Use only the supplied privacy-preserving ride metrics. Never invent heart rate, sleep, power, diagnoses, injuries, or medical facts.',
  'Compare the last 7 days with the previous 7 days, the 28-day baseline, acute-to-baseline load, speed trend, climbing density, longest ride, active days, recent ride samples, current feeling, and selected goal.',
  'Identify the most important pattern and explain which exact supplied numbers support it. Avoid generic praise.',
  'Design one immediately actionable workout and a three-session weekly progression with intensity, duration, purpose, recovery spacing, warm-up, main set, and cool-down where relevant.',
  'Do not increase the longest session or weekly load aggressively. If data is limited, confidence must be low and the plan conservative.',
  'If feeling is low, load spiked, or recovery is uncertain, reduce intensity. Never recommend extreme loads, supplements, diets, medication, or hiding pain.',
  'For pain, dizziness, breathing difficulty, or feeling unwell, advise stopping and contacting a trusted adult or clinician.',
  'Return all user-facing text in the requested language: ru = Russian, kz = Kazakh, en = English.',
].join(' ');

async function requestGeminiCoach(apiKey: string, input: Record<string, unknown>): Promise<{ text: string | null; status: number }> {
  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: coachSystemPrompt }] },
      contents: [{
        role: 'user',
        parts: [{
          text: JSON.stringify({
            goal: input.goal,
            feeling: input.feeling,
            responseLanguage: input.locale,
            metrics: input.summary,
          }),
        }],
      }],
      generationConfig: {
        maxOutputTokens: 3000,
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: 'application/json',
        responseSchema: coachSchema,
      },
    }),
  });
  const payload: unknown = await response.json().catch(() => null);
  return { text: response.ok ? geminiResponseText(payload) : null, status: response.status };
}

function geminiFailure(status: number): string {
  if (status === 400) return 'Gemini отклонил запрос. Проверь GEMINI_MODEL и доступ ключа к этой модели.';
  if (status === 401 || status === 403) return 'Ключ Gemini недействителен или не имеет доступа к Gemini API.';
  if (status === 404) return 'Указанная модель Gemini не найдена. Проверь GEMINI_MODEL.';
  if (status === 429) return 'Квота Gemini закончилась или сервис занят. Проверь лимиты проекта и попробуй позже.';
  return `Gemini API не ответил (код ${status}).`;
}

async function requestOpenAiCoach(apiKey: string, userId: string, input: Record<string, unknown>): Promise<{ text: string | null; status: number }> {
  const model = process.env.OPENAI_MODEL ?? 'gpt-5.6';
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      store: false,
      safety_identifier: await safetyIdentifier(userId),
      reasoning: { effort: 'high' },
      max_output_tokens: 2200,
      input: [
        { role: 'system', content: coachSystemPrompt },
        {
          role: 'user',
          content: JSON.stringify({
            goal: input.goal,
            feeling: input.feeling,
            responseLanguage: input.locale,
            metrics: input.summary,
          }),
        },
      ],
      text: {
        verbosity: 'medium',
        format: {
          type: 'json_schema',
          name: 'cycling_coach_advice',
          strict: true,
          schema: openAiCoachSchema,
        },
      },
    }),
  });
  const payload: unknown = await response.json().catch(() => null);
  return { text: response.ok ? responseText(payload) : null, status: response.status };
}

async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Метод не поддерживается.' }, 405);
  try {
    const accessToken = bearerToken(request);
    const user = await authenticatedUser(accessToken);
    const body: unknown = await request.json().catch(() => null);
    if (typeof body !== 'object' || body === null) return json({ error: 'Некорректный запрос.' }, 400);
    const input = body as Record<string, unknown>;
    if (!isSummary(input.summary) || !isGoal(input.goal) || !finiteNumber(input.feeling, 1, 5) || !isLocale(input.locale)) {
      return json({ error: 'Не удалось проверить показатели тренировки.' }, 400);
    }

    const geminiApiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
    const openAiApiKey = process.env.OPENAI_API_KEY;
    if (!geminiApiKey && !openAiApiKey) {
      return json({ error: 'ИИ-модель ещё не подключена. Базовый план уже рассчитан без неё.' }, 503);
    }

    const aiResult = geminiApiKey
      ? await requestGeminiCoach(geminiApiKey, input)
      : await requestOpenAiCoach(openAiApiKey as string, user.id, input);
    if (!aiResult.text) {
      return json({ error: geminiApiKey
        ? geminiFailure(aiResult.status)
        : aiResult.status === 429
          ? 'ИИ-тренер занят. Попробуй ещё раз немного позже.'
          : `OpenAI API не ответил (код ${aiResult.status}). Базовый план продолжает работать.` }, 502);
    }
    const advice: unknown = JSON.parse(aiResult.text);
    if (typeof advice !== 'object' || advice === null) return json({ error: 'ИИ-тренер вернул неполный разбор.' }, 502);
    return json({ ...(advice as object), provider: geminiApiKey ? 'gemini' : 'openai' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Внутренняя ошибка сервера.';
    const status = message === 'Нужна авторизация.' || message.includes('Сессия истекла') ? 401 : 500;
    return json({ error: message }, status);
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    return corsPreflight(request, 'POST, OPTIONS')
      ?? withCors(request, await handler(request), 'POST, OPTIONS');
  },
};
import { corsPreflight, withCors } from '../_cors';
