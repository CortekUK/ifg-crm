import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Standard singleton browser client used everywhere in the app. Keeps the
// default cross-tab navigator.locks coordination so concurrent tabs don't race
// on refresh-token rotation.
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}

// Serialise this client's auth calls in-memory instead of via navigator.locks.
// The cross-tab navigator lock DEADLOCKS the invite/recovery callback when the
// same browser already holds another session (e.g. an admin clicking an invite
// link while logged in): verifyOtp/setSession waits on a lock the other tab's
// client holds and the page spins on "Setting up your account…" forever.
let callbackLockChain: Promise<unknown> = Promise.resolve()
function inMemoryLock<R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> {
  const run = callbackLockChain.then(fn, fn)
  callbackLockChain = run.then(() => undefined, () => undefined)
  return run
}

// Dedicated, NON-singleton client for /auth/callback only. Uses the same cookie
// storage as the singleton (so the session it establishes is visible app-wide
// and to the server/middleware), but opts out of navigator.locks to avoid the
// deadlock above. Scoped to the callback so normal multi-tab login is unchanged.
export function createCallbackClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    isSingleton: false,
    auth: { lock: inMemoryLock },
  })
}
