import { formatMoney } from './format.js'

export function formatRideShareText(ride) {
  const price = formatMoney(ride.price)
  const commission =
    ride.commission_value != null && ride.commission_value !== ''
      ? formatMoney(ride.commission_value)
      : '—'

  return [
    '🚕 נסיעה לשיבוץ',
    '',
    `מוצא: ${ride.origin || '—'}`,
    `יעד: ${ride.destination || '—'}`,
    `מחיר: ${price}`,
    `עמלה: ${commission}`,
    ride.client_name ? `לקוח: ${ride.client_name}` : null,
    ride.client_phone ? `טלפון: ${ride.client_phone}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

export function buildWhatsAppShareUrl(ride) {
  const text = formatRideShareText(ride)
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}
