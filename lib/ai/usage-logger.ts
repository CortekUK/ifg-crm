// Logs one OpenAI completion's usage + cost into the
// openai_usage_logs table. Called from server routes immediately
// after a chat.completions call (success OR failure — failed calls
// still consume input tokens and we want to surface that).
//
// Pricing table is intentionally inline. OpenAI changes prices
// occasionally; when they do, bump these constants and any new rows
// will reflect the new cost. Historical rows keep their original
// cost_usd because we store it at log-time rather than re-deriving
// on read.

import { createClient as createServiceClient } from '@supabase/supabase-js'
import type OpenAI from 'openai'

// USD per 1k tokens. Derived from OpenAI's published prices for chat
// completion models. Conservative defaults — when a new model is
// added without an entry, we fall back to the GPT-4o tier so the
// dashboard underestimates cost rather than zeroes it out.
const PRICING: Record<string, { input: number; output: number }> = {
  // GPT-4 family
  'gpt-4o': { input: 0.005, output: 0.015 },
  'gpt-4o-2024-08-06': { input: 0.0025, output: 0.01 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4': { input: 0.03, output: 0.06 },
  // GPT-3.5
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
}
const FALLBACK_RATE = PRICING['gpt-4o']

export function priceCompletion(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const rate = PRICING[model] ?? FALLBACK_RATE
  const inputCost = (promptTokens / 1000) * rate.input
  const outputCost = (completionTokens / 1000) * rate.output
  // Round to 6 decimal places — matches the column scale.
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000
}

export interface LogOpenAIUsageInput {
  feature: string
  model: string
  // The whole `usage` object from chat.completions response — pluck
  // tokens off it. Optional; if undefined we log zeros (e.g. for a
  // failed call that never produced a response).
  usage?: OpenAI.Completions.CompletionUsage | OpenAI.CompletionUsage | null
  startedAt?: number // performance.now() reading at request start
  error?: string | null
  userId?: string | null
}

// Service-role client — bypasses RLS so server routes can write
// regardless of who triggered the call. The select policy still gates
// reads to super_admin only.
function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    // Loud server-log so we don't silently lose usage data when the
    // service-role env var is missing (e.g. preview deployment).
    console.warn(
      '[logOpenAIUsage] missing Supabase env — usage rows will not be written',
      { hasUrl: !!url, hasKey: !!key },
    )
  }
  return createServiceClient(url ?? '', key ?? '', {
    auth: { persistSession: false },
  })
}

export async function logOpenAIUsage(input: LogOpenAIUsageInput): Promise<void> {
  try {
    const promptTokens = input.usage?.prompt_tokens ?? 0
    const completionTokens = input.usage?.completion_tokens ?? 0
    const totalTokens = input.usage?.total_tokens ?? promptTokens + completionTokens
    const cost = priceCompletion(input.model, promptTokens, completionTokens)
    const latency = input.startedAt
      ? Math.max(0, Math.round(performance.now() - input.startedAt))
      : null

    const admin = getAdmin()
    const { error: insertError } = await admin
      .from('openai_usage_logs')
      .insert({
        feature: input.feature,
        model: input.model,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
        cost_usd: cost,
        latency_ms: latency,
        error: input.error ?? null,
        user_id: input.userId ?? null,
      })
    if (insertError) {
      // Surface the insert failure with detail so we can fix any
      // RLS / column / permission issues. Doesn't throw — we don't
      // want logging problems to break the user's AI call.
      console.error('[logOpenAIUsage] insert failed:', insertError, {
        feature: input.feature,
        model: input.model,
      })
    }
  } catch (e) {
    // Logging failures should never break the AI call. Console-only.
    console.error('[logOpenAIUsage] failed:', e)
  }
}
