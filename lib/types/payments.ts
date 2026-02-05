export type PaymentMethod = 'stripe' | 'bank_transfer' | 'cash' | 'website' | 'other'
export type PaymentStatus = 'successful' | 'pending' | 'failed'

export interface Payment {
  id: string
  invoice_id: string | null
  contact_id: string
  amount: number
  currency: string
  payment_method: string
  reference: string | null
  status: string
  recorded_by_id: string
  notes: string | null
  created_at: string
  updated_at: string
  invoice?: {
    id: string
    invoice_number: string
    deal?: {
      id: string
      pipeline_id: string
      pipeline?: {
        id: string
        name: string
      }
    } | null
  } | null
  contact?: {
    id: string
    first_name: string
    last_name: string
    email: string
  } | null
  recorded_by?: {
    id: string
    full_name: string | null
  } | null
}

export interface PaymentFilters {
  search: string
  paymentMethod: string
  status: string
  pipelineId?: string
  dateFrom: Date | null
  dateTo: Date | null
}

export interface PaymentStats {
  totalReceived: number
  pending: number
  failedCount: number
  avgTransaction: number
}

export interface CreatePaymentInput {
  invoice_id?: string | null
  contact_id: string
  amount: number
  currency?: string
  payment_method: PaymentMethod
  reference?: string | null
  notes?: string | null
  recorded_by_id: string
  payment_date?: string
}
