// OpenAI tool schemas for Scout. The shape mirrors the
// `chat.completions.create({ tools: [...] })` parameter exactly so we can
// pass this array straight in.
//
// Every tool reads from a `v_scout_*` view (see migration 113) and never
// touches base tables directly. The whole point of the views is to make
// the surface area predictable — the LLM should only ever need columns
// that show up here.

import type { ChatCompletionTool } from 'openai/resources/chat/completions'

// ---------------------------------------------------------------------------
// JSON-schema helpers — keep tool definitions readable.
// ---------------------------------------------------------------------------

const stringField = (description: string) => ({
  type: 'string' as const,
  description,
})

const numberField = (description: string) => ({
  type: 'number' as const,
  description,
})

const booleanField = (description: string) => ({
  type: 'boolean' as const,
  description,
})

const enumField = (values: string[], description: string) => ({
  type: 'string' as const,
  enum: values,
  description,
})

// Standard pagination/limit fields we attach to most query_* tools.
const paginationFields = {
  limit: {
    type: 'integer' as const,
    minimum: 1,
    maximum: 200,
    default: 25,
    description: 'Max rows to return. Defaults to 25.',
  },
  order_by: stringField(
    'Column to sort by. If unset, the tool picks a sensible default (usually created_at desc).',
  ),
  order_dir: enumField(['asc', 'desc'], 'Sort direction (default desc).'),
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const SCOUT_TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'query_contacts',
      description:
        "Search the contacts table (people / players / leads). Returns name, email, phone, location, guardian info, custom fields, owner, and counts of related deals/invoices/lists. Use this for questions like 'who is X', 'what's their email', 'who's their guardian', 'show me contacts from Country Y'.",
      parameters: {
        type: 'object',
        properties: {
          search: stringField(
            'Free-text search across first_name, last_name, email, phone, club_name. Case-insensitive. Optional.',
          ),
          country: stringField('Filter by country (case-insensitive substring match).'),
          position: stringField('Filter by football position.'),
          source: stringField("Filter by acquisition source (e.g. 'website_form', 'manual')."),
          owner_user_id: stringField('Filter to contacts owned by this profile/user UUID.'),
          subscription_status: enumField(
            ['subscribed', 'unsubscribed', 'bounced'],
            'Filter by subscription status.',
          ),
          created_after: stringField(
            'ISO timestamp: only return contacts created after this time.',
          ),
          ...paginationFields,
        },
        additionalProperties: false,
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'query_deals',
      description:
        "Search the deals table. Each row already includes the contact name, pipeline name, stage name, deal owner name, intent, and time-in-stage. Use this for 'who's in pipeline X', 'show me deals in stage Y', 'who's stuck in interview', 'what deals does user X own', 'show me positive-intent deals'.",
      parameters: {
        type: 'object',
        properties: {
          search: stringField('Free-text match on deal title or contact name. Optional.'),
          pipeline_id: stringField('Filter by pipeline UUID.'),
          pipeline_name: stringField(
            "Filter by pipeline name (substring, case-insensitive). Use this when the user names the pipeline rather than knowing its UUID.",
          ),
          stage_id: stringField('Filter by stage UUID.'),
          stage_name: stringField('Filter by stage name (substring, case-insensitive).'),
          owner_user_id: stringField('Filter to deals owned by this user UUID.'),
          owner_name: stringField('Filter to deals owned by a user whose name matches.'),
          contact_id: stringField('Filter to a specific contact UUID.'),
          status: enumField(['open', 'won', 'lost'], 'Filter by deal status.'),
          intent: enumField(
            ['positive', 'negative', 'neutral', 'question', 'unsubscribe'],
            'Filter by AI-tagged intent on the latest reply.',
          ),
          min_days_in_stage: numberField('Minimum days the deal has been in its current stage.'),
          ...paginationFields,
        },
        additionalProperties: false,
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'query_invoices',
      description:
        "Search invoices. Each row includes contact name, deal title, pipeline, status, due_date, paid_at, and a computed days_overdue. Use this for 'who paid invoice X', 'who's overdue', 'how much have we billed for Y pipeline', 'show me unpaid deposits'.",
      parameters: {
        type: 'object',
        properties: {
          search: stringField('Free-text match on invoice number, contact name, or deal title.'),
          status: enumField(
            ['draft', 'sent', 'paid', 'overdue', 'cancelled', 'refunded'],
            'Filter by invoice status.',
          ),
          contact_id: stringField('Filter to a specific contact UUID.'),
          deal_id: stringField('Filter to a specific deal UUID.'),
          pipeline_name: stringField('Filter to invoices on deals in a pipeline (name substring).'),
          unpaid_only: booleanField('Only return invoices where paid_at IS NULL.'),
          overdue_only: booleanField('Only return invoices where days_overdue > 0.'),
          min_amount: numberField('Minimum invoice amount.'),
          ...paginationFields,
        },
        additionalProperties: false,
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'query_automations',
      description:
        "List automations. Returns name, type, trigger, pipeline + stage names, active/completed/total enrollment counts, and last_enrolled_at. Use this for 'what automations are running on pipeline X', 'is automation Y active', 'how many deals are enrolled in Z'.",
      parameters: {
        type: 'object',
        properties: {
          search: stringField('Free-text search on automation name or description.'),
          pipeline_name: stringField('Filter by pipeline name (substring).'),
          trigger_type: enumField(
            [
              'enters_stage',
              'stage_change',
              'form_submission',
              'invoice_created',
              'invoice_overdue',
              'payment_received',
              'manual',
              'time_based',
            ],
            'Filter by trigger type.',
          ),
          automation_type: stringField(
            'Filter by automation_type (e.g. deal_creation, initial_contact, deposit_invoice).',
          ),
          is_active: booleanField('Only return active (true) or paused (false) automations.'),
          ...paginationFields,
        },
        additionalProperties: false,
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'query_pipeline_state',
      description:
        "Per-stage breakdown of every pipeline: deal_count, positive/negative intent counts, avg/max days in stage. Use this for 'what's the state of pipeline X', 'where's the bottleneck', 'how many deals are in each stage'.",
      parameters: {
        type: 'object',
        properties: {
          pipeline_id: stringField('Filter to a specific pipeline UUID.'),
          pipeline_name: stringField('Filter to pipelines whose name matches (substring).'),
          only_active: booleanField('Only include pipelines where pipeline_active = true.'),
        },
        additionalProperties: false,
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'query_lists',
      description:
        "List the contact lists (static + dynamic) with their member counts. Use this for 'what lists do we have', 'how many people are in list X'.",
      parameters: {
        type: 'object',
        properties: {
          search: stringField('Filter by list name or description (substring).'),
          is_dynamic: booleanField('true = rule-based dynamic lists, false = static lists.'),
          ...paginationFields,
        },
        additionalProperties: false,
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'query_list_members',
      description:
        "Given a list_id (or list name), return the contacts on that list. Use this when the user asks 'who's on list X'.",
      parameters: {
        type: 'object',
        properties: {
          list_id: stringField('UUID of the list. Either this or list_name is required.'),
          list_name: stringField('Name of the list (exact match, case-insensitive).'),
          ...paginationFields,
        },
        additionalProperties: false,
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'query_communications',
      description:
        "Unified email + SMS timeline (sent + replies). Each row has channel, contact_id, counterpart, subject/body_preview, intent, occurred_at. Use this for 'what did contact X reply', 'show me recent inbound', 'who replied negatively this week'.",
      parameters: {
        type: 'object',
        properties: {
          contact_id: stringField('Filter to a specific contact UUID.'),
          channel: enumField(
            ['email_send', 'email_reply', 'sms'],
            'Filter to one channel.',
          ),
          intent: enumField(
            ['positive', 'negative', 'neutral', 'question', 'unsubscribe'],
            'Filter email replies by AI-tagged intent.',
          ),
          search: stringField('Free-text match on subject or body_preview.'),
          since: stringField('ISO timestamp: only events after this time.'),
          ...paginationFields,
        },
        additionalProperties: false,
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'query_form_submissions',
      description:
        "Recent inbound form submissions (website forms, ActiveCampaign, etc.). Each row has form_id, contact, deal outcome, automation that fired, assignee. Use this for 'what came in from the website', 'how many Summer Residency submissions this week', 'why didn't form X create a deal'.",
      parameters: {
        type: 'object',
        properties: {
          form_id: stringField('Filter by form_id (e.g. masters, gap, uclan_2026).'),
          form_source: stringField("Filter by form_source (e.g. 'activecampaign', 'wordpress')."),
          status: enumField(['pending', 'processed', 'failed'], 'Filter by submission status.'),
          since: stringField('ISO timestamp: only submissions after this time.'),
          contact_id: stringField('Filter to a specific contact UUID.'),
          ...paginationFields,
        },
        additionalProperties: false,
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'query_calendar',
      description:
        "Calendly meetings: contact, recruiter, start/end time, status, time_state (upcoming/past/in_progress). Use this for 'what meetings are coming up', 'who has user X met with', 'past interviews this week'.",
      parameters: {
        type: 'object',
        properties: {
          time_state: enumField(
            ['upcoming', 'past', 'in_progress'],
            'Filter to upcoming, past, or in-progress meetings.',
          ),
          user_id: stringField('Filter to meetings owned by this user UUID.'),
          contact_id: stringField('Filter to meetings with a specific contact UUID.'),
          since: stringField('ISO timestamp: only meetings starting after this time.'),
          until: stringField('ISO timestamp: only meetings starting before this time.'),
          ...paginationFields,
        },
        additionalProperties: false,
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'query_users',
      description:
        "Look up CRM user profiles (recruiters, super_admins, players, guardians). Returns name, email, phone, role, calendly_url, portal_activated. Excludes secrets like access tokens. Use this for 'who is X', 'show me all recruiters', 'has player Y activated their portal'.",
      parameters: {
        type: 'object',
        properties: {
          search: stringField('Free-text match on full_name or email.'),
          role: enumField(
            ['super_admin', 'admin', 'recruiter', 'player', 'guardian'],
            'Filter by role.',
          ),
          is_active: booleanField('Filter active vs deactivated users.'),
          portal_activated: booleanField('Players only: filter by whether they set a password.'),
          ...paginationFields,
        },
        additionalProperties: false,
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'query_metrics',
      description:
        "One-shot snapshot of platform-wide counts: total contacts/deals/invoices, deals last 7d, revenue paid vs outstanding, active automations, upcoming meetings, etc. Use this for 'how are we doing', 'give me an overview', 'what's the headline'.",
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'query_knowledge',
      description:
        "Search the platform's knowledge-base articles for longer-form documentation that goes beyond the system-prompt glossary. Use this for 'how does X work end-to-end', 'what's the policy for Y', anything where the user wants depth Scout doesn't already know. Returns title + tags + the article body so you can cite it.",
      parameters: {
        type: 'object',
        properties: {
          search: stringField(
            'Free-text search across article title, body, and tags. Optional — if omitted, returns most recently updated.',
          ),
          slug: stringField(
            "Fetch a specific article by its slug (e.g. 'smart-deal-flow'). Mutually exclusive with search.",
          ),
          tag: stringField('Filter to articles carrying this tag.'),
          limit: {
            type: 'integer' as const,
            minimum: 1,
            maximum: 10,
            default: 5,
            description: 'Max articles to return (default 5, max 10).',
          },
        },
        additionalProperties: false,
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'execute_readonly_sql',
      description:
        "Escape hatch for questions the structured tools don't cover. Run a read-only SELECT against the v_scout_* views ONLY. Allowed views: v_scout_contacts, v_scout_deals, v_scout_invoices, v_scout_automations, v_scout_pipeline_state, v_scout_lists, v_scout_communications, v_scout_form_submissions, v_scout_calendar, v_scout_users, v_scout_metrics. Use joins, GROUP BY, window functions freely. Do NOT reference base tables, auth schema, or system catalogs. Limit results.",
      parameters: {
        type: 'object',
        properties: {
          sql: stringField(
            'A single SELECT or WITH ... SELECT statement. Must reference only v_scout_* views. No INSERT/UPDATE/DELETE/DROP/ALTER/CREATE.',
          ),
          reason: stringField(
            'One sentence explaining why the structured tools are not enough for this question.',
          ),
        },
        required: ['sql', 'reason'],
        additionalProperties: false,
      },
    },
  },
]

// Names exported so the executor switch + tests stay in sync with the registry.
// ChatCompletionTool is a discriminated union (function | custom); the
// `type === 'function'` narrow exposes `function.name`.
export const SCOUT_TOOL_NAMES = SCOUT_TOOLS.flatMap((t) =>
  t.type === 'function' ? [t.function.name] : [],
) as ReadonlyArray<string>
