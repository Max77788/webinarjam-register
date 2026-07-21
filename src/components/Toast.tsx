"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastKind = "success" | "error";
type ToastState = { id: number; message: string; kind: ToastKind } | null;

const ToastContext = createContext<
  ((message: string, kind?: ToastKind) => void) | null
>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);

  const show = useCallback((message: string, kind: ToastKind = "success") => {
    const id = Date.now();
    setToast({ id, message, kind });
    window.setTimeout(() => {
      setToast((cur) => (cur && cur.id === id ? null : cur));
    }, 2600);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
      >
        {toast && (
          <div
            className={cn(
              "pointer-events-auto flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg animate-fade-in",
              toast.kind === "success" ? "bg-emerald-600" : "bg-rose-600"
            )}
          >
            {toast.kind === "success" ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <XCircle className="h-5 w-5" />
            )}
            {toast.message}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
