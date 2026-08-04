"use client";
import { useState, useEffect, useMemo } from "react";
import { Icon } from "./icons";
import { Select } from "./select";
import { DatePicker } from "./datepicker";
import { PhoneInput } from "./phone-input";
import { getForm, validateField, COUNTRIES, type FieldDef } from "@/lib/apply-fields";

// Inline application form rendered inside the chat when the assistant calls
// open_application_form. Reuses the SAME field config, validation and submit
// endpoint as the full /apply page, just prefilled and compact. The assistant
// pre-fills whatever the visitor already mentioned; they complete the rest here.

type Values = Record<string, string>;

// The assistant may prefill using `region`; the form field key is `state`.
function normalizePrefill(prefill: Values | undefined, fields: FieldDef[]): Values {
  const keys = new Set(fields.map((f) => f.key));
  const out: Values = {};
  for (const [k, v] of Object.entries(prefill ?? {})) {
    if (!v) continue;
    const key = k === "region" ? "state" : k;
    if (keys.has(key)) out[key] = String(v);
  }
  return out;
}

export function ChatApplyForm({
  programme,
  prefill,
  onSubmitted,
}: {
  programme: string;
  prefill?: Values;
  onSubmitted?: (form: string) => void;
}) {
  const form = getForm(programme);
  const [values, setValues] = useState<Values>(() => normalizePrefill(prefill, form?.fields ?? []));
  const [errors, setErrors] = useState<Values>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [countries, setCountries] = useState<{ name: string; iso: string }[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [countryIso, setCountryIso] = useState("");

  useEffect(() => {
    let alive = true;
    import("country-state-city").then((csc) => {
      if (alive) setCountries(csc.Country.getAllCountries().map((c) => ({ name: c.name, iso: c.isoCode })));
    });
    return () => { alive = false; };
  }, []);

  const isoByName = useMemo(() => {
    const m = new Map<string, string>();
    countries.forEach((c) => m.set(c.name, c.iso));
    return m;
  }, [countries]);

  // Resolve the ISO for a prefilled country name once the dataset loads.
  useEffect(() => {
    if (!countryIso && values.country) {
      const iso = isoByName.get(values.country);
      if (iso) setCountryIso(iso);
    }
  }, [isoByName, values.country, countryIso]);

  useEffect(() => {
    if (!countryIso) { setStates([]); return; }
    let alive = true;
    import("country-state-city").then((csc) => {
      if (alive) setStates(csc.State.getStatesOfCountry(countryIso).map((s) => s.name));
    });
    return () => { alive = false; };
  }, [countryIso]);

  const countryOptions = countries.length ? countries.map((c) => c.name) : COUNTRIES;
  const hasStates = states.length > 0;

  if (!form) return null;

  const set = (key: string, v: string) => {
    setValues((s) => ({ ...s, [key]: v }));
    if (submitted) {
      const f = form.fields.find((x) => x.key === key);
      if (f) setErrors((e) => ({ ...e, [key]: validateField(f, v, hasStates) || "" }));
    }
  };

  const onCountry = (name: string) => {
    setCountryIso(isoByName.get(name) || "");
    setValues((s) => ({ ...s, country: name, state: "" }));
    if (submitted) setErrors((e) => ({ ...e, country: "", state: "" }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitted(true);
    const next: Values = {};
    for (const f of form!.fields) next[f.key] = validateField(f, values[f.key] || "", hasStates) || "";
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // `source: chatbot` tells the CRM to label this lead as Website Chatbot
        // (not a plain Website Form) — it's collected inside the chat widget.
        body: JSON.stringify({ form: form!.id, source: "chatbot", ...values }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Could not submit. Please try again.");
        setSubmitting(false);
        return;
      }
      setSent(true);
      onSubmitted?.(form!.id);
    } catch {
      setError("Could not submit. Please try again.");
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="caf caf-done">
        <div className="caf-tick"><Icon name="check" size={18} /></div>
        <p><strong>Application submitted.</strong> The IFG team will review it and be in touch soon.</p>
      </div>
    );
  }

  return (
    <form className="caf" onSubmit={submit} noValidate>
      <p className="caf-title">{form.title}</p>
      <div className="caf-fields">
        {form.fields.map((f) => {
          const fieldErr = submitted ? errors[f.key] : "";
          const id = `caf-${form.id}-${f.key}`;
          return (
            <div key={f.key} className={"field" + (fieldErr ? " invalid" : "")}>
              <label htmlFor={id}>{f.label}{f.required && <span className="req">*</span>}</label>
              {f.type === "phone" ? (
                <PhoneInput id={id} value={values[f.key] || ""} defaultCountry={countryIso || "GB"} invalid={!!fieldErr} onChange={(v) => set(f.key, v)} />
              ) : f.type === "country" ? (
                <Select id={id} value={values.country || ""} options={countryOptions} searchable placeholder="Select…" onChange={onCountry} />
              ) : f.type === "state" ? (
                hasStates ? (
                  <Select id={id} value={values.state || ""} options={states} searchable placeholder="Select…" onChange={(v) => set("state", v)} />
                ) : (
                  <input id={id} type="text" placeholder={values.country ? "State / region (optional)" : "Select a country first"} value={values.state || ""} onChange={(e) => set("state", e.target.value)} />
                )
              ) : f.type === "select" ? (
                <Select id={id} value={values[f.key] || ""} options={f.options || []} searchable={f.searchable} placeholder="Select…" onChange={(v) => set(f.key, v)} />
              ) : f.type === "date" ? (
                <DatePicker id={id} value={values[f.key] || ""} onChange={(v) => set(f.key, v)} />
              ) : (
                <input id={id} type={f.type} placeholder={f.placeholder} value={values[f.key] || ""} onChange={(e) => set(f.key, e.target.value)} />
              )}
              {fieldErr && <span className="field-err">{fieldErr}</span>}
            </div>
          );
        })}
      </div>
      {error && <p className="field-err caf-err-top">{error}</p>}
      <button type="submit" className="btn btn-primary caf-submit" disabled={submitting}>
        {submitting ? "Submitting…" : "Submit application"}
        {!submitting && <Icon name="arrow-right" className="ic" size={16} />}
      </button>
      <p className="caf-consent">By submitting you agree to be contacted by the IFG team.</p>
    </form>
  );
}
