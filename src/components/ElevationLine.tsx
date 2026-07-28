export function ElevationLine({ compact = false }: { compact?: boolean }) {
  return (
    <svg className={compact ? 'elevation-line compact' : 'elevation-line'} viewBox="0 0 320 32" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 24C18 24 23 13 39 13s22 12 37 12c19 0 21-19 40-19 17 0 21 17 37 17 20 0 21-13 42-13 17 0 17 11 32 11 19 0 25-15 43-15 16 0 19 10 37 10" />
    </svg>
  );
}
