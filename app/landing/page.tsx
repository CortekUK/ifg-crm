import { HeroSection } from '@/components/landing/HeroSection'
import { OnThePitch } from '@/components/landing/OnThePitch'
import { InTheClassroom } from '@/components/landing/InTheClassroom'
import { MatchdaySection } from '@/components/landing/MatchdaySection'
import { ProgrammeFinder } from '@/components/landing/ProgrammeFinder'
import { LivingAndSupport } from '@/components/landing/LivingAndSupport'
import { CoachingStaffSection } from '@/components/landing/CoachingStaffSection'
import { ApplicationJourney } from '@/components/landing/ApplicationJourney'
import { FAQSection } from '@/components/landing/FAQSection'
import { EnquiryFormSection } from '@/components/landing/EnquiryFormSection'
import { homepageFaqs } from '@/lib/landing/programmes'

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <OnThePitch />
      <InTheClassroom />
      <MatchdaySection />
      <ProgrammeFinder />
      <LivingAndSupport />
      <CoachingStaffSection />
      <ApplicationJourney />
      <FAQSection faqs={homepageFaqs} />
      <EnquiryFormSection />
    </>
  )
}
