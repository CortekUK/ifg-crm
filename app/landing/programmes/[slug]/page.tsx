import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getProgrammeBySlug, getAllProgrammeSlugs } from '@/lib/landing/programmes'
import { ProgrammeHero } from '@/components/landing/ProgrammeHero'
import type { HeroVariant } from '@/components/landing/ProgrammeHero'
import { ProgrammeQuickFacts } from '@/components/landing/ProgrammeQuickFacts'
import { ProgrammeWhoFor } from '@/components/landing/ProgrammeWhoFor'
import { ProgrammeWhatIncluded } from '@/components/landing/ProgrammeWhatIncluded'
import { ProgrammeSchedule } from '@/components/landing/ProgrammeSchedule'
import { ProgrammeOutcomes } from '@/components/landing/ProgrammeOutcomes'
import { ProgrammeProof } from '@/components/landing/ProgrammeProof'
import { CTASection } from '@/components/landing/CTASection'
import { FAQSection } from '@/components/landing/FAQSection'
import { EnquiryFormSection } from '@/components/landing/EnquiryFormSection'
import { UniversityPartnership } from '@/components/landing/UniversityPartnership'
import { GapYearOptions } from '@/components/landing/GapYearOptions'
import { ResidencyPackages } from '@/components/landing/ResidencyPackages'
import { ResidencyHero } from '@/components/landing/ResidencyHero'
import { ResidencyIncludes } from '@/components/landing/ResidencyIncludes'
import { ResidencySchedule } from '@/components/landing/ResidencySchedule'
import { ResidencyFacilities } from '@/components/landing/ResidencyFacilities'
import { PhotoBreak } from '@/components/landing/PhotoBreak'

interface Props {
  params: Promise<{ slug: string }>
}

const heroVariants: Record<string, HeroVariant> = {
  university: 'split',
  'gap-year': 'fullbleed',
  residency: 'centered',
}

export async function generateStaticParams() {
  return getAllProgrammeSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const programme = getProgrammeBySlug(slug)
  if (!programme) return {}
  return {
    title: programme.metaTitle,
    description: programme.metaDescription,
  }
}

export default async function ProgrammePage({ params }: Props) {
  const { slug } = await params
  const programme = getProgrammeBySlug(slug)

  if (!programme) {
    notFound()
  }

  const { category } = programme
  const variant = heroVariants[slug] || 'fullbleed'

  if (slug === 'university') {
    return (
      <>
        <ProgrammeHero programme={programme} variant={variant} />
        <ProgrammeQuickFacts facts={programme.quickFacts} category={category} />
        <UniversityPartnership />
        <ProgrammeWhoFor whoFor={programme.whoFor} category={category} slug={slug} />
        <ProgrammeWhatIncluded included={programme.included} category={category} />
        {programme.schedule && <ProgrammeSchedule schedule={programme.schedule} category={category} />}
        <ProgrammeOutcomes outcomes={programme.outcomes} category={category} />
        <ProgrammeProof programmeName={programme.name} category={category} />
        <CTASection
          title={`Ready to Combine Football & Education?`}
          description={programme.ctaDescription}
          primaryText={programme.ctaText}
          accentColor="blue"
        />
        <FAQSection
          faqs={programme.faqs}
          title={`${programme.name} FAQ`}
          subtitle="Common questions about this programme."
          accentColor="blue"
        />
        <EnquiryFormSection preselectedProgramme={programme.slug} />
      </>
    )
  }

  if (slug === 'gap-year') {
    return (
      <>
        <ProgrammeHero programme={programme} variant={variant} />
        <ProgrammeQuickFacts facts={programme.quickFacts} category={category} />
        <GapYearOptions />
        <ProgrammeWhatIncluded included={programme.included} category={category} />
        <ProgrammeWhoFor whoFor={programme.whoFor} category={category} slug={slug} />
        <ProgrammeOutcomes outcomes={programme.outcomes} category={category} />
        <ProgrammeProof programmeName={programme.name} category={category} />
        <CTASection
          title="Ready to Take the Next Step?"
          description={programme.ctaDescription}
          primaryText={programme.ctaText}
          accentColor="emerald"
        />
        <FAQSection
          faqs={programme.faqs}
          title={`${programme.name} FAQ`}
          subtitle="Common questions about this programme."
          accentColor="emerald"
        />
        <EnquiryFormSection preselectedProgramme={programme.slug} />
      </>
    )
  }

  if (slug === 'residency') {
    return (
      <>
        <ResidencyHero />
        <ResidencyPackages />
        <ResidencySchedule />
        <ResidencyFacilities />
        <PhotoBreak
          src="/landing/photos/training-1.webp"
          alt="Training at Macclesfield FC"
          stat={{ value: '600+', label: 'Competitive Matches Played' }}
        />
        <ResidencyIncludes />
        <ProgrammeWhoFor whoFor={programme.whoFor} category={category} slug={slug} />
        <ProgrammeOutcomes outcomes={programme.outcomes} category={category} />
        <ProgrammeProof programmeName={programme.name} category={category} />
        <CTASection
          title="Ready to Elevate Your Game?"
          description={programme.ctaDescription}
          primaryText={programme.ctaText}
          accentColor="amber"
        />
        <FAQSection
          faqs={programme.faqs}
          title={`${programme.name} FAQ`}
          subtitle="Common questions about this programme."
          accentColor="amber"
        />
        <EnquiryFormSection preselectedProgramme={programme.slug} />
      </>
    )
  }

  // Fallback for any future programmes
  return (
    <>
      <ProgrammeHero programme={programme} variant={variant} />
      <ProgrammeQuickFacts facts={programme.quickFacts} category={category} />
      <ProgrammeWhoFor whoFor={programme.whoFor} category={category} slug={slug} />
      <ProgrammeWhatIncluded included={programme.included} category={category} />
      {programme.schedule && <ProgrammeSchedule schedule={programme.schedule} category={category} />}
      <ProgrammeOutcomes outcomes={programme.outcomes} category={category} />
      <ProgrammeProof programmeName={programme.name} />
      <CTASection
        title="Ready to Start Your Journey?"
        description={programme.ctaDescription}
        primaryText={programme.ctaText}
      />
      <FAQSection
        faqs={programme.faqs}
        title={`${programme.name} FAQ`}
        subtitle="Common questions about this programme."
      />
      <EnquiryFormSection preselectedProgramme={programme.slug} />
    </>
  )
}
