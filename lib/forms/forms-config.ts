/**
 * Form identity shared between the public submit endpoint and the CRM admin UI.
 *
 * We deliberately REUSE the form_ids that ActiveCampaign already used
 * (gap / uclan / masters) so existing form_submission automations keep firing
 * against our own website's forms with zero reconfiguration.
 */

// Human-readable label per form_id (used by the AC webhook + admin section).
export const FORM_LABELS: Record<string, string> = {
  gap: 'Gap Year Programme',
  uclan: 'University Programme (UCLan)',
  masters: 'Training Experience (Masters)',
}

// Maps the website's form key (the tab the applicant chose) onto the CRM
// form_id + label. Keep these keys in sync with /web's apply form ids.
export const WEBSITE_FORM_MAP: Record<string, { formId: string; formName: string }> = {
  training: { formId: 'masters', formName: FORM_LABELS.masters },
  university: { formId: 'uclan', formName: FORM_LABELS.uclan },
  'gap-year': { formId: 'gap', formName: FORM_LABELS.gap },
}

export function labelForFormId(formId: string): string {
  return FORM_LABELS[formId] ?? formId
}
