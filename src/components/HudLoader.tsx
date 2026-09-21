type HudLoaderProps = {
  label?: string;
  className?: string;
  compact?: boolean;
};

export function HudLoader({
  label = "LOADING",
  className = "",
  compact = false,
}: HudLoaderProps) {
  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-2 font-mono text-[0.65rem] tracking-[0.14em] text-accent ${className}`}
        role="status"
        aria-live="polite"
      >
        <span className="hud-spinner hud-spinner--sm" aria-hidden />
        <span className="hud-loader-label">{label}</span>
      </span>
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 py-16 ${className}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="hud-loader-ring" aria-hidden>
        <span className="hud-spinner" />
        <span className="hud-loader-scan" />
      </div>
      <div className="text-center">
        <p className="hud-loader-label font-mono text-xs tracking-[0.22em] text-accent">
          {label}
        </p>
        <p className="mt-1 font-mono text-[0.65rem] tracking-[0.16em] text-muted">
          PLEASE STAND BY
        </p>
      </div>
    </div>
  );
}
