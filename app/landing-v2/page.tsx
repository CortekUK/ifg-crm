import { V2HeroSection } from '@/components/landing-v2/V2HeroSection'
import { V2PathwaySection } from '@/components/landing-v2/V2PathwaySection'
import { V2EducationSection } from '@/components/landing-v2/V2EducationSection'
import { V2ProgrammeSelector } from '@/components/landing-v2/V2ProgrammeSelector'
import { V2MatchdayProof } from '@/components/landing-v2/V2MatchdayProof'
import { V2FacilitiesSection } from '@/components/landing-v2/V2FacilitiesSection'
import { V2AdmissionsSection } from '@/components/landing-v2/V2AdmissionsSection'

export default function LandingV2Page() {
  return (
    <>
      <V2HeroSection />
      <V2PathwaySection />
      <V2EducationSection />
      <V2ProgrammeSelector />
      <V2MatchdayProof />
      <V2FacilitiesSection />
      <V2AdmissionsSection />
    </>
  )
}
