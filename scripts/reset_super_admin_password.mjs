import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync('/Users/ghulam/projects/ifg-crm-2/.env.local', 'utf8')
  .split('\n')
  .filter((l) => l.trim() && !l.startsWith('#'))
  .reduce((acc, line) => {
    const idx = line.indexOf('=')
    if (idx > 0) {
      const key = line.slice(0, idx).trim()
      const val = line.slice(idx + 1).trim().replace(/^"(.*)"$/, '$1')
      acc[key] = val
    }
    return acc
  }, {})

const url = env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const email = 'neemacortek@gmail.com'
const newPassword = 'demo1234!'

console.log(`Target Supabase: ${url}`)

// 1. Look up the user by email in profiles
const { data: profile, error: profileErr } = await supabase
  .from('profiles')
  .select('id, email, full_name, role')
  .eq('email', email)
  .single()

if (profileErr || !profile) {
  console.error('User not found:', profileErr?.message)
  process.exit(1)
}

console.log(`Found user: ${profile.email} | role=${profile.role} | id=${profile.id}`)

// 2. Reset password (and ensure email is confirmed so they can log in immediately)
const { data: updated, error: updateErr } = await supabase.auth.admin.updateUserById(
  profile.id,
  {
    password: newPassword,
    email_confirm: true,
  }
)

if (updateErr) {
  console.error('Failed to reset password:', updateErr.message)
  process.exit(1)
}

// 3. Confirm role is super_admin (defensive — should already be)
if (profile.role !== 'super_admin') {
  console.log(`Role was '${profile.role}', updating to 'super_admin'...`)
  const { error: roleErr } = await supabase
    .from('profiles')
    .update({ role: 'super_admin' })
    .eq('id', profile.id)
  if (roleErr) {
    console.error('Failed to update role:', roleErr.message)
    process.exit(1)
  }
}

console.log('\n=== SUCCESS ===')
console.log(`Email:    ${email}`)
console.log(`Password: ${newPassword}`)
console.log(`Role:     super_admin`)
console.log(`User ID:  ${profile.id}`)
console.log(`Login at: ${env.NEXT_PUBLIC_APP_URL || 'https://ifg-crm.vercel.app'}/login`)
