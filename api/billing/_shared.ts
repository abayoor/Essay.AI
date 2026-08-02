export type SupabaseUser = {
  id: string;
  email: string;
  accessToken: string;
};

type LemonSubscriptionAttributes = {
  status?: unknown;
  variant_id?: unknown;
  renews_at?: unknown;
  ends_at?: unknown;
  test_mode?: unknown;
  urls?: unknown;
};

type LemonResource = {
  id?: unknown;
  attributes?: unknown;
};

export type ProSubscriptionStatus = {
  id: string | null;
  active: boolean;
  configured: boolean;
  status: string | null;
  renewsAt: string | null;
  endsAt: string | null;
  portalUrl: string | null;
  testMode: boolean;
};

export function json(value: object, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'private, no-store',
    },
  });
}

export class UpstreamTimeoutError extends Error {
  constructor() {
    super('Внешний сервис не ответил вовремя. Попробуй ещё раз.');
    this.name = 'UpstreamTimeoutError';
  }
}

export async function fetchWithTimeout(
  input: string,
  init: RequestInit | undefined,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new UpstreamTimeoutError();
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function serverSetting(primary: string, fallback?: string): string {
  const value = process.env[primary] ?? (fallback ? process.env[fallback] : undefined);
  if (!value) throw new Error(`Не настроена серверная переменная ${primary}.`);
  return value;
}

export function billingConfigured(): boolean {
  const storeId = process.env.LEMON_SQUEEZY_STORE_ID ?? '';
  const variantId = process.env.LEMON_SQUEEZY_VARIANT_ID ?? '';
  const supportEmail = process.env.SUPPORT_EMAIL?.trim() ?? '';
  return process.env.BILLING_ENABLED === 'true'
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)
    && Boolean(process.env.LEMON_SQUEEZY_API_KEY)
    && /^\d+$/.test(storeId)
    && /^\d+$/.test(variantId);
}

export function lemonTestModeEnabled(): boolean {
  return process.env.LEMON_SQUEEZY_ALLOW_TEST_MODE === 'true'
    && process.env.VERCEL_ENV !== 'production';
}

function bearerToken(request: Request): string {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) throw new Error('Нужна авторизация.');
  return header.slice('Bearer '.length);
}

export async function authenticatedUser(request: Request): Promise<SupabaseUser> {
  const supabaseUrl = serverSetting('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const supabaseAnonKey = serverSetting('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  const accessToken = bearerToken(request);
  const response = await fetchWithTimeout(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnonKey,
      authorization: `Bearer ${accessToken}`,
    },
  }, 10_000);
  if (!response.ok) throw new Error('Сессия истекла. Войди в аккаунт снова.');
  const payload = await response.json() as { id?: unknown; email?: unknown };
  if (typeof payload.id !== 'string' || typeof payload.email !== 'string') {
    throw new Error('Не удалось определить пользователя.');
  }
  return { id: payload.id, email: payload.email.trim().toLowerCase(), accessToken };
}

export class ProQuotaError extends Error {
  constructor(message: string, readonly retryAfterSeconds: number) {
    super(message);
    this.name = 'ProQuotaError';
  }
}

export class BillingRateLimitError extends Error {
  constructor() {
    super('Слишком много проверок подписки. Подожди минуту.');
    this.name = 'BillingRateLimitError';
  }
}

export class RoutingRateLimitError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super('Слишком много запросов маршрута. Подожди немного и попробуй снова.');
    this.name = 'RoutingRateLimitError';
  }
}

export type ProAnalysisCredit = {
  reservationId: number;
  reservationToken: string;
  remaining: number;
};

