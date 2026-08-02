import { Capacitor } from '@capacitor/core';
import { apiFetch } from './api';
import { supabase } from './supabase';

export type SubscriptionStatus =
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused';

export type BillingSubscription = {
  id: string;
  userId: string;
  planKey: 'pro_monthly';
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

/**
 * This public flag only controls whether checkout can be opened. Provider
 * secrets and price/variant IDs stay in the backend, never in Vite variables.
 */
const billingEnabled = (import.meta.env.VITE_BILLING_ENABLED as string | undefined) === 'true';
const nativePlatform = Capacitor.isNativePlatform();
const supportEmail = (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined)?.trim() ?? '';

export const billingConfiguration = {
  enabled: billingEnabled,
  checkoutEnabled: billingEnabled && supportEmail.length > 0 && !nativePlatform,
  nativePlatform,
  supportEmail,
  planKey: 'pro_monthly' as const,
  monthlyPriceUsd: 5,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSubscriptionStatus(value: unknown): value is SubscriptionStatus {
  return typeof value === 'string' && [
    'incomplete',
    'incomplete_expired',
    'trialing',
    'active',
    'past_due',
    'canceled',
    'unpaid',
    'paused',
  ].includes(value);
}

function parseSubscription(value: unknown): BillingSubscription | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== 'string'
    || typeof value.userId !== 'string'
    || value.planKey !== 'pro_monthly'
    || !isSubscriptionStatus(value.status)
  ) return null;

  return {
    id: value.id,
    userId: value.userId,
    planKey: value.planKey,
    status: value.status,
    currentPeriodEnd: typeof value.currentPeriodEnd === 'string' ? value.currentPeriodEnd : null,
    cancelAtPeriodEnd: value.cancelAtPeriodEnd === true,
  };
}

function apiErrorMessage(value: unknown): string | null {
  if (!isRecord(value)) return null;
  return typeof value.error === 'string' ? value.error : null;
}

async function accessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error('Войди в аккаунт, чтобы управлять подпиской.');
  }
  return data.session.access_token;
}

async function createBillingSession(path: 'checkout' | 'portal', body?: Record<string, string>): Promise<string> {
  if (!billingConfiguration.enabled) {
    throw new Error('Оплата пока не подключена. Страница работает в режиме предварительного просмотра.');
  }
  if (!billingConfiguration.checkoutEnabled) {
    throw new Error('В мобильном приложении подписка и управление ею будут работать через магазин приложений.');
  }

  const token = await accessToken();
  const response = await apiFetch(`/api/billing/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body ?? {}),
  }, 30_000).catch(() => null);

  if (!response) throw new Error('Не удалось связаться с сервисом оплаты. Попробуй ещё раз.');
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(apiErrorMessage(payload) ?? 'Сервис оплаты временно недоступен.');
  }
  if (!isRecord(payload) || typeof payload.url !== 'string') {
    throw new Error('Сервис оплаты вернул некорректный ответ.');
  }

  let redirectUrl: URL;
  try {
    redirectUrl = new URL(payload.url, window.location.origin);
  } catch {
    throw new Error('Сервис оплаты вернул некорректный адрес.');
  }
  if (redirectUrl.protocol !== 'https:' && redirectUrl.origin !== window.location.origin) {
    throw new Error('Сервис оплаты вернул небезопасный адрес.');
  }
  return redirectUrl.toString();
}

export async function loadCurrentSubscription(): Promise<BillingSubscription | null> {
  if (!billingConfiguration.enabled) return null;
  const token = await accessToken();
  const response = await apiFetch('/api/billing/status', {
    headers: { Authorization: `Bearer ${token}` },
  }, 20_000).catch(() => null);
  if (!response) throw new Error('Не удалось проверить подписку. Попробуй ещё раз.');

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(apiErrorMessage(payload) ?? 'Не удалось проверить статус подписки.');
  }
  if (!isRecord(payload) || !('subscription' in payload)) {
    throw new Error('Сервис оплаты вернул некорректный статус подписки.');
  }
  if (payload.subscription === null) return null;

  const subscription = parseSubscription(payload.subscription);
  if (!subscription) throw new Error('Сервис оплаты вернул некорректный статус подписки.');
  return subscription;
}

export function hasActivePro(subscription: BillingSubscription | null): boolean {
  if (subscription?.status === 'active' || subscription?.status === 'trialing') return true;
  return subscription?.status === 'canceled'
    && subscription.currentPeriodEnd !== null
    && Date.parse(subscription.currentPeriodEnd) > Date.now();
}

export async function createProCheckout(locale: 'ru' | 'kz' | 'en'): Promise<string> {
  return createBillingSession('checkout', { planKey: billingConfiguration.planKey, locale });
}

export async function createBillingPortal(): Promise<string> {
  return createBillingSession('portal');
}
