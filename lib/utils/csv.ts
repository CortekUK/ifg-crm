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
  { key: '__full_name__', label: 'Full Name', required: false },
  { key: 'first_name', label: 'First Name', required: false },
  { key: 'last_name', label: 'Last Name', required: false },
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
  __full_name__: [
    'full name', 'fullname', 'name', 'contact name', 'player name',
    'student name', 'athlete name', 'client name',
  ],
  first_name: [
    'first name', 'firstname', 'first', 'fname', 'given name',
    'contact first name', 'player first name',
  ],
  last_name: [
    'last name', 'lastname', 'last', 'lname', 'surname', 'family name',
    'contact last name', 'player last name',
  ],
  email: [
    'email', 'email address', 'e-mail', 'e-mail address',
    'contact email', 'player email', 'student email',
    'email (required to import)', 'primary email',
  ],
  phone: [
    'phone', 'phone number', 'telephone', 'tel', 'mobile', 'cell',
    'cell phone', 'mobile number', 'mobile phone', 'contact phone',
    'phone (mobile)', 'phone (home)', 'primary phone',
    'player phone', 'student phone', 'players phone number',
    'contact number', 'tel number',
  ],
  date_of_birth: [
    'date of birth', 'dob', 'birthday', 'birth date', 'birthdate',
    'date of birth (dd/mm/yyyy)', 'date of birth (mm/dd/yyyy)',
    'birth_date', 'born',
  ],
  graduation_year: [
    'graduation year', 'grad year', 'class', 'class year', 'class of',
    'year of entry', 'expected year of entry', 'entry year',
    'graduation', 'grad', 'year of graduation', 'expected graduation',
    'hs grad year', 'high school graduation year',
    'year', 'intake year', 'cohort', 'cohort year',
  ],
  gender: ['gender', 'sex', 'male/female'],
  country: [
    'country', 'nation', 'home country', 'country of residence', 'nationality',
    'country/region', 'country name', 'country of origin',
    'players country', "player's country",
    'location country', 'residence country',
  ],
  state: [
    'state', 'province', 'region', 'us state',
    'state/province', 'state/region', 'county',
  ],
  city: [
    'city', 'town', 'hometown', 'home town', 'home city',
    'city/town', 'location', 'location city',
  ],
  club_name: [
    'club name', 'club', 'team', 'team name', 'current club', 'organization',
    'organisation', 'current team', 'club/team', 'academy',
    'club/academy', 'school', 'university', 'college',
    'high school', 'institution', 'previous club',
  ],
  position: [
    'position', 'pos', 'playing position', 'football position',
    'primary position', 'player position', 'preferred position',
  ],
  gpa: [
    'gpa', 'grade point average', 'grade', 'grades',
    'academic score', 'sat score', 'act score',
  ],
  parent_name: [
    'parent name', 'guardian name', 'guardian', 'parent/guardian',
    "parent/guardians full name", 'parent/guardian name',
    "parent's name", 'parents name', 'mother name', 'father name',
    'emergency contact', 'emergency contact name',
    'guardian full name',
  ],
  parent_email: [
    'parent email', 'parent e-mail', 'guardian email', 'parent/guardian email',
    "parent's email", 'parents email', "parent/guardian's email",
    'guardian e-mail', 'emergency contact email',
  ],
  parent_phone: [
    'parent phone', 'parent tel', 'guardian phone',
    "parent/guardians phone number", "parent's number", "parents number",
    'parent mobile', 'guardian mobile', 'parent/guardian phone',
    "parent's phone", 'parents phone', 'emergency contact phone',
    'guardian phone number',
  ],
  source_detail: [
    'id', 'external id', 'source', 'source detail',
    'how did you hear about us', 'website source', 'website scoring',
    'lead source', 'referral source', 'campaign source',
    'utm source', 'utm_source', 'acquisition source',
    'how did you find us', 'heard about us',
  ],
  subscription_status: [
    'subscription status', 'sub status', 'email status',
    'opt in', 'opt-in', 'opted in', 'consent',
    'email opt in', 'marketing consent', 'subscribed',
  ],
  __tags__: [
    'tags', 'tag', 'labels', 'label', 'categories', 'category',
    'groups', 'group', 'segments', 'segment',
    'active campaign tags', 'contact tags',
  ],
  notes: [
    'notes', 'note', 'comments', 'comment',
    'questions/queries', 'additional info', 'additional information',
    'remarks', 'description', 'bio', 'about',
  ],
}

/**
 * Normalize a header string for matching: lowercase, strip punctuation, collapse whitespace.
 */
