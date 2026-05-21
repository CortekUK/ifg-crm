'use client'

import { Route, FileText, PhoneCall, CheckCircle } from 'lucide-react'
import { FadeIn } from './FadeIn'

const steps = [
  {
    number: '01',
    icon: Route,
    title: 'Choose Your Pathway',
    description:
      'Explore our programmes and find the right fit for your age, ambitions, and timeline — whether that\'s a 3-year degree or a 5-day experience.',
  },
  {
    number: '02',
    icon: FileText,
    title: 'Apply or Enquire',
    description:
      'Submit a short enquiry form or full application. Send us your football CV and any video footage — we\'ll take it from there.',
  },
  {
    number: '03',
    icon: PhoneCall,
    title: 'Speak with the Team',
    description:
      'Our admissions team will arrange a call with you and your family to discuss the programme, answer questions, and talk through next steps.',
  },
  {
    number: '04',
    icon: CheckCircle,
    title: 'Confirm Your Place',
    description:
      'Once accepted, we handle visa guidance, accommodation setup, and travel logistics. You just need to turn up ready to train.',
  },
]

export function JourneySection() {
  return (
    <section className="py-20 md:py-28 bg-gray-50 dark:bg-white/[0.02]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn className="text-center mb-16">
          <div className="flex items-center gap-3 justify-center mb-4">
            <div className="w-10 h-[2px] bg-red-600" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-white/50">
              How It Works
            </span>
          </div>
          <h2 className="font-oswald text-3xl md:text-5xl font-bold uppercase tracking-tight text-gray-900 dark:text-foreground leading-[1.1]">
            The IFG Journey
          </h2>
          <p className="mt-4 text-base text-gray-600 dark:text-muted-foreground max-w-xl mx-auto leading-relaxed">
            From first enquiry to first training session — here&apos;s how the process works.
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-4">
          {steps.map((step, i) => (
            <FadeIn key={step.number} delay={i * 120} threshold={0.1}>
              <div className="relative">
                {/* Connecting line between steps (desktop only) */}
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-[calc(50%+32px)] right-0 h-px bg-gray-300 dark:bg-white/10 -mr-2" />
                )}
                <div className="text-center">
                  <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 shadow-sm mb-5">
                    <step.icon className="h-6 w-6 text-gray-900 dark:text-white" />
                    <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#0A0A0A] text-white text-[11px] font-bold flex items-center justify-center">
                      {step.number}
                    </span>
                  </div>
                  <h3 className="font-oswald text-base font-semibold uppercase tracking-tight text-gray-900 dark:text-foreground mb-2">
                    {step.title}
                  </h3>
                  <p className="text-[13px] text-gray-500 dark:text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}
