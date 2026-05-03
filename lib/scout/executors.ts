// Server-side executors for the Scout tool registry.
//
// Each executor takes the parsed tool arguments and returns a JSON-serialisable
// result that gets fed back to OpenAI as the `tool` message. Errors should be
// returned as `{ error: string }` objects (NOT thrown) — the model handles
// "tool failed, try something else" much better than it handles a stack trace.
//
// Data access goes through `runQuery` so we can swap supabase-js for `pg` /
// drizzle / prisma later (the AWS-RDS migration the client has on the roadmap)
// without touching any executor body.

import { createClient } from '@supabase/supabase-js'
import { SCOUT_TOOL_NAMES } from './tools'

// ---------------------------------------------------------------------------
// Data-access seam. supabase-js today; swap to `pg` against RDS later.
// Keep the surface tiny: select-from-view with optional filters/order/limit.
// ---------------------------------------------------------------------------

type AdminClient = ReturnType<typeof createClient>

function getAdmin(): AdminClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Supabase env vars missing for Scout admin client')
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

// One-stop runner so executors don't repeat the supabase-js shape. If a
// filter value is null/undefined/'' the filter is dropped so the LLM can pass
// partial argument objects safely.
type FilterMap = Array<
  | { type: 'eq'; column: string; value: string | number | boolean }
  | { type: 'ilike'; column: string; pattern: string }
  | { type: 'gte'; column: string; value: string | number }
  | { type: 'lte'; column: string; value: string | number }
  | { type: 'or'; expr: string }
  | { type: 'is_null'; column: string; isNull: boolean }
>

interface RunQueryOptions {
  view: string
  select?: string
  filters?: FilterMap
  orderBy?: { column: string; ascending: boolean }
  limit?: number
}

async function runQuery({
  view,
  select = '*',
  filters = [],
  orderBy,
  limit = 25,
}: RunQueryOptions) {
  const admin = getAdmin()
  let q = admin.from(view).select(select)
  for (const f of filters) {
    if (f.type === 'eq') q = q.eq(f.column, f.value)
    else if (f.type === 'ilike') q = q.ilike(f.column, f.pattern)
    else if (f.type === 'gte') q = q.gte(f.column, f.value)
    else if (f.type === 'lte') q = q.lte(f.column, f.value)
    else if (f.type === 'or') q = q.or(f.expr)
    else if (f.type === 'is_null') q = f.isNull ? q.is(f.column, null) : q.not(f.column, 'is', null)
  }
  if (orderBy) q = q.order(orderBy.column, { ascending: orderBy.ascending })
  q = q.limit(Math.min(Math.max(limit, 1), 200))
  const { data, error } = await q
  if (error) return { error: error.message }
  return { rows: data, count: data?.length ?? 0 }
}

// ---------------------------------------------------------------------------
// Argument-shape utility helpers
// ---------------------------------------------------------------------------

type Args = Record<string, unknown>

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined
const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined
const bool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined)

function paginationFromArgs(args: Args, defaultOrder: { column: string; ascending: boolean }) {
  const limit = num(args.limit) ?? 25
  const orderColumn = str(args.order_by) ?? defaultOrder.column
  const ascending =
    str(args.order_dir) === 'asc'
      ? true
      : str(args.order_dir) === 'desc'
        ? false
        : defaultOrder.ascending
  return { limit, orderBy: { column: orderColumn, ascending } }
}

function ilikePattern(s: string) {
  // Wrap with %, escape user-supplied %/_ to literal so partial input doesn't
  // accidentally widen the match.
  return `%${s.replace(/[%_]/g, (c) => `\\${c}`)}%`
}

// ---------------------------------------------------------------------------
// Executors
// ---------------------------------------------------------------------------

