'use client'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search } from 'lucide-react'
import type { PlayerFilters as PlayerFiltersType } from '@/lib/types/players'

interface PlayerFiltersProps {
  filters: PlayerFiltersType
  onFiltersChange: (filters: PlayerFiltersType) => void
  positions: string[]
  countries: string[]
}

const currentYear = new Date().getFullYear()
const graduationYears = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2]

export function PlayerFilters({
  filters,
  onFiltersChange,
  positions,
  countries,
}: PlayerFiltersProps) {
  return (
    <div className="flex flex-col lg:flex-row gap-4 flex-wrap">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search players..."
          value={filters.search || ''}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          className="pl-9"
        />
      </div>

      {/* Graduation Year */}
      <Select
        value={filters.graduationYear?.toString() || 'all'}
        onValueChange={(v) =>
          onFiltersChange({
            ...filters,
            graduationYear: v === 'all' ? 'all' : parseInt(v),
          })
        }
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="All Years" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Years</SelectItem>
          {graduationYears.map((year) => (
            <SelectItem key={year} value={year.toString()}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Gender */}
      <Select
        value={filters.gender || 'all'}
        onValueChange={(v) =>
          onFiltersChange({ ...filters, gender: v as PlayerFiltersType['gender'] })
        }
      >
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="All" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="male">Male</SelectItem>
          <SelectItem value="female">Female</SelectItem>
        </SelectContent>
      </Select>

      {/* Country */}
      <Select
        value={filters.country || 'all'}
        onValueChange={(v) => onFiltersChange({ ...filters, country: v })}
      >
        <SelectTrigger className="w-[160px]">
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

      {/* Position */}
      <Select
        value={filters.position || 'all'}
        onValueChange={(v) => onFiltersChange({ ...filters, position: v })}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="All Positions" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Positions</SelectItem>
          {positions.map((position) => (
            <SelectItem key={position} value={position}>
              {position}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Status */}
      <Select
        value={filters.status || 'all'}
        onValueChange={(v) =>
          onFiltersChange({ ...filters, status: v as PlayerFiltersType['status'] })
        }
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
