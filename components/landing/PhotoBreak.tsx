import Image from 'next/image'

interface PhotoBreakProps {
  src: string
  alt: string
  stat?: { value: string; label: string }
}

export function PhotoBreak({ src, alt, stat }: PhotoBreakProps) {
  return (
    <section className="relative h-[40vh] md:h-[50vh] overflow-hidden">
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover object-center"
        sizes="100vw"
      />
      {stat && (
        <>
          <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0A]/80 via-[#0A0A0A]/40 to-transparent" />
          <div className="absolute inset-0 flex items-center">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
              <div className="font-oswald text-6xl md:text-8xl font-bold text-white tracking-tight leading-none">
                {stat.value}
              </div>
              <p className="mt-2 text-sm md:text-base text-white/60 uppercase tracking-[0.15em] font-medium">
                {stat.label}
              </p>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
