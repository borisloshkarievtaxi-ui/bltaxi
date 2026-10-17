export function formatDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

export function formatMoney(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '—'
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatBalance(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '₪0'
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 2,
  }).format(amount)
}

export const RIDE_STATUS_LABELS = {
  pending: 'ממתינה',
  assigned: 'שובצה',
  completed: 'הושלמה',
}

export const DRIVER_STATUS_LABELS = {
  available: 'פנוי',
  busy: 'בנסיעה',
  offline: 'לא זמין',
}
