import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SmoothScrollLink } from './SmoothScrollLink'
import { ArrowRight } from 'lucide-react'

const decisionCues = [
  {
    question: 'Football and a UK degree?',
    programme: 'University Programme',
    href: '/landing/programmes/university',
  },
  {
    question: 'A gap year with professional training?',
    programme: 'Gap Year',
    href: '/landing/programmes/gap-year',
  },
  {
    question: 'Short-term intensive development?',
    programme: 'Residency',
    href: '/landing/programmes/residency',
  },
]

export function PathwayCTA() {
  return (
    <section className="relative py-16 md:py-20 overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0">
        <Image
          src="/landing/photos/stadium.jpeg"
          alt=""
          fill
          className="object-cover object-center"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[#0A0A0A]/85" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="font-oswald text-2xl md:text-4xl font-bold uppercase tracking-tight text-white leading-[1.1]">
          Not Sure Which Pathway Fits You?
        </h2>
        <p className="mt-4 text-base text-white/50 max-w-xl mx-auto leading-relaxed">
          Speak with the IFG team and we&apos;ll help guide you toward the right
          programme based on your age, education stage, and football goals.
        </p>

        {/* Decision cue cards */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
          {decisionCues.map((cue) => (
            <Link key={cue.href} href={cue.href} className="group">
              <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 hover:border-red-600/40 hover:bg-white/[0.08] transition-all duration-300 h-full flex flex-col items-center justify-center text-center">
                <p className="text-sm text-white/70 leading-snug mb-2">
                  {cue.question}
                </p>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-red-500 group-hover:gap-2.5 transition-all">
                  {cue.programme}
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <SmoothScrollLink href="#enquire">
            <Button
              size="lg"
              className="bg-red-600 hover:bg-red-700 text-white text-base px-8 h-13 font-semibold tracking-wide"
            >
              Start Your Application
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </SmoothScrollLink>
          <Link href="/landing/programmes">
            <Button
              size="lg"
              variant="outline"
              className="border-white/25 text-white hover:bg-white/10 hover:text-white text-base px-8 h-13 bg-white/5 font-medium"
            >
              Explore Programmes
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
