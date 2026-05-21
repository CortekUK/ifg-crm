'use client'

import { useState } from 'react'
import { FadeIn } from './FadeIn'
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

interface EnquiryFormSectionProps {
  preselectedProgramme?: string
}

export function EnquiryFormSection({ preselectedProgramme }: EnquiryFormSectionProps) {
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
      programme: (form.elements.namedItem('programme') as HTMLInputElement)?.value || preselectedProgramme || '',
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

  if (submitted) {
    return (
      <section id="enquire" className="py-20 md:py-28 bg-[#0A0A0A]">
        <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
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
      </section>
    )
  }

  return (
    <section id="enquire" className="py-20 md:py-28 bg-[#0A0A0A]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
          {/* Left: Copy */}
          <FadeIn from="left" className="flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-[2px] bg-red-600" />
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
                Get in Touch
              </span>
            </div>
            <h2 className="font-oswald text-3xl md:text-5xl font-bold uppercase tracking-tight text-white leading-[1.1] mb-5">
              Start Your Journey Today
            </h2>
            <p className="text-lg text-white/60 leading-relaxed mb-8">
              Fill in the form and our admissions team will get back to you within 24-48 hours
              to discuss your options and next steps.
            </p>
            <div className="space-y-4">
              {[
                'Personalised programme recommendation',
                'Visa and travel guidance',
                'Scholarship and funding options',
                'No commitment required',
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  <span className="text-sm text-white/70">{item}</span>
                </div>
              ))}
            </div>
          </FadeIn>

          {/* Right: Form card */}
          <FadeIn from="right" delay={150} className="bg-white dark:bg-white/[0.04] rounded-2xl p-6 sm:p-8 border border-gray-200 dark:border-white/10">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs uppercase tracking-wider text-gray-500 dark:text-white/50">
                    Full Name *
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    required
                    placeholder="Your full name"
                    disabled={loading}
                    className="h-11 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs uppercase tracking-wider text-gray-500 dark:text-white/50">
                    Email Address *
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    disabled={loading}
                    className="h-11 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs uppercase tracking-wider text-gray-500 dark:text-white/50">
                    Phone Number
                  </Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="+44 123 456 7890"
                    disabled={loading}
                    className="h-11 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="playerAge" className="text-xs uppercase tracking-wider text-gray-500 dark:text-white/50">
                    Player Age
                  </Label>
                  <Input
                    id="playerAge"
                    name="playerAge"
                    type="number"
                    min="12"
                    max="30"
                    placeholder="e.g. 17"
                    disabled={loading}
                    className="h-11 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="country" className="text-xs uppercase tracking-wider text-gray-500 dark:text-white/50">
                    Country *
                  </Label>
                  <Input
                    id="country"
                    name="country"
                    required
                    placeholder="Your country"
                    disabled={loading}
                    className="h-11 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="programme" className="text-xs uppercase tracking-wider text-gray-500 dark:text-white/50">
                    Programme of Interest *
                  </Label>
                  <Select name="programme" defaultValue={preselectedProgramme || ''} required>
                    <SelectTrigger className="w-full h-11 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10">
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
                <Label htmlFor="message" className="text-xs uppercase tracking-wider text-gray-500 dark:text-white/50">
                  Message
                </Label>
                <Textarea
                  id="message"
                  name="message"
                  placeholder="Tell us about the player's football experience, current level, and what you're looking for..."
                  rows={3}
                  disabled={loading}
                  className="bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10"
                />
              </div>

              {error && (
                <div className="rounded-md border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-400">
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

              <p className="text-xs text-center text-gray-400 dark:text-white/30">
                By submitting this form, you agree to be contacted by IFG regarding your enquiry.
              </p>
            </form>
          </FadeIn>
        </div>
      </div>
    </section>
  )
}
