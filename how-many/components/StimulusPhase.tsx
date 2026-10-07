import { STIMULUS } from "@/config/experiment";
import type { Side, TrialStimulus } from "@/lib/types";
import DotField from "./DotField";

interface StimulusPhaseProps {
  /** Non-null only while the dots are on screen. */
  stimulus: TrialStimulus | null;
  /** Overlay content (the fixation cross). */
  children?: React.ReactNode;
}

function Frame({ side, dots }: { side: Side; dots: TrialStimulus["left"] | null }) {
  return (
    <div
      className="w-full overflow-hidden border border-line bg-paper-raised text-ink"
      style={{ aspectRatio: `${STIMULUS.width} / ${STIMULUS.height}` }}
      data-testid={`frame-${side}`}
    >
      {dots && <DotField dots={dots} width={STIMULUS.width} height={STIMULUS.height} />}
    </div>
  );
}

/**
 * The two identical stimulus regions. They are always present (so layout never
 * shifts between phases); dots are only drawn during the stimulus phase.
 */
export default function StimulusPhase({ stimulus, children }: StimulusPhaseProps) {
  return (
    <div className="relative grid grid-cols-2 gap-3 sm:gap-6" data-testid="arena">
      <Frame side="left" dots={stimulus?.left ?? null} />
      <Frame side="right" dots={stimulus?.right ?? null} />
      {children}
    </div>
  );
}
