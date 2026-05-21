'use client'

import { useState } from 'react'
import { FadeIn } from '@/components/landing/FadeIn'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { programmes } from '@/lib/landing/programmes'
import { Loader2, CheckCircle, ArrowRight } from 'lucide-react'

const admissionsSteps = [
  {
    number: '01',
    title: 'Submit Your Enquiry',
    description: 'Fill in the form and our admissions team will respond within 48 hours.',
  },
  {
    number: '02',
    title: 'Football Assessment',
    description: 'Share your football CV and video highlights for programme matching.',
  },
  {
    number: '03',
    title: 'Programme Offer',
    description: 'Receive a personalised programme recommendation and place offer.',
  },
  {
    number: '04',
    title: 'Visa & Travel Support',
    description: 'We guide you through visa applications, flights, and arrival logistics.',
  },
]

export function V2AdmissionsSection() {
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const form = e.currentTarget
    const data = {
      name: (form.elements.namedItem('name') as HTMLInputElement).value,
      email: (form.elements.namedItem('email') as HTMLInputElement).value,
      phone: (form.elements.namedItem('phone') as HTMLInputElement).value || undefined,
      playerAge: (form.elements.namedItem('playerAge') as HTMLInputElement).value || undefined,
      country: (form.elements.namedItem('country') as HTMLInputElement).value,
      programme: (form.elements.namedItem('programme') as HTMLInputElement)?.value || '',
      message: (form.elements.namedItem('message') as HTMLTextAreaElement).value,
    }

    try {
      const res = await fetch('/api/landing/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Something went wrong')
      }

      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section id="admissions" className="py-20 md:py-28 bg-[#0A0A0A]">
      {/* Extra anchor for navbar "Apply Now" */}
      <div id="enquire" className="scroll-mt-20" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {submitted ? (
          <div className="max-w-xl mx-auto text-center">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-400" />
              </div>
            </div>
            <h3 className="font-oswald text-2xl font-bold uppercase tracking-tight text-white mb-3">
              Enquiry Submitted
            </h3>
            <p className="text-white/60">
              Thank you for your interest in IFG. Our team will be in touch within 24-48 hours.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
            {/* Left: Admissions journey — 45% */}
            <FadeIn from="left" className="lg:col-span-5 flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-[2px] bg-red-600" />
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
                  Admissions
                </span>
              </div>

              <h2 className="font-oswald text-3xl md:text-5xl font-bold uppercase tracking-tight text-white leading-[1.1] mb-8">
                Your Admissions
                <br />
                Journey
              </h2>

              {/* 4-step vertical list */}
              <div className="space-y-0 relative mb-8">
                <div className="absolute top-3 bottom-3 left-[3px] w-px bg-gradient-to-b from-red-600/40 via-red-600/60 to-red-600/20" />

                {admissionsSteps.map((step, i) => (
                  <div key={step.number} className="relative flex gap-5 py-3">
                    <div className="relative z-10 w-[7px] h-[7px] rounded-full bg-red-600 shrink-0 mt-1.5" />
                    <div>
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="font-oswald text-xs font-bold text-red-500/70">
                          {step.number}
                        </span>
                        <h3 className="text-sm font-semibold text-white">
                          {step.title}
                        </h3>
                      </div>
                      <p className="text-[13px] text-white/45 leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                {[
                  'Personalised programme recommendation',
                  'Scholarship and funding options',
                  'No commitment required',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                    <span className="text-sm text-white/60">{item}</span>
                  </div>
                ))}
              </div>
            </FadeIn>

            {/* Right: Inline form — 55% */}
            <FadeIn from="right" delay={150} className="lg:col-span-7">
              <div className="bg-white/[0.04] rounded-2xl p-6 sm:p-8 border border-white/10">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="v2-name" className="text-xs uppercase tracking-wider text-white/50">
                        Full Name *
                      </Label>
                      <Input
                        id="v2-name"
                        name="name"
                        required
                        placeholder="Your full name"
                        disabled={loading}
                        className="h-11 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="v2-email" className="text-xs uppercase tracking-wider text-white/50">
                        Email Address *
                      </Label>
                      <Input
                        id="v2-email"
                        name="email"
                        type="email"
                        required
                        placeholder="you@example.com"
                        disabled={loading}
                        className="h-11 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="v2-phone" className="text-xs uppercase tracking-wider text-white/50">
                        Phone Number
                      </Label>
                      <Input
                        id="v2-phone"
                        name="phone"
                        type="tel"
                        placeholder="+44 123 456 7890"
                        disabled={loading}
                        className="h-11 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="v2-playerAge" className="text-xs uppercase tracking-wider text-white/50">
                        Player Age
                      </Label>
                      <Input
                        id="v2-playerAge"
                        name="playerAge"
                        type="number"
                        min="12"
                        max="30"
                        placeholder="e.g. 17"
                        disabled={loading}
                        className="h-11 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="v2-country" className="text-xs uppercase tracking-wider text-white/50">
                        Country *
                      </Label>
                      <Input
                        id="v2-country"
                        name="country"
                        required
                        placeholder="Your country"
                        disabled={loading}
                        className="h-11 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="v2-programme" className="text-xs uppercase tracking-wider text-white/50">
                        Programme of Interest *
                      </Label>
                      <Select name="programme" required>
                        <SelectTrigger className="w-full h-11 bg-white/5 border-white/10 text-white">
                          <SelectValue placeholder="Select a programme" />
                        </SelectTrigger>
                        <SelectContent>
                          {programmes.map((p) => (
                            <SelectItem key={p.slug} value={p.slug}>
                              {p.name}
                            </SelectItem>
                          ))}
                          <SelectItem value="not-sure">Not sure yet</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="v2-message" className="text-xs uppercase tracking-wider text-white/50">
                      Message
                    </Label>
                    <Textarea
                      id="v2-message"
                      name="message"
                      placeholder="Tell us about the player's football experience, current level, and what you're looking for..."
                      rows={3}
                      disabled={loading}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    />
                  </div>

                  {error && (
                    <div className="rounded-md border border-red-800 bg-red-950/30 px-4 py-3 text-sm text-red-400">
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full bg-red-600 hover:bg-red-700 text-white h-12 font-semibold tracking-wide"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        Submit Enquiry
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-center text-white/30">
                    By submitting this form, you agree to be contacted by IFG regarding your enquiry.
                  </p>
                </form>
              </div>
            </FadeIn>
          </div>
        )}
      </div>
    </section>
  )
}
