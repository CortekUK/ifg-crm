// CMS merge layer. Website pages render `mergePage(BUNDLED_DEFAULT, overrides)`:
// the CRM stores ONLY the fields an editor changed (a partial "overrides" doc), and
// we deep-merge them onto the bundled defaults from lib/data.ts. No override for a
// field => the bundled default shows through, so "restore default" = drop the key
// (and an empty/absent overrides doc renders the site exactly as it ships).

type Plain = Record<string, unknown>;

function isPlainObject(v: unknown): v is Plain {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Deep-merge `over` onto `base`. Objects merge key-by-key; arrays and scalars from
// `over` REPLACE the base value (editing a list swaps the whole list). `undefined`
// / `null` in `over` is treated as "no override" so a blank field can't wipe a
// default by accident.
export function deepMerge<T>(base: T, over: unknown): T {
  if (over === undefined || over === null) return base;
  if (!isPlainObject(base) || !isPlainObject(over)) return over as T;
  const out: Plain = { ...(base as Plain) };
  for (const [k, v] of Object.entries(over)) {
    if (v === undefined || v === null) continue;
    out[k] = k in out ? deepMerge((base as Plain)[k], v) : v;
  }
  return out as T;
}

// Merge a page's CMS overrides onto its bundled default object.
export function mergePage<T>(defaults: T, overrides: unknown): T {
  return deepMerge(defaults, overrides);
}
