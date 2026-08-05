'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error, data: authData } = await supabase.auth.signInWithPassword(data)

  if (error) {
    return { error: error.message }
  }

  // Check role to determine redirect destination, and self-heal
  // password_set_at if missing (signInWithPassword succeeded → real password
  // exists, regardless of whether set-password ran our stamp endpoint).
  let destination = '/dashboard'
  if (authData.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, password_set_at')
      .eq('id', authData.user.id)
      .single()

    if (profile?.role === 'player') {
      destination = '/portal'
    }

    if (profile && !profile.password_set_at) {
      await supabase
        .from('profiles')
        .update({ password_set_at: new Date().toISOString() })
        .eq('id', authData.user.id)
    }
  }

  revalidatePath('/', 'layout')
  redirect(destination)
}

// Public self-registration is DISABLED — the CRM is invite-only. This is kept
// as a hard stop (defense in depth) in case the /register page is ever restored:
// staff are created via the Users invite flow (professional-domain email
// required) and players via the portal invite flow, both using the service-role
// admin API. Signups are also turned off at the Supabase project level and the
// handle_new_user trigger rejects staff roles from non-professional domains.
export async function signup(_formData: FormData) {
  return {
    error: 'Public sign-up is disabled. Please ask an administrator to invite you.',
  }
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
