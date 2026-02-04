'use client'

import { useState, useEffect } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { useUpdatePlayer } from '@/lib/hooks/usePlayers'
import { toast } from '@/lib/hooks/use-toast'
import { OwnerSelect } from '@/components/ui/owner-select'
import type { Player } from '@/lib/types/players'

interface EditPlayerModalProps {
  player: Player | null
  isOpen: boolean
  onClose: () => void
}

const currentYear = new Date().getFullYear()
const graduationYears = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2, currentYear + 3, currentYear + 4]

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
  'Nigeria',
  'Ghana',
  'Other',
]

export function EditPlayerModal({ player, isOpen, onClose }: EditPlayerModalProps) {
  const [formData, setFormData] = useState({
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
    notes: '',
  })
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null)

  const updatePlayer = useUpdatePlayer()

  // Populate form when player changes
  useEffect(() => {
    if (player && isOpen) {
      setFormData({
        first_name: player.first_name || '',
        last_name: player.last_name || '',
        email: player.email || '',
        phone: player.phone || '',
        date_of_birth: player.date_of_birth || '',
        graduation_year: player.graduation_year?.toString() || '',
        gender: player.gender || '',
        sport: player.sport || 'football',
        position: player.position || '',
        club_name: player.club_name || '',
        gpa: player.gpa?.toString() || '',
        country: player.country || '',
        state: player.state || '',
        city: player.city || '',
        parent_name: player.parent_name || '',
        parent_email: player.parent_email || '',
        parent_phone: player.parent_phone || '',
        notes: player.notes || '',
      })
      setSelectedOwnerId(player.owner_id || null)
    }
  }, [player, isOpen])

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    if (!player || !formData.first_name || !formData.last_name || !formData.email) return

    try {
      await updatePlayer.mutateAsync({
        playerId: player.id,
        updates: {
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          phone: formData.phone || null,
          date_of_birth: formData.date_of_birth || null,
          graduation_year: formData.graduation_year ? parseInt(formData.graduation_year) : null,
          gender: (formData.gender as 'male' | 'female') || null,
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
          notes: formData.notes || null,
          owner_id: selectedOwnerId,
        },
      })

      toast({
        title: 'Player updated',
        description: `${formData.first_name} ${formData.last_name}'s profile has been updated.`,
      })

      onClose()
    } catch (error) {
      toast({
        title: 'Failed to update player',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    }
  }

  const isValid = formData.first_name && formData.last_name && formData.email
  const isLoading = updatePlayer.isPending

  if (!player) return null

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl flex flex-col p-0 gap-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <SheetTitle className="font-oswald text-xl font-bold uppercase text-gray-900 dark:text-white">
            Edit Player
          </SheetTitle>
          <SheetDescription>
            Update {player.first_name} {player.last_name}'s profile information.
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
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    First Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={formData.first_name}
                    onChange={(e) => handleChange('first_name', e.target.value)}
                    placeholder="John"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
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
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
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
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Phone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    placeholder="+44 7700 900123"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Date of Birth</Label>
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Sport</Label>
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
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Position</Label>
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
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Club Name</Label>
                  <Input
                    value={formData.club_name}
                    onChange={(e) => handleChange('club_name', e.target.value)}
                    placeholder="e.g. Chelsea Academy"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">GPA</Label>
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
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">State/Region</Label>
                  <Input
                    value={formData.state}
                    onChange={(e) => handleChange('state', e.target.value)}
                    placeholder="e.g. California"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">City</Label>
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
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                Parent/Guardian Information
              </h3>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Parent/Guardian Name</Label>
                <Input
                  value={formData.parent_name}
                  onChange={(e) => handleChange('parent_name', e.target.value)}
                  placeholder="e.g. Michael Smith"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Parent Email</Label>
                  <Input
                    type="email"
                    value={formData.parent_email}
                    onChange={(e) => handleChange('parent_email', e.target.value)}
                    placeholder="parent@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Parent Phone</Label>
                  <Input
                    value={formData.parent_phone}
                    onChange={(e) => handleChange('parent_phone', e.target.value)}
                    placeholder="+44 7700 900456"
                  />
                </div>
              </div>
            </div>

            {/* Assigned To */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                Assigned To
              </h3>
              <OwnerSelect
                value={selectedOwnerId}
                onChange={setSelectedOwnerId}
                placeholder="Select owner (optional)"
                allowClear
              />
            </div>

            {/* Notes */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">
                Notes
              </h3>
              <Textarea
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="Any additional notes about this player..."
                rows={4}
              />
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
              disabled={!isValid || isLoading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
