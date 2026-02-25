// Shared ClickSend SMS API helper

export interface SendSMSParams {
  to: string        // E.164 format phone number
  body: string      // SMS message content
  from?: string     // Sender number (optional)
  source?: string   // Tracking source identifier
}

export interface SendSMSResult {
  success: boolean
  message_id?: string
  error?: string
  segments?: number
}

export async function sendSMS(params: SendSMSParams): Promise<SendSMSResult> {
  const username = Deno.env.get('CLICKSEND_API_USERNAME')
  const apiKey = Deno.env.get('CLICKSEND_API_KEY')

  if (!username || !apiKey) {
    return { success: false, error: 'ClickSend credentials not configured' }
  }

  const auth = btoa(`${username}:${apiKey}`)

  try {
    const response = await fetch('https://rest.clicksend.com/v3/sms/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: JSON.stringify({
        messages: [{
          to: params.to,
          body: params.body,
          from: params.from,
          source: params.source || 'ifg-crm',
        }],
      }),
    })

    const data = await response.json()
    // ClickSend returns { data: { messages: [{ message_id, status, message_parts, ... }] } }
    const msg = data?.data?.messages?.[0]

    if (msg?.status === 'SUCCESS') {
      return {
        success: true,
        message_id: msg.message_id,
        segments: msg.message_parts,
      }
    }

    return { success: false, error: msg?.status || 'Unknown ClickSend error' }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'ClickSend request failed' }
  }
}
