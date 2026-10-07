"use client";

import { DIFFICULTY_ORDER, TOTAL_TRIALS } from "@/config/experiment";
import { downloadCsv, gazeSamplesToCsv, gazeTrialsToCsv, summaryToCsv, trialsToCsv } from "@/lib/csvExport";
import type { Difficulty, SessionSummary, TrialRecord } from "@/lib/types";

interface ResultsScreenProps {
  sessionId: string;
  records: TrialRecord[];
  summary: SessionSummary;
  onRestart: () => void;
}

const LABELS: Record<Difficulty, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };
const SEGMENTS = 10;

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-paper px-5 py-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-mute">{label}</p>
      <p className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">{value}</p>
    </div>
  );
}

function BlockBar({ value }: { value: number | null }) {
  const filled = value === null ? 0 : Math.round(value * SEGMENTS);
  return (
    <div
      className="grid flex-1 gap-[3px]"
      style={{ gridTemplateColumns: `repeat(${SEGMENTS}, minmax(0, 1fr))` }}
      role="img"
      aria-label={`${pct(value)} correct`}
    >
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <span key={i} className={`h-4 sm:h-5 ${i < filled ? "bg-ink" : "border border-line bg-paper"}`} />
      ))}
    </div>
  );
}

export default function ResultsScreen({ sessionId, records, summary, onRestart }: ResultsScreenProps) {
  const gazeRecords = records.filter((r) => r.gaze);
  const hasGaze = gazeRecords.length > 0;
  const mean = (vals: number[]) => (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null);
  const avgPath = mean(gazeRecords.map((r) => r.gaze!.metrics.pathLengthStimulusPx));
  const avgLarger = mean(
    gazeRecords.map((r) => r.gaze!.metrics.stimPropLargerSide).filter((v): v is number => v !== null),
  );
  const avgSwitches = mean(
    gazeRecords.map((r) => r.gaze!.metrics.switchesStimulus).filter((v): v is number => v !== null),
  );
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-5 py-10 sm:px-8 sm:py-16">
      <div className="motion-safe:animate-rise">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-mute">Experiment complete</p>
        <h2 className="mt-4 text-5xl font-black leading-none tracking-tighter sm:text-7xl">How did you do?</h2>

        <div className="mt-10 grid gap-px border border-line bg-line sm:grid-cols-3">
          <Stat label="Accuracy" value={pct(summary.accuracy)} />
          <Stat label="Correct" value={`${summary.correct} / ${TOTAL_TRIALS}`} />
          <Stat label="Average response time" value={`${(summary.averageResponseTimeMs / 1000).toFixed(2)} s`} />
        </div>

        <section className="mt-10" aria-labelledby="by-difficulty">
          <h3 id="by-difficulty" className="font-mono text-xs uppercase tracking-[0.2em] text-mute">
            Accuracy by difficulty
          </h3>
          <ul className="mt-4 space-y-3">
            {DIFFICULTY_ORDER.map((d) => (
              <li key={d} className="flex items-center gap-4">
                <span className="w-16 shrink-0 text-sm font-semibold sm:w-20 sm:text-base">{LABELS[d]}</span>
                <BlockBar value={summary.accuracyByDifficulty[d]} />
                <span className="w-12 shrink-0 text-right font-mono text-sm tabular-nums">
                  {pct(summary.accuracyByDifficulty[d])}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {hasGaze && (
          <section className="mt-10" aria-labelledby="gaze-heading">
            <h3 id="gaze-heading" className="font-mono text-xs uppercase tracking-[0.2em] text-mute">
              Eye movement (experimental)
            </h3>
            <dl className="mt-4 grid gap-px border border-line bg-line sm:grid-cols-3">
              {[
                ["Avg gaze path while dots shown", avgPath === null ? "—" : `${Math.round(avgPath)} px`],
                ["Time on the larger side", avgLarger === null ? "—" : `${Math.round(avgLarger * 100)}%`],
                ["Left↔right switches / trial", avgSwitches === null ? "—" : avgSwitches.toFixed(1)],
              ].map(([k, v]) => (
                <div key={k} className="bg-paper px-5 py-4">
                  <dt className="text-xs text-mute">{k}</dt>
                  <dd className="mt-1 text-2xl font-black tracking-tight">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-xs text-mute">Webcam gaze is approximate; treat these as rough indicators.</p>
          </section>
        )}

        <div className="mt-10 max-w-xl space-y-4 border-l-2 border-ink pl-5 leading-relaxed">
          <p className="font-medium">
            Your result reflects performance on this particular task, not general intelligence.
          </p>
          <p className="text-mute">
            Humans can estimate quantities surprisingly quickly without explicitly counting. As
            quantities become closer together, distinguishing them tends to become harder.
          </p>
        </div>

        <div className="mt-12 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={() => downloadCsv(`how-many_trials_${sessionId}.csv`, trialsToCsv(records))}
            className="inline-flex min-h-[56px] items-center justify-center bg-ink px-8 text-base font-semibold tracking-wide text-paper transition-colors hover:bg-accent"
          >
            Download trial data (.CSV)
          </button>
          <button
            type="button"
            onClick={() => downloadCsv(`how-many_summary_${sessionId}.csv`, summaryToCsv(summary))}
            className="inline-flex min-h-[56px] items-center justify-center border border-ink px-8 text-base font-semibold tracking-wide transition-colors hover:bg-ink hover:text-paper"
          >
            Download summary (.CSV)
          </button>
          {hasGaze && (
            <>
              <button
                type="button"
                onClick={() => downloadCsv(`how-many_gaze-trials_${sessionId}.csv`, gazeTrialsToCsv(records))}
                className="inline-flex min-h-[56px] items-center justify-center border border-ink px-8 text-base font-semibold tracking-wide transition-colors hover:bg-ink hover:text-paper"
              >
                Download gaze metrics (.CSV)
              </button>
              <button
                type="button"
                onClick={() => downloadCsv(`how-many_gaze-samples_${sessionId}.csv`, gazeSamplesToCsv(records))}
                className="inline-flex min-h-[56px] items-center justify-center border border-ink px-8 text-base font-semibold tracking-wide transition-colors hover:bg-ink hover:text-paper"
              >
                Download raw gaze (.CSV)
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onRestart}
            className="inline-flex min-h-[56px] items-center justify-center px-6 text-base font-semibold tracking-wide underline underline-offset-4 hover:text-accent"
          >
            Try again
          </button>
        </div>

        <p className="mt-8 font-mono text-xs text-mute">
          Anonymous session {sessionId} · Data stays in your browser unless you download it.
        </p>
      </div>
    </div>
  );
}
