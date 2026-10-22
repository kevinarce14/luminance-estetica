export const WHATSAPP_NUMBER = '5491130601712'
export const WHATSAPP_DISPLAY = '+54 9 11 3060-1712'
export const WHATSAPP_DISPLAY_SHORT = '11 3060-1712'
export const INSTAGRAM_URL = 'https://instagram.com/luminance.studio'
export const INSTAGRAM_HANDLE = '@luminance.studio'

/** Aviso del footer: el estudio y su contenido son ficticios (proyecto de portfolio). */
export const DEMO_DISCLAIMER =
  'Proyecto de portfolio: Luminance Studio by Cande es un estudio ficticio. Nombres, testimonios, servicios y precios son de demostración; el WhatsApp de contacto es el del autor.'

export const WHATSAPP_MESSAGES = {
  general: 'Hola Cande! Vi tu página y quisiera consultarte por...',
  services: 'Hola Cande! Quiero consultarte sobre tus servicios',
  aparatologia: 'Hola Cande! Quiero consultar por tratamientos de aparatología',
  allCourses: 'Hola Cande! Quiero consultar por todos los cursos disponibles',
} as const

export function buildWhatsappUrl(message?: string): string {
  const baseUrl = `https://wa.me/${WHATSAPP_NUMBER}`
  return message ? `${baseUrl}?text=${encodeURIComponent(message)}` : baseUrl
}
