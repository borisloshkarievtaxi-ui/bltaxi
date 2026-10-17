export function exportRidesCsv(rides, formatOrderId) {
  const header = ['order_id', 'client_name', 'client_phone', 'origin', 'destination', 'price', 'status', 'driver_name']
  const rows = rides.map((ride, index) => [
    formatOrderId(ride, index),
    ride.client_name ?? '',
    ride.client_phone ?? '',
    ride.origin ?? '',
    ride.destination ?? '',
    ride.price ?? '',
    ride.status ?? '',
    ride.driver_name ?? '',
  ])

  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `bltaxi-rides-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
