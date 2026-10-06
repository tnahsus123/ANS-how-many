/** Fixation cross, centred between the two stimulus regions. */
export default function FixationPhase() {
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 bg-paper p-1.5"
      aria-hidden="true"
      data-testid="fixation"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" className="block text-ink">
        <path d="M12 2v20M2 12h20" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
    </div>
  );
}
