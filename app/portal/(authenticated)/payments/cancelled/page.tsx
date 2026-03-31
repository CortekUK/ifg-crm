'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { XCircle } from 'lucide-react'

export default function PaymentCancelledPage() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="bg-white dark:bg-slate-900 max-w-sm w-full mx-4">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="h-8 w-8 text-slate-400" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Payment Cancelled</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Your payment was not completed. You can try again from your invoices.
          </p>
          <Link href="/portal/invoices">
            <Button className="w-full bg-blue-600 hover:bg-blue-700">
              Back to Invoices
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
