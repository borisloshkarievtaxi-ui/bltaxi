import { RIDE_COLUMNS } from './schema.js'

export function getRidesStorageKey(tenantSlug) {
  return `bltaxi_rides_${tenantSlug}`
}

export function loadStoredRides(tenantSlug) {
  if (!tenantSlug) return []
  try {
    const raw = localStorage.getItem(getRidesStorageKey(tenantSlug))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((ride) => ride && typeof ride === 'object' && ride.id)
  } catch {
    return []
  }
}

export function saveStoredRides(tenantSlug, rides) {
  if (!tenantSlug) return
  try {
    const sanitized = (rides ?? []).map((ride) => {
      const copy = { ...ride }
      delete copy.driver
      return copy
    })
    localStorage.setItem(getRidesStorageKey(tenantSlug), JSON.stringify(sanitized))
  } catch {
    // Ignore quota / private mode errors; in-memory state still works.
  }
}

export function sortRidesNewestFirst(rides) {
  return [...(rides ?? [])].sort(
    (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0),
  )
}

/**
 * Cloud rows win on id conflicts; local-only rows (never synced) are preserved.
 */
export function mergeStoredAndCloudRides(storedRides, cloudRides) {
  const stored = Array.isArray(storedRides) ? storedRides : []
  const cloud = Array.isArray(cloudRides) ? cloudRides : []
  const map = new Map()

  for (const ride of stored) {
    map.set(ride.id, ride)
  }

  for (const ride of cloud) {
    const existing = map.get(ride.id)
    map.set(ride.id, existing ? { ...existing, ...ride, syncPending: false, localOnly: false } : ride)
  }

  for (const ride of stored) {
    if (cloud.some((item) => item.id === ride.id)) continue
    const keepLocal =
      ride.localOnly ||
      ride.syncPending ||
      String(ride.id).startsWith('temp-') ||
      String(ride.id).startsWith('local-')
    if (keepLocal) {
      map.set(ride.id, ride)
    }
  }

  return sortRidesNewestFirst(Array.from(map.values()))
}

export const RIDE_FIELD_NAMES = RIDE_COLUMNS.split(',').map((part) => part.trim())
