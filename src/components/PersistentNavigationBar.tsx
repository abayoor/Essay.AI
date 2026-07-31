import { MapPin, Navigation, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import {
  clearMapNavigation,
  loadMapNavigation,
  navigationUpdatedEvent,
  type PersistedMapNavigation,
} from '../lib/activeNavigation';

export function PersistentNavigationBar() {
  const [location, navigate] = useLocation();
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

  return <aside className="persistent-navigation-bar" aria-label="Сохранённый маршрут">
    <span><MapPin size={18} /></span>
    <div><small>{navigation.active ? 'Навигация продолжается' : 'Маршрут сохранён'}</small><strong>{navigation.destinationName}</strong></div>
    <b>{navigation.result.distanceKm.toFixed(1)} км</b>
    <button type="button" className="persistent-navigation-resume" onClick={() => navigate('/map')}><Navigation size={16} />Продолжить</button>
    <button type="button" className="persistent-navigation-clear" aria-label="Удалить сохранённый маршрут" onClick={() => { clearMapNavigation(); setNavigation(null); }}><Trash2 size={16} /></button>
  </aside>;
}
