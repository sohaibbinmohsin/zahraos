"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Modal } from "./Modal";

export type ConfirmOptions = {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" makes the confirm button red — use for destructive actions. */
  tone?: "default" | "danger";
};

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * App-wide confirmation dialog. Replaces window.confirm() with the same
 * card surface the rest of the app uses. Call `const confirm = useConfirm()`
 * then `if (await confirm({ title, message })) { ... }`.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((next) => {
    setOpts(next);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setOpts(null);
  }, []);

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Modal
        isOpen={opts !== null}
        onClose={() => settle(false)}
        title={opts?.title ?? ""}
        maxWidth={420}
        footer={
          <>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => settle(false)}>
              {opts?.cancelLabel ?? "Cancel"}
            </button>
            <button
              type="button"
              className={`btn btn-sm ${opts?.tone === "danger" ? "btn-danger" : "btn-primary"}`}
              onClick={() => settle(true)}
              autoFocus
            >
              {opts?.confirmLabel ?? "Confirm"}
            </button>
          </>
        }
      >
        <p className="text-sm text-[var(--ink-2)] leading-relaxed">{opts?.message}</p>
      </Modal>
    </ConfirmContext.Provider>
  );
}

// Used when a component calls useConfirm() outside a provider (e.g. in unit
// tests). Falls back to the native dialog so behaviour — and test mocks of
// window.confirm — keep working.
const fallbackConfirm: ConfirmFn = (opts) => {
  if (typeof window !== "undefined" && typeof window.confirm === "function") {
    const text = typeof opts.message === "string" ? `${opts.title}\n\n${opts.message}` : opts.title;
    return Promise.resolve(window.confirm(text));
  }
  return Promise.resolve(true);
};

export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext) ?? fallbackConfirm;
}
