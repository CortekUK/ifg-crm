"use client";
import { useState } from "react";
import { Icon } from "./icons";
import { UNIVERSITY_COURSES, type UniCourse, type UniSchool } from "@/lib/data";

// Schools shown, in order. Only those with courses render.
const SCHOOLS: { key: UniSchool; blurb: string }[] = [
  { key: "Sport", blurb: "Football, coaching, therapy and sport science — degrees built for athletes." },
  { key: "Business", blurb: "Management, marketing, finance and entrepreneurship for a career off the pitch." },
  { key: "Arts", blurb: "Creative degrees spanning design, media and music." },
];

const CAPTURED_KEY = "ifg_uni_captured"; // sessionStorage flag — capture once per visit

export function UniversityCourses({ courses }: { courses?: UniCourse[] }) {
  const list = courses && courses.length ? courses : UNIVERSITY_COURSES;

  // Which School tab is open.
  const [tab, setTab] = useState<UniSchool | null>(null);

  // Capture-gate modal state.
  const [active, setActive] = useState<UniCourse | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const captured = () => {
    try { return sessionStorage.getItem(CAPTURED_KEY) === "1"; } catch { return false; }
  };

  // Tile click: if we've already captured this visit, go straight to UCLan
  // (this handler is a real user gesture, so the new tab isn't blocked).
  function openCourse(c: UniCourse) {
    if (captured()) {
      window.open(c.url, "_blank", "noopener,noreferrer");
      return;
    }
    setActive(c);
    setStatus("idle");
    setError(null);
  }

  function close() {
    setActive(null);
    setName(""); setEmail(""); setPhone("");
    setStatus("idle"); setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!active) return;
    const addr = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) {
      setError("Please enter a valid email.");
      return;
    }
    setError(null);
    setStatus("loading");
    try {
      const res = await fetch("/api/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: addr,
          name: name.trim() || undefined,
          phone: phone.trim() || undefined,
          interest: `${active.name} (${active.school} · University)`,
          source: "university_course",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }
      try { sessionStorage.setItem(CAPTURED_KEY, "1"); } catch { /* ignore */ }
      setStatus("done");
    } catch {
      setError("Could not send. Please try again.");
      setStatus("error");
    }
  }

  const grouped = SCHOOLS
    .map((s) => ({ ...s, items: list.filter((c) => c.school === s.key) }))
    .filter((s) => s.items.length);

  const activeKey = (tab && grouped.some((g) => g.key === tab)) ? tab : grouped[0]?.key;
  const activeSchool = grouped.find((g) => g.key === activeKey);

  return (
    <>
      {grouped.length > 0 && (
        <>
          <div className="uc-tabs" role="tablist" aria-label="Course categories">
            {grouped.map((s) => (
              <button
                key={s.key}
                role="tab"
                aria-selected={s.key === activeKey}
                className={"uc-tab" + (s.key === activeKey ? " on" : "")}
                onClick={() => setTab(s.key)}
                type="button"
              >
                {s.key}
                <span className="uc-tab-count">{s.items.length}</span>
              </button>
            ))}
          </div>

          {activeSchool && (
            <div className="uc-school" key={activeSchool.key}>
              <div className="uc-school-head" data-anim="up">
                <p className="uc-school-blurb">{activeSchool.blurb}</p>
              </div>
              <div className="uc-grid" data-anim="stagger">
                {activeSchool.items.map((c) => (
                  <button key={`${c.school}-${c.name}`} className="uc-tile" onClick={() => openCourse(c)} type="button">
                    {c.img && <img className="uc-tile-img" src={c.img} alt="" loading="lazy" />}
                    <div className="uc-tile-shade" />
                    <div className="uc-tile-body">
                      {c.level && <span className="uc-tile-level">{c.level}</span>}
                      <span className="uc-tile-name">{c.name}</span>
                      <span className="uc-tile-cta">Find out more &amp; apply <Icon name="arrow-right" size={15} /></span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {active && (
        <div className="ei-overlay" role="dialog" aria-modal="true" aria-label={`Enquire about ${active.name}`}>
          <div className="ei-card">
            <button className="ei-close" onClick={close} aria-label="Close"><Icon name="x" size={18} /></button>

            {status === "done" ? (
              <div className="ei-done">
                <div className="ei-tick"><Icon name="check" size={22} /></div>
                <h3>Thanks{name.trim() ? `, ${name.trim().split(/\s+/)[0]}` : ""}!</h3>
                <p>Your details are with the IFG team. Continue to the course page on the University of Lancashire site.</p>
                <div className="ei-actions">
                  <a href={active.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary" onClick={close}>
                    Continue to the course<Icon name="arrow-right" className="ic" size={18} />
                  </a>
                </div>
              </div>
            ) : (
              <>
                <p className="ei-kicker">{active.school} · University</p>
                <h3 className="ei-title">{active.name}</h3>
                <p className="ei-sub">Leave your details and we&apos;ll take you to the course page — the IFG team will also be in touch to help with your application.</p>

                <form onSubmit={submit} className="ei-form">
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" aria-label="Your name" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" aria-label="Email" required />
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" aria-label="Phone" />
                  {error && <p className="ei-error">{error}</p>}
                  <button type="submit" className="btn btn-primary ei-submit" disabled={status === "loading"}>
                    {status === "loading" ? "Sending…" : "Continue to course"}
                    {status !== "loading" && <Icon name="arrow-right" className="ic" size={18} />}
                  </button>
                </form>
                <p className="ei-consent">We&apos;ll only use your details to contact you about IFG.</p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
