import { motion } from 'framer-motion';
import { BrandLogo } from './BrandLogo';

type BikeLoaderProps = { label: string };

export function BikeLoader({ label }: BikeLoaderProps) {
  return <div className="loading-copy" role="status"><span className="bike-loader-icon" aria-hidden="true"><motion.span animate={{ opacity: [.65, 1, .65], scale: [.94, 1, .94] }} transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}><BrandLogo showWordmark={false} /></motion.span></span><span>{label}</span></div>;
}
