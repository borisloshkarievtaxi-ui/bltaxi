import { getErrorMessage } from './supabase.js'

/**
 * Canonical Supabase column names (live schema).
 * UI / legacy aliases NOT in DB: name→business_name, phone→phone_number, customer_name→client_name.
 */
export const SUPABASE_TABLE_SCHEMA = {
  tenants: [
    'id',
    'slug',
    'business_name',
    'logo_url',
    'primary_color',
    'phone_number',
    'default_commission',
    'created_at',
  ],
  drivers: ['id', 'tenant_id', 'name', 'phone', 'status', 'balance', 'created_at'],
  rides: [
    'id',
    'tenant_id',
    'client_name',
    'client_phone',
    'origin',
    'destination',
    'price',
    'driver_id',
    'driver_name',
    'commission_value',
    'status',
    'payment_status',
    'created_at',
  ],
}

/** Wrong keys sometimes used in forms — must never be sent to PostgREST. */
export const SCHEMA_ALIAS_WARNINGS = {
  tenants: {
    name: 'business_name',
    phone: 'phone_number',
    whatsapp: 'phone_number',
    primaryColor: 'primary_color',
    logo: 'logo_url',
  },
  rides: {
    customer_name: 'client_name',
    customer_phone: 'client_phone',
    name: 'client_name',
    phone: 'client_phone',
  },
  drivers: {
    driver_name: 'name',
  },
}

const LOG_PREFIX = '[BLTaxi DB]'

export function pickKnownColumns(table, payload, allowedKeys) {
  const allowed = new Set(allowedKeys)
  const picked = {}
  const dropped = []

  for (const [key, value] of Object.entries(payload ?? {})) {
    if (allowed.has(key)) {
      picked[key] = value
    } else {
      dropped.push(key)
    }
  }

  return { picked, dropped }
}

export function auditWritePayload(table, payload, context, operation = 'write') {
  const schema = SUPABASE_TABLE_SCHEMA[table]
  const aliases = SCHEMA_ALIAS_WARNINGS[table] ?? {}
  const issues = []

  if (!schema) {
    issues.push(`unknown table "${table}"`)
  }

  for (const key of Object.keys(payload ?? {})) {
    if (aliases[key]) {
      issues.push(`invalid column "${key}" — use "${aliases[key]}"`)
    } else if (schema && !schema.includes(key)) {
      issues.push(`unknown column "${key}" for ${table}`)
    }
  }

  if (issues.length) {
    console.error(`${LOG_PREFIX} ${context} schema audit (${operation} ${table}):`, issues)
    console.error(`${LOG_PREFIX} payload was:`, payload)
  }

  return { ok: issues.length === 0, issues }
}

export function logSupabaseRequest(context, table, operation, payload) {
  console.groupCollapsed(`${LOG_PREFIX} ${context} → ${operation.toUpperCase()} ${table}`)
  console.log('payload:', JSON.parse(JSON.stringify(payload ?? {})))
  console.groupEnd()
}

export function logSupabaseResponse(context, table, operation, { data, error }) {
  if (error) {
    console.error(`${LOG_PREFIX} ${context} ← ${operation} ${table} ERROR:`, {
      message: getErrorMessage(error),
      code: error.code,
      details: error.details,
      hint: error.hint,
    })
    return
  }

  console.groupCollapsed(`${LOG_PREFIX} ${context} ← ${operation} ${table} OK`)
  console.log('row:', JSON.parse(JSON.stringify(data ?? null)))
  console.groupEnd()

  if (!data) {
    console.warn(`${LOG_PREFIX} ${context}: success response without row data`)
  }
}

/**
 * Runs a Supabase mutation with schema audit + request/response logging.
 */
export async function runLoggedSupabaseMutation({
  context,
  table,
  operation,
  payload,
  run,
}) {
  const audit = auditWritePayload(table, payload, context, operation)
  if (!audit.ok) {
    const err = new Error(`Schema mapping failed: ${audit.issues.join('; ')}`)
    err.code = 'SCHEMA_AUDIT'
    return { data: null, error: err, auditFailed: true }
  }

  logSupabaseRequest(context, table, operation, payload)

  try {
    const result = await run()
    logSupabaseResponse(context, table, operation, result)

    if (!result.error && result.data == null) {
      console.warn(`${LOG_PREFIX} ${context}: mutation returned no error and no data`)
    }

    return result
  } catch (error) {
    console.error(`${LOG_PREFIX} ${context}: network/runtime exception`, error)
    return { data: null, error }
  }
}
