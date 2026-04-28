import type { Contact } from './contacts'
import type { Deal, Pipeline } from './pipelines'
import type { Profile } from './pipelines'

export type InvoiceType = 'deposit' | 'installment' | 'full_payment' | 'meal_plan' | 'trip' | 'other'
export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled'
export type PaymentMethod = 'stripe' | 'bank_transfer' | 'website' | 'manual' | 'cash' | 'other'
export type InvoiceRecipientType = 'player' | 'guardian'

export interface Invoice {
  id: string
  contact_id: string
  deal_id: string | null
  invoice_number: string
  type: InvoiceType
  description: string
  amount: number
  currency: string
  status: InvoiceStatus
  due_date: string
  sent_at: string | null
  paid_at: string | null
  stripe_invoice_id: string | null
  stripe_payment_intent_id: string | null
  xero_invoice_id: string | null
  payment_method: PaymentMethod | null
  recipient_type: InvoiceRecipientType
  notes: string | null
  created_by_id: string
  created_at: string
  updated_at: string
  // Joined data
  contact?: Contact
  deal?: Deal & { pipeline?: Pipeline }
  created_by?: Profile
}

export interface Payment {
  id: string
  invoice_id: string
  contact_id: string
  amount: number
  payment_date: string
  payment_method: PaymentMethod
  stripe_payment_id: string | null
  reference: string | null
  notes: string | null
  recorded_by_id: string
  created_at: string
}

export interface InvoiceFilters {
  search?: string
  status?: InvoiceStatus | 'all'
  type?: InvoiceType | 'all'
  pipelineId?: string
  dateFrom?: string
  dateTo?: string
}

export interface CreateInvoiceInput {
  contact_id: string
  deal_id?: string | null
  type: InvoiceType
  description: string
  amount: number
  currency?: string
  due_date: string
  notes?: string
  recipient_type?: InvoiceRecipientType
  created_by_id: string
}
