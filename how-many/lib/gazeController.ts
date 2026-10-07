import { computeGazeMetrics, type ArenaGeometry, type GazePhase, type GazeSample, type GazeTrialData } from "./gaze";
import type { GazeProvider, GazeProviderFactory } from "./gazeProvider";
import type { Side } from "./types";

export type GazeStatus = "idle" | "starting" | "ready" | "error";

interface RawSample {
  abs: number;
  x: number;
  y: number;
  phase: GazePhase;
}

/**
 * Framework-agnostic gaze recorder. The experiment hook only tells it WHEN
 * things happen (trial start, stimulus onset, response start, trial end);
 * all timestamps are performance.now() so they share a clock with RT.
 */
export class GazeController {
  status: GazeStatus = "idle";
  calibrationErrorPx: number | null = null;

  private provider: GazeProvider | null = null;
  private starting: Promise<void> | null = null;
  private samples: RawSample[] = [];
  private lost = 0;
  private phase: GazePhase = "fixation";
  private trialActive = false;
  private onset: number | null = null;
  private responseAt: number | null = null;
  private arena: ArenaGeometry | null = null;
  private collectors = new Set<(s: { x: number; y: number }) => void>();

  constructor(private readonly factory: GazeProviderFactory) {}

  start(): Promise<void> {
    if (!this.starting) {
      this.status = "starting";
      this.starting = (async () => {
        try {
          this.provider = await this.factory();
          await this.provider.start(this.handleSample);
          this.status = "ready";
        } catch (e) {
          this.status = "error";
          this.starting = null;
          throw e;
        }
      })();
    }
    return this.starting;
  }

  stop(): void {
    this.provider?.stop();
    this.provider = null;
    this.starting = null;
    this.status = "idle";
    this.trialActive = false;
  }

  // ── calibration helpers ────────────────────────────────────────────────────
  showPreview(show: boolean) {
    this.provider?.showPreview(show);
  }
  setTraining(on: boolean) {
    this.provider?.setTraining(on);
  }
  clearTraining() {
    this.provider?.clearTraining();
    this.calibrationErrorPx = null;
  }
  /** Resolves with every gaze estimate received during the next `ms`. */
  collect(ms: number): Promise<Array<{ x: number; y: number }>> {
    return new Promise((resolve) => {
      const got: Array<{ x: number; y: number }> = [];
      const fn = (s: { x: number; y: number }) => got.push(s);
      this.collectors.add(fn);
      window.setTimeout(() => {
        this.collectors.delete(fn);
        resolve(got);
      }, ms);
    });
  }

  // ── trial lifecycle (called by useExperiment) ──────────────────────────────
  beginTrial(): void {
    this.samples = [];
    this.lost = 0;
    this.phase = "fixation";
    this.onset = null;
    this.responseAt = null;
    this.arena = null;
    this.trialActive = true;
  }

  markStimulusOnset(now: number): void {
    this.phase = "stimulus";
    this.onset = now;
    this.arena = captureArena();
  }

  markResponseStart(now: number): void {
    this.phase = "response";
    this.responseAt = now;
  }

  /** Stops recording and returns this trial's gaze data. */
  endTrial(correctSide: Side): GazeTrialData {
    this.trialActive = false;
    const origin = this.onset ?? this.samples[0]?.abs ?? 0;
    const samples: GazeSample[] = this.samples.map((s) => ({
      t: Math.round((s.abs - origin) * 10) / 10,
      x: Math.round(s.x * 10) / 10,
      y: Math.round(s.y * 10) / 10,
      phase: s.phase,
    }));
    const stimulusEnd = this.responseAt !== null ? this.responseAt - origin : 0;
    return {
      samples,
      metrics: computeGazeMetrics(samples, this.arena, correctSide, stimulusEnd),
      arena: this.arena,
      lostSamples: this.lost,
      calibrationErrorPx: this.calibrationErrorPx,
    };
  }

  private handleSample = (s: { x: number; y: number } | null, abs: number) => {
    if (!s) {
      if (this.trialActive) this.lost++;
      return;
    }
    this.collectors.forEach((c) => c(s));
    if (this.trialActive) this.samples.push({ abs, x: s.x, y: s.y, phase: this.phase });
  };
}

function captureArena(): ArenaGeometry | null {
  const l = document.querySelector('[data-testid="frame-left"]')?.getBoundingClientRect();
  const r = document.querySelector('[data-testid="frame-right"]')?.getBoundingClientRect();
  if (!l || !r) return null;
  const rect = (b: DOMRect) => ({ x: b.x, y: b.y, width: b.width, height: b.height });
  return {
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    leftFrame: rect(l),
    rightFrame: rect(r),
  };
}
