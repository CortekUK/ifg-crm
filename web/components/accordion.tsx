"use client";
import { useState } from "react";
import { Icon } from "./icons";

export function Accordion({ items, initial = 0 }: { items: { title: string; body: string }[]; initial?: number | null }) {
  const [open, setOpen] = useState<number | null>(initial);
  return (
    <div className="acc">
      {items.map((it, i) => (
        <div className={"acc-item" + (open === i ? " open" : "")} key={it.title}>
          <button className="acc-head" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
            <span>{it.title}</span>
            <Icon name="chevron-down" size={18} className="acc-ic" />
          </button>
          <div className="acc-panel">
            <div className="acc-panel-in"><p>{it.body}</p></div>
          </div>
        </div>
      ))}
    </div>
  );
}
