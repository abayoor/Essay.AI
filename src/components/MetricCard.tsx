export function MetricCard({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return <article className="metric-card"><p>{label}</p><div className="metric-card-value"><strong>{value}</strong>{unit && <span>{unit}</span>}</div></article>;
}
