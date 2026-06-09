"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Eyebrow, Button } from "./primitives";
import { Icon } from "./icons";
import { Select } from "./select";
import { DatePicker } from "./datepicker";
import {
  COUNTRIES,
  FOOTBALL_POSITIONS,
  GENDER_OPTIONS,
  LENGTH_OF_STAY_OPTIONS,
  YEAR_OF_ENTRY_OPTIONS,
  VIDEO_SRC,
  VIDEO_POSTER,
} from "@/lib/data";

// Field definitions drive each form, so the three forms stay DRY and share
// styling, validation and the custom Select primitive.
type FieldDef = {
  key: string;
  label: string;
  type: "text" | "email" | "tel" | "date" | "select";
  required?: boolean;
  placeholder?: string;
  hint?: string;
  options?: string[];
  searchable?: boolean;
  full?: boolean; // span both columns
};

const FIRST: FieldDef = { key: "firstName", label: "First name", type: "text", required: true, placeholder: "Marco" };
const LAST: FieldDef = { key: "lastName", label: "Last name", type: "text", required: true, placeholder: "Rossi" };
const DOB: FieldDef = { key: "dob", label: "Date of birth", type: "date", required: true };
const PHONE: FieldDef = { key: "phone", label: "Phone", type: "tel", required: true, placeholder: "+44 …", hint: "We'll contact you via SMS" };
const EMAIL: FieldDef = { key: "email", label: "Email", type: "email", required: true, placeholder: "you@email.com", full: true };
const GENDER: FieldDef = { key: "gender", label: "Gender", type: "select", required: true, options: GENDER_OPTIONS };
const COUNTRY: FieldDef = { key: "country", label: "Country", type: "select", required: true, options: COUNTRIES, searchable: true };
const POSITION: FieldDef = { key: "position", label: "Football position", type: "select", required: true, options: FOOTBALL_POSITIONS };
const LENGTH: FieldDef = { key: "lengthOfStay", label: "Length of stay", type: "select", required: true, options: LENGTH_OF_STAY_OPTIONS };
const YEAR: FieldDef = { key: "yearOfEntry", label: "Expected year of entry", type: "select", required: true, options: YEAR_OF_ENTRY_OPTIONS };

type FormDef = { id: string; tab: string; title: string; blurb: string; fields: FieldDef[] };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Single source of truth for field validity — covers the custom Select and
// DatePicker too (which the browser can't validate natively).
function validateField(f: FieldDef, raw: string): string | null {
  const v = (raw || "").trim();
  if (!v) return f.required ? `${f.label} is required` : null;
  if (f.type === "email" && !EMAIL_RE.test(v)) return "Enter a valid email address";
  if (f.type === "tel") {
    const digits = v.replace(/[^\d]/g, "");
    if (digits.length < 7) return "Enter a valid phone number";
  }
  if (f.type === "date") {
    const d = new Date(v);
    if (isNaN(d.getTime())) return "Enter a valid date";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (d > today) return "Date of birth can't be in the future";
    if (d.getFullYear() < 1900) return "Enter a valid date";
  }
  return null;
}

const FORMS: FormDef[] = [
  {
    id: "training",
    tab: "Training Experience",
    title: "Summer Residency Application",
    blurb: "An intensive summer residency training within the Macclesfield FC environment.",
    fields: [FIRST, LAST, DOB, PHONE, EMAIL, GENDER, COUNTRY, POSITION, LENGTH],
  },
  {
    id: "university",
    tab: "University Programme",
    title: "University Application",
    blurb: "Accredited Bachelor's & Master's degrees awarded by the University of Lancashire.",
    fields: [FIRST, LAST, DOB, PHONE, EMAIL, GENDER, COUNTRY, YEAR, POSITION],
  },
  {
    id: "gap-year",
    tab: "Gap Year Programme",
    title: "Gap Year Application",
    blurb: "A nine-month playing season combining football development with life experience.",
    fields: [FIRST, LAST, DOB, PHONE, EMAIL, GENDER, COUNTRY, YEAR, POSITION],
  },
];

