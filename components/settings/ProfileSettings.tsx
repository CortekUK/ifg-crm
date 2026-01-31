'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Save, Calendar, Phone, FileSignature, Eye, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/hooks/use-toast'

interface ProfileData {
  full_name: string
  email: string
  phone: string
  calendly_url: string
  email_signature: string
}

export function ProfileSettings() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [profile, setProfile] = useState<ProfileData>({
    full_name: '',
    email: '',
    phone: '',
    calendly_url: '',
    email_signature: '',
  })

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
        .select('full_name, email, phone, calendly_url, email_signature')
        .eq('id', user.id)
        .single()

      if (error) throw error

      setProfile({
        full_name: data.full_name || '',
        email: data.email || user.email || '',
        phone: data.phone || '',
        calendly_url: data.calendly_url || '',
        email_signature: data.email_signature || '',
      })
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

  const handleChange = (field: keyof ProfileData, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
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
          phone: profile.phone || null,
          calendly_url: profile.calendly_url || null,
          email_signature: profile.email_signature || null,
        })
        .eq('id', user.id)

      if (error) throw error

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
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Profile Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure your personal details used in automated emails.
        </p>
      </div>

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
                className="bg-gray-50"
              />
              <p className="text-xs text-muted-foreground">
                Your login email (cannot be changed)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
              />
              <p className="text-xs text-muted-foreground">
                Available as {'{{deal_owner_calendly}}'} in templates
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
                className="min-h-[150px] p-4 border rounded-md bg-white prose prose-sm max-w-none"
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

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-900 mb-2">Example Signature</h4>
            <pre className="text-xs text-blue-800 whitespace-pre-wrap font-mono">
{`Best regards,<br>
<strong>${profile.full_name || 'Your Name'}</strong><br>
International Football Group<br>
<a href="${profile.calendly_url || 'https://calendly.com/your-name'}">Book a call with me</a>`}
            </pre>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>
    </div>
  )
}
