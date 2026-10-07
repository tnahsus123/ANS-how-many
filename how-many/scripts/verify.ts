/**
 * Logic verification for the experiment (no browser needed).
 *   npm run verify
 */
import assert from "node:assert/strict";
import {
  DIFFICULTY_RATIOS,
  DIFFICULTY_RATIO_TOLERANCE,
  DIFFICULTY_ORDER,
  DIFFICULTY_TRIAL_COUNTS,
  MAX_NUMEROSITY,
  MAX_SAME_DIFFICULTY_RUN,
  MAX_SAME_SIDE_RUN,
  MIN_NUMEROSITY,
  TOTAL_TRIALS,
  TRIAL_POOL,
} from "../config/experiment";
import { SUMMARY_CSV_COLUMNS, summaryToCsv, TRIAL_CSV_COLUMNS, trialsToCsv } from "../lib/csvExport";
import { buildTrialPlan, summarizeSession } from "../lib/experiment";
import { createInitialState, experimentReducer, type ExperimentState } from "../lib/experimentReducer";
import { createRng } from "../lib/rng";
import { createSessionId } from "../lib/session";
import { generateDotField, generateTrialStimulus, validateDotField } from "../lib/stimulusGenerator";
import type { TrialRecord } from "../lib/types";

let passed = 0;
const ok = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
};

console.log("Config");
ok("difficulty counts sum to TOTAL_TRIALS (7/7/6 = 20)", () => {
  const sum = DIFFICULTY_ORDER.reduce((s, d) => s + DIFFICULTY_TRIAL_COUNTS[d], 0);
  assert.equal(sum, TOTAL_TRIALS);
  assert.deepEqual(DIFFICULTY_TRIAL_COUNTS, { easy: 7, medium: 7, hard: 6 });
});
ok("pool pairs: within 5–20, larger > smaller, ratio near nominal", () => {
  for (const d of DIFFICULTY_ORDER) {
    for (const [a, b] of TRIAL_POOL[d]) {
      assert.ok(a >= MIN_NUMEROSITY && b <= MAX_NUMEROSITY, `${d} ${a}/${b} out of range`);
      assert.ok(b > a, `${d} ${a}/${b} equal or inverted`);
      assert.ok(Math.abs(b / a - DIFFICULTY_RATIOS[d]) <= DIFFICULTY_RATIO_TOLERANCE[d], `${d} ${a}/${b} ratio ${b / a}`);
    }
  }
});

console.log("Trial plan (2000 simulated sessions)");
const N = 2000;
const sideTotals = { left: 0, right: 0 };
let allExact10 = true;
for (let i = 0; i < N; i++) {
  const id = createSessionId();
  const plan = buildTrialPlan(id);
  assert.equal(plan.length, TOTAL_TRIALS);
  assert.deepEqual(plan.map((t) => t.trialNumber), Array.from({ length: 20 }, (_, k) => k + 1));
  for (const d of DIFFICULTY_ORDER) {
    const subset = plan.filter((t) => t.difficulty === d);
    assert.equal(subset.length, DIFFICULTY_TRIAL_COUNTS[d]);
    const l = subset.filter((t) => t.correctSide === "left").length;
    assert.ok(Math.abs(l - (subset.length - l)) <= 1, `${d} unbalanced`);
  }
  const left = plan.filter((t) => t.correctSide === "left").length;
  if (left !== 10) allExact10 = false;
  sideTotals.left += left;
  sideTotals.right += 20 - left;
  let sRun = 1, dRun = 1;
  for (let k = 1; k < plan.length; k++) {
    sRun = plan[k].correctSide === plan[k - 1].correctSide ? sRun + 1 : 1;
    dRun = plan[k].difficulty === plan[k - 1].difficulty ? dRun + 1 : 1;
    assert.ok(sRun <= MAX_SAME_SIDE_RUN && dRun <= MAX_SAME_DIFFICULTY_RUN, "run constraint violated");
  }
  for (const t of plan) {
    assert.notEqual(t.leftNumerosity, t.rightNumerosity);
    const larger = Math.max(t.leftNumerosity, t.rightNumerosity);
    assert.equal(t.correctSide === "left" ? t.leftNumerosity : t.rightNumerosity, larger);
  }
}
ok("every plan: 20 trials, 7/7/6, sides balanced ±1 per difficulty, no ties, run limits", () => {});
ok("larger side is exactly 10 left / 10 right in every plan", () => assert.ok(allExact10));
ok("same session ID reproduces the same plan; different IDs differ", () => {
  assert.deepEqual(buildTrialPlan("abc123"), buildTrialPlan("abc123"));
  assert.notDeepEqual(buildTrialPlan("abc123"), buildTrialPlan("abc124"));
});
console.log(`    larger side overall: left=${sideTotals.left} right=${sideTotals.right}`);

