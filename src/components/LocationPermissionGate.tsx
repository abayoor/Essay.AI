import { Bike, Check, LocateFixed, Map, MapPin, Navigation, Settings, ShieldCheck, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useSession } from '../lib/auth';
import {
  forgetLocationPermission,
  hasVerifiedLocationPermission,
  locationPermissionGrantedEvent,
  locationPermissionRequestEvent,
  rememberLocationPermission,
  requestCurrentLocation,
} from '../lib/locationPermission';
import { useLocaleText } from '../lib/localized';

type GateState = 'hidden' | 'intro' | 'requesting' | 'denied' | 'unavailable' | 'timeout';

function dismissalKey(userId: string): string {
  return `slipstream-location-prompt-dismissed:${userId}`;
}

export function LocationPermissionGate() {
  const { session } = useSession();
  const text = useLocaleText();
  const [state, setState] = useState<GateState>('hidden');
  const userId = session?.user.id ?? null;

  const verifyLocation = useCallback(async (nextUserId: string) => {
    setState('requesting');
    const result = await requestCurrentLocation();
    if (result.status === 'granted') {
      rememberLocationPermission(nextUserId);
      window.sessionStorage.removeItem(dismissalKey(nextUserId));
      setState('hidden');
      window.dispatchEvent(new CustomEvent(locationPermissionGrantedEvent, { detail: result.position }));
      return;
    }
    forgetLocationPermission(nextUserId);
    setState(result.status);
  }, []);

  const inspectPermission = useCallback(async (nextUserId: string, forceVisible = false) => {
    if (!window.isSecureContext || !navigator.geolocation) {
      setState('unavailable');
      return;
    }
    if (!forceVisible && window.sessionStorage.getItem(dismissalKey(nextUserId)) === 'true') return;

    if (!navigator.permissions) {
      if (hasVerifiedLocationPermission(nextUserId)) {
        setState('hidden');
      } else {
        setState('intro');
      }
      return;
    }

    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      if (permission.state === 'granted') {
        rememberLocationPermission(nextUserId);
        window.sessionStorage.removeItem(dismissalKey(nextUserId));
        setState('hidden');
      } else {
        forgetLocationPermission(nextUserId);
        setState(permission.state === 'denied' ? 'denied' : 'intro');
      }
    } catch {
      setState(hasVerifiedLocationPermission(nextUserId) ? 'hidden' : 'intro');
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      setState('hidden');
      return undefined;
    }
    let active = true;
    void inspectPermission(userId).catch(() => {
      if (active) setState('unavailable');
    });

    const reopen = () => {
      window.sessionStorage.removeItem(dismissalKey(userId));
      void inspectPermission(userId, true);
    };
    window.addEventListener(locationPermissionRequestEvent, reopen);
    return () => {
      active = false;
      window.removeEventListener(locationPermissionRequestEvent, reopen);
    };
  }, [inspectPermission, userId]);

  function dismiss() {
    if (!userId) return;
    window.sessionStorage.setItem(dismissalKey(userId), 'true');
    setState('hidden');
  }

  if (!userId || state === 'hidden') return null;

  const blocked = state === 'denied';
  const unavailable = state === 'unavailable';
  const timedOut = state === 'timeout';
  const requesting = state === 'requesting';

  return <div className="location-permission-backdrop" role="presentation">
    <section className="location-permission-dialog" role="dialog" aria-modal="true" aria-labelledby="location-permission-title">
      <button type="button" className="location-permission-close" onClick={dismiss} aria-label={text('Напомнить позже', 'Кейін еске салу', 'Remind me later')}><X size={19} /></button>
      <div className={`location-permission-icon${blocked || unavailable ? ' is-warning' : ''}`}>
        {blocked || unavailable ? <Settings size={30} /> : <LocateFixed size={30} />}
      </div>
      <p className="kicker">GPS · Slipstream</p>
      <h2 id="location-permission-title">{blocked
        ? text('Геолокация заблокирована', 'Геолокация бұғатталған', 'Location is blocked')
        : unavailable
          ? text('Геолокация недоступна', 'Геолокация қолжетімсіз', 'Location is unavailable')
          : timedOut
            ? text('Не удалось поймать GPS', 'GPS сигналын табу мүмкін болмады', 'Could not get a GPS fix')
            : text('Разреши доступ к геолокации', 'Геолокацияға рұқсат бер', 'Allow location access')}</h2>
      <p>{blocked
        ? text(
          'Открой настройки сайта рядом с адресной строкой, выбери «Геолокация» → «Разрешить», затем вернись и нажми кнопку ниже',
          'Мекенжай жолағының жанындағы сайт баптауларын ашып, «Геолокация» → «Рұқсат беру» таңда, содан кейін төмендегі түймені бас',
          'Open site settings beside the address bar, set Location to Allow, then come back and use the button below',
        )
        : unavailable
          ? text(
            'Проверь, что геолокация включена на устройстве и сайт открыт по защищённому адресу HTTPS',
            'Құрылғыда геолокация қосылғанын және сайт HTTPS арқылы ашылғанын тексер',
            'Check that device location is on and the site is open over a secure HTTPS connection',
          )
          : timedOut
            ? text(
              'Включи геолокацию на телефоне, выйди на открытое место и попробуй ещё раз',
              'Телефонда геолокацияны қосып, ашық жерге шығып, қайта көр',
              'Turn on device location, move somewhere with a clear view of the sky and try again',
            )
            : text(
              'Это нужно, чтобы запись тренировок и карта действительно работали. Slipstream не публикует твою позицию и не делится ей без отдельного разрешения',
              'Бұл жаттығу жазбасы мен картаның дұрыс жұмыс істеуі үшін керек. Slipstream сенің орныңды жарияламайды және бөлек рұқсатсыз бөліспейді',
              'This makes workout recording and the map work properly. Slipstream does not publish or share your position without separate permission',
            )}</p>

      {!blocked && !unavailable && !timedOut && <div className="location-permission-benefits">
        <span><Bike size={18} /><b>{text('Запись маршрута', 'Бағытты жазу', 'Route recording')}</b><Check size={15} /></span>
        <span><Map size={18} /><b>{text('Твоё место на карте', 'Картадағы орның', 'Your map position')}</b><Check size={15} /></span>
        <span><Navigation size={18} /><b>{text('Навигация в поездке', 'Сапар навигациясы', 'Ride navigation')}</b><Check size={15} /></span>
      </div>}

      <div className="location-permission-privacy"><ShieldCheck size={17} /><span>{text(
        'Проверяем только текущую позицию. История местоположения не создаётся',
        'Тек қазіргі орның тексеріледі. Орналасу тарихы жасалмайды',
        'Only your current position is checked. No location history is created',
      )}</span></div>

      <div className="location-permission-actions">
        <button type="button" className="signal-button" disabled={requesting} onClick={() => void verifyLocation(userId)}>
          <MapPin size={18} />
          {requesting
            ? text('Определяем позицию…', 'Орның анықталуда…', 'Finding your location…')
            : blocked
              ? text('Я разрешил — проверить', 'Рұқсат бердім — тексеру', 'I allowed it — check again')
              : text('Разрешить геолокацию', 'Геолокацияға рұқсат беру', 'Allow location')}
        </button>
        <button type="button" className="quiet-button" disabled={requesting} onClick={dismiss}>{text('Сделать позже', 'Кейін жасау', 'Do this later')}</button>
      </div>
    </section>
  </div>;
}
