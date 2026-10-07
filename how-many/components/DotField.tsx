import type { Dot } from "@/lib/types";

interface DotFieldProps {
  dots: Dot[];
  width: number;
  height: number;
}

/**
 * Pure presentational SVG of one dot field. Deliberately inert: no handlers,
 * no hover/focus states, no per-dot animation, no labels, not selectable.
 */
export default function DotField({ dots, width, height }: DotFieldProps) {
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="pointer-events-none block h-full w-full select-none"
      aria-hidden="true"
      focusable="false"
    >
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="currentColor" />
      ))}
    </svg>
  );
}
