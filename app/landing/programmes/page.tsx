import type { Metadata } from 'next'
import Image from 'next/image'
import { programmes } from '@/lib/landing/programmes'
import { ProgrammeCard } from '@/components/landing/ProgrammeCard'
import { CTASection } from '@/components/landing/CTASection'

export const metadata: Metadata = {
  title: 'IFG Programmes | Football Development & Education',
  description: 'Explore all IFG programmes: university degree, gap year, and short-term residency. Find your perfect pathway.',
}

export default function ProgrammesPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative pt-32 pb-16 md:pt-40 md:pb-24 overflow-hidden bg-[#0A0A0A]">
        <div className="absolute inset-0">
          <Image
            src="/landing/photos/team-photo.jpeg"
            alt="IFG team photo"
            fill
            priority
            className="object-cover object-center"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-[#0A0A0A]/80" />
        </div>
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-[2px] bg-red-500" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
              Our Programmes
            </span>
          </div>
          <h1 className="font-oswald text-4xl sm:text-5xl md:text-6xl font-bold uppercase tracking-tight text-white leading-[0.95]">
            Choose Your Pathway
          </h1>
          <p className="mt-6 text-lg text-white/60 max-w-2xl leading-relaxed">
            Whether you want a full university degree, a gap year experience, or an intensive short-term residency — find the programme that matches your ambitions.
          </p>
        </div>
      </section>

      {/* All Programmes */}
      <section className="py-20 md:py-28 bg-white dark:bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {programmes.map((p) => (
              <ProgrammeCard key={p.slug} programme={p} />
            ))}
          </div>
        </div>
      </section>

      <CTASection
        title="Not Sure Which Programme Is Right?"
        description="Get in touch and our team will help you find the perfect fit based on your age, experience, and goals."
        primaryText="Contact Us"
        primaryHref="/landing#enquire"
      />
    </>
  )
}
