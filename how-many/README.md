# HOW MANY?

*Can you see quantity without counting?* — a small research instrument for studying numerosity perception (the Approximate Number System). Built for an M.Des thesis prototype.

Next.js (App Router) · TypeScript · Tailwind CSS 3 · no backend, no database, no env vars, no external requests.

```bash
npm install
npm run dev        # http://localhost:3000
npm run lint
npm run typecheck
npm run build
npm run verify     # logic checks: plan balance, stimulus geometry, state machine, CSV
```

Deploy to Vercel by importing the repo — no configuration needed.

## Experiment

20 trials (7 easy / 7 medium / 6 hard), fixation 500 ms → two dot fields 1000 ms → response → next trial. No feedback or score during the task. All parameters live in **`config/experiment.ts`**.

- **Balanced plan** — each difficulty draws its [smaller, larger] pairs from a predefined pool; the larger side is exactly 10 left / 10 right in every session (±1 within each difficulty). Order is shuffled with limits on same-side / same-difficulty runs. Numerosities are never equal.
- **Reproducible** — the anonymous session ID seeds the trial order, side assignment and every dot layout, so any session's stimuli can be regenerated from `session_id`.
- **Dots** — SVG, identical rectangular field per side, no overlaps, minimum gap, inside the field, slight radius variation with the mean radius normalised per field, best-candidate placement for an even spread.

### Timing
- Phase changes use `requestAnimationFrame` + `flushSync`, so the DOM commit lands in the frame being painted. Durations are therefore quantised to the display's refresh interval: the stimulus is on screen for **1000 ms up to one frame longer** (≈ +16.7 ms at 60 Hz), never shorter. 
- The response timer starts (`performance.now()`) immediately after the commit that removes the dots and enables the buttons. It stops at the input event's own `timeStamp` (pointer-down for taps/clicks, key-down for arrows).
- A synchronous gate (not React state) accepts exactly one response per trial: nothing during fixation/stimulus, no double records. Held keys (`repeat`) are ignored.
- If the tab is hidden before the response phase, the trial restarts (rAF is throttled in background tabs) rather than recording a bad trial.
- Set `EXPORT_TIMING_DIAGNOSTICS = true` to add a `stimulus_measured_ms` column.

### Known design property (V1)
With equal-sized dots, total dot area and density necessarily correlate with numerosity. V1 is deliberately *pure numerosity* — no area/density control. Those confounds are exactly what the future conditions below manipulate; keep this in mind when interpreting V1 data.

## Data

Nothing is sent anywhere. Results screen offers two downloads:

`how-many_trials_<session>.csv` — one row per trial  
`session_id, trial, difficulty, left_numerosity, right_numerosity, ratio, correct_side, selected_side, correct, response_time_ms, timestamp`  
(`correct` is 1/0; `response_time_ms` 0.1 ms resolution; `timestamp` ISO-8601 UTC at response.)

`how-many_summary_<session>.csv` — one row  
`session_id, total_trials, correct, accuracy, average_response_time_ms, easy_accuracy, medium_accuracy, hard_accuracy`  
(accuracies are proportions 0–1.)

## Architecture

```
app/                 layout, page, global CSS
components/          IntroScreen, TrialScreen, FixationPhase, StimulusPhase,
                     ResponsePhase, DotField, ProgressIndicator, ResultsScreen
config/experiment.ts every tunable parameter
hooks/useExperiment.ts   timing + response capture (the only impure piece)
lib/experimentReducer.ts pure, guarded state machine (INTRO→…→RESULTS)
lib/experiment.ts        balanced trial plan, summary stats
lib/stimulusGenerator.ts dot-field generator + StimulusCondition registry
lib/csvExport.ts         CSV + browser download
lib/rng.ts, session.ts   seeded RNG, anonymous session ID
scripts/verify.ts        logic checks
```

### Adding conditions later
`lib/stimulusGenerator.ts` defines a `StimulusCondition` (`generateField(request, rng)`) and a `CONDITIONS` registry. To add area-/density-controlled, size-varied or grouped fields: add the id to `ConditionId` (`lib/types.ts`), implement the interface (it receives the whole `TrialSpec`, so conditions can coordinate both sides), register it, and set `ACTIVE_CONDITION` (or assign per trial in `buildTrialPlan`). Numeral / number-word conditions would additionally need a non-dot renderer in `StimulusPhase`. Add a `condition` column to `csvExport.ts` when you do.

### Adding storage later
`useExperiment` already produces complete `TrialRecord`s and a `SessionSummary`. Persisting is a single call at the `RECORD` dispatch or when `phase === "results"` — no other code needs to change.
