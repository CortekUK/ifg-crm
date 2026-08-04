"use client";
import { useState, useRef, useEffect, Fragment } from "react";
import { Icon } from "./icons";
import { ChatApplyForm } from "./chat-apply-form";

type FormDirective = { programme: string; prefill?: Record<string, string> };
type Msg = { role: "user" | "assistant"; content: string; form?: FormDirective };
type Lead = { firstName: string; lastName: string; email: string };

const LEAD_KEY = "ifg_chat_lead";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The greeting is personalised once we know the visitor's name (captured by the
// opening gate), otherwise a neutral welcome.
function greeting(firstName?: string) {
  const hi = firstName ? `Hi ${firstName}!` : "Hi!";
  return `${hi} I'm the IFG assistant. I can help with our football programmes, applications, or booking a call. What are you looking for?`;
}

const QUICK_ACTIONS: { label: string; href: string }[] = [
  { label: "Apply now", href: "/programmes/macclesfield/apply" },
  { label: "Explore programmes", href: "/programmes" },
  { label: "Book a call", href: "/contact" },
];

// Render inline markdown within a single line: **bold** and [text](url) links.
// No HTML injection — we build React nodes.
function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(<Fragment key={`${keyBase}t${key++}`}>{text.slice(last, m.index)}</Fragment>);
    if (m[1] !== undefined) {
      nodes.push(<strong key={`${keyBase}b${key++}`}>{m[1]}</strong>);
    } else {
      const [, , label, url] = m;
      const external = /^https?:\/\//.test(url);
      nodes.push(
        <a key={`${keyBase}a${key++}`} href={url} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>
          {label}
        </a>,
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(<Fragment key={`${keyBase}t${key++}`}>{text.slice(last)}</Fragment>);
  return nodes;
}

// Render an assistant message as light markdown: paragraphs, bold, links, and
// bullet lists (lines starting with "- ", "* " or "1."). Bullets and bold are
// styled in the brand primary via CSS so a list of fields reads as clean,
// prominent bullets rather than a run-on sentence.
function renderContent(text: string) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  let para: string[] = [];
  let k = 0;

  const flushPara = () => {
    if (!para.length) return;
    blocks.push(<p key={`p${k}`} className="aw-p">{renderInline(para.join("\n"), `p${k++}`)}</p>);
    para = [];
  };
  const flushList = () => {
    if (!list.length) return;
    const items = list;
    blocks.push(
      <ul key={`u${k}`} className="aw-list">
        {items.map((item, i) => (
          <li key={i}>{renderInline(item, `u${k}i${i}`)}</li>
        ))}
      </ul>,
    );
    k++;
    list = [];
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    const bullet = line.match(/^\s*[-*]\s+(.*)$/) || line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet) {
      flushPara();
      list.push(bullet[1]);
    } else if (line.trim() === "") {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return blocks;
}

export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: greeting() }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const gateRef = useRef<HTMLInputElement>(null);

  // Lead gate: the chat is locked behind a name + email form until the visitor
  // submits it. On submit we save the lead to the CRM immediately, so it's never
  // lost even if they abandon the chat. Once captured (remembered per browser),
  // returning visitors skip the gate.
  const [gated, setGated] = useState(true);
  const [lead, setLead] = useState<Lead | null>(null);
  const [gateName, setGateName] = useState("");
  const [gateEmail, setGateEmail] = useState("");
  const [gateErrors, setGateErrors] = useState<{ name?: string; email?: string }>({});
  const [gateSubmitting, setGateSubmitting] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);

  // On mount, unlock immediately if we've already captured this visitor.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LEAD_KEY);
      if (raw) {
        const l = JSON.parse(raw) as Lead;
        if (l?.email) {
          setLead(l);
          setGated(false);
          setMessages([{ role: "assistant", content: greeting(l.firstName) }]);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Auto-scroll to newest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // Focus the right field when the panel opens — the gate while locked, the
  // message box once unlocked.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => (gated ? gateRef.current : inputRef.current)?.focus(), 80);
    return () => clearTimeout(t);
  }, [open, gated]);

  async function submitGate(e: React.FormEvent) {
    e.preventDefault();
    if (gateSubmitting) return;
    const name = gateName.trim();
    const email = gateEmail.trim();
    const errs: { name?: string; email?: string } = {};
    if (!name) errs.name = "Please enter your name";
    if (!EMAIL_RE.test(email)) errs.email = "Enter a valid email address";
    setGateErrors(errs);
    if (Object.keys(errs).length) return;

    setGateSubmitting(true);
    setGateError(null);
    try {
      const res = await fetch("/api/assistant/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setGateError(data.error || "Couldn't save your details. Please try again.");
        setGateSubmitting(false);
        return;
      }
      const parts = name.split(/\s+/).filter(Boolean);
      const l: Lead = { firstName: parts[0] || "", lastName: parts.slice(1).join(" "), email };
      try {
        localStorage.setItem(LEAD_KEY, JSON.stringify(l));
      } catch {
        /* ignore */
      }
      setLead(l);
      setMessages([{ role: "assistant", content: greeting(l.firstName) }]);
      setGated(false);
    } catch {
      setGateError("Couldn't reach the service. Please try again.");
      setGateSubmitting(false);
    }
  }

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
      // Drop our opening greeting (index 0) — the API only wants real turns.
      const apiMessages = next.filter((m, i) => !(i === 0 && m.role === "assistant"));
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
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply || "", form: data.form as FormDirective | undefined },
      ]);
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

        <div className="aw-body" ref={scrollRef} data-lenis-prevent>
          {gated ? (
            <form className="aw-gate" onSubmit={submitGate} noValidate>
              <p className="aw-gate-lead">Before we start, who are we chatting with?</p>
              <p className="aw-gate-sub">Add your name and email so the team can follow up — it takes a second.</p>
              <div className={"field" + (gateErrors.name ? " invalid" : "")}>
                <label htmlFor="aw-gate-name">Your name</label>
                <input
                  id="aw-gate-name"
                  ref={gateRef}
                  value={gateName}
                  onChange={(e) => setGateName(e.target.value)}
                  placeholder="Marco Rossi"
                  autoComplete="name"
                />
                {gateErrors.name && <span className="field-err">{gateErrors.name}</span>}
              </div>
              <div className={"field" + (gateErrors.email ? " invalid" : "")}>
                <label htmlFor="aw-gate-email">Email</label>
                <input
                  id="aw-gate-email"
                  type="email"
                  value={gateEmail}
                  onChange={(e) => setGateEmail(e.target.value)}
                  placeholder="you@email.com"
                  autoComplete="email"
                />
                {gateErrors.email && <span className="field-err">{gateErrors.email}</span>}
              </div>
              {gateError && <p className="field-err caf-err-top">{gateError}</p>}
              <button type="submit" className="btn btn-primary aw-gate-submit" disabled={gateSubmitting}>
                {gateSubmitting ? "Starting…" : "Start chat"}
                {!gateSubmitting && <Icon name="arrow-right" className="ic" size={16} />}
              </button>
              <p className="aw-gate-consent">By continuing you agree to be contacted by the IFG team.</p>
            </form>
          ) : (
            <>
              {messages.map((m, i) => (
                <div key={i} className={"aw-msg " + m.role}>
                  {m.content && <div className="aw-bubble">{renderContent(m.content)}</div>}
                  {m.form && (
                    <ChatApplyForm
                      programme={m.form.programme}
                      prefill={{
                        ...(lead ? { firstName: lead.firstName, lastName: lead.lastName, email: lead.email } : {}),
                        ...m.form.prefill,
                      }}
                      onSubmitted={() =>
                        setMessages((prev) => [
                          ...prev,
                          { role: "assistant", content: "Thanks! Your application is in — the IFG team will review it and follow up soon." },
                        ])
                      }
                    />
                  )}
                </div>
              ))}
              {loading && (
                <div className="aw-msg assistant">
                  <div className="aw-bubble aw-typing"><span /><span /><span /></div>
                </div>
              )}
              {error && <div className="aw-error">{error}</div>}
            </>
          )}
        </div>

        {!gated && (
          <>
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
          </>
        )}
      </div>
    </>
  );
}
