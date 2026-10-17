function isCurrentMonth(dateValue) {
  if (!dateValue) return false
  const date = new Date(dateValue)
  const now = new Date()
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
}

function sum(values) {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0)
}

export function computeDispatchMetrics(rides) {
  const monthRides = rides.filter((ride) => isCurrentMonth(ride.created_at))
  const completedMonth = monthRides.filter((ride) => ride.status === 'completed')

  const grossTurnover = sum(completedMonth.map((ride) => Number(ride.price)))
  const netCommissions = sum(completedMonth.map((ride) => Number(ride.commission_value)))
  const completedCount = completedMonth.length

  const openCommissions = sum(
    rides
      .filter((ride) => ride.payment_status !== 'paid' && ride.status !== 'pending')
      .map((ride) => Number(ride.commission_value)),
  )

  return {
    grossTurnover,
    netCommissions,
    completedCount,
    openCommissions,
  }
}

export function formatRideOrderId(ride, index) {
  if (!ride?.created_at) return `#${String(index + 1).padStart(4, '0')}`
  const date = new Date(ride.created_at)
  const yy = String(date.getFullYear()).slice(-2)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const suffix = String(index + 1).padStart(2, '0')
  return `#${yy}${mm}${suffix}`
}

export function computeNetProfit(ride) {
  const price = Number(ride.price)
  const commission = Number(ride.commission_value)
  if (!Number.isFinite(price)) return null
  if (!Number.isFinite(commission)) return price
  return Math.max(price - commission, 0)
}
