import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// WordPress form submission structure (adjust based on your form plugin)
interface WordPressFormSubmission {
  // Common fields from various WordPress form plugins
  form_id?: string
  form_name?: string
  form_title?: string
  
  // Contact fields (various naming conventions)
  first_name?: string
  firstName?: string
  name?: string
  
  last_name?: string
  lastName?: string
  surname?: string
  
  email?: string
  email_address?: string
  
  phone?: string
  phone_number?: string
  telephone?: string
  mobile?: string
  
  // Player-specific fields
  graduation_year?: string | number
  grad_year?: string | number
  year_of_graduation?: string | number
  
  position?: string
  sport?: string
  
  club?: string
  club_name?: string
  current_club?: string
  
  school?: string
  high_school?: string
  
  // Additional fields
  message?: string
  notes?: string
  comments?: string
  
  // Source tracking
  source?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  page_url?: string
  referrer?: string
  
  // Custom fields (catch-all)
  [key: string]: string | number | boolean | undefined
}

// Verify webhook signature
function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature || !secret) {
    return false
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(`sha256=${expectedSignature}`)
    )
  } catch {
    return false
  }
}

// Normalize form field names to standard format
function normalizeFormData(data: WordPressFormSubmission): {
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  graduation_year: number | null
  position: string | null
  sport: string | null
  club: string | null
  school: string | null
  notes: string | null
  source: string | null
} {
  // Extract first name
  let firstName = data.first_name || data.firstName || null
  let lastName = data.last_name || data.lastName || data.surname || null
  
  // If only full name provided, split it
  if (!firstName && !lastName && data.name) {
    const nameParts = data.name.trim().split(/\s+/)
    firstName = nameParts[0] || null
    lastName = nameParts.slice(1).join(' ') || null
  }

  // Extract email
  const email = data.email || data.email_address || null

  // Extract phone
  const phone = data.phone || data.phone_number || data.telephone || data.mobile || null

  // Extract graduation year
  let gradYear: number | null = null
  const rawGradYear = data.graduation_year || data.grad_year || data.year_of_graduation
  if (rawGradYear) {
    const parsed = parseInt(String(rawGradYear), 10)
    if (!isNaN(parsed) && parsed >= 2000 && parsed <= 2050) {
      gradYear = parsed
    }
  }

  // Extract other fields
  const position = data.position || null
  const sport = data.sport || null
  const club = data.club || data.club_name || data.current_club || null
  const school = data.school || data.high_school || null
  const notes = data.message || data.notes || data.comments || null

  // Build source string
  let source = 'wordpress_form'
  if (data.form_name || data.form_title) {
    source = `wordpress_form:${data.form_name || data.form_title}`
  }
  if (data.utm_source) {
    source += `:${data.utm_source}`
  }

  return {
    first_name: firstName,
    last_name: lastName,
    email: email?.toLowerCase().trim() || null,
    phone,
    graduation_year: gradYear,
    position,
    sport: sport as 'football' | 'basketball' | null,
    club,
    school,
    notes,
    source,
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.text()
    
    // Verify webhook signature if secret is configured
    const webhookSecret = process.env.WORDPRESS_WEBHOOK_SECRET
    if (webhookSecret) {
      const signature = request.headers.get('x-webhook-signature') || 
                        request.headers.get('x-hub-signature-256')
      
      if (!verifyWebhookSignature(payload, signature, webhookSecret)) {
        console.error('Invalid WordPress webhook signature')
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        )
      }
    }

    const formData: WordPressFormSubmission = JSON.parse(payload)

    console.log('Received WordPress form submission:', JSON.stringify(formData, null, 2))

    // Normalize the form data
    const normalized = normalizeFormData(formData)

    // Validate required fields
    if (!normalized.email) {
      console.error('WordPress webhook: No email provided')
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase credentials')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check if contact already exists
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('email', normalized.email)
      .single()

    let contactId: string

    if (existingContact) {
      // Update existing contact with new info (don't overwrite existing data with nulls)
      contactId = existingContact.id
      
      const updates: Record<string, unknown> = {}
      if (normalized.first_name) updates.first_name = normalized.first_name
      if (normalized.last_name) updates.last_name = normalized.last_name
      if (normalized.phone) updates.phone = normalized.phone
      if (normalized.graduation_year) updates.graduation_year = normalized.graduation_year
      if (normalized.position) updates.position = normalized.position
      if (normalized.club) updates.club_name = normalized.club
      
      if (Object.keys(updates).length > 0) {
        await supabase
          .from('contacts')
          .update(updates)
          .eq('id', contactId)
      }

      console.log(`Updated existing contact: ${contactId}`)
    } else {
      // Create new contact
      const { data: newContact, error: createError } = await supabase
        .from('contacts')
        .insert({
          email: normalized.email,
          first_name: normalized.first_name || 'Unknown',
          last_name: normalized.last_name || 'Contact',
          phone: normalized.phone,
          graduation_year: normalized.graduation_year,
          position: normalized.position,
          club_name: normalized.club,
          notes: normalized.notes,
          source: 'website_form',
        })
        .select('id')
        .single()

      if (createError) {
        console.error('Error creating contact:', createError)
        return NextResponse.json(
          { error: 'Failed to create contact' },
          { status: 500 }
        )
      }

      contactId = newContact.id
      console.log(`Created new contact: ${contactId}`)
    }

    // Save form message as a contact note
    if (normalized.notes) {
      try {
        const noteContent = `[Website Form] ${formData.form_name || 'Contact Form'}:\n${normalized.notes}`
        await supabase.from('contact_notes').insert({
          contact_id: contactId,
          content: noteContent,
        })
      } catch (err) {
        console.error('Failed to save form message as note:', err)
      }
    }

    // Store form submission for record keeping
    try {
      await supabase.from('form_submissions').insert({
        contact_id: contactId,
        form_name: formData.form_name || formData.form_title || 'WordPress Form',
        form_data: formData,
        source_url: formData.page_url || null,
        submitted_at: new Date().toISOString(),
      })
    } catch (err) {
      console.error('Failed to log form submission:', err)
    }

    // Check for form-triggered automations
    const { data: automations } = await supabase
      .from('automations')
      .select(`
        id,
        name,
        pipeline_id,
        trigger_stage_id,
        config,
        steps:automation_steps(id, step_order)
      `)
      .eq('is_active', true)
      .eq('trigger_type', 'form_submission')

    if (automations && automations.length > 0) {
      for (const automation of automations) {
        // Check if form matches automation config
        const config = automation.config as { form_ids?: string[] } | null
        if (config?.form_ids && !config.form_ids.includes(formData.form_id || '')) {
          continue // Skip if form doesn't match
        }

        // Create a deal for this contact
        if (automation.pipeline_id && automation.trigger_stage_id) {
          // Check if deal already exists for this contact in this pipeline
          const { data: existingDeal } = await supabase
            .from('deals')
            .select('id')
            .eq('contact_id', contactId)
            .eq('pipeline_id', automation.pipeline_id)
            .single()

          if (!existingDeal) {
            // Create new deal
            const { data: newDeal, error: dealError } = await supabase
              .from('deals')
              .insert({
                contact_id: contactId,
                pipeline_id: automation.pipeline_id,
                current_stage_id: automation.trigger_stage_id,
                title: `${normalized.first_name || 'New'} ${normalized.last_name || 'Lead'}`,
                deal_value: 15000, // Default deal value
                source: normalized.source,
              })
              .select('id')
              .single()

            if (dealError) {
              console.error('Error creating deal:', dealError)
            } else {
              console.log(`Created deal ${newDeal.id} for automation ${automation.name}`)

              // Enroll in automation
              const firstStep = (automation.steps as { id: string; step_order: number }[])
                ?.sort((a, b) => a.step_order - b.step_order)?.[0]

              if (firstStep) {
                await supabase.from('automation_enrollments').insert({
                  automation_id: automation.id,
                  deal_id: newDeal.id,
                  current_step_id: firstStep.id,
                  status: 'active',
                  enrolled_at: new Date().toISOString(),
                  next_step_at: new Date().toISOString(),
                })
              }
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      contact_id: contactId,
      is_new: !existingContact,
    })

  } catch (error) {
    console.error('WordPress webhook error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Handle GET for endpoint verification
export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    endpoint: 'wordpress-webhook',
    description: 'WordPress form submission webhook for IFG CRM',
  })
}
