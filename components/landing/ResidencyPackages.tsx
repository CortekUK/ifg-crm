import { SmoothScrollLink } from './SmoothScrollLink'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'

const options = [
  {
    id: 'A',
    label: 'Full 6 Weeks',
    dates: 'Jun 20 – Aug 1',
    training: 3995,
    food: 1050,
    accommodation: 1950,
  },
  {
    id: 'B',
    label: 'First 4 Weeks',
    dates: 'Jun 20 – Jul 18',
    training: 2995,
    food: 700,
    accommodation: 1300,
  },
  {
    id: 'C',
    label: 'Last 4 Weeks',
    dates: 'Jul 4 – Aug 1',
    training: 2995,
    food: 700,
    accommodation: 1300,
  },
  {
    id: 'D',
    label: 'First 2 Weeks',
    dates: 'Jun 20 – Jul 4',
    training: 1695,
    food: 350,
    accommodation: 650,
  },
  {
    id: 'E',
    label: 'Middle 2 Weeks',
    dates: 'Jul 4 – Jul 18',
    training: 1695,
    food: 350,
    accommodation: 650,
  },
  {
    id: 'F',
    label: 'Last 2 Weeks',
    dates: 'Jul 18 – Aug 1',
    training: 1695,
    food: 350,
    accommodation: 650,
  },
]

function formatPrice(amount: number) {
  return `£${amount.toLocaleString('en-GB')}`
}

