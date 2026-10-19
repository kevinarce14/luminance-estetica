import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { useOutletContext } from 'react-router-dom'
import { LoginRequiredModal } from '../components/common/LoginRequiredModal.tsx'
import {
  buildWhatsappUrl,
  INSTAGRAM_HANDLE,
  INSTAGRAM_URL,
  WHATSAPP_DISPLAY,
  WHATSAPP_DISPLAY_SHORT,
  WHATSAPP_MESSAGES,
} from '../constants/contact.ts'
import {
  APARATO_TREATMENTS,
  BENEFITS,
  CONTACT_SERVICE_OPTIONS,
  COURSES,
  FOOTER_COURSE_LINKS,
  FOOTER_SERVICE_LINKS,
  SERVICE_CATEGORY_META,
  SERVICE_CATEGORY_ORDER,
  SERVICE_FEATURES,
  STUDIO_SECTION_LINKS,
  STUDIO_STATS,
  TESTIMONIALS,
  TIMELINE,
} from '../data/studioContent.ts'
import { useReserveService } from '../hooks/useReserveService.ts'
import { useRevealOnScroll } from '../hooks/useRevealOnScroll.ts'
import { getActiveServices } from '../services/servicesApi.ts'
import type { MainLayoutOutletContext } from '../types/navigation.ts'
import type { Service, ServiceCategory } from '../types/service.ts'
import type {
  ContactFormValues,
  FooterServiceTarget,
  ServicesByCategory,
  StudioStat,
} from '../types/studio.ts'
import { formatPrice } from '../utils/formatters.ts'
import './StudioPage.css'

const COUNTER_STEPS = 30
const COUNTER_INTERVAL_MS = 50

const INITIAL_CONTACT_FORM: ContactFormValues = {
  name: '',
  service: '',
  message: '',
}

function groupByCategory(services: Service[]): ServicesByCategory {
  return services.reduce<ServicesByCategory>((groups, service) => {
    const categoryServices = groups[service.category] ?? []
    categoryServices.push(service)
    groups[service.category] = categoryServices
    return groups
  }, {})
}

function categoryAnchor(category: ServiceCategory): string {
  return `categoria-${category}`
}

/** Contador animado de las estadísticas del hero (`initCounterAnimation` del legado). */
function StatCounter({ value, suffix }: Pick<StudioStat, 'value' | 'suffix'>) {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    const increment = value / COUNTER_STEPS
    let accumulated = 0

    const timer = window.setInterval(() => {
      accumulated = Math.min(accumulated + increment, value)
      setCurrent(Math.floor(accumulated))
      if (accumulated >= value) {
        window.clearInterval(timer)
      }
    }, COUNTER_INTERVAL_MS)

    return () => window.clearInterval(timer)
  }, [value])

  return (
    <>
      {current}
      {suffix}
    </>
  )
}

interface StudioSubnavProps {
  categories: ServiceCategory[]
}

