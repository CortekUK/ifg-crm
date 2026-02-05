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
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Send, Phone, Video, Calendar, Briefcase, GitBranch } from 'lucide-react'
import { useInviteUser } from '@/lib/hooks/useUsers'
import { usePipelines } from '@/lib/hooks/usePipelines'
import { toast } from '@/lib/hooks/use-toast'

interface InviteUserModalProps {
  isOpen: boolean
  onClose: () => void
}

export function InviteUserModal({ isOpen, onClose }: InviteUserModalProps) {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    role: 'recruiter',
    title: '',
    sport: 'football',
    phone: '',
    calendlyUrl: '',
    zoomUrl: '',
    pipelineIds: [] as string[],
  })

  const inviteUser = useInviteUser()
  const { data: pipelines = [] } = usePipelines()

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        fullName: '',
        email: '',
        role: 'recruiter',
        title: '',
        sport: 'football',
        phone: '',
        calendlyUrl: '',
        zoomUrl: '',
        pipelineIds: [],
      })
    }
  }, [isOpen])

  const handleChange = (field: string, value: string | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handlePipelineToggle = (pipelineId: string) => {
    setFormData((prev) => ({
      ...prev,
      pipelineIds: prev.pipelineIds.includes(pipelineId)
        ? prev.pipelineIds.filter((id) => id !== pipelineId)
        : [...prev.pipelineIds, pipelineId],
    }))
  }

  const handleSubmit = async () => {
    if (!formData.fullName || !formData.email) return

    try {
      await inviteUser.mutateAsync({
        email: formData.email,
        fullName: formData.fullName,
        role: formData.role,
        title: formData.title || undefined,
        sport: formData.sport,
        phone: formData.phone || undefined,
        calendlyUrl: formData.calendlyUrl || undefined,
        zoomUrl: formData.zoomUrl || undefined,
        pipelineIds: formData.pipelineIds.length > 0 ? formData.pipelineIds : undefined,
      })

      toast({
        title: 'Invitation sent',
        description: `An invitation has been sent to ${formData.email}`,
      })

      onClose()
    } catch (error) {
      console.error('Failed to invite user:', error)
      toast({
        title: 'Failed to send invitation',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      })
    }
  }

  const isValid = formData.fullName && formData.email
  const isRecruiter = formData.role === 'recruiter'

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-oswald text-xl font-bold uppercase text-gray-900 dark:text-white">
            Invite User
          </DialogTitle>
          <DialogDescription>
            Send an invitation to a new team member. They&apos;ll receive an email to set up their account.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto max-h-[calc(90vh-200px)] pr-2">
          <div className="space-y-6 py-4">
            {/* Basic Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                User Details
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Full Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={formData.fullName}
                    onChange={(e) => handleChange('fullName', e.target.value)}
                    placeholder="John Smith"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Email <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Role</Label>
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
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Sport</Label>
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
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Job Title
                </Label>
                <Input
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  placeholder="e.g. Senior Recruiter"
                />
                <p className="text-xs text-muted-foreground">
                  Used in email signatures and profile display
                </p>
              </div>
            </div>

            {/* Contact & Links */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                Contact & Links
              </h3>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Phone Number
                </Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="+44 7700 900123"
                />
                <p className="text-xs text-muted-foreground">
                  Available as {'{{deal_owner_phone}}'} in templates
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Calendly URL
                </Label>
                <Input
                  value={formData.calendlyUrl}
                  onChange={(e) => handleChange('calendlyUrl', e.target.value)}
                  placeholder="https://calendly.com/your-link"
                />
                <p className="text-xs text-muted-foreground">
                  Available as {'{{deal_owner_calendly}}'} in templates
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  Zoom Link
                </Label>
                <Input
                  value={formData.zoomUrl}
                  onChange={(e) => handleChange('zoomUrl', e.target.value)}
                  placeholder="https://zoom.us/j/your-meeting-id"
                />
                <p className="text-xs text-muted-foreground">
                  Available as {'{{deal_owner_zoom}}'} in templates
                </p>
              </div>
            </div>

            {/* Pipeline Assignment - Only show for recruiters */}
            {isRecruiter && pipelines.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2 flex items-center gap-2">
                  <GitBranch className="h-4 w-4" />
                  Pipeline Assignment
                </h3>
                <p className="text-sm text-muted-foreground">
                  Select pipelines this recruiter will be assigned to for round-robin deal distribution.
                </p>

                <div className="space-y-2 max-h-40 overflow-y-auto border rounded-lg p-3 bg-slate-50 dark:bg-slate-800/50">
                  {pipelines.map((pipeline) => (
                    <div key={pipeline.id} className="flex items-center space-x-3">
                      <Checkbox
                        id={`pipeline-${pipeline.id}`}
                        checked={formData.pipelineIds.includes(pipeline.id)}
                        onCheckedChange={() => handlePipelineToggle(pipeline.id)}
                      />
                      <Label
                        htmlFor={`pipeline-${pipeline.id}`}
                        className="text-sm font-normal cursor-pointer flex-1"
                      >
                        {pipeline.name}
                      </Label>
                      <Badge variant="outline" className="text-xs">
                        {pipeline.sport}
                      </Badge>
                    </div>
                  ))}
                </div>

                {formData.pipelineIds.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {formData.pipelineIds.map((id) => {
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
          </div>
        </div>

        <DialogFooter className="gap-3 pt-4 border-t">
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
