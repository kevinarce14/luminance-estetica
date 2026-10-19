import type { ReactNode, Ref } from 'react'

interface BookingSectionProps {
  id: string
  icon: string
  title: string
  disabled?: boolean
  ref?: Ref<HTMLElement>
  children: ReactNode
}

/** Caja de cada paso (`.section-box` de turnera.html). Deshabilitada hasta completar el paso previo. */
export function BookingSection({
  id,
  icon,
  title,
  disabled = false,
  ref,
  children,
}: BookingSectionProps) {
  return (
    <section
      ref={ref}
      id={id}
      className={disabled ? 'booking-section booking-section--disabled' : 'booking-section'}
      aria-labelledby={`${id}-title`}
      aria-disabled={disabled || undefined}
      inert={disabled}
    >
      <div className="booking-section__header">
        <div className="booking-section__icon" aria-hidden="true">
          <i className={icon} />
        </div>
        <h2 id={`${id}-title`}>{title}</h2>
      </div>
      {children}
    </section>
  )
}
