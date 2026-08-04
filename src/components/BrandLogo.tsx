import brandMark from '../assets/branding/slipstream-mark.png';

type BrandLogoProps = {
  className?: string;
  showWordmark?: boolean;
};

export function BrandLogo({ className = '', showWordmark = true }: BrandLogoProps) {
  const classes = ['brand-logo', className].filter(Boolean).join(' ');

  return <span className={classes} aria-label={showWordmark ? 'Slipstream' : undefined}>
    <img className="brand-logo-mark" src={brandMark} alt="" aria-hidden="true" />
    {showWordmark && <span className="brand-logo-wordmark">Slipstream</span>}
  </span>;
}
