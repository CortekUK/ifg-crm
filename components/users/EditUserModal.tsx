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
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Save, Phone, Calendar, FileSignature, Video, Briefcase, GitBranch } from 'lucide-react'
import { useUpdateUser } from '@/lib/hooks/useUsers'
import { usePipelines } from '@/lib/hooks/usePipelines'
import { toast } from '@/lib/hooks/use-toast'
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
    title: '',
    phone: '',
    calendlyUrl: '',
    zoomUrl: '',
    emailSignature: '',
    isActive: true,
    pipelineAssignments: [] as string[],
  })

  const updateUser = useUpdateUser()
  const { data: pipelines = [] } = usePipelines()

  // Update form when user changes
  useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.full_name || '',
        role: user.role,
        title: user.title || '',
        phone: user.phone || '',
        calendlyUrl: user.calendly_url || '',
        zoomUrl: user.zoom_url || '',
        emailSignature: user.email_signature || '',
        isActive: user.is_active,
        pipelineAssignments: user.pipeline_assignments || [],
      })
    }
  }, [user])

  const handleChange = (field: string, value: string | boolean | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handlePipelineToggle = (pipelineId: string) => {
    setFormData((prev) => ({
      ...prev,
      pipelineAssignments: prev.pipelineAssignments.includes(pipelineId)
        ? prev.pipelineAssignments.filter((id) => id !== pipelineId)
        : [...prev.pipelineAssignments, pipelineId],
    }))
  }

  const handleSubmit = async () => {
    if (!user || !formData.fullName) return

    try {
      await updateUser.mutateAsync({
        userId: user.id,
        updates: {
          full_name: formData.fullName,
          role: formData.role as User['role'],
          title: formData.title || undefined,
          phone: formData.phone || undefined,
          calendly_url: formData.calendlyUrl || undefined,
          zoom_url: formData.zoomUrl || undefined,
          email_signature: formData.emailSignature || undefined,
          is_active: formData.isActive,
          pipeline_assignments: formData.pipelineAssignments,
        },
      })

      toast({
        title: 'User updated',
        description: `${formData.fullName}'s profile has been updated.`,
      })

      onClose()
    } catch (error) {
      console.error('Failed to update user:', error)
      toast({
        title: 'Failed to update user',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      })
    }
  }

  const isValid = formData.fullName

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle className="font-oswald text-xl font-bold uppercase text-gray-900 dark:text-white">
            Edit User
          </DialogTitle>
          <DialogDescription>
            Update user details and permissions.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6">
          <div className="space-y-6 pb-6">
            {/* Basic Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                User Details
              </h3>

              <div className="space-y-2">
                <Label htmlFor="fullName">
                  Full Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => handleChange('fullName', e.target.value)}
                  placeholder="John Smith"
                />
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user?.email || ''} disabled className="bg-gray-50 dark:bg-slate-800" />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed.
                </p>
              </div>

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
                <Label htmlFor="title" className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Job Title
                </Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  placeholder="e.g. Senior Recruiter"
                />
                <p className="text-xs text-muted-foreground">
                  Used in email signatures. Available as {'{{deal_owner_title}}'} in templates.
                </p>
              </div>
            </div>

            {/* Contact & Links */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                Contact & Links
              </h3>

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
                <Label htmlFor="zoomUrl" className="flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  Zoom Link
                </Label>
                <Input
                  id="zoomUrl"
                  value={formData.zoomUrl}
                  onChange={(e) => handleChange('zoomUrl', e.target.value)}
                  placeholder="https://zoom.us/j/your-meeting-id"
                />
                <p className="text-xs text-muted-foreground">
                  Available as {'{{deal_owner_zoom}}'} in templates.
                </p>
              </div>
            </div>

            {/* Email Signature */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                Email Signature
              </h3>

              <div className="space-y-2">
                <Label htmlFor="emailSignature" className="flex items-center gap-2">
                  <FileSignature className="h-4 w-4" />
                  Signature (HTML supported)
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
                  Available as {'{{deal_owner_signature}}'} in templates.
                </p>
              </div>
            </div>

            {/* Pipeline Assignment - Show for all users */}
            {pipelines.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2 flex items-center gap-2">
                  <GitBranch className="h-4 w-4" />
                  Pipeline Assignment
                </h3>
                <p className="text-sm text-muted-foreground">
                  Select pipelines this user is assigned to for round-robin deal distribution.
                </p>

                <div className="space-y-2 border rounded-lg p-3 bg-slate-50 dark:bg-slate-800/50">
                  {pipelines.map((pipeline) => (
                    <div key={pipeline.id} className="flex items-center space-x-3 py-1">
                      <Checkbox
                        id={`pipeline-edit-${pipeline.id}`}
                        checked={formData.pipelineAssignments.includes(pipeline.id)}
                        onCheckedChange={() => handlePipelineToggle(pipeline.id)}
                      />
                      <Label
                        htmlFor={`pipeline-edit-${pipeline.id}`}
                        className="text-sm font-normal cursor-pointer flex-1"
                      >
                        {pipeline.name}
                        {pipeline.programme && (
                          <span className="text-muted-foreground ml-1">
                            ({pipeline.programme.name})
                          </span>
                        )}
                      </Label>
                    </div>
                  ))}
                </div>

                {formData.pipelineAssignments.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {formData.pipelineAssignments.map((id) => {
                      const pipeline = pipelines.find((p) => p.id === id)
                      return pipeline ? (
                        <Badge key={id} variant="secondary" className="text-xs">
                          {pipeline.name}
                        </Badge>
                      ) : null
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Status */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                Account Status
              </h3>

              <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <div>
                  <Label htmlFor="isActive" className="cursor-pointer font-medium">
                    Active Account
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Inactive users cannot access the system.
                  </p>
                </div>
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => handleChange('isActive', checked)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t bg-slate-50 dark:bg-slate-900 shrink-0">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || updateUser.isPending}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
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
      </DialogContent>
    </Dialog>
  )
}
