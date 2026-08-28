'use client'

// The theme, made available to every block editor on the canvas.
//
// The canvas is supposed to mirror what `render-html.ts` emits, but the block
// editors were painting their own fixed colours and fonts: changing the brand
// colour, the heading font or the corner style did nothing to the email in
// front of you, and the button preview showed its own stored colour while the
// renderer had already switched to the brand one. The panel looked broken
// because, from the canvas's point of view, it was.
//
// Passed by context rather than by prop because a block can sit three levels
// down (columns and conditionals nest blocks inside blocks) and every one of
// them would otherwise have to forward a prop it doesn't use itself.

import { createContext, useContext } from 'react'
import { resolveTheme } from '@/lib/templates/render-html'
import type { TemplateTheme } from '@/lib/templates/editor-types'

const EditorThemeContext = createContext<Required<TemplateTheme>>(resolveTheme(null))

export function EditorThemeProvider({
  theme,
  children,
}: {
  theme?: TemplateTheme | null
  children: React.ReactNode
}) {
  return (
    <EditorThemeContext.Provider value={resolveTheme(theme)}>
      {children}
    </EditorThemeContext.Provider>
  )
}

/** Resolved theme — every key present, defaults filled in. */
export function useEditorTheme(): Required<TemplateTheme> {
  return useContext(EditorThemeContext)
}
