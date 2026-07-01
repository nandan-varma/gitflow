import React from "react";
import type { DiffLine as DiffLineType } from "../../types/diff";

interface Props {
  line: DiffLineType;
  lineKey: string;
  selected?: boolean;
  onToggle?: () => void;
  showLineNumbers?: boolean;
}

const ORIGIN_COLOR: Record<string, string> = {
  "+": "var(--diff-add-text)",
  "-": "var(--diff-del-text)",
};

const ORIGIN_BG: Record<string, string> = {
  "+": "var(--diff-add-bg)",
  "-": "var(--diff-del-bg)",
};

export function DiffLine({ line, lineKey, selected, onToggle, showLineNumbers = true }: Props) {
  const bg = ORIGIN_BG[line.origin] ?? "transparent";
  const color = ORIGIN_COLOR[line.origin] ?? "var(--text-secondary)";
  const isChangeLine = line.origin === "+" || line.origin === "-";

  return (
    <div
      style={{
        display: "flex",
        background: selected ? "rgba(76,139,245,0.18)" : bg,
        outline: selected ? "1px inset rgba(76,139,245,0.4)" : undefined,
        minHeight: 20,
        cursor: isChangeLine && onToggle ? "pointer" : "default",
      }}
      onClick={isChangeLine && onToggle ? onToggle : undefined}
    >
      {showLineNumbers && (
        <>
          <span
            style={{
              width: 48,
              textAlign: "right",
              padding: "0 8px",
              fontSize: 11,
              color: "var(--text-muted)",
              fontFamily: "var(--font-mono)",
              userSelect: "none",
              flexShrink: 0,
              borderRight: "1px solid var(--border)",
            }}
          >
            {line.old_lineno ?? ""}
          </span>
          <span
            style={{
              width: 48,
              textAlign: "right",
              padding: "0 8px",
              fontSize: 11,
              color: "var(--text-muted)",
              fontFamily: "var(--font-mono)",
              userSelect: "none",
              flexShrink: 0,
              borderRight: "1px solid var(--border)",
            }}
          >
            {line.new_lineno ?? ""}
          </span>
        </>
      )}
      <span
        style={{
          width: 16,
          textAlign: "center",
          color,
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          userSelect: "none",
          flexShrink: 0,
        }}
      >
        {line.origin === " " ? " " : line.origin}
      </span>
      <pre
        style={{
          flex: 1,
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          lineHeight: "20px",
          color: "var(--text-primary)",
          whiteSpace: "pre",
          overflow: "visible",
          margin: 0,
          padding: "0 8px",
          userSelect: "text",
          WebkitUserSelect: "text",
        }}
      >
        {line.content.replace(/\n$/, "")}
      </pre>
    </div>
  );
}
