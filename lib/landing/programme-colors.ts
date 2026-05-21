import type { Programme } from './programmes'

export interface AccentColors {
  text: string
  bg: string
  line: string
  icon: string
  check: string
}

const accents: Record<Programme['category'], AccentColors> = {
  degree: {
    text: 'text-blue-600 dark:text-blue-500',
    bg: 'bg-blue-600/10',
    line: 'bg-blue-600',
    icon: 'text-blue-600 dark:text-blue-500',
    check: 'bg-blue-600/10',
  },
  'short-term': {
    text: 'text-amber-600 dark:text-amber-500',
    bg: 'bg-amber-600/10',
    line: 'bg-amber-600',
    icon: 'text-amber-600 dark:text-amber-500',
    check: 'bg-amber-600/10',
  },
  experience: {
    text: 'text-emerald-600 dark:text-emerald-500',
    bg: 'bg-emerald-600/10',
    line: 'bg-emerald-600',
    icon: 'text-emerald-600 dark:text-emerald-500',
    check: 'bg-emerald-600/10',
  },
}

export function getAccentColors(category: Programme['category']): AccentColors {
  return accents[category]
}
