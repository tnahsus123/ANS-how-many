import { DIFFICULTY_ORDER, EXPORT_TIMING_DIAGNOSTICS } from "../config/experiment";
import { midlineX } from "./gaze";
import type { SessionSummary, TrialRecord } from "./types";

const EOL = "\r\n"; // RFC 4180

export const TRIAL_CSV_COLUMNS = [
  "session_id",
  "trial",
  "difficulty",
  "left_numerosity",
  "right_numerosity",
  "ratio",
  "correct_side",
  "selected_side",
  "correct",
  "response_time_ms",
  "timestamp",
  ...(EXPORT_TIMING_DIAGNOSTICS ? ["stimulus_measured_ms"] : []),
] as const;

export const SUMMARY_CSV_COLUMNS = [
  "session_id",
  "total_trials",
  "correct",
  "accuracy",
  "average_response_time_ms",
  "easy_accuracy",
  "medium_accuracy",
  "hard_accuracy",
] as const;

function escapeCell(value: string | number | boolean | null): string {
  if (value === null) return "";
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(columns: readonly string[], rows: Array<Array<string | number | boolean | null>>): string {
  return [columns.join(","), ...rows.map((r) => r.map(escapeCell).join(","))].join(EOL) + EOL;
}

/** One row per trial. `correct` is 1/0; `response_time_ms` has 0.1 ms resolution. */
export function trialsToCsv(records: TrialRecord[]): string {
  const rows = records.map((r) => [
    r.sessionId,
    r.trialNumber,
    r.difficulty,
    r.leftNumerosity,
    r.rightNumerosity,
    r.ratio,
    r.correctSide,
    r.selectedSide,
    r.correct ? 1 : 0,
    r.responseTimeMs,
    r.timestamp,
    ...(EXPORT_TIMING_DIAGNOSTICS ? [r.stimulusMeasuredMs] : []),
  ]);
  return toCsv(TRIAL_CSV_COLUMNS, rows);
}

/** Accuracies are proportions in [0,1] (4 d.p.); blank if a difficulty had no trials. */
export function summaryToCsv(summary: SessionSummary): string {
  const acc = (v: number | null) => (v === null ? null : Math.round(v * 10000) / 10000);
  const [easy, medium, hard] = DIFFICULTY_ORDER.map((d) => acc(summary.accuracyByDifficulty[d]));
  return toCsv(SUMMARY_CSV_COLUMNS, [
    [
      summary.sessionId,
      summary.totalTrials,
      summary.correct,
      acc(summary.accuracy),
      Math.round(summary.averageResponseTimeMs * 10) / 10,
      easy,
      medium,
      hard,
    ],
  ]);
}

export const GAZE_TRIAL_CSV_COLUMNS = [
  "session_id", "trial", "response_time_ms", "calibration_error_px",
  "samples_total", "samples_stimulus", "samples_response", "sample_rate_hz", "lost_samples",
  "stim_left_ms", "stim_right_ms", "stim_prop_larger_side", "first_side_stimulus", "switches_stimulus",
  "path_length_stimulus_px", "path_length_response_px",
  "viewport_w", "viewport_h", "midline_x_px", "left_frame_x_px", "right_frame_x_px", "frame_y_px", "frame_w_px", "frame_h_px",
] as const;

export const GAZE_SAMPLE_CSV_COLUMNS = ["session_id", "trial", "phase", "t_ms", "x_px", "y_px"] as const;

/** One row per trial: movement metrics + geometry (blank where unavailable). */
export function gazeTrialsToCsv(records: TrialRecord[]): string {
  const rows = records.filter((r) => r.gaze).map((r) => {
    const g = r.gaze!;
    const m = g.metrics;
    const a = g.arena;
    return [
      r.sessionId, r.trialNumber, r.responseTimeMs, g.calibrationErrorPx,
      m.samplesTotal, m.samplesStimulus, m.samplesResponse, m.sampleRateHz, g.lostSamples,
      m.stimLeftMs, m.stimRightMs, m.stimPropLargerSide, m.firstSideStimulus, m.switchesStimulus,
      m.pathLengthStimulusPx, m.pathLengthResponsePx,
      a?.viewportWidth ?? null, a?.viewportHeight ?? null, a ? Math.round(midlineX(a) * 10) / 10 : null,
      a ? Math.round(a.leftFrame.x * 10) / 10 : null, a ? Math.round(a.rightFrame.x * 10) / 10 : null,
      a ? Math.round(a.leftFrame.y * 10) / 10 : null, a ? Math.round(a.leftFrame.width * 10) / 10 : null,
      a ? Math.round(a.leftFrame.height * 10) / 10 : null,
    ];
  });
  return toCsv(GAZE_TRIAL_CSV_COLUMNS, rows);
}

/** Raw samples, one row each. t_ms is relative to stimulus onset (negative = fixation). */
export function gazeSamplesToCsv(records: TrialRecord[]): string {
  const rows = records.flatMap((r) =>
    (r.gaze?.samples ?? []).map((s) => [r.sessionId, r.trialNumber, s.phase, s.t, s.x, s.y]),
  );
  return toCsv(GAZE_SAMPLE_CSV_COLUMNS, rows);
}

/** Browser-only: triggers a direct download, no network involved. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
