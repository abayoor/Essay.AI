import { useEffect, useId, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import {
  AlertTriangle,
  Ban,
  Check,
  Construction,
  Crosshair,
  Dog,
  GlassWater,
  LocateFixed,
  Moon,
  Navigation,
  X,
} from 'lucide-react';
import type { HazardReport, HazardType, ReportHazardInput } from '../lib/hazards';
import { useLocaleText } from '../lib/localized';
import '../styles/safety.css';

export type HazardReportFormValue = ReportHazardInput;
export type HazardLocationSource = 'gps' | 'map';

export type HazardReportSheetProps = {
  open: boolean;
  gpsLocation?: HazardReport['location'] | null;
  mapLocation?: HazardReport['location'] | null;
  mapPicking?: boolean;
  submitting?: boolean;
  error?: string;
  onClose: () => void;
  onRequestMapPick: () => void;
  onSubmit: (value: HazardReportFormValue) => void | Promise<void>;
};

type HazardOption = {
  type: HazardType;
  label: string;
  hint: string;
  icon: typeof AlertTriangle;
};

export function HazardReportSheet({
  open,
  gpsLocation = null,
  mapLocation = null,
  mapPicking = false,
  submitting = false,
  error = '',
  onClose,
  onRequestMapPick,
  onSubmit,
}: HazardReportSheetProps) {
  const text = useLocaleText();
  const titleId = useId();
  const descriptionId = useId();
  const sheetRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const submittingRef = useRef(submitting);
  const submitLockRef = useRef(false);
  const [hazardType, setHazardType] = useState<HazardType>('pothole');
  const [description, setDescription] = useState('');
  const [locationSource, setLocationSource] = useState<HazardLocationSource>(mapLocation ? 'map' : 'gps');
  const [validationError, setValidationError] = useState('');
  onCloseRef.current = onClose;
  submittingRef.current = submitting;

  const options: readonly HazardOption[] = [
    { type: 'pothole', label: text('Яма', 'Шұңқыр', 'Pothole'), hint: text('Разбитая дорога', 'Бұзылған жол', 'Broken road'), icon: Construction },
    { type: 'no_lighting', label: text('Нет света', 'Жарық жоқ', 'No lights'), hint: text('Тёмный участок', 'Қараңғы жер', 'Dark section'), icon: Moon },
    { type: 'glass', label: text('Стекло', 'Шыны', 'Glass'), hint: text('Острый мусор', 'Өткір қоқыс', 'Sharp debris'), icon: GlassWater },
    { type: 'aggressive_dogs', label: text('Собаки', 'Иттер', 'Dogs'), hint: text('Опасные животные', 'Қауіпті жануарлар', 'Aggressive animals'), icon: Dog },
    { type: 'road_closed', label: text('Перекрыто', 'Жол жабық', 'Road closed'), hint: text('Проезда нет', 'Өтуге болмайды', 'No passage'), icon: Ban },
  ];
  const selectedLocation = locationSource === 'gps' ? gpsLocation : mapLocation;

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !submittingRef.current) {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(sheetRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), textarea:not(:disabled), input:not(:disabled), select:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
      ) ?? []).filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === sheetRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setValidationError('');
    setLocationSource(mapLocation ? 'map' : 'gps');
    submitLockRef.current = false;
    if (!mapLocation) {
      setHazardType('pothole');
      setDescription('');
    }
  }, [mapLocation, open]);

  function requestMapPick() {
    setValidationError('');
    setLocationSource('map');
    onRequestMapPick();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLockRef.current || submitting) return;
    if (!selectedLocation) {
      setValidationError(text(
        'Выбери текущую GPS-точку или отметь место на карте.',
        'Ағымдағы GPS нүктесін таңда немесе картадан орынды белгіле.',
        'Use your GPS point or mark the place on the map.',
      ));
      return;
    }
    setValidationError('');
    submitLockRef.current = true;
    void Promise.resolve()
      .then(() => onSubmit({ hazardType, description: description.trim(), location: selectedLocation }))
      .finally(() => { submitLockRef.current = false; });
  }

  function closeFromBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && !submitting) onClose();
  }

  if (!open) return null;

  return <div className="safety-report-backdrop" onMouseDown={closeFromBackdrop}>
    <section
      ref={sheetRef}
      className="safety-report-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-busy={submitting}
    >
      <div className="safety-sheet-handle" aria-hidden="true" />
      <header className="safety-report-heading">
        <span className="safety-report-heading-icon"><AlertTriangle size={22} aria-hidden="true" /></span>
        <div>
          <p>{text('Safety Radar', 'Safety Radar', 'Safety Radar')}</p>
          <h2 id={titleId}>{text('Отметить опасность', 'Қауіпті белгілеу', 'Report a hazard')}</h2>
          <span id={descriptionId}>{text(
            'Предупреди райдеров рядом. Отметка автоматически исчезнет, если её никто не подтвердит.',
            'Жақын райдерлерді ескерт. Ешкім растамаса, белгі автоматты түрде жоғалады.',
            'Warn nearby riders. The report expires automatically if nobody confirms it.',
          )}</span>
        </div>
        <button
          ref={closeButtonRef}
          type="button"
          className="safety-report-close"
          aria-label={text('Закрыть', 'Жабу', 'Close')}
          disabled={submitting}
          onClick={onClose}
        ><X size={20} aria-hidden="true" /></button>
      </header>

      <form className="safety-report-form" onSubmit={submit}>
        <fieldset className="safety-hazard-type-fieldset" disabled={submitting}>
          <legend>{text('Что случилось?', 'Не болды?', 'What happened?')}</legend>
          <div className="safety-hazard-type-grid" role="radiogroup">
            {options.map(({ type, label, hint, icon: Icon }) => <button
              type="button"
              role="radio"
              aria-checked={hazardType === type}
              className={hazardType === type ? 'is-selected' : ''}
              key={type}
              onClick={() => setHazardType(type)}
            >
              <span><Icon size={20} aria-hidden="true" /></span>
              <strong>{label}</strong>
              <small>{hint}</small>
              {hazardType === type && <Check className="safety-option-check" size={15} aria-hidden="true" />}
            </button>)}
          </div>
        </fieldset>

        <fieldset className="safety-location-fieldset" disabled={submitting}>
          <legend>{text('Где это?', 'Бұл қайда?', 'Where is it?')}</legend>
          <div className="safety-location-options" role="radiogroup">
            <button
              type="button"
              role="radio"
              aria-checked={locationSource === 'gps'}
              className={locationSource === 'gps' ? 'is-selected' : ''}
              disabled={!gpsLocation}
              onClick={() => { setLocationSource('gps'); setValidationError(''); }}
            >
              <LocateFixed size={19} aria-hidden="true" />
              <span><strong>{text('Моя GPS-точка', 'Менің GPS нүктем', 'My GPS position')}</strong><small>{gpsLocation
                ? `${gpsLocation.lat.toFixed(5)}, ${gpsLocation.lng.toFixed(5)}`
                : text('GPS пока недоступен', 'GPS әзірге қолжетімсіз', 'GPS is not available yet')}</small></span>
              {locationSource === 'gps' && gpsLocation && <Check size={17} aria-hidden="true" />}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={locationSource === 'map'}
              className={locationSource === 'map' ? 'is-selected' : ''}
              onClick={requestMapPick}
            >
              <Crosshair size={19} aria-hidden="true" />
              <span><strong>{text('Указать на карте', 'Картадан көрсету', 'Pick on map')}</strong><small>{mapLocation
                ? `${mapLocation.lat.toFixed(5)}, ${mapLocation.lng.toFixed(5)}`
                : mapPicking
                  ? text('Нажми на нужное место', 'Қажетті жерді бас', 'Tap the exact location')
                  : text('Для опасности не рядом с тобой', 'Өзіңнен алыстағы қауіп үшін', 'For a hazard away from you')}</small></span>
              {locationSource === 'map' && mapLocation
                ? <Check size={17} aria-hidden="true" />
                : <Navigation size={17} aria-hidden="true" />}
            </button>
          </div>
        </fieldset>

        <label className="safety-description-field">
          <span>{text('Описание', 'Сипаттама', 'Description')} <small>{text('необязательно', 'міндетті емес', 'optional')}</small></span>
          <textarea
            value={description}
            maxLength={280}
            rows={3}
            disabled={submitting}
            placeholder={text('Например: глубокая яма у правого края дороги', 'Мысалы: жолдың оң жағындағы терең шұңқыр', 'For example: deep pothole near the right edge')}
            onChange={(event) => setDescription(event.target.value)}
          />
          <small className={description.length >= 260 ? 'is-near-limit' : ''}>{description.length}/280</small>
        </label>

        {(validationError || error) && <p className="safety-report-error" role="alert">{validationError || error}</p>}

        <div className="safety-report-actions">
          <p><ShieldCopy />{text('Твоё имя не показывается на карте.', 'Картада атың көрсетілмейді.', 'Your name is not shown on the map.')}</p>
          <button type="submit" disabled={submitting || !selectedLocation}>
            {submitting
              ? text('Отправляем…', 'Жіберілуде…', 'Sending…')
              : <><AlertTriangle size={18} aria-hidden="true" />{text('Предупредить райдеров', 'Райдерлерді ескерту', 'Warn riders')}</>}
          </button>
        </div>
      </form>
    </section>
  </div>;
}

function ShieldCopy() {
  return <span className="safety-privacy-icon" aria-hidden="true"><Check size={12} /></span>;
}
