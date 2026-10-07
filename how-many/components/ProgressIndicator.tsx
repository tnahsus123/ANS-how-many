interface ProgressIndicatorProps {
  /** 1-based number of the trial currently in progress. */
  current: number;
  total: number;
}

export default function ProgressIndicator({ current, total }: ProgressIndicatorProps) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <div className="w-full">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-mute">
        Trial {pad(current)} / {pad(total)}
      </p>
      <div
        className="mt-3 grid gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
        role="progressbar"
        aria-label="Experiment progress"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current}
      >
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`h-1 ${i < current - 1 ? "bg-ink" : i === current - 1 ? "bg-accent" : "bg-line"}`}
          />
        ))}
      </div>
    </div>
  );
}
