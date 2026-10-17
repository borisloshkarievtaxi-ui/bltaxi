import {
  getErrorMessage,
  isSupabaseConfigured,
  supabase,
  supabaseAnonKey,
  supabaseUrl,
} from './supabase.js'

const LOG_PREFIX = '[BLTaxi DB] Startup connection check'

/**
 * Live ping against Supabase `tenants` (HEAD count). Logs result to the browser console.
 */
export async function verifySupabaseConnectionOnStartup() {
  if (!isSupabaseConfigured() || !supabase) {
    console.error(`${LOG_PREFIX} — ERROR: Supabase not configured`)
    console.error(`${LOG_PREFIX} Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env (not placeholders)`)
    return { ok: false, stage: 'config', message: 'Supabase env missing or invalid' }
  }

  let host = supabaseUrl
  try {
    host = new URL(supabaseUrl).host
  } catch {
    // keep raw url in log
  }

  console.groupCollapsed(`${LOG_PREFIX}`)
  console.log('target:', host)
  console.log('credentials:', 'from import.meta.env (VITE_SUPABASE_*)')
  console.log('anon key prefix:', `${supabaseAnonKey.slice(0, 12)}…`)

  try {
    const started = performance.now()
    const { count, error } = await supabase
      .from('tenants')
      .select('id', { count: 'exact', head: true })

    const elapsedMs = Math.round(performance.now() - started)

    if (error) {
      console.error('Status: ERROR')
      console.error('latencyMs:', elapsedMs)
      console.error('supabase:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      })
      console.groupEnd()
      return {
        ok: false,
        stage: 'query',
        message: getErrorMessage(error),
        error,
        latencyMs: elapsedMs,
      }
    }

    console.log('Status: SUCCESS')
    console.log('table: tenants')
    console.log('operation: SELECT count (head)')
    console.log('tenantRowCount:', count ?? 0)
    console.log('latencyMs:', elapsedMs)
    console.log('writes: cloud-only (no localStorage fallbacks for tenants/rides/drivers)')
    console.groupEnd()

    return { ok: true, count: count ?? 0, latencyMs: elapsedMs }
  } catch (error) {
    console.error('Status: ERROR (network / runtime)')
    console.error('exception:', error)
    console.groupEnd()
    return { ok: false, stage: 'network', message: getErrorMessage(error), error }
  }
}
