import type { Service, ServiceCategory } from './service.ts'

/** Presentación de una categoría del catálogo en la página de Studio. */
export interface ServiceCategoryMeta {
  title: string
  emoji: string
  /** Clase de Font Awesome usada en el menú desplegable de servicios. */
  icon: string
}

export type ServicesByCategory = Partial<Record<ServiceCategory, Service[]>>

/** Ancla interna de la página de Studio (sub-navegación). */
export interface StudioSectionLink {
  id: string
  label: string
}

export interface StudioStat {
  value: number
  suffix: '' | '+' | '%'
  label: string
}

export interface IconCard {
  icon: string
  title: string
  description: string
}

export interface CourseDetail {
  icon: string
  label: string
}

export interface Course {
  id: string
  badge: string
  icon: string
  headerTitle: string
  title: string
  description: string
  details: CourseDetail[]
  includes: string[]
  price: string
  installment: string
  whatsappMessage: string
}

export interface TimelineEntry {
  year: string
  title: string
  description: string
}

export interface Testimonial {
  initials: string
  name: string
  since: string
  text: string
}

/** Destino de un enlace del footer: una categoría del catálogo o la sección fija de aparatología. */
export type FooterServiceTarget = ServiceCategory | 'aparato'

export interface FooterServiceLink {
  label: string
  target: FooterServiceTarget
}

export interface ContactServiceOption {
  value: string
  label: string
}

export interface ContactFormValues {
  name: string
  service: string
  message: string
}
