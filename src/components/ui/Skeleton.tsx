import React from "react";

interface Props {
  variant?: "text" | "row" | "card" | "circle";
  width?: number | string;
  height?: number;
  count?: number;
  borderRadius?: number;
}

export function Skeleton({ variant = "text", width, height, count = 1, borderRadius }: Props) {
  const style: React.CSSProperties = {
    borderRadius: borderRadius ?? (variant === "circle" ? "50%" : 4),
    flexShrink: 0,
  };

  if (variant === "text") {
    style.height = height ?? 12;
    style.width = width ?? "100%";
    style.marginBottom = 6;
  } else if (variant === "row") {
    style.height = height ?? 28;
    style.width = width ?? "100%";
    style.marginBottom = 2;
  } else if (variant === "card") {
    style.height = height ?? 120;
    style.width = width ?? "100%";
  } else if (variant === "circle") {
    style.width = width ?? 32;
    style.height = height ?? 32;
  }

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton" style={style} />
      ))}
    </>
  );
}
