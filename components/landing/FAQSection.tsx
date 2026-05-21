'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { FadeIn } from './FadeIn'

const lineColors: Record<string, string> = {
  red: 'bg-red-600',
  amber: 'bg-amber-600',
  blue: 'bg-blue-600',
  emerald: 'bg-emerald-600',
}

interface FAQSectionProps {
  faqs: { question: string; answer: string }[]
  title?: string
  subtitle?: string
  accentColor?: string
}

export function FAQSection({
  faqs,
  title = 'Frequently Asked Questions',
  subtitle = "Got questions? We've got answers.",
  accentColor = 'red',
}: FAQSectionProps) {
  const lineColor = lineColors[accentColor] || lineColors.red
  return (
    <section id="faq" className="py-20 md:py-28 bg-gray-50 dark:bg-white/[0.02]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn className="text-center mb-14">
          <div className="flex items-center gap-3 justify-center mb-4">
            <div className={`w-10 h-[2px] ${lineColor}`} />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-white/50">
              FAQ
            </span>
          </div>
          <h2 className="font-oswald text-3xl md:text-5xl font-bold uppercase tracking-tight text-gray-900 dark:text-foreground leading-[1.1]">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-4 text-lg text-gray-600 dark:text-muted-foreground">
              {subtitle}
            </p>
          )}
        </FadeIn>

        <Accordion type="single" collapsible className="w-full space-y-2">
          {faqs.map((faq, i) => (
            <FadeIn key={i} delay={i * 60} threshold={0.05}>
              <AccordionItem
                value={`faq-${i}`}
                className="border border-gray-200 dark:border-white/10 rounded-lg px-5 bg-white dark:bg-white/[0.02] data-[state=open]:border-gray-300 dark:data-[state=open]:border-white/15 transition-colors"
              >
                <AccordionTrigger className="text-left text-[15px] font-semibold text-gray-900 dark:text-foreground hover:no-underline py-5">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-[14px] text-gray-600 dark:text-muted-foreground leading-relaxed pb-5">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            </FadeIn>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
