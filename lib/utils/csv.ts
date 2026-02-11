export interface CSVParseResult {
  headers: string[]
  rows: string[][]
}

/**
 * Parse CSV text handling quoted fields, commas in values, BOM, and mixed line endings.
 */
export function parseCSV(text: string): CSVParseResult {
  // Strip BOM
  const clean = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let current: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    const next = clean[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"'
        i++ // skip escaped quote
      } else if (ch === '"') {
        inQuotes = false
      } else {
        field += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        current.push(field.trim())
        field = ''
      } else if (ch === '\r' && next === '\n') {
        current.push(field.trim())
        field = ''
        if (current.some((c) => c !== '')) rows.push(current)
        current = []
        i++ // skip \n
      } else if (ch === '\n' || ch === '\r') {
        current.push(field.trim())
        field = ''
        if (current.some((c) => c !== '')) rows.push(current)
        current = []
      } else {
        field += ch
      }
    }
  }

  // Push last field/row
  current.push(field.trim())
  if (current.some((c) => c !== '')) rows.push(current)

  if (rows.length === 0) return { headers: [], rows: [] }

  return {
    headers: rows[0],
    rows: rows.slice(1),
  }
}

export interface ContactField {
  key: string
  label: string
  required: boolean
}

export const CONTACT_FIELDS: ContactField[] = [
  { key: 'first_name', label: 'First Name', required: true },
  { key: 'last_name', label: 'Last Name', required: true },
  { key: 'email', label: 'Email', required: true },
  { key: 'phone', label: 'Phone', required: false },
  { key: 'date_of_birth', label: 'Date of Birth', required: false },
  { key: 'graduation_year', label: 'Graduation Year', required: false },
  { key: 'gender', label: 'Gender', required: false },
  { key: 'country', label: 'Country', required: false },
  { key: 'state', label: 'State', required: false },
  { key: 'city', label: 'City', required: false },
  { key: 'club_name', label: 'Club Name', required: false },
  { key: 'position', label: 'Position', required: false },
  { key: 'gpa', label: 'GPA', required: false },
  { key: 'parent_name', label: 'Parent Name', required: false },
  { key: 'parent_email', label: 'Parent Email', required: false },
  { key: 'parent_phone', label: 'Parent Phone', required: false },
  { key: 'source_detail', label: 'External ID / Source', required: false },
  { key: 'subscription_status', label: 'Subscription Status', required: false },
  { key: '__tags__', label: 'Tags', required: false },
  { key: 'notes', label: 'Notes', required: false },
]

const HEADER_ALIASES: Record<string, string[]> = {
  first_name: ['first name', 'firstname', 'first', 'fname', 'given name'],
  last_name: ['last name', 'lastname', 'last', 'lname', 'surname', 'family name'],
  email: ['email', 'email address', 'e-mail'],
  phone: ['phone', 'phone number', 'telephone', 'tel', 'mobile', 'cell'],
  date_of_birth: ['date of birth', 'dob', 'birthday', 'birth date', 'birthdate'],
  graduation_year: ['graduation year', 'grad year', 'class', 'class year', 'class of', 'year of entry', 'expected year of entry'],
  gender: ['gender', 'sex'],
  country: ['country', 'nation', 'home country', 'country of residence', 'nationality'],
  state: ['state', 'province', 'region', 'us state'],
  city: ['city', 'town'],
  club_name: ['club name', 'club', 'team', 'team name', 'current club', 'organization'],
  position: ['position', 'pos', 'playing position', 'football position'],
  gpa: ['gpa', 'grade point average'],
  parent_name: ['parent name', 'guardian name', 'guardian', 'parent/guardian', "parent/guardians full name", 'parent/guardian name'],
  parent_email: ['parent email', 'parent e-mail', 'guardian email', 'parent/guardian email'],
  parent_phone: ['parent phone', 'parent tel', 'guardian phone', "parent/guardians phone number", "parent's number", "parents number"],
  source_detail: ['id', 'external id', 'source', 'source detail', 'how did you hear about us', 'website source', 'website scoring'],
  subscription_status: ['status', 'subscription status', 'sub status'],
  __tags__: ['tags', 'tag'],
  notes: ['notes', 'note', 'comments', 'comment', 'questions/queries'],
}

