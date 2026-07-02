import React from "react";
import { X, CheckCircle, XCircle, AlertTriangle, Info } from "lucide-react";
import { useToastStore } from "../../store/toastStore";

const ICONS = {
  info: <Info size={14} />,
  success: <CheckCircle size={14} />,
  error: <XCircle size={14} />,
  warning: <AlertTriangle size={14} />,
};

export function ToastContainer() {
  const { toasts, dismissToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}${t.exiting ? " exiting" : ""}`}>
          {ICONS[t.type]}
          <span style={{ flex: 1 }}>{t.message}</span>
          <button
            onClick={() => dismissToast(t.id)}
            style={{ color: "inherit", opacity: 0.6, padding: 2, flexShrink: 0 }}
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