function ApplicationForm({ form }: { form: FormDef }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Auto-dismiss the toast.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const set = (k: string, v: string) => {
    setValues((s) => ({ ...s, [k]: v }));
    // Once the form has been submitted once, re-validate the field as the user
    // fixes it so the error clears the moment it becomes valid.
    if (submitted) {
      const f = form.fields.find((x) => x.key === k);
      if (f) setErrors((e) => ({ ...e, [k]: validateField(f, v) || "" }));
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitted(true);

    // Validate everything up front.
    const next: Record<string, string> = {};
    for (const f of form.fields) {
      const msg = validateField(f, values[f.key] || "");
      if (msg) next[f.key] = msg;
    }
    setErrors(next);
    const firstBad = form.fields.find((f) => next[f.key]);
    if (firstBad) {
      const el = document.getElementById(`${form.id}-${firstBad.key}`);
      el?.focus();
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setError(null);
    setToast(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form: form.id, ...values }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      // A repeat email is no longer rejected — the contact is updated and the
      // programme's deal is created, so every valid submission is a success.
      setSent(true);
    } catch {
      setError("Could not submit your application. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="apply-ok glass">
        <div className="apply-ok-ic"><Icon name="check" size={32} /></div>
        <h3 className="t-h2">Application received</h3>
        <p style={{ color: "var(--fg-muted)", margin: "12px auto 0", maxWidth: "42ch" }}>
          Thank you{values.firstName ? ", " + values.firstName : ""}. Our team will review your {form.title.toLowerCase()} and be in touch shortly with the next steps.
        </p>
        <div style={{ marginTop: 26 }}>
          <Button variant="ghost" onClick={() => { setSent(false); setValues({}); setErrors({}); setSubmitted(false); }}>Submit another application</Button>
        </div>
      </div>
    );
  }

  return (
    <>
    {toast && (
      <div className="apply-toast" role="alert">
        <span className="apply-toast-dot" />
        <span>{toast}</span>
        <button type="button" className="apply-toast-x" onClick={() => setToast(null)} aria-label="Dismiss">
          <Icon name="x" size={15} />
        </button>
      </div>
    )}
    <form className="apply-form glass" onSubmit={submit} noValidate>
      <div className="apply-form-head">
        <h3 className="t-h3">{form.title}</h3>
        <p>{form.blurb}</p>
      </div>
      <div className="apply-fields">
        {form.fields.map((f) => {
          const fieldErr = errors[f.key];
          const errId = `${form.id}-${f.key}-err`;
          return (
            <div key={f.key} className={"field" + (f.full ? " full" : "") + (fieldErr ? " invalid" : "")}>
              <label htmlFor={`${form.id}-${f.key}`}>
                {f.label}{f.required && <span className="req">*</span>}
                {f.hint && <span className="field-hint">{f.hint}</span>}
              </label>
              {f.type === "select" ? (
                <Select
                  id={`${form.id}-${f.key}`}
                  value={values[f.key] || ""}
                  options={f.options || []}
                  searchable={f.searchable}
                  placeholder="Select…"
                  onChange={(v) => set(f.key, v)}
                />
              ) : f.type === "date" ? (
                <DatePicker
                  id={`${form.id}-${f.key}`}
                  value={values[f.key] || ""}
                  onChange={(v) => set(f.key, v)}
                />
              ) : (
                <input
                  id={`${form.id}-${f.key}`}
                  type={f.type}
                  placeholder={f.placeholder}
                  value={values[f.key] || ""}
                  aria-invalid={!!fieldErr}
                  aria-describedby={fieldErr ? errId : undefined}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              )}
              {fieldErr && <span className="field-err" id={errId}>{fieldErr}</span>}
            </div>
          );
        })}
      </div>
      <p className="apply-note">
        We&apos;ll only use these details to contact you about your application. By submitting you agree to be contacted by the IFG team.
      </p>
      {error && <p className="apply-error" role="alert">{error}</p>}
      <Button variant="primary" size="lg" iconRight={submitting ? undefined : "arrow-right"}>
        {submitting ? "Submitting…" : "Submit application"}
      </Button>
    </form>
    </>
  );
}

export function ApplyView() {
  const [active, setActive] = useState(FORMS[0].id);
  const form = FORMS.find((f) => f.id === active)!;

  // Preselect a tab when deep-linked, e.g. /apply?programme=university.
  // Read in an effect so the page stays statically generated.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("programme");
    if (p && FORMS.some((f) => f.id === p)) setActive(p);
  }, []);

  return (
    <div>
      {/* hero */}
      <section className="c-hero apply-hero">
        <video className="hero-video" data-hero-video src={VIDEO_SRC} poster={VIDEO_POSTER} autoPlay muted loop playsInline />
        <div className="c-hero-overlay" />
        <div className="c-hero-in">
          <Eyebrow style={{ color: "var(--pitch-400)", justifyContent: "center" }}>Start your application</Eyebrow>
          <h1 className="t-display" data-anim="hero-fade" style={{ marginTop: 14 }}>Unforgettable football experiences</h1>
          <p className="apply-hero-sub" data-anim="hero-fade">
            The International Football Group, in partnership with Macclesfield FC &amp; the University of Lancashire, offers unique football education programmes. Select your programme and complete the form below.
          </p>
        </div>
      </section>

      {/* tabs + form */}
      <section className="section apply-sec">
        <div className="wrap">
          <div className="apply-tabs" role="tablist" aria-label="Choose a programme">
            {FORMS.map((f) => (
              <button
                key={f.id}
                role="tab"
                aria-selected={f.id === active}
                className={"apply-tab" + (f.id === active ? " on" : "")}
                onClick={() => setActive(f.id)}
              >
                {f.tab}
              </button>
            ))}
          </div>

          <div className="apply-body">
            {/* key forces a fresh form (and clears state) per tab */}
            <ApplicationForm key={form.id} form={form} />

            <aside className="apply-aside" data-anim="up">
              <Eyebrow>Need a hand?</Eyebrow>
              <h3 className="t-h3" style={{ margin: "12px 0 0" }}>We&apos;re here to help</h3>
              <p style={{ color: "var(--fg-muted)", fontSize: 16, lineHeight: 1.65, marginTop: 14 }}>
                Not sure which programme is right for you? Speak to our team and we&apos;ll guide you through the options.
              </p>
              <ul className="apply-points">
                <li><Icon name="check" size={15} /><span>Personal guidance on the right pathway</span></li>
                <li><Icon name="check" size={15} /><span>Support with applications &amp; eligibility</span></li>
                <li><Icon name="check" size={15} /><span>Answers on dates, costs &amp; accommodation</span></li>
              </ul>
              <div className="apply-aside-cta">
                <Link href="/contact" className="btn btn-ghost">Speak to the team</Link>
                <Link href="/programmes/macclesfield/brochure" className="btn btn-solid">View brochure</Link>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}
