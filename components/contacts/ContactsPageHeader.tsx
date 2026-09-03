'use client'

import { Button } from '@/components/ui/button'
import { UserPlus, Upload, Download, Loader2 } from 'lucide-react'

interface ContactsPageHeaderProps {
  onAddContact: () => void
  onImportClick: () => void
  onExportClick: () => void
  isExporting?: boolean
  isAdmin?: boolean
}

// Grid/list toggle removed — contacts is a long, dense list of player
// records and the card grid was rarely useful. The page is list-only
// now (mobile gets the same list, just narrower columns).
export function ContactsPageHeader({
  onAddContact,
  onImportClick,
  onExportClick,
  isExporting,
  isAdmin = false,
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
          {isAdmin && (
            <Button
              variant="outline"
              onClick={onImportClick}
              className="border-white/30 text-white hover:bg-white/10 hover:text-white bg-transparent"
            >
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
          )}

          {/* Export takes the whole contact book out of the CRM, so it is
              admin-only. Adding one contact is ordinary recruiter work. */}
          {isAdmin && (
            <Button
              variant="outline"
              onClick={onExportClick}
              disabled={isExporting}
              className="border-white/30 text-white hover:bg-white/10 hover:text-white bg-transparent"
            >
              {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              {isExporting ? 'Exporting...' : 'Export'}
            </Button>
          )}

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
