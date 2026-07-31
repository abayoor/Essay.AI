export const usernamePattern = /^[a-z0-9][a-z0-9_-]{2,47}$/;

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidUsername(value: string): boolean {
  return usernamePattern.test(normalizeUsername(value));
}

export function isGeneratedUsername(value: string): boolean {
  return /^rider-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
}

export function isUsernameConflict(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const record = error as Record<string, unknown>;
  const message = typeof record.message === 'string' ? record.message.toLowerCase() : '';
  return record.code === '23505'
    || message.includes('users_username_key')
    || message.includes('duplicate');
}
