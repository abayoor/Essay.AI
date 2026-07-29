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
  admin1?: string;
  latitude: number;
  longitude: number;
};

const quickCities: CitySuggestion[] = [
  { id: 1526384, name: 'Алматы', country: 'Казахстан', admin1: 'Алматы', latitude: 43.25654, longitude: 76.92848 },
  { id: 1526273, name: 'Астана', country: 'Казахстан', admin1: 'Астана', latitude: 51.1801, longitude: 71.44598 },
  { id: 5454711, name: 'Албукерке', country: 'США', admin1: 'Нью-Мексико', latitude: 35.08449, longitude: -106.65114 },
  { id: 361058, name: 'Александрия', country: 'Египет', admin1: 'Александрия', latitude: 31.20176, longitude: 29.91582 },
  { id: 292223, name: 'Дубай', country: 'ОАЭ', admin1: 'Дубай', latitude: 25.07725, longitude: 55.30927 },
  { id: 2643743, name: 'Лондон', country: 'Великобритания', admin1: 'Англия', latitude: 51.50853, longitude: -0.12574 },
  { id: 5128581, name: 'Нью-Йорк', country: 'США', admin1: 'Нью-Йорк', latitude: 40.71427, longitude: -74.00597 },
  { id: 1850147, name: 'Токио', country: 'Япония', admin1: 'Токио', latitude: 35.6895, longitude: 139.69171 },
];

function isCityResult(value: unknown): value is CityResult {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'number'
    && typeof item.name === 'string'
    && typeof item.latitude === 'number'
    && typeof item.longitude === 'number'
    && (typeof item.country === 'string' || item.country === undefined)
    && (typeof item.admin1 === 'string' || item.admin1 === undefined);
}

export async function searchCities(query: string, signal?: AbortSignal): Promise<CitySuggestion[]> {
  const name = query.trim();
  if (name.length < 2) return [];
  const local = quickCities.filter((city) => cityLabel(city).toLocaleLowerCase('ru').includes(name.toLocaleLowerCase('ru')));
  if (name.length < 3) return local.slice(0, 10);
  const params = new URLSearchParams({ name, count: '10', language: 'ru', format: 'json' });
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`, { signal });
  if (!response.ok) throw new Error('Сервис городов временно недоступен.');
  const payload: unknown = await response.json();
  const results = typeof payload === 'object' && payload !== null && Array.isArray((payload as Record<string, unknown>).results)
    ? (payload as { results: unknown[] }).results
    : [];
  const remote = results.filter(isCityResult).map((item) => ({
    id: item.id,
    name: item.name,
    country: item.country ?? null,
    admin1: item.admin1 ?? null,
    latitude: item.latitude,
    longitude: item.longitude,
  }));
  return [...local, ...remote].filter((city, index, values) => values.findIndex((candidate) => candidate.id === city.id) === index).slice(0, 10);
}

export function cityLabel(city: CitySuggestion): string {
  return [city.name, city.admin1, city.country].filter((value, index, values) => Boolean(value) && values.indexOf(value) === index).join(', ');
}
