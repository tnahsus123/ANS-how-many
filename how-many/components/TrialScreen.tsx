import { TOTAL_TRIALS } from "@/config/experiment";
import type { ExperimentState } from "@/lib/experimentReducer";
import type { Side } from "@/lib/types";
import FixationPhase from "./FixationPhase";
import ProgressIndicator from "./ProgressIndicator";
import ResponsePhase from "./ResponsePhase";
import StimulusPhase from "./StimulusPhase";

interface TrialScreenProps {
  state: ExperimentState;
  onRespond: (side: Side, eventTime?: number) => void;
}

function statusMessage(state: ExperimentState): string {
  const n = state.trialIndex + 1;
  switch (state.phase) {
    case "fixation":
      return `Trial ${n} of ${TOTAL_TRIALS}. Look at the centre of the screen.`;
    case "response":
      return "Which side had more dots? Choose left or right.";
    default:
      return "";
  }
}

export default function TrialScreen({ state, onRespond }: TrialScreenProps) {
  const { phase } = state;
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-10">
      <ProgressIndicator current={state.trialIndex + 1} total={TOTAL_TRIALS} />

      <div className="flex flex-1 flex-col justify-center py-6">
        <StimulusPhase stimulus={phase === "stimulus" ? state.stimulus : null}>
          {phase === "fixation" && <FixationPhase />}
        </StimulusPhase>

        <ResponsePhase
          visible={phase === "response" || phase === "transition"}
          enabled={phase === "response"}
          selectedSide={state.selectedSide}
          onRespond={onRespond}
        />
      </div>

      {/* Screen-reader status. The task itself is visual by nature. */}
      <p className="sr-only" role="status" aria-live="polite">
        {statusMessage(state)}
      </p>
    </div>
  );
}
