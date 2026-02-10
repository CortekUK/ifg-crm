'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Check,
  Mail,
  Users,
  BarChart3,
  Send,
  Zap,
  UserCheck,
  Loader2,
  ArrowLeft,
  CheckCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const features = [
  { icon: Users, text: 'Player Recruitment' },
  { icon: Send, text: 'Campaign Management' },
  { icon: BarChart3, text: 'Performance Analytics' },
  { icon: Zap, text: 'Email Automation' },
  { icon: UserCheck, text: 'Team Collaboration' },
]

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleSubmit(formData: FormData) {
    setError(null)
    setIsLoading(true)

    const email = formData.get('email') as string
    const supabase = createClient()

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    })

    if (resetError) {
      setError(resetError.message)
      setIsLoading(false)
      return
    }

    setSent(true)
    setIsLoading(false)
  }

  return (
    <div className="flex min-h-screen w-full">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#0f172a] text-white flex-col justify-between p-12">
        <div>
          <div className="flex items-center gap-3 mb-16">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-xl">
              IFG
            </div>
            <span className="text-xl font-semibold">International Football Group</span>
          </div>

          <h1 className="text-4xl xl:text-5xl font-bold leading-tight mb-12">
            MANAGE YOUR<br />
            FOOTBALL ACADEMY<br />
            WITH <span className="text-blue-400">CONFIDENCE</span>
          </h1>

          <div className="space-y-4">
            {features.map((feature, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center">
                  <Check className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-lg text-gray-300">{feature.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-8 border-t border-gray-700">
          <p className="text-gray-400 text-sm">
            <span className="text-white font-semibold">5000+</span> Players Placed •
            <span className="text-white font-semibold"> 50+</span> Partner Academies •
            <span className="text-white font-semibold"> 15+</span> Countries
          </p>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-white dark:bg-slate-900">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white">
              IFG
            </div>
            <span className="text-lg font-semibold text-gray-900 dark:text-white">IFG CRM</span>
          </div>

          {sent ? (
            // Success state
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                CHECK YOUR EMAIL
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mb-8">
                We&apos;ve sent you a password reset link. Click the link in your email to set a new password.
              </p>
              <Link href="/login">
                <Button variant="outline" className="h-12">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Sign In
                </Button>
              </Link>
            </div>
          ) : (
            // Form state
            <>
              <div className="text-center lg:text-left mb-8">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  FORGOT PASSWORD
                </h2>
                <p className="text-gray-500 dark:text-gray-400">
                  Enter your email and we&apos;ll send you a reset link
                </p>
              </div>

              {error && (
                <Alert variant="destructive" className="mb-6">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <form action={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-700">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="you@example.com"
                      required
                      className="pl-10 h-12"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending Reset Link...
                    </>
                  ) : (
                    'Send Reset Link'
                  )}
                </Button>
              </form>

              <p className="mt-8 text-center text-sm text-gray-500">
                <Link
                  href="/login"
                  className="text-blue-600 hover:text-blue-700 hover:underline font-medium inline-flex items-center"
                >
                  <ArrowLeft className="mr-1 h-3 w-3" />
                  Back to Sign In
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
