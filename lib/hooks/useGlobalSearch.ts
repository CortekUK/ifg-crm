import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchRankedContactIds, orderByIds } from '@/lib/contacts/search'

export interface SearchResult {
  id: string
  type: 'contact' | 'deal' | 'template' | 'automation'
  title: string
  subtitle: string
  href: string
}

/**
 * The navbar search.
 *
 * Contacts are matched by `search_contacts_ranked`, the same database
 * function the Contacts page uses. This hook used to hand the whole typed
 * string to each column separately — `first_name ILIKE '%Tylie Aldridge%'`
 * — so searching anyone's full name, the most natural thing to type,
 * returned nothing while an exact email worked. 164 and 168 fixed that
 * everywhere else; this was the copy they missed.
 *
 * Templates and automations are only searched for admins, since a recruiter
 * cannot open either route and the result would lead to /unauthorized.
 */
export function useGlobalSearch(query: string, isAdmin = false) {
  const supabase = createClient()

  return useQuery<SearchResult[]>({
    queryKey: ['global-search', query || '__recent__', isAdmin],
    queryFn: async () => {
      const results: SearchResult[] = []

      if (!query || query.length < 2) {
        // Show recent contacts when no search query
        const { data: contacts } = await supabase
          .from('contacts')
          .select('id, first_name, last_name, email')
          .order('created_at', { ascending: false })
          .limit(8)

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

        return results
      }

      const searchTerm = `%${query}%`

      // Contacts — ranked, word-aware, and RLS-scoped by the function itself.
      const { ids } = await fetchRankedContactIds(supabase, {
        search: query,
        contactIds: null,
        limit: 5,
        offset: 0,
      })

      if (ids.length > 0) {
        const { data: contacts } = await supabase
          .from('contacts')
          .select('id, first_name, last_name, email')
          .in('id', ids)

        // .in() returns rows in the planner's order, which would throw the
        // relevance ranking away.
        orderByIds(contacts ?? [], ids).forEach((contact) => {
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
      if (!isAdmin) return results

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
    enabled: true,
    staleTime: 1000 * 30, // 30 seconds
  })
}
