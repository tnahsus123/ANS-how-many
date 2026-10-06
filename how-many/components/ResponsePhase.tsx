import type { Side } from "@/lib/types";

interface ResponsePhaseProps {
  /** Buttons are rendered (visible) — response phase and the brief transition after. */
  visible: boolean;
  /** Buttons are clickable — response phase only. */
  enabled: boolean;
  selectedSide: Side | null;
  onRespond: (side: Side, eventTime?: number) => void;
}

const OPTIONS: ReadonlyArray<{ side: Side; label: string }> = [
  { side: "left", label: "LEFT HAS MORE" },
  { side: "right", label: "RIGHT HAS MORE" },
];

export default function ResponsePhase({ visible, enabled, selectedSide, onRespond }: ResponsePhaseProps) {
  return (
    <div className="mt-5 sm:mt-8">
      <p
        className={`text-center text-sm font-medium text-mute sm:text-base ${visible ? "" : "invisible"}`}
        aria-hidden={!visible}
      >
        Which side had more?
      </p>

      <div className={`mt-3 grid grid-cols-2 gap-3 sm:gap-6 ${visible ? "" : "invisible"}`} aria-hidden={!visible}>
        {OPTIONS.map(({ side, label }) => {
          const chosen = selectedSide === side;
          return (
            <button
              key={side}
              type="button"
              disabled={!enabled}
              aria-pressed={chosen}
              data-testid={`btn-${side}`}
              onPointerDown={(e) => {
                // Pointer-down gives the earliest, most accurate response time.
                if (e.isPrimary && e.button === 0) onRespond(side, e.timeStamp);
              }}
              onClick={(e) => onRespond(side, e.timeStamp)} // keyboard activation fallback
              className={`flex min-h-[64px] items-center justify-center border px-2 py-3 text-center text-sm font-bold leading-tight tracking-wide transition-colors sm:min-h-[80px] sm:text-lg ${
                chosen
                  ? "border-ink bg-ink text-paper"
                  : "border-ink bg-paper text-ink enabled:hover:bg-ink enabled:hover:text-paper"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <p
        className={`mt-4 hidden text-center font-mono text-xs text-mute [@media(hover:hover)_and_(pointer:fine)]:block ${
          enabled ? "" : "invisible"
        }`}
        aria-hidden="true"
      >
        Tip: You can also use ← and →
      </p>
    </div>
  );
}