function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .replace(/^\*+/, '')
    .replace(/[?!.,:;]+$/, '')
    .replace(/[''`]/g, "'")
    .replace(/[""]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Auto-map CSV headers to contact field keys.
 * Uses exact alias matching first, then falls back to contains-based fuzzy matching.
 */
export function autoMapColumns(csvHeaders: string[]): Record<number, string> {
  const mapping: Record<number, string> = {}
  const used = new Set<string>()

  // Pass 1: exact alias match
  csvHeaders.forEach((header, index) => {
    const normalized = normalizeHeader(header)

    for (const [fieldKey, aliases] of Object.entries(HEADER_ALIASES)) {
      if (used.has(fieldKey)) continue

      if (
        aliases.includes(normalized) ||
        normalized === fieldKey.replace(/_/g, ' ') ||
        normalized === fieldKey
      ) {
        mapping[index] = fieldKey
        used.add(fieldKey)
        break
      }
    }
  })

  // Pass 2: fuzzy — check if any alias is contained within the header or vice versa
  csvHeaders.forEach((header, index) => {
    if (mapping[index]) return // already mapped
    const normalized = normalizeHeader(header)
    if (!normalized) return

    for (const [fieldKey, aliases] of Object.entries(HEADER_ALIASES)) {
      if (used.has(fieldKey)) continue

      const matched = aliases.some((alias) => {
        // Skip very short aliases for contains matching to avoid false positives
        if (alias.length < 4) return false
        return normalized.includes(alias) || alias.includes(normalized)
      })

      if (matched) {
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
 * Check whether the mapping has a name source: either first_name+last_name or __full_name__.
 */
export function hasNameMapping(mapping: Record<number, string>): boolean {
  const fields = new Set(Object.values(mapping))
  return fields.has('__full_name__') || (fields.has('first_name') && fields.has('last_name'))
}

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

  // Email is always required
  if (!mapped.email?.trim()) {
    return { row: rowIndex, field: 'email', message: 'Email is required' }
  }

  // Need either full_name OR (first_name AND last_name)
  const hasFullName = mapped.__full_name__?.trim()
  const hasFirstName = mapped.first_name?.trim()
  const hasLastName = mapped.last_name?.trim()

  if (!hasFullName && !hasFirstName && !hasLastName) {
    return { row: rowIndex, field: 'first_name', message: 'Name is required (Full Name, or First + Last Name)' }
  }

  // Validate email format
  if (mapped.email && !EMAIL_RE.test(mapped.email.trim())) {
    return { row: rowIndex, field: 'email', message: 'Invalid email format' }
  }

  // Validate graduation_year
  if (mapped.graduation_year) {
    const yr = parseInt(mapped.graduation_year, 10)
    if (isNaN(yr) || yr < 1950 || yr > 2040) {
      return { row: rowIndex, field: 'graduation_year', message: 'Graduation year must be between 1950-2040' }
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
 * Split a full name into first and last name parts.
 */
function splitFullName(fullName: string): { first_name: string; last_name: string } {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 0) return { first_name: '', last_name: '' }
  if (parts.length === 1) return { first_name: parts[0], last_name: '' }
  // Last word is last name, everything else is first name
  return {
    first_name: parts.slice(0, -1).join(' '),
    last_name: parts[parts.length - 1],
  }
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
    if (fieldKey === '__tags__') continue

    // Handle full name → split into first_name / last_name
    if (fieldKey === '__full_name__') {
      const { first_name, last_name } = splitFullName(value)
      // Only set if not already mapped from dedicated columns
      if (!contact.first_name && first_name) contact.first_name = first_name
      if (!contact.last_name && last_name) contact.last_name = last_name
      continue
    }

    switch (fieldKey) {
      case 'graduation_year': {
        const yr = parseInt(value, 10)
        if (!isNaN(yr)) contact[fieldKey] = yr
        break
      }
      case 'gpa': {
        const gpa = parseFloat(value)
        if (!isNaN(gpa)) contact[fieldKey] = gpa
        break
      }
      case 'gender': {
        const g = value.toLowerCase()
        if (g === 'male' || g === 'm') contact[fieldKey] = 'male'
        else if (g === 'female' || g === 'f') contact[fieldKey] = 'female'
        break
      }
      case 'subscription_status': {
        const s = value.toLowerCase()
        if (s === 'active' || s === 'subscribed' || s === 'yes' || s === '1' || s === 'true' || s === 'opted in') {
          contact[fieldKey] = 'subscribed'
        } else if (s === 'unsubscribed' || s === 'inactive' || s === 'no' || s === '0' || s === 'false' || s === 'opted out') {
          contact[fieldKey] = 'unsubscribed'
        }
        break
      }
      case 'date_of_birth': {
        // Try to normalise common date formats to YYYY-MM-DD
        const parsed = parseDateValue(value)
        if (parsed) contact[fieldKey] = parsed
        break
      }
      default:
        contact[fieldKey] = value
    }
  }

  // Ensure first_name and last_name have fallback values
  if (!contact.first_name) contact.first_name = ''
  if (!contact.last_name) contact.last_name = ''

  return contact
}

/**
 * Try to parse a date string into YYYY-MM-DD format.
 * Handles: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, DD-MM-YYYY, etc.
 */
function parseDateValue(value: string): string | null {
  // Already in ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10)
  }

  // DD/MM/YYYY or DD-MM-YYYY (common in UK/EU)
  const ddmmyyyy = value.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/)
  if (ddmmyyyy) {
    const [, a, b, year] = ddmmyyyy
    const day = parseInt(a, 10)
    const month = parseInt(b, 10)
    // If first number > 12, it must be DD/MM
    if (day > 12) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
    // If second number > 12, it must be MM/DD
    if (month > 12) {
      return `${year}-${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}`
    }
    // Ambiguous — assume DD/MM (UK format, more common for football)
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  // Try native Date parse as last resort
  const d = new Date(value)
  if (!isNaN(d.getTime()) && d.getFullYear() > 1900) {
    return d.toISOString().slice(0, 10)
  }

  return null
}

/**
 * Extract tag names from a CSV row if __tags__ is mapped.
 * Tags can be comma-separated, semicolon-separated, or pipe-separated.
 */
export function extractTagsFromRow(
  row: string[],
  mapping: Record<number, string>
): string[] {
  for (const [colIdx, fieldKey] of Object.entries(mapping)) {
    if (fieldKey === '__tags__') {
      const value = (row[Number(colIdx)] || '').trim()
      if (!value) return []
      // Support comma, semicolon, and pipe as separators
      return value.split(/[,;|]/).map((t) => t.trim()).filter(Boolean)
    }
  }
  return []
}
