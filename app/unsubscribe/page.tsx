import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe'

/**
 * Public unsubscribe confirmation page.
 *
 * Deliberately a confirmation step rather than an instant opt-out: mail
 * clients and corporate link scanners fetch every URL in an email, so a page
 * that unsubscribed on load would quietly opt out people who never clicked.
 * The form posts to /api/public/unsubscribe, which is where the write happens.
 *
 * No CRM chrome and no auth — the reader has no account. Plain inline styles
 * so it renders identically whatever the dashboard theme is doing, and stays
 * readable if the stylesheet never arrives.
 */

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Unsubscribe · IFG',
  robots: { index: false, follow: false },
}

type Search = { c?: string; t?: string; state?: string }

const shell: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#f7f7f8',
  padding: 24,
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Arial, sans-serif',
}

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: '36px 32px',
  maxWidth: 460,
  width: '100%',
  textAlign: 'center',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
}

const heading: React.CSSProperties = {
  margin: '0 0 12px',
  fontSize: 22,
  fontWeight: 700,
  color: '#0f172a',
  letterSpacing: '-0.01em',
}

const body: React.CSSProperties = {
  margin: '0 0 24px',
  fontSize: 15,
  lineHeight: 1.6,
  color: '#4b5563',
}

const button: React.CSSProperties = {
  display: 'inline-block',
  background: '#0f172a',
  color: '#fff',
  border: 0,
  borderRadius: 6,
  padding: '13px 30px',
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main style={shell}>
      <div style={card}>
        <h1 style={heading}>{title}</h1>
        {children}
      </div>
    </main>
  )
}

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<Search>
}) {
  const { c: contactId, t: token, state } = await searchParams

  if (state === 'done') {
    return (
      <Card title="You've been unsubscribed">
        <p style={body}>
          You won&apos;t receive any more marketing emails from The International Football Group.
          <br />
          If you&apos;re mid-application, someone from the team may still contact you directly about it.
        </p>
      </Card>
    )
  }

  if (state === 'error') {
    return (
      <Card title="Something went wrong">
        <p style={body}>
          We couldn&apos;t record your request. Please email{' '}
          <a href="mailto:admin@theinternationalfootballgroup.com" style={{ color: '#0f172a' }}>
            admin@theinternationalfootballgroup.com
          </a>{' '}
          and we&apos;ll take you off the list manually.
        </p>
      </Card>
    )
  }

  const valid = contactId && token && (await verifyUnsubscribeToken(contactId, token))

  if (!valid) {
    return (
      <Card title="This link isn't valid">
        <p style={body}>
          The unsubscribe link has expired or was copied incompletely. Please email{' '}
          <a href="mailto:admin@theinternationalfootballgroup.com" style={{ color: '#0f172a' }}>
            admin@theinternationalfootballgroup.com
          </a>{' '}
          and we&apos;ll take you off the list.
        </p>
      </Card>
    )
  }

  return (
    <Card title="Unsubscribe from IFG emails">
      <p style={body}>
        Confirm below and we&apos;ll stop sending you marketing and follow-up emails.
      </p>
      <form method="POST" action="/api/public/unsubscribe">
        <input type="hidden" name="c" value={contactId} />
        <input type="hidden" name="t" value={token} />
        <input type="hidden" name="redirect" value="1" />
        <button type="submit" style={button}>
          Unsubscribe me
        </button>
      </form>
    </Card>
  )
}
