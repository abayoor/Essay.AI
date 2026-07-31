import { MapPin, Navigation, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import {
  clearMapNavigation,
  loadMapNavigation,
  navigationUpdatedEvent,
  type PersistedMapNavigation,
} from '../lib/activeNavigation';
import { useLocaleText } from '../lib/localized';

export function PersistentNavigationBar() {
  const [location, navigate] = useLocation();
  const text = useLocaleText();
  const [navigation, setNavigation] = useState<PersistedMapNavigation | null>(() => loadMapNavigation());

  useEffect(() => {
    const update = () => setNavigation(loadMapNavigation());
    window.addEventListener(navigationUpdatedEvent, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(navigationUpdatedEvent, update);
      window.removeEventListener('storage', update);
    };
  }, []);

  if (!navigation || location.startsWith('/map')) return null;

  return <aside className="persistent-navigation-bar" aria-label={text('Сохранённый маршрут', 'Сақталған бағыт', 'Saved route')}>
    <span><MapPin size={18} /></span>
    <div><small>{navigation.active ? text('Навигация продолжается', 'Навигация жалғасуда', 'Navigation active') : text('Маршрут сохранён', 'Бағыт сақталды', 'Route saved')}</small><strong>{navigation.destinationName}</strong></div>
    <b>{navigation.result.distanceKm.toFixed(1)} {text('км', 'км', 'km')}</b>
    <button type="button" className="persistent-navigation-resume" onClick={() => navigate('/map')}><Navigation size={16} />{text('Продолжить', 'Жалғастыру', 'Resume')}</button>
    <button type="button" className="persistent-navigation-clear" aria-label={text('Удалить сохранённый маршрут', 'Сақталған бағытты жою', 'Delete saved route')} onClick={() => { clearMapNavigation(); setNavigation(null); }}><Trash2 size={16} /></button>
  </aside>;
}
