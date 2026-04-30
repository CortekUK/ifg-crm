'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/hooks/use-toast'
import { OwnerSelect } from '@/components/ui/owner-select'

interface CreateContactModalProps {
  isOpen: boolean
  onClose: () => void
}

interface Tag {
  id: string
  name: string
  color: string | null
  category: string | null
}

interface List {
  id: string
  name: string
}

interface Pipeline {
  id: string
  name: string
}

const currentYear = new Date().getFullYear()
const graduationYears = [currentYear, currentYear + 1, currentYear + 2, currentYear + 3, currentYear + 4]

const countries = [
  'United Kingdom',
  'United States',
  'Canada',
  'Australia',
  'Germany',
  'France',
  'Spain',
  'Italy',
  'Netherlands',
  'Brazil',
  'Mexico',
  'Argentina',
  'Japan',
  'South Korea',
  'China',
  'Other',
]

const sources = [
  { value: 'manual', label: 'Manual Entry' },
  { value: 'website_form', label: 'Website Form' },
  { value: 'tournament', label: 'Tournament' },
  { value: 'referral', label: 'Referral' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'email_campaign', label: 'Email Campaign' },
  { value: 'csv_import', label: 'CSV Import' },
  { value: 'event', label: 'Event' },
]

const initialFormData = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  date_of_birth: '',
  graduation_year: '',
  gender: '',
  country: '',
  state: '',
  city: '',
  club_name: '',
  position: '',
  gpa: '',
  parent_name: '',
  parent_email: '',
  parent_phone: '',
  source: '',
  notes: '',
}