/** Anclas internas de la página (antes vivían en el header de studio.html). */
function StudioSubnav({ categories }: StudioSubnavProps) {
  return (
    <nav className="studio-subnav" aria-label="Secciones del studio">
      <ul className="studio-subnav__links">
        <li>
          <a href="#inicio">Inicio</a>
        </li>
        <li className="studio-subnav__dropdown">
          <a href="#servicios">
            Servicios <i className="fas fa-chevron-down" aria-hidden="true" />
          </a>
          <div className="studio-subnav__dropdown-content">
            {categories.map((category) => (
              <a key={category} href={`#${categoryAnchor(category)}`}>
                <i
                  className={SERVICE_CATEGORY_META[category].icon}
                  aria-hidden="true"
                />
                {SERVICE_CATEGORY_META[category].title}
              </a>
            ))}
            <a href="#aparato">
              <i className="fas fa-user-md" aria-hidden="true" />
              Aparatología
            </a>
          </div>
        </li>
        {STUDIO_SECTION_LINKS.map((section) => (
          <li key={section.id}>
            <a href={`#${section.id}`}>{section.label}</a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

interface ServiceCardProps {
  service: Service
  emoji: string
  onReserve: (serviceId: number) => void
}

function ServiceCard({ service, emoji, onReserve }: ServiceCardProps) {
  return (
    <article className="studio-service-card" data-reveal>
      <div className="studio-service-card__header">
        <div className="studio-service-card__icon" aria-hidden="true">
          {emoji}
        </div>
        <div>
          <h4>{service.name}</h4>
          <span className="studio-service-card__duration">
            <i className="far fa-clock" aria-hidden="true" />{' '}
            {service.duration_minutes} minutos
          </span>
        </div>
      </div>
      <p>{service.description ?? 'Tratamiento profesional de belleza'}</p>
      <ul className="studio-service-card__features">
        {SERVICE_FEATURES.map((feature) => (
          <li key={feature}>
            <i className="fas fa-check-circle" aria-hidden="true" /> {feature}
          </li>
        ))}
      </ul>
      <div className="studio-service-card__price">
        {formatPrice(service.price)}
      </div>
      <button
        type="button"
        className="btn btn-rosa btn--block studio-service-card__cta"
        onClick={() => onReserve(service.id)}
      >
        <i className="fas fa-calendar-check" aria-hidden="true" />
        Reservar Turno
      </button>
    </article>
  )
}

export function StudioPage() {
  const { subnavContainer } = useOutletContext<MainLayoutOutletContext>()
  const { reserveService, isLoginModalOpen, closeLoginModal } =
    useReserveService()
  const pageRef = useRef<HTMLDivElement>(null)
  const [services, setServices] = useState<Service[]>([])
  const [contactForm, setContactForm] =
    useState<ContactFormValues>(INITIAL_CONTACT_FORM)

  useEffect(() => {
    let cancelled = false

    getActiveServices()
      .then((data) => {
        if (!cancelled) {
          setServices(data)
        }
      })
      .catch((error: unknown) => {
        console.error('Error cargando servicios:', error)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useRevealOnScroll(pageRef, services)

  const servicesByCategory = useMemo(
    () => groupByCategory(services),
    [services],
  )

  const visibleCategories = useMemo(
    () =>
      SERVICE_CATEGORY_ORDER.filter(
        (category) => (servicesByCategory[category]?.length ?? 0) > 0,
      ),
    [servicesByCategory],
  )

  const footerServiceHref = (target: FooterServiceTarget): string => {
    if (target === 'aparato') {
      return '#aparato'
    }
    return visibleCategories.includes(target)
      ? `#${categoryAnchor(target)}`
      : '#servicios'
  }

  const handleContactChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target
    setContactForm((previous) => ({ ...previous, [name]: value }))
  }

  const handleContactSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const serviceLabel =
      CONTACT_SERVICE_OPTIONS.find(
        (option) => option.value === contactForm.service,
      )?.label ?? ''
    const message = `Hola Cande! Soy ${contactForm.name}. Vi tu página y quisiera consultarte por: ${serviceLabel}`

    window.open(buildWhatsappUrl(message), '_blank', 'noopener,noreferrer')
    setContactForm(INITIAL_CONTACT_FORM)
  }

  return (
    <div className="studio-page" ref={pageRef}>
      {subnavContainer
        ? createPortal(
            <StudioSubnav categories={visibleCategories} />,
            subnavContainer,
          )
        : null}

      {/* ===== HERO ===== */}
      <section className="studio-hero" id="inicio">
        <div className="studio-container">
          <div className="studio-hero__content">
            <div className="studio-hero__text">
              <span className="studio-badge">
                <i className="fas fa-star" aria-hidden="true" /> 5 años de
                experiencia
              </span>

              <h1>Belleza Profesional con Resultados que Hablan por Sí Solos</h1>

              <p>
                Soy <span className="studio-highlight">Cande</span>,
                especialista en estética con 5 años transformando miradas y
                realzando belleza natural. Mi pasión está en cada detalle,
                desde el lifting de pestañas hasta los tratamientos corporales
                más avanzados.
              </p>

              <div className="studio-hero__buttons">
                <a href="#servicios" className="btn btn-rosa">
                  <i className="fas fa-spa" aria-hidden="true" /> Ver Servicios
                </a>
                <a
                  href={buildWhatsappUrl(WHATSAPP_MESSAGES.general)}
                  className="btn btn-lila"
                  target="_blank"
                  rel="noreferrer"
                >
                  <i className="fab fa-whatsapp" aria-hidden="true" /> Reservar
                  por WhatsApp
                </a>
              </div>
            </div>

            <div className="studio-hero__image">
              <div className="studio-hero__image-float">
                <img
                  src="https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80"
                  alt="Cande - Especialista en estética"
                  loading="lazy"
                />
              </div>
            </div>
          </div>

          <div className="studio-hero__stats">
            {STUDIO_STATS.map((stat) => (
              <div className="studio-stat" key={stat.label}>
                <div className="studio-stat__number">
                  <StatCounter value={stat.value} suffix={stat.suffix} />
                </div>
                <div className="studio-stat__label">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== SOBRE MÍ ===== */}
      <section className="studio-section studio-bio" id="sobremi">
        <div className="studio-container">
          <div className="studio-bio__container">
            <div className="studio-bio__image">
              <img
                src="https://images.unsplash.com/photo-1580618672591-eb180b1a973f?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80"
                alt="Cande - Especialista en estética"
                loading="lazy"
              />
              <div className="studio-bio__certificate">
                <i className="fas fa-graduation-cap" aria-hidden="true" />
                <p>Formación Continua</p>
                <small>Tecnicatura en Cosmetología 2024</small>
              </div>
            </div>

            <div className="studio-bio__text">
              <h2>¡Hola, soy Cande!</h2>
              <p>
                Desde hace <span className="studio-highlight">5 años</span>, me
                dedico apasionadamente a realzar la belleza natural de mis
                clientas a través de técnicas profesionales y personalizadas.
              </p>
              <p>
                Mi especialidad está en{' '}
                <span className="studio-highlight">pestañas y cejas</span>,
                donde combino precisión y arte para crear resultados que superen
                expectativas. Cada rostro es único, y mi misión es destacar su
                esencia natural.
              </p>
              <p>
                Este 2024 inicio mi{' '}
                <span className="studio-highlight">
                  Tecnicatura en Cosmetología
                </span>
                , para incorporar los conocimientos científicos más actualizados
                y ofrecerte tratamientos aún más efectivos y seguros.
              </p>
              <p>
                Creo firmemente en la{' '}
                <span className="studio-highlight">educación continua</span>,
                por eso además de mis servicios, comparto mi experiencia a
                través de cursos donde enseño a otras emprendedoras las técnicas
                que he perfeccionado a lo largo de estos años.
              </p>

              <div className="studio-benefits">
                {BENEFITS.map((benefit) => (
                  <div className="studio-benefit" key={benefit.title} data-reveal>
                    <i className={benefit.icon} aria-hidden="true" />
                    <h3>{benefit.title}</h3>
                    <p>{benefit.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== SERVICIOS ===== */}
      <section className="studio-section studio-services" id="servicios">
        <div className="studio-container">
          <div className="studio-section-title">
            <h2>Mis Servicios Especializados</h2>
            <p>
              Tratamientos profesionales diseñados para realzar tu belleza
              natural
            </p>
          </div>

          {visibleCategories.map((category) => {
            const meta = SERVICE_CATEGORY_META[category]
            return (
              <div
                className="studio-category"
                id={categoryAnchor(category)}
                key={category}
              >
                <div className="studio-category__title">
                  <span className="studio-category__emoji" aria-hidden="true">
                    {meta.emoji}
                  </span>
                  <h3>{meta.title}</h3>
                  <div className="studio-category__divider" />
                </div>

                <div className="studio-services__grid">
                  {(servicesByCategory[category] ?? []).map((service) => (
                    <ServiceCard
                      key={service.id}
                      service={service}
                      emoji={meta.emoji}
                      onReserve={reserveService}
                    />
                  ))}
                </div>
              </div>
            )
          })}

          {/* Aparatología: sección fija que el legado preserva al final */}
          <div className="studio-aparato" id="aparato">
            <h3>
              <i className="fas fa-user-md" aria-hidden="true" /> Estética
              Corporal con Aparatología
            </h3>
            <p className="studio-aparato__intro">
              Tratamientos reductores, moldeantes y tonificantes con tecnología
              profesional
            </p>

            <div className="studio-aparato__grid">
              {APARATO_TREATMENTS.map((treatment) => (
                <div className="studio-aparato__card" key={treatment.title} data-reveal>
                  <div className="studio-aparato__icon">
                    <i className={treatment.icon} aria-hidden="true" />
                  </div>
                  <h4>{treatment.title}</h4>
                  <p>{treatment.description}</p>
                </div>
              ))}
            </div>

            <div className="studio-centered-action">
              <a
                href={buildWhatsappUrl(WHATSAPP_MESSAGES.aparatologia)}
                className="btn btn-lila"
                target="_blank"
                rel="noreferrer"
              >
                <i className="fas fa-info-circle" aria-hidden="true" />{' '}
                Consultar Todos los Tratamientos
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CURSOS ===== */}
      <section className="studio-section studio-courses" id="cursos">
        <div className="studio-container">
          <div className="studio-section-title">
            <h2>Cursos Profesionales</h2>
            <p>Formación práctica para emprender en el mundo de la estética</p>
          </div>

          <div className="studio-courses__grid">
            {COURSES.map((course) => (
              <article className="studio-course" key={course.id} data-reveal>
                <div className="studio-course__badge">{course.badge}</div>
                <div className="studio-course__header">
                  <div className="studio-course__icon">
                    <i className={course.icon} aria-hidden="true" />
                  </div>
                  <h3>{course.headerTitle}</h3>
                </div>
                <div className="studio-course__content">
                  <h3>{course.title}</h3>
                  <p>{course.description}</p>

                  <div className="studio-course__details">
                    {course.details.map((detail) => (
                      <div className="studio-course__detail" key={detail.label}>
                        <i className={detail.icon} aria-hidden="true" />
                        <span>{detail.label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="studio-course__includes">
                    <h4>¿Qué incluye?</h4>
                    <ul>
                      {course.includes.map((item) => (
                        <li key={item}>
                          <i className="fas fa-check" aria-hidden="true" />{' '}
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="studio-course__price">{course.price}</div>
                  <div className="studio-course__installment">
                    {course.installment}
                  </div>

                  <a
                    href={buildWhatsappUrl(course.whatsappMessage)}
                    className="btn btn-lila btn--block"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <i className="fas fa-graduation-cap" aria-hidden="true" />{' '}
                    Quiero Inscribirme
                  </a>
                </div>
              </article>
            ))}
          </div>

          <div className="studio-centered-action">
            <a
              href={buildWhatsappUrl(WHATSAPP_MESSAGES.allCourses)}
              className="btn btn-dorado"
              target="_blank"
              rel="noreferrer"
            >
              <i className="fas fa-book-open" aria-hidden="true" /> Consultar
              por Cursos Personalizados
            </a>
          </div>
        </div>
      </section>

      {/* ===== FORMACIÓN ===== */}
      <section className="studio-section studio-formacion" id="formacion">
        <div className="studio-container">
          <div className="studio-section-title">
            <h2>Mi Formación Profesional</h2>
            <p>Comprometida con la excelencia y la educación continua</p>
          </div>

          <div className="studio-timeline">
            {TIMELINE.map((entry) => (
              <div className="studio-timeline__item" key={entry.year} data-reveal>
                <div className="studio-timeline__year">{entry.year}</div>
                <div className="studio-timeline__content">
                  <h4>{entry.title}</h4>
                  <p>{entry.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIOS ===== */}
      <section className="studio-section studio-testimonials" id="testimonios">
        <div className="studio-container">
          <div className="studio-section-title">
            <h2>Lo que Dicen Mis Clientes</h2>
            <p>Experiencias reales de quienes confiaron en mi trabajo</p>
          </div>

          <div className="studio-testimonials__grid">
            {TESTIMONIALS.map((testimonial) => (
              <figure className="studio-testimonial" key={testimonial.name} data-reveal>
                <div className="studio-testimonial__rating" aria-label="5 estrellas">
                  {Array.from({ length: 5 }, (_, index) => (
                    <i className="fas fa-star" aria-hidden="true" key={index} />
                  ))}
                </div>
                <blockquote className="studio-testimonial__text">
                  "{testimonial.text}"
                </blockquote>
                <figcaption className="studio-testimonial__client">
                  <div className="studio-testimonial__avatar" aria-hidden="true">
                    {testimonial.initials}
                  </div>
                  <div>
                    <div className="studio-testimonial__name">
                      {testimonial.name}
                    </div>
                    <small>{testimonial.since}</small>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CONTACTO ===== */}
      <section className="studio-section studio-contact" id="contacto">
        <div className="studio-container">
          <div className="studio-section-title">
            <h2>Contacto</h2>
            <p>Estoy aquí para ayudarte a verte y sentirte mejor</p>
          </div>

          <div className="studio-contact__content">
            <div className="studio-contact__info">
              <h3>Información de Contacto</h3>

              <div className="studio-contact__item">
                <div className="studio-contact__icon">
                  <i className="fab fa-whatsapp" aria-hidden="true" />
                </div>
                <div className="studio-contact__details">
                  <h4>WhatsApp</h4>
                  <p>
                    <a href={buildWhatsappUrl()} target="_blank" rel="noreferrer">
                      {WHATSAPP_DISPLAY}
                    </a>
                  </p>
                  <p>
                    Agendá tu cita o consultá por mis cursos. Te respondo
                    personalmente en menos de 24 horas.
                  </p>
                </div>
              </div>

              <div className="studio-contact__item">
                <div className="studio-contact__icon">
                  <i className="fas fa-clock" aria-hidden="true" />
                </div>
                <div className="studio-contact__details">
                  <h4>Horarios de Atención</h4>
                  <p>
                    Lunes a Viernes: 9:00 - 20:00
                    <br />
                    Sábados: 10:00 - 16:00
                    <br />
                    Domingos: Cerrado
                  </p>
                </div>
              </div>

              <div className="studio-contact__item">
                <div className="studio-contact__icon">
                  <i className="fab fa-instagram" aria-hidden="true" />
                </div>
                <div className="studio-contact__details">
                  <h4>Instagram</h4>
                  <p>
                    <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer">
                      {INSTAGRAM_HANDLE}
                    </a>
                  </p>
                  <p>Seguime para ver mi trabajo y promociones</p>
                </div>
              </div>

              <div className="studio-contact__item">
                <div className="studio-contact__icon">
                  <i className="fas fa-map-marker-alt" aria-hidden="true" />
                </div>
                <div className="studio-contact__details">
                  <h4>Ubicación</h4>
                  <p>Zona Norte, Buenos Aires</p>
                  <p>Te paso la dirección exacta al confirmar turno</p>
                </div>
              </div>

              <div className="studio-contact__item">
                <div className="studio-contact__icon">
                  <i className="fas fa-calendar-alt" aria-hidden="true" />
                </div>
                <div className="studio-contact__details">
                  <h4>Reservas</h4>
                  <p>
                    Se requiere reserva previa
                    <br />
                    Seña del 50% para confirmar
                  </p>
                </div>
              </div>
            </div>

            <div className="studio-contact__form">
              <h3>Enviame tu Consulta</h3>
              <form onSubmit={handleContactSubmit}>
                <div className="studio-form-group">
                  <label htmlFor="contact-name">Nombre</label>
                  <input
                    id="contact-name"
                    name="name"
                    type="text"
                    value={contactForm.name}
                    onChange={handleContactChange}
                    required
                  />
                </div>

                <div className="studio-form-group">
                  <label htmlFor="contact-service">Servicio de Interés</label>
                  <select
                    id="contact-service"
                    name="service"
                    value={contactForm.service}
                    onChange={handleContactChange}
                    required
                  >
                    <option value="">Selecciona un servicio</option>
                    {CONTACT_SERVICE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="studio-form-group">
                  <label htmlFor="contact-message">Mensaje</label>
                  <textarea
                    id="contact-message"
                    name="message"
                    value={contactForm.message}
                    onChange={handleContactChange}
                    required
                  />
                </div>

                <button type="submit" className="btn btn-rosa btn--block">
                  <i className="fab fa-whatsapp" aria-hidden="true" />
                  Enviar Consulta por WhatsApp
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="studio-footer">
        <div className="studio-container">
          <div className="studio-footer__content">
            <div className="studio-footer__brand">
              <h2>
                Luminance<span className="studio-footer__dot">.</span>
              </h2>
              <div className="studio-footer__subtitle">
                by Cande | Estética Profesional
              </div>
              <p>
                5 años de experiencia especializada en pestañas, cejas y
                tratamientos estéticos. Belleza natural, resultados
                profesionales.
              </p>
              <div className="studio-footer__social">
                <a href="#" aria-label="Instagram">
                  <i className="fab fa-instagram" aria-hidden="true" />
                </a>
                <a href="#" aria-label="Facebook">
                  <i className="fab fa-facebook-f" aria-hidden="true" />
                </a>
                <a href="#" aria-label="TikTok">
                  <i className="fab fa-tiktok" aria-hidden="true" />
                </a>
              </div>
            </div>

            <div className="studio-footer__links">
              <h3>Servicios</h3>
              <ul>
                {FOOTER_SERVICE_LINKS.map((link) => (
                  <li key={link.label}>
                    <a href={footerServiceHref(link.target)}>
                      <i className="fas fa-chevron-right" aria-hidden="true" />{' '}
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="studio-footer__links">
              <h3>Cursos</h3>
              <ul>
                {FOOTER_COURSE_LINKS.map((label) => (
                  <li key={label}>
                    <a href="#cursos">
                      <i className="fas fa-chevron-right" aria-hidden="true" />{' '}
                      {label}
                    </a>
                  </li>
                ))}
              </ul>

              <h3 className="studio-footer__subheading">Contacto Directo</h3>
              <ul>
                <li>
                  <a href={buildWhatsappUrl()} target="_blank" rel="noreferrer">
                    <i className="fab fa-whatsapp" aria-hidden="true" />{' '}
                    {WHATSAPP_DISPLAY_SHORT}
                  </a>
                </li>
                <li>
                  <i className="fas fa-clock" aria-hidden="true" /> Lun-Vie:
                  9:00-20:00
                </li>
                <li>
                  <i className="fas fa-clock" aria-hidden="true" /> Sábados:
                  10:00-16:00
                </li>
              </ul>
            </div>

            <div className="studio-footer__links">
              <h3>Métodos de Pago</h3>
              <div className="studio-footer__payments">
                <i className="fas fa-money-bill-wave" title="Efectivo" />
                <i className="fas fa-university" title="Transferencia" />
                <i className="fab fa-cc-visa" title="Visa" />
                <i className="fab fa-cc-mastercard" title="Mastercard" />
                <i className="fab fa-cc-amex" title="American Express" />
              </div>

              <h3 className="studio-footer__subheading">Políticas</h3>
              <ul>
                <li>
                  <i className="fas fa-calendar-check" aria-hidden="true" />{' '}
                  Reserva con seña del 50%
                </li>
                <li>
                  <i className="fas fa-clock" aria-hidden="true" /> Cancelación
                  con 48h de anticipación
                </li>
                <li>
                  <i className="fas fa-user-clock" aria-hidden="true" />{' '}
                  Puntualidad requerida
                </li>
              </ul>
            </div>
          </div>

          <div className="studio-footer__bottom">
            <p>
              © 2024 Luminance Studio by Cande. Todos los derechos reservados. |
              Especialista en estética con 5 años de experiencia
            </p>
            <p className="studio-footer__credits">
              Sitio web diseñado profesionalmente para mostrar servicios y
              cursos de estética
            </p>
          </div>
        </div>
      </footer>

      <a
        href={buildWhatsappUrl(WHATSAPP_MESSAGES.services)}
        className="studio-whatsapp-float"
        target="_blank"
        rel="noreferrer"
        aria-label="Contactar a Cande por WhatsApp"
      >
        <i className="fab fa-whatsapp" aria-hidden="true" />
      </a>

      <LoginRequiredModal open={isLoginModalOpen} onClose={closeLoginModal} />
    </div>
  )
}
