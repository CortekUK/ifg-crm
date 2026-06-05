"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import { Icon } from "./icons";

// Custom dropdown — themed to match the dark/premium UI (replaces native select).
// `searchable` adds an inline filter input (used for long lists, e.g. countries).
export function Select({
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchable = false,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  searchable?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, []);

  // Focus the filter when a searchable menu opens; clear the query when it closes.
  useEffect(() => {
    if (open && searchable) searchRef.current?.focus();
    if (!open) setQuery("");
  }, [open, searchable]);

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query, searchable]);

  return (
    <div className={"sel" + (open ? " open" : "")} ref={ref}>
      <button type="button" id={id} className="sel-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}>
        <span className={value ? "" : "sel-ph"}>{value || placeholder}</span>
        <Icon name="chevron-down" size={18} className="sel-caret" />
      </button>
      {open && (
        <div className="sel-menu">
          {searchable && (
            <div className="sel-search">
              <Icon name="map-pin" size={15} />
              <input
                ref={searchRef}
                type="text"
                value={query}
                placeholder="Search…"
                onChange={(e) => setQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
          <ul className="sel-list" role="listbox" data-lenis-prevent>
            {filtered.length === 0 && <li className="sel-empty">No matches</li>}
            {filtered.map((opt) => (
              <li
                key={opt}
                role="option"
                aria-selected={opt === value}
                className={"sel-opt" + (opt === value ? " on" : "")}
                onClick={() => { onChange(opt); setOpen(false); }}
              >
                <span>{opt}</span>
                {opt === value && <Icon name="check" size={16} />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
