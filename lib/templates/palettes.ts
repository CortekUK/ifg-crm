// Colour palettes — a whole scheme in one click.
//
// Picking five colours that work together from five separate pickers is a
// designer's job, and the failure mode is quiet: grey-on-grey small print that
// looks fine on a bright laptop and is unreadable on a phone in daylight. Each
// palette here sets the page, the card, the body text, the small print, the
// brand colour and the masthead together, and every one is checked against
// WCAG AA by `scripts/verify-palettes.mjs`.
//
// A palette spans TWO settings: the theme (page, card, text, brand) and the
// branding header (the masthead band), because the band's colour lives on the
// header config, not on the theme.

import type { TemplateTheme } from './editor-types'

export interface Palette {
  id: string
  name: string
  /** What it is for, in the picker. */
  hint: string
  /** Theme half: everything from the page background inwards. */
  theme: Pick<
    TemplateTheme,
    'pageBgColor' | 'bodyBgColor' | 'inkColor' | 'mutedColor' | 'primaryColor'
  >
  /** Masthead half. */
  header: { bgColor: string; textColor: string }
  /**
   * Set when the palette needs a warning rather than just a description —
   * shown next to it in the picker rather than discovered after sending.
   */
  caution?: string
}

export const PALETTES: Palette[] = [
  {
    id: 'classic',
    name: 'Classic',
    hint: 'Near-white page, white card — quiet and familiar',
    theme: {
      // #f1f4f7 rather than the renderer's #f9fafb default: that default is
      // 1.05:1 against a white card, which is no separation at all — the card
      // edge simply isn't visible, which is why the email reads as a wall of
      // text rather than as a card on a page.
      pageBgColor: '#f1f4f7',
      bodyBgColor: '#ffffff',
      inkColor: '#0f172a',
      mutedColor: '#6b7280',
      primaryColor: '#BE1623',
    },
    header: { bgColor: '#0f172a', textColor: '#ffffff' },
  },
  {
    id: 'slate',
    name: 'Slate',
    hint: 'Grey page so the email reads as a card',
    theme: {
      pageBgColor: '#e2e8f0',
      bodyBgColor: '#ffffff',
      inkColor: '#0f172a',
      mutedColor: '#5b6675',
      primaryColor: '#BE1623',
    },
    header: { bgColor: '#0f172a', textColor: '#ffffff' },
  },
  {
    id: 'warm',
    name: 'Warm paper',
    hint: 'Softer and less clinical — good for parents',
    theme: {
      pageBgColor: '#efe9df',
      bodyBgColor: '#fffdfa',
      inkColor: '#1c1917',
      mutedColor: '#6f665e',
      primaryColor: '#A8331B',
    },
    header: { bgColor: '#1c1917', textColor: '#fffdfa' },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    hint: 'Dark page, white card — the most premium of these',
    theme: {
      pageBgColor: '#0f172a',
      bodyBgColor: '#ffffff',
      inkColor: '#0f172a',
      mutedColor: '#5b6675',
      primaryColor: '#BE1623',
    },
    header: { bgColor: '#020617', textColor: '#ffffff' },
  },
  {
    id: 'editorial',
    name: 'Editorial',
    hint: 'Monochrome, no brand colour — quiet and expensive',
    theme: {
      pageBgColor: '#eae7e1',
      bodyBgColor: '#ffffff',
      inkColor: '#111111',
      mutedColor: '#5f5f5f',
      primaryColor: '#111111',
    },
    header: { bgColor: '#111111', textColor: '#ffffff' },
  },
  {
    id: 'floodlight',
    name: 'Floodlight',
    hint: 'Dark card with light text — the boldest option',
    theme: {
      pageBgColor: '#020617',
      bodyBgColor: '#111c30',
      inkColor: '#f8fafc',
      mutedColor: '#a9b4c4',
      primaryColor: '#E11D2E',
    },
    header: { bgColor: '#020617', textColor: '#f8fafc' },
    caution:
      'A dark card is the one thing some clients re-colour in dark mode. Send yourself a test before using it on a campaign.',
  },
]

export function getPalette(id: string): Palette | null {
  return PALETTES.find((p) => p.id === id) ?? null
}

/** Which palette the current colours match exactly, if any. */
export function matchPalette(theme: TemplateTheme | undefined | null): string | null {
  if (!theme) return null
  const same = (a?: string, b?: string) => (a ?? '').toLowerCase() === (b ?? '').toLowerCase()
  return (
    PALETTES.find(
      (p) =>
        same(theme.pageBgColor, p.theme.pageBgColor) &&
        same(theme.bodyBgColor, p.theme.bodyBgColor) &&
        same(theme.inkColor, p.theme.inkColor) &&
        same(theme.primaryColor, p.theme.primaryColor),
    )?.id ?? null
  )
}

// ── Contrast ────────────────────────────────────────────────────────────────
// WCAG 2.1 relative luminance. Used to check the palettes and to show the
// reader a real number when they pick their own colours, rather than leaving
// legibility to eyeballing it on one bright screen.

function channel(value: number): number {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function luminance(hex: string): number {
  const clean = hex.replace('#', '')
  const full =
    clean.length === 3
      ? clean.split('').map((c) => c + c).join('')
      : clean.padEnd(6, '0').slice(0, 6)
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  if ([r, g, b].some(Number.isNaN)) return 0
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** 1 (identical) to 21 (black on white). AA body text wants 4.5 or better. */
export function contrastRatio(foreground: string, background: string): number {
  const a = luminance(foreground)
  const b = luminance(background)
  const [light, dark] = a > b ? [a, b] : [b, a]
  return (light + 0.05) / (dark + 0.05)
}

export type ContrastVerdict = 'good' | 'ok' | 'poor'

/**
 * `large` relaxes the threshold to the AA large-text rule (3:1) — correct for
 * headings and for the label on a button, which is bold and set at body size
 * or bigger.
 */
export function contrastVerdict(ratio: number, large = false): ContrastVerdict {
  const pass = large ? 3 : 4.5
  if (ratio >= (large ? 4.5 : 7)) return 'good'
  if (ratio >= pass) return 'ok'
  return 'poor'
}
