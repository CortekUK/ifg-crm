/**
 * Form identity shared between the public submit endpoint and the CRM admin UI.
 *
 * form_ids are descriptive tokens (summer / university / gapyear) so they're
 * easy to pick when wiring a deal-creation automation. They MUST match the
 * `form_id` configured on each automation — change them in lockstep.
 */

// Human-readable label per form_id (used by the admin section).
export const FORM_LABELS: Record<string, string> = {
  gapyear: 'Gap Year Programme',
  university: 'University Programme',
  summer: 'Summer Residency',
}

// Maps the website's form key (the tab the applicant chose) onto the CRM
// form_id + label. Keep these keys in sync with /web's apply form ids.
export const WEBSITE_FORM_MAP: Record<string, { formId: string; formName: string }> = {
  training: { formId: 'summer', formName: FORM_LABELS.summer },
  university: { formId: 'university', formName: FORM_LABELS.university },
  'gap-year': { formId: 'gapyear', formName: FORM_LABELS.gapyear },
}

export function labelForFormId(formId: string): string {
  return FORM_LABELS[formId] ?? formId
}
