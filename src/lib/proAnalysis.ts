import { supabase } from './supabase';
import { apiFetch } from './api';
import { proPromoRequestHeaders } from './proAccess';

export type ProRiderInput = {
  locale: 'ru' | 'kz' | 'en';
  consentToAi: true;
  consentPolicyVersion: '2026-08-01';
  heightCm: number;
  weightKg: number;
  inseamCm: number;
  weeklyHours: number;
  budgetUsd: number | null;
  experience: 'beginner' | 'intermediate' | 'advanced';
  ridingStyle: 'city' | 'road' | 'gravel' | 'mountain' | 'touring';
  primaryGoal: 'comfort' | 'fitness' | 'commute' | 'speed' | 'adventure';
  terrain: 'flat' | 'mixed' | 'hilly' | 'trails';
  currentBike: string;
  discomfort: string;
};

export type ProBikeAnalysis = {
  headline: string;
  summary: string;
  bikeRecommendation: {
    category: string;
    frameSizeGuidance: string;
    geometry: string;
    wheelAndTires: string;
    frameAndFork: string;
    drivetrain: string;
    brakes: string;
    fitChecklist: string[];
    buyingChecklist: string[];
  };
  training: {
    weeklyStructure: string;
    intensity: string;
    recovery: string;
  };
  route: {
    routingPreference: string;
    surfaceAndClimbing: string;
    safety: string;
  };
  maintenance: string[];
  nutrition: {
    before: string;
    during: string;
    after: string;
  };
  confidence: {
    level: 'low' | 'medium' | 'high';
    missingData: string[];
  };
  safetyNote: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isAnalysis(value: unknown): value is ProBikeAnalysis {
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
    && stringArray(bike.fitChecklist)
    && stringArray(bike.buyingChecklist)
    && typeof training.weeklyStructure === 'string'
    && typeof training.intensity === 'string'
    && typeof training.recovery === 'string'
    && typeof route.routingPreference === 'string'
    && typeof route.surfaceAndClimbing === 'string'
    && typeof route.safety === 'string'
    && stringArray(value.maintenance)
    && typeof nutrition.before === 'string'
    && typeof nutrition.during === 'string'
    && typeof nutrition.after === 'string'
    && (confidence.level === 'low' || confidence.level === 'medium' || confidence.level === 'high')
    && stringArray(confidence.missingData)
    && typeof value.safetyNote === 'string';
}

export async function requestProBikeAnalysis(input: ProRiderInput): Promise<ProBikeAnalysis> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error('Войди в аккаунт, чтобы открыть Pro-анализ.');
  const response = await apiFetch('/api/pro/analyze', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      ...proPromoRequestHeaders(),
    },
    body: JSON.stringify(input),
  }, 60_000);
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = isRecord(payload) && typeof payload.error === 'string'
      ? payload.error
      : 'Не удалось выполнить Pro-анализ.';
    throw new Error(message);
  }
  if (!isAnalysis(payload)) throw new Error('ИИ вернул неполный анализ. Попробуй ещё раз.');
  return payload;
}
