"use client";

import { useCallback, useEffect, useState } from "react";
import { CALIBRATION_CLICKS_PER_POINT } from "@/config/experiment";
import type { GazeController } from "@/lib/gazeController";

interface CalibrationScreenProps {
  controller: GazeController;
  onDone: () => void;
  onSkip: () => void;
}

type Stage = "init" | "error" | "calibrate" | "validate" | "result";

// Positions as % of the viewport.
const CAL_POINTS: ReadonlyArray<readonly [number, number]> = [
  [8, 10], [50, 10], [92, 10], [8, 50], [50, 50], [92, 50], [8, 90], [50, 90], [92, 90],
];
const VAL_POINTS: ReadonlyArray<readonly [number, number]> = [
  [50, 50], [20, 22], [80, 22], [20, 78], [80, 78],
];

export default function CalibrationScreen({ controller, onDone, onSkip }: CalibrationScreenProps) {
  const [stage, setStage] = useState<Stage>("init");
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);
  const [clicks, setClicks] = useState(0);
  const [valIndex, setValIndex] = useState(0);
  const [errorPx, setErrorPx] = useState<number | null>(null);

  const begin = useCallback(() => {
    setStage("init");
    controller
      .start()
      .then(() => {
        controller.setTraining(true);
        controller.showPreview(true);
        setIndex(0);
        setClicks(0);
        setStage("calibrate");
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Could not start the camera.");
        setStage("error");
      });
  }, [controller]);

  useEffect(() => {
    begin();
  }, [begin]);

  const clickPoint = () => {
    const n = clicks + 1;
    if (n < CALIBRATION_CLICKS_PER_POINT) return setClicks(n);
    setClicks(0);
    if (index + 1 < CAL_POINTS.length) return setIndex(index + 1);
    controller.setTraining(false); // freeze the model: trial clicks must not train it
    controller.showPreview(false);
    setValIndex(0);
    setStage("validate");
  };

  // Validation: look at each target without clicking; measure mean offset.
  useEffect(() => {
    if (stage !== "validate") return;
    let cancelled = false;
    (async () => {
      const offsets: number[] = [];
      for (let i = 0; i < VAL_POINTS.length; i++) {
        if (cancelled) return;
        setValIndex(i);
        await new Promise((r) => setTimeout(r, 800)); // let the eyes settle
        const tx = (VAL_POINTS[i][0] / 100) * window.innerWidth;
        const ty = (VAL_POINTS[i][1] / 100) * window.innerHeight;
        const got = await controller.collect(1200);
        if (got.length) {
          const mx = got.reduce((s, g) => s + g.x, 0) / got.length;
          const my = got.reduce((s, g) => s + g.y, 0) / got.length;
          offsets.push(Math.hypot(mx - tx, my - ty));
        }
      }
      if (cancelled) return;
      const mean = offsets.length ? offsets.reduce((s, v) => s + v, 0) / offsets.length : null;
      controller.calibrationErrorPx = mean === null ? null : Math.round(mean);
      setErrorPx(controller.calibrationErrorPx);
      setStage("result");
    })();
    return () => {
      cancelled = true;
    };
  }, [stage, controller]);

  const recalibrate = () => {
    controller.clearTraining();
    controller.setTraining(true);
    controller.showPreview(true);
    setIndex(0);
    setClicks(0);
    setStage("calibrate");
  };

  const dot = (p: readonly [number, number], extra = "") => (
    <span
      className={`absolute -translate-x-1/2 -translate-y-1/2 ${extra}`}
      style={{ left: `${p[0]}%`, top: `${p[1]}%` }}
    />
  );

  if (stage === "calibrate") {
    return (
      <div className="fixed inset-0 z-20 bg-paper" data-testid="calibration">
        <p className="absolute left-1/2 top-3 w-[80%] -translate-x-1/2 text-center text-sm text-mute">
          Look at the dot and click it {CALIBRATION_CLICKS_PER_POINT} times. Keep your head still.
        </p>
        <button
          type="button"
          data-testid="cal-point"
          onClick={clickPoint}
          aria-label={`Calibration point ${index + 1} of ${CAL_POINTS.length}, click ${clicks + 1} of ${CALIBRATION_CLICKS_PER_POINT}`}
          className="absolute flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-ink"
          style={{ left: `${CAL_POINTS[index][0]}%`, top: `${CAL_POINTS[index][1]}%`, opacity: 0.35 + (0.65 * clicks) / CALIBRATION_CLICKS_PER_POINT }}
        >
          <span className="h-3 w-3 rounded-full bg-ink" />
        </button>
        <p className="absolute bottom-3 left-1/2 -translate-x-1/2 font-mono text-xs text-mute">
          Point {index + 1} / {CAL_POINTS.length}
        </p>
      </div>
    );
  }

  if (stage === "validate") {
    return (
      <div className="fixed inset-0 z-20 bg-paper" data-testid="validation">
        <p className="absolute left-1/2 top-3 w-[80%] -translate-x-1/2 text-center text-sm text-mute">
          Now just look at each dot. Don&apos;t click.
        </p>
        {dot(VAL_POINTS[valIndex], "h-4 w-4 rounded-full bg-accent")}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-5 py-12">
      {stage === "init" && <p className="text-mute">Starting camera… please allow access when asked.</p>}

      {stage === "error" && (
        <>
          <h2 className="text-2xl font-black tracking-tight">Eye tracking unavailable</h2>
          <p className="mt-3 text-mute">{error} You can continue without eye tracking.</p>
        </>
      )}

      {stage === "result" && (
        <>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-mute">Calibration finished</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight">
            {errorPx === null ? "No gaze detected" : `Estimated error ≈ ${errorPx} px`}
          </h2>
          <p className="mt-3 text-mute">
            Webcam eye tracking is coarse. Distinguishing left from right works best when the error is well under
            a quarter of the screen width. Recalibrate if your face was off-camera or the room was dark.
          </p>
        </>
      )}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        {stage === "result" && (
          <>
            <button type="button" onClick={onDone} className="min-h-[56px] bg-ink px-8 font-semibold text-paper hover:bg-accent">
              Continue to experiment
            </button>
            <button type="button" onClick={recalibrate} className="min-h-[56px] border border-ink px-8 font-semibold hover:bg-ink hover:text-paper">
              Recalibrate
            </button>
          </>
        )}
        {stage === "error" && (
          <button type="button" onClick={begin} className="min-h-[56px] border border-ink px-8 font-semibold hover:bg-ink hover:text-paper">
            Try again
          </button>
        )}
        {(stage === "error" || stage === "result" || stage === "init") && (
          <button type="button" onClick={onSkip} className="min-h-[56px] px-6 font-semibold underline underline-offset-4 hover:text-accent">
            Continue without eye tracking
          </button>
        )}
      </div>
    </div>
  );
}
