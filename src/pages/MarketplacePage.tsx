import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, SlidersHorizontal } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { BikeLoader } from '../components/BikeLoader';
import { MarketplaceCard } from '../components/MarketplaceCard';
import { PageShell } from '../components/PageShell';
import { useSession } from '../lib/auth';
import { marketplaceCategories, marketplaceCategoryLabels, type MarketplaceCategory, type MarketplaceListing, loadMarketplaceListings } from '../lib/marketplace';
import { useLocaleText } from '../lib/localized';

type CategoryFilter = 'all' | MarketplaceCategory;

export function MarketplacePage() {
  const text = useLocaleText();
  const { session, loading } = useSession();
  const [, navigate] = useLocation();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [query, setQuery] = useState('');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try { setError(''); setListings(await loadMarketplaceListings()); }
    catch { setError(text('Не удалось загрузить объявления.', 'Хабарландыруларды жүктеу мүмкін болмады.', 'Could not load listings.')); }
    finally { setReady(true); }
  }, [text]);

  useEffect(() => { if (!loading && !session) navigate('/auth/sign-in'); if (session) void refresh(); }, [loading, navigate, refresh, session]);

  const filteredListings = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('ru');
    return listings.filter((listing) => (category === 'all' || listing.category === category) && (!normalizedQuery || `${listing.title} ${listing.description} ${listing.city ?? ''}`.toLocaleLowerCase('ru').includes(normalizedQuery)));
  }, [category, listings, query]);

  return <PageShell><main className="cycle-page marketplace-page"><header className="marketplace-hero"><div><p className="kicker">{text('Вело‑маркет', 'Вело‑маркет', 'Bike market')}</p><h1>{text('Найди своё', 'Өзіңе лайық', 'Find your')}<br /><em>{text('следующее колесо.', 'келесі велосипедіңді.', 'next ride.')}</em></h1><p>{text('Велосипеды, запчасти и экипировка от райдеров твоего сообщества.', 'Қауымдастық райдерлерінің велосипедтері, бөлшектері мен жабдықтары.', 'Bikes, parts and gear from riders in your community.')}</p></div><Link className="signal-button" href="/marketplace/new"><Plus size={18} aria-hidden="true" />{text('Разместить объявление', 'Хабарландыру беру', 'Create listing')}</Link></header><section className="marketplace-tools" aria-label={text('Поиск и фильтры', 'Іздеу және сүзгілер', 'Search and filters')}><label className="marketplace-search"><Search size={19} aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text('Поиск по объявлениям', 'Хабарландыруларды іздеу', 'Search listings')} maxLength={80} /></label><div className="marketplace-filters"><span><SlidersHorizontal size={16} aria-hidden="true" />{text('Категория', 'Санат', 'Category')}</span><button type="button" className={category === 'all' ? 'active' : ''} onClick={() => setCategory('all')}>{text('Все', 'Барлығы', 'All')}</button>{marketplaceCategories.map((item) => <button type="button" key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{marketplaceCategoryLabels[item]}</button>)}</div></section>{error && <div className="inline-error" role="alert">{error}<button type="button" onClick={() => void refresh()}>{text('Повторить', 'Қайталау', 'Retry')}</button></div>}{!ready ? <BikeLoader label={text('Собираем объявления…', 'Хабарландырулар жиналуда…', 'Loading listings…')} /> : filteredListings.length ? <section className="marketplace-listings" aria-live="polite">{filteredListings.map((listing) => <MarketplaceCard key={listing.id} listing={listing} />)}</section> : <section className="empty-panel marketplace-empty"><h2>{listings.length ? text('По этому запросу ничего нет', 'Бұл сұрау бойынша ештеңе жоқ', 'No matches found') : text('Маркет пока пуст', 'Маркет әзірге бос', 'The market is empty')}</h2><p>{listings.length ? text('Попробуй другую категорию или запрос.', 'Басқа санатты немесе сұрауды қолданып көр.', 'Try another category or search.') : text('Размести первое объявление — его увидят райдеры сообщества.', 'Алғашқы хабарландыруды бер — оны қауымдастық райдерлері көреді.', 'Create the first listing for community riders to see.')}</p>{!listings.length && <Link className="signal-button" href="/marketplace/new">{text('Продать вещь', 'Затты сату', 'Sell an item')}</Link>}</section>}</main></PageShell>;
}