export function CreateContactModal({ isOpen, onClose }: CreateContactModalProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  
  const [formData, setFormData] = useState(initialFormData)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedListId, setSelectedListId] = useState<string>('')
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null)
  const [createDeal, setCreateDeal] = useState(false)
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('')

  // Fetch tags
  const { data: availableTags = [] } = useQuery<Tag[]>({
    queryKey: ['tags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .order('name')
      if (error) throw error
      return data || []
    },
  })

  // Fetch lists
  const { data: lists = [] } = useQuery<List[]>({
    queryKey: ['lists'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lists')
        .select('id, name')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
  })

  // Fetch pipelines
  const { data: pipelines = [] } = useQuery<Pipeline[]>({
    queryKey: ['pipelines-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipelines')
        .select('id, name')
        .eq('is_active', true)
        .order('display_order')
      if (error) throw error
      return data || []
    },
  })

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData(initialFormData)
      setSelectedTags([])
      setSelectedListId('')
      setSelectedOwnerId(null)
      setCreateDeal(false)
      setSelectedPipelineId('')
    }
  }, [isOpen])

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    )
  }

  // Create contact mutation
  const createContactMutation = useMutation({
    mutationFn: async () => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const emailLower = formData.email.toLowerCase().trim()

      // Check if email belongs to a staff user (admin/recruiter/super_admin)
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id, role, email')
        .eq('email', emailLower)
        .in('role', ['super_admin', 'admin', 'recruiter'])
        .single()

      if (existingUser) {
        const roleLabel = existingUser.role === 'super_admin' ? 'Super Admin' : existingUser.role === 'admin' ? 'Admin' : 'Recruiter'
        throw new Error(`This email belongs to a ${roleLabel} account and cannot be added as a contact.`)
      }

      // Check if contact with this email already exists
      const { data: existingContact } = await supabase
        .from('contacts')
        .select('id, first_name, last_name')
        .eq('email', emailLower)
        .single()

      if (existingContact) {
        throw new Error(`A contact with this email already exists: ${existingContact.first_name} ${existingContact.last_name}`)
      }

      // Create the contact
      const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: emailLower,
          phone: formData.phone || null,
          date_of_birth: formData.date_of_birth || null,
          graduation_year: formData.graduation_year ? parseInt(formData.graduation_year) : null,
          gender: formData.gender || null,
          sport: 'football',
          country: formData.country || null,
          state: formData.state || null,
          city: formData.city || null,
          club_name: formData.club_name || null,
          position: formData.position || null,
          gpa: formData.gpa ? parseFloat(formData.gpa) : null,
          parent_name: formData.parent_name || null,
          parent_email: formData.parent_email || null,
          parent_phone: formData.parent_phone || null,
          source: formData.source || 'manual',
          notes: formData.notes || null,
          owner_id: selectedOwnerId || null,
        })
        .select()
        .single()

      if (contactError) throw new Error(contactError.message || 'Failed to insert contact')

      // Mirror the initial note into contact_notes so it shows up in the
      // detail sheet's Notes tab. The contacts.notes column is a single
      // legacy string field; the Notes tab reads from contact_notes
      // (timestamped rows with author). Without this insert, the user
      // types a note on creation and never sees it again.
      if (formData.notes && formData.notes.trim()) {
        await supabase.from('contact_notes').insert({
          contact_id: contact.id,
          content: formData.notes.trim(),
          created_by_id: user.id,
        })
      }

      // Add tags if selected
      if (selectedTags.length > 0) {
        const tagInserts = selectedTags.map((tagId) => ({
          contact_id: contact.id,
          tag_id: tagId,
        }))
        await supabase.from('contact_tags').insert(tagInserts)
      }

      // Add to list if selected
      if (selectedListId) {
        await supabase.from('contact_lists').insert({
          list_id: selectedListId,
          contact_id: contact.id,
        })
      }

      // Add to "All Contacts Everyone" list (if not already added via list selection)
      if (!selectedListId) {
        const { data: allContactsList } = await supabase
          .from('lists')
          .select('id')
          .ilike('name', '%all contacts%everyone%')
          .limit(1)
          .single()

        if (allContactsList) {
          // Check if already exists before inserting
          const { data: existing } = await supabase
            .from('contact_lists')
            .select('id')
            .eq('list_id', allContactsList.id)
            .eq('contact_id', contact.id)
            .maybeSingle()

          if (!existing) {
            await supabase.from('contact_lists').insert({
              list_id: allContactsList.id,
              contact_id: contact.id,
            })
          }
        }
      }

      // Create deal if requested
      if (createDeal && selectedPipelineId) {
        // Get first stage of pipeline
        const { data: firstStage } = await supabase
          .from('pipeline_stages')
          .select('id')
          .eq('pipeline_id', selectedPipelineId)
          .order('display_order')
          .limit(1)
          .single()

        if (firstStage) {
          const { data: deal, error: dealError } = await supabase
            .from('deals')
            .insert({
              contact_id: contact.id,
              pipeline_id: selectedPipelineId,
              current_stage_id: firstStage.id,
              deal_owner_id: user.id,
              title: `${formData.first_name} ${formData.last_name}`,
              source: 'manual',
            })
            .select()
            .single()

          if (dealError) throw dealError

          // Log deal creation activity
          await supabase.from('deal_activities').insert({
            deal_id: deal.id,
            activity_type: 'deal_created',
            description: 'Deal created from contact form',
            performed_by_id: user.id,
          })
        }
      }

      return contact
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      queryClient.invalidateQueries({ queryKey: ['contact-stats'] })
      queryClient.invalidateQueries({ queryKey: ['deals'] })
      
      toast({
        title: 'Contact created',
        description: `${formData.first_name} ${formData.last_name} has been added${createDeal ? ' with a new deal' : ''}.`,
      })

      onClose()
    },
    onError: (error: unknown) => {
      const message = error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: string }).message)
          : 'An unexpected error occurred. Please try again.'
      toast({
        title: 'Failed to create contact',
        description: message,
        variant: 'destructive',
      })
    },
  })

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const emailError = formData.email && !emailRegex.test(formData.email) ? 'Please enter a valid email address' : ''
  const parentEmailFormatError =
    formData.parent_email && !emailRegex.test(formData.parent_email)
      ? 'Please enter a valid email address'
      : ''
  // The player and their guardian are different people — same address means
  // someone fat-fingered the form. We accept the same address for player and
  // guardian phone (rare but possible — same household line) but never email.
  const parentEmailSameError =
    formData.parent_email &&
    formData.email &&
    formData.parent_email.trim().toLowerCase() === formData.email.trim().toLowerCase()
      ? 'Parent email must be different from the player email'
      : ''
  const parentEmailError = parentEmailFormatError || parentEmailSameError

  const handleSubmit = () => {
    if (
      !formData.first_name ||
      !formData.last_name ||
      !formData.email ||
      emailError ||
      parentEmailError
    ) {
      return
    }
    createContactMutation.mutate()
  }

  const isValid =
    formData.first_name &&
    formData.last_name &&
    formData.email &&
    !emailError &&
    !parentEmailError
  const isLoading = createContactMutation.isPending

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl flex flex-col p-0 gap-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <SheetTitle className="font-oswald text-xl font-bold uppercase text-gray-900 dark:text-white">
            Add Contact
          </SheetTitle>
          <SheetDescription>
            Add a new contact to your database.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6">
          <div className="space-y-6 py-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                Basic Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    First Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => handleChange('first_name', e.target.value)}
                    placeholder="John"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Last Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => handleChange('last_name', e.target.value)}
                    placeholder="Smith"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="john.smith@example.com"
                  className={emailError ? 'border-red-500 focus-visible:ring-red-500' : ''}
                />
                {emailError && (
                  <p className="text-xs text-red-500 mt-1">{emailError}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Phone
                  </Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    placeholder="+44 7700 900123"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dob" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Date of Birth
                  </Label>
                  <Input
                    id="dob"
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => handleChange('date_of_birth', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Player Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                Player Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Graduation Year</Label>
                  <Select
                    value={formData.graduation_year}
                    onValueChange={(v) => handleChange('graduation_year', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      {graduationYears.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Gender</Label>
                  <Select value={formData.gender} onValueChange={(v) => handleChange('gender', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="position" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Position
                </Label>
                <Input
                  id="position"
                  value={formData.position}
                  onChange={(e) => handleChange('position', e.target.value)}
                  placeholder="e.g. Midfielder"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="club_name" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Club Name
                  </Label>
                  <Input
                    id="club_name"
                    value={formData.club_name}
                    onChange={(e) => handleChange('club_name', e.target.value)}
                    placeholder="e.g. Chelsea Academy"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gpa" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    GPA
                  </Label>
                  <Input
                    id="gpa"
                    type="number"
                    step="0.01"
                    min="0"
                    max="4"
                    value={formData.gpa}
                    onChange={(e) => handleChange('gpa', e.target.value)}
                    placeholder="e.g. 3.50"
                  />
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                Location
              </h3>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Country</Label>
                <Select value={formData.country} onValueChange={(v) => handleChange('country', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map((country) => (
                      <SelectItem key={country} value={country}>
                        {country}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="state" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    State/Region
                  </Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => handleChange('state', e.target.value)}
                    placeholder="e.g. California"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    City
                  </Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => handleChange('city', e.target.value)}
                    placeholder="e.g. Los Angeles"
                  />
                </div>
              </div>
            </div>

            {/* Parent/Guardian Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                Parent/Guardian Information
              </h3>
              <div className="space-y-2">
                <Label htmlFor="parent_name" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Parent/Guardian Name
                </Label>
                <Input
                  id="parent_name"
                  value={formData.parent_name}
                  onChange={(e) => handleChange('parent_name', e.target.value)}
                  placeholder="e.g. Michael Smith"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="parent_email" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Parent Email
                  </Label>
                  <Input
                    id="parent_email"
                    type="email"
                    value={formData.parent_email}
                    onChange={(e) => handleChange('parent_email', e.target.value)}
                    placeholder="parent@example.com"
                    className={parentEmailError ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  />
                  {parentEmailError && (
                    <p className="text-xs text-red-600">{parentEmailError}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parent_phone" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Parent Phone
                  </Label>
                  <Input
                    id="parent_phone"
                    value={formData.parent_phone}
                    onChange={(e) => handleChange('parent_phone', e.target.value)}
                    placeholder="+44 7700 900456"
                  />
                </div>
              </div>
            </div>

            {/* Additional Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                Additional Information
              </h3>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Source</Label>
                <Select value={formData.source} onValueChange={(v) => handleChange('source', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="How did they find us?" />
                  </SelectTrigger>
                  <SelectContent>
                    {sources.map((source) => (
                      <SelectItem key={source.value} value={source.value}>
                        {source.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Assigned To</Label>
                <OwnerSelect
                  value={selectedOwnerId}
                  onChange={setSelectedOwnerId}
                  placeholder="Select owner (optional)"
                  allowClear
                />
              </div>

              {availableTags.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tags</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {availableTags.map((tag) => (
                      <Badge
                        key={tag.id}
                        variant={selectedTags.includes(tag.id) ? 'default' : 'outline'}
                        className="cursor-pointer transition-colors"
                        style={{
                          backgroundColor: selectedTags.includes(tag.id) && tag.color ? tag.color : undefined,
                          borderColor: tag.color || undefined,
                        }}
                        onClick={() => toggleTag(tag.id)}
                      >
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Notes
                </Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  placeholder="Any additional notes about this contact..."
                  rows={3}
                />
              </div>
            </div>

            {/* Options */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                Options
              </h3>
              
              {lists.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Add to List</Label>
                  <Select 
                    value={selectedListId || undefined} 
                    onValueChange={(value) => setSelectedListId(value === '__none__' ? '' : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a list (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— None —</SelectItem>
                      {lists.map((list) => (
                        <SelectItem key={list.id} value={list.id}>
                          {list.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Checkbox
                  id="createDeal"
                  checked={createDeal}
                  onCheckedChange={(checked) => setCreateDeal(checked === true)}
                />
                <Label htmlFor="createDeal" className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  Create a deal for this contact
                </Label>
              </div>

              {createDeal && pipelines.length > 0 && (
                <div className="space-y-2 pl-7">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Pipeline</Label>
                  <Select value={selectedPipelineId} onValueChange={setSelectedPipelineId}>
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
                </div>
              )}
            </div>
          </div>
        </div>

        <SheetFooter className="border-t px-6 py-4 bg-slate-50 dark:bg-slate-800 shrink-0">
          <div className="flex gap-3 w-full">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isValid || isLoading || (createDeal && !selectedPipelineId)}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Contact'
              )}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
