import { ACTIVE_CONDITION, STIMULUS } from "../config/experiment";
import { createRng, type Rng } from "./rng";
import type { ConditionId, Dot, Side, TrialSpec, TrialStimulus } from "./types";

/** Geometry/sampling parameters for one dot field. */
export interface DotFieldParams {
  width: number;
  height: number;
  baseRadius: number;
  radiusJitter: number;
  minGap: number;
  edgePadding: number;
  candidatesPerDot: number;
}

export const DEFAULT_DOT_FIELD_PARAMS: DotFieldParams = { ...STIMULUS };

const MAX_FIELD_RESTARTS = 200;
const MAX_CANDIDATE_TRIES = 500;

/**
 * Core dot-field generator (pure numerosity; no area/density control).
 *
 *  - radii: base ± jitter, then rescaled so the field's MEAN radius equals
 *    `baseRadius` (keeps per-dot size comparable across fields)
 *  - positions: best-candidate sampling, giving an even spread so the
 *    occupied extent does not depend on how many dots there are
 *  - hard constraints: inside the field, no overlaps, ≥ `minGap` between dots
 */
export function generateDotField(
  numerosity: number,
  rng: Rng,
  params: DotFieldParams = DEFAULT_DOT_FIELD_PARAMS,
): Dot[] {
  for (let restart = 0; restart < MAX_FIELD_RESTARTS; restart++) {
    const radii = sampleRadii(numerosity, rng, params);
    const dots = placeDots(radii, rng, params);
    if (dots) return dots;
  }
  throw new Error(`Could not place ${numerosity} dots in ${params.width}×${params.height}.`);
}

function sampleRadii(n: number, rng: Rng, p: DotFieldParams): number[] {
  const raw = Array.from({ length: n }, () => 1 + (rng() * 2 - 1) * p.radiusJitter);
  const mean = raw.reduce((s, v) => s + v, 0) / n;
  return raw.map((v) => (v / mean) * p.baseRadius);
}

function placeDots(radii: number[], rng: Rng, p: DotFieldParams): Dot[] | null {
  // Place larger dots first: they are the hardest to fit.
  const ordered = radii.slice().sort((a, b) => b - a);
  const dots: Dot[] = [];

  for (const r of ordered) {
    const minX = p.edgePadding + r;
    const maxX = p.width - p.edgePadding - r;
    const minY = p.edgePadding + r;
    const maxY = p.height - p.edgePadding - r;

    let best: Dot | null = null;
    let bestClearance = -Infinity;
    let valid = 0;

    for (let tries = 0; tries < MAX_CANDIDATE_TRIES && valid < p.candidatesPerDot; tries++) {
      const x = minX + rng() * (maxX - minX);
      const y = minY + rng() * (maxY - minY);

      let ok = true;
      let clearance = Infinity;
      for (const d of dots) {
        const gap = Math.hypot(d.x - x, d.y - y) - d.r - r;
        if (gap < p.minGap) {
          ok = false;
          break;
        }
        if (gap < clearance) clearance = gap;
      }
      if (!ok) continue;

      valid++;
      if (clearance > bestClearance) {
        bestClearance = clearance;
        best = { x, y, r };
      }
    }

    if (!best) return null;
    dots.push(best);
  }
  return dots;
}

/** Returns a list of constraint violations (empty = valid). Used by `npm run verify`. */
export function validateDotField(
  dots: Dot[],
  params: DotFieldParams = DEFAULT_DOT_FIELD_PARAMS,
): string[] {
  const problems: string[] = [];
  dots.forEach((d, i) => {
    if (d.x - d.r < params.edgePadding - 1e-9 || d.x + d.r > params.width - params.edgePadding + 1e-9)
      problems.push(`dot ${i} outside field (x)`);
    if (d.y - d.r < params.edgePadding - 1e-9 || d.y + d.r > params.height - params.edgePadding + 1e-9)
      problems.push(`dot ${i} outside field (y)`);
    for (let j = i + 1; j < dots.length; j++) {
      const gap = Math.hypot(d.x - dots[j].x, d.y - dots[j].y) - d.r - dots[j].r;
      if (gap < params.minGap - 1e-9) problems.push(`dots ${i} and ${j} too close (gap ${gap.toFixed(2)})`);
    }
  });
  return problems;
}

// ── Conditions (extension point) ─────────────────────────────────────────────

export interface FieldRequest {
  numerosity: number;
  side: Side;
  trial: TrialSpec;
}

/**
 * A stimulus condition decides how ONE field is drawn for a given numerosity.
 * To add e.g. area-controlled, density-controlled, size-varied or grouped
 * conditions: extend `ConditionId` in lib/types.ts, implement this interface,
 * and register it in `CONDITIONS`. Conditions that must coordinate both sides
 * (e.g. equal total area) can read `request.trial` for the other side's count.
 */
export interface StimulusCondition {
  id: ConditionId;
  generateField(request: FieldRequest, rng: Rng): Dot[];
}

export const pureNumerosity: StimulusCondition = {
  id: "pure-numerosity",
  generateField: ({ numerosity }, rng) => generateDotField(numerosity, rng),
};

export const CONDITIONS: Record<ConditionId, StimulusCondition> = {
  "pure-numerosity": pureNumerosity,
};

/**
 * Generate both fields for a trial. Deterministic given (sessionId, trial,
 * attempt), so any stimulus can be regenerated exactly from the session ID.
 * `attempt` > 0 is used only if a trial had to be restarted (tab hidden).
 */
export function generateTrialStimulus(
  trial: TrialSpec,
  sessionId: string,
  attempt = 0,
): TrialStimulus {
  const condition = CONDITIONS[trial.condition ?? ACTIVE_CONDITION];
  const rng = createRng(`${sessionId}:stimulus:${trial.trialNumber}:${attempt}`);
  return {
    left: condition.generateField({ numerosity: trial.leftNumerosity, side: "left", trial }, rng),
    right: condition.generateField({ numerosity: trial.rightNumerosity, side: "right", trial }, rng),
  };
}
