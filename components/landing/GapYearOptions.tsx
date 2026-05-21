import { Calendar, Sun, Snowflake } from 'lucide-react'

const options = [
  {
    icon: Calendar,
    title: 'Full Year',
    months: 'September – May',
    duration: '9 months',
    description: 'The complete experience. Train and compete across the entire football season with 14+ hours of coaching per week, two fixtures per week, and full en-suite accommodation at Leighton Hall.',
    highlights: ['Maximum match exposure', 'Strongest pathway to University Programme'],
  },
  {
    icon: Snowflake,
    title: 'Autumn Term',
    months: 'September – December',
    duration: '4 months',
    description: 'Start with the new season. Experience pre-season preparation, settle into the programme, and compete through the autumn fixtures. Ideal if you want to test yourself before committing to a full year.',
    highlights: ['Pre-season preparation included', 'Option to extend to full year'],
  },
  {
    icon: Sun,
    title: 'Spring Term',
    months: 'January – May',
    duration: '5 months',
    description: 'Join mid-season and push through to the end. The spring window covers the most competitive part of the season — cup runs, league deciders, and end-of-season showcases.',
    highlights: ['Peak competitive fixtures', 'Season-end showcase opportunities'],
  },
]

export function GapYearOptions() {
  return (
    <section className="py-20 md:py-28 bg-gray-50 dark:bg-white/[0.02]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="flex items-center gap-3 justify-center mb-4">
            <div className="w-10 h-[2px] bg-emerald-600" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-500">
              Flexible Start Dates
            </span>
          </div>
          <h2 className="font-oswald text-3xl md:text-4xl font-bold uppercase tracking-tight text-gray-900 dark:text-foreground leading-[1.1]">
            Choose Your Window
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-muted-foreground max-w-2xl mx-auto">
            The Gap Year Programme isn&apos;t one-size-fits-all. All options include en-suite accommodation at Leighton Hall, 14+ hours of coaching per week, and two competitive fixtures per week.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {options.map((option) => {
            const Icon = option.icon
            return (
              <div
                key={option.title}
                className="relative p-6 rounded-2xl bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/5 flex flex-col"
              >
                <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-emerald-600/10 mb-4">
                  <Icon className="h-5 w-5 text-emerald-600 dark:text-emerald-500" />
                </div>
                <h3 className="font-oswald text-xl font-bold uppercase tracking-tight text-gray-900 dark:text-foreground">
                  {option.title}
                </h3>
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-500 mt-1">
                  {option.months}
                </p>
                <span className="inline-block mt-2 text-xs text-gray-400 dark:text-white/40 font-medium uppercase tracking-wider">
                  {option.duration}
                </span>
                <p className="mt-4 text-sm text-gray-600 dark:text-muted-foreground leading-relaxed">
                  {option.description}
                </p>
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/5 space-y-2 flex-1">
                  {option.highlights.map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0 mt-1.5" />
                      <p className="text-xs text-gray-600 dark:text-muted-foreground leading-relaxed">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
