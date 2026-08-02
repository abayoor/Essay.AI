import {
  authenticatedUser,
  assertBillingProviderRateLimit,
  billingConfigured,
  billingError,
  findProSubscription,
  finishProCheckout,
  json,
  lemonTestModeEnabled,
  lemonSqueezyRequest,
  reserveProCheckout,
  validateProBillingProduct,
} from './_shared.js';
import { corsPreflight, withCors } from '../_cors.js';

type CheckoutResponse = {
  data?: {
    attributes?: {
      url?: unknown;
    };
  };
};

function safeOrigin(request: Request): string {
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

async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Метод не поддерживается.' }, 405);
  let checkoutLock: { user: Awaited<ReturnType<typeof authenticatedUser>>; token: string } | null = null;
  try {
    const user = await authenticatedUser(request);
    await assertBillingProviderRateLimit(user);
    const body: unknown = await request.json().catch(() => null);
    if (typeof body !== 'object' || body === null || (body as Record<string, unknown>).planKey !== 'pro_monthly') {
      return json({ error: 'Неизвестный тариф.' }, 400);
    }
    const requestedLocale = (body as Record<string, unknown>).locale;
    if (requestedLocale !== 'ru' && requestedLocale !== 'kz' && requestedLocale !== 'en') {
      return json({ error: 'Неизвестный язык оплаты.' }, 400);
    }
    if (!billingConfigured()) {
      return json({ error: 'Оплата пока работает в режиме предпросмотра. Подключи магазин в настройках сервера.' }, 503);
    }
    const existing = await findProSubscription(user.email);
    const needsPaymentAction = existing.status === 'past_due'
      || existing.status === 'paused'
      || existing.status === 'unpaid';
    if (existing.active || needsPaymentAction) {
      if (!existing.portalUrl) throw new Error('Не удалось открыть управление существующей подпиской.');
      return json({ url: existing.portalUrl, alreadySubscribed: true });
    }

    const reservation = await reserveProCheckout(user);
    if (!reservation.acquired) {
      if (reservation.checkoutUrl) return json({ url: reservation.checkoutUrl, alreadyPending: true });
      return json({ error: 'Страница оплаты уже создаётся. Подожди несколько секунд и попробуй снова.' }, 409);
    }
    if (!reservation.lockToken) throw new Error('Сервис оплаты не создал защиту от повторного списания.');
    checkoutLock = { user, token: reservation.lockToken };

    const storeId = process.env.LEMON_SQUEEZY_STORE_ID as string;
    const variantId = process.env.LEMON_SQUEEZY_VARIANT_ID as string;
    await validateProBillingProduct(storeId, variantId);
    const origin = safeOrigin(request);
    const checkoutCopy = requestedLocale === 'en' ? {
      description: 'Personal AI analysis for bike choice, fit, training, routes and maintenance.',
      receiptButton: 'Return to Slipstream',
      receiptNote: 'Pro activates after the payment provider confirms the charge.',
    } : requestedLocale === 'kz' ? {
      description: 'Велосипед, отырыс, жаттығу, бағыт және қызмет көрсету бойынша жеке AI талдауы.',
      receiptButton: 'Slipstream-ге оралу',
      receiptNote: 'Төлем сервисі төлемді растағаннан кейін Pro қосылады.',
    } : {
      description: 'Персональный ИИ-анализ велосипеда, посадки, тренировок, маршрутов и обслуживания.',
      receiptButton: 'Вернуться в Slipstream',
      receiptNote: 'Pro включится после подтверждения оплаты платёжным сервисом.',
    };
    const payload = await lemonSqueezyRequest('/checkouts', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'checkouts',
          attributes: {
            test_mode: lemonTestModeEnabled(),
            custom_price: 500,
            product_options: {
              name: 'Slipstream Pro',
              description: checkoutCopy.description,
              redirect_url: `${origin}/pro?checkout=success`,
              receipt_button_text: checkoutCopy.receiptButton,
              receipt_link_url: `${origin}/pro`,
              receipt_thank_you_note: checkoutCopy.receiptNote,
              enabled_variants: [Number(variantId)],
            },
            checkout_options: {
              embed: false,
              media: true,
              logo: true,
              desc: true,
              discount: true,
              skip_trial: true,
              subscription_preview: true,
              background_color: '#09110f',
              headings_color: '#eff8f5',
              primary_text_color: '#eff8f5',
              secondary_text_color: '#9eb2ac',
              links_color: '#52d0bc',
              borders_color: '#263a34',
              checkbox_color: '#52d0bc',
              active_state_color: '#52d0bc',
              button_color: '#52d0bc',
              button_text_color: '#071310',
              terms_privacy_color: '#9eb2ac',
              locale: requestedLocale === 'kz' ? undefined : requestedLocale,
            },
            checkout_data: {
              email: user.email,
              custom: { user_id: user.id },
            },
            expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
          },
          relationships: {
            store: { data: { type: 'stores', id: storeId } },
            variant: { data: { type: 'variants', id: variantId } },
          },
        },
      }),
    }) as CheckoutResponse;
    const checkoutUrl = payload.data?.attributes?.url;
    if (typeof checkoutUrl !== 'string') throw new Error('Платёжный сервис не вернул ссылку на оплату.');
    await finishProCheckout(user, reservation.lockToken, checkoutUrl, true).catch(() => undefined);
    checkoutLock = null;
    return json({ url: checkoutUrl, alreadySubscribed: false });
  } catch (error) {
    if (checkoutLock) {
      await finishProCheckout(checkoutLock.user, checkoutLock.token, null, false).catch(() => undefined);
    }
    return billingError(error);
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    return corsPreflight(request, 'POST, OPTIONS')
      ?? withCors(request, await handler(request), 'POST, OPTIONS');
  },
};
