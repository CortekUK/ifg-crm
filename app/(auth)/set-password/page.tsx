'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Eye,
  EyeOff,
  Check,
  Lock,
  Users,
  BarChart3,
  Send,
  Zap,
  UserCheck,
  Loader2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const features = [
  { icon: Users, text: 'Player Recruitment' },
  { icon: Send, text: 'Campaign Management' },
  { icon: BarChart3, text: 'Performance Analytics' },
  { icon: Zap, text: 'Email Automation' },
  { icon: UserCheck, text: 'Team Collaboration' },
]

export default function SetPasswordPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace('/login?error=invalid_link')
      } else {
        setIsChecking(false)
      }
    })
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsLoading(true)

    try {
      const supabase = createClient()

      const { error: updateError } = await supabase.auth.updateUser({
        password,
      })

      if (updateError) {
        setError(updateError.message)
        setIsLoading(false)
        return
      }

      // Accept invite (marks invite as accepted + copies pipeline assignments)
      await fetch('/api/auth/accept-invite', { method: 'POST' })

      router.replace('/dashboard')
    } catch {
      setError('Something went wrong. Please try again.')
      setIsLoading(false)
    }
  }

  if (isChecking) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
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
            SET YOUR<br />
            PASSWORD TO<br />
            <span className="text-blue-400">GET STARTED</span>
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

      {/* Right Side - Set Password Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-white">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white">
              IFG
            </div>
            <span className="text-lg font-semibold text-gray-900">IFG CRM</span>
          </div>

          <div className="text-center lg:text-left mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              SET YOUR PASSWORD
            </h2>
            <p className="text-gray-500">
              Create a password for your account
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
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
                  minLength={6}
                  className="pl-10 pr-10 h-12"
                  disabled={isLoading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <p className="text-xs text-gray-500">Must be at least 6 characters</p>
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-gray-700">
                Confirm Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className={`pl-10 pr-10 h-12 ${
                    confirmPassword && password !== confirmPassword
                      ? 'border-red-500 focus-visible:ring-red-500'
                      : ''
                  }`}
                  disabled={isLoading}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-500">Passwords do not match</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium mt-2"
              disabled={isLoading || (confirmPassword !== '' && password !== confirmPassword)}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting Password...
                </>
              ) : (
                'Set Password'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
