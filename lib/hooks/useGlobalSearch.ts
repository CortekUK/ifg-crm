import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface SearchResult {
  id: string
  type: 'contact' | 'deal' | 'template' | 'automation'
  title: string
  subtitle: string
  href: string
}

export function useGlobalSearch(query: string) {
  const supabase = createClient()

  return useQuery<SearchResult[]>({
    queryKey: ['global-search', query],
    queryFn: async () => {
      if (!query || query.length < 2) return []

      const results: SearchResult[] = []
      const searchTerm = `%${query}%`

      // Search contacts
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email')
        .or(`first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},email.ilike.${searchTerm}`)
        .limit(5)

      if (contacts) {
        contacts.forEach((contact) => {
          results.push({
            id: contact.id,
            type: 'contact',
            title: `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unnamed Contact',
            subtitle: contact.email || 'No email',
            href: `/contacts?id=${contact.id}`,
          })
        })
      }

      // Search deals
      const { data: deals } = await supabase
        .from('deals')
        .select('id, title, value, contact:contacts(first_name, last_name)')
        .ilike('title', searchTerm)
        .limit(5)

      if (deals) {
        deals.forEach((deal) => {
          const contactArr = deal.contact as unknown as { first_name: string | null; last_name: string | null }[] | null
          const contact = contactArr?.[0] || null
          results.push({
            id: deal.id,
            type: 'deal',
            title: deal.title,
            subtitle: contact 
              ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim() 
              : 'No contact',
            href: `/pipelines?deal=${deal.id}`,
          })
        })
      }

      // Search templates
      const { data: templates } = await supabase
        .from('email_templates')
        .select('id, name, subject')
        .or(`name.ilike.${searchTerm},subject.ilike.${searchTerm}`)
        .limit(3)

      if (templates) {
        templates.forEach((template) => {
          results.push({
            id: template.id,
            type: 'template',
            title: template.name,
            subtitle: template.subject || 'No subject',
            href: `/templates/editor?id=${template.id}`,
          })
        })
      }

      // Search automations
      const { data: automations } = await supabase
        .from('automations')
        .select('id, name, description')
        .or(`name.ilike.${searchTerm},description.ilike.${searchTerm}`)
        .limit(3)

      if (automations) {
        automations.forEach((automation) => {
          results.push({
            id: automation.id,
            type: 'automation',
            title: automation.name,
            subtitle: automation.description || 'No description',
            href: `/automations?id=${automation.id}`,
          })
        })
      }

      return results
    },
    enabled: query.length >= 2,
    staleTime: 1000 * 30, // 30 seconds
  })
}
