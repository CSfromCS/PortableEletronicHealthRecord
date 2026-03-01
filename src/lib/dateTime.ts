export const toLocalISODate = (date = new Date()) => {
  const timezoneOffsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 10)
}

export const toLocalTime = (date = new Date()) => {
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

export const parseNumericInput = (value: string | undefined): number | null => {
  const sanitized = (value ?? '').trim().replaceAll(',', '').replaceAll('%', '')
  if (!sanitized) return null

  const parsed = Number.parseFloat(sanitized)
  return Number.isFinite(parsed) ? parsed : null
}

export const formatCalculatedNumber = (value: number, decimals = 2): string => {
  if (!Number.isFinite(value)) return ''
  const rounded = Number.parseFloat(value.toFixed(decimals))
  return rounded.toString()
}

export const formatDateMMDDYYYY = (isoDate: string) => {
  const [year, month, day] = isoDate.split('-')
  if (!year || !month || !day) return isoDate
  return `${month}-${day}-${year}`
}

export const formatDateMMDD = (isoDate: string) => {
  const [, month, day] = isoDate.split('-')
  if (!month || !day) return isoDate
  return `${month}-${day}`
}

export const formatDateShortMonthDay = (isoDate: string) => {
  const [yearText, monthText, dayText] = isoDate.split('-')
  const year = Number.parseInt(yearText ?? '', 10)
  const month = Number.parseInt(monthText ?? '', 10)
  const day = Number.parseInt(dayText ?? '', 10)
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return isoDate

  const date = new Date(year, month - 1, day)
  if (Number.isNaN(date.getTime())) return isoDate

  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)
}

export const formatClock = (time: string) => {
  const [hourText, minuteText = '00'] = time.split(':')
  const hour = Number.parseInt(hourText, 10)
  const minute = Number.parseInt(minuteText, 10)
  if (Number.isNaN(hour) || Number.isNaN(minute)) return time
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  return `${hour12}:${minute.toString().padStart(2, '0')} ${suffix}`
}

export const formatClockCompact = (time: string) => {
  const [hourText, minuteText = '00'] = time.split(':')
  const hour = Number.parseInt(hourText, 10)
  const minute = Number.parseInt(minuteText, 10)
  if (Number.isNaN(hour) || Number.isNaN(minute)) return time
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  if (minute === 0) return `${hour12}${suffix}`
  return `${hour12}:${minute.toString().padStart(2, '0')}${suffix}`
}

export const toDateTimeStamp = (date: string, time?: string, fallback?: string) => {
  const safeTime = time && time.trim().length > 0 ? time : '00:00'
  const iso = `${date}T${safeTime}`
  const parsed = Date.parse(iso)
  if (Number.isFinite(parsed)) return parsed
  if (fallback) {
    const fallbackParsed = Date.parse(fallback)
    if (Number.isFinite(fallbackParsed)) return fallbackParsed
  }
  return Number.NaN
}

export const isWithinDateTimeWindow = (
  date: string,
  time: string,
  dateFrom: string,
  dateTo: string,
  timeFrom: string,
  timeTo: string,
) => {
  if (date < dateFrom || date > dateTo) return false
  if (date === dateFrom && time < timeFrom) return false
  if (date === dateTo && time > timeTo) return false
  return true
}