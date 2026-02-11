'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

interface ContactFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  statusFilter: string
  onStatusFilterChange: (value: string) => void
  programmeFilter?: string
  onProgrammeFilterChange?: (value: string) => void
  countryFilter?: string
  onCountryFilterChange?: (value: string) => void
  recruiterFilter?: string
  onRecruiterFilterChange?: (value: string) => void
  tagFilter?: string
  onTagFilterChange?: (value: string) => void
  onClearFilters: () => void
}

export function ContactFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  programmeFilter = '',
  onProgrammeFilterChange,
  countryFilter = '',
  onCountryFilterChange,
  recruiterFilter = '',
  onRecruiterFilterChange,
  tagFilter = '',
  onTagFilterChange,
  onClearFilters,
}: ContactFiltersProps) {
  const supabase = createClient()

  // Fetch pipelines (programmes)
  const { data: pipelines = [] } = useQuery({
    queryKey: ['pipelines-filter'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipelines')
        .select('id, name')
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return data || []
    },
  })

  // Fetch distinct countries from contacts
  const { data: countries = [] } = useQuery({
    queryKey: ['contacts-countries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('country')
        .not('country', 'is', null)
        .not('country', 'eq', '')
      if (error) throw error
      // Get unique countries
      const uniqueCountries = [...new Set(data?.map(c => c.country).filter(Boolean))]
      return uniqueCountries.sort() as string[]
    },
  })

  // Fetch tags
  const { data: tags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .order('name', { ascending: true })
      if (error) throw error
      return data || []
    },
  })

  // Fetch recruiters (portal_users/profiles)
  const { data: recruiters = [] } = useQuery({
    queryKey: ['recruiters-filter'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name')
      if (error) throw error
      return data || []
    },
  })

  const hasFilters = search || statusFilter || programmeFilter || countryFilter || recruiterFilter || tagFilter

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      {/* Search Input */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Filter Dropdowns */}
      <div className="flex flex-wrap gap-2">
        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="subscribed">Subscribed</SelectItem>
            <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
          </SelectContent>
        </Select>

        {/* Programme Filter */}
        <Select 
          value={programmeFilter} 
          onValueChange={onProgrammeFilterChange || (() => {})}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Programmes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Programmes</SelectItem>
            {pipelines.map((pipeline) => (
              <SelectItem key={pipeline.id} value={pipeline.id}>
                {pipeline.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Country Filter */}
        <Select 
          value={countryFilter} 
          onValueChange={onCountryFilterChange || (() => {})}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Countries" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Countries</SelectItem>
            {countries.map((country) => (
              <SelectItem key={country} value={country}>
                {country}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Recruiter Filter */}
        <Select 
          value={recruiterFilter} 
          onValueChange={onRecruiterFilterChange || (() => {})}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Recruiters" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Recruiters</SelectItem>
            {recruiters.map((recruiter) => (
              <SelectItem key={recruiter.id} value={recruiter.id}>
                {recruiter.full_name || recruiter.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Tag Filter */}
        <Select
          value={tagFilter}
          onValueChange={onTagFilterChange || (() => {})}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Tags" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tags</SelectItem>
            {tags.map((tag) => (
              <SelectItem key={tag.id} value={tag.id}>
                {tag.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear Filters */}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="text-muted-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Clear filters
          </Button>
        )}
      </div>
    </div>
  )
}
