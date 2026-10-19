import { useEffect, type RefObject } from 'react'

const REVEAL_SELECTOR = '[data-reveal]'
const VISIBLE_CLASS = 'is-visible'

/**
 * Animación de entrada al hacer scroll (`initScrollAnimations` del legado).
 * Marca con `is-visible` los elementos `[data-reveal]` del contenedor cuando entran en pantalla.
 * `refreshKey` permite volver a escanear cuando se agregan elementos (ej. servicios de la API).
 */
export function useRevealOnScroll(
  containerRef: RefObject<HTMLElement | null>,
  refreshKey: unknown = null,
): void {
  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(VISIBLE_CLASS)
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' },
    )

    container
      .querySelectorAll(`${REVEAL_SELECTOR}:not(.${VISIBLE_CLASS})`)
      .forEach((element) => observer.observe(element))

    return () => observer.disconnect()
  }, [containerRef, refreshKey])
}
