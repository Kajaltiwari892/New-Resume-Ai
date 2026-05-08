"use client";
import { useCallback, useEffect, useState } from "react";
import { FiAlertCircle, FiCheckCircle, FiInfo, FiX } from "react-icons/fi";

export type ToastKind = "success" | "error" | "warning" | "info";

export type ToastItem = {
  id: string;
  kind: ToastKind;
  title: string;
  message?: string;
  duration?: number;
};

type PushInput = Omit<ToastItem, "id">;

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((input: PushInput) => {
    const id = makeId();
    const toast: ToastItem = { id, duration: 5000, ...input };
    setToasts((list) => [...list, toast]);
    return id;
  }, []);

  return { toasts, push, dismiss };
}

const ICONS: Record<ToastKind, React.ReactNode> = {
  success: <FiCheckCircle size={18} />,
  error: <FiAlertCircle size={18} />,
  warning: <FiAlertCircle size={18} />,
  info: <FiInfo size={18} />,
};

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <ToastRow key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastRow({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    if (!toast.duration) return;
    const handle = window.setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => window.clearTimeout(handle);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div className={`toast toast-${toast.kind}`} role="alert">
      <span className="toast-icon" aria-hidden="true">
        {ICONS[toast.kind]}
      </span>
      <div className="toast-body">
        <p className="toast-title">{toast.title}</p>
        {toast.message && <p className="toast-message">{toast.message}</p>}
      </div>
      <button
        type="button"
        className="toast-close"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
      >
        <FiX size={16} />
      </button>
    </div>
  );
}
