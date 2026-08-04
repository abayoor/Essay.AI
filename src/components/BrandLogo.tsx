import brandMark from '../assets/branding/slipstream-mark.png';
import brandWordmark from '../assets/branding/slipstream-logo.png';

type BrandLogoProps = {
  className?: string;
  showWordmark?: boolean;
};

export function BrandLogo({ className = '', showWordmark = true }: BrandLogoProps) {
  const classes = ['brand-logo', showWordmark ? 'brand-logo--wordmark' : 'brand-logo--mark', className].filter(Boolean).join(' ');

  return <span className={classes} aria-label={showWordmark ? 'Slipstream' : undefined}>
    <img className="brand-logo-image" src={showWordmark ? brandWordmark : brandMark} alt="" aria-hidden="true" />
  </span>;
}
