// Shared application-form config — the single source of truth for the fields,
// their validation and the submit contract. Used by BOTH the full /apply page
// (components/apply.tsx) and the inline chatbot application form
// (components/chat-apply-form.tsx) so the two can never drift.

import { isValidPhoneNumber } from "libphonenumber-js";
import {
  COUNTRIES,
  FOOTBALL_POSITIONS,
  GENDER_OPTIONS,
  LENGTH_OF_STAY_OPTIONS,
  YEAR_OF_ENTRY_OPTIONS,
} from "@/lib/data";

export type FieldDef = {
  key: string;
  label: string;
  type: "text" | "email" | "tel" | "phone" | "date" | "select" | "country" | "state";
  required?: boolean;
  placeholder?: string;
  hint?: string;
  options?: string[];
  searchable?: boolean;
  full?: boolean; // span both columns
};

export type FormDef = { id: string; tab: string; title: string; blurb: string; fields: FieldDef[] };

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FIRST: FieldDef = { key: "firstName", label: "First name", type: "text", required: true, placeholder: "Marco" };
const LAST: FieldDef = { key: "lastName", label: "Last name", type: "text", required: true, placeholder: "Rossi" };
const DOB: FieldDef = { key: "dob", label: "Date of birth", type: "date", required: true };
const PHONE: FieldDef = { key: "phone", label: "Phone", type: "phone", required: true };
const EMAIL: FieldDef = { key: "email", label: "Email", type: "email", required: true, placeholder: "you@email.com", full: true };
const GENDER: FieldDef = { key: "gender", label: "Gender", type: "select", required: true, options: GENDER_OPTIONS };
const COUNTRY: FieldDef = { key: "country", label: "Country", type: "country", required: true };
const STATE: FieldDef = { key: "state", label: "State / Region", type: "state", required: true };
const POSITION: FieldDef = { key: "position", label: "Football position", type: "select", required: true, options: FOOTBALL_POSITIONS };
const LENGTH: FieldDef = { key: "lengthOfStay", label: "Length of stay", type: "select", required: true, options: LENGTH_OF_STAY_OPTIONS };
const YEAR: FieldDef = { key: "yearOfEntry", label: "Expected year of entry", type: "select", required: true, options: YEAR_OF_ENTRY_OPTIONS };

export const FORMS: FormDef[] = [
  {
    id: "training",
    tab: "Training Experience",
    title: "Summer Residency Application",
    blurb: "An intensive summer residency training within the Macclesfield FC environment.",
    fields: [FIRST, LAST, DOB, PHONE, EMAIL, GENDER, COUNTRY, STATE, POSITION, LENGTH],
  },
  {
    id: "university",
    tab: "University Programme",
    title: "University Application",
    blurb: "Accredited Bachelor's & Master's degrees awarded by the University of Lancashire.",
    fields: [FIRST, LAST, DOB, PHONE, EMAIL, GENDER, COUNTRY, STATE, YEAR, POSITION],
  },
  {
    id: "gap-year",
    tab: "Gap Year Programme",
    title: "Gap Year Application",
    blurb: "A nine-month playing season combining football development with life experience.",
    fields: [FIRST, LAST, DOB, PHONE, EMAIL, GENDER, COUNTRY, STATE, YEAR, POSITION],
  },
];

export function getForm(id: string): FormDef | undefined {
  return FORMS.find((f) => f.id === id);
}

// Apply form tab id → deposit programme key (Gap Year has no deposit).
export const DEPOSIT_PROGRAMME: Record<string, string> = { training: "residency", university: "university" };

// Single source of truth for field validity — covers the custom Select,
// DatePicker and PhoneInput too (which the browser can't validate natively).
// `statesAvailable` makes the state field required only when the chosen country
// actually has a list of states/regions to pick from.
export function validateField(f: FieldDef, raw: string, statesAvailable = false): string | null {
  const v = (raw || "").trim();
  if (f.type === "state") {
    if (!v) return statesAvailable ? `${f.label} is required` : null;
    return null;
  }
  if (!v) return f.required ? `${f.label} is required` : null;
  if (f.type === "email" && !EMAIL_RE.test(v)) return "Enter a valid email address";
  if (f.type === "phone") {
    if (!isValidPhoneNumber(v)) return "Enter a valid phone number";
    return null;
  }
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

// Also feeds COUNTRIES fallback when country-state-city hasn't loaded yet.
export { COUNTRIES };
