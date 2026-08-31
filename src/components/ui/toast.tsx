"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils/cn";

/**
 * Avisos efímeros (§8: "Toast de resultado confirmado", 250ms de entrada,
 * 200ms de salida, auto-descarte a los 4s).
 *
 * El color lo decide el tipo de aviso, no la estética: un resultado confirmado
 * sale en el acento de marca y una disputa en rojo, igual que los estados en el
 * bracket. Así el color significa lo mismo en toda la app.
 */

type ToastTone = "success" | "warn" | "danger";

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  show: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 4000;

const TONES: Record<ToastTone, string> = {
  success: "border-brand/50 bg-surface text-brand",
  warn: "border-warn/50 bg-surface text-warn",
  danger: "border-danger/50 bg-surface text-danger",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const reduceMotion = useReducedMotion();

  const show = useCallback((message: string, tone: ToastTone = "success") => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, message, tone }]);
    setTimeout(
      () => setToasts((current) => current.filter((toast) => toast.id !== id)),
      AUTO_DISMISS_MS,
    );
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* `polite` y no `assertive`: es una confirmación, no una alarma; no debe
          interrumpir a quien esté usando un lector de pantalla. */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              // La duración de salida (200ms, §8) va dentro del propio `exit`:
              // es más corta que la de entrada para que desaparezca sin demorar.
              exit={
                reduceMotion
                  ? { opacity: 0, transition: { duration: 0.2 } }
                  : { opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.2 } }
              }
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "pointer-events-auto w-full max-w-sm rounded-[var(--radius-card)] border",
                "px-4 py-3 text-body-sm font-medium shadow-[var(--shadow-card)]",
                TONES[toast.tone],
              )}
            >
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Muestra un aviso. Fuera del provider no falla: devuelve una función vacía,
 * porque un toast que no se ve nunca debería tumbar la pantalla.
 */
export function useToast(): ToastContextValue {
  return useContext(ToastContext) ?? { show: () => {} };
}
