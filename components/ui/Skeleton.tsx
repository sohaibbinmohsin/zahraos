import type { CSSProperties } from "react";

/** One shimmering placeholder block. Size it with `w` / `h` (any CSS length)
 *  or with `className` / `style`. */
export function Skeleton({
  w,
  h,
  circle = false,
  className = "",
  style,
}: {
  w?: number | string;
  h?: number | string;
  circle?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      className={`skeleton ${circle ? "skeleton--circle" : ""} ${className}`}
      style={{
        width: w,
        height: h,
        ...style,
      }}
    />
  );
}

/** A stack of text-line placeholders; the last line is shorter. */
export function SkeletonText({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <span className={`flex flex-col gap-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <span
          key={i}
          className="skeleton skeleton--text"
          style={{ width: i === lines - 1 ? "60%" : "100%" }}
        />
      ))}
    </span>
  );
}
