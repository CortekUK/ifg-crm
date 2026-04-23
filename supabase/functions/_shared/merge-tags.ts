// Canonical merge-tag replacement core for all email-sending paths.
// Used by Supabase Edge Functions (Deno) — process-automations, send-email.
//
// MIRROR: lib/utils/merge-tags-core.ts
// tsconfig.json excludes supabase/functions/, so this file and its mirror
// cannot share an import. Any change here MUST be made in the mirror too.
// The Next.js side (lib/utils/mergeTags.ts) wraps the mirror and adds
// UI-only helpers (MERGE_TAGS catalog, preview/validate/extract).
//
// Features (superset consolidated from three prior implementations):
//   Simple tags:        {{field_name}}
//   Fallback:           {{field_name|default text}}
//   Truthy block:       {{#if field_name}}...{{/if}}
//   Equality block:     {{#if field_name equals "value"}}...{{/if}}
//   Non-equality block: {{#if field_name not_equals "value"}}...{{/if}}
//   Contains block:     {{#if field_name contains "value"}}...{{/if}}
//   Negated block:      {{#unless field_name}}...{{/unless}}
//   Number formatting:  rendered as GBP currency (min 0 decimals)
//   Boolean formatting: rendered as "Yes" / "No"
//   Field lookup:       snake_case keys with camelCase fallback

export type MergeTagValue = string | number | boolean | null | undefined

export interface MergeTagData {
  [key: string]: MergeTagValue
}

export function replaceMergeTags(template: string, data: MergeTagData): string {
  if (!template) return ''
  return replaceSimpleTags(processConditionalBlocks(template, data), data)
}

function processConditionalBlocks(template: string, data: MergeTagData): string {
  let result = template

  // {{#if field equals "value"}}...{{/if}}
  result = result.replace(
    /\{\{#if\s+(\w+)\s+equals\s+"([^"]+)"\}\}([\s\S]*?)\{\{\/if\}\}/gi,
    (_, fieldName, expected, content) => {
      const actual = getFieldValue(fieldName, data)
      return actual === expected ? content : ''
    },
  )

  // {{#if field not_equals "value"}}...{{/if}}
  result = result.replace(
    /\{\{#if\s+(\w+)\s+not_equals\s+"([^"]+)"\}\}([\s\S]*?)\{\{\/if\}\}/gi,
    (_, fieldName, expected, content) => {
      const actual = getFieldValue(fieldName, data)
      return actual !== expected ? content : ''
    },
  )

  // {{#if field contains "value"}}...{{/if}} (case-insensitive substring match)
  result = result.replace(
    /\{\{#if\s+(\w+)\s+contains\s+"([^"]+)"\}\}([\s\S]*?)\{\{\/if\}\}/gi,
    (_, fieldName, substring, content) => {
      const actual = String(getFieldValue(fieldName, data) ?? '')
      return actual.toLowerCase().includes(substring.toLowerCase()) ? content : ''
    },
  )

  // {{#if field}}...{{/if}} — truthy check. Must run AFTER the qualifier
  // variants or it would swallow "field equals" / "field contains" etc.
  result = result.replace(
    /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/gi,
    (_, fieldName, content) => {
      const value = getFieldValue(fieldName, data)
      return value && value !== '' ? content : ''
    },
  )

  // {{#unless field}}...{{/unless}}
  result = result.replace(
    /\{\{#unless\s+(\w+)\}\}([\s\S]*?)\{\{\/unless\}\}/gi,
    (_, fieldName, content) => {
      const value = getFieldValue(fieldName, data)
      return !value || value === '' ? content : ''
    },
  )

  return result
}

function replaceSimpleTags(template: string, data: MergeTagData): string {
  // {{field}} or {{field|fallback}}. \w+ on the tag name prevents matching
  // the conditional helpers (which always contain #, a space, or /).
  return template.replace(
    /\{\{(\w+)(?:\|([^}]+))?\}\}/g,
    (_, fieldName, fallback) => {
      const value = getFieldValue(fieldName, data)
      if (value !== null && value !== undefined && value !== '') {
        return formatValue(value)
      }
      return fallback !== undefined ? fallback : ''
    },
  )
}

function getFieldValue(fieldName: string, data: MergeTagData): MergeTagValue {
  if (fieldName in data) return data[fieldName]
  // Fallback to camelCase so callers passing e.g. dealOwnerName still resolve.
  const camel = fieldName.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase())
  if (camel in data) return data[camel]
  return undefined
}

function formatValue(value: MergeTagValue): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
    }).format(value)
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}
