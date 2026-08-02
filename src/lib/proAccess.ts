const universalPromoCode = 'abay8582';
const promoStorageKey = 'slipstream-universal-pro-promo';

export function matchesUniversalProPromo(value: string): boolean {
  return value.trim().toLocaleLowerCase() === universalPromoCode;
}

export function rememberUniversalProPromo(): void {
  window.localStorage.setItem(promoStorageKey, universalPromoCode);
}

export function proPromoRequestHeaders(): Record<string, string> {
  return window.localStorage.getItem(promoStorageKey) === universalPromoCode
    ? { 'x-slipstream-promo': universalPromoCode }
    : {};
}
