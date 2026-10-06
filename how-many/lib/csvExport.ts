import { DIFFICULTY_ORDER, EXPORT_TIMING_DIAGNOSTICS } from "../config/experiment";
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
