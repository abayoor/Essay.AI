import { useEffect, useRef, useState, type FormEvent } from 'react';
import { FileText } from 'lucide-react';
import { useLocation } from 'wouter';
import { CityAutocomplete } from '../components/CityAutocomplete';
import { PageShell } from '../components/PageShell';
import { RoutePlannerMap } from '../components/RoutePlannerMap';
import { useSession } from '../lib/auth';
import { requestAiAssist } from '../lib/aiAssistant';
import type { Difficulty, RoutePoint } from '../lib/cyclingModels';
import { routeCyclingWaypoints } from '../lib/directions';
import { createPost } from '../lib/posts';
import { takeMapRouteDraft } from '../lib/routeDraft';
import { createRoute, routeDistanceKm } from '../lib/routes';
import { usePreferences } from '../lib/preferences';

export function NewRoutePage() {
  const { session, loading } = useSession();
  const { locale } = usePreferences();
  const [, navigate] = useLocation();
  const [points, setPoints] = useState<RoutePoint[]>([]);
  const [waypoints, setWaypoints] = useState<RoutePoint[]>([]);
  const [snappedWaypoints, setSnappedWaypoints] = useState<RoutePoint[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [region, setRegion] = useState('');
  const [elevation, setElevation] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('moderate');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [routing, setRouting] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(0);
  const routeRequest = useRef(0);

  useEffect(() => {
    if (!loading && !session) navigate('/auth/sign-in');
  }, [loading, navigate, session]);

  useEffect(() => {
    const draft = takeMapRouteDraft();
    if (!draft) return;
    setTitle(draft.title);
    setRegion(draft.region);
    setWaypoints(draft.waypoints);
    setSnappedWaypoints(draft.snappedWaypoints);
    setPoints(draft.points);
    setElevation(String(Math.round(draft.elevationGainM)));
  }, []);

  async function updateWaypoints(nextWaypoints: RoutePoint[]) {
    setWaypoints(nextWaypoints);
    setMessage('');
    const requestId = ++routeRequest.current;
    if (nextWaypoints.length < 2) {
      setPoints(nextWaypoints);
      setSnappedWaypoints(nextWaypoints);
      setRouting(false);
      return;
    }
    setRouting(true);
    try {
      const result = await routeCyclingWaypoints(nextWaypoints);
      if (requestId === routeRequest.current) {
        setPoints(result.points);
        setSnappedWaypoints(result.snappedWaypoints);
        setElevation(String(Math.round(result.elevationGainM)));
        setDurationMinutes(Math.round(result.durationMinutes));
      }
    } catch (error) {
      if (requestId === routeRequest.current) {
        setPoints([]);
        setSnappedWaypoints([]);
        setMessage(error instanceof Error ? error.message : 'Не удалось проложить маршрут по дорогам.');
      }
    } finally {
      if (requestId === routeRequest.current) setRouting(false);
    }
  }

  function undoPoint() {
    void updateWaypoints(waypoints.slice(0, -1));
  }

  async function generateRouteCopy() {
    if (points.length < 2) {
      setMessage('Сначала построй маршрут минимум по двум точкам.');
      return;
    }
    setAiBusy(true);
    setMessage('');
    try {
      const result = await requestAiAssist('route_copy', locale, {
        city: region.trim() || null,
        distanceKm: Number(routeDistanceKm(points).toFixed(1)),
        elevationGainM: Number(elevation) || 0,
        estimatedDurationMinutes: durationMinutes || null,
        difficulty,
        existingTitle: title.trim() || null,
        existingDescription: description.trim() || null,
      });
      setTitle(result.title);
      setDescription(result.text);
      setMessage(locale === 'en' ? 'AI prepared the route copy. Check it before publishing.' : locale === 'kz' ? 'AI бағыт мәтінін дайындады. Жарияламас бұрын тексер.' : 'ИИ подготовил текст маршрута. Проверь его перед публикацией.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ИИ-помощник временно недоступен.');
    } finally {
      setAiBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (points.length < 2) {
      setMessage('Поставь на карте минимум две точки маршрута.');
      return;
    }
    setBusy(true);
    setMessage('');
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    const elevationGain = Number(elevation) || 0;
    let createdRouteId: string | null = null;
    try {
      const id = await createRoute({ title: cleanTitle, description: cleanDescription, points, elevationGain, difficulty, region });
      createdRouteId = id;
      await createPost({
        mediaUrl: '',
        mediaType: 'image',
        caption: cleanDescription ? `Новый маршрут: ${cleanTitle}\n${cleanDescription}` : `Новый маршрут: ${cleanTitle}`,
        routePreview: { routeId: id, title: cleanTitle, description: cleanDescription || null, path: points, distanceKm: routeDistanceKm(points), elevationGainM: elevationGain, difficulty },
      });
      navigate(`/routes/${id}`);
    } catch {
      setMessage(createdRouteId ? 'Маршрут сохранён, но пока не попал в ленту. Открой его в разделе маршрутов и попробуй опубликовать позже.' : 'Не удалось сохранить маршрут. Попробуй ещё раз.');
    } finally {
      setBusy(false);
    }
  }

  return <PageShell><main className="cycle-page new-route-page"><header className="page-heading"><div><p className="kicker">Новый веломаршрут</p><h1>Нарисуй удобную дорогу.</h1><p>Поставь точки на карте — велосипедный профиль построит путь по подходящим дорогам и велоинфраструктуре, а расстояние и набор высоты посчитаются автоматически.</p></div></header><div className="route-builder"><section><RoutePlannerMap points={points} waypoints={waypoints} snappedWaypoints={snappedWaypoints} routing={routing} onAdd={(point) => void updateWaypoints([...waypoints, point])} /><div className="map-toolbar"><span>{routing ? 'Строим велосипедный путь…' : `${waypoints.length} точек · ${routeDistanceKm(points).toFixed(1)} км${durationMinutes ? ` · ≈ ${durationMinutes} мин` : ''}`}</span><button type="button" className="quiet-button" onClick={undoPoint} disabled={!waypoints.length || routing}>Убрать последнюю</button></div></section><section className="form-card"><p className="kicker">Детали</p><h2>Расскажи про маршрут</h2><form className="cycle-form" onSubmit={(event) => void submit(event)}><label>Название<input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Петля до Медеу" maxLength={120} /></label><label className="city-form-field">Город<CityAutocomplete value={region} onChange={setRegion} /></label><label>Сложность<select value={difficulty} onChange={(event) => setDifficulty(event.target.value as Difficulty)}><option value="easy">Лёгкий</option><option value="moderate">Средний</option><option value="hard">Сложный</option></select></label><label>Набор высоты, м<input type="number" min="0" value={elevation} onChange={(event) => setElevation(event.target.value)} /></label><label>Описание<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Покрытие, вода, красивые места и на что обратить внимание" maxLength={1000} /></label><button type="button" className="ai-assist-button" disabled={aiBusy || routing || points.length < 2} onClick={() => void generateRouteCopy()}><FileText size={17} />{aiBusy ? 'Анализируем маршрут…' : 'Создать название и описание'}</button><button className="signal-button" disabled={busy || routing}>{busy ? 'Сохраняем и публикуем…' : 'Опубликовать маршрут'}</button></form>{message && <p className="form-note" role="alert">{message}</p>}</section></div></main></PageShell>;
}
