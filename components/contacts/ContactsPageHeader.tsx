'use client'

import { Button } from '@/components/ui/button'
import { LayoutGrid, List, UserPlus, Upload, Download, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ContactsPageHeaderProps {
  viewMode: 'grid' | 'list'
  onViewModeChange: (mode: 'grid' | 'list') => void
  onAddContact: () => void
  onImportClick: () => void
  onExportClick: () => void
  isExporting?: boolean
}

export function ContactsPageHeader({
  viewMode,
  onViewModeChange,
  onAddContact,
  onImportClick,
  onExportClick,
  isExporting,
}: ContactsPageHeaderProps) {
  return (
    <div className="banner-gradient rounded-xl p-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-white/90 text-base">
            Manage your contacts, player profiles, and targeted marketing campaigns.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View Toggle */}
          <div className="flex bg-white/20 rounded-lg p-1">
            <button
              onClick={() => onViewModeChange('grid')}
              className={cn(
                'p-2 rounded-md transition-colors',
                viewMode === 'grid' ? 'bg-white text-blue-600' : 'text-white hover:bg-white/10'
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => onViewModeChange('list')}
              className={cn(
                'p-2 rounded-md transition-colors',
                viewMode === 'list' ? 'bg-white text-blue-600' : 'text-white hover:bg-white/10'
              )}
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          <Button
            variant="outline"
            onClick={onImportClick}
            className="border-white/30 text-white hover:bg-white/10 hover:text-white bg-transparent"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>

          <Button
            variant="outline"
            onClick={onExportClick}
            disabled={isExporting}
            className="border-white/30 text-white hover:bg-white/10 hover:text-white bg-transparent"
          >
            {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            {isExporting ? 'Exporting...' : 'Export'}
          </Button>

          <Button
            onClick={onAddContact}
            className="bg-white text-blue-600 hover:bg-blue-50"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Add Contact
          </Button>
        </div>
      </div>
    </div>
  )
}
