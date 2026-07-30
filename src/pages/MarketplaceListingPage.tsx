import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, MapPin, MessageCircle, ShieldCheck } from 'lucide-react';
import { Link, useLocation, useRoute } from 'wouter';
import { Avatar } from '../components/Avatar';
import { BikeLoader } from '../components/BikeLoader';
import { PageShell } from '../components/PageShell';
import { useSession } from '../lib/auth';
import { marketplaceCategoryLabels, marketplaceConditionLabels, type MarketplaceListing, loadMarketplaceListing, markMarketplaceListingAsSold } from '../lib/marketplace';
import { startDirectConversation } from '../lib/messages';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value));
}

export function MarketplaceListingPage() {
  const [, params] = useRoute('/marketplace/:id');
  const listingId = params?.id ?? '';
  const { session, loading } = useSession();
  const [, navigate] = useLocation();
  const [listing, setListing] = useState<MarketplaceListing | null>(null);
  const [ready, setReady] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try { setError(''); setListing(await loadMarketplaceListing(listingId)); }
    catch { setError('Не удалось открыть объявление.'); }
    finally { setReady(true); }
  }, [listingId]);

  useEffect(() => { if (!loading && !session) navigate('/auth/sign-in'); if (session && listingId) void refresh(); }, [listingId, loading, navigate, refresh, session]);

  async function messageSeller() {
    if (!listing || !listing.seller || listing.sellerId === session?.user.id) return;
    setBusy(true); setError('');
    try { navigate(`/messages/${await startDirectConversation(listing.sellerId)}`); }
    catch { setError('Не удалось открыть диалог с продавцом.'); setBusy(false); }
  }

  async function markAsSold() {
    if (!listing) return;
    setBusy(true); setError('');
    try { await markMarketplaceListingAsSold(listing.id); setListing({ ...listing, status: 'sold' }); }
    catch { setError('Не удалось изменить статус объявления.'); }
    finally { setBusy(false); }
  }

  if (!ready) return <PageShell><main className="cycle-page marketplace-detail-page"><BikeLoader label="Открываем объявление…" /></main></PageShell>;
  if (!listing) return <PageShell><main className="cycle-page marketplace-detail-page"><section className="empty-panel"><h2>Объявление не найдено</h2><p>Возможно, продавец уже снял его с публикации.</p><Link className="signal-button" href="/marketplace">Вернуться в маркет</Link></section></main></PageShell>;

  const isOwner = listing.sellerId === session?.user.id;
  const currentPhoto = listing.photos[photoIndex];
  return <PageShell><main className="cycle-page marketplace-detail-page"><Link href="/marketplace" className="back-link marketplace-back">← Маркет</Link>{error && <div className="inline-error" role="alert">{error}</div>}<section className="marketplace-detail"><section className="listing-gallery">{currentPhoto ? <img src={currentPhoto} alt={listing.title} /> : <div className="listing-gallery-empty">Фото не добавлено</div>}{listing.photos.length > 1 && <><button type="button" className="gallery-nav previous" aria-label="Предыдущее фото" onClick={() => setPhotoIndex((current) => (current - 1 + listing.photos.length) % listing.photos.length)}><ChevronLeft size={23} aria-hidden="true" /></button><button type="button" className="gallery-nav next" aria-label="Следующее фото" onClick={() => setPhotoIndex((current) => (current + 1) % listing.photos.length)}><ChevronRight size={23} aria-hidden="true" /></button><div className="gallery-thumbnails">{listing.photos.map((photo, index) => <button type="button" key={photo} className={index === photoIndex ? 'active' : ''} onClick={() => setPhotoIndex(index)}><img src={photo} alt={`Фото ${index + 1}`} /></button>)}</div></>}</section><section className="listing-detail-copy"><div className="listing-meta"><span>{marketplaceCategoryLabels[listing.category]}</span><span>{marketplaceConditionLabels[listing.condition]}</span></div><h1>{listing.title}</h1><div className="listing-price"><strong>{Number(listing.price).toLocaleString('ru-RU')} ₸</strong>{listing.is_negotiable && <span>Торг уместен</span>}</div><p className="listing-city"><MapPin size={17} aria-hidden="true" />{listing.city || 'Город не указан'}</p><p className="listing-description">{listing.description}</p><small className="listing-published">Опубликовано {formatDate(listing.created_at)}</small>{listing.status === 'sold' ? <p className="listing-sold-note"><Check size={17} aria-hidden="true" />Товар продан</p> : isOwner ? <button type="button" className="outline-button" disabled={busy} onClick={() => void markAsSold()}>Пометить как проданное</button> : <button type="button" className="signal-button listing-message-button" disabled={busy || !listing.seller} onClick={() => void messageSeller()}><MessageCircle size={19} aria-hidden="true" />Написать продавцу</button>}</section></section>{listing.seller && <section className="listing-seller-card"><Link href={`/u/${listing.seller.username}`}><Avatar profile={listing.seller} className="listing-seller-avatar" /></Link><div><span>Продавец</span><Link href={`/u/${listing.seller.username}`}><strong>{listing.seller.full_name || listing.seller.username}</strong></Link><small>@{listing.seller.username}</small></div><p><ShieldCheck size={17} aria-hidden="true" />Связь и договорённости — в личных сообщениях Slipstream.</p></section>}</main></PageShell>;
}
