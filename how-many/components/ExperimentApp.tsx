"use client";

import { useEffect, useState } from "react";
import { useExperiment } from "@/hooks/useExperiment";
import { GazeController } from "@/lib/gazeController";
import type { GazeProviderFactory } from "@/lib/gazeProvider";
import { createWebGazerProvider } from "@/lib/gazeProviders/webgazer";
import CalibrationScreen from "./CalibrationScreen";
import IntroScreen from "./IntroScreen";
import ResultsScreen from "./ResultsScreen";
import TrialScreen from "./TrialScreen";

interface ExperimentAppProps {
  /** Override the gaze source (used for testing with a mock). */
  gazeProviderFactory?: GazeProviderFactory;
}

export default function ExperimentApp({ gazeProviderFactory = createWebGazerProvider }: ExperimentAppProps) {
  const [gaze, setGaze] = useState<GazeController | null>(null);
  const [calibrating, setCalibrating] = useState(false);
  const { state, start, respond, summary } = useExperiment(gaze);

  // Release the camera on unmount.
  useEffect(() => () => gaze?.stop(), [gaze]);

  if (state.phase === "intro") {
    if (calibrating && gaze) {
      return (
        <CalibrationScreen
          controller={gaze}
          onDone={() => {
            setCalibrating(false);
            start();
          }}
          onSkip={() => {
            gaze.stop();
            setGaze(null);
            setCalibrating(false);
            start();
          }}
        />
      );
    }
    return (
      <IntroScreen
        onStart={({ eyeTracking }) => {
          if (eyeTracking) {
            setGaze(new GazeController(gazeProviderFactory));
            setCalibrating(true);
          } else {
            start();
          }
        }}
      />
    );
  }

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
