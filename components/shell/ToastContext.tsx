"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type ToastTone = "success" | "error";

interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<ToastTone>("success");
  const [visible, setVisible] = useState(false);

  const showToast = useCallback((msg: string, nextTone: ToastTone = "success") => {
    setToastMessage(msg);
    setTone(nextTone);
    setVisible(true);
    setTimeout(() => {
      setVisible(false);
    }, 3200);
  }, []);

  const isError = tone === "error";

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className={`toast ${visible ? "show" : ""}`}
        role={isError ? "alert" : "status"}
        aria-live={isError ? "assertive" : "polite"}
      >
        {isError ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[#E5484D]" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[#D3BD2A]" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        <span>{toastMessage}</span>
      </div>
    </ToastContext.Provider>
  );
}
