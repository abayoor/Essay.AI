import type { Locale } from './cyclingModels';
import { geocodingLanguage, localizedCountryName } from './geography';
import { localeValue } from './localized';

export type CitySuggestion = {
  id: number;
  name: string;
  country: string | null;
  admin1: string | null;
  latitude: number;
  longitude: number;
};

type CityResult = {
  id: number;
  name: string;
  country?: string;
  country_code?: string;
  admin1?: string;
  latitude: number;
  longitude: number;
};

type QuickCity = Omit<CitySuggestion, 'name' | 'country' | 'admin1'> & {
  names: Record<Locale, { name: string; country: string; admin1: string }>;
};

const quickCityData: QuickCity[] = [
  { id: 1526384, latitude: 43.25654, longitude: 76.92848, names: {
    ru: { name: 'Алматы', country: 'Казахстан', admin1: 'Алматы' },
    kz: { name: 'Алматы', country: 'Қазақстан', admin1: 'Алматы' },
    en: { name: 'Almaty', country: 'Kazakhstan', admin1: 'Almaty' },
  } },
  { id: 1526273, latitude: 51.1801, longitude: 71.44598, names: {
    ru: { name: 'Астана', country: 'Казахстан', admin1: 'Астана' },
    kz: { name: 'Астана', country: 'Қазақстан', admin1: 'Астана' },
    en: { name: 'Astana', country: 'Kazakhstan', admin1: 'Astana' },
  } },
  { id: 5454711, latitude: 35.08449, longitude: -106.65114, names: {
    ru: { name: 'Альбукерке', country: 'США', admin1: 'Нью-Мексико' },
    kz: { name: 'Альбукерке', country: 'АҚШ', admin1: 'Нью-Мексико' },
    en: { name: 'Albuquerque', country: 'United States', admin1: 'New Mexico' },
  } },
  { id: 361058, latitude: 31.20176, longitude: 29.91582, names: {
    ru: { name: 'Александрия', country: 'Египет', admin1: 'Александрия' },
    kz: { name: 'Александрия', country: 'Мысыр', admin1: 'Александрия' },
    en: { name: 'Alexandria', country: 'Egypt', admin1: 'Alexandria' },
  } },
  { id: 292223, latitude: 25.07725, longitude: 55.30927, names: {
    ru: { name: 'Дубай', country: 'ОАЭ', admin1: 'Дубай' },
    kz: { name: 'Дубай', country: 'Біріккен Араб Әмірліктері', admin1: 'Дубай' },
    en: { name: 'Dubai', country: 'United Arab Emirates', admin1: 'Dubai' },
  } },
  { id: 2643743, latitude: 51.50853, longitude: -0.12574, names: {
    ru: { name: 'Лондон', country: 'Великобритания', admin1: 'Англия' },
    kz: { name: 'Лондон', country: 'Ұлыбритания', admin1: 'Англия' },
    en: { name: 'London', country: 'United Kingdom', admin1: 'England' },
  } },
  { id: 5128581, latitude: 40.71427, longitude: -74.00597, names: {
    ru: { name: 'Нью-Йорк', country: 'США', admin1: 'Нью-Йорк' },
    kz: { name: 'Нью-Йорк', country: 'АҚШ', admin1: 'Нью-Йорк' },
    en: { name: 'New York', country: 'United States', admin1: 'New York' },
  } },
  { id: 1850147, latitude: 35.6895, longitude: 139.69171, names: {
    ru: { name: 'Токио', country: 'Япония', admin1: 'Токио' },
    kz: { name: 'Токио', country: 'Жапония', admin1: 'Токио' },
    en: { name: 'Tokyo', country: 'Japan', admin1: 'Tokyo' },
  } },
];

function quickCities(locale: Locale): CitySuggestion[] {
  return quickCityData.map(({ names, ...city }) => ({ ...city, ...names[locale] }));
}

function isCityResult(value: unknown): value is CityResult {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'number'
    && typeof item.name === 'string'
    && typeof item.latitude === 'number'
    && typeof item.longitude === 'number'
    && (typeof item.country === 'string' || item.country === undefined)
    && (typeof item.country_code === 'string' || item.country_code === undefined)
    && (typeof item.admin1 === 'string' || item.admin1 === undefined);
}

export async function searchCities(query: string, locale: Locale, signal?: AbortSignal): Promise<CitySuggestion[]> {
  const name = query.trim();
  if (name.length < 2) return [];
  const language = geocodingLanguage(locale);
  const local = quickCities(locale).filter((city) => cityLabel(city).toLocaleLowerCase(language).includes(name.toLocaleLowerCase(language)));
  if (name.length < 3) return local.slice(0, 10);
  const params = new URLSearchParams({ name, count: '10', language, format: 'json' });
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`, { signal });
  if (!response.ok) throw new Error(localeValue(locale, {
    ru: 'Сервис городов временно недоступен.',
    kz: 'Қалаларды іздеу қызметі уақытша қолжетімсіз.',
    en: 'The city search service is temporarily unavailable.',
  }));
  const payload: unknown = await response.json();
  const results = typeof payload === 'object' && payload !== null && Array.isArray((payload as Record<string, unknown>).results)
    ? (payload as { results: unknown[] }).results
    : [];
  const remote = results.filter(isCityResult).map((item) => ({
    id: item.id,
    name: item.name,
    country: localizedCountryName(item.country_code ?? null, item.country ?? null, locale),
    admin1: item.admin1 ?? null,
    latitude: item.latitude,
    longitude: item.longitude,
  }));
  return [...local, ...remote].filter((city, index, values) => values.findIndex((candidate) => candidate.id === city.id) === index).slice(0, 10);
}

export function cityLabel(city: CitySuggestion): string {
  return [city.name, city.admin1, city.country].filter((value, index, values) => Boolean(value) && values.indexOf(value) === index).join(', ');
}