export function ResidencyPackages() {
  return (
    <section className="py-20 md:py-28 bg-gray-50 dark:bg-white/[0.02]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-500">
            Programme Options & Cost
          </span>
          <h2 className="font-oswald text-4xl md:text-5xl font-bold uppercase tracking-tight text-gray-900 dark:text-foreground leading-[0.95] mt-3">
            Choose Your Experience
          </h2>
          <p className="mt-4 text-gray-600 dark:text-muted-foreground max-w-2xl leading-relaxed">
            Multiple experiences available, from 2, 4 and 6 weeks. All packages include 4-star hotel accommodation, three meals per day, and a full Adidas playing and training kit.
          </p>
        </div>

        {/* Desktop pricing table */}
        <div className="hidden lg:block overflow-hidden rounded-2xl border border-gray-200 dark:border-white/5">
          <table className="w-full">
            <thead>
              <tr className="bg-[#0A0A0A]">
                <th className="text-left p-4 text-xs text-white/50 uppercase tracking-wider font-medium" />
                {options.map((opt) => (
                  <th key={opt.id} className="p-4 text-center">
                    <span className="block text-[10px] text-white/40 uppercase tracking-widest font-medium">
                      Option {opt.id}
                    </span>
                    <span className="block font-oswald text-sm font-bold uppercase tracking-tight text-white mt-1">
                      {opt.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-white/[0.03]">
              <tr className="border-t border-gray-100 dark:border-white/5">
                <td className="p-4 text-xs text-gray-500 dark:text-white/40 uppercase tracking-wider font-medium">Dates</td>
                {options.map((opt) => (
                  <td key={opt.id} className="p-4 text-center text-sm font-medium text-gray-900 dark:text-foreground">
                    {opt.dates}
                  </td>
                ))}
              </tr>
              <tr className="border-t border-gray-100 dark:border-white/5">
                <td className="p-4 text-xs text-gray-500 dark:text-white/40 uppercase tracking-wider font-medium">Training</td>
                {options.map((opt) => (
                  <td key={opt.id} className="p-4 text-center text-sm text-gray-700 dark:text-foreground/80">
                    {formatPrice(opt.training)}
                  </td>
                ))}
              </tr>
              <tr className="border-t border-gray-100 dark:border-white/5">
                <td className="p-4 text-xs text-gray-500 dark:text-white/40 uppercase tracking-wider font-medium">Food</td>
                {options.map((opt) => (
                  <td key={opt.id} className="p-4 text-center text-sm text-gray-700 dark:text-foreground/80">
                    {formatPrice(opt.food)}
                  </td>
                ))}
              </tr>
              <tr className="border-t border-gray-100 dark:border-white/5">
                <td className="p-4 text-xs text-gray-500 dark:text-white/40 uppercase tracking-wider font-medium">Accommodation</td>
                {options.map((opt) => (
                  <td key={opt.id} className="p-4 text-center text-sm text-gray-700 dark:text-foreground/80">
                    {formatPrice(opt.accommodation)}
                  </td>
                ))}
              </tr>
              <tr className="border-t-2 border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02]">
                <td className="p-4 text-xs text-gray-900 dark:text-foreground uppercase tracking-wider font-bold">Total</td>
                {options.map((opt) => {
                  const total = opt.training + opt.food + opt.accommodation
                  return (
                    <td key={opt.id} className="p-4 text-center">
                      <span className="font-oswald text-lg font-bold text-gray-900 dark:text-foreground">
                        {formatPrice(total)}
                      </span>
                    </td>
                  )
                })}
              </tr>
              <tr className="border-t border-gray-100 dark:border-white/5">
                <td className="p-4 text-xs text-gray-500 dark:text-white/40 uppercase tracking-wider font-medium">Deposit</td>
                {options.map((opt) => {
                  const total = opt.training + opt.food + opt.accommodation
                  const deposit = Math.ceil(total * 0.5 / 5) * 5
                  return (
                    <td key={opt.id} className="p-4 text-center text-sm font-semibold text-amber-600 dark:text-amber-500">
                      {formatPrice(deposit)}
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Mobile pricing cards */}
        <div className="lg:hidden space-y-4">
          {options.map((opt) => {
            const total = opt.training + opt.food + opt.accommodation
            const deposit = Math.ceil(total * 0.5 / 5) * 5
            return (
              <div
                key={opt.id}
                className="rounded-xl border border-gray-200 dark:border-white/5 bg-white dark:bg-white/[0.03] overflow-hidden"
              >
                <div className="bg-[#0A0A0A] px-5 py-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-white/40 uppercase tracking-widest font-medium">
                      Option {opt.id}
                    </span>
                    <span className="block font-oswald text-base font-bold uppercase tracking-tight text-white">
                      {opt.label}
                    </span>
                  </div>
                  <span className="text-sm text-white/60">{opt.dates}</span>
                </div>
                <div className="p-5">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-white/40">Training</span>
                      <span className="text-gray-900 dark:text-foreground">{formatPrice(opt.training)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-white/40">Food</span>
                      <span className="text-gray-900 dark:text-foreground">{formatPrice(opt.food)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-white/40">Accommodation</span>
                      <span className="text-gray-900 dark:text-foreground">{formatPrice(opt.accommodation)}</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/5 flex justify-between items-center">
                    <span className="text-xs text-gray-500 dark:text-white/40 uppercase tracking-wider font-medium">Total</span>
                    <span className="font-oswald text-xl font-bold text-gray-900 dark:text-foreground">
                      {formatPrice(total)}
                    </span>
                  </div>
                  <div className="mt-1 flex justify-between items-center">
                    <span className="text-xs text-gray-500 dark:text-white/40 uppercase tracking-wider font-medium">Deposit</span>
                    <span className="text-sm font-semibold text-amber-600 dark:text-amber-500">
                      {formatPrice(deposit)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* CTA */}
        <div className="mt-10 text-center">
          <SmoothScrollLink href="#enquire">
            <Button
              size="lg"
              className="bg-amber-600 hover:bg-amber-700 text-white text-base px-8 h-13 font-semibold tracking-wide"
            >
              Pay Deposit Now
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </SmoothScrollLink>
          <p className="mt-3 text-xs text-gray-400 dark:text-white/30">
            Secure your place with a deposit. Remaining balance due before arrival.
          </p>
        </div>
      </div>
    </section>
  )
}
