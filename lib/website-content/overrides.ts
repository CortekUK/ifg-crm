// Immutable dot-path helpers for the page-overrides doc (website_pages.overrides).
// The editor stores ONLY changed fields, nested by path (e.g. { hero: { title } }).

import type { FieldType } from './page-schema'

type Obj = Record<string, unknown>

export function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o == null ? undefined : (o as Obj)[k]), obj)
}

// Set a value at a dot-path, returning a new object (parents shallow-cloned).
export function setPath<T extends Obj>(obj: T, path: string, value: unknown): T {
  const keys = path.split('.')
  const root: Obj = { ...obj }
  let cur = root
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]
    cur[k] = { ...((cur[k] as Obj) ?? {}) }
    cur = cur[k] as Obj
  }
  cur[keys[keys.length - 1]] = value
  return root as T
}

// Remove a value at a dot-path, pruning any parent objects left empty.
export function deletePath<T extends Obj>(obj: T, path: string): T {
  const [head, ...rest] = path.split('.')
  if (!(head in obj)) return obj
  const copy: Obj = { ...obj }
  if (rest.length === 0) {
    delete copy[head]
  } else {
    const child = deletePath(((copy[head] as Obj) ?? {}), rest.join('.'))
    if (child && Object.keys(child).length) copy[head] = child
    else delete copy[head]
  }
  return copy as T
}

// Is a field value a real override (vs "use the default")?
export function isSet(value: unknown, type: FieldType): boolean {
  if (value == null) return false
  if (type === 'list' || type === 'images') return Array.isArray(value) && value.length > 0
  return typeof value === 'string' ? value.trim().length > 0 : true
}
