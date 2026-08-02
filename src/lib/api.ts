import { Capacitor } from '@capacitor/core';

const configuredApiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)
  ?.trim()
  .replace(/\/$/, '') ?? '';

export function apiUrl(path: string): string {
  if (!path.startsWith('/api/')) throw new Error('Некорректный путь API.');
  if (!configuredApiBase) {
    if (Capacitor.isNativePlatform()) {
      throw new Error('Для мобильного приложения не настроен адрес сервера API.');
    }
    return path;
  }

  let baseUrl: URL;
  try {
    baseUrl = new URL(configuredApiBase);
  } catch {
    throw new Error('Адрес сервера API настроен некорректно.');
  }
  const localDevelopment = baseUrl.hostname === 'localhost' || baseUrl.hostname === '127.0.0.1';
  if (baseUrl.protocol !== 'https:' && !localDevelopment) {
    throw new Error('Сервер API должен использовать защищённое соединение HTTPS.');
  }
  if (baseUrl.username || baseUrl.password) {
    throw new Error('Адрес сервера API не должен содержать логин или пароль.');
  }
  return new URL(path, `${baseUrl.origin}/`).toString();
}

export async function apiFetch(path: string, init?: RequestInit, timeoutMs = 30_000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(apiUrl(path), { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Сервер не ответил вовремя. Попробуй ещё раз.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
