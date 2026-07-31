import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';
import {
  Bike,
  CalendarDays,
  Check,
  ExternalLink,
  Flag,
  Flame,
  MapPin,
  Trophy,
  Users,
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { BikeLoader } from '../components/BikeLoader';
import { PageShell } from '../components/PageShell';
import { useSession } from '../lib/auth';
import {
  loadCompetitionsOverview,
  setChallengeGroupMembership,
  setEventInterest,
  type ChallengeGroupSummary,
  type CompetitionEvent,
  type CompetitionsOverview,
} from '../lib/competitions';
import { useLocaleText } from '../lib/localized';
import '../styles/competitions.css';

type CompetitionTab = 'challenge' | 'events';
type Feedback = { tone: 'success' | 'error'; message: string } | null;

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function formatWeek(locale: string, start: string, end: string): string {
  const formatter = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
  return `${formatter.format(parseLocalDate(start))} — ${formatter.format(parseLocalDate(end))}`;
}

function formatDistance(locale: string, distanceKm: number): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(distanceKm);
}

function eventDateParts(locale: string, value: string): { day: string; month: string; weekday: string } {
  const date = parseLocalDate(value);
  return {
    day: new Intl.DateTimeFormat(locale, { day: '2-digit' }).format(date),
    month: new Intl.DateTimeFormat(locale, { month: 'short' }).format(date),
    weekday: new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date),
  };
}

function withGroupMembership(
  overview: CompetitionsOverview,
  groupId: string,
  isMember: boolean,
): CompetitionsOverview {
  return {
    ...overview,
    challengeGroups: overview.challengeGroups.map((group) => {
      if (group.id !== groupId || group.isMember === isMember) return group;
      return {
        ...group,
        isMember,
        memberCount: Math.max(0, group.memberCount + (isMember ? 1 : -1)),
      };
    }),
  };
}

function withEventInterest(
  overview: CompetitionsOverview,
  eventId: string,
  isInterested: boolean,
): CompetitionsOverview {
  return {
    ...overview,
    events: overview.events.map((event) => event.id === eventId ? { ...event, isInterested } : event),
  };
}

