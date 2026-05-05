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
import { TemplateSearchSelect } from '@/components/ui/template-search-select'
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
  FileCheck,
  Video,
  MessageSquare,
  ReceiptPoundSterling,
  AlertTriangle,
  PartyPopper,
  Plane,
  Bell,
  CreditCard,
  UserPlus,
  ListPlus,
  Trash2,
  Copy,
  Check,
  CornerUpLeft,
  TrendingUp,
  CircleSlash,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePipelines } from '@/lib/hooks/usePipelines'
import { usePipelineStages } from '@/lib/hooks/usePipelineStages'
import { useTemplates } from '@/lib/hooks/useTemplates'
import { useUsers } from '@/lib/hooks/useUsers'
import { useLists } from '@/lib/hooks/useLists'
import { useReceivedFormIds } from '@/lib/hooks/useFormSubmissions'
import { FormWebhookUrlBlock } from './FormWebhookUrlBlock'
import { toast } from '@/lib/hooks/use-toast'
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
  const { data: lists = [] } = useLists()
  // Surface form_ids AC has actually fired against us so the recruiter
  // doesn't have to remember the slug. Top 12 most-recent are rendered as
  // one-click chips below the Form ID input.
  const { data: receivedFormIds = [] } = useReceivedFormIds()

  // Round-robin candidates for deal_creation. Only role='recruiter' —
  // admins and super_admins exist to manage the platform, not to own
  // leads, so the client doesn't want them surfacing as candidates here.
  const recruiters = users.filter((u) => u.role === 'recruiter')

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
        // meeting_scheduler manages its own completion (enrollment ends
        // when the booked meeting is over). Replies to reminders are
        // expected, so don't bail on the first one.
        exit_on_reply: template.type === 'meeting_scheduler' ? false : prev.config.exit_on_reply,
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
      case 'application_received':
        return <FileCheck className="h-5 w-5" />
      case 'interview_reminder':
        return <Video className="h-5 w-5" />
      case 'meeting_scheduler':
        return <Video className="h-5 w-5" />
      case 'post_interview':
        return <MessageSquare className="h-5 w-5" />
      case 'deposit_invoice':
        return <ReceiptPoundSterling className="h-5 w-5" />
      case 'payment_overdue':
        return <AlertTriangle className="h-5 w-5" />
      case 'welcome_sequence':
        return <PartyPopper className="h-5 w-5" />
      case 'pre_departure':
        return <Plane className="h-5 w-5" />
      case 'list_assignment':
        return <ListPlus className="h-5 w-5" />
      default:
        return <Zap className="h-5 w-5" />
    }
  }

  const getTemplateColor = (type: AutomationType) => {
    switch (type) {
      case 'deal_creation':
        return 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400'
      case 'initial_contact':
        return 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
      case 'follow_up':
        return 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400'
      case 'application_received':
        return 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-600 dark:text-cyan-400'
      case 'interview_reminder':
        return 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400'
      case 'meeting_scheduler':
        return 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400'
      case 'post_interview':
        return 'bg-teal-100 dark:bg-teal-900/50 text-teal-600 dark:text-teal-400'
      case 'deposit_invoice':
        return 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400'
      case 'payment_overdue':
        return 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400'
      case 'welcome_sequence':
        return 'bg-pink-100 dark:bg-pink-900/50 text-pink-600 dark:text-pink-400'
      case 'pre_departure':
        return 'bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400'
      case 'list_assignment':
        return 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400'
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
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

            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="grid gap-3 py-4">
                {AUTOMATION_TEMPLATES.map((template) => (
                  <Card
                    key={template.id}
                    className="cursor-pointer transition-all hover:border-blue-300 hover:shadow-md dark:hover:border-blue-600"
                    onClick={() => handleTemplateSelect(template)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className={cn('p-2 rounded-lg', getTemplateColor(template.type))}>
                          {getTemplateIcon(template.type)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-gray-900 dark:text-white">{template.name}</h3>
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {template.description}
                          </p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {template.default_steps
                              .filter((s) => s.step_type === 'send_email')
                              .length > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                <Mail className="h-3 w-3 mr-1" />
                                {template.default_steps.filter((s) => s.step_type === 'send_email').length} email{template.default_steps.filter((s) => s.step_type === 'send_email').length !== 1 ? 's' : ''}
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
                            {template.configurable.stop_on_payment && (
                              <Badge variant="secondary" className="text-xs">
                                <CreditCard className="h-3 w-3 mr-1" />
                                Stops on payment
                              </Badge>
                            )}
                            {template.configurable.notify_parent && (
                              <Badge variant="secondary" className="text-xs">
                                <Bell className="h-3 w-3 mr-1" />
                                Parent notification
                              </Badge>
                            )}
                            {template.configurable.create_portal_account && (
                              <Badge variant="secondary" className="text-xs">
                                <UserPlus className="h-3 w-3 mr-1" />
                                Portal account
                              </Badge>
                            )}
                            {template.trigger_type === 'time_before_date' && (
                              <Badge variant="secondary" className="text-xs">
                                <Clock className="h-3 w-3 mr-1" />
                                Time-based
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
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

                {/* Pipeline & Trigger (hidden for list_assignment) */}
                {selectedTemplate?.type !== 'list_assignment' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase">
                    {selectedTemplate?.type === 'deal_creation' ? 'Pipeline Settings' : 'Trigger Settings'}
                  </h3>

                  <div className="space-y-4">
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
                      <>
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

                        {/* No email selector here. First-touch sends are
                            owned by the separate Initial Contact
                            automation (enters_stage → Initial Lead) so we
                            don't duplicate the responsibility — the
                            sequence + reply-driven exit + no-reply
                            fallback all live there. The hint below points
                            the recruiter to that flow. */}
                        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 p-3 text-xs text-muted-foreground">
                          This automation only creates the deal. To send a
                          first-touch email, add an{' '}
                          <span className="font-medium text-slate-700 dark:text-slate-200">
                            Initial Contact
                          </span>{' '}
                          automation on the same pipeline triggered by
                          deals entering the initial stage — it handles the
                          email sequence, reply-driven exit to Contact
                          Response, and the no-reply fallback stage.
                        </div>
                      </>
                    ) : selectedTemplate?.trigger_type === 'invoice_created' ||
                       selectedTemplate?.trigger_type === 'invoice_overdue' ||
                       selectedTemplate?.trigger_type === 'payment_received' ? (
                      <div className="space-y-2">
                        <Label>Trigger</Label>
                        <p className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
                          Fires automatically when{' '}
                          {selectedTemplate.trigger_type === 'invoice_created'
                            ? 'an invoice is sent'
                            : selectedTemplate.trigger_type === 'invoice_overdue'
                            ? 'an invoice goes overdue'
                            : 'a payment is received'}{' '}
                          for a deal in this pipeline. No stage selection needed.
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

                )}

                {/* Form Configuration (for deal creation and list assignment) */}
                {(selectedTemplate?.type === 'deal_creation' || selectedTemplate?.type === 'list_assignment') && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Form Integration
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Configure the form webhook to create deals from submissions
                      </p>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="form_id">
                            Form ID <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="form_id"
                            placeholder="e.g. summer, gap, uclan"
                            value={formData.config.form_id || ''}
                            onChange={(e) => {
                              // Lowercase + trim + strip whitespace as the
                              // user types so the token matches whatever ends
                              // up in the webhook URL exactly. Mismatches
                              // here are silent failures, so make them
                              // impossible to introduce in the first place.
                              const cleaned = e.target.value.toLowerCase().replace(/\s+/g, '')
                              setFormData((prev) => ({
                                ...prev,
                                config: { ...prev.config, form_id: cleaned },
                              }))
                            }}
                          />
                          <p className="text-xs text-muted-foreground">
                            Lowercase, no spaces. Must match the <code>?form_id=</code> in the webhook URL below.
                          </p>
                          {/* Recently received form_ids — click to fill.
                              Pulled from form_submissions so the recruiter
                              setting up an automation for an existing AC
                              form doesn't have to remember (or guess) the
                              slug. Highlighted when the field already
                              matches one of the chips, so a typo is
                              visually obvious. */}
                          {receivedFormIds.length > 0 && (
                            <div className="space-y-1.5 pt-1">
                              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                                Recently received from AC
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {receivedFormIds.slice(0, 12).map((r) => {
                                  const active = formData.config.form_id === r.form_id
                                  return (
                                    <button
                                      key={r.form_id}
                                      type="button"
                                      onClick={() =>
                                        setFormData((prev) => ({
                                          ...prev,
                                          config: { ...prev.config, form_id: r.form_id },
                                        }))
                                      }
                                      title={`${r.submissions} submission${r.submissions === 1 ? '' : 's'} · last seen ${new Date(r.last_seen).toLocaleDateString()}`}
                                      className={cn(
                                        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition',
                                        active
                                          ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-300'
                                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
                                      )}
                                    >
                                      <code className="font-mono">{r.form_id}</code>
                                      <span className="text-[10px] text-muted-foreground">
                                        {r.submissions}
                                      </span>
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          )}
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
                                  form_source: value as 'activecampaign' | 'gravity_forms' | 'wpforms' | 'contact_form_7' | 'elementor_forms' | 'generic'
                                },
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select form plugin" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="activecampaign">ActiveCampaign</SelectItem>
                              <SelectItem value="gravity_forms">Gravity Forms</SelectItem>
                              <SelectItem value="wpforms">WPForms</SelectItem>
                              <SelectItem value="contact_form_7">Contact Form 7</SelectItem>
                              <SelectItem value="elementor_forms">Elementor Forms</SelectItem>
                              <SelectItem value="generic">Generic / Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <FormWebhookUrlBlock
                        formId={formData.config.form_id}
                        formSource={formData.config.form_source}
                      />

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

                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Link className="h-4 w-4" />
                          Webhook URL
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            readOnly
                            value={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/form-webhook`}
                            className="text-xs font-mono bg-slate-50 dark:bg-slate-800"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/form-webhook`)
                            }}
                          >
                            Copy
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Configure your form to POST to this URL
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {/* List Assignment (for deal_creation and list_assignment) */}
                {(selectedTemplate?.type === 'deal_creation' || selectedTemplate?.type === 'list_assignment') && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase flex items-center gap-2">
                        <ListPlus className="h-4 w-4" />
                        List Assignment
                      </h3>

                      {/* Static Lists */}
                      <div className="space-y-2">
                        <Label>Static Lists</Label>
                        <p className="text-xs text-muted-foreground">
                          Contacts will always be added to these lists
                        </p>
                        {lists.length === 0 ? (
                          <p className="text-sm text-muted-foreground italic">No lists created yet</p>
                        ) : (
                          <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                            {lists.map((list) => (
                              <div
                                key={list.id}
                                className="flex items-center space-x-2 p-2 rounded-lg border hover:bg-gray-50 dark:hover:bg-slate-800"
                              >
                                <Checkbox
                                  id={`static-list-${list.id}`}
                                  checked={formData.config.static_list_ids?.includes(list.id) || false}
                                  onCheckedChange={(checked) => {
                                    const current = formData.config.static_list_ids || []
                                    const newIds = checked
                                      ? [...current, list.id]
                                      : current.filter(id => id !== list.id)
                                    setFormData(prev => ({
                                      ...prev,
                                      config: { ...prev.config, static_list_ids: newIds },
                                    }))
                                  }}
                                />
                                <label
                                  htmlFor={`static-list-${list.id}`}
                                  className="text-sm cursor-pointer flex-1"
                                >
                                  {list.name}
                                </label>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Dynamic List Rules */}
                      <div className="space-y-2">
                        <Label>Dynamic List Rules</Label>
                        <p className="text-xs text-muted-foreground">
                          Add contacts to lists based on their form data
                        </p>

                        {(formData.config.dynamic_list_rules || []).map((rule, index) => (
                          <div
                            key={index}
                            className="rounded-lg border bg-slate-50/60 dark:bg-slate-900/40 p-3"
                          >
                            <div className="flex flex-wrap items-end gap-2">
                              <div className="flex-1 min-w-[140px] space-y-1">
                                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                  When field
                                </Label>
                                <Select
                                  value={rule.field}
                                  onValueChange={(value) => {
                                    const rules = [...(formData.config.dynamic_list_rules || [])]
                                    rules[index] = { ...rules[index], field: value }
                                    setFormData(prev => ({
                                      ...prev,
                                      config: { ...prev.config, dynamic_list_rules: rules },
                                    }))
                                  }}
                                >
                                  <SelectTrigger className="h-9 w-full">
                                    <SelectValue placeholder="Field" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="gender">Gender</SelectItem>
                                    <SelectItem value="graduation_year">Grad Year</SelectItem>
                                    <SelectItem value="country">Country</SelectItem>
                                    <SelectItem value="state">State</SelectItem>
                                    <SelectItem value="position">Position</SelectItem>
                                    <SelectItem value="sport">Sport</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="flex-1 min-w-[120px] space-y-1">
                                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                  Equals
                                </Label>
                                <Input
                                  placeholder="Value"
                                  className="h-9 w-full"
                                  value={rule.value}
                                  onChange={(e) => {
                                    const rules = [...(formData.config.dynamic_list_rules || [])]
                                    rules[index] = { ...rules[index], value: e.target.value }
                                    setFormData(prev => ({
                                      ...prev,
                                      config: { ...prev.config, dynamic_list_rules: rules },
                                    }))
                                  }}
                                />
                              </div>

                              <div className="flex-[2] min-w-[180px] space-y-1">
                                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                  Add to list
                                </Label>
                                <Select
                                  value={rule.list_id}
                                  onValueChange={(value) => {
                                    const rules = [...(formData.config.dynamic_list_rules || [])]
                                    rules[index] = { ...rules[index], list_id: value }
                                    setFormData(prev => ({
                                      ...prev,
                                      config: { ...prev.config, dynamic_list_rules: rules },
                                    }))
                                  }}
                                >
                                  <SelectTrigger className="h-9 w-full">
                                    <SelectValue placeholder="Select list" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {lists.map((list) => (
                                      <SelectItem key={list.id} value={list.id}>
                                        {list.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 shrink-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                                onClick={() => {
                                  const rules = (formData.config.dynamic_list_rules || []).filter((_, i) => i !== index)
                                  setFormData(prev => ({
                                    ...prev,
                                    config: { ...prev.config, dynamic_list_rules: rules },
                                  }))
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() => {
                            const rules = [...(formData.config.dynamic_list_rules || []), { field: 'gender', value: '', list_id: '' }]
                            setFormData(prev => ({
                              ...prev,
                              config: { ...prev.config, dynamic_list_rules: rules },
                            }))
                          }}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1.5" />
                          Add Rule
                        </Button>
                      </div>
                    </div>
                  </>
                )}

                {/* Round Robin (for deal creation) */}
                {selectedTemplate?.configurable.round_robin && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Deal Owner Assignment
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Select recruiters to include in round-robin assignment.
                        Leave everyone unchecked to round-robin across all
                        recruiters. Admins and super_admins aren&apos;t eligible
                        to own deals.
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {recruiters.map((user) => (
                          <div
                            key={user.id}
                            className="flex items-center space-x-2 p-2 rounded-lg border hover:bg-gray-50 dark:hover:bg-slate-800"
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

                {/* Meeting Scheduler — replaces the generic Workflow Steps
                    section because the shape (1 schedule email + N reminders
                    relative to a future deal date) doesn't fit the
                    emails+wait_days[] config used elsewhere. */}
                {selectedTemplate?.type === 'meeting_scheduler' && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase">
                        Meeting Flow
                      </h3>

                      <div className="space-y-2">
                        <Label>Schedule meeting email *</Label>
                        <TemplateSearchSelect
                          templates={templates}
                          value={formData.config.schedule_email_template_id || ''}
                          onValueChange={(value) =>
                            setFormData((prev) => ({
                              ...prev,
                              config: { ...prev.config, schedule_email_template_id: value },
                            }))
                          }
                          placeholder="Select template that contains the booking link"
                          className="h-9"
                        />
                        <p className="text-xs text-muted-foreground">
                          Sent immediately when the trigger fires. The reminders
                          below fire relative to the meeting date the player
                          picks (saved on the deal as <code>interview_date</code>).
                        </p>
                      </div>

                      <Separator className="my-2" />

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Reminders (optional, max 2)</Label>
                          {(formData.config.reminders?.length || 0) < 2 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setFormData((prev) => ({
                                  ...prev,
                                  config: {
                                    ...prev.config,
                                    reminders: [
                                      ...(prev.config.reminders || []),
                                      { template_id: '', before_value: 1, before_unit: 'days' },
                                    ],
                                  },
                                }))
                              }
                            >
                              <Plus className="h-3.5 w-3.5 mr-1" /> Add reminder
                            </Button>
                          )}
                        </div>

                        {(formData.config.reminders || []).length === 0 && (
                          <p className="text-xs text-muted-foreground italic">
                            No reminders configured — the schedule email alone will be sent.
                          </p>
                        )}

                        {(formData.config.reminders || []).map((reminder, idx) => (
                          <div
                            key={idx}
                            className="rounded-lg border p-3 space-y-2 bg-gray-50 dark:bg-slate-800/50"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold uppercase text-muted-foreground">
                                Reminder {idx + 1}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-red-600 hover:text-red-700"
                                onClick={() =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    config: {
                                      ...prev.config,
                                      reminders: (prev.config.reminders || []).filter((_, i) => i !== idx),
                                    },
                                  }))
                                }
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-xs">Template</Label>
                              <TemplateSearchSelect
                                templates={templates}
                                value={reminder.template_id}
                                onValueChange={(value) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    config: {
                                      ...prev.config,
                                      reminders: (prev.config.reminders || []).map((r, i) =>
                                        i === idx ? { ...r, template_id: value } : r,
                                      ),
                                    },
                                  }))
                                }
                                placeholder="Select reminder template"
                                className="h-9"
                              />
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">Send</span>
                              <Input
                                type="number"
                                min={1}
                                max={365}
                                className="w-20 h-9"
                                value={reminder.before_value}
                                onChange={(e) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    config: {
                                      ...prev.config,
                                      reminders: (prev.config.reminders || []).map((r, i) =>
                                        i === idx
                                          ? { ...r, before_value: Math.max(1, parseInt(e.target.value) || 1) }
                                          : r,
                                      ),
                                    },
                                  }))
                                }
                              />
                              <Select
                                value={reminder.before_unit}
                                onValueChange={(value: 'hours' | 'days') =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    config: {
                                      ...prev.config,
                                      reminders: (prev.config.reminders || []).map((r, i) =>
                                        i === idx ? { ...r, before_unit: value } : r,
                                      ),
                                    },
                                  }))
                                }
                              >
                                <SelectTrigger className="w-28 h-9">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="hours">hours</SelectItem>
                                  <SelectItem value="days">days</SelectItem>
                                </SelectContent>
                              </Select>
                              <span className="text-sm text-muted-foreground">before meeting</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {!formData.config.schedule_email_template_id && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-2">
                          <AlertTriangle className="h-3 w-3" />
                          Pick a schedule meeting email to enable saving
                        </p>
                      )}
                    </div>
                  </>
                )}

                {/* Email & Wait Configuration */}
                {selectedTemplate?.configurable.emails && selectedTemplate?.type !== 'meeting_scheduler' && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase">
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
                                <div className="absolute left-[17px] top-[44px] w-0.5 h-[calc(100%-8px)] bg-gray-200 dark:bg-gray-700" />
                              )}

                              <div className="flex items-center gap-3">
                                <div
                                  className={cn(
                                    'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
                                    step.step_type === 'send_email'
                                      ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                                      : step.step_type === 'wait'
                                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                                      : 'bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400'
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
                                    <TemplateSearchSelect
                                      templates={templates}
                                      value={
                                        formData.config.emails?.find(
                                          (e) => e.step === emailIndex
                                        )?.template_id || ''
                                      }
                                      onValueChange={(value) =>
                                        updateEmailTemplate(emailIndex, value)
                                      }
                                      placeholder={`Select Email ${emailIndex + 1} template`}
                                      className="h-9"
                                    />
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

                      {!formData.config.emails?.some(e => e.template_id) && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-2">
                          <AlertTriangle className="h-3 w-3" />
                          Select at least one email template to enable saving
                        </p>
                      )}
                    </div>
                  </>
                )}

                {/* deposit_invoice: two outcomes, two destinations.
                    - Paid stage: deal moves here when an invoice flips to 'paid'.
                    - Unpaid stage: deal moves here if all reminders fire
                      and still no invoice was paid. */}
                {selectedTemplate?.type === 'deposit_invoice' && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase">
                        Outcome Stages
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Where the deal should land in each outcome.
                      </p>

                      <div className="space-y-2">
                        <Label>Move deal here when invoice is paid</Label>
                        <Select
                          value={formData.config.paid_stage_id || ''}
                          onValueChange={(value) =>
                            setFormData((prev) => ({
                              ...prev,
                              config: { ...prev.config, paid_stage_id: value || null },
                            }))
                          }
                          disabled={!formData.pipeline_id}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select paid stage (e.g. Deposit Paid)" />
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

                      <div className="space-y-2">
                        <Label>Move deal here if all reminders sent without payment</Label>
                        <Select
                          value={formData.config.unpaid_stage_id || ''}
                          onValueChange={(value) =>
                            setFormData((prev) => ({
                              ...prev,
                              config: { ...prev.config, unpaid_stage_id: value || null },
                            }))
                          }
                          disabled={!formData.pipeline_id}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select unpaid stage (e.g. Lost / Overdue)" />
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
                    </div>
                  </>
                )}

                {/* meeting_scheduler has a built-in exit condition (the
                    enrollment completes naturally after the booked meeting
                    ends), so the generic exit-on-reply / stage-based exit
                    UI doesn't apply. Show a short note instead. */}
                {selectedTemplate?.type === 'meeting_scheduler' && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase">
                        Completion
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        This automation finishes automatically once all reminders
                        have been sent <strong>and</strong> the booked meeting time
                        has passed. If the player never books a meeting, the
                        enrollment stays parked indefinitely until they do.
                      </p>
                    </div>
                  </>
                )}

                {/* Exit Goals — three independent outcome paths for ending
                    the sequence early. All three rely on existing DB
                    triggers (stop_enrollments_on_reply_match +
                    move_deal_on_enrollment_exit) so the modal just sets
                    the config; nothing else needs wiring. */}
                {selectedTemplate?.configurable.exit_stages && selectedTemplate?.type !== 'meeting_scheduler' && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase">
                        Exit Goals
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Three independent ways to end this automation early. Each outcome routes the deal to its own stage.
                      </p>

                      {/* Goal 1 — Reply received */}
                      <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20 p-3 space-y-3">
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
                            <CornerUpLeft className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                              Goal 1 — Contact replies
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Positive outcome. Triggered the moment a reply auto-matches one of this sequence&apos;s emails.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pl-9">
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
                          <label htmlFor="exit-on-reply" className="text-xs cursor-pointer">
                            Stop the sequence when a reply lands
                          </label>
                        </div>

                        <div className="pl-9 space-y-1.5">
                          <Label className="text-xs">Move deal to:</Label>
                          <Select
                            value={formData.config.exit_to_stage_id ?? '__none__'}
                            onValueChange={(value) =>
                              setFormData((prev) => ({
                                ...prev,
                                config: {
                                  ...prev.config,
                                  exit_to_stage_id: value === '__none__' ? null : value,
                                },
                              }))
                            }
                            disabled={!formData.pipeline_id}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Don't move the deal" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Don&apos;t move the deal</SelectItem>
                              {stages.map((stage) => (
                                <SelectItem key={`replied-${stage.id}`} value={stage.id}>
                                  {stage.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-[11px] text-muted-foreground">
                            Typically <span className="font-medium">Contact Response</span>.
                          </p>
                        </div>
                      </div>

                      {/* Goal 2 — Deal advances. Add-condition pattern:
                          one row per picked stage, each row has a
                          dropdown limited to stages not already picked,
                          plus a remove button and an "Add another
                          condition" link below. */}
                      <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20 p-3 space-y-3">
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
                            <TrendingUp className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                              Goal 2 — Deal advances to a downstream stage
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Add the stages that mean the deal has progressed and this sequence should stop immediately. Any one matching = exit.
                            </p>
                          </div>
                        </div>

                        {!formData.pipeline_id ? (
                          <p className="pl-9 text-xs text-muted-foreground italic">
                            Select a pipeline first to choose stages.
                          </p>
                        ) : (
                          <div className="pl-9 space-y-2">
                            {formData.stop_on_stage_ids.length === 0 ? (
                              <p className="text-xs text-muted-foreground italic">
                                No exit stages set. Click below to add one.
                              </p>
                            ) : (
                              formData.stop_on_stage_ids.map((stageId, idx) => {
                                // Each row's dropdown shows the row's
                                // current stage plus any stage NOT picked
                                // by another row, so the same stage can't
                                // be added twice.
                                const otherPicks = formData.stop_on_stage_ids.filter((_, i) => i !== idx)
                                const availableForThisRow = stages.filter(
                                  (s) =>
                                    s.id !== formData.trigger_stage_id &&
                                    (s.id === stageId || !otherPicks.includes(s.id)),
                                )
                                return (
                                  <div key={`stop-${idx}`} className="flex items-center gap-2">
                                    <span className="text-[11px] uppercase tracking-wider text-amber-800/70 dark:text-amber-300/70 w-12 shrink-0">
                                      {idx === 0 ? 'If stage' : 'OR stage'}
                                    </span>
                                    <Select
                                      value={stageId || '__pick__'}
                                      onValueChange={(value) => {
                                        if (value === '__pick__') return
                                        setFormData((prev) => {
                                          const next = [...prev.stop_on_stage_ids]
                                          next[idx] = value
                                          return { ...prev, stop_on_stage_ids: next }
                                        })
                                      }}
                                    >
                                      <SelectTrigger className="h-9 flex-1">
                                        <SelectValue placeholder="Pick a stage" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {availableForThisRow.map((stage) => (
                                          <SelectItem key={stage.id} value={stage.id}>
                                            {stage.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-9 w-9 text-muted-foreground hover:text-red-600"
                                      onClick={() => {
                                        setFormData((prev) => ({
                                          ...prev,
                                          stop_on_stage_ids: prev.stop_on_stage_ids.filter(
                                            (_, i) => i !== idx,
                                          ),
                                        }))
                                      }}
                                      title="Remove this condition"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                )
                              })
                            )}

                            {(() => {
                              const remainingStages = stages.filter(
                                (s) =>
                                  s.id !== formData.trigger_stage_id &&
                                  !formData.stop_on_stage_ids.includes(s.id),
                              )
                              if (remainingStages.length === 0) return null
                              return (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/40"
                                  onClick={() => {
                                    // Append the first remaining stage so
                                    // the row lands with a real value
                                    // immediately — no empty-row state.
                                    setFormData((prev) => ({
                                      ...prev,
                                      stop_on_stage_ids: [
                                        ...prev.stop_on_stage_ids,
                                        remainingStages[0].id,
                                      ],
                                    }))
                                  }}
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add another condition
                                </Button>
                              )
                            })()}
                          </div>
                        )}
                      </div>

                      {/* Goal 3 — No-reply / sequence finished. */}
                      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 p-3 space-y-3">
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700">
                            <CircleSlash className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                              Goal 3 — Sequence finishes with no reply
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Negative outcome. Fires when every email + wait has run and neither Goal 1 nor Goal 2 ever matched.
                            </p>
                          </div>
                        </div>

                        <div className="pl-9 space-y-1.5">
                          <Label className="text-xs">Move deal to:</Label>
                          <Select
                            value={formData.config.no_reply_stage_id ?? '__none__'}
                            onValueChange={(value) =>
                              setFormData((prev) => ({
                                ...prev,
                                config: {
                                  ...prev.config,
                                  no_reply_stage_id: value === '__none__' ? null : value,
                                },
                              }))
                            }
                            disabled={!formData.pipeline_id}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Don't move the deal" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Don&apos;t move the deal</SelectItem>
                              {stages.map((stage) => (
                                <SelectItem key={`noreply-${stage.id}`} value={stage.id}>
                                  {stage.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-[11px] text-muted-foreground">
                            Typically <span className="font-medium">Dormant</span>, <span className="font-medium">Dead</span>, or a &quot;No Reply&quot; column.
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Parent Notification (for application_received) */}
                {selectedTemplate?.configurable.notify_parent && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase flex items-center gap-2">
                        <Bell className="h-4 w-4" />
                        Notifications
                      </h3>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="notify-parent"
                          checked={formData.config.notify_parent}
                          onCheckedChange={(checked) =>
                            setFormData((prev) => ({
                              ...prev,
                              config: { ...prev.config, notify_parent: !!checked },
                            }))
                          }
                        />
                        <label htmlFor="notify-parent" className="text-sm cursor-pointer">
                          Also send notification to parent/guardian (if email on file)
                        </label>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        A separate notification email will be sent to the parent&apos;s email address if available on the contact record
                      </p>
                    </div>
                  </>
                )}

                {/* Stop on Payment (for deposit_invoice) */}
                {selectedTemplate?.configurable.stop_on_payment && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Payment Trigger
                      </h3>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="stop-on-payment"
                          checked={formData.config.stop_on_payment ?? true}
                          onCheckedChange={(checked) =>
                            setFormData((prev) => ({
                              ...prev,
                              config: { ...prev.config, stop_on_payment: !!checked },
                            }))
                          }
                        />
                        <label htmlFor="stop-on-payment" className="text-sm cursor-pointer">
                          Stop reminders when payment is received
                        </label>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Automation will automatically stop when a Stripe payment is received for this contact&apos;s invoice
                      </p>
                    </div>
                  </>
                )}

                {/* Create Portal Account (for welcome_sequence) */}
                {selectedTemplate?.configurable.create_portal_account && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase flex items-center gap-2">
                        <UserPlus className="h-4 w-4" />
                        Player Portal
                      </h3>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="create-portal-account"
                          checked={formData.config.create_portal_account ?? true}
                          onCheckedChange={(checked) =>
                            setFormData((prev) => ({
                              ...prev,
                              config: { ...prev.config, create_portal_account: !!checked },
                            }))
                          }
                        />
                        <label htmlFor="create-portal-account" className="text-sm cursor-pointer">
                          Create player portal account and send login credentials
                        </label>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        A portal account will be created for the player and login details will be included in the welcome email
                      </p>

                      {/* Activation exit: when the player sets their
                          password, exit this automation and move the deal
                          to the chosen stage. Optional. */}
                      <div className="space-y-2 pt-2">
                        <Label>When player activates portal, move deal to</Label>
                        <Select
                          value={formData.config.activated_stage_id || ''}
                          onValueChange={(value) =>
                            setFormData((prev) => ({
                              ...prev,
                              config: { ...prev.config, activated_stage_id: value || null },
                            }))
                          }
                          disabled={!formData.pipeline_id}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select activated stage (optional)" />
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
                          If set, the automation exits as soon as the player sets their portal password and the deal moves to this stage.
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {/* Time-based configuration (for pre_departure) */}
                {selectedTemplate?.configurable.days_before_date && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Schedule Settings
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Emails will be sent relative to the programme start date
                      </p>
                      <div className="space-y-2">
                        <Label>Date Field</Label>
                        <Select
                          value={formData.config.date_field || 'programme_start_date'}
                          onValueChange={(value) =>
                            setFormData((prev) => ({
                              ...prev,
                              config: {
                                ...prev.config,
                                date_field: value as 'programme_start_date' | 'interview_date' | 'arrival_date'
                              },
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="programme_start_date">Programme Start Date</SelectItem>
                            <SelectItem value="interview_date">Interview Date</SelectItem>
                            <SelectItem value="arrival_date">Arrival Date</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Which date column on the deal the cron should watch.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Days Before</Label>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          value={formData.config.days_before ?? ''}
                          placeholder="e.g. 30"
                          onChange={(e) => {
                            const raw = e.target.value
                            const parsed = raw === '' ? undefined : Math.max(0, Number(raw))
                            setFormData((prev) => ({
                              ...prev,
                              config: {
                                ...prev.config,
                                days_before: Number.isFinite(parsed) ? parsed : undefined,
                              },
                            }))
                          }}
                        />
                        <p className="text-xs text-muted-foreground">
                          Enrol the deal this many days before its target date. The sequence then runs from there.
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>

            <DialogFooter className="gap-2">
              {!editingAutomation && (
                <Button variant="outline" onClick={() => {
                  setStep('select_template')
                  setSelectedTemplate(null)
                }}>
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
                  (selectedTemplate?.type !== 'list_assignment' && !formData.pipeline_id) ||
                  (selectedTemplate?.type !== 'deal_creation' &&
                    selectedTemplate?.type !== 'list_assignment' &&
                    selectedTemplate?.trigger_type !== 'invoice_created' &&
                    selectedTemplate?.trigger_type !== 'invoice_overdue' &&
                    selectedTemplate?.trigger_type !== 'payment_received' &&
                    !formData.trigger_stage_id) ||
                  (selectedTemplate?.type === 'meeting_scheduler' &&
                    !formData.config.schedule_email_template_id) ||
                  (selectedTemplate?.configurable.emails &&
                    selectedTemplate?.type !== 'meeting_scheduler' &&
                    !formData.config.emails?.some(e => e.template_id))
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

// Renders the full webhook URL the client should paste into ActiveCampaign
// or their WordPress form plugin. Token is the form_id; the endpoint switches
// based on form_source so AC and WordPress users each see their correct URL.
//
// FormWebhookUrlBlock now lives in its own file — see
// ./FormWebhookUrlBlock.tsx — so the AutomationDetailSheet can render it
// from the read-only Overview tab too.