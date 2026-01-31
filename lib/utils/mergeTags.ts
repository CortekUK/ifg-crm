/**
 * Merge Tag System for Email Templates
 * 
 * Supports:
 * - Simple tags: {{first_name}}, {{last_name}}, etc.
 * - Conditional blocks: {{#if field_name}}...{{/if}}
 * - Conditional equals: {{#if field_name equals "value"}}...{{/if}}
 * - Fallback values: {{first_name|Friend}}
 */

export interface MergeTagData {
  // Contact fields
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  phone?: string | null
  
  // Deal fields
  deal_title?: string | null
  deal_value?: number | null
  deal_stage?: string | null
  deal_pipeline?: string | null
  
  // Deal owner fields
  deal_owner_name?: string | null
  deal_owner_email?: string | null
  deal_owner_phone?: string | null
  deal_owner_calendly?: string | null
  deal_owner_signature?: string | null
  
  // Custom fields
  [key: string]: string | number | boolean | null | undefined
}

export interface MergeTagDefinition {
  tag: string
  label: string
  category: 'contact' | 'deal' | 'owner' | 'custom'
  description: string
  example: string
}

/**
 * Available merge tags for the template editor
 */
export const MERGE_TAGS: MergeTagDefinition[] = [
  // Contact tags
  {
    tag: '{{first_name}}',
    label: 'First Name',
    category: 'contact',
    description: "Contact's first name",
    example: 'John',
  },
  {
    tag: '{{last_name}}',
    label: 'Last Name',
    category: 'contact',
    description: "Contact's last name",
    example: 'Smith',
  },
  {
    tag: '{{email}}',
    label: 'Email',
    category: 'contact',
    description: "Contact's email address",
    example: 'john@example.com',
  },
  {
    tag: '{{phone}}',
    label: 'Phone',
    category: 'contact',
    description: "Contact's phone number",
    example: '+44 7700 900123',
  },
  
  // Deal tags
  {
    tag: '{{deal_title}}',
    label: 'Deal Title',
    category: 'deal',
    description: 'Title of the deal',
    example: 'John Smith',
  },
  {
    tag: '{{deal_value}}',
    label: 'Deal Value',
    category: 'deal',
    description: 'Monetary value of the deal',
    example: '£5,000',
  },
  {
    tag: '{{deal_stage}}',
    label: 'Deal Stage',
    category: 'deal',
    description: 'Current stage of the deal',
    example: 'Initial Contact',
  },
  {
    tag: '{{deal_pipeline}}',
    label: 'Deal Pipeline',
    category: 'deal',
    description: 'Pipeline the deal belongs to',
    example: 'UK GAP 2026',
  },
  
  // Deal owner tags
  {
    tag: '{{deal_owner_name}}',
    label: 'Owner Name',
    category: 'owner',
    description: 'Full name of the deal owner',
    example: 'Nathan Recruiter',
  },
  {
    tag: '{{deal_owner_email}}',
    label: 'Owner Email',
    category: 'owner',
    description: 'Email address of the deal owner',
    example: 'nathan@ifg.com',
  },
  {
    tag: '{{deal_owner_phone}}',
    label: 'Owner Phone',
    category: 'owner',
    description: 'Phone number of the deal owner',
    example: '+44 7700 900456',
  },
  {
    tag: '{{deal_owner_calendly}}',
    label: 'Calendly Link',
    category: 'owner',
    description: 'Calendly scheduling link of the deal owner',
    example: 'https://calendly.com/nathan',
  },
  {
    tag: '{{deal_owner_signature}}',
    label: 'Email Signature',
    category: 'owner',
    description: 'Email signature of the deal owner',
    example: 'Best regards,\nNathan',
  },
]

/**
 * Get merge tags grouped by category
 */
export function getMergeTagsByCategory(): Record<string, MergeTagDefinition[]> {
  return MERGE_TAGS.reduce((acc, tag) => {
    if (!acc[tag.category]) {
      acc[tag.category] = []
    }
    acc[tag.category].push(tag)
    return acc
  }, {} as Record<string, MergeTagDefinition[]>)
}

/**
 * Get category display name
 */
export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    contact: 'Contact',
    deal: 'Deal',
    owner: 'Deal Owner',
    custom: 'Custom',
  }
  return labels[category] || category
}

/**
 * Replace merge tags in a template string
 * 
 * @param template - The template string containing merge tags
 * @param data - Object containing values for merge tags
 * @returns The template with merge tags replaced
 */
export function replaceMergeTags(template: string, data: MergeTagData): string {
  if (!template) return ''
  
  let result = template
  
  // Process conditional blocks first
  result = processConditionalBlocks(result, data)
  
  // Then replace simple tags
  result = replaceSimpleTags(result, data)
  
  return result
}

/**
 * Process conditional blocks in the template
 * Supports: {{#if field_name}}...{{/if}}
 * And: {{#if field_name equals "value"}}...{{/if}}
 */
