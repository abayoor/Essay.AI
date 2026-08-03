import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Bike as BikeSymbol, CheckCircle2, TriangleAlert, Wrench } from 'lucide-react';
import { useLocation } from 'wouter';
import { BikeIcon } from '../components/BikeIcon';
import { ElevationLine } from '../components/ElevationLine';
import { PageShell } from '../components/PageShell';
import { useSession } from '../lib/auth';
import { addBike, loadBikes, logRide, markMaintenanceDone } from '../lib/bikes';
import type { Bike, BikeType } from '../lib/cyclingModels';
import { useLocaleText } from '../lib/localized';

function maintenanceClass(total: number, last: number, interval: number): string {
  const ratio = (total - last) / interval;
  return ratio >= 1 ? 'overdue' : ratio >= .9 ? 'soon' : 'ready';
}

export function BikesPage() {
  const { session, loading } = useSession();
  const t = useLocaleText();
  const [, navigate] = useLocation();
  const [bikes, setBikes] = useState<Bike[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [serviceBusyId, setServiceBusyId] = useState('');
  const [bikeForm, setBikeForm] = useState({ name: '', brand: '', bikeType: 'road' as BikeType, purchaseDate: '' });
  const [rideForm, setRideForm] = useState({ bikeId: '', distanceKm: '', elevationM: '', durationMinutes: '', rideDate: new Date().toISOString().slice(0, 10) });

  const refresh = useCallback(async () => { setBikes(await loadBikes()); }, []);

  useEffect(() => {
    if (!loading && !session) navigate('/auth/sign-in');
    if (session) void refresh().catch(() => setMessage(t('Не удалось загрузить гараж.', 'Гаражды жүктеу мүмкін болмады.', 'Could not load the garage.')));
  }, [loading, navigate, refresh, session, t]);

  useEffect(() => {
    if (!rideForm.bikeId && bikes[0]) setRideForm((form) => ({ ...form, bikeId: bikes[0].id }));
  }, [bikes, rideForm.bikeId]);

  async function createBike(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await addBike(bikeForm);
      setBikeForm({ name: '', brand: '', bikeType: 'road', purchaseDate: '' });
      await refresh();
      setMessage(t('Велосипед добавлен. Интервалы ТО уже настроены.', 'Велосипед қосылды. Қызмет аралықтары дайын.', 'Bike added. Service intervals are ready.'));
    } catch {
      setMessage(t('Не удалось добавить велосипед.', 'Велосипедті қосу мүмкін болмады.', 'Could not add the bike.'));
    } finally {
      setBusy(false);
    }
  }

  async function createRide(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rideForm.bikeId) return;
    setBusy(true);
    setMessage('');
    try {
      await logRide({ bikeId: rideForm.bikeId, distanceKm: Number(rideForm.distanceKm), elevationM: Number(rideForm.elevationM), durationMinutes: Number(rideForm.durationMinutes), rideDate: rideForm.rideDate });
      setRideForm((form) => ({ ...form, distanceKm: '', elevationM: '', durationMinutes: '' }));
      await refresh();
      setMessage(t('Заезд записан — одометр и ТО обновлены.', 'Сапар жазылды — одометр мен қызмет жаңарды.', 'Ride saved — odometer and service status updated.'));
    } catch {
      setMessage(t('Не удалось записать заезд. Проверь дистанцию и попробуй ещё раз.', 'Сапарды жазу мүмкін болмады. Қашықтықты тексеріп, қайтала.', 'Could not save the ride. Check the distance and try again.'));
    } finally {
      setBusy(false);
    }
  }

  async function completeService(maintenanceId: string, currentDistanceKm: number) {
    setServiceBusyId(maintenanceId);
    setMessage('');
    try {
      await markMaintenanceDone(maintenanceId, currentDistanceKm);
      await refresh();
      setMessage(t('Обслуживание отмечено — следующий интервал рассчитан заново.', 'Қызмет белгіленді — келесі аралық қайта есептелді.', 'Service marked complete—the next interval has been recalculated.'));
    } catch {
      setMessage(t('Не удалось отметить обслуживание.', 'Қызметті белгілеу мүмкін болмады.', 'Could not mark the service as complete.'));
    } finally {
      setServiceBusyId('');
    }
  }

  const componentLabels = {
    chain: t('Цепь', 'Шынжыр', 'Chain'),
    tires: t('Покрышки', 'Шиналар', 'Tyres'),
    brake_pads: t('Колодки', 'Тежегіш қалыптары', 'Brake pads'),
    cassette: t('Кассета', 'Кассета', 'Cassette'),
  };

  const serviceOverview = useMemo(() => {
    const items = bikes.flatMap((bike) => bike.maintenance_intervals.map((item) => {
      const travelled = Number(bike.total_distance_km) - Number(item.last_service_km);
      return { bikeName: bike.name, component: item.component, remainingKm: item.interval_km - travelled, ratio: travelled / item.interval_km };
    }));
    const overdue = items.filter((item) => item.ratio >= 1).length;
    const soon = items.filter((item) => item.ratio >= .9 && item.ratio < 1).length;
    const next = [...items].sort((first, second) => first.remainingKm - second.remainingKm)[0] ?? null;
    return { next, overdue, soon };
  }, [bikes]);

  return <PageShell><main className="cycle-page garage-page">
    <header className="page-heading"><div><p className="kicker">{t('Мой гараж', 'Менің гаражым', 'My garage')}</p><h1>{t('Техника без сюрпризов.', 'Велосипед әрқашан дайын.', 'No mechanical surprises.')}</h1><p>{t('Одометр обновляется после каждого заезда, а сервис виден заранее.', 'Одометр әр сапардан кейін жаңарады, қызмет мерзімі алдын ала көрінеді.', 'The odometer updates after every ride and service needs stay visible.')}</p></div></header>

    {bikes.length > 0 && <section className="garage-health-summary" aria-label={t('Сводка обслуживания', 'Қызмет көрсету шолуы', 'Service overview')}>
      <article className={serviceOverview.overdue ? 'urgent' : serviceOverview.soon ? 'soon' : ''}>
        <span>{serviceOverview.overdue || serviceOverview.soon ? <TriangleAlert size={21} /> : <CheckCircle2 size={21} />}</span>
        <div><small>{t('Состояние гаража', 'Гараж жағдайы', 'Garage health')}</small><strong>{serviceOverview.overdue ? t('Нужно обслуживание', 'Қызмет қажет', 'Service needed') : serviceOverview.soon ? t('Скоро обслуживание', 'Жақында қызмет', 'Service coming up') : t('Всё готово', 'Бәрі дайын', 'All ready')}</strong><p>{serviceOverview.overdue ? t(`${serviceOverview.overdue} просроченных пункта`, `${serviceOverview.overdue} мерзімі өткен тармақ`, `${serviceOverview.overdue} overdue items`) : serviceOverview.soon ? t(`${serviceOverview.soon} пункта приближаются к ТО`, `${serviceOverview.soon} тармақ қызметке жақындады`, `${serviceOverview.soon} items nearing service`) : t('Срочных работ сейчас нет', 'Қазір шұғыл жұмыс жоқ', 'Nothing urgent right now')}</p></div>
      </article>
      <article><span><Wrench size={21} /></span><div><small>{t('Следующее действие', 'Келесі әрекет', 'Next action')}</small><strong>{serviceOverview.next ? componentLabels[serviceOverview.next.component] : '—'}</strong><p>{serviceOverview.next ? `${serviceOverview.next.bikeName} · ${serviceOverview.next.remainingKm <= 0 ? t('сделать сейчас', 'қазір жасау', 'do it now') : t(`через ${Math.round(serviceOverview.next.remainingKm)} км`, `${Math.round(serviceOverview.next.remainingKm)} км кейін`, `in ${Math.round(serviceOverview.next.remainingKm)} km`)}` : t('Добавь интервалы обслуживания', 'Қызмет аралықтарын қос', 'Add service intervals')}</p></div></article>
      <article><span><BikeSymbol size={21} /></span><div><small>{t('В гараже', 'Гаражда', 'In the garage')}</small><strong>{bikes.length}</strong><p>{t('Одометр каждого велосипеда считается отдельно', 'Әр велосипедтің одометрі бөлек есептеледі', 'Each bike has its own odometer')}</p></div></article>
    </section>}

    <section className="bike-gallery">{bikes.map((bike) => <article className="bike-card" key={bike.id}>
      <BikeIcon type={bike.bike_type} />
      <div><p className="kicker">{bike.bike_type}</p><h2>{bike.name}</h2><p>{bike.brand || t('Бренд не указан', 'Бренд көрсетілмеген', 'Brand not specified')}</p></div>
      <strong className="odometer">{Number(bike.total_distance_km).toFixed(0)} <small>{t('км', 'км', 'km')}</small></strong>
      <ElevationLine compact />
      <div className="maintenance-list">{bike.maintenance_intervals.map((item) => {
        const current = maintenanceClass(Number(bike.total_distance_km), Number(item.last_service_km), item.interval_km);
        const left = Math.max(0, item.interval_km - (Number(bike.total_distance_km) - Number(item.last_service_km)));
        return <div key={item.id}><span>{componentLabels[item.component]}</span><b>{left.toFixed(0)} {t('км', 'км', 'km')}</b><i className={current}><em style={{ width: `${Math.min(100, Math.max(4, ((Number(bike.total_distance_km) - Number(item.last_service_km)) / item.interval_km) * 100))}%` }} /></i><button type="button" disabled={serviceBusyId !== ''} onClick={() => void completeService(item.id, Number(bike.total_distance_km))} title={t('Отметить обслуживание выполненным', 'Қызметті орындалды деп белгілеу', 'Mark service complete')}><CheckCircle2 size={14} />{serviceBusyId === item.id ? t('Сохраняем', 'Сақталуда', 'Saving') : t('Готово', 'Дайын', 'Done')}</button></div>;
      })}</div>
    </article>)}</section>

    <section className="two-column-forms">
      <section className="form-card"><p className="kicker">{t('Новая техника', 'Жаңа велосипед', 'New bike')}</p><h2>{t('Добавить велосипед', 'Велосипед қосу', 'Add a bike')}</h2><form className="cycle-form" onSubmit={(event) => void createBike(event)}><label>{t('Название', 'Атауы', 'Name')}<input required value={bikeForm.name} onChange={(event) => setBikeForm({ ...bikeForm, name: event.target.value })} placeholder={t('Мой шоссейник', 'Менің шоссейнигім', 'My road bike')} /></label><label>{t('Бренд', 'Бренд', 'Brand')}<input value={bikeForm.brand} onChange={(event) => setBikeForm({ ...bikeForm, brand: event.target.value })} placeholder={t('Например, Giant', 'Мысалы, Giant', 'For example, Giant')} /></label><label>{t('Тип', 'Түрі', 'Type')}<select value={bikeForm.bikeType} onChange={(event) => setBikeForm({ ...bikeForm, bikeType: event.target.value as BikeType })}><option value="road">{t('Шоссейный', 'Шосселік', 'Road')}</option><option value="mountain">{t('Горный', 'Таулық', 'Mountain')}</option><option value="gravel">{t('Гравийный', 'Гравийлік', 'Gravel')}</option><option value="city">{t('Городской', 'Қалалық', 'City')}</option></select></label><label>{t('Дата покупки', 'Сатып алу күні', 'Purchase date')}<input type="date" value={bikeForm.purchaseDate} onChange={(event) => setBikeForm({ ...bikeForm, purchaseDate: event.target.value })} /></label><button className="signal-button" disabled={busy}>{t('Добавить в гараж', 'Гаражға қосу', 'Add bike')}</button></form></section>
      <section className="form-card"><p className="kicker">{t('Журнал заездов', 'Сапар журналы', 'Ride log')}</p><h2>{t('Записать поездку', 'Сапарды жазу', 'Log a ride')}</h2>{bikes.length ? <form className="cycle-form" onSubmit={(event) => void createRide(event)}><label>{t('Велосипед', 'Велосипед', 'Bike')}<select value={rideForm.bikeId} onChange={(event) => setRideForm({ ...rideForm, bikeId: event.target.value })}>{bikes.map((bike) => <option value={bike.id} key={bike.id}>{bike.name}</option>)}</select></label><label>{t('Дистанция, км', 'Қашықтық, км', 'Distance, km')}<input required min="0.1" step="0.1" type="number" value={rideForm.distanceKm} onChange={(event) => setRideForm({ ...rideForm, distanceKm: event.target.value })} /></label><label>{t('Набор, м', 'Биіктік, м', 'Climb, m')}<input min="0" type="number" value={rideForm.elevationM} onChange={(event) => setRideForm({ ...rideForm, elevationM: event.target.value })} /></label><label>{t('Время, мин', 'Уақыт, мин', 'Time, min')}<input min="1" type="number" value={rideForm.durationMinutes} onChange={(event) => setRideForm({ ...rideForm, durationMinutes: event.target.value })} /></label><label>{t('Дата', 'Күні', 'Date')}<input required type="date" value={rideForm.rideDate} onChange={(event) => setRideForm({ ...rideForm, rideDate: event.target.value })} /></label><button className="signal-button" disabled={busy}>{t('Сохранить заезд', 'Сапарды сақтау', 'Save ride')}</button></form> : <p className="empty-copy">{t('Сначала добавь велосипед — так километры попадут в нужный одометр.', 'Алдымен велосипед қос — сонда километрлер дұрыс одометрге түседі.', 'Add a bike first so kilometres reach the correct odometer.')}</p>}</section>
    </section>
    {message && <p className="form-note" role="status">{message}</p>}
  </main></PageShell>;
}
