function RepArcMark({ animated = false }: { animated?: boolean }) {
  return (
    <svg className={animated ? "reparc-loader-mark" : "brand-glyph"} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path pathLength="1" d="M13 47A35 35 0 0 1 48 12" className={animated ? "reparc-loader-arc" : undefined} />
      <circle cx="48" cy="12" r="3.5" className={animated ? "reparc-loader-node" : "brand-glyph-node"} />
      <path pathLength="1" d="M20 46V23h12c7 0 11 3.5 11 9s-4 9-11 9H20M33 41l11 7" className={animated ? "reparc-loader-letter" : "brand-glyph-letter"} />
    </svg>
  );
}

export function BrandLockup() {
  return (
    <div className="brand-lockup">
      <RepArcMark />
      <span>REPARC</span>
    </div>
  );
}

export function RepArcLoader({ label = "Opening RepArc" }: { label?: string }) {
  return (
    <div className="reparc-loader" role="status" aria-live="polite">
      <div className="reparc-loader-stage">
        <RepArcMark animated />
      </div>
      <p className="reparc-loader-wordmark">REPARC</p>
      <p className="eyebrow text-stone-500">{label}</p>
    </div>
  );
}
