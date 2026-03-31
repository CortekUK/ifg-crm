'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Moon, Sun, Monitor, Loader2, Check } from 'lucide-react'
import { useTheme } from 'next-themes'
import { toast } from '@/lib/hooks/use-toast'
import { cn } from '@/lib/utils'

interface ContactInfo {
  first_name: string
  last_name: string
  email: string
  phone: string | null
  country: string | null
  city: string | null
  club_name: string | null
  position: string | null
  graduation_year: number | null
  parent_name: string | null
  parent_email: string | null
  parent_phone: string | null
}

export default function PortalSettingsPage() {
  const { theme, setTheme } = useTheme()
  const [contact, setContact] = useState<ContactInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    const fetchProfile = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('contact_id')
        .eq('id', user.id)
        .single()

      if (profile?.contact_id) {
        const { data } = await supabase
          .from('contacts')
          .select('first_name, last_name, email, phone, country, city, club_name, position, graduation_year, parent_name, parent_email, parent_phone')
          .eq('id', profile.contact_id)
          .single()

        setContact(data)
      }

      setLoading(false)
    }

    fetchProfile()
  }, [])

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword !== confirmPassword) {
      toast({ title: 'Error', description: 'Passwords do not match', variant: 'destructive' })
      return
    }

    if (newPassword.length < 6) {
      toast({ title: 'Error', description: 'Password must be at least 6 characters', variant: 'destructive' })
      return
    }

    setChangingPassword(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Success', description: 'Password updated successfully' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }
    setChangingPassword(false)
  }

  const themes = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ]

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>

      {/* Profile Info */}
      <Card className="bg-white dark:bg-slate-900">
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 uppercase tracking-wide">Profile</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Name</span>
              <span className="text-slate-900 dark:text-white font-medium">
                {contact?.first_name} {contact?.last_name}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Email</span>
              <span className="text-slate-900 dark:text-white">{contact?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Phone</span>
              <span className="text-slate-900 dark:text-white">{contact?.phone || 'Not set'}</span>
            </div>
            {contact?.country && (
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Location</span>
                <span className="text-slate-900 dark:text-white">
                  {[contact.city, contact.country].filter(Boolean).join(', ')}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Football Info */}
      <Card className="bg-white dark:bg-slate-900">
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 uppercase tracking-wide">Football Info</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Club / Academy</span>
              <span className="text-slate-900 dark:text-white">{contact?.club_name || 'Not set'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Position</span>
              <span className="text-slate-900 dark:text-white">{contact?.position || 'Not set'}</span>
            </div>
            {contact?.graduation_year && (
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Graduation Year</span>
                <span className="text-slate-900 dark:text-white">{contact.graduation_year}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Guardian Info */}
      <Card className="bg-white dark:bg-slate-900">
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 uppercase tracking-wide">Parent / Guardian</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Name</span>
              <span className="text-slate-900 dark:text-white">{contact?.parent_name || 'Not set'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Email</span>
              <span className="text-slate-900 dark:text-white">{contact?.parent_email || 'Not set'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Phone</span>
              <span className="text-slate-900 dark:text-white">{contact?.parent_phone || 'Not set'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Theme */}
      <Card className="bg-white dark:bg-slate-900">
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 uppercase tracking-wide">Appearance</h2>
          <div className="grid grid-cols-3 gap-2">
            {themes.map((t) => {
              const Icon = t.icon
              const isActive = theme === t.value
              return (
                <button
                  key={t.value}
                  onClick={() => setTheme(t.value)}
                  className={cn(
                    'flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-colors',
                    isActive
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-transparent bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700'
                  )}
                >
                  <Icon className={cn('h-5 w-5', isActive ? 'text-blue-600' : 'text-slate-400')} />
                  <span className={cn('text-xs font-medium', isActive ? 'text-blue-600' : 'text-slate-500')}>
                    {t.label}
                  </span>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card className="bg-white dark:bg-slate-900">
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 uppercase tracking-wide">
            Change Password
          </h2>
          <form onSubmit={handlePasswordChange} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="new-password" className="text-xs">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirm-password" className="text-xs">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
              />
            </div>
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={changingPassword}>
              {changingPassword ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...</>
              ) : (
                'Update Password'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
