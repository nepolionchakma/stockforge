import type { DateRule, ResolvedEvent, Season } from '@shared/types'
import { EVENTS } from '../data/events'

export const YEAR_OPTIONS = [2025, 2026, 2027, 2028, 2029, 2030]

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]

export const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
]

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
]

function addDays(date: Date, offset: number): Date {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + offset)
  return copy
}

function atMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(year, month - 1, 1)
  const offset = (weekday - first.getDay() + 7) % 7
  return new Date(year, month - 1, 1 + offset + 7 * (n - 1))
}

function lastWeekday(year: number, month: number, weekday: number): Date {
  const lastDay = new Date(year, month, 0)
  const offset = (lastDay.getDay() - weekday + 7) % 7
  return new Date(year, month - 1, lastDay.getDate() - offset)
}

/** Anonymous Gregorian algorithm for Easter Sunday. */
function easterSunday(year: number): [number, number] {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return [month, day]
}

function thanksgivingDate(year: number): Date {
  return nthWeekday(year, 11, 4, 4)
}

function electionDate(year: number): Date {
  return addDays(nthWeekday(year, 11, 1, 1), 1)
}

function resolveRule(rule: DateRule, year: number): Date | null {
  switch (rule.type) {
    case 'fixed':
      return atMidnight(new Date(year, rule.month - 1, rule.day))
    case 'nth':
      return nthWeekday(year, rule.month, rule.weekday, rule.n)
    case 'last':
      return lastWeekday(year, rule.month, rule.weekday)
    case 'easter': {
      const [month, day] = easterSunday(year)
      return addDays(new Date(year, month - 1, day), rule.offset ?? 0)
    }
    case 'thanksgiving':
      return addDays(thanksgivingDate(year), rule.offset ?? 0)
    case 'election':
      return electionDate(year)
    case 'month':
      return null
    case 'range':
      return atMidnight(new Date(year, rule.startMonth - 1, rule.startDay))
    case 'table': {
      const entry = rule.dates[year]
      return entry ? atMidnight(new Date(year, entry[0] - 1, entry[1])) : null
    }
    default:
      return null
  }
}

function seasonForMonth(month: number): Season {
  if (month === 12 || month <= 2) return 'winter'
  if (month <= 5) return 'spring'
  if (month <= 8) return 'summer'
  return 'fall'
}

function labelFor(rule: DateRule, date: Date | null, seedMonth: number): string {
  switch (rule.type) {
    case 'month':
      return `All ${MONTH_NAMES[seedMonth - 1]}`
    case 'range':
      return `${MONTH_SHORT[rule.startMonth - 1]} ${rule.startDay} – ${MONTH_SHORT[rule.endMonth - 1]} ${rule.endDay}`
    case 'table':
      if (!date) return 'Dates vary'
      return `${MONTH_SHORT[date.getMonth()]} ${date.getDate()}`
    default:
      if (!date) return 'Date varies'
      return `${MONTH_SHORT[date.getMonth()]} ${date.getDate()}`
  }
}

export function resolveEvent(seed: (typeof EVENTS)[number], year: number): ResolvedEvent {
  const date = resolveRule(seed.rule, year)
  const month = date ? date.getMonth() + 1 : seed.month
  return {
    ...seed,
    date: date ? atMidnight(date) : null,
    dateLabel: labelFor(seed.rule, date, seed.month),
    isMonthLong: seed.rule.type === 'month',
    season: seasonForMonth(month)
  }
}

export function resolveEvents(year: number): ResolvedEvent[] {
  return EVENTS.map((seed) => resolveEvent(seed, year)).sort((a, b) => {
    const aTime = a.date ? a.date.getTime() : new Date(year, a.month - 1, 1).getTime()
    const bTime = b.date ? b.date.getTime() : new Date(year, b.month - 1, 1).getTime()
    if (aTime !== bTime) return aTime - bTime
    return a.name.localeCompare(b.name)
  })
}

export interface MonthGroup {
  month: number
  label: string
  events: ResolvedEvent[]
}

export function groupEventsByMonth(events: ResolvedEvent[]): MonthGroup[] {
  const groups = new Map<number, ResolvedEvent[]>()
  for (const event of events) {
    const month = event.date ? event.date.getMonth() + 1 : event.month
    const bucket = groups.get(month) ?? []
    bucket.push(event)
    groups.set(month, bucket)
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([month, monthEvents]) => ({
      month,
      label: MONTH_NAMES[month - 1],
      events: monthEvents
    }))
}

export function formatLongDate(date: Date | null): string {
  if (!date) return 'Date varies by year'
  return `${WEEKDAY_NAMES[date.getDay()]}, ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
}

export function formatShortDate(date: Date | null): string {
  if (!date) return 'Varies'
  return `${MONTH_SHORT[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
}

export function daysUntil(date: Date | null, now = new Date()): number | null {
  if (!date) return null
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  return Math.round((end - start) / 86_400_000)
}

export function pickDefaultEvent(events: ResolvedEvent[]): ResolvedEvent {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return (
    events.find((event) => event.date && event.date.getTime() >= today) ??
    events[events.length - 1] ??
    events[0]
  )
}
