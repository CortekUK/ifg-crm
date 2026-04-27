// UK Localisation Utilities
// This application uses British English spelling and UK formats throughout

// Format currency in GBP
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// Format date in UK format (DD/MM/YYYY)
export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date))
}

// Format date with time (DD/MM/YYYY HH:mm)
export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

// Format date in long format (29 January 2026)
export function formatDateLong(date: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date))
}

// Format date in short format (29 Jan 2026)
export function formatDateShort(date: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

// Format number with commas (e.g., 12,847)
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-GB').format(num)
}

// Format percentage
export function formatPercentage(num: number, decimals: number = 0): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num / 100)
}

// Compact, calendar-aware date for list views (replies, sends, etc.).
// Today shows time-of-day, this year shows day+month, older shows full date.
// Pair with `formatDateTime` in a tooltip when you want the full timestamp.
export function formatListDate(date: Date | string): string {
  const then = new Date(date)
  const now = new Date()

  const sameDay = then.toDateString() === now.toDateString()
  if (sameDay) {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(then)
  }

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (then.toDateString() === yesterday.toDateString()) {
    return 'Yesterday'
  }

  if (then.getFullYear() === now.getFullYear()) {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
    }).format(then)
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(then)
}

// Format relative time (e.g., "2 hours ago", "in 3 days")
export function formatRelativeTime(date: Date | string): string {
  const now = new Date()
  const then = new Date(date)
  const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000)

  const rtf = new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' })

  // Helper to title case (capitalize each word)
  const titleCase = (str: string) => str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')

  if (Math.abs(diffInSeconds) < 60) {
    return titleCase(rtf.format(-diffInSeconds, 'second'))
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (Math.abs(diffInMinutes) < 60) {
    return titleCase(rtf.format(-diffInMinutes, 'minute'))
  }

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (Math.abs(diffInHours) < 24) {
    return titleCase(rtf.format(-diffInHours, 'hour'))
  }

  const diffInDays = Math.floor(diffInHours / 24)
  if (Math.abs(diffInDays) < 30) {
    return titleCase(rtf.format(-diffInDays, 'day'))
  }

  const diffInMonths = Math.floor(diffInDays / 30)
  if (Math.abs(diffInMonths) < 12) {
    return titleCase(rtf.format(-diffInMonths, 'month'))
  }

  const diffInYears = Math.floor(diffInDays / 365)
  return titleCase(rtf.format(-diffInYears, 'year'))
}

// Format time ago (e.g., "2 hours ago", "3 days ago")
export function formatTimeAgo(date: Date | string | null): string {
  if (!date) return 'Never'
  
  const now = new Date()
  const then = new Date(date)
  const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000)
  
  if (diffInSeconds < 60) {
    return 'Just now'
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`
  }
  
  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`
  }
  
  const diffInWeeks = Math.floor(diffInDays / 7)
  if (diffInWeeks < 4) {
    return `${diffInWeeks} week${diffInWeeks === 1 ? '' : 's'} ago`
  }
  
  const diffInMonths = Math.floor(diffInDays / 30)
  if (diffInMonths < 12) {
    return `${diffInMonths} month${diffInMonths === 1 ? '' : 's'} ago`
  }
  
  const diffInYears = Math.floor(diffInDays / 365)
  return `${diffInYears} year${diffInYears === 1 ? '' : 's'} ago`
}

// Format duration in compact form (e.g., "3d", "2w", "3mo")
export function formatDuration(days: number): string {
  if (days < 1) {
    return '<1d'
  }
  
  if (days < 7) {
    return `${Math.floor(days)}d`
  }
  
  if (days < 30) {
    const weeks = Math.floor(days / 7)
    return `${weeks}w`
  }
  
  if (days < 365) {
    const months = Math.floor(days / 30)
    return `${months}mo`
  }
  
  const years = Math.floor(days / 365)
  return `${years}y`
}

// Calculate days between two dates
export function calculateDaysBetween(startDate: Date | string, endDate: Date | string = new Date()): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffInMs = end.getTime() - start.getTime()
  return diffInMs / (1000 * 60 * 60 * 24)
}

// Format phone number (UK format)
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '')
  
  // UK mobile (07xxx)
  if (digits.startsWith('07') && digits.length === 11) {
    return `${digits.slice(0, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`
  }
  
  // UK landline with area code
  if (digits.startsWith('0') && digits.length === 11) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
  }
  
  // International format starting with 44
  if (digits.startsWith('44')) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`
  }
  
  // Return as-is if no pattern matches
  return phone
}
