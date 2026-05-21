import { Route, FileText, PhoneCall, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SmoothScrollLink } from './SmoothScrollLink'
import { FadeIn } from './FadeIn'
import { ArrowRight } from 'lucide-react'

const steps = [
  {
    number: '01',
    icon: Route,
    title: 'Find Your Programme Fit',
    description:
      'Explore our programmes and identify the right pathway for your age, experience, and ambitions.',
  },
  {
    number: '02',
    icon: FileText,
    title: 'Submit Your Application',
    description:
      'Complete a short enquiry form with your football background. No commitment required at this stage.',
  },
  {
    number: '03',
    icon: PhoneCall,
    title: 'Speak With the IFG Team',
    description:
      'A personal conversation with you and your family to discuss the programme, answer questions, and plan next steps.',
  },
  {
    number: '04',
    icon: CheckCircle,
    title: 'Prepare & Arrive',
    description:
      'We guide you through visa support, accommodation, and travel logistics. You arrive ready to train.',
  },
]

export function ApplicationJourney() {
  return (
    <section className="py-20 md:py-28 bg-[#FAFAFA]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <FadeIn className="text-center mb-16">
          <div className="flex items-center gap-3 justify-center mb-4">
            <div className="w-10 h-[2px] bg-red-600" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
              Admissions
            </span>
          </div>
          <h2 className="font-oswald text-3xl md:text-5xl font-bold uppercase tracking-tight text-gray-900 leading-[1.1]">
            Your Admissions Journey
          </h2>
          <p className="mt-4 text-base text-gray-600 max-w-xl mx-auto leading-relaxed">
            A guided process — we support you and your family at every step.
          </p>
        </FadeIn>

        {/* Desktop: horizontal 4-step row */}
        <div className="hidden md:block">
          <div className="relative">
            {/* Connecting line */}
            <div className="absolute top-8 left-[calc(12.5%+32px)] right-[calc(12.5%+32px)] h-px bg-gradient-to-r from-red-600/30 via-gray-300 to-red-600/30" />

            <div className="grid grid-cols-4 gap-4">
              {steps.map((step, i) => (
                <FadeIn key={step.number} delay={i * 120} threshold={0.1}>
                  <div className="text-center">
                    <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white border border-gray-200 shadow-sm mb-5">
                      <step.icon className="h-6 w-6 text-gray-900" />
                      <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center">
                        {step.number}
                      </span>
                    </div>
                    <h3 className="font-oswald text-[15px] font-bold uppercase tracking-tight text-gray-900 mb-2">
                      {step.title}
                    </h3>
                    <p className="text-[13px] text-gray-500 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile: vertical timeline */}
        <div className="md:hidden">
          <div className="relative pl-10">
            {/* Vertical connecting line */}
            <div className="absolute left-[15px] top-0 bottom-0 w-px bg-gradient-to-b from-red-600/30 via-gray-300 to-red-600/30" />

            <div className="space-y-8">
              {steps.map((step, i) => (
                <FadeIn key={step.number} delay={i * 100} from="left">
                  <div className="relative flex items-start gap-5">
                    <div className="absolute -left-10 top-0 w-8 h-8 rounded-full bg-red-600 flex items-center justify-center z-10 shadow-sm">
                      <span className="text-[11px] font-bold text-white font-oswald">
                        {step.number}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-oswald text-[15px] font-bold uppercase tracking-tight text-gray-900 mb-1">
                        {step.title}
                      </h3>
                      <p className="text-sm text-gray-500 leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </div>

        {/* CTA */}
        <FadeIn delay={300} className="text-center mt-14">
          <SmoothScrollLink href="#enquire">
            <Button
              size="lg"
              className="bg-red-600 hover:bg-red-700 text-white text-base px-8 h-13 font-semibold tracking-wide"
            >
              Start Your Application
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </SmoothScrollLink>
        </FadeIn>
      </div>
    </section>
  )
}
