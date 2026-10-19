import { Fragment } from 'react'
import { BOOKING_STEPS } from '../../constants/booking.ts'
import type { BookingStep } from '../../types/booking.ts'

interface BookingStepperProps {
  currentStep: BookingStep
}

export function BookingStepper({ currentStep }: BookingStepperProps) {
  return (
    <ol className="booking-stepper" aria-label="Pasos de la reserva">
      {BOOKING_STEPS.map(({ step, label }, index) => {
        const state =
          step < currentStep ? 'completed' : step === currentStep ? 'active' : 'pending'
        return (
          <Fragment key={step}>
            {index > 0 ? (
              <li className="booking-stepper__arrow" aria-hidden="true">
                →
              </li>
            ) : null}
            <li
              className={`booking-stepper__step booking-stepper__step--${state}`}
              aria-current={state === 'active' ? 'step' : undefined}
            >
              <span className="booking-stepper__number">
                {state === 'completed' ? <i className="fas fa-check" aria-hidden="true" /> : step}
              </span>
              <span className="booking-stepper__label">{label}</span>
            </li>
          </Fragment>
        )
      })}
    </ol>
  )
}
