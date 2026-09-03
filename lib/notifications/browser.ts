/**
 * Desktop notification preference.
 *
 * Deliberately per-browser rather than a row in `crm_settings`: the OS
 * permission is granted to one browser on one machine, so an org-wide
 * setting would let one admin silence everybody else's laptop.
 *
 * Exposed as a tiny external store so React can read it with
 * useSyncExternalStore — the value lives in localStorage and the browser's
 * permission state, neither of which React owns.
 */
export const BROWSER_NOTIFICATIONS_KEY = 'ifg:browser-notifications'

export type BrowserPermission = NotificationPermission | 'unsupported'

const listeners = new Set<() => void>()

function readPreference(): boolean {
  try {
    return localStorage.getItem(BROWSER_NOTIFICATIONS_KEY) === 'on'
  } catch {
    // Private windows and blocked site data throw on access.
    return false
  }
}

export function permissionState(): BrowserPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

/** Snapshot as one primitive, so referential equality is not a concern. */
export function getSnapshot(): string {
  if (typeof window === 'undefined') return 'unsupported|off'
  return `${permissionState()}|${readPreference() ? 'on' : 'off'}`
}

export function getServerSnapshot(): string {
  return 'unsupported|off'
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function notify() {
  for (const listener of listeners) listener()
}

export function parseSnapshot(snapshot: string): {
  permission: BrowserPermission
  enabled: boolean
} {
  const [permission, preference] = snapshot.split('|')
  return {
    permission: permission as BrowserPermission,
    // Permission can be revoked in browser settings without the stored
    // preference changing, so "on" alone is not enough.
    enabled: preference === 'on' && permission === 'granted',
  }
}

export function setPreference(enabled: boolean) {
  try {
    localStorage.setItem(BROWSER_NOTIFICATIONS_KEY, enabled ? 'on' : 'off')
  } catch {
    // Nothing to do — the toggle simply will not persist in this browser.
  }
  notify()
}

export function browserNotificationsEnabled(): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  if (Notification.permission !== 'granted') return false
  return readPreference()
}

/** Show one notification, if the user asked for them and the browser allows it. */
export function showBrowserNotification(title: string, body: string, href?: string | null) {
  if (!browserNotificationsEnabled()) return
  try {
    const notification = new Notification(title, { body, tag: 'ifg-crm' })
    if (href) {
      notification.onclick = () => {
        window.focus()
        window.location.href = href
      }
    }
  } catch (err) {
    console.warn('Browser notification failed:', err)
  }
}
