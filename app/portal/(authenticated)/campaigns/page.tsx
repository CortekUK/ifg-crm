'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Mail, Send, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { formatDate } from '@/lib/utils/format'

interface Campaign {
  id: string
  name: string
  type: string
  status: string
  sent_at: string | null
  created_at: string
}

export default function PortalCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const fetchCampaigns = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('contact_id')
        .eq('id', user.id)
        .single()

      if (!profile?.contact_id) return

      // Get campaign IDs where this contact is a recipient
      const { data: recipients } = await supabase
        .from('campaign_recipients')
        .select('campaign_id')
        .eq('contact_id', profile.contact_id)

      if (!recipients || recipients.length === 0) {
        setLoading(false)
        return
      }

      const campaignIds = [...new Set(recipients.map((r) => r.campaign_id))]

      const { data: campaignData } = await supabase
        .from('campaigns')
        .select('id, name, type, status, sent_at, created_at')
        .in('id', campaignIds)
        .order('created_at', { ascending: false })

      setCampaigns(campaignData || [])
      setLoading(false)
    }

    fetchCampaigns()
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Campaigns</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">Campaigns and communications you've been included in.</p>

      {campaigns.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {campaigns.length === 0 ? (
        <Card className="bg-white dark:bg-slate-900">
          <CardContent className="p-8 text-center">
            <Send className="h-10 w-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-500 dark:text-slate-400">No campaigns yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {campaigns.filter((c) =>
            !search.trim() || c.name.toLowerCase().includes(search.toLowerCase())
          ).map((campaign) => (
            <Card key={campaign.id} className="bg-white dark:bg-slate-900">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg shrink-0">
                  <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{campaign.name}</p>
                  <p className="text-xs text-slate-400">
                    {campaign.sent_at ? formatDate(campaign.sent_at) : formatDate(campaign.created_at)}
                  </p>
                </div>
                <Badge variant="secondary" className="capitalize shrink-0">
                  {campaign.type}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
