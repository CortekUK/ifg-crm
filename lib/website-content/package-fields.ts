import type { ProgrammeKey } from '@/lib/types/website-content'

// What each programme's package card on the public website actually shows. The CRM
// package editor offers only these fields, so nothing can be filled in that the
// site never displays.
//
// `fullPayment` says whether the editor offers the "Payable in full" toggle at all.
// false also makes checkout refuse a full payment for that programme whatever is
// stored (see /api/public/deposit). Where it's true, each package's own toggle
// decides — Gap Year's are switched off for now (migration 182), because the full
// amount isn't confirmed for paying online yet.
export type PackageFieldConfig = {
  /** Label for the subtitle field, or false when the card doesn't show one. */
  subtitle: string | false
  duration: boolean
  breakdown: boolean
  itinerary: boolean
  fullPayment: boolean
}

export const PACKAGE_FIELDS: Record<ProgrammeKey, PackageFieldConfig> = {
  residency: { subtitle: 'Dates', duration: true, breakdown: false, itinerary: true, fullPayment: true },
  university: { subtitle: 'Subtitle', duration: false, breakdown: true, itinerary: false, fullPayment: true },
  gapyear: { subtitle: false, duration: false, breakdown: true, itinerary: false, fullPayment: true },
}

/** Whether a programme takes full payments online at all (not just per package). */
export const fullPaymentOffered = (programme: string) =>
  PACKAGE_FIELDS[programme as ProgrammeKey]?.fullPayment ?? true

/** Config for a stored programme value (rows type it as a plain string). */
export const fieldsFor = (programme: string): PackageFieldConfig =>
  PACKAGE_FIELDS[programme as ProgrammeKey] ?? PACKAGE_FIELDS.university
