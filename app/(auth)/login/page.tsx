'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Eye,
  EyeOff,
  Check,
  Mail,
  Lock,
  Users,
  BarChart3,
  Send,
  Zap,
  UserCheck,
  Loader2
} from 'lucide-react'
import { login } from './actions'

const features = [
  { icon: Users, text: 'Player Recruitment' },
  { icon: Send, text: 'Campaign Management' },
  { icon: BarChart3, text: 'Performance Analytics' },
  { icon: Zap, text: 'Email Automation' },
  { icon: UserCheck, text: 'Team Collaboration' },
]

const ERROR_MESSAGES: Record<string, string> = {
  invalid_link: 'This link is invalid or has expired. Please request a new one.',
  session_expired: 'Your session has expired. Please sign in again.',
}

function LoginContent() {
  const searchParams = useSearchParams()
  const urlError = searchParams.get('error')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(
    urlError ? ERROR_MESSAGES[urlError] || urlError : null
  )
  const [rememberMe, setRememberMe] = useState(false)

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
    <div className="flex min-h-screen w-full">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#0f172a] text-white flex-col justify-between p-12">
        <div>
          {/* Logo */}
          <div className="flex items-center gap-3 mb-16">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-xl">
              IFG
            </div>
            <span className="text-xl font-semibold">International Football Group</span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl xl:text-5xl font-bold leading-tight mb-12">
            MANAGE YOUR<br />
            FOOTBALL ACADEMY<br />
            WITH <span className="text-blue-400">CONFIDENCE</span>
          </h1>

          {/* Features */}
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

        {/* Stats */}
        <div className="pt-8 border-t border-gray-700">
          <p className="text-gray-400 text-sm">
            <span className="text-white font-semibold">5000+</span> Players Placed • 
            <span className="text-white font-semibold"> 50+</span> Partner Academies • 
            <span className="text-white font-semibold"> 15+</span> Countries
          </p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-white dark:bg-slate-900">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white">
              IFG
            </div>
            <span className="text-lg font-semibold text-gray-900 dark:text-white">IFG CRM</span>
          </div>

          {/* Welcome Text */}
          <div className="text-center lg:text-left mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
              WELCOME BACK
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              Sign in to your account
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Login Form */}
          <form action={handleSubmit} className="space-y-6">
            {/* Email Field */}
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

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-700">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  required
                  className="pl-10 pr-10 h-12"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
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
                />
                <Label 
                  htmlFor="remember" 
                  className="text-sm text-gray-600 cursor-pointer"
                >
                  Remember me
                </Label>
              </div>
              <Link 
                href="/forgot-password" 
                className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium"
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
          </form>

          {/* Contact Admin */}
          <p className="mt-8 text-center text-sm text-gray-500">
            Don&apos;t have an account?{' '}
            <span className="text-gray-700 font-medium">
              Contact your administrator
            </span>
          </p>
        </div>
      </div>
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
