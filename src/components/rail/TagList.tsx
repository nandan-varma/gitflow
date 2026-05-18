import React, { useState } from "react";
import { Tag, ChevronDown, ChevronRight } from "lucide-react";

export function TagList() {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <section>
      <button
        onClick={() => setCollapsed((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          width: "100%",
          padding: "6px 12px",
          color: "var(--text-muted)",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        Tags
      </button>
      {!collapsed && (
        <div style={{ padding: "4px 0", color: "var(--text-muted)", fontSize: 12, paddingLeft: 24 }}>
          Tags appear here
        </div>
      )}
    </section>
  );
}
