type CoachGoal = 'consistency' | 'endurance' | 'speed' | 'distance';

type CoachSummary = {
  ridesCount28Days: number;
  distanceKm28Days: number;
  durationMinutes28Days: number;
  elevationGainM28Days: number;
  averageSpeedKmh28Days: number | null;
  ridesCount7Days: number;
  distanceKm7Days: number;
  durationMinutes7Days: number;
  load7Days: number;
  previousLoad7Days: number;
  loadTrendPercent: number;
  daysSinceLastRide: number | null;
  readinessScore: number;
  readinessLabel: string;
  enoughData: boolean;
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

function isSummary(value: unknown): value is CoachSummary {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return finiteNumber(item.ridesCount28Days, 0, 1000)
    && finiteNumber(item.distanceKm28Days, 0, 100000)
    && finiteNumber(item.durationMinutes28Days, 0, 100000)
    && finiteNumber(item.elevationGainM28Days, 0, 1000000)
    && (item.averageSpeedKmh28Days === null || finiteNumber(item.averageSpeedKmh28Days, 0, 150))
    && finiteNumber(item.ridesCount7Days, 0, 1000)
    && finiteNumber(item.distanceKm7Days, 0, 100000)
    && finiteNumber(item.durationMinutes7Days, 0, 100000)
    && finiteNumber(item.load7Days, 0, 100000)
    && finiteNumber(item.previousLoad7Days, 0, 100000)
    && finiteNumber(item.loadTrendPercent, -100, 10000)
    && (item.daysSinceLastRide === null || finiteNumber(item.daysSinceLastRide, 0, 10000))
    && finiteNumber(item.readinessScore, 0, 100)
    && typeof item.readinessLabel === 'string'
    && item.readinessLabel.length <= 80
    && typeof item.enoughData === 'boolean';
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

const coachSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    headline: { type: 'string' },
    summary: { type: 'string' },
    readinessExplanation: { type: 'string' },
    nextWorkout: {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: { type: 'string' },
        durationMinutes: { type: 'integer', minimum: 15, maximum: 180 },
        intensity: { type: 'string', enum: ['recovery', 'easy', 'moderate', 'hard'] },
        description: { type: 'string' },
      },
      required: ['title', 'durationMinutes', 'intensity', 'description'],
    },
    focus: {
      type: 'array',
      items: { type: 'string' },
      minItems: 3,
      maxItems: 3,
    },
    caution: { type: 'string' },
  },
  required: ['headline', 'summary', 'readinessExplanation', 'nextWorkout', 'focus', 'caution'],
};

async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Метод не поддерживается.' }, 405);
  try {
    const accessToken = bearerToken(request);
    await authenticatedUser(accessToken);
    const body: unknown = await request.json().catch(() => null);
    if (typeof body !== 'object' || body === null) return json({ error: 'Некорректный запрос.' }, 400);
    const input = body as Record<string, unknown>;
    if (!isSummary(input.summary) || !isGoal(input.goal) || !finiteNumber(input.feeling, 1, 5)) {
      return json({ error: 'Не удалось проверить показатели тренировки.' }, 400);
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return json({ error: 'ИИ-модель ещё не подключена. Базовый план уже рассчитан без неё.' }, 503);
    }

    const model = process.env.OPENAI_MODEL ?? 'gpt-5.6';
    const openAiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        store: false,
        reasoning: { effort: 'low' },
        max_output_tokens: 1100,
        input: [
          {
            role: 'system',
            content: [
              'Ты — осторожный ИИ-велотренер Slipstream. Отвечай на русском языке.',
              'Анализируй только переданные агрегированные показатели, не выдумывай пульс, сон, диагнозы или медицинские факты.',
              'Дай конкретную, возрастно-нейтральную и безопасную спортивную рекомендацию.',
              'Если данных мало или самочувствие низкое, прямо снижай интенсивность.',
              'При боли, головокружении или плохом самочувствии советуй прекратить тренировку и обратиться к взрослому или врачу.',
              'Не предлагай экстремальные нагрузки, препараты, диеты или способы скрыть травму.',
            ].join(' '),
          },
          {
            role: 'user',
            content: JSON.stringify({
              goal: input.goal,
              feeling: input.feeling,
              metrics: input.summary,
            }),
          },
        ],
        text: {
          verbosity: 'low',
          format: {
            type: 'json_schema',
            name: 'cycling_coach_advice',
            strict: true,
            schema: coachSchema,
          },
        },
      }),
    });

    const openAiPayload: unknown = await openAiResponse.json().catch(() => null);
    if (!openAiResponse.ok) {
      return json({ error: openAiResponse.status === 429
        ? 'ИИ-тренер занят. Попробуй ещё раз немного позже.'
        : 'ИИ-тренер временно недоступен. Базовый план продолжает работать.' }, 502);
    }
    const text = responseText(openAiPayload);
    if (!text) return json({ error: 'ИИ-тренер не смог подготовить разбор.' }, 502);
    const advice: unknown = JSON.parse(text);
    if (typeof advice !== 'object' || advice === null) return json({ error: 'ИИ-тренер вернул неполный разбор.' }, 502);
    return json(advice as object);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Внутренняя ошибка сервера.';
    const status = message === 'Нужна авторизация.' || message.includes('Сессия истекла') ? 401 : 500;
    return json({ error: message }, status);
  }
}

export default { fetch: handler };
