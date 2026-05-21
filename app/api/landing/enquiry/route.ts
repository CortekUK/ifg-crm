import { NextResponse } from 'next/server'
import { z } from 'zod'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const enquirySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  playerAge: z.string().optional(),
  country: z.string().min(1, 'Country is required'),
  programme: z.string().min(1, 'Programme interest is required'),
  message: z.string().optional().default(''),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const data = enquirySchema.parse(body)

    await resend.emails.send({
      from: 'IFG Website <onboarding@resend.dev>',
      to: ['info@theinternationalfootballgroup.com'],
      subject: `New Website Enquiry: ${data.name} (${data.country})`,
      html: `
        <h2>New Website Enquiry</h2>
        <table style="border-collapse: collapse; width: 100%; max-width: 600px;">
          <tr>
            <td style="padding: 8px 12px; font-weight: bold; border-bottom: 1px solid #eee;">Name</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${data.name}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-weight: bold; border-bottom: 1px solid #eee;">Email</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee;"><a href="mailto:${data.email}">${data.email}</a></td>
          </tr>
          ${data.phone ? `<tr>
            <td style="padding: 8px 12px; font-weight: bold; border-bottom: 1px solid #eee;">Phone</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${data.phone}</td>
          </tr>` : ''}
          ${data.playerAge ? `<tr>
            <td style="padding: 8px 12px; font-weight: bold; border-bottom: 1px solid #eee;">Player Age</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${data.playerAge}</td>
          </tr>` : ''}
          <tr>
            <td style="padding: 8px 12px; font-weight: bold; border-bottom: 1px solid #eee;">Country</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${data.country}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-weight: bold; border-bottom: 1px solid #eee;">Programme</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${data.programme}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-weight: bold; border-bottom: 1px solid #eee;">Message</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${data.message}</td>
          </tr>
        </table>
        <p style="margin-top: 20px; color: #666; font-size: 12px;">Sent from the IFG Marketing Website</p>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    console.error('Enquiry submission error:', error)
    return NextResponse.json(
      { error: 'Failed to submit enquiry. Please try again.' },
      { status: 500 }
    )
  }
}