async function execQueryContacts(args: Args) {
  const filters: FilterMap = []
  const search = str(args.search)
  if (search) {
    const p = ilikePattern(search)
    filters.push({
      type: 'or',
      expr: [
        `first_name.ilike.${p}`,
        `last_name.ilike.${p}`,
        `email.ilike.${p}`,
        `phone.ilike.${p}`,
        `club_name.ilike.${p}`,
      ].join(','),
    })
  }
  const country = str(args.country)
  if (country) filters.push({ type: 'ilike', column: 'country', pattern: ilikePattern(country) })
  const position = str(args.position)
  if (position) filters.push({ type: 'ilike', column: 'position', pattern: ilikePattern(position) })
  const source = str(args.source)
  if (source) filters.push({ type: 'eq', column: 'source', value: source })
  const owner = str(args.owner_user_id)
  if (owner) filters.push({ type: 'eq', column: 'owner_id', value: owner })
  const sub = str(args.subscription_status)
  if (sub) filters.push({ type: 'eq', column: 'subscription_status', value: sub })
  const createdAfter = str(args.created_after)
  if (createdAfter) filters.push({ type: 'gte', column: 'created_at', value: createdAfter })

  return runQuery({
    view: 'v_scout_contacts',
    filters,
    ...paginationFromArgs(args, { column: 'created_at', ascending: false }),
  })
}

async function execQueryDeals(args: Args) {
  const filters: FilterMap = []
  const search = str(args.search)
  if (search) {
    const p = ilikePattern(search)
    filters.push({
      type: 'or',
      expr: [`title.ilike.${p}`, `contact_name.ilike.${p}`].join(','),
    })
  }
  const pipelineId = str(args.pipeline_id)
  if (pipelineId) filters.push({ type: 'eq', column: 'pipeline_id', value: pipelineId })
  const pipelineName = str(args.pipeline_name)
  if (pipelineName)
    filters.push({ type: 'ilike', column: 'pipeline_name', pattern: ilikePattern(pipelineName) })
  const stageId = str(args.stage_id)
  if (stageId) filters.push({ type: 'eq', column: 'stage_id', value: stageId })
  const stageName = str(args.stage_name)
  if (stageName)
    filters.push({ type: 'ilike', column: 'stage_name', pattern: ilikePattern(stageName) })
  const ownerId = str(args.owner_user_id)
  if (ownerId) filters.push({ type: 'eq', column: 'deal_owner_id', value: ownerId })
  const ownerName = str(args.owner_name)
  if (ownerName)
    filters.push({ type: 'ilike', column: 'deal_owner_name', pattern: ilikePattern(ownerName) })
  const contactId = str(args.contact_id)
  if (contactId) filters.push({ type: 'eq', column: 'contact_id', value: contactId })
  const status = str(args.status)
  if (status) filters.push({ type: 'eq', column: 'status', value: status })
  const intent = str(args.intent)
  if (intent) filters.push({ type: 'eq', column: 'intent', value: intent })
  const minDays = num(args.min_days_in_stage)
  if (minDays !== undefined)
    filters.push({ type: 'gte', column: 'days_in_current_stage', value: minDays })

  return runQuery({
    view: 'v_scout_deals',
    filters,
    ...paginationFromArgs(args, { column: 'created_at', ascending: false }),
  })
}

async function execQueryInvoices(args: Args) {
  const filters: FilterMap = []
  const search = str(args.search)
  if (search) {
    const p = ilikePattern(search)
    filters.push({
      type: 'or',
      expr: [
        `invoice_number.ilike.${p}`,
        `contact_name.ilike.${p}`,
        `deal_title.ilike.${p}`,
      ].join(','),
    })
  }
  const status = str(args.status)
  if (status) filters.push({ type: 'eq', column: 'status', value: status })
  const contactId = str(args.contact_id)
  if (contactId) filters.push({ type: 'eq', column: 'contact_id', value: contactId })
  const dealId = str(args.deal_id)
  if (dealId) filters.push({ type: 'eq', column: 'deal_id', value: dealId })
  const pipelineName = str(args.pipeline_name)
  if (pipelineName)
    filters.push({ type: 'ilike', column: 'pipeline_name', pattern: ilikePattern(pipelineName) })
  if (bool(args.unpaid_only)) filters.push({ type: 'is_null', column: 'paid_at', isNull: true })
  if (bool(args.overdue_only)) filters.push({ type: 'gte', column: 'days_overdue', value: 1 })
  const minAmount = num(args.min_amount)
  if (minAmount !== undefined) filters.push({ type: 'gte', column: 'amount', value: minAmount })

  return runQuery({
    view: 'v_scout_invoices',
    filters,
    ...paginationFromArgs(args, { column: 'created_at', ascending: false }),
  })
}