/**
 * Auto-map CSV headers to contact field keys using fuzzy matching.
 */
export function autoMapColumns(csvHeaders: string[]): Record<number, string> {
  const mapping: Record<number, string> = {}
  const used = new Set<string>()

  csvHeaders.forEach((header, index) => {
    // Strip leading *, trailing punctuation, and whitespace for matching
    // e.g. "*How did you hear about us?" → "how did you hear about us"
    const normalized = header
      .toLowerCase()
      .trim()
      .replace(/^\*+/, '')
      .replace(/[?!.]+$/, '')
      .replace(/['']/g, "'")
      .trim()

    for (const [fieldKey, aliases] of Object.entries(HEADER_ALIASES)) {
      if (used.has(fieldKey)) continue

      if (aliases.includes(normalized) || normalized === fieldKey.replace(/_/g, ' ') || normalized === fieldKey) {
        mapping[index] = fieldKey
        used.add(fieldKey)
        break
      }
    }
  })

  return mapping
}

export interface RowValidationError {
  row: number
  field: string
  message: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Validate a single row against the column mapping.
 * Returns null if valid, or an error object.
 */
export function validateRow(
  row: string[],
  mapping: Record<number, string>,
  rowIndex: number
): RowValidationError | null {
  const mapped: Record<string, string> = {}
  for (const [colIdx, fieldKey] of Object.entries(mapping)) {
    mapped[fieldKey] = row[Number(colIdx)] || ''
  }

  // Check required fields
  for (const field of CONTACT_FIELDS) {
    if (field.required && !mapped[field.key]?.trim()) {
      return { row: rowIndex, field: field.key, message: `${field.label} is required` }
    }
  }

  // Validate email format
  if (mapped.email && !EMAIL_RE.test(mapped.email.trim())) {
    return { row: rowIndex, field: 'email', message: 'Invalid email format' }
  }

  // Validate graduation_year
  if (mapped.graduation_year) {
    const yr = parseInt(mapped.graduation_year, 10)
    if (isNaN(yr) || yr < 2000 || yr > 2040) {
      return { row: rowIndex, field: 'graduation_year', message: 'Graduation year must be between 2000-2040' }
    }
  }

  // Validate GPA
  if (mapped.gpa) {
    const gpa = parseFloat(mapped.gpa)
    if (isNaN(gpa) || gpa < 0 || gpa > 5.0) {
      return { row: rowIndex, field: 'gpa', message: 'GPA must be between 0 and 5.0' }
    }
  }

  return null
}

/**
 * Build a contact record from a CSV row using the column mapping.
 */
export function buildContactFromRow(
  row: string[],
  mapping: Record<number, string>
): Record<string, unknown> {
  const contact: Record<string, unknown> = {}

  for (const [colIdx, fieldKey] of Object.entries(mapping)) {
    const value = (row[Number(colIdx)] || '').trim()
    if (!value) continue

    // Skip special fields handled elsewhere
    if (fieldKey.startsWith('__')) continue

    switch (fieldKey) {
      case 'graduation_year':
        contact[fieldKey] = parseInt(value, 10)
        break
      case 'gpa':
        contact[fieldKey] = parseFloat(value)
        break
      case 'gender': {
        const g = value.toLowerCase()
        if (g === 'male' || g === 'm') contact[fieldKey] = 'male'
        else if (g === 'female' || g === 'f') contact[fieldKey] = 'female'
        break
      }
      case 'subscription_status': {
        const s = value.toLowerCase()
        if (s === 'active' || s === 'subscribed') contact[fieldKey] = 'subscribed'
        else if (s === 'unsubscribed' || s === 'inactive') contact[fieldKey] = 'unsubscribed'
        break
      }
      default:
        contact[fieldKey] = value
    }
  }

  return contact
}

/**
 * Extract tag names from a CSV row if __tags__ is mapped.
 * Tags in Active Campaign exports are comma-separated.
 */
export function extractTagsFromRow(
  row: string[],
  mapping: Record<number, string>
): string[] {
  for (const [colIdx, fieldKey] of Object.entries(mapping)) {
    if (fieldKey === '__tags__') {
      const value = (row[Number(colIdx)] || '').trim()
      if (!value) return []
      return value.split(',').map((t) => t.trim()).filter(Boolean)
    }
  }
  return []
}
