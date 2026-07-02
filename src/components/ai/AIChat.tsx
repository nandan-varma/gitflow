import React, { useEffect, useMemo, useRef, useState } from "react";
import OpenAI from "openai";
import { Sparkles, X, Square, Plus, Send } from "lucide-react";
import { useSettingsStore } from "../../store/settingsStore";
import { useUIStore } from "../../store/uiStore";
import { tools, DANGEROUS_TOOLS, executeTool } from "../../lib/aiTools";
import { toErrMsg } from "../../lib/ipc";

const SYSTEM_PROMPT =
  "You are the AI assistant embedded in GitFlow Studio, a git GUI desktop app. " +
  "You operate on the user's currently open repository through tools. " +
  "Call get_repo_info and get_status first when you need context — don't guess repository state. " +
  "After a mutation, briefly confirm what you did. Be concise; answer in plain prose, no markdown headers.";

type Msg = OpenAI.ChatCompletionMessageParam;
type ToolCall = OpenAI.ChatCompletionMessageToolCall;

interface Approval {
  call: { name: string; args: string };
  resolve: (approved: boolean) => void;
}

export function AIChat() {
  const { aiBaseUrl, aiModel, aiApiKey } = useSettingsStore();
  const setActiveView = useUIStore((s) => s.setActiveView);

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamText, setStreamText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approval, setApproval] = useState<Approval | null>(null);

  const streamRef = useRef<{ abort: () => void } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const configured = aiBaseUrl.trim() !== "" && aiModel.trim() !== "";
  const client = useMemo(
    () => new OpenAI({ apiKey: aiApiKey || "none", baseURL: aiBaseUrl, dangerouslyAllowBrowser: true }),
    [aiApiKey, aiBaseUrl],
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streamText, approval]);

  async function send() {
    const text = input.trim();
    if (!text || busy || !configured) return;
    setInput("");
    setError(null);
    setBusy(true);

    let history: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(history);

    try {
      // Manual agentic loop: stream, execute tool calls (gating dangerous ones), repeat.
      for (;;) {
        setStreamText("");
        const stream = client.chat.completions.stream({
          model: aiModel,
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
          tools,
        });
        streamRef.current = stream;
        stream.on("content", (_delta, snapshot) => setStreamText(snapshot));

        const completion = await stream.finalChatCompletion();
        const msg = completion.choices[0].message;
        history = [...history, msg as Msg];
        setMessages(history);
        setStreamText(null);

        const calls = (msg.tool_calls ?? []).filter(
          (c): c is Extract<ToolCall, { type: "function" }> => c.type === "function",
        );
        if (calls.length === 0) break;

        const results: Msg[] = [];
        for (const call of calls) {
          let content: string;
          if (
            DANGEROUS_TOOLS.has(call.function.name) &&
            !(await new Promise<boolean>((resolve) =>
              setApproval({ call: { name: call.function.name, args: call.function.arguments }, resolve }),
            ).finally(() => setApproval(null)))
          ) {
            content = "User denied this action.";
          } else {
            try {
              content = await executeTool(call.function.name, JSON.parse(call.function.arguments || "{}"));
            } catch (e) {
              content = `Error: ${toErrMsg(e)}`;
            }
          }
          results.push({ role: "tool", tool_call_id: call.id, content });
        }
        history = [...history, ...results];
        setMessages(history);
      }
    } catch (e) {
      if (!(e instanceof OpenAI.APIUserAbortError)) setError(toErrMsg(e));
    } finally {
      streamRef.current = null;
      setStreamText(null);
      setBusy(false);
    }
  }

  function stop() {
    streamRef.current?.abort();
    approval?.resolve(false);
  }

  function newChat() {
    stop();
    setMessages([]);
    setError(null);
  }

  return (
    <>
      {open && (
        <div style={{
          position: "fixed", right: 16, bottom: 64, width: 380, height: 520, zIndex: 90,
          display: "flex", flexDirection: "column",
          background: "var(--bg-elevated)", border: "1px solid var(--border)",
          borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
            <Sparkles size={14} style={{ color: "var(--accent)" }} />
            <span style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>Assistant</span>
            <button title="New chat" onClick={newChat} style={{ color: "var(--text-muted)", padding: 4 }}><Plus size={14} /></button>
            <button title="Close" onClick={() => setOpen(false)} style={{ color: "var(--text-muted)", padding: 4 }}><X size={14} /></button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} style={{ flex: 1, overflow: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {!configured ? (
              <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                Set a base URL, model, and API key to enable the assistant.{" "}
                <button
                  onClick={() => { setActiveView("settings"); setOpen(false); }}
                  style={{ color: "var(--accent)", textDecoration: "underline", padding: 0 }}
                >
                  Open Settings
                </button>
              </div>
            ) : messages.length === 0 && !streamText ? (
              <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
                Ask anything about this repo — or tell me to stage, commit, branch, stash, push, or manage PRs.
              </div>
            ) : null}

            {messages.map((m, i) => {
              if (m.role === "user") {
                return (
                  <div key={i} data-selectable style={{
                    alignSelf: "flex-end", maxWidth: "85%", padding: "6px 10px", borderRadius: 8,
                    background: "var(--accent)", color: "#fff", fontSize: 12.5, whiteSpace: "pre-wrap", userSelect: "text",
                  }}>
                    {typeof m.content === "string" ? m.content : ""}
                  </div>
                );
              }
              if (m.role === "assistant") {
                const calls = (m.tool_calls ?? []).filter((c): c is Extract<ToolCall, { type: "function" }> => c.type === "function");
                return (
                  <div key={i} style={{ alignSelf: "flex-start", maxWidth: "95%", display: "flex", flexDirection: "column", gap: 4 }}>
                    {typeof m.content === "string" && m.content && (
                      <div data-selectable style={{ fontSize: 12.5, color: "var(--text-primary)", whiteSpace: "pre-wrap", lineHeight: 1.55, userSelect: "text" }}>
                        {m.content}
                      </div>
                    )}
                    {calls.map((c) => (
                      <div key={c.id} style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                        ▸ {c.function.name} {c.function.arguments !== "{}" ? c.function.arguments : ""}
                      </div>
                    ))}
                  </div>
                );
              }
              return null; // tool results aren't rendered
            })}

            {streamText !== null && (
              <div data-selectable style={{ alignSelf: "flex-start", maxWidth: "95%", fontSize: 12.5, color: "var(--text-primary)", whiteSpace: "pre-wrap", lineHeight: 1.55, userSelect: "text" }}>
                {streamText || <span style={{ color: "var(--text-muted)" }}>Thinking…</span>}
              </div>
            )}

            {approval && (
              <div style={{ border: "1px solid var(--warning)", borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 11, color: "var(--warning)", fontWeight: 600 }}>Approve this action?</div>
                <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-secondary)", wordBreak: "break-all" }}>
                  {approval.call.name} {approval.call.args}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => approval.resolve(true)} style={{ padding: "4px 12px", fontSize: 11, borderRadius: 4, background: "var(--accent)", color: "#fff", fontWeight: 500 }}>
                    Approve
                  </button>
                  <button onClick={() => approval.resolve(false)} style={{ padding: "4px 12px", fontSize: 11, borderRadius: 4, border: "1px solid var(--border)", color: "var(--text-secondary)", background: "var(--bg-elevated)" }}>
                    Deny
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div data-selectable style={{ fontSize: 11, color: "var(--danger, #e5534b)", whiteSpace: "pre-wrap", userSelect: "text" }}>
                {error}
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{ display: "flex", gap: 6, padding: 10, borderTop: "1px solid var(--border)", flexShrink: 0 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={configured ? "Ask or instruct…" : "Configure AI in Settings first"}
              disabled={!configured || busy}
              style={{ flex: 1, fontSize: 12.5, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-primary, transparent)", color: "var(--text-primary)" }}
            />
            {busy ? (
              <button title="Stop" onClick={stop} style={{ padding: "0 10px", borderRadius: 6, border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                <Square size={13} />
              </button>
            ) : (
              <button title="Send" onClick={send} disabled={!configured || !input.trim()} style={{ padding: "0 10px", borderRadius: 6, background: "var(--accent)", color: "#fff", opacity: !configured || !input.trim() ? 0.5 : 1 }}>
                <Send size={13} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Floating toggle button */}
      <button
        title="AI Assistant"
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "fixed", right: 16, bottom: 16, zIndex: 90,
          width: 40, height: 40, borderRadius: "50%",
          background: open ? "var(--bg-elevated)" : "var(--accent)",
          border: "1px solid var(--border)",
          color: open ? "var(--text-secondary)" : "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 12px rgba(0,0,0,0.35)",
        }}
      >
        {open ? <X size={16} /> : <Sparkles size={16} />}
      </button>
    </>
  );
}
