import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// Load env from .env.local
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

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const email = 'neemacortek@gmail.com'
const password = 'demo1234!'
const fullName = 'Neema Cortek'

console.log(`Target Supabase: ${url}`)
console.log(`Creating user: ${email} (super_admin)\n`)

// 1. Check if email already exists in profiles or auth
const { data: existingProfile } = await supabase
  .from('profiles')
  .select('id, email, role')
  .eq('email', email)
  .maybeSingle()

if (existingProfile) {
  console.log('User already exists in profiles:', existingProfile)
  console.log('Aborting to avoid duplicate. Delete the existing user first if you want to recreate.')
  process.exit(1)
}

// 2. Create auth user with password and metadata
// The handle_new_user trigger reads role from raw_user_meta_data and creates the profile.
const { data: created, error: createErr } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: {
    full_name: fullName,
    role: 'super_admin',
    sport: 'football',
  },
})

if (createErr) {
  console.error('Error creating auth user:', createErr.message)
  process.exit(1)
}

const userId = created.user.id
console.log(`Auth user created: ${userId}`)

// 3. Verify profile was created with correct role
const { data: profile, error: profileErr } = await supabase
  .from('profiles')
  .select('id, email, full_name, role')
  .eq('id', userId)
  .single()

if (profileErr || !profile) {
  console.error('Profile not found after auth creation. Inserting manually...')
  const { error: insertErr } = await supabase.from('profiles').insert({
    id: userId,
    email,
    full_name: fullName,
    role: 'super_admin',
    sport: 'football',
  })
  if (insertErr) {
    console.error('Failed to insert profile:', insertErr.message)
    process.exit(1)
  }
  console.log('Profile inserted manually with role=super_admin')
} else {
  console.log('Profile created by trigger:', profile)
  // Defensive: if trigger didn't pick up the role for any reason, fix it.
  if (profile.role !== 'super_admin') {
    console.log(`Profile role is '${profile.role}', updating to 'super_admin'...`)
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ role: 'super_admin' })
      .eq('id', userId)
    if (updateErr) {
      console.error('Failed to update profile role:', updateErr.message)
      process.exit(1)
    }
    console.log('Profile role updated to super_admin.')
  }
}

console.log('\n=== SUCCESS ===')
console.log(`Email:    ${email}`)
console.log(`Password: ${password}`)
console.log(`Role:     super_admin`)
console.log(`User ID:  ${userId}`)
console.log(`Login at: ${env.NEXT_PUBLIC_APP_URL || 'https://ifg-crm.vercel.app'}/login`)
