import { formatMoney } from './format.js'

export function formatRideShareText(ride, tenant = null) {
  const price = formatMoney(ride.price)
  const commission =
    ride.commission_value != null && ride.commission_value !== ''
      ? formatMoney(ride.commission_value)
      : '—'

  return [
    tenant?.business_name ? `🚕 ${tenant.business_name}` : '🚕 נסיעה לשיבוץ',
    tenant?.phone_number ? `טלפון תחנה: ${tenant.phone_number}` : null,
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

export function buildWhatsAppShareUrl(ride, tenant = null) {
  const text = formatRideShareText(ride, tenant)
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}
