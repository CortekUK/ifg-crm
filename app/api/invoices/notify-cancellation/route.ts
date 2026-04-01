import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function POST(request: NextRequest) {
  try {
    const { email, name, invoice_number, amount } = await request.json()

    const resendApiKey = process.env.RESEND_API_KEY
    if (!resendApiKey || !email) {
      return NextResponse.json({ error: 'Missing config' }, { status: 400 })
    }

    const resend = new Resend(resendApiKey)
    const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev'

    await resend.emails.send({
      from: `IFG <${fromEmail}>`,
      to: [email],
      subject: `Invoice ${invoice_number} - Cancelled`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #dc2626; color: white; padding: 24px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">Invoice Cancelled</h1>
          </div>
          <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
            <p>Hi ${name || 'there'},</p>
            <p>Invoice <strong>${invoice_number}</strong> for <strong>${amount}</strong> has been cancelled.</p>
            <p>If you have already made a payment for this invoice, please contact us and we will arrange a refund.</p>
            <p style="color: #dc2626; font-weight: bold;">Please do not use any previous payment links for this invoice.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="color: #94a3b8; font-size: 12px; text-align: center;">The International Football Group</p>
          </div>
        </div>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Cancellation email error:', error)
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 })
  }
}
