'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, Save, Phone, Calendar, FileSignature } from 'lucide-react'
import { useUpdateUser } from '@/lib/hooks/useUsers'
import type { User } from '@/lib/types/users'

interface EditUserModalProps {
  user: User | null
  isOpen: boolean
  onClose: () => void
}

export function EditUserModal({ user, isOpen, onClose }: EditUserModalProps) {
  const [formData, setFormData] = useState({
    fullName: '',
    role: 'recruiter',
    sport: 'football',
    phone: '',
    calendlyUrl: '',
    emailSignature: '',
    isActive: true,
  })

  const updateUser = useUpdateUser()

  // Update form when user changes
  useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.full_name || '',
        role: user.role,
        sport: user.sport,
        phone: user.phone || '',
        calendlyUrl: user.calendly_url || '',
        emailSignature: user.email_signature || '',
        isActive: user.is_active,
      })
    }
  }, [user])

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    if (!user || !formData.fullName) return

    try {
      await updateUser.mutateAsync({
        userId: user.id,
        updates: {
          full_name: formData.fullName,
          role: formData.role as User['role'],
          sport: formData.sport as User['sport'],
          phone: formData.phone || undefined,
          calendly_url: formData.calendlyUrl || undefined,
          email_signature: formData.emailSignature || undefined,
          is_active: formData.isActive,
        },
      })

      onClose()
    } catch (error) {
      console.error('Failed to update user:', error)
    }
  }

  const isValid = formData.fullName

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update user details and permissions.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-140px)] pr-4">
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) => handleChange('fullName', e.target.value)}
                placeholder="John Smith"
              />
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email || ''} disabled className="bg-gray-50" />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={formData.role} onValueChange={(v) => handleChange('role', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="recruiter">Recruiter</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Sport</Label>
                <Select value={formData.sport} onValueChange={(v) => handleChange('sport', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="football">Football</SelectItem>
                    <SelectItem value="basketball">Basketball</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Phone Number
              </Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="+44 7700 900123"
              />
              <p className="text-xs text-muted-foreground">
                Available as {'{{deal_owner_phone}}'} in templates.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="calendlyUrl" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Calendly URL
              </Label>
              <Input
                id="calendlyUrl"
                value={formData.calendlyUrl}
                onChange={(e) => handleChange('calendlyUrl', e.target.value)}
                placeholder="https://calendly.com/your-link"
              />
              <p className="text-xs text-muted-foreground">
                Available as {'{{deal_owner_calendly}}'} in templates.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="emailSignature" className="flex items-center gap-2">
                <FileSignature className="h-4 w-4" />
                Email Signature
              </Label>
              <Textarea
                id="emailSignature"
                value={formData.emailSignature}
                onChange={(e) => handleChange('emailSignature', e.target.value)}
                placeholder={`Best regards,\n${formData.fullName || 'Your Name'}\nInternational Football Group`}
                rows={4}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Available as {'{{deal_owner_signature}}'} in templates. HTML supported.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <div>
                <Label htmlFor="isActive" className="cursor-pointer">
                  Active
                </Label>
                <p className="text-xs text-muted-foreground">
                  Inactive users cannot access the system.
                </p>
              </div>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => handleChange('isActive', checked)}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!isValid || updateUser.isPending}
                className="flex-1"
              >
                {updateUser.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
