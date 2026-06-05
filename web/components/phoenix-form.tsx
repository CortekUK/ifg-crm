"use client";
import { useState } from "react";
import { Button } from "./primitives";
import { Icon } from "./icons";
import { Select } from "./select";
import { DatePicker } from "./datepicker";
import {
  COUNTRIES,
  US_STATES,
  FOOTBALL_POSITIONS,
  ENTRY_YEARS,
  FUNDING_OPTIONS,
  HEARD_ABOUT_OPTIONS,
} from "@/lib/data";

type FieldDef = {
  key: string;
  label: string;
  type: "text" | "email" | "tel" | "date" | "select" | "textarea";
  required?: boolean;
  placeholder?: string;
  options?: string[];
  searchable?: boolean;
  full?: boolean;
};

const FIELDS: FieldDef[] = [
  { key: "fullName", label: "Full name", type: "text", required: true, placeholder: "Marco Rossi" },
  { key: "email", label: "Email address", type: "email", required: true, placeholder: "you@email.com" },
  { key: "phone", label: "Phone number", type: "tel", required: true, placeholder: "+971 …" },
  { key: "dob", label: "Date of birth", type: "date", required: true },
  { key: "parentName", label: "Parent / guardian name", type: "text" },
  { key: "parentEmail", label: "Parent / guardian email", type: "email" },
  { key: "country", label: "Country", type: "select", options: COUNTRIES, searchable: true, required: true },
  { key: "usState", label: "US state (if applicable)", type: "select", options: US_STATES, searchable: true },
  { key: "graduationYear", label: "Graduation year", type: "select", options: ENTRY_YEARS },
  { key: "entryYear", label: "Predicted date of entry", type: "select", options: ENTRY_YEARS, required: true },
  { key: "funding", label: "How do you intend to fund your enrolment?", type: "select", options: FUNDING_OPTIONS },
  { key: "heardAbout", label: "How did you hear about us?", type: "select", options: HEARD_ABOUT_OPTIONS },
  { key: "academic", label: "Academic background", type: "textarea", full: true },
  { key: "football", label: "Football background", type: "textarea", full: true },
  { key: "position", label: "Football position", type: "select", options: FOOTBALL_POSITIONS, required: true },
  { key: "highlightUrl", label: "Football highlight video URL", type: "text", placeholder: "https://…" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(f: FieldDef, raw: string): string | null {
  const v = (raw || "").trim();
  if (!v) return f.required ? `${f.label} is required` : null;
  if (f.type === "email" && !EMAIL_RE.test(v)) return "Enter a valid email address";
  if (f.type === "tel" && v.replace(/[^\d]/g, "").length < 7) return "Enter a valid phone number";
  if (f.type === "date") {
    const d = new Date(v);
    if (isNaN(d.getTime())) return "Enter a valid date";
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (d > today) return "Date of birth can't be in the future";
  }
  return null;
}

export function PhoenixApplyForm() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [sent, setSent] = useState(false);

  const set = (k: string, v: string) => {
    setValues((s) => ({ ...s, [k]: v }));
    if (submitted) {
      const f = FIELDS.find((x) => x.key === k);
      if (f) setErrors((e) => ({ ...e, [k]: validate(f, v) || "" }));
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const next: Record<string, string> = {};
    for (const f of FIELDS) {
      const msg = validate(f, values[f.key] || "");
      if (msg) next[f.key] = msg;
    }
    setErrors(next);
    const firstBad = FIELDS.find((f) => next[f.key]);
    if (firstBad) {
      const el = document.getElementById(`ph-${firstBad.key}`);
      el?.focus();
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    // TODO: wire to CRM later. For now confirm locally.
    setSent(true);
  };

  if (sent) {
    return (
      <div className="apply-ok glass" style={{ maxWidth: 760, margin: "0 auto" }}>
        <div className="apply-ok-ic"><Icon name="check" size={32} /></div>
        <h3 className="t-h2">Application received</h3>
        <p style={{ color: "var(--fg-muted)", margin: "12px auto 0", maxWidth: "42ch" }}>
          Thank you{values.fullName ? ", " + values.fullName.split(" ")[0] : ""}. Our IFG Phoenix team will review your application and be in touch shortly.
        </p>
      </div>
    );
  }

  return (
    <form className="ph-form" onSubmit={submit} noValidate>
      <div className="apply-fields">
        {FIELDS.map((f) => {
          const err = errors[f.key];
          const id = `ph-${f.key}`;
          return (
            <div key={f.key} className={"field" + (f.full ? " full" : "") + (err ? " invalid" : "")}>
              <label htmlFor={id}>{f.label}{f.required && <span className="req">*</span>}</label>
              {f.type === "select" ? (
                <Select id={id} value={values[f.key] || ""} options={f.options || []} searchable={f.searchable} placeholder="Select…" onChange={(v) => set(f.key, v)} />
              ) : f.type === "date" ? (
                <DatePicker id={id} value={values[f.key] || ""} onChange={(v) => set(f.key, v)} />
              ) : f.type === "textarea" ? (
                <textarea id={id} value={values[f.key] || ""} onChange={(e) => set(f.key, e.target.value)} placeholder="Tell us a little…" />
              ) : (
                <input id={id} type={f.type} placeholder={f.placeholder} value={values[f.key] || ""} aria-invalid={!!err} onChange={(e) => set(f.key, e.target.value)} />
              )}
              {err && <span className="field-err">{err}</span>}
            </div>
          );
        })}
      </div>
      <p className="apply-note" style={{ marginTop: 22 }}>
        Passports, food packages, flights and visas are purchased separately. By submitting you agree to be contacted by the IFG Phoenix team.
      </p>
      <Button variant="primary" size="lg" iconRight="arrow-right">Submit application</Button>
    </form>
  );
}