console.log("Stimulus generator");
ok("all pool numerosities × 150 seeds: inside field, no overlap, min gap, mean radius normalised", () => {
  const nums = new Set<number>();
  DIFFICULTY_ORDER.forEach((d) => TRIAL_POOL[d].forEach(([a, b]) => (nums.add(a), nums.add(b))));
  for (const n of nums) {
    for (let s = 0; s < 150; s++) {
      const dots = generateDotField(n, createRng(`t:${n}:${s}`));
      assert.equal(dots.length, n);
      assert.deepEqual(validateDotField(dots), []);
      const mean = dots.reduce((a, d) => a + d.r, 0) / n;
      assert.ok(Math.abs(mean - 9) < 1e-9);
    }
  }
});
ok("max numerosity is placeable on every attempt (1000 seeds)", () => {
  for (let s = 0; s < 1000; s++) assert.deepEqual(validateDotField(generateDotField(MAX_NUMEROSITY, createRng(`m:${s}`))), []);
});
ok("trial stimulus has exactly the planned counts, deterministic per (session, trial, attempt)", () => {
  const plan = buildTrialPlan("s1");
  for (const t of plan) {
    const st = generateTrialStimulus(t, "s1");
    assert.equal(st.left.length, t.leftNumerosity);
    assert.equal(st.right.length, t.rightNumerosity);
  }
  assert.deepEqual(generateTrialStimulus(plan[0], "s1"), generateTrialStimulus(plan[0], "s1"));
  assert.notDeepEqual(generateTrialStimulus(plan[0], "s1", 0), generateTrialStimulus(plan[0], "s1", 1));
});
ok("no systematic extent confound: bounding-box area of larger vs smaller field similar", () => {
  const ext = (dots: { x: number; y: number }[]) => {
    const xs = dots.map((d) => d.x), ys = dots.map((d) => d.y);
    return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
  };
  let small = 0, large = 0;
  for (let s = 0; s < 300; s++) {
    small += ext(generateDotField(8, createRng(`e8:${s}`)));
    large += ext(generateDotField(16, createRng(`e16:${s}`)));
  }
  const rel = large / small;
  console.log(`    mean bbox area, 16 dots / 8 dots = ${rel.toFixed(2)}`);
  assert.ok(rel > 0.9 && rel < 1.4);
});

console.log("State machine / data integrity");
const rec = (st: ExperimentState): TrialRecord => {
  const t = st.plan[st.trialIndex];
  return {
    sessionId: st.sessionId!, trialNumber: t.trialNumber, difficulty: t.difficulty,
    leftNumerosity: t.leftNumerosity, rightNumerosity: t.rightNumerosity, ratio: t.ratio,
    correctSide: t.correctSide, selectedSide: "left", correct: t.correctSide === "left",
    responseTimeMs: 500, timestamp: new Date().toISOString(), stimulusMeasuredMs: 1000,
  };
};
const drive = (st: ExperimentState): ExperimentState => {
  st = experimentReducer(st, { type: "SHOW_STIMULUS" });
  st = experimentReducer(st, { type: "SHOW_RESPONSE" });
  st = experimentReducer(st, { type: "RECORD", record: rec(st) });
  st = experimentReducer(st, { type: "RECORD", record: rec(st) }); // duplicate → ignored
  return experimentReducer(st, { type: "NEXT" });
};
ok("illegal transitions are ignored (RECORD before response, NEXT during fixation, etc.)", () => {
  let st = experimentReducer(createInitialState(), { type: "START", sessionId: "aa" });
  assert.equal(st.phase, "fixation");
  assert.equal(experimentReducer(st, { type: "SHOW_RESPONSE" }), st);
  assert.equal(experimentReducer(st, { type: "RECORD", record: rec(st) }), st);
  assert.equal(experimentReducer(st, { type: "NEXT" }), st);
  assert.equal(experimentReducer(st, { type: "START", sessionId: "bb" }), st);
  st = experimentReducer(st, { type: "SHOW_STIMULUS" });
  assert.equal(experimentReducer(st, { type: "RECORD", record: rec(st) }), st);
});
let finalState!: ExperimentState;
ok("20 trials → exactly 20 records, duplicates never recorded, ends in RESULTS", () => {
  let st = experimentReducer(createInitialState(), { type: "START", sessionId: "bead01" });
  for (let i = 0; i < TOTAL_TRIALS; i++) {
    assert.equal(st.trialIndex, i);
    assert.equal(st.phase, "fixation");
    st = drive(st);
    assert.equal(st.records.length, Math.min(i + 1, TOTAL_TRIALS));
  }
  assert.equal(st.phase, "results");
  assert.equal(st.records.length, 20);
  assert.deepEqual(st.records.map((r) => r.trialNumber), Array.from({ length: 20 }, (_, k) => k + 1));
  finalState = st;
});
ok("restart creates a fresh session with no leaked data", () => {
  const st = experimentReducer(finalState, { type: "START", sessionId: "cafe02" });
  assert.equal(st.sessionId, "cafe02");
  assert.equal(st.records.length, 0);
  assert.equal(st.trialIndex, 0);
  assert.equal(st.selectedSide, null);
  assert.notDeepEqual(st.plan, finalState.plan);
});
ok("RESTART_TRIAL (tab hidden) re-runs the same trial without recording", () => {
  let st = experimentReducer(createInitialState(), { type: "START", sessionId: "dd" });
  st = experimentReducer(st, { type: "SHOW_STIMULUS" });
  const run = st.runId;
  st = experimentReducer(st, { type: "RESTART_TRIAL" });
  assert.equal(st.phase, "fixation");
  assert.equal(st.trialIndex, 0);
  assert.equal(st.records.length, 0);
  assert.equal(st.runId, run + 1);
});

