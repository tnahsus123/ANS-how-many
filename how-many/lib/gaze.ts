import type { Side } from "./types";

export type GazePhase = "fixation" | "stimulus" | "response";

/** One gaze estimate. `t` is ms relative to stimulus onset (negative during fixation). */
export interface GazeSample {
  t: number;
  x: number; // viewport px
  y: number;
  phase: GazePhase;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Geometry captured at stimulus onset (viewport px), needed to interpret gaze. */
export interface ArenaGeometry {
  viewportWidth: number;
  viewportHeight: number;
  leftFrame: Rect;
  rightFrame: Rect;
}

export interface GazeTrialMetrics {
  samplesTotal: number;
  samplesStimulus: number;
  samplesResponse: number;
  /** Mean effective sampling rate during the stimulus window. */
  sampleRateHz: number | null;
  stimLeftMs: number | null;
  stimRightMs: number | null;
  /** Share of (covered) stimulus time spent on the side with MORE dots. */
  stimPropLargerSide: number | null;
  firstSideStimulus: Side | null;
  /** Number of left↔right midline crossings during the stimulus. */
  switchesStimulus: number | null;
  /** Total gaze path length (px) while dots were visible. */
  pathLengthStimulusPx: number;
  /** Total gaze path length (px) from dots disappearing until the answer. */
  pathLengthResponsePx: number;
}

export interface GazeTrialData {
  samples: GazeSample[];
  metrics: GazeTrialMetrics;
  arena: ArenaGeometry | null;
  lostSamples: number; // face not found
  calibrationErrorPx: number | null;
}

const round = (v: number, dp = 1) => Math.round(v * 10 ** dp) / 10 ** dp;

export function midlineX(arena: ArenaGeometry): number {
  return (arena.leftFrame.x + arena.leftFrame.width + arena.rightFrame.x) / 2;
}

function pathLength(samples: GazeSample[]): number {
  let total = 0;
  for (let i = 1; i < samples.length; i++) {
    total += Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y);
  }
  return total;
}

/**
 * Pure function: samples + geometry → per-trial movement metrics.
 *  - sides are decided by the midline between the two stimulus frames
 *  - dwell time is time-weighted (each sample holds until the next one, the last
 *    until `stimulusEndT`), so uneven webcam sampling doesn't bias it
 *  - `stimulusEndT` is the stimulus duration in ms (t of dots disappearing)
 */
export function computeGazeMetrics(
  samples: GazeSample[],
  arena: ArenaGeometry | null,
  correctSide: Side,
  stimulusEndT: number,
): GazeTrialMetrics {
  const sorted = samples.slice().sort((a, b) => a.t - b.t);
  const stim = sorted.filter((s) => s.phase === "stimulus");
  const resp = sorted.filter((s) => s.phase === "response");

  let left: number | null = null;
  let right: number | null = null;
  let first: Side | null = null;
  let switches: number | null = null;

  if (arena && stim.length > 0) {
    const mid = midlineX(arena);
    const sideOf = (x: number): Side => (x < mid ? "left" : "right");
    left = 0;
    right = 0;
    switches = 0;
    first = sideOf(stim[0].x);
    stim.forEach((s, i) => {
      const end = i + 1 < stim.length ? stim[i + 1].t : Math.max(stimulusEndT, s.t);
      const dur = Math.max(0, end - s.t);
      if (sideOf(s.x) === "left") left! += dur;
      else right! += dur;
      if (i > 0 && sideOf(s.x) !== sideOf(stim[i - 1].x)) switches! += 1;
    });
  }

  const covered = left !== null && right !== null ? left + right : 0;
  const larger = correctSide === "left" ? left : right;

  return {
    samplesTotal: sorted.length,
    samplesStimulus: stim.length,
    samplesResponse: resp.length,
    sampleRateHz:
      stim.length > 1 && stim[stim.length - 1].t > stim[0].t
        ? round(((stim.length - 1) / (stim[stim.length - 1].t - stim[0].t)) * 1000)
        : null,
    stimLeftMs: left === null ? null : round(left),
    stimRightMs: right === null ? null : round(right),
    stimPropLargerSide: larger !== null && covered > 0 ? round(larger / covered, 3) : null,
    firstSideStimulus: first,
    switchesStimulus: switches,
    pathLengthStimulusPx: round(pathLength(stim)),
    pathLengthResponsePx: round(pathLength(resp)),
  };
}
