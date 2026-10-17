import { createClient } from '@supabase/supabase-js'

const PLACEHOLDER_URL = 'https://your-project.supabase.co'
const PLACEHOLDER_KEY = 'your-anon-key'

export const TENANT_SLUG = 'bltaxi-demo'

export const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim()
export const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

export function getSupabaseEnv() {
  return {
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
  }
}

export function isSupabaseConfigured() {
  if (!supabaseUrl || !supabaseAnonKey) return false
  if (supabaseUrl === PLACEHOLDER_URL || supabaseAnonKey === PLACEHOLDER_KEY) return false
  return true
}

export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      realtime: {
        params: { eventsPerSecond: 10 },
      },
    })
  : null

export function isNetworkError(error) {
  if (!error) return false

  const message = String(error.message ?? error).toLowerCase()
  const code = String(error.code ?? '').toLowerCase()

  return (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('network request failed') ||
    message.includes('load failed') ||
    message.includes('fetch failed') ||
    message.includes('err_name_not_resolved') ||
    message.includes('enotfound') ||
    message.includes('econnreset') ||
    message.includes('econnrefused') ||
    message.includes('etimedout') ||
    message.includes('timeout') ||
    message.includes('aborted') ||
    code === 'network_error'
  )
}

export function isAuthError(error) {
  if (!error) return false

  const message = String(error.message ?? error).toLowerCase()
  const status = error.status ?? error.statusCode

  return (
    status === 401 ||
    status === 403 ||
    message.includes('invalid api key') ||
    message.includes('not a valid jwt') ||
    (message.includes('jwt') && message.includes('invalid'))
  )
}

export function getErrorMessage(error) {
  if (!error) return 'שגיאה לא ידועה'
  return String(error.message ?? error)
}

export function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
