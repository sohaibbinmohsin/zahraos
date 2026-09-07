"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

interface LoadingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** When true, the button shows a circular spinner, swaps its label for
   *  `loadingText`, and is disabled + aria-busy. */
  loading?: boolean;
  /** Label shown while `loading`. Defaults to the button's normal children. */
  loadingText?: ReactNode;
}

/**
 * Drop-in <button> for any action that hits the server. Keeps the caller's
 * own `className` (so `.btn .btn-primary` etc. still apply) and renders a
 * `.btn-spinner` + text while the request is in flight.
 */
export function LoadingButton({
  loading = false,
  loadingText,
  disabled,
  children,
  type,
  ...rest
}: LoadingButtonProps) {
  return (
    <button
      {...rest}
      type={type ?? "button"}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? (
        <>
          <span className="btn-spinner" aria-hidden="true" />
          <span>{loadingText ?? children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
