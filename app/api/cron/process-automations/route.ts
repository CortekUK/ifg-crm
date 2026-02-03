import { NextRequest, NextResponse } from 'next/server'

// This API route is an alternative to pg_cron for invoking the automation processor
// Configure in vercel.json to run every 5 minutes:
// {
//   "crons": [
//     {
//       "path": "/api/cron/process-automations",
//       "schedule": "*/5 * * * *"
//     }
//   ]
// }

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Verify the request is from Vercel Cron or has valid authorization
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // Check for Vercel Cron authentication
    // Vercel automatically authenticates cron requests in production
    const isVercelCron = request.headers.get('x-vercel-cron') === '1'

    // Check for manual invocation with secret
    const hasValidSecret = cronSecret && authHeader === `Bearer ${cronSecret}`

    // In development, allow requests without auth for testing
    const isDevelopment = process.env.NODE_ENV === 'development'

    if (!isVercelCron && !hasValidSecret && !isDevelopment) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get Supabase credentials
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase credentials')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Call the process-automations Edge Function
    const response = await fetch(`${supabaseUrl}/functions/v1/process-automations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({}),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Edge Function error:', errorText)
      return NextResponse.json(
        { error: 'Edge Function failed', details: errorText },
        { status: response.status }
      )
    }

    const result = await response.json()

    console.log('Automation processing completed:', result)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result,
    })

  } catch (error) {
    console.error('Cron job error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Also support POST for direct Edge Function invocation
export async function POST(request: NextRequest) {
  return GET(request)
}
