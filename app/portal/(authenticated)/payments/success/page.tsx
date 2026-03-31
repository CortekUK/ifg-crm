'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2 } from 'lucide-react'

export default function PaymentSuccessPage() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="bg-white dark:bg-slate-900 max-w-sm w-full mx-4">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Payment Successful</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Your payment has been processed. You will receive a confirmation shortly.
          </p>
          <Link href="/portal/invoices">
            <Button className="w-full bg-blue-600 hover:bg-blue-700">
              View Invoices
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
