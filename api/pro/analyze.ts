import {
  authenticatedUser,
  billingConfigured,
  consumeProAnalysisCredit,
  findProSubscription,
  hasDatabaseProAccess,
  hasPreviewTesterAccess,
  hasUniversalPromoAccess,
  fetchWithTimeout,
  finishProAnalysisCredit,
  json,
  ProQuotaError,
  UpstreamTimeoutError,
} from '../billing/_shared';
import { corsPreflight, withCors } from '../_cors';

export const maxDuration = 60;

type Experience = 'beginner' | 'intermediate' | 'advanced';
type RidingStyle = 'city' | 'road' | 'gravel' | 'mountain' | 'touring';
type PrimaryGoal = 'comfort' | 'fitness' | 'commute' | 'speed' | 'adventure';
type Terrain = 'flat' | 'mixed' | 'hilly' | 'trails';
type Locale = 'ru' | 'kz' | 'en';

type ProInput = {
  locale: Locale;
  consentToAi: true;
  consentPolicyVersion: '2026-08-01';
  heightCm: number;
  weightKg: number;
  inseamCm: number;
  weeklyHours: number;
  budgetUsd: number | null;
  experience: Experience;
  ridingStyle: RidingStyle;
  primaryGoal: PrimaryGoal;
  terrain: Terrain;
  currentBike: string;
  discomfort: string;
};

const analysisSchema = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    summary: { type: 'string' },
    bikeRecommendation: {
      type: 'object',
      properties: {
        category: { type: 'string' },
        frameSizeGuidance: { type: 'string' },
        geometry: { type: 'string' },
        wheelAndTires: { type: 'string' },
        frameAndFork: { type: 'string' },
        drivetrain: { type: 'string' },
        brakes: { type: 'string' },
        fitChecklist: { type: 'array', minItems: 4, maxItems: 6, items: { type: 'string' } },
        buyingChecklist: { type: 'array', minItems: 4, maxItems: 6, items: { type: 'string' } },
      },
      required: ['category', 'frameSizeGuidance', 'geometry', 'wheelAndTires', 'frameAndFork', 'drivetrain', 'brakes', 'fitChecklist', 'buyingChecklist'],
    },
    training: {
      type: 'object',
      properties: {
        weeklyStructure: { type: 'string' },
        intensity: { type: 'string' },
        recovery: { type: 'string' },
      },
      required: ['weeklyStructure', 'intensity', 'recovery'],
    },
    route: {
      type: 'object',
      properties: {
        routingPreference: { type: 'string' },
        surfaceAndClimbing: { type: 'string' },
        safety: { type: 'string' },
      },
      required: ['routingPreference', 'surfaceAndClimbing', 'safety'],
    },
    maintenance: { type: 'array', minItems: 4, maxItems: 7, items: { type: 'string' } },
    nutrition: {
      type: 'object',
      properties: {
        before: { type: 'string' },
        during: { type: 'string' },
        after: { type: 'string' },
      },
      required: ['before', 'during', 'after'],
    },
    confidence: {
      type: 'object',
      properties: {
        level: { type: 'string', enum: ['low', 'medium', 'high'] },
        missingData: { type: 'array', minItems: 0, maxItems: 5, items: { type: 'string' } },
      },
      required: ['level', 'missingData'],
    },
    safetyNote: { type: 'string' },
  },
  required: ['headline', 'summary', 'bikeRecommendation', 'training', 'route', 'maintenance', 'nutrition', 'confidence', 'safetyNote'],
};

function finiteNumber(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function shortText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length <= maxLength;
}

function isOneOf<T extends string>(value: unknown, options: readonly T[]): value is T {
  return typeof value === 'string' && options.includes(value as T);
}

function validInput(value: unknown): value is ProInput {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return isOneOf(item.locale, ['ru', 'kz', 'en'] as const)
    && item.consentToAi === true
    && item.consentPolicyVersion === '2026-08-01'
    && finiteNumber(item.heightCm, 120, 230)
    && finiteNumber(item.weightKg, 30, 250)
    && finiteNumber(item.inseamCm, 50, 125)
    && finiteNumber(item.weeklyHours, 0, 40)
    && (item.budgetUsd === null || finiteNumber(item.budgetUsd, 100, 50_000))
    && isOneOf(item.experience, ['beginner', 'intermediate', 'advanced'] as const)
    && isOneOf(item.ridingStyle, ['city', 'road', 'gravel', 'mountain', 'touring'] as const)
    && isOneOf(item.primaryGoal, ['comfort', 'fitness', 'commute', 'speed', 'adventure'] as const)
    && isOneOf(item.terrain, ['flat', 'mixed', 'hilly', 'trails'] as const)
    && shortText(item.currentBike, 160)
    && shortText(item.discomfort, 500);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function validAnalysis(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value) || !isRecord(value.bikeRecommendation) || !isRecord(value.training)
    || !isRecord(value.route) || !isRecord(value.nutrition) || !isRecord(value.confidence)) return false;
  const bike = value.bikeRecommendation;
  const training = value.training;
  const route = value.route;
  const nutrition = value.nutrition;
  const confidence = value.confidence;
  return typeof value.headline === 'string'
    && typeof value.summary === 'string'
    && typeof bike.category === 'string'
    && typeof bike.frameSizeGuidance === 'string'
    && typeof bike.geometry === 'string'
    && typeof bike.wheelAndTires === 'string'
    && typeof bike.frameAndFork === 'string'
    && typeof bike.drivetrain === 'string'
    && typeof bike.brakes === 'string'
    && isStringArray(bike.fitChecklist)
    && isStringArray(bike.buyingChecklist)
    && typeof training.weeklyStructure === 'string'
    && typeof training.intensity === 'string'
    && typeof training.recovery === 'string'
    && typeof route.routingPreference === 'string'
    && typeof route.surfaceAndClimbing === 'string'
    && typeof route.safety === 'string'
    && isStringArray(value.maintenance)
    && typeof nutrition.before === 'string'
    && typeof nutrition.during === 'string'
    && typeof nutrition.after === 'string'
    && (confidence.level === 'low' || confidence.level === 'medium' || confidence.level === 'high')
    && isStringArray(confidence.missingData)
    && typeof value.safetyNote === 'string';
}

