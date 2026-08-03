import { assertBillingProviderRateLimit, authenticatedUser, billingError, findProSubscription, json } from './_shared.js';
import { billingAppOrigin, createPolarCustomerPortal, findPolarSubscription, polarBillingConfigured } from './_polar.js';
import { corsPreflight, withCors } from '../_cors.js';

async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Метод не поддерживается.' }, 405);
  try {
    const user = await authenticatedUser(request);
    await assertBillingProviderRateLimit(user);
    if (polarBillingConfigured()) {
      const subscription = await findPolarSubscription(user.id);
      if (!subscription.id) return json({ error: 'Активная подписка пока не найдена.' }, 404);
      return json({ url: await createPolarCustomerPortal(user.id, billingAppOrigin(request)) });
    }
    const subscription = await findProSubscription(user.email);
    if (!subscription.portalUrl) {
      return json({ error: 'Активная подписка пока не найдена.' }, 404);
    }
    return json({ url: subscription.portalUrl });
  } catch (error) {
    return billingError(error);
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    return corsPreflight(request, 'POST, OPTIONS')
      ?? withCors(request, await handler(request), 'POST, OPTIONS');
  },
};