async function authenticatedRpc(
  user: SupabaseUser,
  functionName: string,
  body: object,
  failureMessage: string,
): Promise<unknown> {
  const supabaseUrl = serverSetting('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const supabaseAnonKey = serverSetting('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  const response = await fetchWithTimeout(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      authorization: `Bearer ${user.accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  }, 10_000);
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(failureMessage);
  }
  return payload;
}

export async function hasDatabaseProAccess(user: SupabaseUser): Promise<boolean> {
  const payload = await authenticatedRpc(user, 'has_pro_access', {}, 'Не удалось проверить промо-доступ Pro.');
  return payload === true;
}

export async function consumeProAnalysisCredit(
  user: SupabaseUser,
  consentPolicyVersion: '2026-08-01',
): Promise<ProAnalysisCredit> {
  const payload = await authenticatedRpc(user, 'consume_pro_analysis_credit', {
    policy_version: consentPolicyVersion,
  }, 'Не удалось проверить лимит Pro-анализа. Попробуй позже.');
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('Не удалось проверить лимит Pro-анализа. Попробуй позже.');
  }
  const result = payload as Record<string, unknown>;
  if (result.allowed !== true) {
    const reason = typeof result.reason === 'string' ? result.reason : 'monthly_limit';
    if (reason === 'in_flight') throw new ProQuotaError('Дождись завершения уже запущенного Pro-анализа.', 15);
    if (reason === 'rate_limit') throw new ProQuotaError('Слишком много запросов подряд. Подожди минуту.', 60);
    if (reason === 'daily_attempt_limit') throw new ProQuotaError('Сегодня было слишком много попыток анализа. Попробуй завтра.', 86_400);
    throw new ProQuotaError('Лимит — 30 подробных ИИ-разборов в месяц. Новый лимит откроется в следующем месяце.', 3600);
  }
  if (typeof result.reservation_id !== 'number' || typeof result.reservation_token !== 'string') {
    throw new Error('Сервис лимитов вернул некорректный ответ.');
  }
  return {
    reservationId: result.reservation_id,
    reservationToken: result.reservation_token,
    remaining: typeof result.remaining === 'number' ? result.remaining : 0,
  };
}

export async function finishProAnalysisCredit(
  user: SupabaseUser,
  reservationId: number,
  reservationToken: string,
  succeeded: boolean,
): Promise<void> {
  await authenticatedRpc(user, 'finish_pro_analysis_credit', {
    reservation_id: reservationId,
    provided_token: reservationToken,
    succeeded,
  }, 'Не удалось обновить лимит Pro-анализа.');
}

export type BillingCheckoutReservation = {
  acquired: boolean;
  lockToken: string | null;
  checkoutUrl: string | null;
};

export async function reserveProCheckout(user: SupabaseUser): Promise<BillingCheckoutReservation> {
  const payload = await authenticatedRpc(
    user,
    'reserve_pro_checkout',
    {},
    'Не удалось безопасно открыть оплату. Попробуй позже.',
  );
  if (typeof payload !== 'object' || payload === null) throw new Error('Сервис оплаты вернул некорректный ответ.');
  const result = payload as Record<string, unknown>;
  return {
    acquired: result.acquired === true,
    lockToken: typeof result.lock_token === 'string' ? result.lock_token : null,
    checkoutUrl: typeof result.checkout_url === 'string' ? result.checkout_url : null,
  };
}

export async function finishProCheckout(
  user: SupabaseUser,
  lockToken: string,
  checkoutUrl: string | null,
  succeeded: boolean,
): Promise<void> {
  await authenticatedRpc(user, 'finish_pro_checkout_lock', {
    provided_token: lockToken,
    next_checkout_url: checkoutUrl,
    succeeded,
  }, 'Не удалось обновить состояние оплаты.');
}

export async function assertBillingProviderRateLimit(user: SupabaseUser): Promise<void> {
  const payload = await authenticatedRpc(
    user,
    'consume_billing_provider_request',
    {},
    'Не удалось проверить доступ к платёжному сервису.',
  );
  if (payload !== true) throw new BillingRateLimitError();
}

export async function assertRoutingRateLimit(user: SupabaseUser): Promise<void> {
  const payload = await authenticatedRpc(
    user,
    'consume_route_request',
    {},
    'Не удалось проверить лимит маршрутизации.',
  );
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('Сервис лимитов маршрутизации вернул некорректный ответ.');
  }
  const result = payload as Record<string, unknown>;
  if (result.allowed === true) return;
  throw new RoutingRateLimitError(result.reason === 'daily_limit' ? 3_600 : 60);
}

export async function lemonSqueezyRequest(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetchWithTimeout(`https://api.lemonsqueezy.com/v1${path}`, {
    ...init,
    headers: {
      accept: 'application/vnd.api+json',
      'content-type': 'application/vnd.api+json',
      authorization: `Bearer ${serverSetting('LEMON_SQUEEZY_API_KEY')}`,
      ...init?.headers,
    },
  }, 15_000);
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Платёжный сервис временно отклонил запрос (код ${response.status}).`);
  }
  return payload;
}

function resourceAttributes(payload: unknown): Record<string, unknown> | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const data = (payload as Record<string, unknown>).data;
  if (typeof data !== 'object' || data === null) return null;
  const attributes = (data as Record<string, unknown>).attributes;
  return typeof attributes === 'object' && attributes !== null
    ? attributes as Record<string, unknown>
    : null;
}

export async function validateProBillingProduct(storeId: string, variantId: string): Promise<void> {
  const [storePayload, variantPayload] = await Promise.all([
    lemonSqueezyRequest(`/stores/${encodeURIComponent(storeId)}`),
    lemonSqueezyRequest(`/variants/${encodeURIComponent(variantId)}`),
  ]);
  const store = resourceAttributes(storePayload);
  const variant = resourceAttributes(variantPayload);
  if (!store || store.currency !== 'USD') {
    throw new Error('Магазин подписки должен использовать валюту USD.');
  }
  if (!variant
    || variant.is_subscription !== true
    || variant.interval !== 'month'
    || variant.interval_count !== 1
    || variant.price !== 500
    || (variant.status !== 'published' && variant.status !== 'pending')
    || variant.test_mode !== lemonTestModeEnabled()) {
    throw new Error('Тариф должен быть опубликованной подпиской $5 USD с периодом один месяц.');
  }
}

function optionalDate(value: unknown): string | null {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null;
}

function subscriptionIsActive(status: string | null, endsAt: string | null): boolean {
  if (status === 'active' || status === 'on_trial') return true;
  return status === 'cancelled' && endsAt !== null && Date.parse(endsAt) > Date.now();
}

function normalizeSubscription(resource: LemonResource): ProSubscriptionStatus | null {
  if (typeof resource.attributes !== 'object' || resource.attributes === null) return null;
  const attributes = resource.attributes as LemonSubscriptionAttributes;
  if (attributes.test_mode === true && !lemonTestModeEnabled()) return null;
  const expectedVariant = process.env.LEMON_SQUEEZY_VARIANT_ID;
  if (expectedVariant && String(attributes.variant_id ?? '') !== expectedVariant) return null;
  const status = typeof attributes.status === 'string' ? attributes.status : null;
  const renewsAt = optionalDate(attributes.renews_at);
  const endsAt = optionalDate(attributes.ends_at);
  const urls = typeof attributes.urls === 'object' && attributes.urls !== null
    ? attributes.urls as Record<string, unknown>
    : {};
  return {
    id: typeof resource.id === 'string' ? resource.id : null,
    active: subscriptionIsActive(status, endsAt),
    configured: true,
    status,
    renewsAt,
    endsAt,
    portalUrl: typeof urls.customer_portal === 'string' ? urls.customer_portal : null,
    testMode: attributes.test_mode === true,
  };
}

export async function findProSubscription(email: string): Promise<ProSubscriptionStatus> {
  if (!billingConfigured()) {
    return {
      id: null,
      active: false,
      configured: false,
      status: null,
      renewsAt: null,
      endsAt: null,
      portalUrl: null,
      testMode: false,
    };
  }
  const query = new URLSearchParams({
    'filter[store_id]': serverSetting('LEMON_SQUEEZY_STORE_ID'),
    'filter[user_email]': email,
    'filter[variant_id]': serverSetting('LEMON_SQUEEZY_VARIANT_ID'),
    'page[size]': '20',
  });
  const payload = await lemonSqueezyRequest(`/subscriptions?${query.toString()}`);
  const resources = typeof payload === 'object' && payload !== null
    && Array.isArray((payload as Record<string, unknown>).data)
    ? (payload as { data: LemonResource[] }).data
    : [];
  const subscriptions = resources.flatMap((resource) => {
    const normalized = normalizeSubscription(resource);
    return normalized ? [normalized] : [];
  });
  const preferred = subscriptions.find((subscription) => subscription.active) ?? subscriptions[0];
  return preferred ?? {
    id: null,
    active: false,
    configured: true,
    status: null,
    renewsAt: null,
    endsAt: null,
    portalUrl: null,
    testMode: false,
  };
}

export function billingError(error: unknown): Response {
  const message = error instanceof Error ? error.message : 'Внутренняя ошибка сервера.';
  const status = error instanceof BillingRateLimitError ? 429
    : error instanceof UpstreamTimeoutError ? 504
    : message.includes('авторизац') || message.includes('Сессия') ? 401
    : message.includes('Не настроена') ? 503
      : 502;
  return json({ error: message }, status);
}
