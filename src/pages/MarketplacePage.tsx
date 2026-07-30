import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, SlidersHorizontal } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { BikeLoader } from '../components/BikeLoader';
import { MarketplaceCard } from '../components/MarketplaceCard';
import { PageShell } from '../components/PageShell';
import { useSession } from '../lib/auth';
import { marketplaceCategories, marketplaceCategoryLabels, type MarketplaceCategory, type MarketplaceListing, loadMarketplaceListings } from '../lib/marketplace';

type CategoryFilter = 'all' | MarketplaceCategory;

export function MarketplacePage() {
  const { session, loading } = useSession();
  const [, navigate] = useLocation();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [query, setQuery] = useState('');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try { setError(''); setListings(await loadMarketplaceListings()); }
    catch { setError('Не удалось загрузить объявления.'); }
    finally { setReady(true); }
  }, []);

  useEffect(() => { if (!loading && !session) navigate('/auth/sign-in'); if (session) void refresh(); }, [loading, navigate, refresh, session]);

  const filteredListings = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('ru');
    return listings.filter((listing) => (category === 'all' || listing.category === category) && (!normalizedQuery || `${listing.title} ${listing.description} ${listing.city ?? ''}`.toLocaleLowerCase('ru').includes(normalizedQuery)));
  }, [category, listings, query]);

  return <PageShell><main className="cycle-page marketplace-page"><header className="marketplace-hero"><div><p className="kicker">Вело‑маркет</p><h1>Найди своё<br /><em>следующее колесо.</em></h1><p>Велосипеды, запчасти и экипировка от райдеров твоего сообщества.</p></div><Link className="signal-button" href="/marketplace/new"><Plus size={18} aria-hidden="true" />Разместить объявление</Link></header><section className="marketplace-tools" aria-label="Поиск и фильтры"><label className="marketplace-search"><Search size={19} aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по объявлениям" maxLength={80} /></label><div className="marketplace-filters"><span><SlidersHorizontal size={16} aria-hidden="true" />Категория</span><button type="button" className={category === 'all' ? 'active' : ''} onClick={() => setCategory('all')}>Все</button>{marketplaceCategories.map((item) => <button type="button" key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{marketplaceCategoryLabels[item]}</button>)}</div></section>{error && <div className="inline-error" role="alert">{error}<button type="button" onClick={() => void refresh()}>Повторить</button></div>}{!ready ? <BikeLoader label="Собираем объявления…" /> : filteredListings.length ? <section className="marketplace-listings" aria-live="polite">{filteredListings.map((listing) => <MarketplaceCard key={listing.id} listing={listing} />)}</section> : <section className="empty-panel marketplace-empty"><h2>{listings.length ? 'По этому запросу ничего нет' : 'Маркет пока пуст'}</h2><p>{listings.length ? 'Попробуй другую категорию или запрос.' : 'Размести первое объявление — его увидят райдеры сообщества.'}</p>{!listings.length && <Link className="signal-button" href="/marketplace/new">Продать вещь</Link>}</section>}</main></PageShell>;
}
