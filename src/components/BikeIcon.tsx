import type { BikeType } from '../lib/cyclingModels';

export function BikeIcon({ type }: { type: BikeType }) {
  const frame = type === 'road' ? 'M20 39h17l12-20 13 20h18M37 39l12-20 8 20M49 19h15l8-8' : type === 'mountain' ? 'M20 39h17l12-21 13 21h18M37 39l12-21 9 21M49 18l13 3 8-8' : 'M20 39h17l12-19 13 19h18M37 39l12-19 9 19M49 20h15l8-8';
  return <svg className="bike-icon" viewBox="0 0 96 56" aria-label={`Велосипед: ${type}`}><circle cx="20" cy="39" r="13" /><circle cx="80" cy="39" r="13" /><path d={frame} /><path d="M58 12h11M65 12l5 7" /></svg>;
}
