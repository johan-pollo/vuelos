export function formatDuration(minutes) {
  const totalMinutes = Number(minutes)
  if (!Number.isFinite(totalMinutes) || totalMinutes < 0) return 'Sin dato'

  const hours = Math.floor(totalMinutes / 60)
  const remainingMinutes = Math.floor(totalMinutes % 60)
  const parts = []

  if (hours) parts.push(`${hours} ${hours === 1 ? 'hora' : 'horas'}`)
  if (remainingMinutes) parts.push(`${remainingMinutes} min`)

  return parts.join(' y ') || '0 min'
}
