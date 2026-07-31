import { divIcon } from 'leaflet';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock3,
  MapPin,
  ShieldCheck,
  ThumbsUp,
  X,
} from 'lucide-react';
import { Marker, Popup } from 'react-leaflet';
import type { HazardReport, HazardType } from '../lib/hazards';
import { useLocaleText } from '../lib/localized';
import { usePreferences } from '../lib/preferences';
import '../styles/safety.css';

type HazardAction = (hazard: HazardReport) => void | Promise<void>;

export type HazardLayerProps = {
  hazards: readonly HazardReport[];
  busyHazardId?: string | null;
  interactive?: boolean;
  canResolve?: (hazard: HazardReport) => boolean;
  onConfirm: HazardAction;
  onUnconfirm: HazardAction;
  onResolve?: HazardAction;
  onSelect?: (hazard: HazardReport | null) => void;
};

type HazardCopy = {
  label: string;
  shortLabel: string;
};

function hazardCopy(type: HazardType, text: ReturnType<typeof useLocaleText>): HazardCopy {
  const copies: Record<HazardType, HazardCopy> = {
    pothole: {
      label: text('Яма или разбитый асфальт', 'Шұңқыр немесе бұзылған асфальт', 'Pothole or broken asphalt'),
      shortLabel: text('Яма', 'Шұңқыр', 'Pothole'),
    },
    no_lighting: {
      label: text('Нет освещения', 'Жарық жоқ', 'No lighting'),
      shortLabel: text('Нет света', 'Жарық жоқ', 'No lights'),
    },
    glass: {
      label: text('Стекло или острый мусор', 'Шыны немесе өткір қоқыс', 'Glass or sharp debris'),
      shortLabel: text('Стекло', 'Шыны', 'Glass'),
    },
    aggressive_dogs: {
      label: text('Агрессивные собаки', 'Агрессивті иттер', 'Aggressive dogs'),
      shortLabel: text('Собаки', 'Иттер', 'Dogs'),
    },
    road_closed: {
      label: text('Дорога перекрыта', 'Жол жабық', 'Road closed'),
      shortLabel: text('Перекрыто', 'Жол жабық', 'Closed'),
    },
  };
  return copies[type];
}

function relativeDate(value: string, locale: string, text: ReturnType<typeof useLocaleText>): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return text('Недавно', 'Жақында', 'Recently');
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return text('Только что', 'Жаңа ғана', 'Just now');
  if (minutes < 60) return text(`${minutes} мин назад`, `${minutes} мин бұрын`, `${minutes} min ago`);
  const hours = Math.round(minutes / 60);
  if (hours < 24) return text(`${hours} ч назад`, `${hours} сағ бұрын`, `${hours} hr ago`);
  const dateLocale = locale === 'kz' ? 'kk-KZ' : locale === 'ru' ? 'ru-RU' : 'en-US';
  return new Intl.DateTimeFormat(dateLocale, { day: 'numeric', month: 'short' }).format(new Date(timestamp));
}

function useCompactHazardLayout(): boolean {
  const query = '(max-width: 760px)';
  const [compact, setCompact] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return compact;
}

function markerIcon(hazard: HazardReport) {
  return divIcon({
    className: `safety-hazard-marker safety-hazard-${hazard.hazardType}${hazard.status === 'resolved' ? ' is-resolved' : ''}`,
    html: `<span class="safety-hazard-marker-core" aria-hidden="true"><b>!</b></span><span class="safety-hazard-marker-pulse" aria-hidden="true"></span>`,
    iconSize: [44, 52],
    iconAnchor: [22, 48],
    popupAnchor: [0, -44],
    tooltipAnchor: [0, -36],
  });
}

function ActionButtons({
  hazard,
  busy,
  canResolve,
  onConfirm,
  onUnconfirm,
  onResolve,
  compact = false,
}: {
  hazard: HazardReport;
  busy: boolean;
  canResolve: boolean;
  onConfirm: HazardAction;
  onUnconfirm: HazardAction;
  onResolve?: HazardAction;
  compact?: boolean;
}) {
  const text = useLocaleText();
  const active = hazard.status === 'active';

  return <div className={`safety-hazard-actions${compact ? ' is-compact' : ''}`}>
    {active && !canResolve && <button
      type="button"
      className={hazard.confirmedByMe ? 'safety-confirm-button is-confirmed' : 'safety-confirm-button'}
      aria-pressed={hazard.confirmedByMe}
      disabled={busy}
      onClick={() => void (hazard.confirmedByMe ? onUnconfirm(hazard) : onConfirm(hazard))}
    >
      {hazard.confirmedByMe ? <Check size={17} aria-hidden="true" /> : <ThumbsUp size={17} aria-hidden="true" />}
      <span>{hazard.confirmedByMe
        ? text('Подтверждено', 'Расталды', 'Confirmed')
        : text('Подтвердить', 'Растау', 'Confirm')}</span>
      <b>{hazard.confirmations}</b>
    </button>}
    {active && canResolve && onResolve && <button
      type="button"
      className="safety-resolve-button"
      disabled={busy}
      onClick={() => void onResolve(hazard)}
    >
      <CheckCircle2 size={17} aria-hidden="true" />
      {text('Уже безопасно', 'Қазір қауіпсіз', 'Safe now')}
    </button>}
    {!active && <span className="safety-resolved-note"><ShieldCheck size={17} aria-hidden="true" />{text('Проблема устранена', 'Мәселе шешілді', 'Resolved')}</span>}
  </div>;
}

