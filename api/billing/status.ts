import { assertBillingProviderRateLimit, authenticatedUser, billingConfigured, billingError, findProSubscription, hasDatabaseProAccess, hasPreviewTesterAccess, hasUniversalPromoAccess, json } from './_shared';
import { corsPreflight, withCors } from '../_cors';

async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Метод не поддерживается.' }, 405);
  try {
    const user = await authenticatedUser(request);
    if (hasUniversalPromoAccess(request) || await hasPreviewTesterAccess(user)) {
      return json({ subscription: {
        id: 'universal-promotional-access',
        userId: user.id,
        planKey: 'pro_monthly',
        status: 'active',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        source: 'promotion',
      } });
    }
    await assertBillingProviderRateLimit(user);
    if (await hasDatabaseProAccess(user)) {
      return json({ subscription: {
        id: 'promotional-access',
        userId: user.id,
        planKey: 'pro_monthly',
        status: 'active',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        source: 'promotion',
      } });
    }
    if (!billingConfigured()) return json({ subscription: null });
    const subscription = await findProSubscription(user.email);
    if (!subscription.id) return json({ subscription: null });
    const mappedStatus = subscription.status === 'on_trial' ? 'trialing'
      : subscription.status === 'cancelled' || subscription.status === 'expired' ? 'canceled'
        : subscription.status === 'active' || subscription.status === 'past_due'
          || subscription.status === 'unpaid' || subscription.status === 'paused'
          ? subscription.status
          : 'incomplete';
    return json({
      subscription: {
        id: subscription.id,
        userId: user.id,
        planKey: 'pro_monthly',
        status: mappedStatus,
        currentPeriodEnd: subscription.endsAt ?? subscription.renewsAt,
        cancelAtPeriodEnd: subscription.status === 'cancelled',
        source: 'billing',
      },
    });
  } catch (error) {
    return billingError(error);
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    return corsPreflight(request, 'GET, OPTIONS')
      ?? withCors(request, await handler(request), 'GET, OPTIONS');
  },
};
