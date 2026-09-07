import type { ElementType, HTMLAttributes, ReactNode } from "react";

type CardProps = {
  /** Render as something other than a <div> (e.g. "section", "form"). */
  as?: ElementType;
  /** Drop the default padding — e.g. when a <table> should sit flush. */
  flush?: boolean;
  className?: string;
  children?: ReactNode;
} & HTMLAttributes<HTMLElement>;

/**
 * The one card/panel surface for the whole admin app: white background,
 * hairline border, rounded corners, soft shadow, and padding that tightens
 * on mobile. Styling lives in `.card` / `.table-card` in globals.css.
 */
export function Card({ as: Tag = "div", flush = false, className = "", children, ...rest }: CardProps) {
  const base = flush ? "table-card" : "card";
  return (
    <Tag className={`${base} ${className}`.trim()} {...rest}>
      {children}
    </Tag>
  );
}