async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Метод не поддерживается.' }, 405);
  try {
    const user = await authenticatedUser(request);
    const promotionalAccess = hasUniversalPromoAccess(request)
      || await hasPreviewTesterAccess(user)
      || await hasDatabaseProAccess(user);
    const subscription = promotionalAccess || !billingConfigured() ? null : await findProSubscription(user.email);
    if (!promotionalAccess && !subscription?.active) return json({ error: 'Этот анализ доступен с активной подпиской Slipstream Pro.' }, 403);
    const declaredLength = Number(request.headers.get('content-length') ?? 0);
    if (Number.isFinite(declaredLength) && declaredLength > 12_000) {
      return json({ error: 'Анкета слишком большая.' }, 413);
    }
    const rawInput = await request.text();
    if (new TextEncoder().encode(rawInput).byteLength > 12_000) {
      return json({ error: 'Анкета слишком большая.' }, 413);
    }
    const input: unknown = (() => {
      try { return JSON.parse(rawInput); } catch { return null; }
    })();
    if (!validInput(input)) return json({ error: 'Проверь рост, вес, длину ноги и остальные параметры.' }, 400);
    const cleanInput: ProInput = {
      locale: input.locale,
      consentToAi: true,
      consentPolicyVersion: '2026-08-01',
      heightCm: input.heightCm,
      weightKg: input.weightKg,
      inseamCm: input.inseamCm,
      weeklyHours: input.weeklyHours,
      budgetUsd: input.budgetUsd,
      experience: input.experience,
      ridingStyle: input.ridingStyle,
      primaryGoal: input.primaryGoal,
      terrain: input.terrain,
      currentBike: input.currentBike,
      discomfort: input.discomfort,
    };
    const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
    if (!apiKey) return json({ error: 'ИИ-модель ещё не подключена на сервере.' }, 503);
    const credit = await consumeProAnalysisCredit(user, cleanInput.consentPolicyVersion);
    const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
    let completed = false;
    try {
      const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text: [
              'You are Slipstream Pro, a meticulous, safety-first bicycle fit, equipment and training assistant.',
              'Use only the supplied measurements and preferences. Do not invent health conditions, power, heart rate, sleep, local inventory, prices or exact manufacturer sizing.',
              'Recommend a bicycle category and component specification, not a made-up best model. Explain that frame labels vary by manufacturer and require a test ride or professional fit.',
              'Use height and inseam to give a cautious frame-size range and concrete fit checks. Consider rider weight only for appropriate wheel strength, tyre pressure context and durability; never shame or diagnose.',
              'Make training proportional to stated experience and available weekly hours. Nutrition guidance must stay general, food-first and non-medical, with no supplements or extreme calorie targets.',
              'If discomfort suggests pain, numbness, dizziness or breathing problems, advise stopping and consulting a qualified adult clinician or bike fitter.',
              'Cover route surface, gradient, safety equipment, maintenance intervals and a purchase inspection checklist. State uncertainty and missing measurements.',
              `Return all user-facing text in ${{ ru: 'Russian', kz: 'Kazakh', en: 'English' }[cleanInput.locale]} and only JSON matching the schema.`,
            ].join(' '),
          }],
        },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(cleanInput) }] }],
        generationConfig: {
          maxOutputTokens: 3000,
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: 'application/json',
          responseSchema: analysisSchema,
        },
        }),
      }, 35_000);
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        return json({ error: response.status === 429 ? 'ИИ занят или закончилась квота. Попробуй позже.' : 'ИИ не смог выполнить анализ.' }, 502);
      }
      const text = geminiText(payload);
      if (!text) return json({ error: 'ИИ вернул пустой анализ.' }, 502);
      const analysis: unknown = JSON.parse(text);
      if (!validAnalysis(analysis)) return json({ error: 'ИИ вернул неполный анализ.' }, 502);
      completed = true;
      await finishProAnalysisCredit(user, credit.reservationId, credit.reservationToken, true).catch(() => undefined);
      return json(analysis);
    } finally {
      if (!completed) {
        await finishProAnalysisCredit(user, credit.reservationId, credit.reservationToken, false).catch(() => undefined);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Внутренняя ошибка сервера.';
    if (error instanceof ProQuotaError) {
      return new Response(JSON.stringify({ error: message }), {
        status: 429,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'private, no-store',
          'retry-after': String(error.retryAfterSeconds),
        },
      });
    }
    if (error instanceof UpstreamTimeoutError) return json({ error: message }, 504);
    return json({ error: message }, message.includes('авторизац') || message.includes('Сессия') ? 401 : 500);
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    return corsPreflight(request, 'POST, OPTIONS')
      ?? withCors(request, await handler(request), 'POST, OPTIONS');
  },
};
