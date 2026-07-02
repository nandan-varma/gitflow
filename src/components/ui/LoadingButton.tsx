import React from "react";
import { Spinner } from "./Spinner";

interface Props {
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

export function LoadingButton({ loading, disabled, onClick, children, style, className }: Props) {
  const isDisabled = disabled || loading;
  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 14px",
        borderRadius: 5,
        background: isDisabled ? "var(--bg-elevated)" : "var(--accent)",
        color: isDisabled ? "var(--text-muted)" : "#fff",
        fontWeight: 500,
        fontSize: 12,
        border: "1px solid transparent",
        cursor: isDisabled ? "default" : "pointer",
        opacity: isDisabled ? 0.6 : 1,
        ...style,
      }}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}
