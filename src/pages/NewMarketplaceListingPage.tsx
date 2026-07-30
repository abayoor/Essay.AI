import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { CityAutocomplete } from '../components/CityAutocomplete';
import { PageShell } from '../components/PageShell';
import { useSession } from '../lib/auth';
import { createMarketplaceListing, marketplaceCategories, marketplaceCategoryLabels, marketplaceConditions, marketplaceConditionLabels, type MarketplaceCategory, type MarketplaceCondition, uploadMarketplacePhoto } from '../lib/marketplace';

type SelectedPhoto = { file: File; preview: string };

export function NewMarketplaceListingPage() {
  const { session, loading } = useSession();
  const [, navigate] = useLocation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<MarketplaceCategory>('bike');
  const [condition, setCondition] = useState<MarketplaceCondition>('used');
  const [city, setCity] = useState('');
  const [isNegotiable, setIsNegotiable] = useState(true);
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const photosRef = useRef<SelectedPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (!loading && !session) navigate('/auth/sign-in'); }, [loading, navigate, session]);
  useEffect(() => { photosRef.current = photos; }, [photos]);
  useEffect(() => () => photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.preview)), []);

  function addPhotos(files: FileList | null) {
    if (!files) return;
    const accepted = Array.from(files).filter((file) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type));
    const availableSlots = 6 - photos.length;
    setPhotos((current) => [...current, ...accepted.slice(0, availableSlots).map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
    if (!accepted.length) setError('Выбери изображения JPG, PNG или WebP.');
  }

  function removePhoto(index: number) {
    setPhotos((current) => {
      URL.revokeObjectURL(current[index].preview);
      return current.filter((_, photoIndex) => photoIndex !== index);
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numericPrice = Number(price.replace(/\s/g, '').replace(',', '.'));
    if (!Number.isFinite(numericPrice) || numericPrice < 0) { setError('Укажи корректную цену.'); return; }
    if (!photos.length) { setError('Добавь хотя бы одно фото товара.'); return; }
    setBusy(true); setError('');
    try {
      const photoUrls = await Promise.all(photos.map((photo) => uploadMarketplacePhoto(photo.file)));
      const listingId = await createMarketplaceListing({ title, description, price: numericPrice, category, condition, photos: photoUrls, city, isNegotiable });
      navigate(`/marketplace/${listingId}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось опубликовать объявление.');
    } finally { setBusy(false); }
  }

  return <PageShell><main className="cycle-page listing-editor-page"><header className="listing-editor-heading"><Link href="/marketplace" className="back-link">← Маркет</Link><p className="kicker">Новое объявление</p><h1>Продай вещь<br /><em>своему сообществу.</em></h1><p>Покажи товар честно: хорошие фото и понятное описание помогают продать быстрее.</p></header><form className="listing-editor" onSubmit={(event) => void submit(event)}><section className="listing-editor-card listing-basics"><h2>О товаре</h2><label>Название<input required value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="Например, Canyon Grizl 7, размер M" /></label><label>Описание<textarea required value={description} onChange={(event) => setDescription(event.target.value)} maxLength={3000} placeholder="Состояние, пробег, комплектация, честные нюансы…" /></label><div className="listing-double-field"><label>Категория<select value={category} onChange={(event) => setCategory(event.target.value as MarketplaceCategory)}>{marketplaceCategories.map((item) => <option key={item} value={item}>{marketplaceCategoryLabels[item]}</option>)}</select></label><label>Состояние<select value={condition} onChange={(event) => setCondition(event.target.value as MarketplaceCondition)}>{marketplaceConditions.map((item) => <option key={item} value={item}>{marketplaceConditionLabels[item]}</option>)}</select></label></div></section><section className="listing-editor-card"><h2>Цена и город</h2><div className="listing-double-field"><label>Цена, ₸<input required inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="250 000" maxLength={12} /></label><label>Город<CityAutocomplete value={city} onChange={setCity} required /></label></div><label className="negotiable-toggle"><input type="checkbox" checked={isNegotiable} onChange={(event) => setIsNegotiable(event.target.checked)} /><span aria-hidden="true" /><b>Торг уместен</b><small>Покупатели увидят это рядом с ценой.</small></label></section><section className="listing-editor-card listing-photo-editor"><div><h2>Фотографии</h2><p>До 6 фото, первое станет главным.</p></div><div className="listing-photo-grid">{photos.map((photo, index) => <figure key={photo.preview}><img src={photo.preview} alt={`Фото товара ${index + 1}`} />{index === 0 && <figcaption>Главное</figcaption>}<button type="button" aria-label={`Удалить фото ${index + 1}`} onClick={() => removePhoto(index)}><Trash2 size={16} aria-hidden="true" /></button></figure>)}{photos.length < 6 && <label className="listing-photo-add"><ImagePlus size={26} aria-hidden="true" /><span>Добавить фото</span><small>{photos.length}/6</small><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { addPhotos(event.target.files); event.currentTarget.value = ''; }} /></label>}</div></section>{error && <p className="form-note form-note-error" role="alert">{error}</p>}<div className="listing-submit-row"><span>После публикации с тобой смогут связаться в личных сообщениях.</span><button className="signal-button" disabled={busy}>{busy ? 'Публикуем…' : 'Опубликовать объявление'}</button></div></form></main></PageShell>;
}
