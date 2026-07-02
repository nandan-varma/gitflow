import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import OpenAI from "openai";
import { Sparkles, X, Square, Plus, Send, AlertTriangle } from "lucide-react";
import { useSettingsStore } from "../../store/settingsStore";
import { useUIStore } from "../../store/uiStore";
import { useAIStore } from "../../store/aiStore";
import { tools, DANGEROUS_TOOLS, executeTool } from "../../lib/aiTools";
import { ToolCallCard } from "./ToolCallCard";
import { toErrMsg } from "../../lib/ipc";

const SYSTEM_PROMPT =
  "You are the AI assistant embedded in GitFlow Studio, a git GUI desktop app. " +
  "You operate on the user's currently open repository through tools. " +
  "Call get_repo_info and get_status first when you need context — don't guess repository state. " +
  "After a mutation, briefly confirm what you did. Be concise; answer in plain prose, no markdown headers. " +
  "Use a natural, conversational tone.";

type Msg = OpenAI.ChatCompletionMessageParam;
type ToolCall = OpenAI.ChatCompletionMessageToolCall;

interface Approval {
  call: { name: string; args: string };
  resolve: (approved: boolean) => void;
}

const QUICK_ACTIONS = [
  { label: "Show status", prompt: "Show me the current git status" },
  { label: "Recent commits", prompt: "Show me the 10 most recent commits" },
  { label: "Stage all", prompt: "Stage all unstaged changes" },
  { label: "Create branch", prompt: "Create a new branch from HEAD" },
  { label: "Check stash", prompt: "Show me the stash list" },
];

function tick() {
  return new Promise<void>((r) => requestAnimationFrame(() => r()));
}

