import { TOTAL_TRIALS } from "../config/experiment";
import { buildTrialPlan } from "./experiment";
import { generateTrialStimulus } from "./stimulusGenerator";
import type { Side, TrialRecord, TrialSpec, TrialStimulus } from "./types";

/**
 * INTRO → FIXATION → STIMULUS → RESPONSE → (TRANSITION) → next trial … → RESULTS
 * TRANSITION is the very short blank gap after a response.
 */
export type Phase = "intro" | "fixation" | "stimulus" | "response" | "transition" | "results";

export interface ExperimentState {
  phase: Phase;
  sessionId: string | null;
  plan: TrialSpec[];
  trialIndex: number; // 0-based
  /** >0 only if the current trial had to be restarted (tab hidden mid-trial). */
  attempt: number;
  /** Bumps whenever a trial (re)starts; drives the timing effect. 0 = no trial yet. */
  runId: number;
  stimulus: TrialStimulus | null;
  records: TrialRecord[];
  selectedSide: Side | null;
}

export type ExperimentAction =
  | { type: "START"; sessionId: string }
  | { type: "SHOW_STIMULUS" }
  | { type: "SHOW_RESPONSE" }
  | { type: "RECORD"; record: TrialRecord }
  | { type: "NEXT" }
  | { type: "RESTART_TRIAL" };

export function createInitialState(): ExperimentState {
  return {
    phase: "intro",
    sessionId: null,
    plan: [],
    trialIndex: 0,
    attempt: 0,
    runId: 0,
    stimulus: null,
    records: [],
    selectedSide: null,
  };
}

/**
 * Every transition is guarded by the phase it is legal from, so duplicate or
 * late dispatches (double clicks, stale timers) are ignored rather than
 * recorded twice.
 */
export function experimentReducer(state: ExperimentState, action: ExperimentAction): ExperimentState {
  switch (action.type) {
    case "START": {
      if (state.phase !== "intro" && state.phase !== "results") return state;
      const plan = buildTrialPlan(action.sessionId);
      return {
        // A fresh object: nothing from a previous session can leak in.
        ...createInitialState(),
        phase: "fixation",
        sessionId: action.sessionId,
        plan,
        runId: state.runId + 1,
        stimulus: generateTrialStimulus(plan[0], action.sessionId, 0),
      };
    }

    case "SHOW_STIMULUS":
      return state.phase === "fixation" ? { ...state, phase: "stimulus" } : state;

    case "SHOW_RESPONSE":
      // Dots are removed in the same commit that enables the response buttons.
      return state.phase === "stimulus" ? { ...state, phase: "response", stimulus: null } : state;

    case "RECORD": {
      if (state.phase !== "response") return state;
      if (state.records.length !== state.trialIndex) return state; // already recorded
      return {
        ...state,
        phase: "transition",
        selectedSide: action.record.selectedSide,
        records: [...state.records, action.record],
      };
    }

    case "NEXT": {
      if (state.phase !== "transition" || state.sessionId === null) return state;
      const nextIndex = state.trialIndex + 1;
      if (nextIndex >= TOTAL_TRIALS || nextIndex >= state.plan.length) {
        return { ...state, phase: "results", selectedSide: null, stimulus: null };
      }
      return {
        ...state,
        phase: "fixation",
        trialIndex: nextIndex,
        attempt: 0,
        runId: state.runId + 1,
        selectedSide: null,
        stimulus: generateTrialStimulus(state.plan[nextIndex], state.sessionId, 0),
      };
    }

    case "RESTART_TRIAL": {
      if ((state.phase !== "fixation" && state.phase !== "stimulus") || state.sessionId === null) return state;
      const attempt = state.attempt + 1;
      return {
        ...state,
        phase: "fixation",
        attempt,
        runId: state.runId + 1,
        stimulus: generateTrialStimulus(state.plan[state.trialIndex], state.sessionId, attempt),
      };
    }

    default:
      return state;
  }
}
