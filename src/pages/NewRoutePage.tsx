import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import { PageShell } from '../components/PageShell';
import { RoutePlannerMap } from '../components/RoutePlannerMap';
import { useSession } from '../lib/auth';
import type { Difficulty, RoutePoint } from '../lib/cyclingModels';
import { routeCyclingWaypoints } from '../lib/directions';
import { createPost } from '../lib/posts';
import { createRoute, routeDistanceKm } from '../lib/routes';

export function NewRoutePage() {
  const { session, loading } = useSession();
  const [, navigate] = useLocation();
  const [points, setPoints] = useState<RoutePoint[]>([]);
  const [waypoints, setWaypoints] = useState<RoutePoint[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [region, setRegion] = useState('');
  const [elevation, setElevation] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('moderate');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [routing, setRouting] = useState(false);
  const routeRequest = useRef(0);

  useEffect(() => {
    if (!loading && !session) navigate('/auth/sign-in');
  }, [loading, navigate, session]);

  async function updateWaypoints(nextWaypoints: RoutePoint[]) {
    setWaypoints(nextWaypoints);
    setMessage('');
    const requestId = ++routeRequest.current;
    if (nextWaypoints.length < 2) {
      setPoints(nextWaypoints);
      setRouting(false);
      return;
    }
    setRouting(true);
    try {
      const routedPoints = await routeCyclingWaypoints(nextWaypoints);
      if (requestId === routeRequest.current) setPoints(routedPoints);
    } catch (error) {
      if (requestId === routeRequest.current) {
        setPoints([]);
        setMessage(error instanceof Error ? error.message : 'Не удалось проложить маршрут по дорогам.');
      }
    } finally {
      if (requestId === routeRequest.current) setRouting(false);
    }
  }

  function undoPoint() {
    void updateWaypoints(waypoints.slice(0, -1));
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
      navigate('/feed');
    } catch {
      setMessage(createdRouteId ? 'Маршрут сохранён, но пока не попал в ленту. Открой его в разделе маршрутов и попробуй опубликовать позже.' : 'Не удалось сохранить маршрут. Попробуй ещё раз.');
    } finally {
      setBusy(false);
    }
  }

  return <PageShell><main className="cycle-page new-route-page"><header className="page-heading"><div><p className="kicker">Новый трек</p><h1>Нарисуй дорогу.</h1><p>Дай маршруту название и описание — после публикации он появится в ленте и его смогут открыть другие райдеры.</p></div></header><div className="route-builder"><section><RoutePlannerMap points={points} waypoints={waypoints} routing={routing} onAdd={(point) => void updateWaypoints([...waypoints, point])} /><div className="map-toolbar"><span>{routing ? 'Строим путь по дорогам…' : `${waypoints.length} точек · ${routeDistanceKm(points).toFixed(1)} км`}</span><button className="quiet-button" onClick={undoPoint} disabled={!waypoints.length || routing}>Убрать последнюю</button></div></section><section className="form-card"><p className="kicker">Детали</p><h2>Расскажи про маршрут</h2><form className="cycle-form" onSubmit={(event) => void submit(event)}><label>Название<input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Петля до Медеу" maxLength={120} /></label><label>Регион<input value={region} onChange={(event) => setRegion(event.target.value)} placeholder="Алматы" maxLength={80} /></label><label>Сложность<select value={difficulty} onChange={(event) => setDifficulty(event.target.value as Difficulty)}><option value="easy">Лёгкий</option><option value="moderate">Средний</option><option value="hard">Сложный</option></select></label><label>Набор высоты, м<input type="number" min="0" value={elevation} onChange={(event) => setElevation(event.target.value)} /></label><label>Описание<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Покрытие, вода, на что обратить внимание" maxLength={1000} /></label><button className="signal-button" disabled={busy || routing}>{busy ? 'Сохраняем и публикуем…' : 'Опубликовать маршрут в ленте'}</button></form>{message && <p className="form-note" role="alert">{message}</p>}</section></div></main></PageShell>;
}
