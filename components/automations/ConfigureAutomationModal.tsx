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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent } from '@/components/ui/card'
import {
  Mail,
  Clock,
  GitBranch,
  Users,
  ArrowRight,
  Zap,
  Plus,
  ChevronRight,
  FileText,
  Link,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePipelines } from '@/lib/hooks/usePipelines'
import { usePipelineStages } from '@/lib/hooks/usePipelineStages'
import { useTemplates } from '@/lib/hooks/useTemplates'
import { useUsers } from '@/lib/hooks/useUsers'
import {
  AUTOMATION_TEMPLATES,
  type AutomationType,
  type AutomationTemplate,
  type AutomationConfig,
} from '@/lib/types/automations'

interface ConfigureAutomationModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: AutomationFormData) => void
  editingAutomation?: {
    id: string
    name: string
    description: string | null
    automation_type: AutomationType
    pipeline_id: string | null
    trigger_stage_id: string | null
    stop_on_stage_ids: string[]
    config: AutomationConfig | null
  } | null
}

export interface AutomationFormData {
  name: string
  description: string
  automation_type: AutomationType
  pipeline_id: string
  trigger_stage_id: string
  stop_on_stage_ids: string[]
  config: AutomationConfig
}

type Step = 'select_template' | 'configure'

export function ConfigureAutomationModal({
  isOpen,
  onClose,
  onSave,
  editingAutomation,
}: ConfigureAutomationModalProps) {
  const [step, setStep] = useState<Step>('select_template')
  const [selectedTemplate, setSelectedTemplate] = useState<AutomationTemplate | null>(null)
  const [formData, setFormData] = useState<AutomationFormData>({
    name: '',
    description: '',
    automation_type: 'initial_contact',
    pipeline_id: '',
    trigger_stage_id: '',
    stop_on_stage_ids: [],
    config: {
      emails: [],
      wait_days: [3, 5, 7],
      exit_on_reply: true,
    },
  })

  // Fetch data
  const { data: pipelines = [] } = usePipelines()
  const { data: stages = [] } = usePipelineStages(formData.pipeline_id ?? null)
  const { data: templates = [] } = useTemplates()
  const { data: users = [] } = useUsers()

  const recruiters = users.filter((u) => u.role === 'recruiter' || u.role === 'admin')

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      if (editingAutomation) {
        // Editing existing automation
        setStep('configure')
        const template = AUTOMATION_TEMPLATES.find(
          (t) => t.type === editingAutomation.automation_type
        )
        setSelectedTemplate(template || null)
        setFormData({
          name: editingAutomation.name,
          description: editingAutomation.description || '',
          automation_type: editingAutomation.automation_type,
          pipeline_id: editingAutomation.pipeline_id || '',
          trigger_stage_id: editingAutomation.trigger_stage_id || '',
          stop_on_stage_ids: editingAutomation.stop_on_stage_ids || [],
          config: editingAutomation.config || {
            emails: [],
            wait_days: [3, 5, 7],
            exit_on_reply: true,
          },
        })
      } else {
        // Creating new automation
        setStep('select_template')
        setSelectedTemplate(null)
        setFormData({
          name: '',
          description: '',
          automation_type: 'initial_contact',
          pipeline_id: '',
          trigger_stage_id: '',
          stop_on_stage_ids: [],
          config: {
            emails: [],
            wait_days: [3, 5, 7],
            exit_on_reply: true,
          },
        })
      }
    }
  }, [isOpen, editingAutomation])

  const handleTemplateSelect = (template: AutomationTemplate) => {
    setSelectedTemplate(template)
    setFormData((prev) => ({
      ...prev,
      name: '',
      description: template.description,
      automation_type: template.type,
      config: {
        ...prev.config,
        wait_days: template.default_steps
          .filter((s) => s.step_type === 'wait')
          .map((s) => s.delay_days || 3),
        round_robin_users: template.configurable.round_robin ? [] : undefined,
      },
    }))
    setStep('configure')
  }

  const handleSave = () => {
    onSave(formData)
    onClose()
  }

  const getTemplateIcon = (type: AutomationType) => {
    switch (type) {
      case 'deal_creation':
        return <Plus className="h-5 w-5" />
      case 'initial_contact':
        return <Mail className="h-5 w-5" />
      case 'follow_up':
        return <ArrowRight className="h-5 w-5" />
      default:
        return <Zap className="h-5 w-5" />
    }
  }

  const updateWaitDays = (index: number, days: number) => {
    const newWaitDays = [...(formData.config.wait_days || [])]
    newWaitDays[index] = days
    setFormData((prev) => ({
      ...prev,
      config: { ...prev.config, wait_days: newWaitDays },
    }))
  }

  const updateEmailTemplate = (stepIndex: number, templateId: string) => {
    const newEmails = [...(formData.config.emails || [])]
    const existingIndex = newEmails.findIndex((e) => e.step === stepIndex)
    if (existingIndex >= 0) {
      newEmails[existingIndex] = { ...newEmails[existingIndex], template_id: templateId }
    } else {
      newEmails.push({ step: stepIndex, template_id: templateId })
    }
    setFormData((prev) => ({
      ...prev,
      config: { ...prev.config, emails: newEmails },
    }))
  }

  const toggleRoundRobinUser = (userId: string) => {
    const current = formData.config.round_robin_users || []
    const newUsers = current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId]
    setFormData((prev) => ({
      ...prev,
      config: { ...prev.config, round_robin_users: newUsers },
    }))
  }

  const toggleExitStage = (stageId: string) => {
    const current = formData.stop_on_stage_ids || []
    const newStages = current.includes(stageId)
      ? current.filter((id) => id !== stageId)
      : [...current, stageId]
    setFormData((prev) => ({
      ...prev,
      stop_on_stage_ids: newStages,
    }))
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        {step === 'select_template' ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-oswald text-xl uppercase">
                Create Automation
              </DialogTitle>
              <DialogDescription>
                Select a pre-built automation template to get started
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 py-4">
              {AUTOMATION_TEMPLATES.map((template) => (
                <Card
                  key={template.id}
                  className={cn(
                    'cursor-pointer transition-all hover:border-blue-300 hover:shadow-md',
                    selectedTemplate?.id === template.id && 'border-blue-500 bg-blue-50/50'
                  )}
                  onClick={() => handleTemplateSelect(template)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                        {getTemplateIcon(template.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-gray-900">{template.name}</h3>
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {template.description}
                        </p>
                        <div className="flex gap-2 mt-2">
                          {template.default_steps
                            .filter((s) => s.step_type === 'send_email')
                            .length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              <Mail className="h-3 w-3 mr-1" />
                              {template.default_steps.filter((s) => s.step_type === 'send_email').length} emails
                            </Badge>
                          )}
                          {template.configurable.round_robin && (
                            <Badge variant="secondary" className="text-xs">
                              <Users className="h-3 w-3 mr-1" />
                              Round-robin
                            </Badge>
                          )}
                          {template.configurable.exit_stages && (
                            <Badge variant="secondary" className="text-xs">
                              <GitBranch className="h-3 w-3 mr-1" />
                              Exit conditions
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-oswald text-xl uppercase">
                {editingAutomation ? 'Edit Automation' : 'Configure Automation'}
              </DialogTitle>
              <DialogDescription>
                {selectedTemplate?.name || 'Custom Automation'}
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-6 py-4">
                {/* Basic Info */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Automation Name *</Label>
                    <Input
                      id="name"
                      placeholder={`e.g., UK GAP 2026 - ${selectedTemplate?.name || 'Automation'}`}
                      value={formData.name}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, name: e.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe what this automation does..."
                      value={formData.description}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, description: e.target.value }))
                      }
                      rows={2}
                    />
                  </div>
                </div>

                <Separator />

                {/* Pipeline & Trigger */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-blue-900 uppercase">
                    {selectedTemplate?.type === 'deal_creation' ? 'Pipeline Settings' : 'Trigger Settings'}
                  </h3>

                  <div className={cn(
                    'grid gap-4',
                    selectedTemplate?.type === 'deal_creation' ? 'grid-cols-1' : 'grid-cols-2'
                  )}>
                    <div className="space-y-2">
                      <Label>Pipeline *</Label>
                      <Select
                        value={formData.pipeline_id}
                        onValueChange={(value) =>
                          setFormData((prev) => ({
                            ...prev,
                            pipeline_id: value,
                            trigger_stage_id: '',
                            stop_on_stage_ids: [],
                            config: {
                              ...prev.config,
                              initial_stage_id: '', // Reset initial stage when pipeline changes
                            },
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select pipeline" />
                        </SelectTrigger>
                        <SelectContent>
                          {pipelines.map((pipeline) => (
                            <SelectItem key={pipeline.id} value={pipeline.id}>
                              {pipeline.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedTemplate?.type === 'deal_creation' && (
                        <p className="text-xs text-muted-foreground">
                          New deals will be created in this pipeline
                        </p>
                      )}
                    </div>

                    {selectedTemplate?.type === 'deal_creation' ? (
                      <div className="space-y-2">
                        <Label>Initial Stage</Label>
                        <Select
                          value={formData.config.initial_stage_id || ''}
                          onValueChange={(value) =>
                            setFormData((prev) => ({
                              ...prev,
                              config: { ...prev.config, initial_stage_id: value },
                            }))
                          }
                          disabled={!formData.pipeline_id}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="First stage (default)" />
                          </SelectTrigger>
                          <SelectContent>
                            {stages.map((stage) => (
                              <SelectItem key={stage.id} value={stage.id}>
                                {stage.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          New deals will start in this stage (defaults to first stage)
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label>
                          {selectedTemplate?.trigger_type === 'enters_stage'
                            ? 'When deal enters stage'
                            : selectedTemplate?.trigger_type === 'stage_change'
                            ? 'When deal moves to stage'
                            : 'Trigger Stage'}{' '}
                          *
                        </Label>
                        <Select
                          value={formData.trigger_stage_id}
                          onValueChange={(value) =>
                            setFormData((prev) => ({ ...prev, trigger_stage_id: value }))
                          }
                          disabled={!formData.pipeline_id}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select stage" />
                          </SelectTrigger>
                          <SelectContent>
                            {stages.map((stage) => (
                              <SelectItem key={stage.id} value={stage.id}>
                                {stage.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>

                {/* Form Configuration (for deal creation) */}
                {selectedTemplate?.type === 'deal_creation' && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-blue-900 uppercase flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Form Integration
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Configure the form webhook to create deals from submissions
                      </p>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="form_id">Form ID</Label>
                          <Input
                            id="form_id"
                            placeholder="e.g., form_123 or gravity_1"
                            value={formData.config.form_id || ''}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                config: { ...prev.config, form_id: e.target.value },
                              }))
                            }
                          />
                          <p className="text-xs text-muted-foreground">
                            The unique ID from your WordPress form
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label>Form Source</Label>
                          <Select
                            value={formData.config.form_source || 'generic'}
                            onValueChange={(value) =>
                              setFormData((prev) => ({
                                ...prev,
                                config: { 
                                  ...prev.config, 
                                  form_source: value as 'gravity_forms' | 'wpforms' | 'contact_form_7' | 'elementor_forms' | 'generic'
                                },
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select form plugin" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="gravity_forms">Gravity Forms</SelectItem>
                              <SelectItem value="wpforms">WPForms</SelectItem>
                              <SelectItem value="contact_form_7">Contact Form 7</SelectItem>
                              <SelectItem value="elementor_forms">Elementor Forms</SelectItem>
                              <SelectItem value="generic">Generic / Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label>Field Mappings</Label>
                        <p className="text-xs text-muted-foreground">
                          Map your form field names to contact fields (e.g., input_1, field_email)
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">First Name Field</Label>
                            <Input
                              placeholder="e.g., input_1 or first_name"
                              value={formData.config.field_mappings?.first_name || ''}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  config: {
                                    ...prev.config,
                                    field_mappings: {
                                      ...prev.config.field_mappings,
                                      first_name: e.target.value,
                                    },
                                  },
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Last Name Field</Label>
                            <Input
                              placeholder="e.g., input_2 or last_name"
                              value={formData.config.field_mappings?.last_name || ''}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  config: {
                                    ...prev.config,
                                    field_mappings: {
                                      ...prev.config.field_mappings,
                                      last_name: e.target.value,
                                    },
                                  },
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Email Field *</Label>
                            <Input
                              placeholder="e.g., input_3 or email"
                              value={formData.config.field_mappings?.email || ''}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  config: {
                                    ...prev.config,
                                    field_mappings: {
                                      ...prev.config.field_mappings,
                                      email: e.target.value,
                                    },
                                  },
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Phone Field</Label>
                            <Input
                              placeholder="e.g., input_4 or phone"
                              value={formData.config.field_mappings?.phone || ''}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  config: {
                                    ...prev.config,
                                    field_mappings: {
                                      ...prev.config.field_mappings,
                                      phone: e.target.value,
                                    },
                                  },
                                }))
                              }
                            />
                          </div>
                        </div>
                      </div>

                      <Card className="bg-blue-50/50 border-blue-200">
                        <CardContent className="p-3">
                          <div className="flex items-start gap-2">
                            <Link className="h-4 w-4 text-blue-600 mt-0.5" />
                            <div className="text-sm">
                              <p className="font-medium text-blue-900">Webhook URL</p>
                              <code className="text-xs text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                                {typeof window !== 'undefined' 
                                  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/form-webhook`
                                  : 'https://[your-project].supabase.co/functions/v1/form-webhook'
                                }
                              </code>
                              <p className="text-xs text-blue-600 mt-1">
                                Configure your form to POST to this URL
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </>
                )}

                {/* Round Robin (for deal creation) */}
                {selectedTemplate?.configurable.round_robin && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-blue-900 uppercase flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Deal Owner Assignment
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Select recruiters to include in round-robin assignment
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {recruiters.map((user) => (
                          <div
                            key={user.id}
                            className="flex items-center space-x-2 p-2 rounded-lg border hover:bg-gray-50"
                          >
                            <Checkbox
                              id={`user-${user.id}`}
                              checked={formData.config.round_robin_users?.includes(user.id)}
                              onCheckedChange={() => toggleRoundRobinUser(user.id)}
                            />
                            <label
                              htmlFor={`user-${user.id}`}
                              className="text-sm font-medium cursor-pointer flex-1"
                            >
                              {user.full_name || user.email}
                            </label>
                          </div>
                        ))}
                      </div>
                      {formData.config.round_robin_users && formData.config.round_robin_users.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {formData.config.round_robin_users.length} recruiter{formData.config.round_robin_users.length !== 1 ? 's' : ''} selected for round-robin assignment
                        </p>
                      )}
                    </div>
                  </>
                )}

                {/* Email & Wait Configuration */}
                {selectedTemplate?.configurable.emails && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-blue-900 uppercase">
                        Workflow Steps
                      </h3>

                      <div className="space-y-3">
                        {selectedTemplate.default_steps.map((step, index) => {
                          const emailSteps = selectedTemplate.default_steps.filter(
                            (s) => s.step_type === 'send_email'
                          )
                          const waitSteps = selectedTemplate.default_steps.filter(
                            (s) => s.step_type === 'wait'
                          )
                          const emailIndex = emailSteps.indexOf(step)
                          const waitIndex = waitSteps.indexOf(step)

                          return (
                            <div key={index} className="relative">
                              {index < selectedTemplate.default_steps.length - 1 && (
                                <div className="absolute left-[17px] top-[44px] w-0.5 h-[calc(100%-8px)] bg-gray-200" />
                              )}

                              <div className="flex items-center gap-3">
                                <div
                                  className={cn(
                                    'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
                                    step.step_type === 'send_email'
                                      ? 'bg-blue-100 text-blue-600'
                                      : step.step_type === 'wait'
                                      ? 'bg-gray-100 text-gray-600'
                                      : 'bg-orange-100 text-orange-600'
                                  )}
                                >
                                  {step.step_type === 'send_email' ? (
                                    <Mail className="h-4 w-4" />
                                  ) : step.step_type === 'wait' ? (
                                    <Clock className="h-4 w-4" />
                                  ) : (
                                    <ArrowRight className="h-4 w-4" />
                                  )}
                                </div>

                                <div className="flex-1">
                                  {step.step_type === 'send_email' && (
                                    <Select
                                      value={
                                        formData.config.emails?.find(
                                          (e) => e.step === emailIndex
                                        )?.template_id || ''
                                      }
                                      onValueChange={(value) =>
                                        updateEmailTemplate(emailIndex, value)
                                      }
                                    >
                                      <SelectTrigger className="h-9">
                                        <SelectValue
                                          placeholder={`Select Email ${emailIndex + 1} template`}
                                        />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {templates.map((template) => (
                                          <SelectItem key={template.id} value={template.id}>
                                            {template.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}

                                  {step.step_type === 'wait' && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm text-muted-foreground">
                                        Wait for
                                      </span>
                                      <Input
                                        type="number"
                                        min={1}
                                        max={30}
                                        className="w-16 h-9"
                                        value={formData.config.wait_days?.[waitIndex] || step.delay_days}
                                        onChange={(e) =>
                                          updateWaitDays(waitIndex, parseInt(e.target.value) || 1)
                                        }
                                      />
                                      <span className="text-sm text-muted-foreground">days</span>
                                    </div>
                                  )}

                                  {step.step_type === 'move_to_stage' && (
                                    <Select
                                      value={formData.config.final_stage_id || ''}
                                      onValueChange={(value) =>
                                        setFormData((prev) => ({
                                          ...prev,
                                          config: { ...prev.config, final_stage_id: value },
                                        }))
                                      }
                                      disabled={!formData.pipeline_id}
                                    >
                                      <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Select final stage" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {stages.map((stage) => (
                                          <SelectItem key={stage.id} value={stage.id}>
                                            {stage.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </>
                )}

                {/* Exit Conditions */}
                {selectedTemplate?.configurable.exit_stages && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-blue-900 uppercase">
                        Exit Conditions
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Stop the automation when the deal moves to any of these stages
                      </p>

                      <div className="flex items-center space-x-2 mb-3">
                        <Checkbox
                          id="exit-on-reply"
                          checked={formData.config.exit_on_reply}
                          onCheckedChange={(checked) =>
                            setFormData((prev) => ({
                              ...prev,
                              config: { ...prev.config, exit_on_reply: !!checked },
                            }))
                          }
                        />
                        <label htmlFor="exit-on-reply" className="text-sm cursor-pointer">
                          Stop when contact replies to an email
                        </label>
                      </div>

                      {!formData.pipeline_id ? (
                        <p className="text-sm text-muted-foreground italic">
                          Select a pipeline first to see available exit stages
                        </p>
                      ) : stages.filter((s) => s.id !== formData.trigger_stage_id).length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">
                          No other stages available in this pipeline
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {stages
                            .filter((s) => s.id !== formData.trigger_stage_id)
                            .map((stage) => (
                              <div
                                key={stage.id}
                                className="flex items-center space-x-2 p-2 rounded-lg border hover:bg-gray-50"
                              >
                                <Checkbox
                                  id={`stage-${stage.id}`}
                                  checked={formData.stop_on_stage_ids.includes(stage.id)}
                                  onCheckedChange={() => toggleExitStage(stage.id)}
                                />
                                <label
                                  htmlFor={`stage-${stage.id}`}
                                  className="text-sm cursor-pointer flex-1"
                                >
                                  {stage.name}
                                </label>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>

            <DialogFooter className="gap-2">
              {!editingAutomation && (
                <Button variant="outline" onClick={() => setStep('select_template')}>
                  Back
                </Button>
              )}
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={
                  !formData.name || 
                  !formData.pipeline_id || 
                  (selectedTemplate?.type !== 'deal_creation' && !formData.trigger_stage_id)
                }
                className="bg-blue-600 hover:bg-blue-700"
              >
                {editingAutomation ? 'Save Changes' : 'Create Automation'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}