export function AIChat() {
  const { aiBaseUrl, aiModel, aiApiKey } = useSettingsStore();
  const setActiveView = useUIStore((s) => s.setActiveView);

  const {
    open, setOpen,
    messages, streamText, toolCalls, busy, error,
    addMessage, updateStream,
    startToolCall, runToolCall, completeToolCall, failToolCall,
    setBusy, setError, clearChat,
  } = useAIStore();

  const [input, setInput] = useState("");
  const [approval, setApproval] = useState<Approval | null>(null);
  const [panelWidth, setPanelWidth] = useState(400);

  const streamRef = useRef<{ abort: () => void } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const configured = aiBaseUrl.trim() !== "" && aiModel.trim() !== "";
  const client = useMemo(
    () => new OpenAI({ apiKey: aiApiKey || "none", baseURL: aiBaseUrl, dangerouslyAllowBrowser: true }),
    [aiApiKey, aiBaseUrl],
  );

  // Auto-scroll when content changes (only if near bottom)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    if (nearBottom) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, streamText, toolCalls, approval]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function send(prompt?: string) {
    const text = (prompt ?? input).trim();
    if (!text || busy || !configured) return;
    setInput("");
    setError(null);
    setBusy(true);

    let history: Msg[] = [...messages, { role: "user", content: text }];
    addMessage({ role: "user", content: text });

    try {
      for (;;) {
        updateStream("");
        const stream = client.chat.completions.stream({
          model: aiModel,
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
          tools,
        });
        streamRef.current = stream;
        stream.on("content", (_delta, snapshot) => updateStream(snapshot));

        const completion = await stream.finalChatCompletion();
        const msg = completion.choices[0].message;
        history = [...history, msg as Msg];
        addMessage(msg as Msg);
        updateStream(null);

        const calls = (msg.tool_calls ?? []).filter(
          (c): c is Extract<ToolCall, { type: "function" }> => c.type === "function",
        );
        if (calls.length === 0) break;

        for (const call of calls) {
          startToolCall(call.id, call.function.name, call.function.arguments);
          await tick();
          runToolCall(call.id);
          await tick();

          let content: string;
          if (
            DANGEROUS_TOOLS.has(call.function.name) &&
            !(await new Promise<boolean>((resolve) =>
              setApproval({ call: { name: call.function.name, args: call.function.arguments }, resolve }),
            ).finally(() => setApproval(null)))
          ) {
            content = "User denied this action.";
            failToolCall(call.id, "User denied this action.");
          } else {
            try {
              content = await executeTool(call.function.name, JSON.parse(call.function.arguments || "{}"));
              completeToolCall(call.id, content);
            } catch (e) {
              content = `Error: ${toErrMsg(e)}`;
              failToolCall(call.id, toErrMsg(e));
            }
          }
          const toolMsg: Msg = { role: "tool", tool_call_id: call.id, content };
          history = [...history, toolMsg];
          addMessage(toolMsg);
        }
      }
    } catch (e) {
      if (!(e instanceof OpenAI.APIUserAbortError)) setError(toErrMsg(e));
    } finally {
      streamRef.current = null;
      updateStream(null);
      setBusy(false);
    }
  }

  function stop() {
    streamRef.current?.abort();
    approval?.resolve(false);
  }

  function newChat() {
    stop();
    clearChat();
    setError(null);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  // ── Resize ──────────────────────────────────
  const resizing = useRef(false);
  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = panelWidth;
    const onMove = (ev: MouseEvent) => {
      setPanelWidth(Math.max(320, Math.min(600, startW - (ev.clientX - startX))));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [panelWidth]);

  // ── Hold-to-approve state ───────────────────
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdStart = useRef(0);

  const startHold = () => {
    if (!approval) return;
    holdStart.current = Date.now();
    holdTimer.current = setInterval(() => {
      const pct = Math.min(1, (Date.now() - holdStart.current) / 800);
      setHoldProgress(pct);
      if (pct >= 1) {
        clearInterval(holdTimer.current!);
        holdTimer.current = null;
        setHoldProgress(0);
        approval.resolve(true);
      }
    }, 16);
  };

  const cancelHold = () => {
    if (holdTimer.current) {
      clearInterval(holdTimer.current);
      holdTimer.current = null;
    }
    setHoldProgress(0);
  };

  useEffect(() => () => cancelHold(), []);

  // ── Render ──────────────────────────────────
  return (
    <>
      {/* Panel */}
      {open && (
        <div
          className="ai-panel-open"
          style={{
            position: "fixed",
            right: 60,
            bottom: 64,
            width: panelWidth,
            height: 540,
            zIndex: 90,
            display: "flex",
            flexDirection: "column",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            boxShadow: "0 8px 40px rgba(0,0,0,0.45)",
            overflow: "hidden",
          }}
        >
          {/* Resize handle (left edge) */}
          <div
            onMouseDown={startResize}
            style={{
              position: "absolute",
              left: 0, top: 0, bottom: 0,
              width: 4,
              cursor: "ew-resize",
              zIndex: 10,
            }}
            title="Drag to resize"
          />

          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 14px",
              borderBottom: "1px solid var(--border)",
              flexShrink: 0,
            }}
          >
            <Sparkles size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, fontWeight: 600, flex: 1 }}>Assistant</span>
            {busy && (
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>running…</span>
            )}
            <button
              title="New conversation"
              onClick={newChat}
              style={{ color: "var(--text-muted)", padding: 4, borderRadius: 4 }}
            >
              <Plus size={14} />
            </button>
            <button
              title="Close"
              onClick={() => setOpen(false)}
              style={{ color: "var(--text-muted)", padding: 4, borderRadius: 4 }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            style={{
              flex: 1,
              overflow: "auto",
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {!configured ? (
              <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, textAlign: "center", marginTop: 32 }}>
                Set a base URL, model, and API key to enable the assistant.
                <br />
                <button
                  onClick={() => { setActiveView("settings"); setOpen(false); }}
                  style={{ color: "var(--accent)", textDecoration: "underline", padding: 0, marginTop: 8 }}
                >
                  Open Settings
                </button>
              </div>
            ) : messages.length === 0 && !streamText ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16, alignItems: "center" }}>
                <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6, textAlign: "center" }}>
                  Ask anything about this repo — or tell me to stage, commit, branch, stash, push, or manage PRs.
                </div>
                {/* Quick action chips */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", padding: "0 8px" }}>
                  {QUICK_ACTIONS.map((qa) => (
                    <button
                      key={qa.label}
                      className="quick-chip"
                      onClick={() => { setInput(qa.prompt); inputRef.current?.focus(); }}
                      disabled={busy}
                    >
                      {qa.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Render messages */}
            {messages.map((m, i) => {
              if (m.role === "user") {
                return (
                  <div key={i} className="msg-user">
                    {typeof m.content === "string" ? m.content : ""}
                  </div>
                );
              }
              if (m.role === "assistant") {
                const calls = (m.tool_calls ?? []).filter(
                  (c): c is Extract<ToolCall, { type: "function" }> => c.type === "function",
                );
                return (
                  <div key={i} style={{ alignSelf: "flex-start", maxWidth: "95%", display: "flex", flexDirection: "column", gap: 4 }}>
                    {typeof m.content === "string" && m.content && (
                      <div className="msg-assistant-text">
                        {m.content}
                      </div>
                    )}
                    {/* Show tool call names inline */}
                    {calls.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {calls.map((c) => (
                          <span
                            key={c.id}
                            style={{
                              fontSize: 10.5,
                              fontFamily: "var(--font-mono)",
                              color: "var(--text-muted)",
                              background: "var(--bg-hover)",
                              padding: "2px 6px",
                              borderRadius: 4,
                            }}
                          >
                            {c.function.name}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Render ToolCallCards for this message's tool calls */}
                    {calls.map((c) => {
                      const status = toolCalls.find((tc) => tc.id === c.id);
                      if (!status) return null;
                      return <ToolCallCard key={c.id} call={status} />;
                    })}
                  </div>
                );
              }
              // Tool result messages — we render via ToolCallCard attached to the assistant msg above,
              // so we return null here to avoid duplicates.
              return null;
            })}

            {/* Live streaming text */}
            {streamText !== null && (
              <div
                data-selectable
                style={{
                  alignSelf: "flex-start",
                  maxWidth: "95%",
                  fontSize: 12.5,
                  color: "var(--text-primary)",
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.55,
                  userSelect: "text",
                }}
              >
                {streamText || (
                  <span style={{ color: "var(--text-muted)" }}>
                    Thinking
                    <span className="streaming-cursor" />
                  </span>
                )}
                {streamText && <span className="streaming-cursor" />}
              </div>
            )}

            {/* Approval dialog */}
            {approval && (
              <div className="danger-approval" style={{
                border: "1px solid var(--danger)",
                borderRadius: 10,
                padding: 12,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                background: "rgba(244,67,54,0.06)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <AlertTriangle size={14} style={{ color: "var(--danger)", flexShrink: 0 }} />
                  <span style={{ fontSize: 11.5, color: "var(--danger)", fontWeight: 600 }}>
                    Confirm destructive action
                  </span>
                </div>
                <div style={{
                  fontSize: 11.5,
                  fontFamily: "var(--font-mono)",
                  color: "var(--text-secondary)",
                  wordBreak: "break-all",
                  background: "var(--bg-base)",
                  padding: "6px 8px",
                  borderRadius: 6,
                }}>
                  {approval.call.name} {approval.call.args}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {/* Hold-to-approve button */}
                  <button
                    onMouseDown={startHold}
                    onMouseUp={cancelHold}
                    onMouseLeave={cancelHold}
                    style={{
                      position: "relative",
                      overflow: "hidden",
                      padding: "6px 16px",
                      fontSize: 11.5,
                      borderRadius: 6,
                      background: "var(--danger)",
                      color: "#fff",
                      fontWeight: 500,
                      border: "none",
                      cursor: "pointer",
                      userSelect: "none",
                      minWidth: 130,
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${holdProgress * 100}%`,
                        background: "rgba(0,0,0,0.2)",
                        transition: "width 0.1s linear",
                        borderRadius: 6,
                      }}
                    />
                    <span style={{ position: "relative" }}>
                      {holdProgress > 0 ? "Holding..." : "Hold to Approve"}
                    </span>
                  </button>
                  <button
                    onClick={() => { cancelHold(); approval.resolve(false); }}
                    style={{
                      padding: "6px 14px",
                      fontSize: 11.5,
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                      color: "var(--text-secondary)",
                      background: "var(--bg-elevated)",
                      cursor: "pointer",
                    }}
                  >
                    Deny
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div
                data-selectable
                style={{
                  fontSize: 11,
                  color: "var(--danger)",
                  whiteSpace: "pre-wrap",
                  userSelect: "text",
                  padding: "6px 8px",
                  background: "rgba(244,67,54,0.06)",
                  borderRadius: 6,
                }}
              >
                {error}
              </div>
            )}
          </div>

          {/* Input bar */}
          <div style={{ display: "flex", gap: 6, padding: 10, borderTop: "1px solid var(--border)", flexShrink: 0 }}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={configured ? "Ask or instruct…" : "Configure AI in Settings first"}
              disabled={!configured || busy}
              style={{
                flex: 1,
                fontSize: 12.5,
                padding: "7px 10px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--bg-primary, transparent)",
                color: "var(--text-primary)",
              }}
            />
            {busy ? (
              <button
                title="Stop"
                onClick={stop}
                style={{
                  padding: "0 12px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                }}
              >
                <Square size={13} />
              </button>
            ) : (
              <button
                title="Send"
                onClick={() => send()}
                disabled={!configured || !input.trim()}
                style={{
                  padding: "0 12px",
                  borderRadius: 6,
                  background: input.trim() ? "var(--accent)" : "var(--bg-hover)",
                  color: input.trim() ? "#fff" : "var(--text-muted)",
                  border: "none",
                  cursor: input.trim() ? "pointer" : "default",
                  transition: "background 0.15s",
                }}
              >
                <Send size={13} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Floating toggle button */}
      <button
        title="AI Assistant"
        onClick={() => setOpen(!open)}
        style={{
          position: "fixed",
          right: 16,
          bottom: 16,
          zIndex: 90,
          width: 42,
          height: 42,
          borderRadius: "50%",
          background: open ? "var(--bg-elevated)" : "var(--accent)",
          border: "1px solid var(--border)",
          color: open ? "var(--text-secondary)" : "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: open
            ? "0 2px 8px rgba(0,0,0,0.2)"
            : "0 4px 16px rgba(76,139,245,0.4)",
          cursor: "pointer",
          transition: "background 0.2s, box-shadow 0.2s, transform 0.15s",
        }}
        onMouseEnter={(e) => { if (!open) e.currentTarget.style.transform = "scale(1.08)"; }}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.transform = "scale(1)"; }}
      >
        {open ? <X size={16} /> : <Sparkles size={16} />}
      </button>
    </>
  );
}
