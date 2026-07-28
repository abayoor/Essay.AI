import { supabase } from './supabase';

const referralKey = 'essaycoach-referral-code';
const codePattern = /^[a-f0-9]{10}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function rememberReferralFromUrl(): void {
  const code = new URLSearchParams(window.location.search).get('ref')?.toLowerCase().trim() ?? '';
  if (codePattern.test(code)) window.sessionStorage.setItem(referralKey, code);
  else window.sessionStorage.removeItem(referralKey);
}

export function clearPendingReferral(): void {
  window.sessionStorage.removeItem(referralKey);
}

export async function applyPendingReferral(): Promise<void> {
  const code = window.sessionStorage.getItem(referralKey);
  if (!code || !codePattern.test(code)) return;

  const { data, error } = await supabase.rpc('apply_referral_code', { input_code: code });
  if (error) throw error;
  if (!isRecord(data) || typeof data.applied !== 'boolean') throw new Error('Не удалось подтвердить реферальный код.');
  window.sessionStorage.removeItem(referralKey);
}

export async function loadReferralCode(): Promise<string> {
  const { data, error } = await supabase.from('users').select('referral_code').maybeSingle();
  if (error) throw error;
  const code = data?.referral_code;
  if (typeof code !== 'string' || !codePattern.test(code)) throw new Error('Не удалось загрузить реферальную ссылку.');
  return code;
}
