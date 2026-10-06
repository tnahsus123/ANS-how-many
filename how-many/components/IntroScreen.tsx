interface IntroScreenProps {
  onStart: () => void;
}

const STEPS = [
  { n: "01", label: "LOOK" },
  { n: "02", label: "DON'T COUNT" },
  { n: "03", label: "CHOOSE" },
] as const;

export default function IntroScreen({ onStart }: IntroScreenProps) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 py-12 sm:px-8">
      <div className="motion-safe:animate-rise">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-mute">
          Numerosity perception · Research prototype
        </p>

        <h1 className="mt-6 text-[clamp(3.25rem,16vw,7.5rem)] font-black leading-[0.9] tracking-tighter">
          HOW MANY?
        </h1>
        <p className="mt-5 text-xl font-medium sm:text-2xl">Can you see quantity without counting?</p>

        <p className="mt-8 max-w-xl text-base leading-relaxed text-mute sm:text-lg">
          You&apos;re about to see two groups of dots. They&apos;ll appear briefly. Don&apos;t count
          them. Just look, trust your first instinct, and choose which side has more.
        </p>

        <ol className="mt-10 grid gap-px border border-line bg-line sm:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="bg-paper px-5 py-4 font-mono text-sm tracking-wide">
              {s.n} — <span className="font-semibold">{s.label}</span>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={onStart}
          className="mt-10 inline-flex min-h-[56px] w-full items-center justify-center bg-ink px-10 text-base font-semibold tracking-wide text-paper transition-colors hover:bg-accent sm:w-auto"
        >
          Start experiment
        </button>

        <p className="mt-6 max-w-xl text-sm leading-relaxed text-mute">
          This is a research prototype exploring how humans perceive quantity. It is not an IQ test.
        </p>
      </div>
    </div>
  );
}
