import { fetchWithTimeout, type ProSubscriptionStatus, type SupabaseUser } from './_shared.js';

const sandboxProductId = '6a01ab70-f3d9-4f81-8fa9-abbd17f2741f';

type PolarSubscription = {
  id?: unknown;
  status?: unknown;
  current_period_end?: unknown;
  ends_at?: unknown;
  cancel_at_period_end?: unknown;
  product_id?: unknown;
};

type PolarCustomerState = {
  active_subscriptions?: unknown;
};

function polarEnvironment(): 'sandbox' | 'production' {
  return process.env.POLAR_ENVIRONMENT === 'production' ? 'production' : 'sandbox';
}

function polarApiBaseUrl(): string {
  return polarEnvironment() === 'production'
    ? 'https://api.polar.sh/v1'
    : 'https://sandbox-api.polar.sh/v1';
}

function polarProductId(): string {
  const configured = process.env.POLAR_PRODUCT_ID?.trim();
  if (configured) return configured;
  if (polarEnvironment() === 'sandbox') return sandboxProductId;
  throw new Error('Не настроена серверная переменная POLAR_PRODUCT_ID.');
}

function polarAccessToken(): string {
  const token = process.env.POLAR_ACCESS_TOKEN?.trim();
  if (!token) throw new Error('Не настроена серверная переменная POLAR_ACCESS_TOKEN.');
  return token;
}

export function polarBillingConfigured(): boolean {
  const supportEmail = process.env.SUPPORT_EMAIL?.trim() ?? '';
  let productId = '';
  try {
    productId = polarProductId();
  } catch {
    return false;
  }
  return process.env.BILLING_ENABLED === 'true'
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)
    && Boolean(process.env.POLAR_ACCESS_TOKEN?.trim())
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(productId);
}

export function polarSandboxEnabled(): boolean {
  return polarEnvironment() === 'sandbox';
}

export function billingAppOrigin(request: Request): string {
  const configuredOrigin = process.env.APP_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (configuredOrigin) {
    const withProtocol = configuredOrigin.startsWith('http') ? configuredOrigin : `https://${configuredOrigin}`;
    const url = new URL(withProtocol);
    if (process.env.VERCEL_ENV === 'production' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) {
      throw new Error('Production APP_URL не может указывать на localhost.');
    }
    if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      throw new Error('APP_URL должен использовать HTTPS.');
    }
    return url.origin;
  }
  if (process.env.VERCEL_ENV === 'production') throw new Error('Не настроен канонический APP_URL.');
  return new URL(request.url).origin;
}

async function polarRequest(path: string, init?: RequestInit, allowNotFound = false): Promise<unknown | null> {
  const response = await fetchWithTimeout(`${polarApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${polarAccessToken()}`,
      'content-type': 'application/json',
      ...init?.headers,
    },
  }, 15_000);
  if (allowNotFound && response.status === 404) return null;
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Polar временно отклонил запрос (код ${response.status}).`);
  return payload;
}

function optionalDate(value: unknown): string | null {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null;
}

function safePolarUrl(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Polar не вернул ссылку для продолжения.');
  const url = new URL(value);
  if (url.protocol !== 'https:' || (url.hostname !== 'polar.sh' && !url.hostname.endsWith('.polar.sh'))) {
    throw new Error('Polar вернул небезопасную ссылку.');
  }
  return url.toString();
}

export async function findPolarSubscription(userId: string): Promise<ProSubscriptionStatus> {
  const empty: ProSubscriptionStatus = {
    id: null,
    active: false,
    configured: polarBillingConfigured(),
    status: null,
    renewsAt: null,
    endsAt: null,
    portalUrl: null,
    testMode: polarSandboxEnabled(),
  };
  if (!empty.configured) return empty;

  const payload = await polarRequest(
    `/customers/external/${encodeURIComponent(userId)}/state`,
    undefined,
    true,
  );
  const state = record(payload) as PolarCustomerState | null;
  if (!state || !Array.isArray(state.active_subscriptions)) return empty;

  const expectedProductId = polarProductId();
  const subscription = state.active_subscriptions
    .map((item) => record(item) as PolarSubscription | null)
    .find((item) => item && item.product_id === expectedProductId);
  if (!subscription || typeof subscription.id !== 'string') return empty;

  const currentPeriodEnd = optionalDate(subscription.current_period_end);
  const endsAt = optionalDate(subscription.ends_at);
  return {
    id: subscription.id,
    active: true,
    configured: true,
    status: subscription.cancel_at_period_end === true
      ? 'cancelled'
      : typeof subscription.status === 'string' ? subscription.status : 'active',
    renewsAt: currentPeriodEnd,
    endsAt: endsAt ?? currentPeriodEnd,
    portalUrl: null,
    testMode: polarSandboxEnabled(),
  };
}

export async function createPolarCheckout(
  user: SupabaseUser,
  locale: 'ru' | 'kz' | 'en',
  origin: string,
): Promise<string> {
  const payload = await polarRequest('/checkouts/', {
    method: 'POST',
    body: JSON.stringify({
      products: [polarProductId()],
      external_customer_id: user.id,
      customer_email: user.email,
      success_url: `${origin}/pro?checkout=success&checkout_id={CHECKOUT_ID}`,
      return_url: `${origin}/pro?checkout=cancelled`,
      metadata: { plan_key: 'pro_monthly', app: 'slipstream' },
      customer_metadata: { app: 'slipstream', locale },
    }),
  });
  return safePolarUrl(record(payload)?.url);
}

export async function createPolarCustomerPortal(userId: string, origin: string): Promise<string> {
  const payload = await polarRequest('/customer-sessions/', {
    method: 'POST',
    body: JSON.stringify({
      external_customer_id: userId,
      return_url: `${origin}/pro`,
    }),
  });
  return safePolarUrl(record(payload)?.customer_portal_url);
}
