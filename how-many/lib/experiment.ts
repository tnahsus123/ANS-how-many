import {
  ACTIVE_CONDITION,
  DIFFICULTY_ORDER,
  DIFFICULTY_TRIAL_COUNTS,
  MAX_SAME_DIFFICULTY_RUN,
  MAX_SAME_SIDE_RUN,
  TOTAL_TRIALS,
  TRIAL_POOL,
} from "../config/experiment";
import { createRng, shuffle } from "./rng";
import type {
  Difficulty,
  SessionSummary,
  Side,
  TrialRecord,
  TrialSpec,
} from "./types";

export function computeRatio(a: number, b: number): number {
  const larger = Math.max(a, b);
  const smaller = Math.min(a, b);
  return Math.round((larger / smaller) * 100) / 100;
}

type UnnumberedTrial = Omit<TrialSpec, "trialNumber">;

function exceedsRuns(trials: UnnumberedTrial[]): boolean {
  let sideRun = 1;
  let diffRun = 1;
  for (let i = 1; i < trials.length; i++) {
    sideRun = trials[i].correctSide === trials[i - 1].correctSide ? sideRun + 1 : 1;
    diffRun = trials[i].difficulty === trials[i - 1].difficulty ? diffRun + 1 : 1;
    if (sideRun > MAX_SAME_SIDE_RUN || diffRun > MAX_SAME_DIFFICULTY_RUN) return true;
  }
  return false;
}

/**
 * Build the full, ordered plan for one session.
 *  - difficulty counts come from config (7 / 7 / 6)
 *  - pairs are drawn from the predefined pool
 *  - the larger side is balanced within ±1 per difficulty and exactly
 *    balanced overall (odd groups hand their spare trial to the side that
 *    is behind)
 *  - order is shuffled, rejecting orders with long same-side/difficulty runs
 */
export function buildTrialPlan(sessionId: string): TrialSpec[] {
  const rng = createRng(`${sessionId}:plan`);
  const items: UnnumberedTrial[] = [];
  let largerLeft = 0;
  let largerRight = 0;

  for (const difficulty of DIFFICULTY_ORDER) {
    const count = DIFFICULTY_TRIAL_COUNTS[difficulty];
    const pool = TRIAL_POOL[difficulty];
    if (pool.length < count) {
      throw new Error(`Pool for "${difficulty}" has ${pool.length} pairs but ${count} are required.`);
    }
    const pairs = shuffle(pool, rng).slice(0, count);

    const half = Math.floor(count / 2);
    let lefts = half;
    let rights = half;
    if (count % 2 === 1) {
      const leftTotal = largerLeft + half;
      const rightTotal = largerRight + half;
      const extraLeft = leftTotal === rightTotal ? rng() < 0.5 : leftTotal < rightTotal;
      if (extraLeft) lefts += 1;
      else rights += 1;
    }
    largerLeft += lefts;
    largerRight += rights;

    const sides: Side[] = shuffle(
      [...Array<Side>(lefts).fill("left"), ...Array<Side>(rights).fill("right")],
      rng,
    );

    pairs.forEach(([smaller, larger], i) => {
      const correctSide = sides[i];
      items.push({
        difficulty,
        leftNumerosity: correctSide === "left" ? larger : smaller,
        rightNumerosity: correctSide === "right" ? larger : smaller,
        ratio: computeRatio(smaller, larger),
        correctSide,
        condition: ACTIVE_CONDITION,
      });
    });
  }

  if (items.length !== TOTAL_TRIALS) {
    throw new Error(`Plan has ${items.length} trials; expected ${TOTAL_TRIALS}. Check DIFFICULTY_TRIAL_COUNTS.`);
  }

  let order = shuffle(items, rng);
  for (let attempt = 0; attempt < 1000 && exceedsRuns(order); attempt++) {
    order = shuffle(items, rng);
  }

  return order.map((t, i) => ({ ...t, trialNumber: i + 1 }));
}

export function summarizeSession(sessionId: string, records: TrialRecord[]): SessionSummary {
  const total = records.length;
  const correct = records.filter((r) => r.correct).length;
  const rtSum = records.reduce((s, r) => s + r.responseTimeMs, 0);

  const accuracyByDifficulty = {} as Record<Difficulty, number | null>;
  const trialsByDifficulty = {} as Record<Difficulty, number>;
  for (const d of DIFFICULTY_ORDER) {
    const subset = records.filter((r) => r.difficulty === d);
    trialsByDifficulty[d] = subset.length;
    accuracyByDifficulty[d] = subset.length
      ? subset.filter((r) => r.correct).length / subset.length
      : null;
  }

  return {
    sessionId,
    totalTrials: total,
    correct,
    accuracy: total ? correct / total : 0,
    averageResponseTimeMs: total ? rtSum / total : 0,
    accuracyByDifficulty,
    trialsByDifficulty,
  };
}
