import { HeroSection } from '@/components/landing/HeroSection'
import { StatsBar } from '@/components/landing/StatsBar'
import { WhyIFGSection } from '@/components/landing/WhyIFGSection'
import { PartnerLogos } from '@/components/landing/PartnerLogos'
import { ProgrammeFinder } from '@/components/landing/ProgrammeFinder'
import { ProgrammeBenefitsSection } from '@/components/landing/ProgrammeBenefitsSection'
import { FacilitiesSection } from '@/components/landing/FacilitiesSection'
import { CoachingStaffSection } from '@/components/landing/CoachingStaffSection'
import { JourneySection } from '@/components/landing/JourneySection'
import { VideoSection } from '@/components/landing/VideoSection'
import { TestimonialCarousel } from '@/components/landing/TestimonialCarousel'
import { FAQSection } from '@/components/landing/FAQSection'
import { EnquiryFormSection } from '@/components/landing/EnquiryFormSection'
import { homepageFaqs } from '@/lib/landing/programmes'

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <StatsBar />
      <WhyIFGSection />
      <PartnerLogos />
      <ProgrammeFinder />
      <ProgrammeBenefitsSection />
      <FacilitiesSection />
      <CoachingStaffSection />
      <JourneySection />
      <VideoSection />
      <TestimonialCarousel />
      <FAQSection faqs={homepageFaqs} />
      <EnquiryFormSection />
    </>
  )
}
