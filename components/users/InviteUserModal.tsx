'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Send } from 'lucide-react'
import { useInviteUser } from '@/lib/hooks/useUsers'

interface InviteUserModalProps {
  isOpen: boolean
  onClose: () => void
}

export function InviteUserModal({ isOpen, onClose }: InviteUserModalProps) {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    role: 'recruiter',
    sport: 'football',
    calendlyUrl: '',
  })

  const inviteUser = useInviteUser()

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        fullName: '',
        email: '',
        role: 'recruiter',
        sport: 'football',
        calendlyUrl: '',
      })
    }
  }, [isOpen])

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    if (!formData.fullName || !formData.email) return

    try {
      await inviteUser.mutateAsync({
        email: formData.email,
        fullName: formData.fullName,
        role: formData.role,
        sport: formData.sport,
        calendlyUrl: formData.calendlyUrl || undefined,
      })

      onClose()
    } catch (error) {
      console.error('Failed to invite user:', error)
    }
  }

  const isValid = formData.fullName && formData.email

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-oswald text-xl font-bold uppercase text-gray-900 dark:text-white">
            Invite User
          </DialogTitle>
          <DialogDescription>
            Send an invitation to a new team member. They&apos;ll receive an email to set up their account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* User Details */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-blue-900 uppercase border-b border-slate-200 pb-2">
              User Details
            </h3>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                value={formData.fullName}
                onChange={(e) => handleChange('fullName', e.target.value)}
                placeholder="John Smith"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="john@example.com"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Role</Label>
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
                <Label className="text-sm font-medium text-slate-700">Sport</Label>
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
              <Label className="text-sm font-medium text-slate-700">Calendly URL (optional)</Label>
              <Input
                value={formData.calendlyUrl}
                onChange={(e) => handleChange('calendlyUrl', e.target.value)}
                placeholder="https://calendly.com/your-link"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || inviteUser.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {inviteUser.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Invite
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
