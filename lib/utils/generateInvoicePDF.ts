import type { Invoice } from '@/lib/types/invoices'

interface InvoiceWithRelations extends Omit<Invoice, 'contact' | 'deal'> {
  contact?: {
    first_name: string | null
    last_name: string | null
    email: string | null
    phone: string | null
  } | null
  deal?: {
    title: string
  } | null
}

export function generateInvoicePDF(invoice: InvoiceWithRelations) {
  const contactName = invoice.contact
    ? `${invoice.contact.first_name || ''} ${invoice.contact.last_name || ''}`.trim()
    : 'Unknown'

  const statusColors: Record<string, string> = {
    draft: '#6b7280',
    sent: '#2563eb',
    paid: '#16a34a',
    overdue: '#dc2626',
    cancelled: '#9ca3af',
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Invoice ${invoice.invoice_number}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #1f2937;
          line-height: 1.5;
          padding: 40px;
          max-width: 800px;
          margin: 0 auto;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 40px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e5e7eb;
        }
        .logo {
          font-size: 24px;
          font-weight: bold;
          color: #1e40af;
        }
        .logo-sub {
          font-size: 10px;
          color: #6b7280;
          letter-spacing: 1px;
        }
        .invoice-title {
          text-align: right;
        }
        .invoice-title h1 {
          font-size: 32px;
          font-weight: bold;
          color: #1f2937;
          margin-bottom: 8px;
        }
        .invoice-number {
          font-size: 14px;
          color: #6b7280;
        }
        .status-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 9999px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          color: white;
          background-color: ${statusColors[invoice.status] || '#6b7280'};
          margin-top: 8px;
        }
        .info-section {
          display: flex;
          justify-content: space-between;
          margin-bottom: 40px;
        }
        .info-block {
          flex: 1;
        }
        .info-block h3 {
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .info-block p {
          font-size: 14px;
          margin-bottom: 4px;
        }
        .info-block .name {
          font-weight: 600;
          font-size: 16px;
        }
        .dates-section {
          display: flex;
          gap: 40px;
          margin-bottom: 40px;
          padding: 20px;
          background-color: #f9fafb;
          border-radius: 8px;
        }
        .date-item {
          flex: 1;
        }
        .date-item label {
          font-size: 12px;
          color: #6b7280;
          display: block;
          margin-bottom: 4px;
        }
        .date-item span {
          font-size: 14px;
          font-weight: 500;
        }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
        }
        .items-table th {
          text-align: left;
          padding: 12px;
          background-color: #f3f4f6;
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          border-bottom: 2px solid #e5e7eb;
        }
        .items-table th:last-child {
          text-align: right;
        }
        .items-table td {
          padding: 16px 12px;
          border-bottom: 1px solid #e5e7eb;
          font-size: 14px;
        }
        .items-table td:last-child {
          text-align: right;
          font-weight: 500;
        }
        .totals {
          margin-left: auto;
          width: 300px;
        }
        .totals-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          font-size: 14px;
        }
        .totals-row.total {
          border-top: 2px solid #1f2937;
          margin-top: 8px;
          padding-top: 16px;
          font-size: 18px;
          font-weight: bold;
        }
        .notes {
          margin-top: 40px;
          padding: 20px;
          background-color: #f9fafb;
          border-radius: 8px;
        }
        .notes h3 {
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 8px;
        }
        .notes p {
          font-size: 13px;
          color: #6b7280;
        }
        .footer {
          margin-top: 60px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          font-size: 12px;
          color: #9ca3af;
        }
        @media print {
          body {
            padding: 20px;
          }
          .status-badge {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="logo">INTERNATIONAL FOOTBALL GROUP</div>
          <div class="logo-sub">SPORTS RECRUITMENT</div>
        </div>
        <div class="invoice-title">
          <h1>INVOICE</h1>
          <div class="invoice-number">${invoice.invoice_number}</div>
          <div class="status-badge">${invoice.status}</div>
        </div>
      </div>

      <div class="info-section">
        <div class="info-block">
          <h3>Bill To</h3>
          <p class="name">${contactName}</p>
          ${invoice.contact?.email ? `<p>${invoice.contact.email}</p>` : ''}
          ${invoice.contact?.phone ? `<p>${invoice.contact.phone}</p>` : ''}
        </div>
        <div class="info-block">
          <h3>From</h3>
          <p class="name">International Football Group</p>
          <p>United Kingdom</p>
        </div>
      </div>

      <div class="dates-section">
        <div class="date-item">
          <label>Issue Date</label>
          <span>${new Date(invoice.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </div>
        <div class="date-item">
          <label>Due Date</label>
          <span>${new Date(invoice.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </div>
        <div class="date-item">
          <label>Invoice Type</label>
          <span>${invoice.type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}</span>
        </div>
      </div>

      <table class="items-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>${invoice.type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}</strong>
              ${invoice.deal ? `<br><span style="color: #6b7280; font-size: 13px;">Deal: ${invoice.deal.title}</span>` : ''}
              ${invoice.description ? `<br><span style="color: #6b7280; font-size: 13px;">${invoice.description}</span>` : ''}
            </td>
            <td>£${invoice.amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
          </tr>
        </tbody>
      </table>

      <div class="totals">
        <div class="totals-row">
          <span>Subtotal</span>
          <span>£${invoice.amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
        </div>
        <div class="totals-row">
          <span>Tax (0%)</span>
          <span>£0.00</span>
        </div>
        <div class="totals-row total">
          <span>Total</span>
          <span>£${invoice.amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      ${invoice.notes ? `
      <div class="notes">
        <h3>Notes</h3>
        <p>${invoice.notes}</p>
      </div>
      ` : ''}

      <div class="footer">
        <p>Thank you for your business</p>
        <p>International Football Group • United Kingdom</p>
      </div>
    </body>
    </html>
  `

  // Open in new window for printing/saving as PDF
  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    // Auto-trigger print dialog after a short delay
    setTimeout(() => {
      printWindow.print()
    }, 250)
  }
}
