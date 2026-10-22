import { ServiceCategory } from '../types/service.ts'
import type {
  ContactServiceOption,
  Course,
  FooterServiceLink,
  IconCard,
  ServiceCategoryMeta,
  StudioSectionLink,
  StudioStat,
  Testimonial,
  TimelineEntry,
} from '../types/studio.ts'

/** Contenido estático de la página del estudio (migrado de la versión original). */

export const STUDIO_SECTION_LINKS: StudioSectionLink[] = [
  { id: 'cursos', label: 'Cursos' },
  { id: 'sobremi', label: 'Sobre Mí' },
  { id: 'formacion', label: 'Formación' },
  { id: 'testimonios', label: 'Testimonios' },
  { id: 'contacto', label: 'Contacto' },
]

/** Orden en que se renderizan las categorías (igual que `categoryConfig` del legado). */
export const SERVICE_CATEGORY_ORDER: ServiceCategory[] = [
  ServiceCategory.CEJAS,
  ServiceCategory.PESTANAS,
  ServiceCategory.LASER,
  ServiceCategory.FACIAL,
  ServiceCategory.CORPORAL,
  ServiceCategory.PIES,
  ServiceCategory.OTROS,
]

export const SERVICE_CATEGORY_META: Record<ServiceCategory, ServiceCategoryMeta> = {
  [ServiceCategory.CEJAS]: { title: 'Cejas & Diseño', emoji: '🎨', icon: 'fas fa-paint-brush' },
  [ServiceCategory.PESTANAS]: { title: 'Pestañas & Lifting', emoji: '👁️', icon: 'fas fa-eye' },
  [ServiceCategory.LASER]: { title: 'Depilación Láser', emoji: '✨', icon: 'fas fa-spa' },
  [ServiceCategory.FACIAL]: { title: 'Tratamientos Faciales', emoji: '💆', icon: 'fas fa-user-md' },
  [ServiceCategory.CORPORAL]: { title: 'Tratamientos Corporales', emoji: '🌟', icon: 'fas fa-dumbbell' },
  [ServiceCategory.PIES]: { title: 'Pies & Pedicuría', emoji: '🦶', icon: 'fas fa-shoe-prints' },
  [ServiceCategory.OTROS]: { title: 'Otros Servicios', emoji: '💅', icon: 'fas fa-spa' },
}

export const SERVICE_FEATURES: string[] = [
  'Profesional certificada',
  'Productos de primera calidad',
  'Ambiente higienizado',
]

export const STUDIO_STATS: StudioStat[] = [
  { value: 5, suffix: '+', label: 'Años de Experiencia' },
  { value: 500, suffix: '+', label: 'Clientes Satisfechas' },
  { value: 50, suffix: '+', label: 'Alumnas Formadas' },
  { value: 100, suffix: '%', label: 'Dedicación' },
]

export const BENEFITS: IconCard[] = [
  { icon: 'fas fa-hand-sparkles', title: 'Precisión', description: 'Técnicas milimétricas en cada tratamiento' },
  { icon: 'fas fa-heart', title: 'Pasión', description: 'Amor por cada detalle del proceso' },
  { icon: 'fas fa-award', title: 'Calidad', description: 'Productos premium y tecnología de vanguardia' },
  { icon: 'fas fa-users', title: 'Confianza', description: 'Relaciones duraderas con mis clientas' },
]

export const APARATO_TREATMENTS: IconCard[] = [
  {
    icon: 'fas fa-weight',
    title: 'Reducción Localizada',
    description: 'Tecnología para eliminar grasa localizada en abdomen, cartucheras, espalda y brazos.',
  },
  {
    icon: 'fas fa-heartbeat',
    title: 'Radiofrecuencia',
    description: 'Reafirmación y rejuvenecimiento cutáneo. Estimula producción de colágeno.',
  },
  {
    icon: 'fas fa-wave-square',
    title: 'Ultracavitación',
    description: 'Eliminación de adiposidades mediante ultrasonidos de alta frecuencia.',
  },
]

