"use client";
import { useState, useRef, useEffect } from "react";
import { Icon } from "./icons";

// Custom, fully themed date picker (replaces the native, unstylable calendar).
// Stores/emits an ISO `yyyy-mm-dd` string. Three views — days → months → years —
// make it quick to set a date of birth without month-by-month clicking.
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WD = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

type Mode = "days" | "months" | "years";
type View = { m: number; y: number };

function fmt(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${String(d).padStart(2, "0")} ${MONTHS_SHORT[m - 1]} ${y}`;
}

function shiftMonth(v: View, delta: number): View {
  let m = v.m + delta;
  let y = v.y;
  if (m < 0) { m = 11; y -= 1; }
  if (m > 11) { m = 0; y += 1; }
  return { m, y };
}

export function DatePicker({
  value,
  onChange,
  id,
  placeholder = "DD / MM / YYYY",
  minYear = 1940,
}: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
  placeholder?: string;
  minYear?: number;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("days");
  const [view, setView] = useState<View>({ m: 0, y: 2000 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, []);

  const toggle = () => {
    if (!open) {
      const now = new Date();
      if (value) {
        const [y, m] = value.split("-").map(Number);
        setView({ m: m - 1, y });
      } else {
        setView({ m: now.getMonth(), y: now.getFullYear() });
      }
      setMode("days");
    }
    setOpen((o) => !o);
  };

  const pick = (d: number) => {
    onChange(`${view.y}-${String(view.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    setOpen(false);
  };

  // build the day grid for the current view
  const daysIn = new Date(view.y, view.m + 1, 0).getDate();
  const lead = new Date(view.y, view.m, 1).getDay();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => i + 1)];

  const sel = value ? value.split("-").map(Number) : null;
  const now = new Date();
  const isToday = (d: number) => d === now.getDate() && view.m === now.getMonth() && view.y === now.getFullYear();
  const isSel = (d: number) => !!sel && d === sel[2] && view.m === sel[1] - 1 && view.y === sel[0];

  const years: number[] = [];
  for (let y = now.getFullYear(); y >= minYear; y--) years.push(y);

  const cycleMode = () => setMode((m) => (m === "days" ? "months" : m === "months" ? "years" : "days"));
  const prev = () => { if (mode === "days") setView((v) => shiftMonth(v, -1)); else if (mode === "months") setView((v) => ({ ...v, y: v.y - 1 })); };
  const next = () => { if (mode === "days") setView((v) => shiftMonth(v, 1)); else if (mode === "months") setView((v) => ({ ...v, y: v.y + 1 })); };

  return (
    <div className={"dp" + (open ? " open" : "")} ref={ref}>
      <button type="button" id={id} className="sel-btn dp-btn" onClick={toggle} aria-haspopup="dialog" aria-expanded={open}>
        <span className={value ? "" : "sel-ph"}>{value ? fmt(value) : placeholder}</span>
        <Icon name="calendar" size={17} className="dp-cal" />
      </button>

      {open && (
        <div className="dp-pop" role="dialog">
          <div className="dp-head">
            <button type="button" className="dp-nav" onClick={prev} aria-label="Previous" style={{ visibility: mode === "years" ? "hidden" : "visible" }}>
              <Icon name="arrow-left" size={16} />
            </button>
            <button type="button" className="dp-title" onClick={cycleMode}>
              {mode === "days" && `${MONTHS[view.m]} ${view.y}`}
              {mode === "months" && view.y}
              {mode === "years" && "Select a year"}
            </button>
            <button type="button" className="dp-nav" onClick={next} aria-label="Next" style={{ visibility: mode === "years" ? "hidden" : "visible" }}>
              <Icon name="arrow-right" size={16} />
            </button>
          </div>

          {mode === "days" && (
            <>
              <div className="dp-wd-row">{WD.map((w) => <span key={w} className="dp-wd">{w}</span>)}</div>
              <div className="dp-grid">
                {cells.map((d, i) =>
                  d === null ? (
                    <span key={i} className="dp-empty" />
                  ) : (
                    <button type="button" key={i} className={"dp-day" + (isSel(d) ? " on" : "") + (isToday(d) ? " today" : "")} onClick={() => pick(d)}>
                      {d}
                    </button>
                  )
                )}
              </div>
            </>
          )}

          {mode === "months" && (
            <div className="dp-months">
              {MONTHS_SHORT.map((mo, i) => (
                <button type="button" key={mo} className={"dp-mo" + (i === view.m ? " on" : "")} onClick={() => { setView((v) => ({ ...v, m: i })); setMode("days"); }}>
                  {mo}
                </button>
              ))}
            </div>
          )}

          {mode === "years" && (
            <div className="dp-years" data-lenis-prevent>
              {years.map((y) => (
                <button type="button" key={y} className={"dp-yr" + (y === view.y ? " on" : "")} onClick={() => { setView((v) => ({ ...v, y })); setMode("months"); }}>
                  {y}
                </button>
              ))}
            </div>
          )}

          <div className="dp-foot">
            <button type="button" className="dp-link" onClick={() => { onChange(""); setOpen(false); }}>Clear</button>
            <button
              type="button"
              className="dp-link"
              onClick={() => {
                const n = new Date();
                onChange(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`);
                setOpen(false);
              }}
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