export function CompetitionsPage() {
  const text = useLocaleText();
  const { session, loading: sessionLoading } = useSession();
  const [, navigate] = useLocation();
  const userId = session?.user.id ?? '';
  const locale = text('ru-RU', 'kk-KZ', 'en-US');
  const [tab, setTab] = useState<CompetitionTab>('challenge');
  const [overview, setOverview] = useState<CompetitionsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [pendingGroupIds, setPendingGroupIds] = useState<Set<string>>(() => new Set());
  const [pendingEventIds, setPendingEventIds] = useState<Set<string>>(() => new Set());

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setLoadError('');
    setFeedback(null);
    setOverview(null);
    try {
      setOverview(await loadCompetitionsOverview(userId));
    } catch {
      setLoadError(text(
        'Не удалось загрузить прогресс и соревнования.',
        'Прогресс пен жарыстарды жүктеу мүмкін болмады.',
        'Could not load progress and competitions.',
      ));
    } finally {
      setLoading(false);
    }
  }, [text, userId]);

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      navigate('/auth/sign-in');
      return;
    }
    void refresh();
  }, [navigate, refresh, session, sessionLoading]);

  async function toggleGroup(group: ChallengeGroupSummary): Promise<void> {
    if (!userId || pendingGroupIds.has(group.id)) return;
    const nextMembership = !group.isMember;
    setFeedback(null);
    setPendingGroupIds((current) => new Set(current).add(group.id));
    setOverview((current) => current ? withGroupMembership(current, group.id, nextMembership) : current);

    try {
      await setChallengeGroupMembership(group.id, userId, nextMembership);
      setFeedback({
        tone: 'success',
        message: nextMembership
          ? text('Ты присоединился к челленджу.', 'Сен челленджге қосылдың.', 'You joined the challenge.')
          : text('Ты вышел из челленджа.', 'Сен челленджден шықтың.', 'You left the challenge.'),
      });
    } catch {
      setOverview((current) => current ? withGroupMembership(current, group.id, group.isMember) : current);
      setFeedback({
        tone: 'error',
        message: text(
          'Не удалось изменить участие. Попробуй ещё раз.',
          'Қатысуды өзгерту мүмкін болмады. Қайталап көр.',
          'Could not update membership. Try again.',
        ),
      });
    } finally {
      setPendingGroupIds((current) => {
        const next = new Set(current);
        next.delete(group.id);
        return next;
      });
    }
  }

  async function toggleEvent(event: CompetitionEvent): Promise<void> {
    if (!userId || pendingEventIds.has(event.id)) return;
    const nextInterest = !event.isInterested;
    setFeedback(null);
    setPendingEventIds((current) => new Set(current).add(event.id));
    setOverview((current) => current ? withEventInterest(current, event.id, nextInterest) : current);

    try {
      await setEventInterest(event.id, userId, nextInterest);
      setFeedback({
        tone: 'success',
        message: nextInterest
          ? text('Событие добавлено в твой список.', 'Оқиға сенің тізіміңе қосылды.', 'Event added to your list.')
          : text('Событие удалено из твоего списка.', 'Оқиға сенің тізіміңнен алынды.', 'Event removed from your list.'),
      });
    } catch {
      setOverview((current) => current ? withEventInterest(current, event.id, event.isInterested) : current);
      setFeedback({
        tone: 'error',
        message: text(
          'Не удалось сохранить интерес. Попробуй ещё раз.',
          'Қызығушылықты сақтау мүмкін болмады. Қайталап көр.',
          'Could not save your interest. Try again.',
        ),
      });
    } finally {
      setPendingEventIds((current) => {
        const next = new Set(current);
        next.delete(event.id);
        return next;
      });
    }
  }

  const weekly = overview?.weekly;
  const progressPercent = weekly ? Math.min(100, Math.max(0, (weekly.distanceKm / weekly.goalKm) * 100)) : 0;
  const remainingKm = weekly ? Math.max(0, weekly.goalKm - weekly.distanceKm) : 0;

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextTab: CompetitionTab = event.key === 'Home'
      ? 'challenge'
      : event.key === 'End'
        ? 'events'
        : tab === 'challenge' ? 'events' : 'challenge';
    setTab(nextTab);
    document.getElementById(nextTab === 'challenge' ? 'weekly-tab' : 'events-tab')?.focus();
  }

  function eventTypeLabel(eventType: CompetitionEvent['eventType']): string {
    if (eventType === 'race') return text('Гонка', 'Жарыс', 'Race');
    if (eventType === 'gran_fondo') return text('Гран-фондо', 'Гран-фондо', 'Gran fondo');
    return text('Клубный заезд', 'Клубтық сапар', 'Club ride');
  }

  return (
    <PageShell>
      <main className="cycle-page competitions-page">
        <header className="competitions-hero">
          <div>
            <p className="kicker">{text('Ритм сообщества', 'Қауымдастық ырғағы', 'Community rhythm')}</p>
            <h1>{text('Твоя неделя в движении.', 'Қозғалыстағы аптаң.', 'Your week in motion.')}</h1>
            <p>{text(
              'Реальные километры из сохранённых заездов, открытые челленджи и ближайшие старты — в одном месте.',
              'Сақталған сапарлардағы нақты километрлер, ашық челлендждер және жақын старттар — бір жерде.',
              'Real kilometres from saved rides, open challenges, and upcoming starts — all in one place.',
            )}</p>
          </div>
          <div className="competitions-hero-mark" aria-hidden="true">
            <Trophy size={42} strokeWidth={1.7} />
            <span>50</span>
            <small>KM</small>
          </div>
        </header>

        <nav className="competition-tabs" role="tablist" aria-label={text('Разделы соревнований', 'Жарыс бөлімдері', 'Competition sections')}>
          <button
            id="weekly-tab"
            type="button"
            role="tab"
            aria-selected={tab === 'challenge'}
            aria-controls="weekly-panel"
            tabIndex={tab === 'challenge' ? 0 : -1}
            className={tab === 'challenge' ? 'active' : ''}
            onClick={() => setTab('challenge')}
            onKeyDown={handleTabKeyDown}
          >
            <Trophy size={17} aria-hidden="true" />
            {text('Моя неделя', 'Менің аптама', 'My week')}
          </button>
          <button
            id="events-tab"
            type="button"
            role="tab"
            aria-selected={tab === 'events'}
            aria-controls="events-panel"
            tabIndex={tab === 'events' ? 0 : -1}
            className={tab === 'events' ? 'active' : ''}
            onClick={() => setTab('events')}
            onKeyDown={handleTabKeyDown}
          >
            <CalendarDays size={17} aria-hidden="true" />
            {text('События', 'Оқиғалар', 'Events')}
          </button>
        </nav>

        {feedback && (
          <p className={`competition-feedback ${feedback.tone}`} role={feedback.tone === 'error' ? 'alert' : 'status'} aria-live="polite">
            {feedback.message}
          </p>
        )}

        {loadError && (
          <div className="competition-load-error" role="alert">
            <span>{loadError}</span>
            <button type="button" onClick={() => void refresh()}>{text('Повторить', 'Қайталау', 'Retry')}</button>
          </div>
        )}

        {(sessionLoading || loading) && <BikeLoader label={text('Считаем километры недели…', 'Апта километрлерін есептеп жатырмыз…', 'Counting this week’s kilometres…')} />}

        {session && !sessionLoading && !loading && overview && weekly && (
          <div id="weekly-panel" role="tabpanel" aria-labelledby="weekly-tab" className="competition-panel" hidden={tab !== 'challenge'}>
            <section className="weekly-progress-card" aria-labelledby="weekly-progress-title">
              <div className="weekly-progress-copy">
                <div className="weekly-progress-heading">
                  <div>
                    <p className="kicker">{text('Цель недели', 'Апталық мақсат', 'Weekly goal')}</p>
                    <h2 id="weekly-progress-title">{text('50 км до воскресенья', 'Жексенбіге дейін 50 км', '50 km by Sunday')}</h2>
                  </div>
                  <span className="week-range"><CalendarDays size={15} aria-hidden="true" />{formatWeek(locale, weekly.weekStart, weekly.weekEnd)}</span>
                </div>

                <div className="weekly-distance-line">
                  <strong>{formatDistance(locale, weekly.distanceKm)}</strong>
                  <span>/ {weekly.goalKm} {text('км', 'км', 'km')}</span>
                </div>

                <div
                  className="weekly-progress-bar"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={weekly.goalKm}
                  aria-valuenow={Math.min(weekly.goalKm, Number(weekly.distanceKm.toFixed(1)))}
                  aria-valuetext={text(
                    `${formatDistance(locale, weekly.distanceKm)} из ${weekly.goalKm} километров`,
                    `${weekly.goalKm} километрдің ${formatDistance(locale, weekly.distanceKm)} километрі`,
                    `${formatDistance(locale, weekly.distanceKm)} of ${weekly.goalKm} kilometres`,
                  )}
                >
                  <span style={{ width: `${progressPercent}%` }} />
                  <i style={{ left: `${progressPercent}%` }}><Flag size={14} aria-hidden="true" /></i>
                </div>

                <div className="weekly-progress-summary">
                  <span>{weekly.distanceKm >= weekly.goalKm
                    ? text('Цель выполнена — отличный темп!', 'Мақсат орындалды — керемет қарқын!', 'Goal complete — great pace!')
                    : text(
                        `Осталось ${formatDistance(locale, remainingKm)} км`,
                        `${formatDistance(locale, remainingKm)} км қалды`,
                        `${formatDistance(locale, remainingKm)} km to go`,
                      )}</span>
                  <strong>{Math.round(progressPercent)}%</strong>
                </div>
              </div>

              <dl className="weekly-stat-grid">
                <div>
                  <dt><Bike size={17} aria-hidden="true" />{text('Заездов', 'Сапарлар', 'Rides')}</dt>
                  <dd>{weekly.rideCount}</dd>
                </div>
                <div>
                  <dt><CalendarDays size={17} aria-hidden="true" />{text('Активных дней', 'Белсенді күндер', 'Active days')}</dt>
                  <dd>{weekly.activeDays}</dd>
                </div>
                <div>
                  <dt><Flame size={17} aria-hidden="true" />{text('Серия сейчас', 'Қазіргі серия', 'Current streak')}</dt>
                  <dd>{weekly.streakDays} <small>{text('дн.', 'күн', 'days')}</small></dd>
                </div>
              </dl>

              <footer className="weekly-progress-footer">
                <p>{text(
                  'В зачёт попадают только сохранённые поездки с понедельника по воскресенье.',
                  'Есепке дүйсенбіден жексенбіге дейін сақталған сапарлар ғана кіреді.',
                  'Only rides saved from Monday through Sunday count toward the goal.',
                )}</p>
                <Link className="signal-button" href="/record"><Bike size={17} aria-hidden="true" />{text('Записать заезд', 'Сапарды жазу', 'Record a ride')}</Link>
              </footer>
            </section>

            <section className="competition-section" aria-labelledby="challenge-groups-title">
              <header className="competition-section-heading">
                <div>
                  <p className="kicker">{text('Вместе легче', 'Бірге оңай', 'Better together')}</p>
                  <h2 id="challenge-groups-title">{text('Открытые челленджи', 'Ашық челлендждер', 'Open challenges')}</h2>
                </div>
                <span>{overview.challengeGroups.length}</span>
              </header>

              {overview.challengeGroups.length ? (
                <div className="challenge-group-grid" aria-live="polite">
                  {overview.challengeGroups.map((group) => {
                    const pending = pendingGroupIds.has(group.id);
                    return (
                      <article className={group.isMember ? 'challenge-group-card joined' : 'challenge-group-card'} key={group.id}>
                        <span className="challenge-group-icon"><Trophy size={21} aria-hidden="true" /></span>
                        <div className="challenge-group-copy">
                          <span className="open-badge">{text('Открытый', 'Ашық', 'Open')}</span>
                          <h3>{group.name}</h3>
                          <p><Users size={15} aria-hidden="true" />{text('Участников', 'Қатысушылар', 'Members')}: {group.memberCount}</p>
                        </div>
                        <button
                          type="button"
                          className={group.isMember ? 'competition-action joined' : 'competition-action'}
                          aria-pressed={group.isMember}
                          aria-busy={pending}
                          disabled={pending}
                          onClick={() => void toggleGroup(group)}
                        >
                          {group.isMember && <Check size={16} aria-hidden="true" />}
                          {pending
                            ? text('Сохраняем…', 'Сақталуда…', 'Saving…')
                            : group.isMember
                              ? text('Участвую', 'Қатысамын', 'Joined')
                              : text('Вступить', 'Қосылу', 'Join')}
                        </button>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <section className="competition-empty">
                  <Trophy size={28} aria-hidden="true" />
                  <div>
                    <h3>{text('Открытых челленджей пока нет', 'Әзірге ашық челлендждер жоқ', 'No open challenges yet')}</h3>
                    <p>{text(
                      'Твой недельный прогресс всё равно считается — новые сообщества появятся здесь автоматически.',
                      'Апталық прогресің бәрібір есептеледі — жаңа қауымдастықтар осында автоматты түрде пайда болады.',
                      'Your weekly progress still counts. New communities will appear here automatically.',
                    )}</p>
                  </div>
                </section>
              )}
            </section>
          </div>
        )}

        {session && !sessionLoading && !loading && overview && (
          <section id="events-panel" role="tabpanel" aria-labelledby="events-tab" className="competition-panel competition-section" hidden={tab !== 'events'}>
            <header className="competition-section-heading events-heading">
              <div>
                <p className="kicker">{text('Календарь сообщества', 'Қауымдастық күнтізбесі', 'Community calendar')}</p>
                <h2>{text('Ближайшие старты', 'Жақын старттар', 'Upcoming events')}</h2>
                <p>{text(
                  'Отметь интересные события, чтобы быстро найти их при следующем визите.',
                  'Қызықты оқиғаларды белгіле — келесі кіргенде оларды тез табасың.',
                  'Mark events you like so they are easy to find next time.',
                )}</p>
              </div>
              <span>{overview.events.length}</span>
            </header>

            {overview.events.length ? (
              <div className="competition-event-list" aria-live="polite">
                {overview.events.map((event) => {
                  const date = eventDateParts(locale, event.eventDate);
                  const pending = pendingEventIds.has(event.id);
                  return (
                    <article className={event.isInterested ? 'competition-event-card interested' : 'competition-event-card'} key={event.id}>
                      <time className="event-date-block" dateTime={event.eventDate}>
                        <span>{date.weekday}</span>
                        <strong>{date.day}</strong>
                        <small>{date.month}</small>
                      </time>
                      <div className="event-card-copy">
                        <span className="event-type-badge">{eventTypeLabel(event.eventType)}</span>
                        <h3>{event.title}</h3>
                        {event.location && <p className="event-location"><MapPin size={15} aria-hidden="true" />{event.location}</p>}
                        <p className="event-description">{event.description || eventTypeLabel(event.eventType)}</p>
                      </div>
                      <div className="event-card-actions">
                        <button
                          type="button"
                          className={event.isInterested ? 'competition-action joined' : 'competition-action'}
                          aria-pressed={event.isInterested}
                          aria-busy={pending}
                          disabled={pending}
                          onClick={() => void toggleEvent(event)}
                        >
                          {event.isInterested && <Check size={16} aria-hidden="true" />}
                          {pending
                            ? text('Сохраняем…', 'Сақталуда…', 'Saving…')
                            : event.isInterested
                              ? text('В моём списке', 'Менің тізімімде', 'Saved')
                              : text('Мне интересно', 'Маған қызық', 'Interested')}
                        </button>
                        {event.registrationUrl && (
                          <a
                            className="event-registration-link"
                            href={event.registrationUrl}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={text(
                              `Открыть сайт события «${event.title}»`,
                              `«${event.title}» оқиғасының сайтын ашу`,
                              `Open the website for ${event.title}`,
                            )}
                          >
                            {text('Сайт события', 'Оқиға сайты', 'Event site')}<ExternalLink size={15} aria-hidden="true" />
                          </a>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <section className="competition-empty">
                <CalendarDays size={28} aria-hidden="true" />
                <div>
                  <h3>{text('В календаре пока тихо', 'Күнтізбе әзірге бос', 'The calendar is quiet')}</h3>
                  <p>{text(
                    'Гонки, гран-фондо и клубные заезды появятся здесь, как только организаторы добавят их.',
                    'Жарыстар, гран-фондо және клубтық сапарлар ұйымдастырушылар қосқан бойда осында пайда болады.',
                    'Races, gran fondos, and club rides will appear as soon as organizers add them.',
                  )}</p>
                </div>
              </section>
            )}
          </section>
        )}
      </main>
    </PageShell>
  );
}
