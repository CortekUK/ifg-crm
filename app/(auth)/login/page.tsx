'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  Loader2,
  Sun,
  Moon
} from 'lucide-react'
import { login } from './actions'

const ERROR_MESSAGES: Record<string, string> = {
  invalid_link: 'This link is invalid or has expired. Please request a new one.',
  session_expired: 'Your session has expired. Please sign in again.',
}

function LoginContent() {
  const searchParams = useSearchParams()
  const urlError = searchParams.get('error')
  const { theme, setTheme } = useTheme()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(
    urlError ? ERROR_MESSAGES[urlError] || urlError : null
  )
  const [rememberMe, setRememberMe] = useState(false)
  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [recoverySubmitting, setRecoverySubmitting] = useState(false)
  const [recoveryDone, setRecoveryDone] = useState(false)

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!recoveryEmail) return
    setRecoverySubmitting(true)
    try {
      await fetch('/api/auth/send-recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recoveryEmail }),
      })
      setRecoveryDone(true)
    } finally {
      setRecoverySubmitting(false)
    }
  }

  const closeRecovery = () => {
    setRecoveryOpen(false)
    setRecoveryDone(false)
    setRecoveryEmail('')
  }

  async function handleSubmit(formData: FormData) {
    setIsLoading(true)
    setError(null)

    const result = await login(formData)

    if (result?.error) {
      setError(result.error)
      setIsLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-gray-100 dark:bg-transparent">
      {/* Dark mode background layers */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0c1220] via-[#0f172a] to-[#0a1628] hidden dark:block" />
      <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[128px] hidden dark:block" />
      <div className="absolute -bottom-24 -left-24 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[100px] hidden dark:block" />
      <div
        className="absolute inset-0 opacity-[0.03] hidden dark:block"
        style={{
          backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full border border-white/[0.03] hidden dark:block" />

      {/* Theme toggle */}
      <button
        type="button"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="absolute top-6 right-6 z-20 p-2.5 rounded-xl bg-white/10 dark:bg-white/10 hover:bg-white/20 dark:hover:bg-white/20 border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <Sun className="h-4 w-4 hidden dark:block" />
        <Moon className="h-4 w-4 block dark:hidden" />
      </button>

      {/* Centred card */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] backdrop-blur-sm overflow-hidden shadow-xl dark:shadow-none">
          {/* Logo banner */}
          <div className="flex items-center justify-center gap-3.5 py-6 border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03]">
            <svg
              className="h-10 w-10 shrink-0"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
              />
            </svg>
            <div className="flex flex-col leading-tight">
              <span className="text-[11px] font-medium text-gray-500 dark:text-white/60 tracking-widest uppercase">The International</span>
              <span className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">FOOTBALL GROUP</span>
            </div>
          </div>

          {/* Form area */}
          <div className="p-8">
            <div className="text-center mb-6">
              <h2 className="font-oswald text-xl font-semibold tracking-tight text-gray-900 dark:text-white mb-1">
                WELCOME BACK
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Sign in to your account
              </p>
            </div>

            {/* Error Alert */}
            {error && (
              <Alert variant="destructive" className="mb-6">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form action={handleSubmit} className="space-y-5">
              {/* Email Field */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-gray-400 dark:text-gray-500" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    className="pl-10 h-11 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus-visible:ring-blue-500 focus-visible:border-blue-500/50"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-gray-400 dark:text-gray-500" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    required
                    className="pl-10 pr-10 h-11 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus-visible:ring-blue-500 focus-visible:border-blue-500/50"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4.5 w-4.5" />
                    ) : (
                      <Eye className="h-4.5 w-4.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                    disabled={isLoading}
                    className="border-gray-300 dark:border-white/20 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                  />
                  <Label
                    htmlFor="remember"
                    className="text-sm text-gray-500 dark:text-gray-400 cursor-pointer"
                  >
                    Remember me
                  </Label>
                </div>
                <Link
                  href="/forgot-password"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full h-11 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium shadow-lg shadow-blue-600/25"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setRecoveryOpen(true)}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Forgot password? / First time logging in?
                </button>
              </div>
            </form>

            {/* Contact Admin */}
            <div className="mt-6 pt-5 border-t border-gray-200 dark:border-white/10">
              <p className="text-center text-sm text-gray-500">
                Don&apos;t have an account?{' '}
                <span className="text-gray-700 dark:text-gray-300 font-medium">
                  Contact your administrator
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={recoveryOpen} onOpenChange={(o) => (!o ? closeRecovery() : null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set up or reset your password</DialogTitle>
            <DialogDescription>
              Enter the email your invitation was sent to. We&apos;ll email you a
              link to set a new password — works whether you&apos;ve logged in
              before or are setting up for the first time.
            </DialogDescription>
          </DialogHeader>
          {recoveryDone ? (
            <div className="rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/40 px-3 py-3 text-sm text-green-800 dark:text-green-300">
              If that email is on file, a password setup link is on its way.
              Check your inbox (and spam folder).
            </div>
          ) : (
            <form onSubmit={handleRecoverySubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="admin-recovery-email" className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-gray-400 dark:text-gray-500" />
                  <Input
                    id="admin-recovery-email"
                    type="email"
                    required
                    autoFocus
                    placeholder="you@example.com"
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    disabled={recoverySubmitting}
                    className="pl-10 h-11"
                  />
                </div>
              </div>
              <DialogFooter className="sm:justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeRecovery} disabled={recoverySubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={recoverySubmitting || !recoveryEmail}>
                  {recoverySubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Sending…
                    </>
                  ) : (
                    'Send setup link'
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
