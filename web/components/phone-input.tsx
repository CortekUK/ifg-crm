"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import {
  getCountries,
  getCountryCallingCode,
  AsYouType,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";
import { Icon } from "./icons";

// Region names from the platform (no extra dependency).
const REGION =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;
const nameOf = (iso: string) => REGION?.of(iso) || iso;
// ISO-2 → flag emoji (regional indicator symbols).
const flag = (iso: string) =>
  iso.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));

type CountryItem = { iso: CountryCode; name: string; dial: string };

/**
 * Phone field with a custom, site-styled country-code dropdown and a national
 * number input. Validation/formatting come from libphonenumber-js; the value
 * emitted to the form is the full international number (E.164, e.g. +447…), so
 * the CRM stores one consistent format.
 */
export function PhoneInput({
  value,
  onChange,
  defaultCountry = "GB",
  id,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  defaultCountry?: string;
  id?: string;
  invalid?: boolean;
}) {
  const list = useMemo<CountryItem[]>(
    () =>
      getCountries()
        .map((iso) => ({ iso, name: nameOf(iso), dial: getCountryCallingCode(iso) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  const [country, setCountry] = useState<CountryCode>((defaultCountry as CountryCode) || "GB");
  const [national, setNational] = useState("");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const userPicked = useRef(false);

  // Follow the form's selected country until the user overrides it here.
  useEffect(() => {
    if (!userPicked.current && defaultCountry) setCountry(defaultCountry as CountryCode);
  }, [defaultCountry]);

  // Hydrate from an external value (e.g. when the form is reset/cleared).
  useEffect(() => {
    if (!value) {
      setNational("");
      return;
    }
    const parsed = parsePhoneNumberFromString(value);
    if (parsed) {
      if (!userPicked.current && parsed.country) setCountry(parsed.country);
      setNational(parsed.formatNational());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
  useEffect(() => {
    if (open) searchRef.current?.focus();
    if (!open) setQuery("");
  }, [open]);

  const emit = (iso: CountryCode, nat: string) => {
    const parsed = parsePhoneNumberFromString(nat, iso);
    onChange(
      parsed
        ? parsed.number
        : nat
          ? `+${getCountryCallingCode(iso)}${nat.replace(/\D/g, "")}`
          : "",
    );
  };

  const onNational = (raw: string) => {
    const formatted = new AsYouType(country).input(raw);
    setNational(formatted);
    emit(country, formatted);
  };

  const pick = (iso: CountryCode) => {
    userPicked.current = true;
    setCountry(iso);
    setOpen(false);
    emit(iso, national);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    const qDial = q.replace("+", "");
    return list.filter((c) => c.name.toLowerCase().includes(q) || c.dial.includes(qDial));
  }, [list, query]);

  const cur = list.find((c) => c.iso === country);

  return (
    <div className={"phone" + (invalid ? " invalid" : "")} ref={ref}>
      <div className={"phone-cc-wrap" + (open ? " open" : "")}>
        <button
          type="button"
          className="phone-cc"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Country dialling code"
        >
          <span className="phone-flag">{flag(country)}</span>
          <span className="phone-dial">+{cur?.dial}</span>
          <Icon name="chevron-down" size={15} className="sel-caret" />
        </button>
        {open && (
          <div className="phone-menu">
            <div className="sel-search">
              <Icon name="map-pin" size={15} />
              <input
                ref={searchRef}
                type="text"
                value={query}
                placeholder="Search country or code…"
                onChange={(e) => setQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <ul className="sel-list" role="listbox" data-lenis-prevent>
              {filtered.length === 0 && <li className="sel-empty">No matches</li>}
              {filtered.map((c) => (
                <li
                  key={c.iso}
                  role="option"
                  aria-selected={c.iso === country}
                  className={"sel-opt phone-opt" + (c.iso === country ? " on" : "")}
                  onClick={() => pick(c.iso)}
                >
                  <span className="phone-flag">{flag(c.iso)}</span>
                  <span className="phone-opt-name">{c.name}</span>
                  <span className="phone-opt-dial">+{c.dial}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <input
        id={id}
        type="tel"
        className="phone-num"
        placeholder="7123 456789"
        value={national}
        aria-invalid={invalid}
        onChange={(e) => onNational(e.target.value)}
      />
    </div>
  );
}