async function execQueryAutomations(args: Args) {
  const filters: FilterMap = []
  const search = str(args.search)
  if (search) {
    const p = ilikePattern(search)
    filters.push({
      type: 'or',
      expr: [`name.ilike.${p}`, `description.ilike.${p}`].join(','),
    })
  }
  const pipelineName = str(args.pipeline_name)
  if (pipelineName)
    filters.push({ type: 'ilike', column: 'pipeline_name', pattern: ilikePattern(pipelineName) })
  const triggerType = str(args.trigger_type)
  if (triggerType) filters.push({ type: 'eq', column: 'trigger_type', value: triggerType })
  const automationType = str(args.automation_type)
  if (automationType) filters.push({ type: 'eq', column: 'automation_type', value: automationType })
  const isActive = bool(args.is_active)
  if (isActive !== undefined) filters.push({ type: 'eq', column: 'is_active', value: isActive })

  return runQuery({
    view: 'v_scout_automations',
    filters,
    ...paginationFromArgs(args, { column: 'last_enrolled_at', ascending: false }),
  })
}

async function execQueryPipelineState(args: Args) {
  const filters: FilterMap = []
  const pipelineId = str(args.pipeline_id)
  if (pipelineId) filters.push({ type: 'eq', column: 'pipeline_id', value: pipelineId })
  const pipelineName = str(args.pipeline_name)
  if (pipelineName)
    filters.push({ type: 'ilike', column: 'pipeline_name', pattern: ilikePattern(pipelineName) })
  if (bool(args.only_active))
    filters.push({ type: 'eq', column: 'pipeline_active', value: true })
  return runQuery({
    view: 'v_scout_pipeline_state',
    filters,
    orderBy: { column: 'pipeline_name', ascending: true },
    limit: 200,
  })
}

async function execQueryLists(args: Args) {
  const filters: FilterMap = []
  const search = str(args.search)
  if (search) {
    const p = ilikePattern(search)
    filters.push({
      type: 'or',
      expr: [`name.ilike.${p}`, `description.ilike.${p}`].join(','),
    })
  }
  const isDynamic = bool(args.is_dynamic)
  if (isDynamic !== undefined) filters.push({ type: 'eq', column: 'is_dynamic', value: isDynamic })
  return runQuery({
    view: 'v_scout_lists',
    filters,
    ...paginationFromArgs(args, { column: 'updated_at', ascending: false }),
  })
}

async function execQueryListMembers(args: Args) {
  const admin = getAdmin()
  let listId = str(args.list_id) ?? null
  if (!listId) {
    const listName = str(args.list_name)
    if (!listName) return { error: 'Either list_id or list_name is required.' }
    const { data: list, error } = await admin
      .from('v_scout_lists')
      .select('id, name')
      .ilike('name', listName)
      .maybeSingle()
    if (error) return { error: error.message }
    if (!list) return { error: `No list found matching "${listName}".` }
    listId = (list as { id: string }).id
  }

  // Two-step: list_id → contact_ids via contact_lists, then v_scout_contacts.
  const { data: memberships, error: mErr } = await admin
    .from('contact_lists')
    .select('contact_id')
    .eq('list_id', listId)
    .limit(num(args.limit) ?? 25)
  if (mErr) return { error: mErr.message }
  const ids = ((memberships ?? []) as { contact_id: string }[]).map((m) => m.contact_id)
  if (ids.length === 0) return { rows: [], count: 0 }

  const { data: contacts, error: cErr } = await admin
    .from('v_scout_contacts')
    .select('id, full_name, email, phone, country, position')
    .in('id', ids)
  if (cErr) return { error: cErr.message }
  return { rows: contacts ?? [], count: contacts?.length ?? 0 }
}

