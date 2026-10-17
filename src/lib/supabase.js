import { createClient } from '@supabase/supabase-js'

const PLACEHOLDER_URL = 'https://your-project.supabase.co'
const PLACEHOLDER_KEY = 'your-anon-key'

export const TENANT_SLUG = 'bltaxi-demo'

export function getSupabaseEnv() {
  return {
    url: String(import.meta.env.VITE_SUPABASE_URL ?? '').trim(),
    anonKey: String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim(),
  }
}

export function isSupabaseConfigured() {
  const { url, anonKey } = getSupabaseEnv()

  if (!url || !anonKey) return false
  if (url === PLACEHOLDER_URL || anonKey === PLACEHOLDER_KEY) return false

  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
    if (!parsed.hostname.includes('.')) return false
  } catch {
    return false
  }

  return anonKey.length >= 20
}

function createSupabaseClient() {
  if (!isSupabaseConfigured()) return null

  const { url, anonKey } = getSupabaseEnv()
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  })
}

export const supabase = createSupabaseClient()

export function isConfigError(error) {
  if (!error) return false

  const message = String(error.message ?? error).toLowerCase()
  const status = error.status ?? error.statusCode ?? error.code

  const schemaFailure =
    message.includes('column') ||
    message.includes('does not exist') ||
    message.includes('pgrst') ||
    message.includes('schema cache')

  if (schemaFailure) return false

  const authFailure =
    status === 401 ||
    status === 403 ||
    message.includes('invalid api key') ||
    message.includes('jwt') ||
    message.includes('not a valid jwt') ||
    (message.includes('api key') && !message.includes('column'))

  const networkFailure =
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('load failed') ||
    message.includes('err_name_not_resolved') ||
    message.includes('enotfound') ||
    message.includes('invalid url')

  return authFailure || networkFailure
}
