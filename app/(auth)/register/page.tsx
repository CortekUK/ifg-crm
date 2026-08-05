import { redirect } from 'next/navigation'

/**
 * Public self-registration is disabled — the CRM is invite-only. Staff are
 * created via the Users invite flow (professional-domain email required) and
 * players/guardians via the portal invite flow. Anyone hitting /register is
 * sent to the login page. (Signups are also disabled at the Supabase project
 * level and blocked in the handle_new_user trigger.)
 */
export default function RegisterPage() {
  redirect('/login')
}