async function execQueryCommunications(args: Args) {
  const filters: FilterMap = []
  const contactId = str(args.contact_id)
  if (contactId) filters.push({ type: 'eq', column: 'contact_id', value: contactId })
  const channel = str(args.channel)
  if (channel) filters.push({ type: 'eq', column: 'channel', value: channel })
  const intent = str(args.intent)
  if (intent) filters.push({ type: 'eq', column: 'intent', value: intent })
  const search = str(args.search)
  if (search) {
    const p = ilikePattern(search)
    filters.push({
      type: 'or',
      expr: [`subject.ilike.${p}`, `body_preview.ilike.${p}`].join(','),
    })
  }
  const since = str(args.since)
  if (since) filters.push({ type: 'gte', column: 'occurred_at', value: since })
  return runQuery({
    view: 'v_scout_communications',
    filters,
    ...paginationFromArgs(args, { column: 'occurred_at', ascending: false }),
  })
}

async function execQueryFormSubmissions(args: Args) {
  const filters: FilterMap = []
  const formId = str(args.form_id)
  if (formId) filters.push({ type: 'eq', column: 'form_id', value: formId })
  const formSource = str(args.form_source)
  if (formSource) filters.push({ type: 'eq', column: 'form_source', value: formSource })
  const status = str(args.status)
  if (status) filters.push({ type: 'eq', column: 'status', value: status })
  const since = str(args.since)
  if (since) filters.push({ type: 'gte', column: 'created_at', value: since })
  const contactId = str(args.contact_id)
  if (contactId) filters.push({ type: 'eq', column: 'contact_id', value: contactId })
  return runQuery({
    view: 'v_scout_form_submissions',
    filters,
    ...paginationFromArgs(args, { column: 'created_at', ascending: false }),
  })
}

async function execQueryCalendar(args: Args) {
  const filters: FilterMap = []
  const timeState = str(args.time_state)
  if (timeState) filters.push({ type: 'eq', column: 'time_state', value: timeState })
  const userId = str(args.user_id)
  if (userId) filters.push({ type: 'eq', column: 'user_id', value: userId })
  const contactId = str(args.contact_id)
  if (contactId) filters.push({ type: 'eq', column: 'contact_id', value: contactId })
  const since = str(args.since)
  if (since) filters.push({ type: 'gte', column: 'start_time', value: since })
  const until = str(args.until)
  if (until) filters.push({ type: 'lte', column: 'start_time', value: until })
  return runQuery({
    view: 'v_scout_calendar',
    filters,
    ...paginationFromArgs(args, { column: 'start_time', ascending: false }),
  })
}

async function execQueryUsers(args: Args) {
  const filters: FilterMap = []
  const search = str(args.search)
  if (search) {
    const p = ilikePattern(search)
    filters.push({
      type: 'or',
      expr: [`full_name.ilike.${p}`, `email.ilike.${p}`].join(','),
    })
  }
  const role = str(args.role)
  if (role) filters.push({ type: 'eq', column: 'role', value: role })
  const isActive = bool(args.is_active)
  if (isActive !== undefined) filters.push({ type: 'eq', column: 'is_active', value: isActive })
  const portalActivated = bool(args.portal_activated)
  if (portalActivated !== undefined)
    filters.push({ type: 'eq', column: 'portal_activated', value: portalActivated })
  return runQuery({
    view: 'v_scout_users',
    filters,
    ...paginationFromArgs(args, { column: 'created_at', ascending: false }),
  })
}

