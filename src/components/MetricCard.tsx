export function MetricCard({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return <article className="metric-card"><p>{label}</p><strong>{value}</strong>{unit && <span>{unit}</span>}</article>;
}
