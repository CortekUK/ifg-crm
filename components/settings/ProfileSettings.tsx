'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Save, Calendar, Phone, FileSignature, Eye, Loader2, Upload, Key, AlertTriangle, Video, Briefcase } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/hooks/use-toast'

interface ProfileData {
  full_name: string
  email: string
  title: string
  phone: string
  calendly_url: string
  zoom_url: string
  email_signature: string
  avatar_url: string
}

interface PasswordData {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

// URL validation helper
function isValidUrl(url: string): boolean {
  if (!url) return true // Empty is valid (optional field)
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function ProfileSettings() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [calendlyUrlError, setCalendlyUrlError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [originalProfile, setOriginalProfile] = useState<ProfileData | null>(null)
  const [profile, setProfile] = useState<ProfileData>({
    full_name: '',
    email: '',
    title: '',
    phone: '',
    calendly_url: '',
    zoom_url: '',
    email_signature: '',
    avatar_url: '',
  })
  const [passwordData, setPasswordData] = useState<PasswordData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [passwordErrors, setPasswordErrors] = useState<Partial<PasswordData>>({})

  // Track unsaved changes
  useEffect(() => {
    if (originalProfile) {
      const hasChanges =
        profile.full_name !== originalProfile.full_name ||
        profile.title !== originalProfile.title ||
        profile.phone !== originalProfile.phone ||
        profile.calendly_url !== originalProfile.calendly_url ||
        profile.zoom_url !== originalProfile.zoom_url ||
        profile.email_signature !== originalProfile.email_signature
      setHasUnsavedChanges(hasChanges)
    }
  }, [profile, originalProfile])

  // Warn on page unload if unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    setIsLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        throw new Error('Not authenticated')
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, email, title, phone, calendly_url, zoom_url, email_signature, avatar_url')
        .eq('id', user.id)
        .single()

      if (error) throw error

      const profileData = {
        full_name: data.full_name || '',
        email: data.email || user.email || '',
        title: data.title || '',
        phone: data.phone || '',
        calendly_url: data.calendly_url || '',
        zoom_url: data.zoom_url || '',
        email_signature: data.email_signature || '',
        avatar_url: data.avatar_url || '',
      }
      setProfile(profileData)
      setOriginalProfile(profileData)
    } catch (error) {
      console.error('Failed to fetch profile:', error)
      toast({
        title: 'Error',
        description: 'Failed to load profile settings.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an image file.',
        variant: 'destructive',
      })
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please select an image under 2MB.',
        variant: 'destructive',
      })
      return
    }

    setIsUploadingAvatar(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) throw new Error('Not authenticated')

      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}-${Date.now()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id)

      if (updateError) throw updateError

      setProfile((prev) => ({ ...prev, avatar_url: publicUrl }))
      toast({
        title: 'Avatar updated',
        description: 'Your profile picture has been changed.',
      })
    } catch (error) {
      console.error('Failed to upload avatar:', error)
      toast({
        title: 'Upload failed',
        description: 'Failed to upload avatar. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const handlePasswordChange = async () => {
    // Validate passwords
    const errors: Partial<PasswordData> = {}
    
    if (!passwordData.currentPassword) {
      errors.currentPassword = 'Current password is required'
    }
    if (!passwordData.newPassword) {
      errors.newPassword = 'New password is required'
    } else if (passwordData.newPassword.length < 6) {
      errors.newPassword = 'Password must be at least 6 characters'
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match'
    }

    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors)
      return
    }

    setIsChangingPassword(true)
    setPasswordErrors({})

    try {
      const supabase = createClient()
      
      // First verify current password by re-authenticating
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) throw new Error('Not authenticated')

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwordData.currentPassword,
      })

      if (signInError) {
        setPasswordErrors({ currentPassword: 'Current password is incorrect' })
        return
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      })

      if (updateError) throw updateError

      // Clear form
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })

      toast({
        title: 'Password changed',
        description: 'Your password has been updated successfully.',
      })
    } catch (error) {
      console.error('Failed to change password:', error)
      toast({
        title: 'Error',
        description: 'Failed to change password. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleChange = (field: keyof ProfileData, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }))
    
    // Validate Calendly URL
    if (field === 'calendly_url') {
      if (value && !isValidUrl(value)) {
        setCalendlyUrlError('Please enter a valid URL (e.g., https://calendly.com/your-name)')
      } else if (value && !value.includes('calendly.com')) {
        setCalendlyUrlError('This doesn\'t look like a Calendly URL')
      } else {
        setCalendlyUrlError(null)
      }
    }
  }

  const handlePasswordFieldChange = (field: keyof PasswordData, value: string) => {
    setPasswordData((prev) => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (passwordErrors[field]) {
      setPasswordErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const getInitials = (name: string, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    return email.slice(0, 2).toUpperCase()
  }

  const handleSave = async () => {
    // Validate Calendly URL before saving
    if (profile.calendly_url && !isValidUrl(profile.calendly_url)) {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid Calendly URL.',
        variant: 'destructive',
      })
      return
    }

    setIsSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        throw new Error('Not authenticated')
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profile.full_name,
          title: profile.title || null,
          phone: profile.phone || null,
          calendly_url: profile.calendly_url || null,
          zoom_url: profile.zoom_url || null,
          email_signature: profile.email_signature || null,
        })
        .eq('id', user.id)

      if (error) throw error

      // Update original profile to clear unsaved changes
      setOriginalProfile({ ...profile })
      setHasUnsavedChanges(false)

      toast({
        title: 'Profile updated',
        description: 'Your profile settings have been saved.',
      })
    } catch (error) {
      console.error('Failed to save profile:', error)
      toast({
        title: 'Error',
        description: 'Failed to save profile settings.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32 mb-2" />
            <Skeleton className="h-4 w-56" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Profile Settings</h2>
          <p className="text-sm text-muted-foreground">
            Configure your personal details used in automated emails.
          </p>
        </div>
        {hasUnsavedChanges && (
          <span className="text-xs font-medium text-orange-600 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/30 px-2 py-1 rounded-full flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Unsaved changes
          </span>
        )}
      </div>

      {/* Avatar Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile Picture</CardTitle>
          <CardDescription>
            Upload a profile picture that will be displayed across the CRM.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <Avatar className="h-20 w-20">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="bg-blue-100 dark:bg-blue-900/50 text-blue-600 text-xl">
                {getInitials(profile.full_name, profile.email)}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar}
              >
                {isUploadingAvatar ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                {isUploadingAvatar ? 'Uploading...' : 'Upload Photo'}
              </Button>
              <p className="text-xs text-muted-foreground">
                JPG, PNG or GIF. Max 2MB.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personal Information</CardTitle>
          <CardDescription>
            This information is used when sending automated emails on your behalf.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={profile.full_name}
                onChange={(e) => handleChange('full_name', e.target.value)}
                placeholder="Your full name"
              />
              <p className="text-xs text-muted-foreground">
                Used as the sender name in emails
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={profile.email}
                disabled
                className="bg-gray-50 dark:bg-slate-800"
              />
              <p className="text-xs text-muted-foreground">
                Your login email (cannot be changed)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title" className="flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Job Title
              </Label>
              <Input
                id="title"
                value={profile.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="e.g. Senior Recruiter"
              />
              <p className="text-xs text-muted-foreground">
                Available as {'{{deal_owner_title}}'} in templates
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Phone Number
              </Label>
              <Input
                id="phone"
                value={profile.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="+44 7700 900123"
              />
              <p className="text-xs text-muted-foreground">
                Available as {'{{deal_owner_phone}}'} in templates
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="calendly_url" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Calendly URL
              </Label>
              <Input
                id="calendly_url"
                value={profile.calendly_url}
                onChange={(e) => handleChange('calendly_url', e.target.value)}
                placeholder="https://calendly.com/your-name"
                className={calendlyUrlError ? 'border-red-500' : ''}
              />
              {calendlyUrlError ? (
                <p className="text-xs text-red-500">{calendlyUrlError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Your Calendly booking link. Available as {'{{deal_owner_calendly}}'} in templates.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="zoom_url" className="flex items-center gap-2">
                <Video className="h-4 w-4" />
                Zoom Link
              </Label>
              <Input
                id="zoom_url"
                value={profile.zoom_url}
                onChange={(e) => handleChange('zoom_url', e.target.value)}
                placeholder="https://zoom.us/j/your-meeting-id"
              />
              <p className="text-xs text-muted-foreground">
                Your Zoom meeting link. Available as {'{{deal_owner_zoom}}'} in templates.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSignature className="h-4 w-4" />
            Email Signature
          </CardTitle>
          <CardDescription>
            Your signature will be inserted when using {'{{deal_owner_signature}}'} in email templates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="email_signature">Signature (HTML supported)</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
              >
                <Eye className="h-4 w-4 mr-1" />
                {showPreview ? 'Edit' : 'Preview'}
              </Button>
            </div>
            
            {showPreview ? (
              <div 
                className="min-h-[150px] p-4 border rounded-md bg-white dark:bg-slate-900 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ 
                  __html: profile.email_signature || '<span class="text-muted-foreground">No signature set</span>' 
                }}
              />
            ) : (
              <Textarea
                id="email_signature"
                value={profile.email_signature}
                onChange={(e) => handleChange('email_signature', e.target.value)}
                placeholder={`Best regards,
${profile.full_name || 'Your Name'}
International Football Group

<a href="{{deal_owner_calendly}}">Book a call</a>`}
                rows={6}
                className="font-mono text-sm"
              />
            )}
            <p className="text-xs text-muted-foreground">
              Tip: You can use HTML tags like {'<br>'} for line breaks and {'<a href="...">'}link text{'</a>'} for links.
            </p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">Example Signature</h4>
            <pre className="text-xs text-blue-800 dark:text-blue-300 whitespace-pre-wrap font-mono">
{`Best regards,<br>
<strong>${profile.full_name || 'Your Name'}</strong><br>
International Football Group<br>
<a href="${profile.calendly_url || 'https://calendly.com/your-name'}">Book a call with me</a>`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Password Change Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" />
            Change Password
          </CardTitle>
          <CardDescription>
            Update your password to keep your account secure.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-md space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current_password">Current Password</Label>
              <Input
                id="current_password"
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => handlePasswordFieldChange('currentPassword', e.target.value)}
                placeholder="Enter current password"
                className={passwordErrors.currentPassword ? 'border-red-500' : ''}
              />
              {passwordErrors.currentPassword && (
                <p className="text-xs text-red-500">{passwordErrors.currentPassword}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="new_password">New Password</Label>
              <Input
                id="new_password"
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => handlePasswordFieldChange('newPassword', e.target.value)}
                placeholder="Enter new password"
                className={passwordErrors.newPassword ? 'border-red-500' : ''}
              />
              {passwordErrors.newPassword && (
                <p className="text-xs text-red-500">{passwordErrors.newPassword}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Must be at least 6 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirm New Password</Label>
              <Input
                id="confirm_password"
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => handlePasswordFieldChange('confirmPassword', e.target.value)}
                placeholder="Confirm new password"
                className={passwordErrors.confirmPassword ? 'border-red-500' : ''}
              />
              {passwordErrors.confirmPassword && (
                <p className="text-xs text-red-500">{passwordErrors.confirmPassword}</p>
              )}
            </div>

            <Button 
              onClick={handlePasswordChange} 
              disabled={isChangingPassword}
              variant="outline"
            >
              {isChangingPassword ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Key className="h-4 w-4 mr-2" />
              )}
              Change Password
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving || !!calendlyUrlError}>
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>

      {/* Unsaved Changes Dialog */}
      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to leave? Your changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700">
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