async function execQueryKnowledge(args: Args) {
  const admin = getAdmin()
  const slug = str(args.slug)
  const search = str(args.search)
  const tag = str(args.tag)
  const limit = Math.min(Math.max(num(args.limit) ?? 5, 1), 10)

  // Direct slug lookup wins — used when the model already knows which article
  // it wants (citations from a previous turn, etc.).
  if (slug) {
    const { data, error } = await admin
      .from('scout_knowledge_articles')
      .select('id, slug, title, body_md, tags, updated_at')
      .eq('slug', slug)
      .maybeSingle()
    if (error) return { error: error.message }
    if (!data) return { rows: [], count: 0 }
    return { rows: [data], count: 1 }
  }

  let q = admin
    .from('scout_knowledge_articles')
    .select('id, slug, title, body_md, tags, updated_at')
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (search) {
    const p = ilikePattern(search)
    q = q.or(`title.ilike.${p},body_md.ilike.${p}`)
  }
  if (tag) {
    q = q.contains('tags', [tag])
  }

  const { data, error } = await q
  if (error) return { error: error.message }
  return { rows: data ?? [], count: data?.length ?? 0 }
}

async function execQueryMetrics() {
  const admin = getAdmin()
  const { data, error } = await admin.from('v_scout_metrics').select('*').single()
  if (error) return { error: error.message }
  return data
}

// SQL escape hatch — the model can write arbitrary SELECTs, but we
// pre-validate and execute via a dedicated read-only RPC. Keeps the blast
// radius tiny: we never let the model write to a base table or auth.* even
// if it tries.
async function execExecuteReadonlySql(args: Args) {
  const sql = str(args.sql)
  if (!sql) return { error: 'sql argument is required' }
  const validation = validateReadonlyScoutSql(sql)
  if (!validation.ok) return { error: validation.reason }

  const admin = getAdmin()
  // The custom RPC isn't in the generated types; cast to bypass the
  // typed-RPC overload. Param shape is enforced server-side by the function
  // signature anyway.
  const rpc = admin.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>
  const { data, error } = await rpc('scout_run_readonly_sql', { p_sql: sql })
  if (error) return { error: error.message }
  // The RPC returns JSON (rows array). Trim if absurdly large.
  const rows = Array.isArray(data) ? (data as unknown[]).slice(0, 200) : data
  return { rows, count: Array.isArray(rows) ? rows.length : null }
}

const ALLOWED_VIEWS = [
  'v_scout_users',
  'v_scout_contacts',
  'v_scout_deals',
  'v_scout_invoices',
  'v_scout_automations',
  'v_scout_pipeline_state',
  'v_scout_lists',
  'v_scout_communications',
  'v_scout_form_submissions',
  'v_scout_calendar',
  'v_scout_metrics',
]

const FORBIDDEN_KEYWORDS = [
  /\bINSERT\b/i,
  /\bUPDATE\b/i,
  /\bDELETE\b/i,
  /\bDROP\b/i,
  /\bALTER\b/i,
  /\bCREATE\b/i,
  /\bGRANT\b/i,
  /\bREVOKE\b/i,
  /\bTRUNCATE\b/i,
  /\bCOPY\b/i,
  /\bVACUUM\b/i,
  /\bCALL\b/i,
  /\bEXECUTE\b/i,
  /;\s*\S/, // multiple statements
  /\bpg_/i, // system catalogs
  /\bauth\./i, // auth schema
  /\binformation_schema\b/i,
]