console.log("CSV");
ok("trial CSV: exact columns, 20 rows, parses back", () => {
  const csv = trialsToCsv(finalState.records);
  const lines = csv.trimEnd().split("\r\n");
  assert.equal(lines.length, 21);
  assert.equal(
    lines[0],
    "session_id,trial,difficulty,left_numerosity,right_numerosity,ratio,correct_side,selected_side,correct,response_time_ms,timestamp",
  );
  assert.deepEqual([...TRIAL_CSV_COLUMNS], lines[0].split(","));
  for (const l of lines.slice(1)) assert.equal(l.split(",").length, 11);
  console.log(`    ${lines[1]}`);
});
ok("summary CSV: exact columns and values", () => {
  const sum = summarizeSession("bead01", finalState.records);
  const lines = summaryToCsv(sum).trimEnd().split("\r\n");
  assert.equal(lines[0], "session_id,total_trials,correct,accuracy,average_response_time_ms,easy_accuracy,medium_accuracy,hard_accuracy");
  assert.deepEqual([...SUMMARY_CSV_COLUMNS], lines[0].split(","));
  assert.equal(lines.length, 2);
  console.log(`    ${lines[1]}`);
});
ok("summary maths", () => {
  const recs = finalState.records.map((r, i) => ({ ...r, correct: i < 15, responseTimeMs: 1000 + i }));
  const s = summarizeSession("x", recs);
  assert.equal(s.correct, 15);
  assert.equal(s.accuracy, 0.75);
  assert.equal(s.averageResponseTimeMs, 1009.5);
});


// ── Gaze metrics ─────────────────────────────────────────────────────────────
import { computeGazeMetrics, type ArenaGeometry, type GazeSample } from "../lib/gaze";
import { gazeSamplesToCsv, gazeTrialsToCsv } from "../lib/csvExport";
console.log("Gaze metrics");
const arena: ArenaGeometry = {
  viewportWidth: 1000, viewportHeight: 800,
  leftFrame: { x: 100, y: 100, width: 350, height: 420 },
  rightFrame: { x: 550, y: 100, width: 350, height: 420 },
}; // midline = 500
const S = (t: number, x: number, y: number, phase: GazeSample["phase"] = "stimulus"): GazeSample => ({ t, x, y, phase });
ok("dwell, first side, switches, path length are time-weighted and correct", () => {
  const samples = [
    S(-200, 500, 300, "fixation"),
    S(0, 200, 300), S(250, 200, 400),        // left 0–500 (next sample at 500)
    S(500, 700, 400), S(750, 700, 400),      // right 500–1000
    S(1000, 700, 400, "response"), S(1200, 300, 400, "response"),
  ];
  const m = computeGazeMetrics(samples, arena, "right", 1000);
  assert.equal(m.samplesStimulus, 4);
  assert.equal(m.samplesResponse, 2);
  assert.equal(m.stimLeftMs, 500);
  assert.equal(m.stimRightMs, 500);
  assert.equal(m.stimPropLargerSide, 0.5);
  assert.equal(m.firstSideStimulus, "left");
  assert.equal(m.switchesStimulus, 1);
  assert.equal(m.pathLengthStimulusPx, 100 + Math.hypot(500, 0) + 0);
  assert.equal(m.pathLengthResponsePx, 400);
  assert.equal(m.sampleRateHz, 4);
});
ok("no samples / no arena → null metrics, no crash", () => {
  const m = computeGazeMetrics([], null, "left", 1000);
  assert.equal(m.stimLeftMs, null);
  assert.equal(m.pathLengthStimulusPx, 0);
});
ok("gaze CSVs have exact columns and one row per sample/trial", () => {
  const recs = finalState.records.slice(0, 2).map((r) => ({
    ...r,
    gaze: { samples: [S(0, 1, 2), S(10, 3, 4)], metrics: computeGazeMetrics([S(0, 200, 2), S(10, 300, 4)], arena, r.correctSide, 1000), arena, lostSamples: 1, calibrationErrorPx: 120 },
  }));
  const t = gazeTrialsToCsv(recs).trimEnd().split("\r\n");
  assert.equal(t.length, 3);
  assert.equal(t[0].split(",").length, t[1].split(",").length);
  const sm = gazeSamplesToCsv(recs).trimEnd().split("\r\n");
  assert.equal(sm.length, 5);
  assert.equal(sm[0], "session_id,trial,phase,t_ms,x_px,y_px");
  // default trial CSV unaffected by gaze
  assert.equal(trialsToCsv(recs).split("\r\n")[0].split(",").length, 11);
});
console.log(`\nAll ${passed} checks passed (incl. gaze).`);
