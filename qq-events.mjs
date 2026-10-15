import fs from 'node:fs'
import { AwsClient } from 'aws4fetch'
import { createClient } from '@supabase/supabase-js'
for (const l of fs.readFileSync('.env','utf8').split('\n')) { const m=l.match(/^([A-Z_0-9]+)=(.*)$/); if(m) process.env[m[1]]=m[2].trim() }
const region = process.env.SES_REGION
const aws = new AwsClient({ accessKeyId:process.env.SES_ACCESS_KEY_ID, secretAccessKey:process.env.SES_SECRET_ACCESS_KEY, service:'ses', region })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} })

// The SES mailbox simulator. These produce real events and do NOT affect
// the account's reputation. recipient_contact_id is deliberately null so no
// real contact can be unsubscribed by this test.
const cases = [
  { to: 'success@simulator.amazonses.com',   expect: 'delivered' },
  { to: 'bounce@simulator.amazonses.com',    expect: 'bounced'   },
  { to: 'complaint@simulator.amazonses.com', expect: 'complained'},
]
const made = []
for (const c of cases) {
  const res = await aws.fetch(`https://email.${region}.amazonaws.com/v2/email/outbound-emails`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      FromEmailAddress: 'IFG CRM <crmtest@macclesfieldfc.com>',
      Destination: { ToAddresses: [c.to] },
      ConfigurationSetName: 'ifg-crm',
      Content: { Simple: {
        Subject: { Data: `ZZ event check ${c.expect}`, Charset:'UTF-8' },
        Body: { Html: { Data:'<p>Event pipeline check.</p>', Charset:'UTF-8' } },
      }},
    }),
  })
  const j = await res.json()
  if (!j.MessageId) { console.log(c.to, 'SEND FAILED', JSON.stringify(j).slice(0,200)); continue }
  const { data: row } = await db.from('email_sends').insert({
    recipient_email: c.to, subject: `ZZ event check ${c.expect}`,
    status: 'sent', sent_at: new Date().toISOString(),
    resend_message_id: j.MessageId, from_email: 'crmtest@macclesfieldfc.com',
  }).select('id').single()
  made.push({ ...c, id: row.id, messageId: j.MessageId })
  console.log(`sent -> ${c.to.padEnd(38)} expecting "${c.expect}"`)
}
fs.writeFileSync('/tmp/ifg-event-ids.json', JSON.stringify(made))
console.log('\nSNS normally delivers within seconds. Checking shortly.')
