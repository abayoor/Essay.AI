import { motion } from 'framer-motion';
import { Bike } from 'lucide-react';

type BikeLoaderProps = { label: string };

export function BikeLoader({ label }: BikeLoaderProps) {
  return <div className="loading-copy" role="status"><span className="bike-loader-icon" aria-hidden="true"><motion.span animate={{ x: [-2, 3, -2] }} transition={{ duration: .8, repeat: Infinity, ease: 'easeInOut' }}><Bike size={34} /></motion.span><motion.i className="bike-loader-wheel bike-loader-wheel-left" animate={{ rotate: 360 }} transition={{ duration: .65, repeat: Infinity, ease: 'linear' }} /><motion.i className="bike-loader-wheel bike-loader-wheel-right" animate={{ rotate: 360 }} transition={{ duration: .65, repeat: Infinity, ease: 'linear' }} /></span><span>{label}</span></div>;
}
