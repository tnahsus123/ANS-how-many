# HOW MANY?

*Can you see quantity without counting?* — a small research instrument for studying numerosity perception (the Approximate Number System). Built for an M.Des thesis prototype.

Next.js (App Router) · TypeScript · Tailwind CSS 3 · no backend, no database, no env vars. Optional webcam eye tracking via WebGazer.js (opt-in, runs on-device).

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

## Eye tracking (optional, opt-in)

Tick **Enable eye tracking** on the intro screen → webcam permission → 9-point click calibration → 5-point validation (reports estimated error in px; recalibrate or continue) → experiment. Declining or camera failure falls back to the normal task. Without opt-in nothing changes: no extra UI, no extra data, WebGazer is never even loaded.

Per trial, gaze samples are recorded through fixation, stimulus and response (timestamps share the `performance.now()` clock with response time). Extra downloads appear only when tracking was on:

- `how-many_gaze-trials_<session>.csv` — one row/trial: `response_time_ms`, `calibration_error_px`, sample counts and rate, `stim_left_ms`, `stim_right_ms`, `stim_prop_larger_side`, `first_side_stimulus`, `switches_stimulus` (left↔right crossings), `path_length_stimulus_px`, `path_length_response_px` (gaze movement), plus screen/frame geometry so sides can be reinterpreted.
- `how-many_gaze-samples_<session>.csv` — raw `session_id, trial, phase, t_ms, x_px, y_px` (`t_ms` relative to stimulus onset).

The main trial/summary CSVs are unchanged. Left/right is decided by the midline between the two frames; dwell is time-weighted.

**Honest limits of webcam tracking:** typical error is 100–300 px at ~30 Hz, so it can answer "which side was looked at, and how much did gaze move/switch" over a 1-second stimulus, not precise fixation locations or saccade timing. Head movement, lighting and glasses matter. Always report `calibration_error_px` and consider excluding poorly calibrated sessions.

**Privacy/ethics:** video never leaves the device and is not stored. Gaze coordinates are biometric-adjacent; if you collect them from participants, mention it in your consent text. By default WebGazer fetches face-model files from a CDN (an external request) — to avoid that, host the MediaPipe `face_mesh` files in `/public` and set `WEBGAZER_FACEMESH_PATH` in `config/experiment.ts`. Set `EYE_TRACKING_OPTION = false` to remove the feature from the UI.

Code: `lib/gaze.ts` (pure metrics), `lib/gazeController.ts` (recording), `lib/gazeProvider.ts` (interface) + `lib/gazeProviders/webgazer.ts` (adapter — swap in another tracker by implementing `GazeProvider`), `components/CalibrationScreen.tsx`.

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
