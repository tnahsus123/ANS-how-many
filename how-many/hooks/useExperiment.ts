"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { flushSync } from "react-dom";
import {
  FIXATION_DURATION,
  INTER_TRIAL_INTERVAL,
  STIMULUS_DURATION,
} from "../config/experiment";
import { summarizeSession } from "../lib/experiment";
import { createInitialState, experimentReducer } from "../lib/experimentReducer";
import { createSessionId } from "../lib/session";
import type { Side, TrialRecord, TrialSpec } from "../lib/types";

/**
 * requestAnimationFrame timestamps jitter by a fraction of a frame. Triggering
 * a frame early by this much stops a jittery frame from adding a whole extra
 * frame to a duration, at every common refresh rate (60–240 Hz).
 */
const FRAME_SLACK_MS = 4;

interface ResponseGate {
  open: boolean;
  responseStart: number;
  sessionId: string;
  trial: TrialSpec | null;
  stimulusMeasuredMs: number;
}

const closedGate = (): ResponseGate => ({
  open: false,
  responseStart: 0,
  sessionId: "",
  trial: null,
  stimulusMeasuredMs: 0,
});

/**
 * Owns the experiment: state machine, frame-locked timing and response capture.
 *
 * Timing design
 *  - Phase changes that matter (fixation→stimulus, stimulus→response) are made
 *    inside a requestAnimationFrame callback with flushSync, so the DOM change
 *    is committed before that frame is painted.
 *  - Stimulus onset is performance.now() right after that commit; the stimulus
 *    is removed on the first frame at/after onset + STIMULUS_DURATION (minus
 *    slack). Durations are therefore quantised to the display's frame interval.
 *  - The response timer starts (performance.now()) immediately after the commit
 *    that enables the buttons, and stops at the input event's own timestamp.
 *  - A synchronous `gate` (not React state) decides whether a response is
 *    accepted, so nothing can be recorded during fixation/stimulus and nothing
 *    can be recorded twice.
 */
export function useExperiment() {
  const [state, dispatch] = useReducer(experimentReducer, undefined, createInitialState);
  const gate = useRef<ResponseGate>(closedGate());

  // ── Trial runner: fixation → stimulus → response ───────────────────────────
  useEffect(() => {
    if (state.runId === 0 || state.sessionId === null) return;
    const trial = state.plan[state.trialIndex];
    const sessionId = state.sessionId;

    gate.current = closedGate();
    let cancelled = false;
    let raf = 0;
    let stage: "fixation" | "stimulus" = "fixation";
    let fixationStart = -1;
    let stimulusOnset = 0;

    // All clocks are performance.now() read right after a synchronous commit,
    // so durations are measured between the moments the DOM actually changed.
    const tick = () => {
      if (cancelled) return;
      const now = performance.now();
      if (fixationStart < 0) fixationStart = now;

      if (stage === "fixation") {
        if (now >= fixationStart + FIXATION_DURATION - FRAME_SLACK_MS) {
          stage = "stimulus";
          flushSync(() => dispatch({ type: "SHOW_STIMULUS" }));
          stimulusOnset = performance.now(); // ← dots are now in the DOM
        }
      } else if (now >= stimulusOnset + STIMULUS_DURATION - FRAME_SLACK_MS) {
        // Remove dots AND enable buttons in one synchronous commit.
        flushSync(() => dispatch({ type: "SHOW_RESPONSE" }));
        const responseStart = performance.now(); // ← buttons are now available
        gate.current = {
          open: true,
          responseStart,
          sessionId,
          trial,
          stimulusMeasuredMs: Math.round((responseStart - stimulusOnset) * 10) / 10,
        };
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // If the tab is hidden before the stimulus has been shown, rAF is throttled
    // and timings would be meaningless — restart the trial instead.
    const onVisibility = () => {
      if (document.hidden && !gate.current.open) {
        cancelled = true;
        cancelAnimationFrame(raf);
        dispatch({ type: "RESTART_TRIAL" });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      gate.current = closedGate();
    };
  }, [state.runId, state.sessionId, state.plan, state.trialIndex]);

  // ── Short transition after a response, then next trial / results ───────────
  useEffect(() => {
    if (state.phase !== "transition") return;
    const id = window.setTimeout(() => dispatch({ type: "NEXT" }), INTER_TRIAL_INTERVAL);
    return () => window.clearTimeout(id);
  }, [state.phase, state.trialIndex]);

  // ── Response capture ───────────────────────────────────────────────────────
  const respond = useCallback((side: Side, eventTime?: number) => {
    const g = gate.current;
    if (!g.open || !g.trial) return; // not accepting responses
    g.open = false; // close synchronously: blocks double clicks / key + click

    const now = performance.now();
    // Prefer the input event's own timestamp (same clock as performance.now()).
    const t =
      eventTime !== undefined && eventTime >= g.responseStart && eventTime <= now ? eventTime : now;

    const trial = g.trial;
    const record: TrialRecord = {
      sessionId: g.sessionId,
      trialNumber: trial.trialNumber,
      difficulty: trial.difficulty,
      leftNumerosity: trial.leftNumerosity,
      rightNumerosity: trial.rightNumerosity,
      ratio: trial.ratio,
      correctSide: trial.correctSide,
      selectedSide: side,
      correct: side === trial.correctSide,
      responseTimeMs: Math.round((t - g.responseStart) * 10) / 10,
      timestamp: new Date().toISOString(),
      stimulusMeasuredMs: g.stimulusMeasuredMs,
    };
    dispatch({ type: "RECORD", record });
  }, []);

  // ── Keyboard: ← / → only while the response gate is open ───────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (!gate.current.open) return;
      e.preventDefault();
      respond(e.key === "ArrowLeft" ? "left" : "right", e.timeStamp);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [respond]);

  /** Starts a brand-new session (also used by "Try again"). */
  const start = useCallback(() => {
    dispatch({ type: "START", sessionId: createSessionId() });
  }, []);

  const summary = useMemo(
    () =>
      state.phase === "results" && state.sessionId
        ? summarizeSession(state.sessionId, state.records)
        : null,
    [state.phase, state.sessionId, state.records],
  );

  return { state, start, respond, summary };
}