function HazardDetails({
  hazard,
  children,
}: {
  hazard: HazardReport;
  children: ReactNode;
}) {
  const text = useLocaleText();
  const { locale } = usePreferences();
  const copy = hazardCopy(hazard.hazardType, text);
  const lastSeen = hazard.lastConfirmedAt || hazard.createdAt;

  return <div className="safety-hazard-details">
    <div className="safety-hazard-details-heading">
      <span className={`safety-hazard-symbol safety-hazard-${hazard.hazardType}`}><AlertTriangle size={20} aria-hidden="true" /></span>
      <div>
        <span className={`safety-hazard-status${hazard.status === 'active' ? ' is-active' : ''}`}>
          {hazard.status === 'active' ? text('Актуально', 'Өзекті', 'Active') : text('Закрыто', 'Жабық', 'Resolved')}
        </span>
        <strong>{copy.label}</strong>
      </div>
    </div>
    {hazard.description && <p>{hazard.description}</p>}
    <div className="safety-hazard-meta">
      <span><Clock3 size={14} aria-hidden="true" />{text('Проверено', 'Тексерілді', 'Seen')} {relativeDate(lastSeen, locale, text)}</span>
      <span><MapPin size={14} aria-hidden="true" />{hazard.location.lat.toFixed(5)}, {hazard.location.lng.toFixed(5)}</span>
    </div>
    {children}
  </div>;
}

export function HazardLayer({
  hazards,
  busyHazardId = null,
  interactive = true,
  canResolve = () => false,
  onConfirm,
  onUnconfirm,
  onResolve,
  onSelect,
}: HazardLayerProps) {
  const text = useLocaleText();
  const compactLayout = useCompactHazardLayout();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sheetCloseRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const selectedHazard = useMemo(
    () => hazards.find((hazard) => hazard.id === selectedId) ?? null,
    [hazards, selectedId],
  );

  function selectHazard(hazard: HazardReport | null) {
    if (hazard && compactLayout) {
      previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    setSelectedId(hazard?.id ?? null);
    onSelect?.(hazard);
  }

  function closeSelection() {
    setSelectedId(null);
    onSelect?.(null);
    const previousFocus = previousFocusRef.current;
    previousFocusRef.current = null;
    if (previousFocus?.isConnected) window.requestAnimationFrame(() => previousFocus.focus());
  }

  useEffect(() => {
    if (!interactive && selectedId !== null) {
      setSelectedId(null);
      onSelect?.(null);
    }
  }, [interactive, onSelect, selectedId]);

  useEffect(() => {
    if (!compactLayout || !selectedHazard) return;
    window.requestAnimationFrame(() => sheetCloseRef.current?.focus());
  }, [compactLayout, selectedHazard]);

  return <>
    {hazards.map((hazard) => {
      const copy = hazardCopy(hazard.hazardType, text);
      return <Marker
        key={hazard.id}
        position={[hazard.location.lat, hazard.location.lng]}
        icon={markerIcon(hazard)}
        interactive={interactive}
        keyboard={interactive}
        title={`${copy.label}. ${hazard.confirmations} ${text('подтверждений', 'растау', 'confirmations')}`}
        riseOnHover
        zIndexOffset={hazard.status === 'active' ? 750 : 200}
        eventHandlers={interactive ? { click: () => selectHazard(hazard) } : undefined}
      >
        {!compactLayout && interactive && <Popup className="safety-hazard-leaflet-popup" closeButton eventHandlers={{ remove: () => selectHazard(null) }}>
          <HazardDetails hazard={hazard}>
            <ActionButtons
              hazard={hazard}
              busy={busyHazardId === hazard.id}
              canResolve={canResolve(hazard)}
              onConfirm={onConfirm}
              onUnconfirm={onUnconfirm}
              onResolve={onResolve}
              compact
            />
          </HazardDetails>
        </Popup>}
      </Marker>;
    })}

    {selectedHazard && <aside className="safety-hazard-bottom-sheet" role="dialog" aria-label={hazardCopy(selectedHazard.hazardType, text).label}>
      <button
        ref={sheetCloseRef}
        type="button"
        className="safety-hazard-sheet-close"
        aria-label={text('Закрыть сведения', 'Мәліметтерді жабу', 'Close details')}
        onClick={closeSelection}
      ><X size={18} aria-hidden="true" /></button>
      <HazardDetails hazard={selectedHazard}>
        <ActionButtons
          hazard={selectedHazard}
          busy={busyHazardId === selectedHazard.id}
          canResolve={canResolve(selectedHazard)}
          onConfirm={onConfirm}
          onUnconfirm={onUnconfirm}
          onResolve={onResolve}
        />
      </HazardDetails>
    </aside>}
  </>;
}
