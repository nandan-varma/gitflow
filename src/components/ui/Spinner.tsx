import React from "react";

interface Props {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Spinner({ size = "md", className = "" }: Props) {
  const cls = size === "sm" ? "spinner spinner-sm" : size === "lg" ? "spinner spinner-lg" : "spinner";
  return <span className={`${cls} ${className}`} />;
}
