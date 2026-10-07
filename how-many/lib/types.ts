import type { GazeTrialData } from "./gaze";

export type Side = "left" | "right";
export type Difficulty = "easy" | "medium" | "hard";

/**
 * Stimulus conditions. V1 only implements "pure-numerosity".
 * Future conditions (area conflict, density conflict, dot size, grouping,
 * numerals, number words) are added here and registered in
 * lib/stimulusGenerator.ts (CONDITIONS).
 */
export type ConditionId = "pure-numerosity";

/** A single dot in stimulus-space coordinates (see STIMULUS in config). */
export interface Dot {
  x: number;
  y: number;
  r: number;
}

export interface TrialStimulus {
  left: Dot[];
  right: Dot[];
}

/** The planned (pre-response) description of one trial. */
export interface TrialSpec {
  trialNumber: number; // 1-based
  difficulty: Difficulty;
  leftNumerosity: number;
  rightNumerosity: number;
  ratio: number; // larger / smaller, 2 d.p.
  correctSide: Side;
  condition: ConditionId;
}

/** One recorded trial. */
export interface TrialRecord {
  sessionId: string;
  trialNumber: number;
  difficulty: Difficulty;
  leftNumerosity: number;
  rightNumerosity: number;
  ratio: number;
  correctSide: Side;
  selectedSide: Side;
  correct: boolean;
  responseTimeMs: number;
  timestamp: string; // ISO 8601, moment of response
  /** Diagnostic only: measured on-screen stimulus duration (frame-quantised). */
  stimulusMeasuredMs: number;
  /** Present only when the participant opted in to eye tracking. */
  gaze?: GazeTrialData;
}

export interface SessionSummary {
  sessionId: string;
  totalTrials: number;
  correct: number;
  accuracy: number; // 0..1
  averageResponseTimeMs: number;
  accuracyByDifficulty: Record<Difficulty, number | null>; // 0..1, null if no trials
  trialsByDifficulty: Record<Difficulty, number>;
}
