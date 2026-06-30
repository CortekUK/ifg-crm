"use client";
import { useState, useRef, useEffect, Fragment } from "react";
import { Icon } from "./icons";

type Msg = { role: "user" | "assistant"; content: string };

const GREETING =
  "Hi! I'm the IFG assistant. I can help with our football programmes, applications, or booking a call. What are you looking for?";

const QUICK_ACTIONS: { label: string; href: string }[] = [
  { label: "Apply now", href: "/programmes/macclesfield/apply" },
  { label: "Explore programmes", href: "/programmes" },
  { label: "Book a call", href: "/contact" },
];

// Render a plain-text assistant message, converting markdown links
// [text](url) into real anchors. No HTML injection — we build React nodes.
function renderContent(text: string) {
  const parts: React.ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(<Fragment key={key++}>{text.slice(last, m.index)}</Fragment>);
    const [, label, url] = m;
    const external = /^https?:\/\//.test(url);
    parts.push(
      <a key={key++} href={url} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>
        {label}
      </a>,
    );
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(<Fragment key={key++}>{text.slice(last)}</Fragment>);
  return parts;
}

export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: GREETING }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to newest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // Focus the input when the panel opens.
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setError(null);
    setInput("");

    // The API only needs the conversation turns (not the static greeting).
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setLoading(true);

    try {
      const apiMessages = next.filter((m, i) => !(i === 0 && m.content === GREETING));
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply || "" }]);
    } catch {
      setError("Could not reach the assistant. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <>
      {/* Launcher */}
      <button
        className={"aw-launcher" + (open ? " open" : "")}
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close assistant" : "Open assistant"}
        aria-expanded={open}
      >
        <Icon name={open ? "x" : "sparkles"} size={20} />
        {!open && <span className="aw-launcher-label">Can we help?</span>}
      </button>

      {/* Panel */}
      <div className={"aw-panel" + (open ? " open" : "")} role="dialog" aria-label="IFG assistant">
        <div className="aw-head">
          <div className="aw-head-title">
            <Icon name="sparkles" size={16} />
            <span>IFG Assistant</span>
          </div>
          <button className="aw-close" onClick={() => setOpen(false)} aria-label="Close">
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="aw-body" ref={scrollRef}>
          {messages.map((m, i) => (
            <div key={i} className={"aw-msg " + m.role}>
              <div className="aw-bubble">{renderContent(m.content)}</div>
            </div>
          ))}
          {loading && (
            <div className="aw-msg assistant">
              <div className="aw-bubble aw-typing"><span /><span /><span /></div>
            </div>
          )}
          {error && <div className="aw-error">{error}</div>}
        </div>

        <div className="aw-quick">
          {QUICK_ACTIONS.map((a) => (
            <a key={a.href} href={a.href} className="aw-chip">{a.label}</a>
          ))}
        </div>

        <div className="aw-input">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask about programmes, applications…"
            aria-label="Message"
          />
          <button onClick={send} disabled={loading || !input.trim()} aria-label="Send">
            <Icon name="arrow-right" size={18} />
          </button>
        </div>
      </div>
    </>
  );
}
