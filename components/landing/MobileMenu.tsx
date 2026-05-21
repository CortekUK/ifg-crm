'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { programmes } from '@/lib/landing/programmes'
import { SmoothScrollLink } from './SmoothScrollLink'
import { X } from 'lucide-react'

interface MobileMenuProps {
  open: boolean
  onClose: () => void
}

export function MobileMenu({ open, onClose }: MobileMenuProps) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" showCloseButton={false} className="w-80 p-0">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <Image
              src="/landing/logos/ifg-crest.png"
              alt="IFG"
              width={32}
              height={32}
              className="h-8 w-8 dark:invert-0 invert"
            />
            <div className="flex flex-col leading-tight">
              <span className="text-[9px] font-medium text-muted-foreground tracking-widest uppercase">
                The International
              </span>
              <span className="text-base font-extrabold text-foreground tracking-tight">
                FOOTBALL GROUP
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-accent transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-1">
          <Link
            href="/landing"
            onClick={onClose}
            className="block px-3 py-2.5 text-sm font-medium rounded-md hover:bg-accent transition-colors"
          >
            Home
          </Link>

          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Programmes
          </div>

          {programmes.map((p) => (
            <Link
              key={p.slug}
              href={`/landing/programmes/${p.slug}`}
              onClick={onClose}
              className="block px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors ml-2"
            >
              {p.name}
            </Link>
          ))}

          <Link
            href="/landing/programmes"
            onClick={onClose}
            className="block px-3 py-2 text-sm font-medium text-gray-900 dark:text-white rounded-md hover:bg-accent transition-colors"
          >
            View All Programmes
          </Link>

          <div className="border-t border-border my-2" />

          <SmoothScrollLink
            href="#testimonials"
            className="block px-3 py-2.5 text-sm font-medium rounded-md hover:bg-accent transition-colors"
          >
            <span onClick={onClose}>Testimonials</span>
          </SmoothScrollLink>

          <SmoothScrollLink
            href="#faq"
            className="block px-3 py-2.5 text-sm font-medium rounded-md hover:bg-accent transition-colors"
          >
            <span onClick={onClose}>FAQ</span>
          </SmoothScrollLink>
        </div>

        <div className="p-4 mt-auto border-t border-border">
          <SmoothScrollLink href="#enquire" className="block">
            <Button
              className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg shadow-red-600/25"
              onClick={onClose}
            >
              Enquire Now
            </Button>
          </SmoothScrollLink>
        </div>
      </SheetContent>
    </Sheet>
  )
}
