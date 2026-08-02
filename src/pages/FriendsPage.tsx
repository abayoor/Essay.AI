import { useCallback, useEffect, useState } from 'react';
import { Check, LocateFixed, MapPin, Search, UserRoundPlus, Users, X } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { Avatar } from '../components/Avatar';
import { BikeLoader } from '../components/BikeLoader';
import { FriendsMap } from '../components/FriendsMap';
import { PageShell } from '../components/PageShell';
import { useSession } from '../lib/auth';
import {
  loadFriendHub,
  locationSharingEnabled,
  removeFriend,
  respondFriendRequest,
  sendFriendRequest,
  setLocationSharingEnabled,
  stopLiveLocationSharing,
  type FriendHub,
} from '../lib/friends';
import type { PublicProfile } from '../lib/cyclingModels';
import { searchPublicProfiles } from '../lib/rider';
import '../styles/friends.css';

const emptyHub: FriendHub = { friends: [], incoming: [], outgoingUserIds: [], locations: [] };

export function FriendsPage() {
  const { session, loading: sessionLoading } = useSession();
  const [, navigate] = useLocation();
  const [hub, setHub] = useState<FriendHub>(emptyHub);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sharing, setSharing] = useState(locationSharingEnabled);
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    try { setHub(await loadFriendHub()); setMessage(''); }
    catch { setMessage('Не удалось загрузить друзей. Проверь подключение.'); }
    finally { setReady(true); }
  }, []);

  useEffect(() => {
    if (!sessionLoading && !session) navigate('/auth/sign-in');
    if (session) void refresh();
  }, [navigate, refresh, session, sessionLoading]);

  useEffect(() => {
    if (!session) return undefined;
    const timer = window.setInterval(() => void refresh(), 15_000);
    return () => window.clearInterval(timer);
  }, [refresh, session]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (query.trim().length < 2) { setResults([]); setSearching(false); return; }
      setSearching(true);
      void searchPublicProfiles(query)
        .then((profiles) => setResults(profiles.filter((profile) => profile.id !== session?.user.id)))
        .catch(() => setMessage('Поиск временно недоступен.'))
        .finally(() => setSearching(false));
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query, session?.user.id]);

  async function requestFriend(rider: PublicProfile) {
    setBusyId(rider.id);
    try { await sendFriendRequest(rider.id); setMessage(`Запрос отправлен @${rider.username}`); await refresh(); }
    catch { setMessage('Не удалось отправить запрос в друзья.'); }
    finally { setBusyId(null); }
  }

  async function respond(requestId: string, accept: boolean) {
    setBusyId(requestId);
    try { await respondFriendRequest(requestId, accept); await refresh(); }
    catch { setMessage('Не удалось обработать запрос.'); }
    finally { setBusyId(null); }
  }

  async function toggleSharing() {
    const next = !sharing;
    setSharing(next);
    setLocationSharingEnabled(next);
    if (!next) await stopLiveLocationSharing().catch(() => undefined);
    setMessage(next
      ? 'Геопозиция доступна только принятым друзьям и автоматически исчезает через 30 минут без обновления.'
      : 'Передача геопозиции выключена.');
  }

  async function deleteFriend(friendId: string) {
    setBusyId(friendId);
    try {
      await removeFriend(friendId);
      await refresh();
    } catch {
      setMessage('Не удалось удалить друга. Попробуй ещё раз.');
    } finally {
      setBusyId(null);
    }
  }

  if (sessionLoading || !ready) return <main className="route-loading profile-loading-screen"><BikeLoader label="Загружаем друзей…" /></main>;

  const friendIds = new Set(hub.friends.map((friend) => friend.id));
  const outgoingIds = new Set(hub.outgoingUserIds);

  return <PageShell><main className="cycle-page friends-page">
    <header className="page-heading"><div><p className="kicker">Друзья</p><h1>Катайтесь вместе.</h1><p>Добавляй райдеров по нику и делись геопозицией только по своему желанию.</p></div><button type="button" className={sharing ? 'signal-button' : 'outline-inline-button'} onClick={() => void toggleSharing()}><LocateFixed size={17} />{sharing ? 'Геопозиция включена' : 'Включить геопозицию'}</button></header>
    {message && <p className="form-note" role="status">{message}</p>}

    <section className="friends-search-card"><label><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти по @username" maxLength={48} /></label>{query.trim().length >= 2 && <div className="friends-search-results">{searching ? <p>Ищем…</p> : results.length ? results.map((rider) => {
      const alreadyFriend = friendIds.has(rider.id);
      const pending = outgoingIds.has(rider.id);
      return <article key={rider.id}><Avatar profile={rider} /><div><strong>{rider.full_name || rider.username}</strong><span>@{rider.username}{rider.home_city ? ` · ${rider.home_city}` : ''}</span></div><button type="button" disabled={alreadyFriend || pending || busyId === rider.id} onClick={() => void requestFriend(rider)}>{alreadyFriend ? 'Уже друг' : pending ? 'Запрос отправлен' : <><UserRoundPlus size={16} />Добавить</>}</button></article>;
    }) : <p>Никого не нашли.</p>}</div>}</section>

    {hub.incoming.length > 0 && <section className="friend-requests"><h2>Запросы в друзья</h2>{hub.incoming.map((request) => <article key={request.id}><Avatar profile={request.rider} /><div><strong>{request.rider.full_name || request.rider.username}</strong><span>@{request.rider.username}</span></div><button aria-label="Принять" disabled={busyId === request.id} onClick={() => void respond(request.id, true)}><Check size={18} /></button><button aria-label="Отклонить" disabled={busyId === request.id} onClick={() => void respond(request.id, false)}><X size={18} /></button></article>)}</section>}

    <section className="friends-map-card"><header><div><p className="kicker">Живая карта</p><h2>Друзья рядом</h2></div><span><MapPin size={15} />{hub.locations.length} онлайн</span></header>{hub.locations.length ? <FriendsMap locations={hub.locations} /> : <div className="friends-map-empty"><MapPin size={28} /><p>Здесь появятся друзья, которые сами включили передачу геопозиции.</p></div>}</section>

    <section className="friends-list"><header><div><p className="kicker">Твой круг</p><h2>Друзья</h2></div><span>{hub.friends.length}</span></header>{hub.friends.length ? hub.friends.map((friend) => <article key={friend.id}><Avatar profile={friend} /><div><Link href={`/u/${friend.username}`}><strong>{friend.full_name || friend.username}</strong></Link><span>@{friend.username}{friend.home_city ? ` · ${friend.home_city}` : ''}</span></div><Link href="/messages">Написать</Link><button type="button" disabled={busyId === friend.id} onClick={() => void deleteFriend(friend.id)} aria-label={`Удалить @${friend.username} из друзей`}><X size={16} /></button></article>) : <div className="friends-empty"><Users size={28} /><p>Найди первого друга по нику выше.</p></div>}</section>
  </main></PageShell>;
}
