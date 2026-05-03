'use client'

// Markdown renderer for Scout's assistant replies. The model emits standard
// markdown (bold, lists, tables, code, links) and the chat bubble was
// previously dumping it raw. This renders it with premium, restrained
// styling that matches the rest of the widget.
//
// Why a dedicated component: react-markdown gives us per-element overrides,
// so we can style each token (h2, ul, table) for the tight bubble width
// without polluting global CSS. Tailwind utility classes scope it cleanly.

import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'
import { ScoutChart, parseChartSpec } from './ScoutChart'
import { ScoutEntityRef, parseEntityHref } from './ScoutEntityRef'
import { ScoutBriefing, parseBriefingSpec } from './ScoutBriefing'

interface ScoutMarkdownProps {
  text: string
  className?: string
}

// One catalogue of overrides shared across the widget. Each element below
// is sized down a notch from typography defaults — the bubble is narrow
// (~340px) so we want compact spacing without the content feeling cramped.
const COMPONENTS: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,

  strong: ({ children }) => (
    <strong className="font-semibold text-slate-900 dark:text-white">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,

  // Headings — the model rarely emits beyond h3 in chat, so we tune those.
  h1: ({ children }) => (
    <h3 className="mb-1.5 mt-2 text-sm font-semibold text-slate-900 dark:text-white">
      {children}
    </h3>
  ),
  h2: ({ children }) => (
    <h3 className="mb-1.5 mt-2 text-sm font-semibold text-slate-900 dark:text-white">
      {children}
    </h3>
  ),
  h3: ({ children }) => (
    <h4 className="mb-1 mt-1.5 text-[13px] font-semibold text-slate-900 dark:text-white">
      {children}
    </h4>
  ),

  ul: ({ children }) => (
    <ul className="mb-2 ml-4 list-disc space-y-0.5 marker:text-indigo-400 dark:marker:text-indigo-500">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 ml-4 list-decimal space-y-0.5 marker:text-indigo-400 dark:marker:text-indigo-500">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,

  a: ({ href, children }) => {
    // Custom URI scheme `scout-entity:type:uuid` — render the link as an
    // inline hover-card chip instead of a normal anchor. The model emits
    // these for CRM entities (contact / deal / invoice / etc.) so the user
    // can hover for a preview and click through to the CRM page.
    const entity = parseEntityHref(href)
    if (entity) {
      const label =
        typeof children === 'string'
          ? children
          : Array.isArray(children)
            ? children.filter((c) => typeof c === 'string').join('')
            : String(children ?? '')
      return <ScoutEntityRef type={entity.type} id={entity.id} label={label || 'entity'} />
    }
    // Only emit an anchor for navigable URLs. If the model hallucinated a
    // malformed `scout-entity:` link (bad UUID etc.) or any other non-http
    // scheme, fall back to plain bold text — clicking would otherwise keep
    // the user on /scout and feel broken.
    const isNavigable =
      typeof href === 'string' &&
      /^(https?:|mailto:|tel:|\/)/i.test(href)
    if (!isNavigable) {
      return (
        <span className="font-medium text-indigo-600 dark:text-indigo-400">
          {children}
        </span>
      )
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-400"
      >
        {children}
      </a>
    )
  },

  // Inline code vs fenced — the `inline` flag is on `code` props from
  // react-markdown. Block code gets a card with a soft tint; inline code
  // gets a subtle pill so it reads inline without breaking the line.
  code: ({ className: codeClass, children, ...props }) => {
    const isBlock = /language-/.test(codeClass ?? '')
    if (!isBlock) {
      return (
        <code
          className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[12px] text-slate-800 dark:bg-slate-800/80 dark:text-slate-200"
          {...props}
        >
          {children}
        </code>
      )
    }
    return (
      <code
        className={cn('font-mono text-[12px] leading-relaxed', codeClass)}
        {...props}
      >
        {children}
      </code>
    )
  },
  pre: ({ children }) => (
    <pre className="mb-2 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-[12px] text-slate-800 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
      {children}
    </pre>
  ),

  // Tables — used a lot when Scout reports row data.
  table: ({ children }) => (
    <div className="mb-2 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="w-full border-collapse text-[12px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-slate-50 dark:bg-slate-800/60">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="border-b border-slate-200 px-2.5 py-1.5 text-left font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-slate-100 px-2.5 py-1.5 text-slate-700 last:border-0 dark:border-slate-800 dark:text-slate-300">
      {children}
    </td>
  ),

  blockquote: ({ children }) => (
    <blockquote className="mb-2 border-l-2 border-indigo-300 pl-3 italic text-slate-600 dark:border-indigo-500/50 dark:text-slate-300">
      {children}
    </blockquote>
  ),

  hr: () => <hr className="my-3 border-slate-200 dark:border-slate-700" />,
}

// Find Scout's custom fenced blocks in the model output and split the text
// around them so each one renders as a dedicated React component while the
// surrounding markdown still goes through ReactMarkdown normally.
//
// Languages handled:
//   scout-chart    → inline Recharts figure
//   scout-briefing → styled briefing card with a "Download PDF" button
const SCOUT_FENCE = /```scout-(chart|briefing)\s*\n([\s\S]+?)\n```/g

export function ScoutMarkdown({ text, className }: ScoutMarkdownProps) {
  const segments: React.ReactNode[] = []
  let lastIndex = 0
  let m: RegExpExecArray | null
  let i = 0
  // Reset state on every call (regex is module-level with /g flag).
  SCOUT_FENCE.lastIndex = 0
  while ((m = SCOUT_FENCE.exec(text)) !== null) {
    if (m.index > lastIndex) {
      segments.push(
        <ReactMarkdown key={`md-${i}`} remarkPlugins={[remarkGfm]} components={COMPONENTS}>
          {text.slice(lastIndex, m.index)}
        </ReactMarkdown>,
      )
    }
    const lang = m[1]
    const body = m[2]
    let component: React.ReactNode = null
    if (lang === 'chart') {
      const spec = parseChartSpec(body)
      if (spec) component = <ScoutChart key={`chart-${i}`} spec={spec} />
    } else if (lang === 'briefing') {
      const spec = parseBriefingSpec(body)
      if (spec) component = <ScoutBriefing key={`briefing-${i}`} spec={spec} />
    }
    if (component) {
      segments.push(component)
    } else {
      // Malformed JSON inside the fence — fall back to showing the raw block
      // as code so the user can still see what the model tried to emit.
      segments.push(
        <pre
          key={`bad-${i}`}
          className="mb-2 overflow-x-auto rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300"
        >
          {m[0]}
        </pre>,
      )
    }
    lastIndex = m.index + m[0].length
    i++
  }
  if (lastIndex < text.length) {
    segments.push(
      <ReactMarkdown key={`md-${i}`} remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {text.slice(lastIndex)}
      </ReactMarkdown>,
    )
  }

  return (
    <div className={cn('text-sm leading-relaxed', className)}>
      {segments.length > 0 ? (
        segments
      ) : (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
          {text}
        </ReactMarkdown>
      )}
    </div>
  )
}
