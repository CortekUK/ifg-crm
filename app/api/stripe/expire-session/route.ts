import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  try {
    const { session_id } = await request.json()

    if (!session_id) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    // Expire the Stripe checkout session so the payment link no longer works
    await stripe.checkout.sessions.expire(session_id)

    return NextResponse.json({ success: true })
  } catch (error) {
    // Session might already be expired or completed — that's fine
    console.error('Expire session error:', error)
    return NextResponse.json({ success: true })
  }
}
