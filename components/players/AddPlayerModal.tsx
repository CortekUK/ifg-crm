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

interface AddPlayerModalProps {
  isOpen: boolean
  onClose: () => void
}

interface Tag {
  id: string
  name: string
  color: string | null
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

const positions = [
  'Goalkeeper',
  'Centre-back',
  'Right-back',
  'Left-back',
  'Defensive Midfielder',
  'Central Midfielder',
  'Attacking Midfielder',
  'Right Winger',
  'Left Winger',
  'Striker',
]

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
  'Other',
]

const sources = [
  { value: 'website_form', label: 'Website Form' },
  { value: 'referral', label: 'Referral' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tournament', label: 'Tournament' },
  { value: 'manual', label: 'Manual Entry' },
]

const initialFormData = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  date_of_birth: '',
  graduation_year: '',
  gender: '',
  sport: 'football',
  position: '',
  club_name: '',
  gpa: '',
  country: '',
  state: '',
  city: '',
  parent_name: '',
  parent_email: '',
  parent_phone: '',
  source: '',
  notes: '',
}

export function AddPlayerModal({ isOpen, onClose }: AddPlayerModalProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [formData, setFormData] = useState(initialFormData)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedListId, setSelectedListId] = useState<string>('')
  const [createDeal, setCreateDeal] = useState(false)
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('')

  // Fetch tags
  const { data: availableTags = [] } = useQuery<Tag[]>({
    queryKey: ['tags'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tags').select('*').order('name')
      if (error) throw error
      return data || []
    },
  })

  // Fetch lists
  const { data: lists = [] } = useQuery<List[]>({
    queryKey: ['lists'],
    queryFn: async () => {
      const { data, error } = await supabase.from('lists').select('id, name').order('name')
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
      setCreateDeal(false)
      setSelectedPipelineId('')
    }
  }, [isOpen])

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    )
  }

  // Create player mutation
  const createPlayerMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Create the contact (player)
      const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          phone: formData.phone || null,
          date_of_birth: formData.date_of_birth || null,
          graduation_year: formData.graduation_year ? parseInt(formData.graduation_year) : null,
          gender: formData.gender || null,
          sport: formData.sport as 'football' | 'basketball',
          position: formData.position || null,
          club_name: formData.club_name || null,
          gpa: formData.gpa ? parseFloat(formData.gpa) : null,
          country: formData.country || null,
          state: formData.state || null,
          city: formData.city || null,
          parent_name: formData.parent_name || null,
          parent_email: formData.parent_email || null,
          parent_phone: formData.parent_phone || null,
          source: formData.source || 'manual',
          notes: formData.notes || null,
        })
        .select()
        .single()

      if (contactError) throw contactError

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
        await supabase.from('list_contacts').insert({
          list_id: selectedListId,
          contact_id: contact.id,
        })
      }

      // Create deal if requested
      if (createDeal && selectedPipelineId) {
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

          await supabase.from('deal_activities').insert({
            deal_id: deal.id,
            activity_type: 'deal_created',
            description: 'Deal created from player form',
            performed_by_id: user.id,
          })
        }
      }

      return contact
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] })
      queryClient.invalidateQueries({ queryKey: ['player-stats'] })
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      queryClient.invalidateQueries({ queryKey: ['deals'] })

      toast({
        title: 'Player added',
        description: `${formData.first_name} ${formData.last_name} has been added${createDeal ? ' with a new deal' : ''}.`,
      })

      onClose()
    },
    onError: (error) => {
      toast({
        title: 'Failed to add player',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    },
  })

  const handleSubmit = () => {
    if (!formData.first_name || !formData.last_name || !formData.email) return
    createPlayerMutation.mutate()
  }

  const isValid = formData.first_name && formData.last_name && formData.email
  const isLoading = createPlayerMutation.isPending

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl flex flex-col p-0 gap-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <SheetTitle className="font-oswald text-xl font-bold uppercase text-gray-900">
            Add Player
          </SheetTitle>
          <SheetDescription>
            Add a new player to your database. Players are contacts with additional profile information.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6">
          <div className="space-y-6 py-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-blue-900 uppercase border-b border-slate-200 pb-2">
                Basic Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">
                    First Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={formData.first_name}
                    onChange={(e) => handleChange('first_name', e.target.value)}
                    placeholder="John"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">
                    Last Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={formData.last_name}
                    onChange={(e) => handleChange('last_name', e.target.value)}
                    placeholder="Smith"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">
                  Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="john.smith@example.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Phone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    placeholder="+44 7700 900123"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Date of Birth</Label>
                  <Input
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => handleChange('date_of_birth', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Player Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-blue-900 uppercase border-b border-slate-200 pb-2">
                Player Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Graduation Year</Label>
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
                  <Label className="text-sm font-medium text-slate-700">Gender</Label>
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Sport</Label>
                  <Select value={formData.sport} onValueChange={(v) => handleChange('sport', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select sport" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="football">Football</SelectItem>
                      <SelectItem value="basketball">Basketball</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Position</Label>
                  <Select value={formData.position} onValueChange={(v) => handleChange('position', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select position" />
                    </SelectTrigger>
                    <SelectContent>
                      {positions.map((pos) => (
                        <SelectItem key={pos} value={pos}>
                          {pos}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Club Name</Label>
                  <Input
                    value={formData.club_name}
                    onChange={(e) => handleChange('club_name', e.target.value)}
                    placeholder="e.g. Chelsea Academy"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">GPA</Label>
                  <Input
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
              <h3 className="text-sm font-semibold text-blue-900 uppercase border-b border-slate-200 pb-2">
                Location
              </h3>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Country</Label>
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
                  <Label className="text-sm font-medium text-slate-700">State/Region</Label>
                  <Input
                    value={formData.state}
                    onChange={(e) => handleChange('state', e.target.value)}
                    placeholder="e.g. California"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">City</Label>
                  <Input
                    value={formData.city}
                    onChange={(e) => handleChange('city', e.target.value)}
                    placeholder="e.g. Los Angeles"
                  />
                </div>
              </div>
            </div>

            {/* Parent/Guardian Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-blue-900 uppercase border-b border-slate-200 pb-2">
                Parent/Guardian Information
              </h3>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Parent/Guardian Name</Label>
                <Input
                  value={formData.parent_name}
                  onChange={(e) => handleChange('parent_name', e.target.value)}
                  placeholder="e.g. Michael Smith"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Parent Email</Label>
                  <Input
                    type="email"
                    value={formData.parent_email}
                    onChange={(e) => handleChange('parent_email', e.target.value)}
                    placeholder="parent@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Parent Phone</Label>
                  <Input
                    value={formData.parent_phone}
                    onChange={(e) => handleChange('parent_phone', e.target.value)}
                    placeholder="+44 7700 900456"
                  />
                </div>
              </div>
            </div>

            {/* Additional Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-blue-900 uppercase border-b border-slate-200 pb-2">
                Additional Information
              </h3>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Source</Label>
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

              {availableTags.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Tags</Label>
                  <div className="flex flex-wrap gap-2 p-3 border rounded-md min-h-[60px]">
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
                <Label className="text-sm font-medium text-slate-700">Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  placeholder="Any additional notes about this player..."
                  rows={3}
                />
              </div>
            </div>

            {/* Options */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-blue-900 uppercase border-b border-slate-200 pb-2">
                Options
              </h3>

              {lists.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Add to List</Label>
                  <Select
                    value={selectedListId || undefined}
                    onValueChange={(value) => setSelectedListId(value === '__none__' ? '' : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a list (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No list</SelectItem>
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
                <Label htmlFor="createDeal" className="text-sm font-medium text-slate-700 cursor-pointer">
                  Create a deal for this player
                </Label>
              </div>

              {createDeal && pipelines.length > 0 && (
                <div className="space-y-2 pl-7">
                  <Label className="text-sm font-medium text-slate-700">Pipeline</Label>
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

        <SheetFooter className="border-t px-6 py-4 bg-slate-50 shrink-0">
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
                'Add Player'
              )}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
