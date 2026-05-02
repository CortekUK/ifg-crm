// Scout's mascot icon — a stylised soccer ball with a hint of personality.
// Used in the launcher button and the panel header. SVG so it scales cleanly
// at every size without a raster asset.
//
// Two variants:
//   <ScoutMascot />        — the full character (ball + face), use in headers
//                            and empty-state hero.
//   <ScoutBallIcon />      — bare ball, use in compact spots (history list,
//                            tool-trail icons, the launcher button).

import { cn } from '@/lib/utils'

interface MascotProps {
  className?: string
}

export function ScoutBallIcon({ className }: MascotProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-6 w-6', className)}
      aria-hidden="true"
    >
      {/* Outer ball */}
      <circle cx="32" cy="32" r="28" className="fill-white" />
      <circle
        cx="32"
        cy="32"
        r="28"
        className="stroke-slate-900"
        strokeWidth="2"
      />
      {/* Central pentagon */}
      <path
        d="M32 18 L43.5 26.4 L39.1 39.9 L24.9 39.9 L20.5 26.4 Z"
        className="fill-slate-900"
      />
      {/* Connecting seams from each pentagon vertex to the rim */}
      <path
        d="M32 18 L32 6"
        className="stroke-slate-900"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M43.5 26.4 L55.4 22.2"
        className="stroke-slate-900"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M39.1 39.9 L46.6 49.8"
        className="stroke-slate-900"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M24.9 39.9 L17.4 49.8"
        className="stroke-slate-900"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M20.5 26.4 L8.6 22.2"
        className="stroke-slate-900"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

// Mascot character for the empty state. Same ball plus eyes + a smile, so it
// feels like an assistant rather than a sport asset.
export function ScoutMascot({ className }: MascotProps) {
  return (
    <svg
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-14 w-14', className)}
      aria-hidden="true"
    >
      {/* Soft halo */}
      <circle
        cx="48"
        cy="48"
        r="46"
        className="fill-indigo-100 dark:fill-indigo-900/40"
      />
      {/* Ball body — kept white in both themes so the black panels read.
          A soccer ball is white-with-black-panels regardless of theme; the
          earlier dark-mode swap made everything light-on-light and the
          mascot vanished into a white blob. */}
      <circle cx="48" cy="50" r="34" className="fill-white" />
      <circle
        cx="48"
        cy="50"
        r="34"
        className="stroke-slate-900"
        strokeWidth="2.5"
      />
      {/* Pentagon panels (top + sides) */}
      <path d="M48 28 L62 38 L57 55 L39 55 L34 38 Z" className="fill-slate-900" />
      <path d="M22 56 L33 60 L31 73 L20 70 Z" className="fill-slate-900" />
      <path d="M74 56 L63 60 L65 73 L76 70 Z" className="fill-slate-900" />
      {/* Friendly eyes — tucked inside the white space below the top pentagon */}
      <circle cx="42" cy="48" r="2.6" className="fill-slate-900" />
      <circle cx="54" cy="48" r="2.6" className="fill-slate-900" />
      <circle cx="42.7" cy="47.4" r="0.8" className="fill-white" />
      <circle cx="54.7" cy="47.4" r="0.8" className="fill-white" />
      {/* Smile — small arc so it reads as an assistant, not a soccer logo */}
      <path
        d="M42 60 Q48 64 54 60"
        className="stroke-slate-900"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}
