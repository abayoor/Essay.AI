import { useEffect, useId, useState } from 'react';
import { cityLabel, searchCities, type CitySuggestion } from '../lib/cities';

type CityAutocompleteProps = {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
};

export function CityAutocomplete({ value, onChange, required = false }: CityAutocompleteProps) {
  const listId = useId();
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const query = value.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setError('');
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError('');
      void searchCities(query, controller.signal).then(setSuggestions).catch((requestError: unknown) => {
        if (!(requestError instanceof DOMException && requestError.name === 'AbortError')) {
          setSuggestions([]);
          setError(requestError instanceof Error ? requestError.message : 'Не удалось найти города.');
        }
      }).finally(() => setLoading(false));
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [value]);

  return <div className="city-autocomplete">
    <input required={required} value={value} onChange={(event) => onChange(event.target.value)} placeholder="Например, Алматы" maxLength={120} autoComplete="off" aria-autocomplete="list" aria-controls={listId} />
    {(loading || suggestions.length > 0 || error) && <div className="city-suggestions" id={listId} role="listbox">
      {loading && <p>Ищем города…</p>}
      {!loading && suggestions.map((city) => <button type="button" role="option" key={city.id} onClick={() => { onChange(cityLabel(city)); setSuggestions([]); }}><strong>{city.name}</strong><span>{[city.admin1, city.country].filter(Boolean).join(', ')}</span></button>)}
      {error && <p className="form-note">{error}</p>}
    </div>}
    <small className="city-attribution">Города: <a href="https://open-meteo.com/en/docs/geocoding-api" target="_blank" rel="noreferrer">Open-Meteo</a> / GeoNames</small>
  </div>;
}