function processConditionalBlocks(template: string, data: MergeTagData): string {
  let result = template
  
  // Match conditional blocks with equals comparison
  // {{#if field_name equals "value"}}content{{/if}}
  const equalsPattern = /\{\{#if\s+(\w+)\s+equals\s+"([^"]+)"\}\}([\s\S]*?)\{\{\/if\}\}/gi
  result = result.replace(equalsPattern, (match, fieldName, expectedValue, content) => {
    const actualValue = getFieldValue(fieldName, data)
    if (actualValue === expectedValue) {
      return content
    }
    return ''
  })
  
  // Match conditional blocks with not equals comparison
  // {{#if field_name not_equals "value"}}content{{/if}}
  const notEqualsPattern = /\{\{#if\s+(\w+)\s+not_equals\s+"([^"]+)"\}\}([\s\S]*?)\{\{\/if\}\}/gi
  result = result.replace(notEqualsPattern, (match, fieldName, expectedValue, content) => {
    const actualValue = getFieldValue(fieldName, data)
    if (actualValue !== expectedValue) {
      return content
    }
    return ''
  })
  
  // Match simple conditional blocks (truthy check)
  // {{#if field_name}}content{{/if}}
  const truthyPattern = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/gi
  result = result.replace(truthyPattern, (match, fieldName, content) => {
    const value = getFieldValue(fieldName, data)
    if (value && value !== '') {
      return content
    }
    return ''
  })
  
  // Match unless blocks (falsy check)
  // {{#unless field_name}}content{{/unless}}
  const unlessPattern = /\{\{#unless\s+(\w+)\}\}([\s\S]*?)\{\{\/unless\}\}/gi
  result = result.replace(unlessPattern, (match, fieldName, content) => {
    const value = getFieldValue(fieldName, data)
    if (!value || value === '') {
      return content
    }
    return ''
  })
  
  return result
}

/**
 * Replace simple merge tags
 * Supports: {{field_name}} and {{field_name|fallback}}
 */
function replaceSimpleTags(template: string, data: MergeTagData): string {
  // Match tags with optional fallback: {{field_name}} or {{field_name|fallback}}
  const tagPattern = /\{\{(\w+)(?:\|([^}]+))?\}\}/g
  
  return template.replace(tagPattern, (match, fieldName, fallback) => {
    const value = getFieldValue(fieldName, data)
    
    if (value !== null && value !== undefined && value !== '') {
      return formatValue(value)
    }
    
    // Use fallback if provided
    if (fallback !== undefined) {
      return fallback
    }
    
    // Return empty string if no value and no fallback
    return ''
  })
}

/**
 * Get field value from data object
 */
function getFieldValue(fieldName: string, data: MergeTagData): string | number | boolean | null | undefined {
  // Direct field lookup
  if (fieldName in data) {
    return data[fieldName]
  }
  
  // Handle snake_case to camelCase conversion
  const camelCase = fieldName.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
  if (camelCase in data) {
    return data[camelCase as keyof MergeTagData]
  }
  
  return undefined
}

/**
 * Format value for display
 */
function formatValue(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) {
    return ''
  }
  
  if (typeof value === 'number') {
    // Format currency if it looks like a monetary value
    if (Number.isInteger(value) || value.toString().includes('.')) {
      return new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value)
    }
    return value.toString()
  }
  
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }
  
  return String(value)
}

/**
 * Preview merge tags with sample data
 */
export function previewMergeTags(template: string): string {
  const sampleData: MergeTagData = {
    first_name: 'John',
    last_name: 'Smith',
    email: 'john.smith@example.com',
    phone: '+44 7700 900123',
    deal_title: 'John Smith',
    deal_value: 5000,
    deal_stage: 'Initial Contact',
    deal_pipeline: 'UK GAP 2026',
    deal_owner_name: 'Nathan Recruiter',
    deal_owner_email: 'nathan@ifg.com',
    deal_owner_phone: '+44 7700 900456',
    deal_owner_calendly: 'https://calendly.com/nathan-ifg',
    deal_owner_signature: 'Best regards,<br>Nathan Recruiter<br>International Football Group',
  }
  
  return replaceMergeTags(template, sampleData)
}

/**
 * Validate merge tags in a template
 * Returns list of invalid/unknown tags
 */
export function validateMergeTags(template: string): string[] {
  const validTags = MERGE_TAGS.map(t => t.tag.replace(/[{}]/g, ''))
  const invalidTags: string[] = []
  
  // Find all tags in template
  const tagPattern = /\{\{(\w+)(?:\|[^}]+)?\}\}/g
  let match
  
  while ((match = tagPattern.exec(template)) !== null) {
    const tagName = match[1]
    if (!validTags.includes(tagName)) {
      invalidTags.push(tagName)
    }
  }
  
  return [...new Set(invalidTags)]
}

/**
 * Extract all merge tags used in a template
 */
export function extractMergeTags(template: string): string[] {
  const tags: string[] = []
  const tagPattern = /\{\{(\w+)(?:\|[^}]+)?\}\}/g
  let match
  
  while ((match = tagPattern.exec(template)) !== null) {
    tags.push(match[1])
  }
  
  return [...new Set(tags)]
}

/**
 * Check if template contains any merge tags
 */
export function hasMergeTags(template: string): boolean {
  return /\{\{[\w|]+\}\}/.test(template)
}
