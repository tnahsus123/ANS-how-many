/**
 * HOW MANY? — single source of truth for experiment parameters.
 * Change the experiment here; nothing else should hard-code these values.
 */
import type { ConditionId, Difficulty } from "../lib/types";

// ── Trial structure ──────────────────────────────────────────────────────────
export const TOTAL_TRIALS = 20;

/** Trials per difficulty. Must sum to TOTAL_TRIALS. */
export const DIFFICULTY_TRIAL_COUNTS: Record<Difficulty, number> = {
  easy: 7,
  medium: 7,
  hard: 6,
};

export const DIFFICULTY_ORDER: readonly Difficulty[] = ["easy", "medium", "hard"];

// ── Timing (milliseconds) ────────────────────────────────────────────────────
export const FIXATION_DURATION = 500;
export const STIMULUS_DURATION = 1000;
/** Short blank gap between a response and the next fixation. */
export const INTER_TRIAL_INTERVAL = 200;

// ── Numerosity ───────────────────────────────────────────────────────────────
export const MIN_NUMEROSITY = 5;
export const MAX_NUMEROSITY = 20;

/** Nominal larger:smaller ratio per difficulty. */
export const DIFFICULTY_RATIOS: Record<Difficulty, number> = {
  easy: 2,
  medium: 1.5,
  hard: 1.25,
};

/** How far a pool pair's ratio may drift from nominal (checked by `npm run verify`). */
export const DIFFICULTY_RATIO_TOLERANCE: Record<Difficulty, number> = {
  easy: 0.2,
  medium: 0.1,
  hard: 0.1,
};

/**
 * Predefined, balanced pool of [smaller, larger] pairs per difficulty.
 * Pool size per difficulty equals its trial count, so every participant sees
 * the same set of numerosity pairs (only order, sides and dot layout vary).
 * If a pool is larger than its trial count, a random subset is drawn.
 */
export const TRIAL_POOL: Record<Difficulty, ReadonlyArray<readonly [number, number]>> = {
  easy: [
    [5, 10],
    [6, 12],
    [7, 14],
    [8, 16],
    [9, 18],
    [10, 20],
    [6, 11],
  ],
  medium: [
    [6, 9],
    [8, 12],
    [10, 15],
    [12, 18],
    [9, 14],
    [11, 17],
    [13, 20],
  ],
  hard: [
    [8, 10],
    [10, 12],
    [12, 15],
    [16, 20],
    [13, 16],
    [15, 19],
  ],
};

// ── Order constraints ────────────────────────────────────────────────────────
/** Max consecutive trials whose correct answer is on the same side. */
export const MAX_SAME_SIDE_RUN = 3;
/** Max consecutive trials of the same difficulty. */
export const MAX_SAME_DIFFICULTY_RUN = 3;

// ── Stimulus geometry ────────────────────────────────────────────────────────
/**
 * Each side is an identical rectangular field. Geometry is expressed in
 * abstract units and scaled by SVG, so relative layout is identical on every
 * device (only physical size changes with the screen).
 */
export const STIMULUS = {
  width: 400,
  height: 480,
  /** Mean dot radius. The mean radius of every field is normalised to this. */
  baseRadius: 9,
  /** Per-dot radius variation (±fraction of baseRadius). */
  radiusJitter: 0.15,
  /** Minimum clear gap between dot edges. */
  minGap: 8,
  /** Minimum clear gap between a dot edge and the field border. */
  edgePadding: 6,
  /** Candidate positions evaluated per dot (best-candidate sampling → even spread). */
  candidatesPerDot: 12,
} as const;

/** Active stimulus condition (V1: pure numerosity only). */
export const ACTIVE_CONDITION: ConditionId = "pure-numerosity";

// ── Export ───────────────────────────────────────────────────────────────────
/**
 * When true, the trial CSV gains an extra `stimulus_measured_ms` column
 * (measured on-screen stimulus duration). Off by default so the CSV contains
 * exactly the specified columns.
 */
export const EXPORT_TIMING_DIAGNOSTICS = false;

// ── Eye tracking (optional, opt-in, webcam via WebGazer.js) ──────────────────
/** Show the "Enable eye tracking" opt-in on the intro screen. */
export const EYE_TRACKING_OPTION = true;
/** Clicks required on each calibration point (WebGazer learns from clicks). */
export const CALIBRATION_CLICKS_PER_POINT = 5;
/**
 * By default WebGazer fetches its face-landmark model files from a CDN, which
 * is an external request. To keep everything first-party, host the MediaPipe
 * face_mesh files under /public and set this to e.g. "/mediapipe/face_mesh".
 */
export const WEBGAZER_FACEMESH_PATH: string | null = null;
