import { assertBillingProviderRateLimit, authenticatedUser, billingError, findProSubscription, json } from './_shared';
import { corsPreflight, withCors } from '../_cors';

async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Метод не поддерживается.' }, 405);
  try {
    const user = await authenticatedUser(request);
    await assertBillingProviderRateLimit(user);
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