export const COURSES: Course[] = [
  {
    id: 'laminado-cejas',
    badge: 'Más Popular',
    icon: 'fas fa-eye-brow',
    headerTitle: 'Curso Completo de Laminado de Cejas',
    title: 'Master en Laminado de Cejas',
    description:
      'Aprende desde cero la técnica de laminado profesional. Incluye diseño, henna y todos los secretos que he perfeccionado en 5 años de experiencia.',
    details: [
      { icon: 'fas fa-clock', label: '8 horas intensivas' },
      { icon: 'fas fa-users', label: 'Máximo 4 alumnas' },
      { icon: 'fas fa-calendar', label: 'Fechas flexibles' },
      { icon: 'fas fa-map-marker-alt', label: 'Presencial en estudio' },
    ],
    includes: [
      'Manual completo en PDF',
      'Kit profesional de inicio',
      'Práctica con modelos reales',
      'Certificado de finalización',
      'Grupo de apoyo post-curso',
      'Lista de proveedores premium',
    ],
    price: '$18.000',
    installment: 'o 3 cuotas de $6.500',
    whatsappMessage: 'Hola Cande! Quiero información sobre el Curso de Laminado de Cejas',
  },
  {
    id: 'lifting-pestanas',
    badge: 'Nuevo',
    icon: 'fas fa-eye',
    headerTitle: 'Curso de Lifting de Pestañas',
    title: 'Especialización en Lifting',
    description:
      'Domina la técnica de lifting profesional. Aprende a trabajar con diferentes tipos de pestañas y a lograr resultados que duren 6-8 semanas.',
    details: [
      { icon: 'fas fa-clock', label: '10 horas intensivas' },
      { icon: 'fas fa-users', label: 'Máximo 3 alumnas' },
      { icon: 'fas fa-calendar', label: 'Fines de semana' },
      { icon: 'fas fa-map-marker-alt', label: 'Presencial en estudio' },
    ],
    includes: [
      'Material didáctico completo',
      'Kit de productos profesionales',
      '2 modelos para práctica',
      'Certificado oficial',
      'Asesoramiento post-curso',
      'Tips para emprender',
    ],
    price: '$22.000',
    installment: 'o 3 cuotas de $7.800',
    whatsappMessage: 'Hola Cande! Quiero información sobre el Curso de Lifting de Pestañas',
  },
]

export const TIMELINE: TimelineEntry[] = [
  {
    year: '2019',
    title: 'Inicio en el Mundo de la Estética',
    description:
      'Comienzo mi formación en técnicas básicas de estética, especializándome en cejas y pestañas. Primeros clientes y desarrollo de mi método personal.',
  },
  {
    year: '2021',
    title: 'Especialización en Lifting de Pestañas',
    description:
      'Certificación profesional en lifting de pestañas. Implementación de técnicas avanzadas y ampliación de servicios en mi estudio.',
  },
  {
    year: '2023',
    title: 'Expansión a Tratamientos Corporales',
    description:
      'Formación en aparatología estética. Incorporación de depilación láser y tratamientos reductores a mi portafolio de servicios.',
  },
  {
    year: '2024',
    title: 'Tecnicatura en Cosmetología',
    description:
      'Inicio de estudios formales en cosmetología. Integración de conocimientos científicos para ofrecer tratamientos más efectivos y seguros.',
  },
]

export const TESTIMONIALS: Testimonial[] = [
  {
    initials: 'MG',
    name: 'María González',
    since: 'Cliente desde 2021',
    text: 'Cande es una genia total. Mi lifting de pestañas duró más de 2 meses y siempre me sentí en las mejores manos. Su dedicación y atención al detalle son increíbles. ¡Super recomendable!',
  },
  {
    initials: 'LF',
    name: 'Laura Fernández',
    since: 'Ex alumna | Ahora tiene su propio estudio',
    text: 'Hice el curso de laminado con Cande y fue excelente. No solo aprendí la técnica, sino también cómo manejar clientes y armar mi propio emprendimiento. Hoy tengo mi propio estudio gracias a ella.',
  },
  {
    initials: 'AP',
    name: 'Ana Paula',
    since: 'Cliente mensual de cejas',
    text: 'Las cejas que me hace Cande son perfectas. Siempre analiza mi rostro y me da recomendaciones personalizadas. El laminado con henna me cambió la vida, ¡no salgo sin mis cejas hechas!',
  },
]

export const CONTACT_SERVICE_OPTIONS: ContactServiceOption[] = [
  { value: 'lifting', label: 'Lifting de Pestañas' },
  { value: 'cejas', label: 'Diseño de Cejas' },
  { value: 'laser', label: 'Depilación Láser' },
  { value: 'curso', label: 'Cursos' },
  { value: 'otro', label: 'Otro' },
]

export const FOOTER_SERVICE_LINKS: FooterServiceLink[] = [
  { label: 'Lifting de Pestañas', target: ServiceCategory.PESTANAS },
  { label: 'Diseño & Perfilado de Cejas', target: ServiceCategory.CEJAS },
  { label: 'Laminado de Cejas', target: ServiceCategory.CEJAS },
  { label: 'Henna en Cejas', target: ServiceCategory.CEJAS },
  { label: 'Depilación Láser', target: ServiceCategory.LASER },
  { label: 'Estética Corporal', target: 'aparato' },
  { label: 'Pedicuría Premium', target: ServiceCategory.PIES },
]

export const FOOTER_COURSE_LINKS: string[] = [
  'Laminado de Cejas',
  'Lifting de Pestañas',
  'Cursos Personalizados',
]
