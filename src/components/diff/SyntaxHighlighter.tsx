import React, { useEffect, useState } from "react";
import type { Highlighter } from "shiki";

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = import("shiki").then(({ createHighlighter }) =>
      createHighlighter({
        themes: ["github-dark"],
        langs: [
          "typescript", "javascript", "rust", "python", "go", "java",
          "css", "html", "json", "yaml", "toml", "markdown", "bash",
          "c", "cpp", "csharp", "ruby", "swift", "kotlin", "scala",
        ],
      })
    );
  }
  return highlighterPromise;
}

function langFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
    rs: "rust", py: "python", go: "go", java: "java", css: "css",
    html: "html", json: "json", yaml: "yaml", yml: "yaml", toml: "toml",
    md: "markdown", sh: "bash", c: "c", cpp: "cpp", cs: "csharp",
    rb: "ruby", swift: "swift", kt: "kotlin", scala: "scala",
  };
  return map[ext] ?? "text";
}

interface Props {
  code: string;
  path: string;
}

export function SyntaxHighlighter({ code, path }: Props) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getHighlighter().then((hl) => {
      if (cancelled) return;
      const lang = langFromPath(path);
      try {
        const result = hl.codeToHtml(code, { lang, theme: "github-dark" });
        setHtml(result);
      } catch {
        setHtml(`<pre>${code.replace(/</g, "&lt;")}</pre>`);
      }
    });
    return () => { cancelled = true; };
  }, [code, path]);

  if (!html) {
    return (
      <pre
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          lineHeight: 1.5,
          color: "var(--text-secondary)",
        }}
      >
        {code}
      </pre>
    );
  }

  return (
    <div
      dangerouslySetInnerHTML={{ __html: html }}
      style={{ fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.5 }}
    />
  );
}
