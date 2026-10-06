"use client";

import { useExperiment } from "@/hooks/useExperiment";
import IntroScreen from "./IntroScreen";
import ResultsScreen from "./ResultsScreen";
import TrialScreen from "./TrialScreen";

export default function ExperimentApp() {
  const { state, start, respond, summary } = useExperiment();

  if (state.phase === "intro") return <IntroScreen onStart={start} />;

  if (state.phase === "results" && summary && state.sessionId) {
    return (
      <ResultsScreen
        sessionId={state.sessionId}
        records={state.records}
        summary={summary}
        onRestart={start}
      />
    );
  }

  return <TrialScreen state={state} onRespond={respond} />;
}
