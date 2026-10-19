import { useState } from 'react'
import { NON_WORKING_WEEKDAYS, WEEKDAY_LABELS } from '../../constants/booking.ts'
import type { BusyDays, CalendarDay } from '../../types/booking.ts'
import {
  addDays,
  formatMonthTitle,
  formatStudioLongDate,
  getMaxBookingDate,
  getStudioToday,
  getWeekday,
  isBookableDate,
  toDateKey,
} from '../../utils/studioTime.ts'

interface MonthCursor {
  year: number
  monthIndex: number
}

/** Columnas visibles (lunes a domingo, sin los días sin atención). */
const VISIBLE_WEEKDAYS = [1, 2, 3, 4, 5, 6, 0].filter(
  (weekday) => !NON_WORKING_WEEKDAYS.includes(weekday),
)

function cursorFromDateKey(dateKey: string): MonthCursor {
  const [year, month] = dateKey.split('-').map(Number)
  return { year, monthIndex: month - 1 }
}

function compareCursors(a: MonthCursor, b: MonthCursor): number {
  return a.year * 12 + a.monthIndex - (b.year * 12 + b.monthIndex)
}

function shiftCursor({ year, monthIndex }: MonthCursor, delta: number): MonthCursor {
  const total = year * 12 + monthIndex + delta
  return { year: Math.floor(total / 12), monthIndex: total % 12 }
}

/** Semanas del mes (lunes a sábado), con relleno de los meses vecinos. */
function buildMonthWeeks({ year, monthIndex }: MonthCursor, today: string): CalendarDay[][] {
  const firstDay = toDateKey(year, monthIndex, 1)
  const mondayOffset = (getWeekday(firstDay) + 6) % 7
  let cursor = addDays(firstDay, -mondayOffset)
  const monthPrefix = firstDay.slice(0, 7)
  const weeks: CalendarDay[][] = []

  while (weeks.length === 0 || cursor.slice(0, 7) === monthPrefix) {
    const week: CalendarDay[] = []
    for (let offset = 0; offset < 7; offset += 1) {
      const date = addDays(cursor, offset)
      if (VISIBLE_WEEKDAYS.includes(getWeekday(date))) {
        const isCurrentMonth = date.slice(0, 7) === monthPrefix
        week.push({
          date,
          dayOfMonth: Number(date.slice(8, 10)),
          isCurrentMonth,
          isSelectable: isCurrentMonth && isBookableDate(date, today),
          isToday: date === today,
        })
      }
    }
    weeks.push(week)
    cursor = addDays(cursor, 7)
  }

  return weeks
}

interface BookingCalendarProps {
  selectedDate: string | null
  busyDays: BusyDays
  onSelectDate: (date: string) => void
}

export function BookingCalendar({ selectedDate, busyDays, onSelectDate }: BookingCalendarProps) {
  const today = getStudioToday()
  const minCursor = cursorFromDateKey(today)
  const maxCursor = cursorFromDateKey(getMaxBookingDate(today))
  const [viewCursor, setViewCursor] = useState<MonthCursor>(() =>
    cursorFromDateKey(selectedDate ?? today),
  )

  const weeks = buildMonthWeeks(viewCursor, today)
  const canGoBack = compareCursors(viewCursor, minCursor) > 0
  const canGoForward = compareCursors(viewCursor, maxCursor) < 0

  return (
    <div className="booking-calendar">
      <div className="booking-calendar__toolbar">
        <button
          type="button"
          className="booking-calendar__nav"
          onClick={() => setViewCursor((cursor) => shiftCursor(cursor, -1))}
          disabled={!canGoBack}
          aria-label="Mes anterior"
        >
          <i className="fas fa-chevron-left" aria-hidden="true" />
        </button>
        <h3 className="booking-calendar__title" aria-live="polite">
          {formatMonthTitle(viewCursor.year, viewCursor.monthIndex)}
        </h3>
        <button
          type="button"
          className="booking-calendar__nav"
          onClick={() => setViewCursor((cursor) => shiftCursor(cursor, 1))}
          disabled={!canGoForward}
          aria-label="Mes siguiente"
        >
          <i className="fas fa-chevron-right" aria-hidden="true" />
        </button>
      </div>

      <div className="booking-calendar__grid" role="grid" aria-label="Calendario de turnos">
        <div className="booking-calendar__row" role="row">
          {VISIBLE_WEEKDAYS.map((weekday) => (
            <div key={weekday} className="booking-calendar__weekday" role="columnheader">
              {WEEKDAY_LABELS[(weekday + 6) % 7]}
            </div>
          ))}
        </div>

        {weeks.map((week) => (
          <div key={week[0].date} className="booking-calendar__row" role="row">
            {week.map((day) => {
              const busyCount = day.isCurrentMonth ? (busyDays[day.date] ?? 0) : 0
              const classNames = [
                'booking-calendar__day',
                !day.isCurrentMonth && 'booking-calendar__day--outside',
                day.isToday && 'booking-calendar__day--today',
                day.date === selectedDate && 'booking-calendar__day--selected',
                busyCount > 0 && 'booking-calendar__day--busy',
              ]
                .filter(Boolean)
                .join(' ')
              const busyLabel =
                busyCount > 0
                  ? `, ${busyCount} ${busyCount === 1 ? 'turno confirmado' : 'turnos confirmados'}`
                  : ''

              return (
                <div key={day.date} role="gridcell">
                  <button
                    type="button"
                    className={classNames}
                    disabled={!day.isSelectable}
                    aria-pressed={day.date === selectedDate}
                    aria-label={`${formatStudioLongDate(day.date)}${busyLabel}`}
                    onClick={() => onSelectDate(day.date)}
                  >
                    <span>{day.dayOfMonth}</span>
                    {busyCount > 0 ? (
                      <span className="booking-calendar__busy" aria-hidden="true">
                        {busyCount}
                      </span>
                    ) : null}
                  </button>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <div className="booking-calendar__legend">
        <span>
          <span className="booking-calendar__legend-dot booking-calendar__legend-dot--busy" />
          Días con turnos confirmados
        </span>
        <span>
          <span className="booking-calendar__legend-dot booking-calendar__legend-dot--disabled" />
          No disponible
        </span>
        <span>Domingos cerrado</span>
      </div>
    </div>
  )
}
