'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createCallbackClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'
import type { EmailOtpType } from '@supabase/supabase-js'

// Race an auth call against a timeout so the callback can never spin forever if
// a network call or auth lock stalls. Rejects with Error('timeout') on expiry.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

function CallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const handleCallback = async () => {
     try {
      const supabase = createCallbackClient()
      const code = searchParams.get('code')

      // Helper to redirect based on user role
      const redirectByRole = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

          if (profile?.role === 'player') {
            router.replace('/set-password?redirect=/portal')
            return
          }
        }
        router.replace('/set-password')
      }

      // Token-hash flow (SSR-native). Invite links we generate point here as
      // /auth/callback?token_hash=...&type=invite. verifyOtp exchanges the
      // hash for a session and writes it through the cookie adapter cleanly —
      // unlike the legacy #access_token implicit flow, which fights
      // @supabase/ssr's cookie storage and lands on invalid_link.
      const tokenHash = searchParams.get('token_hash')
      const otpType = searchParams.get('type')
      if (tokenHash && otpType) {
        const { error } = await withTimeout(
          supabase.auth.verifyOtp({
            type: otpType as EmailOtpType,
            token_hash: tokenHash,
          }),
          20000,
        )
        if (error) {
          console.error('verifyOtp error:', error.message)
          router.replace('/login?error=invalid_link')
          return
        }
        await redirectByRole()
        return
      }

      // PKCE flow (password reset / magic link with code)
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          console.error('PKCE exchange error:', error.message)
          router.replace('/login?error=invalid_link')
          return
        }
        await redirectByRole()
        return
      }

      // Implicit flow (invite links) — token in hash fragment
      const hash = window.location.hash
      if (hash) {
        const params = new URLSearchParams(hash.substring(1))
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (error) {
            console.error('Session set error:', error.message)
            router.replace('/login?error=invalid_link')
            return
          }

          await redirectByRole()
          return
        }
      }

      // Fallback: check if session already exists (e.g. from auto-detection)
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        await redirectByRole()
        return
      }

      // No code, no hash, no session — invalid link
      router.replace('/login?error=invalid_link')
     } catch (err) {
       // Never leave the user stuck on the spinner. If anything throws, send
       // them somewhere actionable instead of buffering forever.
       console.error('Auth callback failed:', err)
       router.replace('/login?error=invalid_link')
     }
    }

    handleCallback()
  }, [router, searchParams])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-gray-600">Setting up your account...</p>
      </div>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  )
}