export function validateReadonlyScoutSql(sql: string): { ok: boolean; reason: string } {
  const trimmed = sql.trim().replace(/;\s*$/, '')
  const head = trimmed.slice(0, 200).toLowerCase()
  if (!head.startsWith('select') && !head.startsWith('with ')) {
    return { ok: false, reason: 'SQL must start with SELECT or WITH ... SELECT.' }
  }
  for (const pat of FORBIDDEN_KEYWORDS) {
    if (pat.test(trimmed)) {
      return { ok: false, reason: `Forbidden keyword/pattern: ${pat}` }
    }
  }
  // Must reference at least one allowed view, must NOT reference any other table.
  const referenced = trimmed.match(/\b[a-z_][a-z0-9_]*\b/gi) ?? []
  const tableTokens = referenced.filter((t) => /^v_scout_/i.test(t))
  if (tableTokens.length === 0) {
    return { ok: false, reason: 'Query must reference at least one v_scout_* view.' }
  }
  for (const t of tableTokens) {
    if (!ALLOWED_VIEWS.includes(t.toLowerCase())) {
      return { ok: false, reason: `Disallowed view: ${t}` }
    }
  }
  return { ok: true, reason: '' }
}

// ---------------------------------------------------------------------------
// save_memory — persists a durable fact for the calling super_admin.
// Most executors are pure read-only views; this is the one write-capable tool
// in Scout's surface, deliberately scoped to the caller's own row via ctx.userId.
// ---------------------------------------------------------------------------

interface SaveMemoryArgs {
  content?: string
  reason?: string
}

async function execSaveMemory(args: SaveMemoryArgs, ctx: ScoutToolContext) {
  if (!ctx.userId) return { error: 'No user context available — cannot save memory.' }
  const content = (args.content ?? '').trim()
  if (!content) return { error: 'content is required' }
  if (content.length > 2000) return { error: 'content too long (max 2000 chars)' }

  const admin = getAdmin()
  // Generated Database types haven't been regenerated since migration 118,
  // so the typed admin client doesn't know about scout_memories yet. Untyped
  // here mirrors how scout_conversations / scout_messages are written.
  const { data, error } = await (admin as unknown as {
    from: (t: string) => {
      insert: (v: Record<string, unknown>) => {
        select: (s: string) => { single: () => Promise<{ data: unknown; error: { message: string } | null }> }
      }
    }
  })
    .from('scout_memories')
    .insert({ user_id: ctx.userId, content, source: 'auto' })
    .select('id, content, created_at')
    .single()
  if (error) return { error: error.message }
  return { saved: true, memory: data }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export interface ScoutToolContext {
  // The super_admin profile.id whose conversation triggered the tool. Used by
  // save_memory to scope writes; read-only executors ignore it.
  userId: string
}

export async function executeScoutTool(
  name: string,
  args: Args,
  ctx: ScoutToolContext = { userId: '' },
): Promise<unknown> {
  if (!SCOUT_TOOL_NAMES.includes(name)) {
    return { error: `Unknown tool: ${name}` }
  }
  try {
    switch (name) {
      case 'query_contacts':
        return await execQueryContacts(args)
      case 'query_deals':
        return await execQueryDeals(args)
      case 'query_invoices':
        return await execQueryInvoices(args)
      case 'query_automations':
        return await execQueryAutomations(args)
      case 'query_pipeline_state':
        return await execQueryPipelineState(args)
      case 'query_lists':
        return await execQueryLists(args)
      case 'query_list_members':
        return await execQueryListMembers(args)
      case 'query_communications':
        return await execQueryCommunications(args)
      case 'query_form_submissions':
        return await execQueryFormSubmissions(args)
      case 'query_calendar':
        return await execQueryCalendar(args)
      case 'query_users':
        return await execQueryUsers(args)
      case 'query_metrics':
        return await execQueryMetrics()
      case 'query_knowledge':
        return await execQueryKnowledge(args)
      case 'save_memory':
        return await execSaveMemory(args as SaveMemoryArgs, ctx)
      case 'execute_readonly_sql':
        return await execExecuteReadonlySql(args)
      default:
        return { error: `Tool ${name} has no executor` }
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown executor error' }
  }
}
