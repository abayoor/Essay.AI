import { Bike, Image as ImageIcon } from 'lucide-react';
import { Link } from 'wouter';
import { marketplaceCategoryLabels, marketplaceConditionLabels, type MarketplaceListing } from '../lib/marketplace';
import { useLocaleText } from '../lib/localized';

type MarketplaceCardProps = {
  listing: MarketplaceListing;
};

export function MarketplaceCard({ listing }: MarketplaceCardProps) {
  const text = useLocaleText();
  const image = listing.photos[0];
  return <Link href={`/marketplace/${listing.id}`} className="marketplace-card">
    <div className="marketplace-card-image">{image ? <img src={image} alt={listing.title} /> : <Bike size={42} aria-hidden="true" />}<span className="marketplace-condition-badge">{marketplaceConditionLabels[listing.condition]}</span>{listing.photos.length > 1 && <span className="marketplace-photo-count"><ImageIcon size={14} aria-hidden="true" />{listing.photos.length}</span>}</div>
    <div className="marketplace-card-copy"><p>{marketplaceCategoryLabels[listing.category]}</p><h2>{listing.title}</h2><strong>{Number(listing.price).toLocaleString('ru-RU')} ₸</strong>{listing.is_negotiable && <small>{text('Торг уместен', 'Саудаласуға болады', 'Negotiable')}</small>}<span>{listing.city || text('Город не указан', 'Қала көрсетілмеген', 'City not set')}</span></div>
  </Link>;
}
